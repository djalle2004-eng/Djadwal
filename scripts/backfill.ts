#!/usr/bin/env ts-node
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const CHECKPOINT_DIR = path.join(__dirname, '../.checkpoints');

export interface BackfillOptions {
  table: string;
  idColumn?: string;
  setClause: string;
  whereClause: string;
  batchSize?: number;
  rateLimitMs?: number;
  dryRun?: boolean;
}

export interface BackfillResult {
  table: string;
  totalTargetRows: number;
  totalUpdatedRows: number;
  batchesExecuted: number;
  success: boolean;
  durationMs: number;
}

function ensureCheckpointDir() {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
}

function getCheckpointPath(table: string): string {
  return path.join(CHECKPOINT_DIR, `backfill_${table}.json`);
}

function loadCheckpoint(table: string): { lastId: number; totalProcessed: number } {
  const p = getCheckpointPath(table);
  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { lastId: Number(data.lastId) || 0, totalProcessed: Number(data.totalProcessed) || 0 };
    } catch {
      return { lastId: 0, totalProcessed: 0 };
    }
  }
  return { lastId: 0, totalProcessed: 0 };
}

function saveCheckpoint(table: string, lastId: number, totalProcessed: number) {
  ensureCheckpointDir();
  const p = getCheckpointPath(table);
  fs.writeFileSync(p, JSON.stringify({ table, lastId, totalProcessed, updatedAt: new Date().toISOString() }, null, 2));
}

function clearCheckpoint(table: string) {
  const p = getCheckpointPath(table);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

export async function runBackfill(options: BackfillOptions): Promise<BackfillResult> {
  const {
    table,
    idColumn = 'id',
    setClause,
    whereClause,
    batchSize = 1000,
    rateLimitMs = 50,
    dryRun = false
  } = options;

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL is required to run backfill.');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const startTime = Date.now();

  try {
    console.log(`\n📦 === Starting Backfill for table: "${table}" ===`);
    console.log(`   - Set: ${setClause}`);
    console.log(`   - Where: ${whereClause}`);
    console.log(`   - Batch size: ${batchSize} rows`);
    console.log(`   - Mode: ${dryRun ? 'DRY-RUN (simulation)' : 'EXECUTE'}`);

    // Count total rows matching criteria
    const countRes = await client.query(`SELECT COUNT(*) as c FROM "${table}" WHERE ${whereClause}`);
    const totalTarget = parseInt(countRes.rows[0].c, 10);
    console.log(`   - Total rows requiring backfill: ${totalTarget}`);

    if (totalTarget === 0) {
      console.log('✅ Nothing to backfill. All rows already satisfy the criteria.\n');
      clearCheckpoint(table);
      return {
        table,
        totalTargetRows: 0,
        totalUpdatedRows: 0,
        batchesExecuted: 0,
        success: true,
        durationMs: Date.now() - startTime
      };
    }

    if (dryRun) {
      console.log(`✅ [DRY-RUN] Simulation verified: ${totalTarget} rows will be updated in ~${Math.ceil(totalTarget / batchSize)} batch(es).\n`);
      return {
        table,
        totalTargetRows: totalTarget,
        totalUpdatedRows: 0,
        batchesExecuted: 0,
        success: true,
        durationMs: Date.now() - startTime
      };
    }

    let { lastId, totalProcessed } = loadCheckpoint(table);
    if (lastId > 0) {
      console.log(`ℹ️ Resuming from checkpoint: last processed ID ${lastId} (${totalProcessed} rows previously updated)`);
    }

    let batchNumber = 0;
    let totalUpdated = totalProcessed;

    while (true) {
      // Find batch IDs
      const idQuery = `
        SELECT "${idColumn}"
        FROM "${table}"
        WHERE ${whereClause} AND "${idColumn}" > $1
        ORDER BY "${idColumn}" ASC
        LIMIT $2
      `;
      const idRes = await client.query(idQuery, [lastId, batchSize]);
      if (idRes.rows.length === 0) {
        break;
      }

      batchNumber++;
      const ids = idRes.rows.map(r => r[idColumn]);
      const minId = ids[0];
      const maxId = ids[ids.length - 1];

      // Update this batch inside a transaction
      await client.query('BEGIN');
      const updateQuery = `
        UPDATE "${table}"
        SET ${setClause}
        WHERE "${idColumn}" = ANY($1::int[])
      `;
      const updateRes = await client.query(updateQuery, [ids]);
      await client.query('COMMIT');

      const batchCount = updateRes.rowCount || 0;
      totalUpdated += batchCount;
      lastId = maxId;

      saveCheckpoint(table, lastId, totalUpdated);
      console.log(`   [Batch #${batchNumber}] Updated ${batchCount} rows (ID ${minId} -> ${maxId}) | Progress: ${totalUpdated}/${totalTarget}`);

      // Rate limit to avoid saturating production database
      if (rateLimitMs > 0) {
        await new Promise(r => setTimeout(r, rateLimitMs));
      }
    }

    // Verify remaining
    const remainingRes = await client.query(`SELECT COUNT(*) as c FROM "${table}" WHERE ${whereClause}`);
    const remaining = parseInt(remainingRes.rows[0].c, 10);

    if (remaining === 0) {
      console.log(`✅ Backfill completed successfully! Total updated: ${totalUpdated} rows. 0 rows remaining.\n`);
      clearCheckpoint(table);
      return {
        table,
        totalTargetRows: totalTarget,
        totalUpdatedRows: totalUpdated,
        batchesExecuted: batchNumber,
        success: true,
        durationMs: Date.now() - startTime
      };
    } else {
      console.warn(`⚠️ Warning: Backfill finished pass, but ${remaining} rows still remain to be updated.`);
      return {
        table,
        totalTargetRows: totalTarget,
        totalUpdatedRows: totalUpdated,
        batchesExecuted: batchNumber,
        success: false,
        durationMs: Date.now() - startTime
      };
    }
  } catch (err: any) {
    console.error(`❌ Backfill error on table "${table}":`, err.message);
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const table = args[0];
  const setClause = args[1];
  const whereClause = args[2];
  const dryRun = args.includes('--dry-run');

  if (!table || !setClause || !whereClause) {
    console.log('Usage: npx ts-node scripts/backfill.ts <table> <setClause> <whereClause> [--dry-run]');
    console.log('Example: npx ts-node scripts/backfill.ts extra_sessions "version = 1" "version IS NULL"');
    console.log('Example: npx ts-node scripts/backfill.ts semesters "is_public = 1" "is_public IS NULL"');
    process.exit(0);
  }

  await runBackfill({
    table,
    setClause,
    whereClause,
    dryRun
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

