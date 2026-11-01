function getDatabaseModule() {
  return require('../../../../server/database.js');
}

class ChangeLogRepository {
  async getRecent(limit = 50, entityType, entityId) {
    const db = getDatabaseModule();
    const where = [];
    const params = [];
    let idx = 1;

    if (entityType) {
      where.push(`entity_type = $${idx++}`);
      params.push(entityType);
    }
    if (entityId) {
      where.push(`entity_id = $${idx++}`);
      params.push(String(entityId));
    }

    const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT * FROM change_log ${whereStr} ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(limit);

    const rows = await db.executeQuery(sql, params);
    return rows.map(r => ({
      ...r,
      before_state: typeof r.before_state === 'string' ? JSON.parse(r.before_state) : r.before_state,
      after_state: typeof r.after_state === 'string' ? JSON.parse(r.after_state) : r.after_state
    }));
  }

  async getById(id, uow) {
    const db = getDatabaseModule();
    const sql = 'SELECT * FROM change_log WHERE id = $1 LIMIT 1';
    const rows = uow ? await uow.query(sql, [id]) : await db.executeQuery(sql, [id]);
    if (!rows[0]) return null;

    const r = rows[0];
    return {
      ...r,
      before_state: typeof r.before_state === 'string' ? JSON.parse(r.before_state) : r.before_state,
      after_state: typeof r.after_state === 'string' ? JSON.parse(r.after_state) : r.after_state
    };
  }

  async undo(changeId, context) {
    const { uow, userId } = context;
    const change = await this.getById(changeId, uow);

    if (!change) {
      throw new Error(`سجل التغيير رقم ${changeId} غير موجود.`);
    }

    if (change.reverted_at) {
      throw new Error(`تم التراجع عن هذا التعديل مسبقًا في ${change.reverted_at}.`);
    }

    const createdAtMs = new Date(change.created_at).getTime();
    const nowMs = Date.now();
    const diffHours = (nowMs - createdAtMs) / (1000 * 60 * 60);

    if (diffHours > 24) {
      throw new Error(`انتهت نافذة التراجع المسموحة (24 ساعة). تم إجراء التعديل قبل ${diffHours.toFixed(1)} ساعة.`);
    }

    const { entity_type, entity_id, action, before_state } = change;

    switch (action) {
      case 'create': {
        await uow.query(`UPDATE "${entity_type}" SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, [entity_id]);
        uow.queueDualWrite(`UPDATE "${entity_type}" SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [entity_id]);
        break;
      }

      case 'update': {
        if (!before_state) {
          throw new Error('لا يمكن استعادة الحالة السابقة: بيانات الحالة السابقة غير مسجلة.');
        }

        const keys = Object.keys(before_state).filter(k => k !== 'id' && k !== 'created_at');
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = keys.map(k => before_state[k]);
        values.push(entity_id);

        await uow.query(`UPDATE "${entity_type}" SET ${setClauses} WHERE id = $${values.length}`, values);

        const sqliteSet = keys.map(k => `"${k}" = ?`).join(', ');
        uow.queueDualWrite(`UPDATE "${entity_type}" SET ${sqliteSet} WHERE id = ?`, values);
        break;
      }

      case 'archive': {
        await uow.query(`UPDATE "${entity_type}" SET deleted_at = NULL WHERE id = $1`, [entity_id]);
        uow.queueDualWrite(`UPDATE "${entity_type}" SET deleted_at = NULL WHERE id = ?`, [entity_id]);
        break;
      }

      case 'restore': {
        await uow.query(`UPDATE "${entity_type}" SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, [entity_id]);
        uow.queueDualWrite(`UPDATE "${entity_type}" SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [entity_id]);
        break;
      }

      default:
        throw new Error(`نوع العملية (${action}) غير مدعوم للتراجع التلقائي.`);
    }

    await uow.query(
      `UPDATE change_log SET reverted_at = CURRENT_TIMESTAMP, reverted_by = $1 WHERE id = $2`,
      [userId || null, changeId]
    );

    uow.queueDualWrite(
      `UPDATE change_log SET reverted_at = CURRENT_TIMESTAMP, reverted_by = ? WHERE id = ?`,
      [userId || null, changeId]
    );

    return {
      success: true,
      changeId,
      entity_type,
      entity_id,
      message: `تم التراجع عن التعديل رقم ${changeId} للكيان (${entity_type} #${entity_id}) بنجاح.`
    };
  }
}

const changeLogRepository = new ChangeLogRepository();

module.exports = {
  ChangeLogRepository,
  changeLogRepository
};

