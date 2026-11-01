const { createClient } = require('@libsql/client');
const { Pool, types } = require('pg');
const path = require('path');
// Explicitly point to the .env file in the root directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Preserve raw timestamp strings to maintain 100% parity with SQLite/Turso and deterministic cryptographic hashing
types.setTypeParser(1114, (str) => str);

const pino = require('pino');
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'djadwal-db' },
    redact: ['url', 'authToken', 'password', 'token', 'authorization', 'connectionString']
});

// Database credentials and configuration
const dbConfig = {
    tursoUrl: process.env.TURSO_DATABASE_URL,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
    postgresUrl: process.env.DATABASE_URL || process.env.DIRECT_URL
};

// Feature Flags (P6: Managed Migrations & Neon PostgreSQL Primary Engine)
const FEATURE_READ_SOURCE = process.env.FEATURE_READ_SOURCE || 'postgres'; // 'postgres' | 'turso'
const FEATURE_DUAL_WRITE = process.env.FEATURE_DUAL_WRITE !== 'false'; // default true

logger.info({
    hasTurso: Boolean(dbConfig.tursoUrl && dbConfig.tursoAuthToken),
    hasPostgres: Boolean(dbConfig.postgresUrl),
    readSource: FEATURE_READ_SOURCE,
    dualWrite: FEATURE_DUAL_WRITE
}, 'Database configuration and feature flags initialized');

let db = null; // Turso client
let pgPool = null; // Neon PostgreSQL pool
let initPromise = null;
let schemaVerified = false;
let keepAliveTimer = null;

// Initialize Neon PostgreSQL Connection Pool
function getPgPool() {
    if (!pgPool && dbConfig.postgresUrl) {
        pgPool = new Pool({
            connectionString: dbConfig.postgresUrl,
            ssl: { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        });

        pgPool.on('error', (err) => {
            logger.error({ err: err.message }, 'Unexpected idle client error in Neon PostgreSQL pool');
        });
    }
    return pgPool;
}

// Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, ...)
function toPostgresQuery(query) {
    let pgQuery = query;
    if (pgQuery.includes('?')) {
        let index = 1;
        pgQuery = pgQuery.replace(/\?/g, () => `$${index++}`);
    }
    // Clean SQLite-specific phrases
    pgQuery = pgQuery.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    pgQuery = pgQuery.replace(/DATETIME\('now'\)/gi, 'CURRENT_TIMESTAMP');
    pgQuery = pgQuery.replace(/DATE\('now'\)/gi, 'CURRENT_DATE');
    pgQuery = pgQuery.replace(/DATETIME\(([^)]+)\)/gi, '$1');
    return pgQuery;
}

// Convert PostgreSQL placeholders ($1, $2, ...) to SQLite placeholders (?)
function toSqliteQuery(query) {
    let sqliteQuery = query;
    if (sqliteQuery.includes('$')) {
        let index = 1;
        while (sqliteQuery.includes(`$${index}`)) {
            sqliteQuery = sqliteQuery.replace(new RegExp(`\\$${index}\\b`, 'g'), '?');
            index++;
        }
    }
    return sqliteQuery;
}

// Vérifier si une erreur est due à une perte de connexion réseau/Turso/Postgres
function isConnectionError(err) {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    const code = String(err.code || '').toLowerCase();
    return (
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('connection closed') ||
        msg.includes('connection reset') ||
        msg.includes('socket hang up') ||
        msg.includes('stream closed') ||
        msg.includes('websocket is closed') ||
        msg.includes('websocket closed') ||
        msg.includes('tls') ||
        msg.includes('client closed') ||
        msg.includes('bad gateway') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('econnrefused') ||
        msg.includes('ehostunreach') ||
        msg.includes('server closed the connection') ||
        code === 'econnreset' ||
        code === 'etimedout' ||
        code === 'econnrefused' ||
        code === '57p01' // admin shutdown
    );
}

// Maintenir la connexion active pour empêcher la fermeture par inactivité
function startKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(async () => {
        try {
            if (pgPool) {
                await pgPool.query('SELECT 1 as keepalive');
            }
        } catch (err) {
            if (isConnectionError(err)) {
                logger.warn({ err: err.message }, 'Keepalive ping detected dropped Postgres connection.');
            }
        }

        try {
            if (db) {
                await db.sql('SELECT 1 as keepalive');
            }
        } catch (err) {
            if (isConnectionError(err)) {
                logger.warn({ err: err.message }, 'Keepalive ping detected dropped Turso connection. Resetting Turso handle.');
                try {
                    if (db && typeof db.close === 'function') db.close();
                } catch (_) {}
                db = null;
                initPromise = null;
            }
        }
    }, 45000);
    if (keepAliveTimer.unref) {
        keepAliveTimer.unref();
    }
}

// Read-only schema verification (Zero DDL on startup as per P6 Charter)
async function verifySchemaReadOnly(client, isPg = false) {
    const checks = [
        { name: 'sandbox_snapshots', sql: 'SELECT 1 FROM sandbox_snapshots LIMIT 1' },
        { name: 'semesters.is_public', sql: 'SELECT is_public FROM semesters LIMIT 1' },
        { name: 'app_config', sql: 'SELECT 1 FROM app_config LIMIT 1' },
        { name: 'audit_log hash chain', sql: 'SELECT prev_hash, row_hash, claimed_by FROM audit_log LIMIT 1' }
    ];

    for (const check of checks) {
        try {
            if (isPg) {
                await client.query(check.sql);
            } else {
                await client.sql(check.sql);
            }
        } catch (err) {
            logger.warn({ check: check.name, err: err.message }, 'Schema element verification check failed. Ensure migrations are applied via "npx ts-node scripts/migrate.ts apply".');
        }
    }
}

// Asynchronously record secondary dual-write failures without affecting user experience
async function recordReconciliationDiff(query, params, errorMessage) {
    try {
        const pool = getPgPool();
        if (!pool) return;

        const opMatch = query.match(/^\s*(INSERT|UPDATE|DELETE)\s+/i);
        const operation = opMatch ? opMatch[1].toUpperCase() : 'WRITE';
        const tableMatch = query.match(/(?:INTO|FROM|UPDATE)\s+["']?([a-zA-Z0-9_]+)["']?/i);
        const tableName = tableMatch ? tableMatch[1] : 'unknown';

        await pool.query(
            'INSERT INTO reconciliation_diffs (table_name, operation, payload, error_message, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [tableName, operation, JSON.stringify({ query, params }), String(errorMessage || 'Unknown secondary write failure')]
        );
        logger.info({ tableName, operation }, 'Recorded dual-write divergence into reconciliation_diffs');
    } catch (diffErr) {
        logger.warn({ err: diffErr.message }, 'Failed to record in reconciliation_diffs');
    }
}

// Initialiser la connexion à la base de données
async function initDatabaseConnection() {
    const needTurso = Boolean(dbConfig.tursoUrl && dbConfig.tursoAuthToken);
    const needPg = Boolean(dbConfig.postgresUrl);

    if ((!needTurso || db) && (!needPg || pgPool) && schemaVerified) {
        return { db, pgPool };
    }
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            // 1. Initialize Neon PostgreSQL Pool (Primary)
            if (needPg && !pgPool) {
                const pool = getPgPool();
                if (pool) {
                    await pool.query('SELECT 1 as test');
                    logger.info('Neon PostgreSQL connected successfully as Primary Database Engine');
                }
            }

            // 2. Initialize Turso (Backup / Dual-Write target)
            if (needTurso && !db) {
                const tursoClient = createClient({
                    url: dbConfig.tursoUrl,
                    authToken: dbConfig.tursoAuthToken
                });

                db = {
                    sql: async (query, params = []) => {
                        const result = await tursoClient.execute({
                            sql: query,
                            args: params
                        });
                        return result.rows;
                    },
                    close: () => tursoClient.close(),
                    raw: tursoClient
                };

                await db.sql('SELECT 1 as test', []);
                logger.info('Turso connected successfully as Backup / Dual-Write target');
            }

            if (!schemaVerified) {
                // P6: Zero DDL on Boot. Verify presence only without altering or creating tables.
                if (pgPool) {
                    await verifySchemaReadOnly(pgPool, true);
                } else if (db) {
                    await verifySchemaReadOnly(db, false);
                    const { ensureAuthTables } = require('./services/authMigrations');
                    await ensureAuthTables(db);
                }

                startKeepAlive();
                schemaVerified = true;
            }

            return { db, pgPool };
        } catch (error) {
            logger.error({ err: error.message }, 'Database connection initialization failed');
            initPromise = null;
            throw error;
        } finally {
            initPromise = null;
        }
    })();

    return initPromise;
}

// Execute query on Turso with automatic retry loop
async function executeTursoQuery(query, params = [], maxRetries = 2) {
    const sqliteSql = toSqliteQuery(query);
    const cleanParams = params.map(p => (p === undefined ? null : p));

    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (!db) {
                await initDatabaseConnection();
            }
            const result = await db.sql(sqliteSql, cleanParams);
            return result;
        } catch (error) {
            lastError = error;
            if (isConnectionError(error) && attempt < maxRetries) {
                try {
                    if (db && typeof db.close === 'function') db.close();
                } catch (_) {}
                db = null;
                await new Promise(res => setTimeout(res, attempt * 200));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

// Exécuter une requête (avec routage immédiat vers Neon PostgreSQL et Dual-Write vers Turso)
async function executeQuery(query, params = [], maxRetries = 3) {
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const trimmed = query.trim();
    const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH\s+[a-zA-Z0-9_]+\s+AS\s+\(.*?\)\s*SELECT)\b/i.test(trimmed);

    // Ensure connection is initialized
    const pool = getPgPool();
    if (!pool && !db) {
        await initDatabaseConnection();
    }

    // --- CASE 1: READ OPERATIONS (SELECT) ---
    if (isSelect) {
        // If Postgres is configured as read source, query Neon directly (ZERO SHADOW READS)
        if (FEATURE_READ_SOURCE === 'postgres' && pool) {
            const pgSql = toPostgresQuery(query);
            try {
                const res = await pool.query(pgSql, cleanParams);
                return res.rows;
            } catch (pgErr) {
                logger.error({ err: pgErr.message, query: query.substring(0, 100) }, 'Postgres read query failed');
                // Emergency Fallback to Turso if Postgres fails
                if (dbConfig.tursoUrl && dbConfig.tursoAuthToken) {
                    logger.warn('Emergency Fallback: Executing read query on Turso...');
                    return await executeTursoQuery(query, cleanParams, maxRetries);
                }
                throw pgErr;
            }
        }

        // Emergency / manual override: read from Turso
        return await executeTursoQuery(query, cleanParams, maxRetries);
    }

    // --- CASE 2: WRITE OPERATIONS (INSERT, UPDATE, DELETE) ---
    // Primary execution on Neon PostgreSQL
    if (pool) {
        const pgSql = toPostgresQuery(query);
        let primaryResult;

        try {
            const res = await pool.query(pgSql, cleanParams);
            primaryResult = res.rows;
        } catch (primaryErr) {
            logger.error({ err: primaryErr.message, query: query.substring(0, 100) }, 'Primary write on Neon failed');
            throw primaryErr;
        }

        // Secondary Dual-Write to Turso in background (Safety net - never blocks response)
        if (FEATURE_DUAL_WRITE && dbConfig.tursoUrl && dbConfig.tursoAuthToken) {
            (async () => {
                try {
                    await executeTursoQuery(query, cleanParams, 2);
                } catch (dualErr) {
                    logger.warn({ err: dualErr.message, query: query.substring(0, 100) }, 'Dual-write to Turso backup failed');
                    await recordReconciliationDiff(query, cleanParams, dualErr.message);
                }
            })().catch(() => {});
        }

        return primaryResult;
    }

    // Fallback if Postgres pool is not configured: execute on Turso
    return await executeTursoQuery(query, cleanParams, maxRetries);
}

module.exports = {
    initDatabaseConnection,
    executeQuery,
    getPgPool,
    recordReconciliationDiff
};
