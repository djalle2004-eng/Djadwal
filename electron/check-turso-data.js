// Check migrated data in Turso
const { createClient } = require('@libsql/client');

const TURSO_URL = 'libsql://djadwal-djalle.aws-eu-west-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjE5MDkwMDYsImlkIjoiNzQyYmY2OTYtNDA3Zi00NDYwLWE4ZGEtZTQwNDJmMzQxZTY0IiwicmlkIjoiZDM1NjBjOTMtYzlmZi00OTliLWJkOTMtMDE5YmMwODAzOTUyIn0.eBc_mzZBjxIKGk67o7P0eae3fS4dJoerkiBurw92bhlUpAaKvCg2jGNDrG3IlPwCwNgjG8J5rOlhoRU2RfcWBA';

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
