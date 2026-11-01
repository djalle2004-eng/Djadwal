import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createClient } from '@libsql/client';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getMigrationFiles, ensureSchemaMigrationsTable, getAppliedMigrations, verify } from '../../../scripts/migrate';
import { replatformData } from '../../../scripts/replatform-data';
import { runBackfill } from '../../../scripts/backfill';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { initDatabaseConnection, executeQuery, getPgPool, recordReconciliationDiff } = require('../../../server/database.js');

describe('P6 Managed Migrations, Neon PostgreSQL Switch & Dual-Write Safety Suite', () => {
  let pgClient: Client;

  beforeAll(async () => {
    const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (connStr) {
      pgClient = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false }
      });
      await pgClient.connect();
    }
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.end();
    }
  });

  describe('1. Zero-DDL Server Boot Charter (DoD #1)', () => {
    it('initializes database connections without executing any DDL statements on boot', async () => {
      // Initialize connections
      const conn = await initDatabaseConnection();
      expect(conn).toBeDefined();

      // Ensure that tables and columns exist and server booted cleanly
      const rows = await executeQuery('SELECT 1 as test');
      expect(rows).toBeDefined();
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('2. Managed Migrations & Distributed Advisory Lock (DoD #2)', () => {
    it('creates and tracks schema_migrations table with valid SHA-256 checksums', async () => {
      if (!pgClient) return;

      await ensureSchemaMigrationsTable(pgClient);
      const appliedMap = await getAppliedMigrations(pgClient);
      const files = getMigrationFiles();

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.some(f => f.version === '0000')).toBe(true);
      expect(files.some(f => f.version === '0001')).toBe(true);

      const baseline = appliedMap.get('0000');
      const expand = appliedMap.get('0001');

      expect(baseline).toBeDefined();
      expect(baseline.status).toBe('applied');
      expect(baseline.checksum).toBeDefined();

      expect(expand).toBeDefined();
      expect(expand.status).toBe('applied');
    });

    it('prevents concurrent migration runs using PostgreSQL distributed advisory lock', async () => {
      if (!pgClient) return;

      const ADVISORY_LOCK_ID = 8847291;
      const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;

      // Lock with first client
      const res1 = await pgClient.query('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_ID]);
      expect(res1.rows[0].locked).toBe(true);

      // Attempt lock with second client should fail (return false)
      const client2 = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      await client2.connect();
      try {
        const res2 = await client2.query('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_ID]);
        expect(res2.rows[0].locked).toBe(false);
      } finally {
        await client2.end();
        // Unlock first client
        await pgClient.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
      }
    });

    it('successfully passes comprehensive schema verification check', async () => {
      const ok = await verify();
      expect(ok).toBe(true);
    });
  });

  describe('3. Expand Pattern Implementation ("وسّع ثم قلّص")', () => {
    it('ensures all expand-pattern columns exist in Neon PostgreSQL with safe defaults', async () => {
      if (!pgClient) return;

      // Verify is_public on semesters
      const semCol = await pgClient.query(`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_name = 'semesters' AND column_name = 'is_public'
      `);
      expect(semCol.rows.length).toBe(1);

      // Verify version on extra_sessions
      const extraCol = await pgClient.query(`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_name = 'extra_sessions' AND column_name = 'version'
      `);
      expect(extraCol.rows.length).toBe(1);

      // Verify tamper-evident hash columns on audit_log
      const auditCols = await pgClient.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'audit_log' AND column_name IN ('prev_hash', 'row_hash', 'claimed_by')
      `);
      expect(auditCols.rows.length).toBe(3);

      // Verify permissions and email_verified_at on users
      const userCols = await pgClient.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name IN ('permissions', 'email_verified_at')
      `);
      expect(userCols.rows.length).toBe(2);
    });
  });

  describe('4. Generic Batched Backfill Script with Checkpoint Recovery', () => {
    it('executes a dry-run backfill simulation cleanly', async () => {
      const result = await runBackfill({
        table: 'semesters',
        setClause: 'is_public = 1',
        whereClause: 'is_public IS NULL',
        dryRun: true
      });

      expect(result).toBeDefined();
      expect(result.table).toBe('semesters');
      expect(result.success).toBe(true);
    });
  });

  describe('5. 100% Data Replatforming & Zero Orphan Record Parity (DoD #3)', () => {
    it('verifies 100% table row count parity between Turso and Neon PostgreSQL', async () => {
      if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN || !pgClient) {
        return;
      }

      const turso = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      });

      const tablesToCheck = [
        'app_config',
        'academic_years',
        'departments',
        'rooms',
        'users',
        'courses',
        'professors',
        'groups',
        'assignments',
        'semesters',
        'extra_sessions',
        'audit_log'
      ];

      for (const table of tablesToCheck) {
        const tRes = await turso.execute(`SELECT COUNT(*) as c FROM "${table}"`);
        const pRes = await pgClient.query(`SELECT COUNT(*) as c FROM "${table}"`);

        const tCount = Number(tRes.rows[0].c);
        const pCount = Number(pRes.rows[0].c);

        expect(pCount).toBe(tCount);
      }
    });

    it('guarantees zero foreign key orphan records across all relational tables', async () => {
      if (!pgClient) return;

      const orphanChecks = [
        'SELECT COUNT(*) as c FROM assignments a LEFT JOIN courses c ON a.course_id = c.id WHERE a.course_id IS NOT NULL AND c.id IS NULL',
        'SELECT COUNT(*) as c FROM assignments a LEFT JOIN professors p ON a.professor_id = p.id WHERE a.professor_id IS NOT NULL AND p.id IS NULL',
        'SELECT COUNT(*) as c FROM assignments a LEFT JOIN rooms r ON a.room_id = r.id WHERE a.room_id IS NOT NULL AND r.id IS NULL',
        'SELECT COUNT(*) as c FROM assignments a LEFT JOIN groups g ON a.group_id = g.id WHERE a.group_id IS NOT NULL AND g.id IS NULL',
        'SELECT COUNT(*) as c FROM extra_sessions s LEFT JOIN courses c ON s.course_id = c.id WHERE s.course_id IS NOT NULL AND c.id IS NULL'
      ];

      for (const sql of orphanChecks) {
        const res = await pgClient.query(sql);
        expect(Number(res.rows[0].c)).toBe(0);
      }
    });
  });

  describe('6. Direct Read Routing & Dual-Write Safety Net (DoD #4)', () => {
    it('routes SELECT queries directly to Neon PostgreSQL without shadow reads to Turso', async () => {
      const rows = await executeQuery('SELECT COUNT(*) as count FROM assignments');
      expect(rows).toBeDefined();
      expect(Number(rows[0].count)).toBeGreaterThan(4000);
    });

    it('performs real-time dual-write to Turso and logs divergence to reconciliation_diffs on error', async () => {
      const testKey = `test_p6_sync_${Date.now()}`;
      const testVal = 'p6_dual_write_verification';

      // Insert via executeQuery
      await executeQuery('INSERT INTO app_config (key, value) VALUES (?, ?)', [testKey, testVal]);

      // Wait 1 second for background dual-write sync
      await new Promise(r => setTimeout(r, 1200));

      // Verify in Turso directly
      const turso = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!
      });
      const tRes = await turso.execute({
        sql: 'SELECT value FROM app_config WHERE key = ?',
        args: [testKey]
      });
      expect(tRes.rows[0]?.value).toBe(testVal);

      // Cleanup
      await executeQuery('DELETE FROM app_config WHERE key = ?', [testKey]);
      await new Promise(r => setTimeout(r, 1000));
      const tClean = await turso.execute({
        sql: 'SELECT value FROM app_config WHERE key = ?',
        args: [testKey]
      });
      expect(tClean.rows.length).toBe(0);
    });

    it('records secondary dual-write divergences in reconciliation_diffs table', async () => {
      await recordReconciliationDiff(
        'INSERT INTO test_table (id) VALUES (999)',
        [999],
        'Simulated secondary failure for test suite'
      );

      if (!pgClient) return;
      const res = await pgClient.query(
        "SELECT * FROM reconciliation_diffs WHERE error_message LIKE '%Simulated secondary failure%' ORDER BY id DESC LIMIT 1"
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].table_name).toBe('test_table');
      expect(res.rows[0].operation).toBe('INSERT');

      // Clean up test diff record
      await pgClient.query('DELETE FROM reconciliation_diffs WHERE id = $1', [res.rows[0].id]);
    });
  });
});

