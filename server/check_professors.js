require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkSchema() {
    console.log('--- Professors Table Schema ---');
    try {
        const result = await db.execute("PRAGMA table_info(professors)");
        const nameCol = result.rows.find(r => r.name === 'name');
        console.log("name column:", nameCol ? JSON.stringify(nameCol) : "MISSING");
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
