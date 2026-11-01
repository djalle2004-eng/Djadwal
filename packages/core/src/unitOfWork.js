class OptimisticLockError extends Error {
  constructor(entityType, entityId, expectedVersion, actualVersion) {
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

function getDatabaseModule() {
  return require('../../../server/database.js');
}

/**
 * Executes a business operation inside an atomic PostgreSQL transaction on Neon.
 */
async function unitOfWork(callback, options = {}) {
  const dbModule = getDatabaseModule();
  const pool = dbModule.getPgPool();

  if (!pool) {
    throw new Error('Neon PostgreSQL pool is not initialized. Cannot start atomic unit of work.');
  }

  const isolationLevel = options.isolationLevel || 'READ COMMITTED';
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
  const isDualWriteEnabled = options.dualWrite !== undefined ? options.dualWrite : (process.env.FEATURE_DUAL_WRITE !== 'false');

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();
    const dualWriteQueue = [];

    const uow = {
      client,

      async query(sql, params = []) {
        const pgSql = dbModule.toPostgresQuery(sql);
        const cleanParams = params.map(p => (p === undefined ? null : p));
        const res = await client.query(pgSql, cleanParams);
        return res.rows;
      },

      queueDualWrite(sql, params = []) {
        dualWriteQueue.push({ sql, params });
      },

      async savepoint(name) {
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
        await client.query(`SAVEPOINT ${safeName}`);
      },

      async rollbackTo(name) {
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
        await client.query(`ROLLBACK TO SAVEPOINT ${safeName}`);
      },

      async releaseSavepoint(name) {
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
        await client.query(`RELEASE SAVEPOINT ${safeName}`);
      },

      async recordChange(entry) {
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
        } catch (err) {
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
            } catch (tursoErr) {
              await dbModule.recordReconciliationDiff(item.sql, item.params, tursoErr.message);
            }
          }
        })().catch(() => {});
      }

      client.release();
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Failed to rollback transaction:', rollbackErr.message);
      } finally {
        client.release();
        // Crucial: Clear Turso dual-write queue completely on rollback
        dualWriteQueue.length = 0;
      }

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

module.exports = {
  OptimisticLockError,
  unitOfWork
};

