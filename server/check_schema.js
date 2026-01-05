require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkSchema() {
    console.log('--- Users Table Schema ---');
    try {
        const result = await db.execute("PRAGMA table_info(users)");
        const userCol = result.rows.find(r => r.name === 'username');
        console.log("Username Column:", JSON.stringify(userCol, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
