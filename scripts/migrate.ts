#!/usr/bin/env ts-node
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ADVISORY_LOCK_ID = 8847291;
const MIGRATIONS_DIR = path.join(__dirname, '../packages/db/drizzle');

export interface MigrationFile {
  version: string;
  name: string;
  filename: string;
  filePath: string;
  content: string;
  checksum: string;
}

export function getMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(filename => {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    const nameWithoutExt = filename.replace(/\.sql$/, '');
    const parts = nameWithoutExt.split('_');
    const version = parts[0];
    const name = parts.slice(1).join('_') || version;

    return {
      version,
      name,
      filename,
      filePath,
      content,
      checksum
    };
  });
}

async function getClient(): Promise<Client> {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL environment variable is required to run migrations.');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  return client;
}

export async function ensureSchemaMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      finished_at TIMESTAMP,
      applied_by VARCHAR(100),
      status VARCHAR(20) NOT NULL
    );
  `);
}

async function acquireLock(client: Client): Promise<boolean> {
  const res = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_ID]);
  return Boolean(res.rows[0]?.locked);
}

async function releaseLock(client: Client): Promise<void> {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
  } catch (err: any) {
    console.warn('⚠️ Warning: Failed to release advisory lock:', err.message);
  }
}

export async function getAppliedMigrations(client: Client): Promise<Map<string, any>> {
  await ensureSchemaMigrationsTable(client);
  const res = await client.query('SELECT * FROM schema_migrations ORDER BY id ASC');
  const map = new Map<string, any>();
  for (const row of res.rows) {
    map.set(row.version, row);
  }
  return map;
}

// 1. Status mode
export async function status(): Promise<void> {
  const client = await getClient();
  try {
    const appliedMap = await getAppliedMigrations(client);
    const files = getMigrationFiles();

    console.log('\n📊 === Djadwal Migration Status Report ===\n');
    console.log('Version'.padEnd(10) + 'Name'.padEnd(30) + 'Status'.padEnd(12) + 'Applied At'.padEnd(25) + 'Checksum Match');
    console.log(''.padEnd(90, '-'));

    for (const f of files) {
      const applied = appliedMap.get(f.version);
      let statusStr = 'PENDING';
      let appliedAt = '-';
      let checksumMatch = '-';

      if (applied) {
        statusStr = applied.status.toUpperCase();
        appliedAt = applied.finished_at ? new Date(applied.finished_at).toISOString() : 'in-progress';
        checksumMatch = applied.checksum === f.checksum ? '✅ VALID' : '⚠️ MISMATCH';
      }

      console.log(
        f.version.padEnd(10) +
        f.name.padEnd(30) +
        statusStr.padEnd(12) +
        appliedAt.padEnd(25) +
        checksumMatch
      );
    }
    console.log('\n');
  } finally {
    await client.end();
  }
}

// 2. Plan mode
export async function plan(): Promise<void> {
  const client = await getClient();
  try {
    const appliedMap = await getAppliedMigrations(client);
    const files = getMigrationFiles();
    const pending = files.filter(f => !appliedMap.has(f.version) || appliedMap.get(f.version).status !== 'applied');

    console.log('\n📋 === Djadwal Migration Plan ===\n');
    if (pending.length === 0) {
      console.log('✅ No pending migrations. Database schema is fully up to date.\n');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s) to apply:\n`);
    for (const p of pending) {
      console.log(`▶ [${p.version}] ${p.name} (${p.filename})`);
      console.log(`  Checksum: ${p.checksum}`);
      console.log('  --- SQL Statements to execute: ---');
      const lines = p.content.split('\n').filter(l => l.trim() && !l.trim().startsWith('--')).slice(0, 10);
      for (const line of lines) {
        console.log(`    ${line}`);
      }
      if (p.content.split('\n').length > 10) {
        console.log('    ... [remaining SQL truncated in plan preview] ...');
      }
      console.log('\n');
    }
  } finally {
    await client.end();
  }
}

// 3. Dry-run mode
export async function dryRun(): Promise<boolean> {
  const client = await getClient();
  const locked = await acquireLock(client);
  if (!locked) {
    await client.end();
    throw new Error('❌ Migration aborted: Distributed advisory lock is held by another process.');
  }

  try {
    const appliedMap = await getAppliedMigrations(client);
    const files = getMigrationFiles();
    const pending = files.filter(f => !appliedMap.has(f.version) || appliedMap.get(f.version).status !== 'applied');

    if (pending.length === 0) {
      console.log('✅ [DRY-RUN] No pending migrations to simulate.');
      return true;
    }

    console.log(`\n🧪 === [DRY-RUN] Simulating ${pending.length} migration(s) in a rollback transaction ===\n`);

    await client.query('BEGIN');
    try {
      for (const m of pending) {
        console.log(` simulating migration ${m.version}: ${m.name}...`);
        await client.query(m.content);
        console.log(` ✅ Simulation passed for ${m.version}`);
      }
      console.log('\n🔄 Issuing ROLLBACK (No permanent changes written to database)...');
      await client.query('ROLLBACK');
      console.log('✅ [DRY-RUN SUCCESS] All pending migrations executed cleanly and were safely rolled back.\n');
      return true;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`❌ [DRY-RUN FAILED] Error during migration simulation: ${err.message}`);
      throw err;
    }
  } finally {
    await releaseLock(client);
    await client.end();
  }
}

// 4. Apply mode
export async function apply(): Promise<void> {
  const client = await getClient();
  const locked = await acquireLock(client);
  if (!locked) {
    await client.end();
    throw new Error('❌ Migration aborted: Distributed advisory lock is held by another process.');
  }

  try {
    await ensureSchemaMigrationsTable(client);
    const appliedMap = await getAppliedMigrations(client);
    const files = getMigrationFiles();
    const pending = files.filter(f => !appliedMap.has(f.version) || appliedMap.get(f.version).status !== 'applied');

    if (pending.length === 0) {
      console.log('✅ No pending migrations to apply. Database schema is already up to date.');
      return;
    }

    console.log(`\n🚀 === Applying ${pending.length} migration(s) to Neon PostgreSQL ===\n`);

    for (const m of pending) {
      console.log(`▶ Applying [${m.version}] ${m.name}...`);
      const startedAt = new Date();

      // Record started state
      await client.query(
        `INSERT INTO schema_migrations (version, name, checksum, started_at, status, applied_by)
         VALUES ($1, $2, $3, $4, 'pending', 'migrate-cli')
         ON CONFLICT (version) DO UPDATE SET
           started_at = EXCLUDED.started_at,
           status = 'pending',
           checksum = EXCLUDED.checksum`,
        [m.version, m.name, m.checksum, startedAt]
      );

      try {
        await client.query('BEGIN');
        await client.query(m.content);
        await client.query('COMMIT');

        const finishedAt = new Date();
        await client.query(
          `UPDATE schema_migrations
           SET finished_at = $1, status = 'applied'
           WHERE version = $2`,
          [finishedAt, m.version]
        );

        const durationMs = finishedAt.getTime() - startedAt.getTime();
        console.log(`✅ Successfully applied [${m.version}] ${m.name} in ${durationMs}ms`);
      } catch (migrationErr: any) {
        await client.query('ROLLBACK');
        await client.query(
          `UPDATE schema_migrations
           SET status = 'failed'
           WHERE version = $1`,
          [m.version]
        );
        console.error(`❌ Failed to apply [${m.version}] ${m.name}: ${migrationErr.message}`);
        throw migrationErr;
      }
    }

    console.log('\n🎉 All migrations applied successfully!\n');
  } finally {
    await releaseLock(client);
    await client.end();
  }
}

// 5. Verify mode
export async function verify(): Promise<boolean> {
  const client = await getClient();
  try {
    console.log('\n🔍 === Verifying Neon PostgreSQL Schema Integrity ===\n');

    const expectedTables = [
      'academic_years', 'departments', 'professors', 'rooms', 'courses',
      'groups', 'assignments', 'semesters', 'extra_sessions', 'users',
      'audit_log', 'app_config', 'backup_history', 'email_settings',
      'email_logs', 'print_settings', 'sandbox_snapshots', 'sessions',
      'auth_events', 'invitations', 'mfa_factors', 'password_reset_tokens',
      'modules', 'preferences', 'specializations', 'schema_migrations',
      'reconciliation_diffs'
    ];

    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const actualTables = new Set(tablesRes.rows.map(r => r.table_name));

    const missingTables = expectedTables.filter(t => !actualTables.has(t));
    if (missingTables.length > 0) {
      console.error('❌ Schema Verification FAILED: Missing tables in Neon:');
      for (const t of missingTables) {
        console.error(`  - ${t}`);
      }
      return false;
    }

    console.log(`✅ All ${expectedTables.length} expected tables exist in Neon PostgreSQL.`);

    // Check expand columns
    const columnsRes = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    const colsSet = new Set(columnsRes.rows.map(r => `${r.table_name}.${r.column_name}`));

    const requiredColumns = [
      'semesters.is_public',
      'extra_sessions.version',
      'extra_sessions.updated_at',
      'assignments.updated_at',
      'audit_log.prev_hash',
      'audit_log.row_hash',
      'audit_log.claimed_by',
      'users.permissions',
      'users.email_verified_at'
    ];

    const missingCols = requiredColumns.filter(c => !colsSet.has(c));
    if (missingCols.length > 0) {
      console.error('❌ Schema Verification FAILED: Missing required expand columns:');
      for (const c of missingCols) {
        console.error(`  - ${c}`);
      }
      return false;
    }

    console.log('✅ All required expand columns (is_public, version, audit hashes, permissions, timestamps) exist.');
    console.log('🔒 Schema integrity check: 100% MATCH.\n');
    return true;
  } finally {
    await client.end();
  }
}

// CLI entry point
async function main() {
  const mode = process.argv[2] || 'status';

  switch (mode) {
    case 'status':
      await status();
      break;
    case 'plan':
      await plan();
      break;
    case 'dry-run':
      await dryRun();
      break;
    case 'apply':
      await apply();
      break;
    case 'verify':
      const ok = await verify();
      if (!ok) process.exit(1);
      break;
    default:
      console.error(`Unknown mode: "${mode}". Valid modes: status | plan | dry-run | apply | verify`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Migration command error:', err);
    process.exit(1);
  });
}
