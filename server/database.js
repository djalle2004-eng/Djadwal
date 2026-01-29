const { createClient } = require('@libsql/client');
const path = require('path');
// Explicitly point to the .env file in the root directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configuration de la base de données
const dbConfig = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
};

console.log('🔧 Server Database Config Check:');
console.log('   - URL:', dbConfig.url ? 'Set' : 'Missing');
console.log('   - Token:', dbConfig.authToken ? 'Set' : 'Missing');
console.log('   - Current Dir:', __dirname);
console.log('   - Env File Path:', path.join(__dirname, '../.env'));

let db = null;

// Initialiser la connexion à la base de données
async function initDatabaseConnection() {
    try {
        if (!db) {
            console.log('🚀 Initializing Turso connection...');

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
            console.log('✅ Database connected successfully');

            // Ensure sandbox table exists
            await ensureSandboxTable(db);

            // Ensure semester visibility column exists
            await ensureSemesterPublicColumn(db);

            return db;
        }
        return db;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
    }
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

// Exécuter une requête
async function executeQuery(query, params = []) {
    try {
        if (!db) {
            await initDatabaseConnection();
        }

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

        const result = await db.sql(sqliteQuery, cleanParams);
        return result;
    } catch (error) {
        console.error('❌ Query execution failed:', error.message);
        console.error('📝 Query:', query);
        throw error;
    }
}

module.exports = {
    initDatabaseConnection,
    executeQuery
};
