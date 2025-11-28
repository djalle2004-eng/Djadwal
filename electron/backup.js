const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { executeQuery } = require('./database');

/**
 * إنشاء نسخة احتياطية كاملة
 */
async function createFullBackup(options) {
  try {
    const backupDir = options.backupPath || path.join(app.getPath('userData'), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = `backup_full_${timestamp}`;
    
    let backupData = {};
    let backupPath = '';
    let fileSize = 0;

    // جلب كل البيانات من القاعدة
    const tables = [
      'academic_years', 'semesters', 'departments', 'groups',
      'courses', 'professors', 'rooms', 'assignments', 'extra_sessions'
    ];

    for (const table of tables) {
      try {
        const data = await executeQuery(`SELECT * FROM ${table}`);
        backupData[table] = data;
      } catch (err) {
        console.warn(`تحذير: تعذر نسخ جدول ${table}:`, err.message);
        backupData[table] = [];
      }
    }

    // حفظ البيانات حسب الصيغة
    if (options.format === 'json') {
      backupPath = path.join(backupDir, `${backupName}.json`);
      const jsonData = JSON.stringify(backupData, null, 2);
      fs.writeFileSync(backupPath, jsonData);
      fileSize = fs.statSync(backupPath).size;
    }

    // تسجيل في backup_history
    const createdAt = new Date().toISOString();
    const userId = options.userId || 1;
    
    try {
      await executeQuery(
        `INSERT INTO backup_history (backup_name, backup_path, backup_type, backup_format, file_size, created_by, created_at)
         VALUES ('${backupName}', '${backupPath}', 'full', '${options.format}', ${fileSize}, ${userId}, '${createdAt}')`
      );
    } catch (err) {
      console.warn('تحذير: تعذر تسجيل النسخة في السجل:', err.message);
      // استمر بدون تسجيل
    }

    return {
      id: Date.now(),
      name: backupName,
      path: backupPath,
      size: fileSize,
      format: options.format,
      type: 'full'
    };
  } catch (error) {
    console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
    throw error;
  }
}

/**
 * استعادة نسخة احتياطية
 */
async function restoreBackup(options) {
  try {
    const backupPath = options.backupPath;
    
    if (!fs.existsSync(backupPath)) {
      throw new Error('ملف النسخة الاحتياطية غير موجود');
    }

    const fileContent = fs.readFileSync(backupPath, 'utf8');
    const backupData = JSON.parse(fileContent);

    // استعادة البيانات
    if (options.mode === 'replace') {
      const tables = Object.keys(backupData);
      for (const table of tables) {
        if (table !== 'users' && table !== 'backup_history') {
          await executeQuery(`DELETE FROM ${table}`);
        }
      }
    }

    // إدراج البيانات من النسخة الاحتياطية
    for (const [table, records] of Object.entries(backupData)) {
      if (!Array.isArray(records) || records.length === 0) continue;
      if (table === 'users' || table === 'backup_history') continue;

      for (const record of records) {
        const columns = Object.keys(record).join(', ');
        const placeholders = Object.keys(record).map(() => '?').join(', ');
        const values = Object.values(record);
        
        try {
          await executeQuery(
            `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`,
            values
          );
        } catch (err) {
          console.warn(`تحذير: تعذر استعادة سجل من ${table}:`, err.message);
        }
      }
    }

    return { success: true, message: 'تم استعادة النسخة الاحتياطية بنجاح' };
  } catch (error) {
    console.error('خطأ في استعادة النسخة الاحتياطية:', error);
    throw error;
  }
}

/**
 * جلب سجل النسخ الاحتياطية
 */
async function getBackupHistory() {
  try {
    return await executeQuery(
      `SELECT bh.*, u.username as created_by_username
       FROM backup_history bh
       LEFT JOIN users u ON bh.created_by = u.id
       ORDER BY bh.created_at DESC`
    );
  } catch (error) {
    console.error('خطأ في جلب سجل النسخ الاحتياطية:', error);
    return [];
  }
}

/**
 * حذف نسخة احتياطية
 */
async function deleteBackup(backupId) {
  try {
    const backup = await executeQuery(
      'SELECT * FROM backup_history WHERE id = ?',
      [backupId]
    );

    if (backup && backup.length > 0) {
      const backupPath = backup[0].backup_path;
      
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      await executeQuery('DELETE FROM backup_history WHERE id = ?', [backupId]);
    }

    return { success: true };
  } catch (error) {
    console.error('خطأ في حذف النسخة الاحتياطية:', error);
    throw error;
  }
}

module.exports = {
  createFullBackup,
  restoreBackup,
  getBackupHistory,
  deleteBackup
};