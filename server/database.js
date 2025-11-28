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

            return db;
        }
        return db;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
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
