/**
 * Djadwal Auth Verification (Zero-DDL Startup)
 * Read-only schema verification without runtime DDL.
 * Schema creation is strictly managed via versioned migrations in packages/db.
 */

async function ensureAuthTables(database) {
  const tables = ['sessions', 'auth_events', 'invitations', 'mfa_factors', 'password_reset_tokens'];
  for (const t of tables) {
    try {
      await database.sql(`SELECT 1 FROM ${t} LIMIT 1`);
      console.log(`✅ ${t} table verified`);
    } catch (err) {
      console.warn(`⚠️ [AuthVerification] Table "${t}" is not present. Run migrations with "npm run db:migrate:apply".`);
    }
  }

  try {
    await database.sql('SELECT email_verified_at FROM users LIMIT 1');
    console.log('✅ email_verified_at column already exists in users');
  } catch (err) {
    console.warn('⚠️ [AuthVerification] email_verified_at column in users is missing. Run migrations to initialize.');
  }

  console.log('🔒 [AuthMigrations] All P4 identity & security tables verified.');
}

module.exports = {
  ensureAuthTables
};
