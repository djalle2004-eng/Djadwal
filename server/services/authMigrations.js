/**
 * Djadwal Auth Migrations (Expand-Only)
 * Safe, idempotent database schema migrations for P4 Modernized Authentication.
 * Never modifies or drops existing columns or tables.
 */

async function ensureAuthTables(database) {
  // 1. Sessions table (Revocable, rotating refresh tokens)
  try {
    await database.sql(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        user_agent TEXT,
        ip TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    await database.sql('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
    await database.sql('CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)');
    console.log('✅ sessions table verified');
  } catch (err) {
    console.error('⚠️ [AuthMigrations] Error creating sessions table:', err.message);
  }

  // 2. Auth Events table (Security audit trail)
  try {
    await database.sql(`
      CREATE TABLE IF NOT EXISTS auth_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        kind TEXT NOT NULL,
        ip TEXT,
        ua TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    await database.sql('CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id)');
    await database.sql('CREATE INDEX IF NOT EXISTS idx_auth_events_kind ON auth_events(kind)');
    await database.sql('CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at)');
    console.log('✅ auth_events table verified');
  } catch (err) {
    console.error('⚠️ [AuthMigrations] Error creating auth_events table:', err.message);
  }

  // 3. Invitations table (Invitation-only onboarding)
  try {
    await database.sql(`
      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'PROFESSOR',
        token_hash TEXT NOT NULL,
        invited_by INTEGER,
        expires_at DATETIME NOT NULL,
        accepted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invited_by) REFERENCES users (id)
      )
    `);
    await database.sql('CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash)');
    console.log('✅ invitations table verified');
  } catch (err) {
    console.error('⚠️ [AuthMigrations] Error creating invitations table:', err.message);
  }

  // 4. MFA Factors table (TOTP & backup recovery codes)
  try {
    await database.sql(`
      CREATE TABLE IF NOT EXISTS mfa_factors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        secret TEXT NOT NULL,
        backup_codes TEXT NOT NULL,
        enabled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    console.log('✅ mfa_factors table verified');
  } catch (err) {
    console.error('⚠️ [AuthMigrations] Error creating mfa_factors table:', err.message);
  }

  // 5. Password Reset Tokens table & columns
  try {
    await database.sql(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT,
        token_hash TEXT,
        expires_at DATETIME NOT NULL,
        used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Ensure token_hash column exists if table was pre-existing
    try {
      await database.sql('SELECT token_hash FROM password_reset_tokens LIMIT 1');
    } catch (e) {
      if (e.message.includes('no such column') || e.message.includes('does not exist')) {
        await database.sql('ALTER TABLE password_reset_tokens ADD COLUMN token_hash TEXT');
        console.log('✅ Added token_hash column to password_reset_tokens');
      }
    }

    // Ensure used_at column exists if table was pre-existing
    try {
      await database.sql('SELECT used_at FROM password_reset_tokens LIMIT 1');
    } catch (e) {
      if (e.message.includes('no such column') || e.message.includes('does not exist')) {
        await database.sql('ALTER TABLE password_reset_tokens ADD COLUMN used_at DATETIME');
        console.log('✅ Added used_at column to password_reset_tokens');
      }
    }

    await database.sql('CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash)');
    console.log('✅ password_reset_tokens table verified');
  } catch (err) {
    console.error('⚠️ [AuthMigrations] Error ensuring password_reset_tokens table:', err.message);
  }

  // 6. Ensure email_verified_at column on users table (Expand-Only)
  try {
    await database.sql('SELECT email_verified_at FROM users LIMIT 1');
    console.log('✅ email_verified_at column already exists in users');
  } catch (colErr) {
    if (colErr.message.includes('no such column') || colErr.message.includes('does not exist')) {
      await database.sql('ALTER TABLE users ADD COLUMN email_verified_at DATETIME');
      console.log('✅ Added email_verified_at column to users table');
    }
  }

  console.log('🔒 [AuthMigrations] All P4 identity & security tables verified.');
}

module.exports = {
  ensureAuthTables
};
