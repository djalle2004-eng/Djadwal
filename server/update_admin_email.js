require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function updateAdmin() {
    console.log('🚀 Updating Admin email to allow Portal access...');
    try {
        await db.execute("UPDATE users SET email = 'admin@univ-eloued.dz' WHERE username = 'admin' OR role = 'admin'");
        console.log('✅ Admin email updated to: admin@univ-eloued.dz');
    } catch (e) {
        console.error('❌ Failed:', e.message);
    }
}

updateAdmin();
