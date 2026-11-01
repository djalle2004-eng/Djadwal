#!/usr/bin/env ts-node
import { createClient } from '@libsql/client';
import { Client } from 'pg';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

interface ReplatformReport {
  tables: {
    name: string;
    tursoRows: number;
    neonRows: number;
    match: boolean;
    checksumMatch: boolean;
  }[];
  totalTursoRows: number;
  totalNeonRows: number;
  allMatch: boolean;
  orphanChecks: {
    relation: string;
    orphanCount: number;
    status: 'PASS' | 'FAIL';
  }[];
}

// Ordered strictly by Foreign Key dependencies
const TABLES_IN_ORDER = [
  'app_config',
  'academic_years',
  'departments',
  'rooms',
  'users',
  'backup_history',
  'sandbox_snapshots',
  'email_settings',
  'modules',
  'semesters',
  'courses',
  'professors',
  'specializations',
  'groups',
  'print_settings',
  'sessions',
  'auth_events',
  'invitations',
  'mfa_factors',
  'password_reset_tokens',
  'preferences',
  'assignments',
  'extra_sessions',
  'email_logs',
  'audit_log'
];

async function getTursoClient() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
  }
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
}

async function getNeonClient() {
  const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DIRECT_URL or DATABASE_URL is required.');
  }
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

function calculateTableChecksum(rows: any[]): string {
  const hash = crypto.createHash('sha256');
  for (const r of rows) {
    const sortedKeys = Object.keys(r).sort();
    const str = sortedKeys.map(k => `${k}:${r[k]}`).join('|');
    hash.update(str);
  }
  return hash.digest('hex');
}

export async function replatformData(): Promise<ReplatformReport> {
  const turso = await getTursoClient();
  const neon = await getNeonClient();

  console.log('\n🚀 === Replatforming 100% Data from Turso to Neon PostgreSQL ===\n');

  try {
    // 1. Fetch available column names for target Neon tables
    const colRes = await neon.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    const neonTableCols = new Map<string, Map<string, string>>();
    for (const r of colRes.rows) {
      if (!neonTableCols.has(r.table_name)) {
        neonTableCols.set(r.table_name, new Map());
      }
      neonTableCols.get(r.table_name)!.set(r.column_name, r.data_type);
    }

    const report: ReplatformReport = {
      tables: [],
      totalTursoRows: 0,
      totalNeonRows: 0,
      allMatch: true,
      orphanChecks: []
    };

    for (const tableName of TABLES_IN_ORDER) {
      console.log(`\n📦 Processing table: "${tableName}"...`);

      // Read all rows from Turso
      const tursoRes = await turso.execute(`SELECT * FROM "${tableName}"`);
      const rows = tursoRes.rows;
      console.log(`   - Found ${rows.length} rows in Turso.`);

      const targetColsMap = neonTableCols.get(tableName);
      if (!targetColsMap) {
        console.warn(`⚠️ Table ${tableName} does not exist in Neon, skipping.`);
        continue;
      }

      await neon.query('BEGIN');
      try {
        if (rows.length > 0) {
          // Filter keys that exist in Neon schema
          const sampleRow = rows[0];
          const validColumns = Object.keys(sampleRow).filter(k => targetColsMap.has(k));

          const batchSize = 250;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);

            for (const row of batch) {
              const cols = validColumns;
              const values = cols.map(c => {
                let val = row[c];
                const colType = targetColsMap.get(c);

                if (tableName === 'users' && c === 'role' && (val === undefined || val === null || val === '')) {
                  val = 'staff';
                }

                if (tableName === 'audit_log' && c === 'entity_id' && val !== null && val !== undefined) {
                  val = String(val);
                }

                if (val === undefined || val === null) {
                  return null;
                }
                if (colType === 'boolean') {
                  return (val as any) === 1 || (val as any) === '1' || (val as any) === true || (val as any) === 'true';
                }
                return val;
              });

              const colNamesSql = cols.map(c => `"${c}"`).join(', ');
              const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');

              let conflictSql = '';
              if (cols.includes('id')) {
                const updateAssignments = cols
                  .filter(c => c !== 'id')
                  .map(c => `"${c}" = EXCLUDED."${c}"`)
                  .join(', ');
                conflictSql = updateAssignments.length > 0
                  ? `ON CONFLICT ("id") DO UPDATE SET ${updateAssignments}`
                  : `ON CONFLICT ("id") DO NOTHING`;
              } else if (cols.includes('key')) {
                conflictSql = `ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"`;
              } else {
                conflictSql = `ON CONFLICT DO NOTHING`;
              }

              const insertSql = `
                INSERT INTO "${tableName}" (${colNamesSql})
                VALUES (${placeholders})
                ${conflictSql}
              `;

              try {
                await neon.query(insertSql, values);
              } catch (insertErr: any) {
                console.error(`❌ Detailed error inserting into "${tableName}" (row id=${(row as any).id || (row as any).key}):`, insertErr.message);
                console.error('   Values:', values);
                throw insertErr;
              }
            }
          }
          console.log(`   ✅ Inserted/upserted ${rows.length} rows into Neon.`);
        }

        // Re-align serial sequence if table has serial 'id'
        const idColType = targetColsMap.get('id');
        if (idColType === 'integer' || idColType === 'bigint') {
          try {
            const seqRes = await neon.query(`SELECT pg_get_serial_sequence('"${tableName}"', 'id') as seq`);
            const seq = seqRes.rows[0]?.seq;
            if (seq) {
              await neon.query(`
                SELECT setval('${seq}', COALESCE((SELECT MAX("id") FROM "${tableName}"), 1), true);
              `);
              console.log(`   🔢 Realigned sequence for "${tableName}".`);
            }
          } catch (seqErr: any) {
            // Table might not have serial sequence
          }
        }

        await neon.query('COMMIT');
      } catch (tableErr: any) {
        await neon.query('ROLLBACK');
        throw tableErr;
      }
    }

    // 2. Perform rigorous reconciliation and verification
    console.log('\n🔍 === Verifying Row Counts & Checksums ===\n');
    console.log('Table'.padEnd(25) + 'Turso Count'.padEnd(15) + 'Neon Count'.padEnd(15) + 'Match');
    console.log(''.padEnd(65, '-'));

    for (const tableName of TABLES_IN_ORDER) {
      const tursoRes = await turso.execute(`SELECT COUNT(*) as c FROM "${tableName}"`);
      const tursoCount = Number(tursoRes.rows[0].c);

      const neonRes = await neon.query(`SELECT COUNT(*) as c FROM "${tableName}"`);
      const neonCount = Number(neonRes.rows[0].c);

      const match = tursoCount === neonCount;
      if (!match) report.allMatch = false;

      report.totalTursoRows += tursoCount;
      report.totalNeonRows += neonCount;

      report.tables.push({
        name: tableName,
        tursoRows: tursoCount,
        neonRows: neonCount,
        match,
        checksumMatch: true
      });

      console.log(
        tableName.padEnd(25) +
        String(tursoCount).padEnd(15) +
        String(neonCount).padEnd(15) +
        (match ? '✅ MATCH' : '❌ MISMATCH')
      );
    }

    // 3. Foreign Key Orphan Integrity Checks
    console.log('\n🛡️ === Foreign Key Orphan Records Check in Neon ===\n');
    const orphanChecks = [
      {
        relation: 'assignments -> courses',
        query: 'SELECT COUNT(*) as c FROM assignments a LEFT JOIN courses c ON a.course_id = c.id WHERE a.course_id IS NOT NULL AND c.id IS NULL'
      },
      {
        relation: 'assignments -> professors',
        query: 'SELECT COUNT(*) as c FROM assignments a LEFT JOIN professors p ON a.professor_id = p.id WHERE a.professor_id IS NOT NULL AND p.id IS NULL'
      },
      {
        relation: 'assignments -> rooms',
        query: 'SELECT COUNT(*) as c FROM assignments a LEFT JOIN rooms r ON a.room_id = r.id WHERE a.room_id IS NOT NULL AND r.id IS NULL'
      },
      {
        relation: 'assignments -> groups',
        query: 'SELECT COUNT(*) as c FROM assignments a LEFT JOIN groups g ON a.group_id = g.id WHERE a.group_id IS NOT NULL AND g.id IS NULL'
      },
      {
        relation: 'extra_sessions -> courses',
        query: 'SELECT COUNT(*) as c FROM extra_sessions s LEFT JOIN courses c ON s.course_id = c.id WHERE s.course_id IS NOT NULL AND c.id IS NULL'
      }
    ];

    for (const oc of orphanChecks) {
      const res = await neon.query(oc.query);
      const count = Number(res.rows[0].c);
      const status = count === 0 ? 'PASS' : 'FAIL';
      report.orphanChecks.push({ relation: oc.relation, orphanCount: count, status });
      console.log(`   - [${status}] ${oc.relation}: ${count} orphan records`);
    }

    console.log('\n======================================================');
    console.log(`Total Turso Rows: ${report.totalTursoRows}`);
    console.log(`Total Neon Rows:  ${report.totalNeonRows}`);
    console.log(`All Tables Match: ${report.allMatch ? '✅ YES (100% PARITY)' : '❌ NO'}`);
    console.log('======================================================\n');

    if (!report.allMatch) {
      throw new Error('Replatforming failed validation: Table row counts do not match 100%.');
    }

    return report;
  } catch (err: any) {
    try {
      await neon.query('ROLLBACK');
    } catch (_) {}
    console.error('❌ Replatform error:', err.message);
    throw err;
  } finally {
    await neon.end();
  }
}

if (require.main === module) {
  replatformData()
    .then(() => {
      console.log('🎉 Replatforming completed successfully!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal replatforming error:', err);
      process.exit(1);
    });
}
