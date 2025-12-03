const { executeQuery } = require('./database');

async function migrate() {
    try {
        console.log('Checking for app_email column...');
        const columns = await executeQuery("PRAGMA table_info(email_settings)");
        const hasAppEmail = columns.some(col => col.name === 'app_email');

        if (!hasAppEmail) {
            console.log('Adding app_email column...');
            await executeQuery("ALTER TABLE email_settings ADD COLUMN app_email TEXT");
            console.log('✅ app_email column added successfully');
        } else {
            console.log('ℹ️ app_email column already exists');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
