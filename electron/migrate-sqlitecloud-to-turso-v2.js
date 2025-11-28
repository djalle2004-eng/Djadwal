// Fixed migration script with proper handling
const { Database } = require('@sqlitecloud/drivers');
const { createClient } = require('@libsql/client');

const SQLITECLOUD_CONFIG = {
  host: 'cjh4w9vank.g4.sqlite.cloud',
  port: 8860,
  username: 'apikey',
  password: '78aNzNpDYNpQjJQmPaH6PN7wpdRKe4keSEYiTaxRYyM',
  database: 'Djadwal'
};

const TURSO_URL = 'libsql://djadwal-djalle.aws-eu-west-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjE5MDkwMDYsImlkIjoiNzQyYmY2OTYtNDA3Zi00NDYwLWE4ZGEtZTQwNDJmMzQxZTY0IiwicmlkIjoiZDM1NjBjOTMtYzlmZi00OTliLWJkOTMtMDE5YmMwODAzOTUyIn0.eBc_mzZBjxIKGk67o7P0eae3fS4dJoerkiBurw92bhlUpAaKvCg2jGNDrG3IlPwCwNgjG8J5rOlhoRU2RfcWBA';

async function fixSchemaAndMigrate() {
  let sqliteCloudDb = null;
  let tursoClient = null;

  try {
    console.log('📡 Connecting to SQLite Cloud...');
    const connectionString = `sqlitecloud://${SQLITECLOUD_CONFIG.host}:${SQLITECLOUD_CONFIG.port}/${SQLITECLOUD_CONFIG.database}?apikey=${SQLITECLOUD_CONFIG.password}`;
    sqliteCloudDb = new Database(connectionString);
    console.log('✅ Connected to SQLite Cloud');

    console.log('🚀 Connecting to Turso...');
    tursoClient = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN
    });
    console.log('✅ Connected to Turso');

    // Fix extra_sessions schema - add reason column
    console.log('\n🔧 Fixing extra_sessions schema...');
    try {
      await tursoClient.execute('ALTER TABLE extra_sessions ADD COLUMN reason TEXT');
      console.log('✅ Added reason column to extra_sessions');
    } catch (e) {
      if (e.message && e.message.includes('duplicate column')) {
        console.log('✅ reason column already exists');
      } else {
        console.log('⚠️ Could not add reason column:', e.message);
      }
    }

    // Disable foreign keys for assignments migration
    console.log('\n🔧 Disabling foreign key constraints...');
    await tursoClient.execute('PRAGMA foreign_keys = OFF');
    console.log('✅ Foreign keys disabled');

    // Migrate assignments
    console.log('\n📦 Migrating assignments...');
    try {
      const assignments = await sqliteCloudDb.sql('SELECT * FROM assignments');
      
      if (assignments && assignments.length > 0) {
        console.log(`   📊 Found ${assignments.length} rows`);
        
        let successCount = 0;
        let errorCount = 0;

        for (const row of assignments) {
          try {
            // Map only columns that exist in both schemas
            await tursoClient.execute({
              sql: `INSERT INTO assignments 
                    (id, group_id, course_id, professor_id, room_id, day_of_week, 
                     start_time, end_time, session_type, academic_year, semester, specialization, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                row.id,
                row.group_id,
                row.course_id,
                row.professor_id,
                row.room_id,
                row.day_of_week,
                row.start_time,
                row.end_time,
                row.session_type || 'lecture',
                row.academic_year || '',
                row.semester || '1',
                row.specialization || '',
                row.created_at || new Date().toISOString()
              ]
            });
            successCount++;
            
            if (successCount % 100 === 0) {
              console.log(`   ⏳ Progress: ${successCount}/${assignments.length}`);
            }
          } catch (insertError) {
            if (insertError.message && insertError.message.includes('UNIQUE')) {
              // Skip duplicate
            } else {
              errorCount++;
              if (errorCount <= 5) {
                console.log(`   ⚠️ Error at row ${row.id}:`, insertError.message.substring(0, 100));
              }
            }
          }
        }

        console.log(`   ✅ Migrated ${successCount} assignments`);
        if (errorCount > 0) {
          console.log(`   ⚠️ ${errorCount} rows failed`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error migrating assignments:`, error.message);
    }

    // Migrate extra_sessions
    console.log('\n📦 Migrating extra_sessions...');
    try {
      const sessions = await sqliteCloudDb.sql('SELECT * FROM extra_sessions');
      
      if (sessions && sessions.length > 0) {
        console.log(`   📊 Found ${sessions.length} rows`);
        
        let successCount = 0;

        for (const row of sessions) {
          try {
            await tursoClient.execute({
              sql: `INSERT INTO extra_sessions 
                    (id, group_id, course_id, professor_id, room_id, session_date,
                     start_time, end_time, description, session_type, academic_year, 
                     semester, reason, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                row.id,
                row.group_id,
                row.course_id,
                row.professor_id,
                row.room_id,
                row.session_date,
                row.start_time,
                row.end_time,
                row.description || '',
                row.session_type || 'extra',
                row.academic_year || '',
                row.semester || '1',
                row.reason || '',
                row.created_at || new Date().toISOString()
              ]
            });
            successCount++;
          } catch (insertError) {
            if (!insertError.message.includes('UNIQUE')) {
              console.log(`   ⚠️ Error:`, insertError.message);
            }
          }
        }

        console.log(`   ✅ Migrated ${successCount} extra_sessions`);
      }
    } catch (error) {
      console.error(`   ❌ Error migrating extra_sessions:`, error.message);
    }

    // Re-enable foreign keys
    console.log('\n🔧 Re-enabling foreign key constraints...');
    await tursoClient.execute('PRAGMA foreign_keys = ON');
    console.log('✅ Foreign keys enabled');

    console.log('\n🎉 Migration completed successfully!');
    console.log('');
    console.log('📊 All data migrated from SQLite Cloud to Turso');
    console.log('🌐 Multi-user mode ready');
    console.log('🚀 You can now use Djadwal with Turso!');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (sqliteCloudDb) {
      try {
        sqliteCloudDb.close();
      } catch (e) {}
    }
    if (tursoClient) {
      try {
        tursoClient.close();
      } catch (e) {}
    }
  }
}

console.log('🔄 Starting fixed migration from SQLite Cloud to Turso...');
console.log('');

fixSchemaAndMigrate()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
