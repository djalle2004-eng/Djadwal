import { UnitOfWorkContext, OptimisticLockError } from '../unitOfWork.js';

export interface RepositoryOptions {
  tableName: string;
  primaryKey?: string;
  supportsSoftDelete?: boolean;
  supportsOptimisticLock?: boolean;
}

export interface QueryOptions {
  where?: Record<string, any>;
  withArchived?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: string;
  uow?: UnitOfWorkContext;
}

export interface MutationContext {
  uow?: UnitOfWorkContext;
  userId?: number | null;
  expectedVersion?: number;
}

function getDatabaseModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../../server/database.js');
}

export class BaseRepository<T extends Record<string, any>> {
  public readonly tableName: string;
  public readonly primaryKey: string;
  public readonly supportsSoftDelete: boolean;
  public readonly supportsOptimisticLock: boolean;

  constructor(options: RepositoryOptions) {
    this.tableName = options.tableName;
    this.primaryKey = options.primaryKey || 'id';
    this.supportsSoftDelete = Boolean(options.supportsSoftDelete);
    this.supportsOptimisticLock = Boolean(options.supportsOptimisticLock);
  }

  protected isSoftDeleteActive(): boolean {
    return this.supportsSoftDelete && process.env.FEATURE_SOFT_DELETE !== 'false';
  }

  protected getOptimisticLockMode(): 'off' | 'monitor' | 'enforce' {
    return (process.env.FEATURE_OPTIMISTIC_LOCK_MODE as any) || 'monitor';
  }

  protected async executeSql<R = any>(sql: string, params: any[] = [], uow?: UnitOfWorkContext): Promise<R[]> {
    if (uow) {
      return await uow.query<R>(sql, params);
    }
    const db = getDatabaseModule();
    return await db.executeQuery(sql, params);
  }

  async list(options: QueryOptions = {}): Promise<T[]> {
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (this.isSoftDeleteActive() && !options.withArchived) {
      whereClauses.push(`${this.tableName}.deleted_at IS NULL`);
    }

    if (options.where) {
      for (const [key, val] of Object.entries(options.where)) {
        if (val === null || val === undefined) {
          whereClauses.push(`${this.tableName}.${key} IS NULL`);
        } else {
          whereClauses.push(`${this.tableName}.${key} = $${paramIdx++}`);
          params.push(val);
        }
      }
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderStr = options.orderBy ? `ORDER BY ${options.orderBy}` : `ORDER BY ${this.tableName}.${this.primaryKey} ASC`;
    const limitStr = options.limit ? `LIMIT ${Number(options.limit)}` : '';
    const offsetStr = options.offset ? `OFFSET ${Number(options.offset)}` : '';

    const sql = `SELECT * FROM ${this.tableName} ${whereStr} ${orderStr} ${limitStr} ${offsetStr}`.trim();
    return await this.executeSql<T>(sql, params, options.uow);
  }

  async get(id: number | string, options: { withArchived?: boolean; uow?: UnitOfWorkContext } = {}): Promise<T | null> {
    const whereClauses: string[] = [`${this.tableName}.${this.primaryKey} = $1`];
    if (this.isSoftDeleteActive() && !options.withArchived) {
      whereClauses.push(`${this.tableName}.deleted_at IS NULL`);
    }

    const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClauses.join(' AND ')} LIMIT 1`;
    const rows = await this.executeSql<T>(sql, [id], options.uow);
    return rows[0] || null;
  }

  async create(data: Partial<T>, context: MutationContext = {}): Promise<T> {
    const record: Record<string, any> = { ...data };

    if (this.supportsOptimisticLock && record.version === undefined) {
      record.version = 1;
    }

    const keys = Object.keys(record);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.map(k => `"${k}"`).join(', ');
    const values = keys.map(k => record[k]);

    const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const rows = await this.executeSql<T>(sql, values, context.uow);
    const created = rows[0];

    // Audit / Change log
    if (context.uow) {
      await context.uow.recordChange({
        entity_type: this.tableName,
        entity_id: created[this.primaryKey],
        action: 'create',
        before_state: null,
        after_state: created,
        changed_by: context.userId
      });
    }

    return created;
  }

  async update(id: number | string, data: Partial<T>, context: MutationContext = {}): Promise<T> {
    const current = await this.get(id, { withArchived: true, uow: context.uow });
    if (!current) {
      throw new Error(`Entity ${this.tableName} #${id} not found`);
    }

    let nextVersion = current.version || 1;

    if (this.supportsOptimisticLock) {
      const mode = this.getOptimisticLockMode();
      if (context.expectedVersion !== undefined && mode !== 'off') {
        const currentVersion = Number(current.version || 1);
        const expected = Number(context.expectedVersion);

        if (currentVersion !== expected) {
          if (mode === 'enforce') {
            throw new OptimisticLockError(this.tableName, id, expected, currentVersion);
          } else if (mode === 'monitor') {
            console.warn(
              `⚠️ [OPTIMISTIC_LOCK_WARNING] Conflict on entity ${this.tableName} #${id}. Expected: ${expected}, Actual: ${currentVersion}`
            );
          }
        }
      }
      nextVersion = (current.version || 1) + 1;
    }

    const updateData: Record<string, any> = { ...data };
    delete updateData[this.primaryKey]; // Never update primary key

    if (this.supportsOptimisticLock) {
      updateData.version = nextVersion;
    }

    const updateKeys = Object.keys(updateData);
    if (updateKeys.length === 0) {
      return current;
    }

    const setClauses = updateKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = updateKeys.map(k => updateData[k]);
    values.push(id); // $values.length is id

    const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE "${this.primaryKey}" = $${values.length} RETURNING *`;
    const rows = await this.executeSql<T>(sql, values, context.uow);
    const updated = rows[0];

    // Audit / Change log
    if (context.uow) {
      await context.uow.recordChange({
        entity_type: this.tableName,
        entity_id: id,
        action: 'update',
        before_state: current,
        after_state: updated,
        changed_by: context.userId
      });
    }

    return updated;
  }

  async archive(id: number | string, context: MutationContext = {}): Promise<{ id: number | string; archived: boolean }> {
    const current = await this.get(id, { withArchived: true, uow: context.uow });
    if (!current) {
      throw new Error(`Entity ${this.tableName} #${id} not found`);
    }

    if (this.isSoftDeleteActive()) {
      const sql = `UPDATE ${this.tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE "${this.primaryKey}" = $1 RETURNING *`;
      const rows = await this.executeSql<T>(sql, [id], context.uow);
      const updated = rows[0];

      if (context.uow) {
        await context.uow.recordChange({
          entity_type: this.tableName,
          entity_id: id,
          action: 'archive',
          before_state: current,
          after_state: updated,
          changed_by: context.userId
        });
      }
      return { id, archived: true };
    } else {
      // Hard delete fallback
      const sql = `DELETE FROM ${this.tableName} WHERE "${this.primaryKey}" = $1`;
      await this.executeSql(sql, [id], context.uow);

      if (context.uow) {
        await context.uow.recordChange({
          entity_type: this.tableName,
          entity_id: id,
          action: 'archive',
          before_state: current,
          after_state: null,
          changed_by: context.userId
        });
      }
      return { id, archived: true };
    }
  }

  async restore(id: number | string, context: MutationContext = {}): Promise<T> {
    if (!this.supportsSoftDelete) {
      throw new Error(`Entity ${this.tableName} does not support soft delete restore.`);
    }

    const current = await this.get(id, { withArchived: true, uow: context.uow });
    if (!current) {
      throw new Error(`Entity ${this.tableName} #${id} not found`);
    }

    const sql = `UPDATE ${this.tableName} SET deleted_at = NULL WHERE "${this.primaryKey}" = $1 RETURNING *`;
    const rows = await this.executeSql<T>(sql, [id], context.uow);
    const restored = rows[0];

    if (context.uow) {
      await context.uow.recordChange({
        entity_type: this.tableName,
        entity_id: id,
        action: 'restore',
        before_state: current,
        after_state: restored,
        changed_by: context.userId
      });
    }

    return restored;
  }
}

