// Migrate professors separately
const { Database } = require('@sqlitecloud/drivers');
const { createClient } = require('@libsql/client');

const SQLITECLOUD_CONFIG = {
  host: 'cjh4w9vank.g4.sqlite.cloud',
  port: 8860,
  password: '78aNzNpDYNpQjJQmPaH6PN7wpdRKe4keSEYiTaxRYyM',
  database: 'Djadwal'
};

const TURSO_URL = 'libsql://djadwal-djalle.aws-eu-west-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjE5MDkwMDYsImlkIjoiNzQyYmY2OTYtNDA3Zi00NDYwLWE4ZGEtZTQwNDJmMzQxZTY0IiwicmlkIjoiZDM1NjBjOTMtYzlmZi00OTliLWJkOTMtMDE5YmMwODAzOTUyIn0.eBc_mzZBjxIKGk67o7P0eae3fS4dJoerkiBurw92bhlUpAaKvCg2jGNDrG3IlPwCwNgjG8J5rOlhoRU2RfcWBA';

async function migrateProfessors() {
  try {
    console.log('📡 Connecting to SQLite Cloud...');
    const connectionString = `sqlitecloud://${SQLITECLOUD_CONFIG.host}:${SQLITECLOUD_CONFIG.port}/${SQLITECLOUD_CONFIG.database}?apikey=${SQLITECLOUD_CONFIG.password}`;
    const sqliteCloud = new Database(connectionString);
    console.log('✅ Connected');

    console.log('🚀 Connecting to Turso...');
    const turso = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN
    });
    console.log('✅ Connected');

    console.log('\n📦 Fetching professors from SQLite Cloud...');
    const professors = await sqliteCloud.sql('SELECT * FROM professors');
    console.log(`📊 Found ${professors.length} professors`);

    let successCount = 0;

    for (const prof of professors) {
      try {
        await turso.execute({
          sql: `INSERT INTO professors (id, name, email, phone, title, academic_title, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            prof.id,
            prof.name,
            prof.email || null,
            prof.phone || prof.Phone || null,  // Try both column names
            prof.title || prof.Title || null,
            prof.academic_title || prof['Academic Title'] || null,
            prof.created_at || new Date().toISOString()
          ]
        });
        successCount++;
        
        if (successCount % 10 === 0) {
          console.log(`   ⏳ Progress: ${successCount}/${professors.length}`);
        }
      } catch (error) {
        if (!error.message.includes('UNIQUE')) {
          console.log(`   ⚠️ Error with professor "${prof.name}":`, error.message.substring(0, 80));
        }
      }
    }

    console.log(`\n✅ Migrated ${successCount} professors to Turso!`);

    sqliteCloud.close();
    turso.close();

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

migrateProfessors();
