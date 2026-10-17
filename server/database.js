const { createClient } = require('@libsql/client');
const path = require('path');
// Explicitly point to the .env file in the root directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pino = require('pino');
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'djadwal-db' },
    redact: ['url', 'authToken', 'password', 'token', 'authorization']
});

// Configuration de la base de données
const dbConfig = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
};

logger.info({
    hasUrl: Boolean(dbConfig.url),
    hasToken: Boolean(dbConfig.authToken)
}, 'Database configuration initialized');

let db = null;
let initPromise = null;
let schemaVerified = false;
let keepAliveTimer = null;

// Vérifier si une erreur est due à une perte de connexion réseau/Turso
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
        code === 'econnrefused'
    );
}

// Maintenir la connexion active pour empêcher la fermeture par inactivité côté proxy/cloud
function startKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(async () => {
        try {
            if (db) {
                await db.sql('SELECT 1 as keepalive');
            }
        } catch (err) {
            if (isConnectionError(err)) {
                logger.warn({ err: err.message }, 'Keepalive ping detected dropped database connection. Resetting connection handle.');
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

// Initialiser la connexion à la base de données (avec verrou d'initialisation pour éviter les vérifications concurrentes)
async function initDatabaseConnection() {
    if (db && schemaVerified) {
        return db;
    }
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            if (!db) {
                logger.info('Initializing database connection');

                if (!dbConfig.url || !dbConfig.authToken) {
                    throw new Error('Turso configuration is missing! Please check .env file.');
                }

                const tursoClient = createClient({
                    url: dbConfig.url,
                    authToken: dbConfig.authToken
                });

                // Wrap Turso client to match expected API
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

                // Test connection
                await db.sql('SELECT 1 as test', []);
                logger.info('Database connected successfully');
                startKeepAlive();
            }

            if (!schemaVerified) {
                // Ensure sandbox table exists
                await ensureSandboxTable(db);

                // Ensure semester visibility column exists
                await ensureSemesterPublicColumn(db);

                // Ensure app config table exists
                await ensureAppConfigTable(db);

                // Ensure P4 auth tables exist (sessions, auth_events, invitations, mfa_factors, reset tokens)
                const { ensureAuthTables } = require('./services/authMigrations');
                await ensureAuthTables(db);

                // Ensure P5 audit log cryptographic chain columns exist
                await ensureAuditLogHardening(db);

                // Ensure high-performance composite indexes for fast timetable reading
                try {
                    await db.sql('CREATE INDEX IF NOT EXISTS idx_assignments_year_sem ON assignments(academic_year, semester)');
                    await db.sql('CREATE INDEX IF NOT EXISTS idx_extra_sessions_date ON extra_sessions(session_date)');
                } catch (idxErr) {
                    // ignore
                }

                schemaVerified = true;
            }

            return db;
        } catch (error) {
            logger.error({ err: error.message }, 'Database connection failed');
            db = null;
            initPromise = null;
            throw error;
        } finally {
            initPromise = null;
        }
    })();

    return initPromise;
}

// Ensure sandbox_snapshots table exists
async function ensureSandboxTable(database) {
    try {
        await database.sql('SELECT 1 FROM sandbox_snapshots LIMIT 1');
        console.log('✅ sandbox_snapshots table already exists');
    } catch (error) {
        if (error.message.includes('no such table') || error.message.includes('does not exist')) {
            console.log('ℹ️ Creating sandbox_snapshots table...');
            await database.sql(`
                CREATE TABLE IF NOT EXISTS sandbox_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Created sandbox_snapshots table');
        } else {
            console.error('⚠️ Error checking sandbox table:', error);
        }
    }
}

// Ensure is_public column exists in semesters table
async function ensureSemesterPublicColumn(database) {
    try {
        // Check if the column exists
        await database.sql('SELECT is_public FROM semesters LIMIT 1');
        console.log('✅ is_public column already exists in semesters');
    } catch (error) {
        if (error.message.includes('no such column') || error.message.includes('does not exist')) {
            console.log('ℹ️ Adding is_public column to semesters table...');
            // Add column with default value 1 (visible)
            await database.sql('ALTER TABLE semesters ADD COLUMN is_public INTEGER DEFAULT 1');
            console.log('✅ Added is_public column to semesters table');
        } else {
            console.error('⚠️ Error ensuring is_public column:', error.message);
        }
    }
}

// Ensure app_config table exists for update management
async function ensureAppConfigTable(database) {
    try {
        await database.sql('SELECT 1 FROM app_config LIMIT 1');
        console.log('✅ app_config table already exists');
    } catch (error) {
        if (error.message.includes('no such table') || error.message.includes('does not exist')) {
            console.log('ℹ️ Creating app_config table...');
            await database.sql(`
                CREATE TABLE IF NOT EXISTS app_config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            `);

            // Initialiser avec des valeurs par défaut
            await database.sql("INSERT OR IGNORE INTO app_config (key, value) VALUES ('min_version', '4.0.0')");
            await database.sql("INSERT OR IGNORE INTO app_config (key, value) VALUES ('latest_version', '4.0.0')");
            await database.sql("INSERT OR IGNORE INTO app_config (key, value) VALUES ('download_url', 'https://dl.surf')");

            console.log('✅ Created and initialized app_config table');
        } else {
            console.error('⚠️ Error checking app_config table:', error);
        }
    }
}

// Ensure audit_log table and P5 cryptographic chain columns exist
async function ensureAuditLogHardening(database) {
    try {
        await database.sql(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id INTEGER,
                details TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                prev_hash TEXT DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
                row_hash TEXT,
                claimed_by TEXT
            )
        `);

        // Check if prev_hash column exists, if not add it (Expand pattern)
        try {
            await database.sql('SELECT prev_hash FROM audit_log LIMIT 1');
        } catch (colErr) {
            console.log('ℹ️ Adding prev_hash column to audit_log...');
            await database.sql("ALTER TABLE audit_log ADD COLUMN prev_hash TEXT DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'");
        }

        try {
            await database.sql('SELECT row_hash FROM audit_log LIMIT 1');
        } catch (colErr) {
            console.log('ℹ️ Adding row_hash column to audit_log...');
            await database.sql("ALTER TABLE audit_log ADD COLUMN row_hash TEXT");
        }

        try {
            await database.sql('SELECT claimed_by FROM audit_log LIMIT 1');
        } catch (colErr) {
            console.log('ℹ️ Adding claimed_by column to audit_log...');
            await database.sql("ALTER TABLE audit_log ADD COLUMN claimed_by TEXT");
        }

        await database.sql('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC)');
        await database.sql('CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id)');
        console.log('🔒 [AuditHardening] audit_log tamper-evident hash chain columns verified');
    } catch (err) {
        console.error('⚠️ Error ensuring audit_log hardening:', err.message);
    }
}

// Exécuter une requête avec reconnexion automatique et résilience aux déconnexions
async function executeQuery(query, params = [], maxRetries = 3) {
    // Convert PostgreSQL placeholders ($1, $2, ...) to SQLite placeholders (?)
    let sqliteQuery = query;
    const cleanParams = params.map(p => p === undefined ? null : p);

    // Replace $1, $2, etc. with ?
    if (query.includes('$')) {
        let index = 1;
        while (sqliteQuery.includes(`$${index}`)) {
            sqliteQuery = sqliteQuery.replace(`$${index}`, '?');
            index++;
        }
    }

    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (!db) {
                await initDatabaseConnection();
            }

            const result = await db.sql(sqliteQuery, cleanParams);
            return result;
        } catch (error) {
            lastError = error;
            const isConn = isConnectionError(error);

            if (isConn && attempt < maxRetries) {
                logger.warn({
                    attempt,
                    maxRetries,
                    err: error.message
                }, 'Database connection drop detected. Reconnecting and retrying query...');

                try {
                    if (db && typeof db.close === 'function') db.close();
                } catch (_) {}
                db = null;
                initPromise = null;

                // Exponential backoff: 200ms, 450ms
                await new Promise(res => setTimeout(res, attempt * 200));
                continue;
            }

            console.error(`❌ Query execution failed (attempt ${attempt}/${maxRetries}):`, error.message);
            console.error('📝 Query:', query);
            throw error;
        }
    }

    throw lastError;
}

module.exports = {
    initDatabaseConnection,
    executeQuery
};
