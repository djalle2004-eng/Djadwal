
const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

async function migrate() {
    const client = createClient({ url, authToken });

    console.log('Adding is_public column to semesters table...');
    try {
        await client.execute('ALTER TABLE semesters ADD COLUMN is_public INTEGER DEFAULT 1');
        console.log('Successfully added is_public column.');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('Column is_public already exists.');
        } else {
            console.error('Migration failed:', e);
        }
    }
}

migrate();
