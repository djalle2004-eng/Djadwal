require('dotenv').config({ path: '../.env' });
const { createClient } = require('@libsql/client');

const dbConfig = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
};

if (!dbConfig.url || !dbConfig.authToken) {
    console.error('❌ Missing Turso credentials in .env');
    process.exit(1);
}

const db = createClient({
    url: dbConfig.url,
    authToken: dbConfig.authToken
});

async function runMigration() {
    console.log('🚀 Starting Takleef Schema Migration...');

    try {
        // 1. Update Users Table
        console.log('📦 Updating users table...');
        try {
            await db.execute("ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE");
            console.log('   -> Added email column');
        } catch (e) { console.log('   -> email column likely exists'); }

        try {
            // Check if role column exists, if not add it
            // SQLite doesn't support IF NOT EXISTS in ALTER TABLE well, so we catch error
            await db.execute("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'PROFESSOR'");
            console.log('   -> Added role column');
        } catch (e) {
            // If error update default
            console.log('   -> role column likely exists');
        }

        try {
            await db.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE");
            console.log('   -> Added is_active column');
        } catch (e) { console.log('   -> is_active column likely exists'); }


        // 2. Create Password Reset Tokens
        console.log('📦 Creating password_reset_tokens table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Create Professors Table (Rich Profile)
        // Note: Djadwal already has a 'professors' table. We need to check if we should ALTER or REPLACE.
        // Djadwal professors: id, name, email, Title, Phone, Academic Title...
        // Takleef professors: full_name_arabic, full_name_latin, phd_specialization...
        // Strategy: Add missing columns to existing table to preserve data.
        console.log('📦 Updating professors table scheme...');
        const newCols = [
            "full_name_arabic TEXT",
            "full_name_latin TEXT",
            "academic_rank TEXT",
            "professional_email TEXT",
            "personal_email TEXT",
            "primary_phone TEXT",
            "secondary_phone TEXT",
            "phd_specialization TEXT",
            "field_of_research TEXT",
            "department VARCHAR(255)",
            "profile_completed BOOLEAN DEFAULT FALSE",
            "user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE"
        ];

        for (const col of newCols) {
            try {
                const colName = col.split(' ')[0];
                await db.execute(`ALTER TABLE professors ADD COLUMN ${col}`);
                console.log(`   -> Added ${colName}`);
            } catch (e) {
                // Console log only if strictly needed, mostly ignore "duplicate column" errors
            }
        }

        // 4. Create Modules Table
        // Djadwal has 'courses'. Takleef has 'modules'.
        // We will keep them separate for now or try to merge? 
        // Takleef 'modules' are the master definition of a subject. 'courses' in Djadwal might be the instance.
        // Let's create 'modules' as defined in Takleef for now to store the academic structure.
        console.log('📦 Creating modules table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS modules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_code VARCHAR(50) UNIQUE,
                module_name_arabic VARCHAR(255) NOT NULL,
                module_name_english VARCHAR(255) NOT NULL,
                credits INTEGER,
                semester INTEGER,
                department VARCHAR(255) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 5. Create Preferences Table
        console.log('📦 Creating preferences table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                professor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
                academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE CASCADE,
                teaching_type VARCHAR(20) NOT NULL,
                priority_level INTEGER DEFAULT 3,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(professor_id, module_id, academic_year_id)
            )
        `);

        console.log('✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        // Close not explicitly needed for script but good practice if client supports it
    }
}

runMigration();
