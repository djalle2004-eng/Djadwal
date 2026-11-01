// @djadwal/db package entry point
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const database = require('../../server/database.js');

let pool = null;
let drizzleDb = null;

function getDrizzleClient() {
  if (!drizzleDb) {
    const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL or DIRECT_URL is required for Drizzle ORM client');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000
    });
    // Schema can be loaded dynamically if needed
    drizzleDb = drizzle(pool);
  }
  return drizzleDb;
}

module.exports = {
  getDrizzleClient,
  executeQuery: database.executeQuery,
  tables: [
    'academic_years',
    'app_config',
    'assignments',
    'audit_log',
    'auth_events',
    'backup_history',
    'courses',
    'departments',
    'email_logs',
    'email_settings',
    'extra_sessions',
    'groups',
    'invitations',
    'mfa_factors',
    'modules',
    'password_reset_tokens',
    'preferences',
    'print_settings',
    'professors',
    'reconciliation_diffs',
    'rooms',
    'sandbox_snapshots',
    'schema_migrations',
    'semesters',
    'sessions',
    'specializations',
    'users'
  ]
};
