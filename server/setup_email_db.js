const { executeQuery } = require('./database');

async function setupEmailTables() {
    try {
        console.log('🚀 Setting up email database tables...');

        // Create email_settings table
        await executeQuery(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gmail_refresh_token TEXT,
        gmail_access_token TEXT,
        token_expiry DATETIME,
        app_email TEXT,
        is_authenticated INTEGER DEFAULT 0,
        last_auth_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ email_settings table created');

        // Create email_logs table
        await executeQuery(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professor_id INTEGER,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES professors(id)
      )
    `);
        console.log('✅ email_logs table created');

        // Initialize default settings if not exists
        const settings = await executeQuery('SELECT * FROM email_settings WHERE id = 1');
        if (settings.length === 0) {
            await executeQuery(`
        INSERT INTO email_settings (id, is_authenticated) VALUES (1, 0)
      `);
            console.log('✅ Default settings initialized');
        }

        console.log('🎉 Email database setup completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting up email database:', error);
        process.exit(1);
    }
}

setupEmailTables();
