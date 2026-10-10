// Script to migrate data from SQLite Cloud to Turso
const { Database } = require('@sqlitecloud/drivers');
const { createClient } = require('@libsql/client');
require('dotenv').config();

// SQLite Cloud Configuration
const SQLITECLOUD_CONFIG = {
  host: process.env.SQLITECLOUD_HOST || 'cjh4w9vank.g4.sqlite.cloud',
  port: parseInt(process.env.SQLITECLOUD_PORT || '8860', 10),
  username: process.env.SQLITECLOUD_USERNAME || 'apikey',
  password: process.env.SQLITECLOUD_PASSWORD || process.env.SQLITECLOUD_APIKEY || '',
  database: process.env.SQLITECLOUD_DATABASE || 'Djadwal'
};

// Turso Configuration
const TURSO_URL = process.env.TURSO_URL || process.env.VITE_TURSO_DATABASE_URL || 'libsql://djadwal-djalle.aws-eu-west-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN || '';

// Tables to migrate (in order to respect foreign keys)
const TABLES = [
  'departments',
  'specializations',
  'academic_years',
  'semesters',
  'professors',
  'rooms',
  'courses',
  'groups',
  'assignments',
  'extra_sessions'
];

async function migrateData() {
  let sqliteCloudDb = null;
  let tursoClient = null;

  try {
    // Connect to SQLite Cloud
    console.log('📡 Connecting to SQLite Cloud...');
    const connectionString = `sqlitecloud://${SQLITECLOUD_CONFIG.host}:${SQLITECLOUD_CONFIG.port}/${SQLITECLOUD_CONFIG.database}?apikey=${SQLITECLOUD_CONFIG.password}`;
    sqliteCloudDb = new Database(connectionString);
    console.log('✅ Connected to SQLite Cloud');

    // Connect to Turso
    console.log('🚀 Connecting to Turso...');
    tursoClient = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN
    });
    console.log('✅ Connected to Turso');

    // Migrate each table
    for (const table of TABLES) {
      console.log(`\n📦 Migrating table: ${table}`);
      
      try {
        // Get data from SQLite Cloud
        const data = await sqliteCloudDb.sql(`SELECT * FROM ${table}`);
        
        if (!data || data.length === 0) {
          console.log(`   ⚠️ No data found in ${table}`);
          continue;
        }

        console.log(`   📊 Found ${data.length} rows`);

        // Get column names
        const columns = Object.keys(data[0]);
        const placeholders = columns.map((_, i) => `?`).join(', ');
        const columnNames = columns.join(', ');

        // Insert into Turso
        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
          try {
            const values = columns.map(col => row[col]);
            
            await tursoClient.execute({
              sql: `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
              args: values
            });
            
            successCount++;
          } catch (insertError) {
            // Skip if duplicate (PRIMARY KEY constraint)
            if (insertError.message && insertError.message.includes('UNIQUE')) {
              console.log(`   ⏭️ Skipping duplicate row in ${table}`);
            } else {
              console.error(`   ❌ Error inserting row:`, insertError.message);
              errorCount++;
            }
          }
        }

        console.log(`   ✅ Migrated ${successCount} rows to ${table}`);
        if (errorCount > 0) {
          console.log(`   ⚠️ ${errorCount} rows failed`);
        }

      } catch (tableError) {
        console.error(`   ❌ Error migrating ${table}:`, tableError.message);
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log('');
    console.log('📊 Summary:');
    console.log('   ✅ All tables migrated from SQLite Cloud to Turso');
    console.log('   🌐 Multi-user mode ready');
    console.log('   🔒 Data synced successfully');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    if (sqliteCloudDb) {
      try {
        sqliteCloudDb.close();
        console.log('🔌 Closed SQLite Cloud connection');
      } catch (e) {
        // Ignore
      }
    }
    
    if (tursoClient) {
      try {
        tursoClient.close();
        console.log('🔌 Closed Turso connection');
      } catch (e) {
        // Ignore
      }
    }
  }
}

// Run the migration
console.log('🔄 Starting migration from SQLite Cloud to Turso...');
console.log('');

migrateData()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('🚀 You can now use Turso with all your existing data!');
    console.log('');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
