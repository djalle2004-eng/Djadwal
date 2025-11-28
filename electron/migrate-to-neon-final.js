#!/usr/bin/env node

/**
 * Migration Script: SQLiteCloud → Neon PostgreSQL (Schema-Aware)
 * نقل البيانات من SQLiteCloud إلى Neon مع مراعاة الفروق في المخطط
 */

const { Client } = require('pg');
const { Database } = require('@sqlitecloud/drivers');
require('dotenv').config();

// إحصائيات الميجريشن
const stats = {
  started_at: null,
  completed_at: null,
  tables: {},
  errors: []
};

// الاتصال بـ SQLiteCloud
async function connectToSQLiteCloud() {
  console.log('🔗 الاتصال بـ SQLiteCloud...');
  
  const connectionString = `sqlitecloud://${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/${process.env.SQLITECLOUD_DATABASE}?apikey=${process.env.SQLITECLOUD_PASSWORD}`;
  
  console.log(`🔗 محاولة الاتصال بـ: ${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/${process.env.SQLITECLOUD_DATABASE}`);
  
  const db = new Database(connectionString);
  console.log('✅ تم الاتصال بـ SQLiteCloud');
  return db;
}

// الاتصال بـ Neon
async function connectToNeon() {
  console.log('🔗 الاتصال بـ Neon PostgreSQL...');
  
  if (!process.env.NEON_CONNECTION_STRING) {
    console.error('❌ متغير البيئة NEON_CONNECTION_STRING غير موجود');
    throw new Error('متغير البيئة NEON_CONNECTION_STRING غير موجود');
  }
  
  const client = new Client({
    connectionString: process.env.NEON_CONNECTION_STRING
  });
  
  await client.connect();
  console.log('✅ تم الاتصال بـ Neon');
  return client;
}

// فحص وجود جدول
async function tableExists(sqliteDb, tableName) {
  try {
    const result = await sqliteDb.sql(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
    return result.length > 0;
  } catch (err) {
    return false;
  }
}

// تنظيف البيانات للتوافق مع PostgreSQL
function cleanDataForPostgres(data, tableName) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(data)) {
    let cleanKey = key;
    
    // تنظيف أسماء الأعمدة حسب الجدول
    switch (tableName) {
      case 'professors':
        if (key === 'Phone') cleanKey = 'phone';
        else if (key === 'Title') cleanKey = 'title';
        else if (key === 'Academic Title') cleanKey = 'academic_title';
        else cleanKey = key.toLowerCase();
        break;
      default:
        cleanKey = key.toLowerCase();
    }
    
    // تنظيف القيم
    let cleanValue = value;
    if (cleanValue === null || cleanValue === undefined) {
      cleanValue = null;
    } else if (typeof cleanValue === 'string' && cleanValue.trim() === '') {
      cleanValue = null;
    }
    
    cleaned[cleanKey] = cleanValue;
  }
  
  return cleaned;
}

// نقل جدول مع معالجة الأخطاء والمخطط
async function migrateTable(tableName, sqliteDb, neonClient, options = {}) {
  const startTime = Date.now();
  console.log(`\n📦 نقل ${tableName}...`);
  
  try {
    // فحص وجود الجدول
    const exists = await tableExists(sqliteDb, tableName);
    if (!exists) {
      console.log(`  ⚠️ الجدول ${tableName} غير موجود، تم تخطيه`);
      stats.tables[tableName] = { count: 0, time: 0, status: 'skipped' };
      return;
    }

    // 1. جلب البيانات من SQLiteCloud
    const rows = await sqliteDb.sql(`SELECT * FROM ${tableName}`);
    console.log(`  📋 تم جلب ${rows.length} سجل`);
    
    if (rows.length === 0) {
      console.log(`  ⚠️ لا توجد بيانات`);
      stats.tables[tableName] = { count: 0, time: 0, status: 'empty' };
      return;
    }
    
    // 2. إدراج في Neon
    let inserted = 0;
    let errors = 0;
    let skipped = 0;
    
    for (const row of rows) {
      try {
        // تنظيف البيانات
        const cleanedRow = cleanDataForPostgres(row, tableName);
        
        // بناء INSERT query مع تجنب التكرار
        const columns = Object.keys(cleanedRow);
        const values = Object.values(cleanedRow);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        // استخدام ON CONFLICT لتجنب التكرار
        const conflictClause = options.skipDuplicates ? 'ON CONFLICT DO NOTHING' : '';
        
        const query = `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
          ${conflictClause}
        `;
        
        await neonClient.query(query, values);
        inserted++;
        
        // Progress indicator
        if (inserted % 100 === 0) {
          process.stdout.write(`\r  ⚙️ ${inserted}/${rows.length}`);
        }
      } catch (err) {
        if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
          skipped++;
          // لا نعتبر هذا خطأ، فقط سجل مكرر
        } else {
          errors++;
          stats.errors.push({
            table: tableName,
            row: row.id || row,
            error: err.message
          });
          
          if (errors <= 5) {
            console.error(`\n  ❌ خطأ في ID ${row.id}: ${err.message}`);
          }
        }
      }
    }
    
    // 3. إعادة ضبط SEQUENCE
    if (inserted > 0 && !options.skipSequenceReset) {
      try {
        const maxIdResult = await neonClient.query(
          `SELECT MAX(id) as max_id FROM ${tableName}`
        );
        const maxId = maxIdResult.rows[0].max_id || 0;
        
        if (maxId > 0) {
          await neonClient.query(
            `SELECT setval('${tableName}_id_seq', $1, true)`,
            [maxId]
          );
        }
      } catch (seqError) {
        console.log(`  ⚠️ لم يتم إعادة ضبط التسلسل: ${seqError.message}`);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n  ✅ تم نقل ${inserted}/${rows.length} سجل (في ${duration}ms)`);
    if (skipped > 0) {
      console.log(`  ⏭️ تم تخطي ${skipped} سجل مكرر`);
    }
    
    stats.tables[tableName] = {
      count: inserted,
      errors: errors,
      skipped: skipped,
      total: rows.length,
      time: duration,
      status: errors === 0 ? 'success' : 'partial'
    };
    
  } catch (err) {
    console.error(`  ❌ فشل نقل ${tableName}: ${err.message}`);
    stats.tables[tableName] = { status: 'failed', error: err.message };
    throw err;
  }
}

// الدالة الرئيسية
async function migrate() {
  stats.started_at = new Date();
  console.log('🚀 بدء نقل البيانات من SQLiteCloud إلى Neon...');
  console.log(`⏰ ${stats.started_at.toLocaleString('ar-DZ')}\n`);
  
  let sqliteDb, neonClient;
  
  try {
    // الاتصال
    sqliteDb = await connectToSQLiteCloud();
    neonClient = await connectToNeon();
    
    // نقل الجداول بالترتيب (بسبب Foreign Keys)
    
    // 1. الجداول الأساسية (بدون foreign keys)
    await migrateTable('academic_years', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('departments', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('professors', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('rooms', sqliteDb, neonClient, { skipDuplicates: true });
    
    // 2. الجداول التي تعتمد على الأساسية
    await migrateTable('semesters', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('courses', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('groups', sqliteDb, neonClient, { skipDuplicates: true });
    
    // 3. الحصص
    await migrateTable('assignments', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('extra_sessions', sqliteDb, neonClient, { skipDuplicates: true });
    
    // 4. جداول المصادقة والأمان
    await migrateTable('users', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('audit_log', sqliteDb, neonClient, { skipDuplicates: true });
    await migrateTable('backup_history', sqliteDb, neonClient, { skipDuplicates: true, skipSequenceReset: true });
    
    stats.completed_at = new Date();
    const totalTime = stats.completed_at - stats.started_at;
    
    // تقرير نهائي
    console.log('\n\n🎉 ===== تقرير النقل =====');
    console.log(`⏰ بدء: ${stats.started_at.toLocaleString('ar-DZ')}`);
    console.log(`⏰ انتهى: ${stats.completed_at.toLocaleString('ar-DZ')}`);
    console.log(`⏱️ الوقت الكلي: ${Math.round(totalTime / 1000)} ثانية\n`);
    
    console.log('📋 ملخص الجداول:');
    let totalRecords = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    
    for (const [table, info] of Object.entries(stats.tables)) {
      const status = info.status === 'success' ? '✅' : 
                     info.status === 'partial' ? '⚠️' : 
                     info.status === 'skipped' ? '⏭️' : '❌';
      console.log(`${status} ${table.padEnd(20)} ${info.count || 0} سجل`);
      totalRecords += info.count || 0;
      totalErrors += info.errors || 0;
      totalSkipped += info.skipped || 0;
    }
    
    console.log(`\n📊 إجمالي: ${totalRecords} سجل`);
    if (totalSkipped > 0) {
      console.log(`⏭️ تم تخطي: ${totalSkipped} سجل مكرر`);
    }
    
    if (totalErrors > 0) {
      console.log(`\n⚠️ إجمالي الأخطاء: ${totalErrors}`);
      console.log('📄 تفاصيل الأخطاء في migration-errors.json');
      
      const fs = require('fs');
      fs.writeFileSync(
        'migration-errors.json',
        JSON.stringify(stats.errors, null, 2)
      );
    }
    
    console.log('\n✅ تم النقل بنجاح!');
    
  } catch (err) {
    console.error('\n❌ فشل النقل:', err);
    throw err;
  } finally {
    // إغلاق الاتصالات
    if (neonClient) {
      await neonClient.end();
      console.log('🔗 تم قطع الاتصال بـ Neon');
    }
    if (sqliteDb) {
      console.log('🔗 تم قطع الاتصال بـ SQLiteCloud');
    }
  }
}

// تشغيل الميجريشن
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('\n🎉 تمت عملية النقل بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { migrate };
