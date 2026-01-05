require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function fixSchema() {
    console.log('🚀 Adding user_id to professors table...');
    try {
        await db.execute("ALTER TABLE professors ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
        console.log('✅ Added user_id column');

        await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_professors_user_id ON professors(user_id)");
        console.log('✅ Created unique index on user_id');

    } catch (e) {
        if (e.message.includes('duplicate column')) {
            console.log('⚠️ user_id column already exists');
        } else {
            console.error('❌ Migration failed:', e);
        }
    }
}

fixSchema();
