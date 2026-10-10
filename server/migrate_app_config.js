const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

async function migrate() {
    if (!url || !authToken) {
        console.error('❌ Error: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing in .env file');
        return;
    }

    const client = createClient({ url, authToken });

    console.log('🚀 Starting app_config table migration...');

    try {
        await client.execute(`
            CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);
        console.log('✅ Table app_config created or already exists.');

        // Initialiser مع قيم افتراضية
        console.log('ℹ️ Initializing default values...');
        await client.execute("INSERT OR IGNORE INTO app_config (key, value) VALUES ('min_version', '4.0.0')");
        await client.execute("INSERT OR IGNORE INTO app_config (key, value) VALUES ('latest_version', '4.0.0')");
        await client.execute("INSERT OR IGNORE INTO app_config (key, value) VALUES ('download_url', 'https://dl.surf')");

        console.log('✅ Migration completed successfully!');
    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await client.close();
    }
}

migrate();
