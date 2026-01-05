require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function verifyFix() {
    try {
        await db.execute("INSERT OR IGNORE INTO users (email, username, password_hash) VALUES ('verify.fix@test.com', 'verify.fix@test.com', 'hash')");
        const user = await db.execute("SELECT id FROM users WHERE email = 'verify.fix@test.com'");
        const userId = user.rows[0].id;

        console.log('Testing INSERT into professors with user_id...');
        await db.execute({
            sql: "INSERT INTO professors (user_id, full_name_arabic) VALUES (?, ?)",
            args: [userId, 'Test Professor']
        });
        console.log('✅ Success: INSERT with user_id worked!');

        // Cleanup
        await db.execute("DELETE FROM users WHERE email='verify.fix@test.com'");
    } catch (e) {
        console.error('❌ Failed:', e.message);
    }
}

verifyFix();
