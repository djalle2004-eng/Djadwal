const { OptimisticLockError } = require('../unitOfWork.js');

function getDatabaseModule() {
  return require('../../../../server/database.js');
}

class BaseRepository {
  constructor(options) {
    this.tableName = options.tableName;
    this.primaryKey = options.primaryKey || 'id';
    this.supportsSoftDelete = Boolean(options.supportsSoftDelete);
    this.supportsOptimisticLock = Boolean(options.supportsOptimisticLock);
  }

  isSoftDeleteActive() {
    return this.supportsSoftDelete && process.env.FEATURE_SOFT_DELETE !== 'false';
  }

  getOptimisticLockMode() {
    return process.env.FEATURE_OPTIMISTIC_LOCK_MODE || 'monitor';
  }

  async executeSql(sql, params = [], uow) {
    if (uow) {
      return await uow.query(sql, params);
    }
    const db = getDatabaseModule();
    return await db.executeQuery(sql, params);
  }

  async list(options = {}) {
    const whereClauses = [];
    const params = [];
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
    return await this.executeSql(sql, params, options.uow);
  }

  async get(id, options = {}) {
    const whereClauses = [`${this.tableName}.${this.primaryKey} = $1`];
    if (this.isSoftDeleteActive() && !options.withArchived) {
      whereClauses.push(`${this.tableName}.deleted_at IS NULL`);
    }

    const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClauses.join(' AND ')} LIMIT 1`;
    const rows = await this.executeSql(sql, [id], options.uow);
    return rows[0] || null;
  }

  async create(data, context = {}) {
    const record = { ...data };

    if (this.supportsOptimisticLock && record.version === undefined) {
      record.version = 1;
    }

    const keys = Object.keys(record);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.map(k => `"${k}"`).join(', ');
    const values = keys.map(k => record[k]);

    const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const rows = await this.executeSql(sql, values, context.uow);
    const created = rows[0];

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

  async update(id, data, context = {}) {
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

    const updateData = { ...data };
    delete updateData[this.primaryKey];

    if (this.supportsOptimisticLock) {
      updateData.version = nextVersion;
    }

    const updateKeys = Object.keys(updateData);
    if (updateKeys.length === 0) {
      return current;
    }

    const setClauses = updateKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = updateKeys.map(k => updateData[k]);
    values.push(id);

    const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE "${this.primaryKey}" = $${values.length} RETURNING *`;
    const rows = await this.executeSql(sql, values, context.uow);
    const updated = rows[0];

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

  async archive(id, context = {}) {
    const current = await this.get(id, { withArchived: true, uow: context.uow });
    if (!current) {
      throw new Error(`Entity ${this.tableName} #${id} not found`);
    }

    if (this.isSoftDeleteActive()) {
      const sql = `UPDATE ${this.tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE "${this.primaryKey}" = $1 RETURNING *`;
      const rows = await this.executeSql(sql, [id], context.uow);
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

  async restore(id, context = {}) {
    if (!this.supportsSoftDelete) {
      throw new Error(`Entity ${this.tableName} does not support soft delete restore.`);
    }

    const current = await this.get(id, { withArchived: true, uow: context.uow });
    if (!current) {
      throw new Error(`Entity ${this.tableName} #${id} not found`);
    }

    const sql = `UPDATE ${this.tableName} SET deleted_at = NULL WHERE "${this.primaryKey}" = $1 RETURNING *`;
    const rows = await this.executeSql(sql, [id], context.uow);
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

module.exports = {
  BaseRepository
};

