require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function testInsert() {
    console.log('--- Testing INSERT ---');
    const email = 'manual.test@univ-eloued.dz';
    const hash = 'hash123';

    try {
        // Try with named params first
        console.log('Attempting Named Params...');
        await db.execute({
            sql: "INSERT INTO users (username, email, password_hash, role, is_active) VALUES (:u, :e, :p, 'PROFESSOR', 1)",
            args: { u: email, e: email, p: hash }
        });
        console.log('✅ Named params Success');
    } catch (e) {
        console.error('❌ Named params Failed:', e.message);
    }

    try {
        // Try with positional params
        console.log('Attempting Positional Params (?) ...');
        await db.execute({
            sql: "INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, 'PROFESSOR', 1)",
            args: [email + '.2', email + '.2', hash]
        });
        console.log('✅ Positional params Success');
    } catch (e) {
        console.error('❌ Positional params Failed:', e.message);
    }
}

testInsert();
