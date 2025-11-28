// Check migrated data in Turso
const { createClient } = require('@libsql/client');

const TURSO_URL = 'libsql://djadwal-djalle.aws-eu-west-1.turso.io';
const TURSO_AUTH_TOKEN = 'REDACTED_TURSO_AUTH_TOKEN';

async function checkData() {
  const client = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN
  });

  try {
    console.log('📊 Checking migrated data in Turso...\n');

    const tables = [
      'departments',
      'specializations',
      'professors',
      'rooms',
      'courses',
      'groups',
      'academic_years',
      'semesters',
      'assignments',
      'extra_sessions'
    ];

    for (const table of tables) {
      const result = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result.rows[0].count;
      console.log(`✅ ${table}: ${count} rows`);
    }

    console.log('\n✅ Data check completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.close();
  }
}

checkData();
