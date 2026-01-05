require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkAdmin() {
    console.log('--- Checking for Admin Users ---');
    try {
        const result = await db.execute("SELECT id, username, email, role FROM users WHERE role = 'admin' OR role = 'ADMIN'");
        if (result.rows.length === 0) {
            console.log('No ADMIN users found.');
        } else {
            console.log(JSON.stringify(result.rows, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

checkAdmin();
