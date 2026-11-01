import { PoolClient } from 'pg';

export interface ChangeLogInput {
  entity_type: string;
  entity_id: string | number;
  action: 'create' | 'update' | 'archive' | 'restore' | 'swap' | 'move';
  before_state?: any;
  after_state?: any;
  changed_by?: number | null;
}

export interface UnitOfWorkOptions {
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  maxRetries?: number;
  dualWrite?: boolean;
}

export class OptimisticLockError extends Error {
  public readonly entityType: string;
  public readonly entityId: string | number;
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(entityType: string, entityId: string | number, expectedVersion: number, actualVersion: number) {
    super(
      `تعارض في التحديث المتزامن للكيان (${entityType} #${entityId}): الإصدار المتوقع (${expectedVersion}) لا يطابق الإصدار الحالي (${actualVersion}). يرجى تحديث الصفحة والمحاولة مجددًا.`
    );
    this.name = 'OptimisticLockError';
    this.entityType = entityType;
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export interface UnitOfWorkContext {
  readonly client: PoolClient;
  query<R = any>(sql: string, params?: any[]): Promise<R[]>;
  queueDualWrite(sql: string, params?: any[]): void;
  savepoint(name: string): Promise<void>;
  rollbackTo(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
  recordChange(entry: ChangeLogInput): Promise<number | null>;
}

// Helper to access DB module cleanly across CommonJS & ESM
function getDatabaseModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../server/database.js');
}

/**
 * Executes a business operation inside an atomic PostgreSQL transaction on Neon.
 * 
 * Guarantees:
 * 1. Atomicity: 100% rollback on failure, leaving 0 half-written state on Neon.
 * 2. Post-Commit Dual-Write: Turso secondary writes are queued and dispatched ONLY after
 *    Neon transaction is safely COMMITTED.
 * 3. Zero Turso Side-Effects on Rollback: if transaction rolls back, Turso queue is purged.
 * 4. Transient Collision Retry: Automatically retries on 40001 (serialization_failure)
 *    and 40P01 (deadlock_detected) up to maxRetries.
 */
export async function unitOfWork<T>(
  callback: (uow: UnitOfWorkContext) => Promise<T>,
  options: UnitOfWorkOptions = {}
): Promise<T> {
  const dbModule = getDatabaseModule();
  const pool = dbModule.getPgPool();

  if (!pool) {
    throw new Error('Neon PostgreSQL pool is not initialized. Cannot start atomic unit of work.');
  }

  const isolationLevel = options.isolationLevel || 'READ COMMITTED';
  const maxRetries = options.maxRetries ?? 3;
  const isDualWriteEnabled = options.dualWrite ?? (process.env.FEATURE_DUAL_WRITE !== 'false');

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();
    const dualWriteQueue: { sql: string; params: any[] }[] = [];

    const uow: UnitOfWorkContext = {
      client,

      async query<R = any>(sql: string, params: any[] = []): Promise<R[]> {
        const pgSql = dbModule.toPostgresQuery(sql);
        const cleanParams = params.map(p => (p === undefined ? null : p));
        const res = await client.query(pgSql, cleanParams);
        return res.rows as R[];
      },

      queueDualWrite(sql: string, params: any[] = []) {
        dualWriteQueue.push({ sql, params });
      },

      async savepoint(name: string) {
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
        await client.query(`SAVEPOINT ${safeName}`);
      },

      async rollbackTo(name: string) {
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
        await client.query(`ROLLBACK TO SAVEPOINT ${safeName}`);
      },

      async releaseSavepoint(name: string) {
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
        await client.query(`RELEASE SAVEPOINT ${safeName}`);
      },

      async recordChange(entry: ChangeLogInput): Promise<number | null> {
        try {
          const beforeStr = entry.before_state ? JSON.stringify(entry.before_state) : null;
          const afterStr = entry.after_state ? JSON.stringify(entry.after_state) : null;
          const res = await client.query(
            `INSERT INTO change_log (entity_type, entity_id, action, before_state, after_state, changed_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             RETURNING id`,
            [
              entry.entity_type,
              String(entry.entity_id),
              entry.action,
              beforeStr,
              afterStr,
              entry.changed_by || null
            ]
          );

          // Queue dual write for change_log on Turso as well
          dualWriteQueue.push({
            sql: `INSERT INTO change_log (entity_type, entity_id, action, before_state, after_state, changed_by, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            params: [
              entry.entity_type,
              String(entry.entity_id),
              entry.action,
              beforeStr,
              afterStr,
              entry.changed_by || null
            ]
          });

          return res.rows[0]?.id || null;
        } catch (err: any) {
          console.warn('⚠️ Warning: Failed to record change_log entry in transaction:', err.message);
          return null;
        }
      }
    };

    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);

      const result = await callback(uow);

      await client.query('COMMIT');

      // Post-Commit Phase: Dispatch queued secondary writes to Turso
      if (isDualWriteEnabled && dualWriteQueue.length > 0) {
        (async () => {
          for (const item of dualWriteQueue) {
            try {
              await dbModule.executeTursoQuery(item.sql, item.params, 2);
            } catch (tursoErr: any) {
              await dbModule.recordReconciliationDiff(item.sql, item.params, tursoErr.message);
            }
          }
        })().catch(() => {});
      }

      client.release();
      return result;
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr: any) {
        console.error('Failed to rollback transaction:', rollbackErr.message);
      } finally {
        client.release();
        // Crucial: Clear Turso dual-write queue completely on rollback
        dualWriteQueue.length = 0;
      }

      // Check for transient collision errors (40001: serialization_failure, 40P01: deadlock_detected)
      const isTransientCollision =
        err?.code === '40001' ||
        err?.code === '40P01' ||
        /deadlock detected/i.test(err?.message || '') ||
        /could not serialize access/i.test(err?.message || '');

      if (isTransientCollision && attempt < maxRetries) {
        const backoffMs = Math.floor(50 * Math.pow(2, attempt) + Math.random() * 25);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Transaction failed after ${maxRetries} retry attempts due to transient collisions.`);
}

