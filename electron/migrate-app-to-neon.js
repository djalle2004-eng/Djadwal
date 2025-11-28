#!/usr/bin/env node

/**
 * Migration Script: Application Database → Neon PostgreSQL
 * نقل البيانات من قاعدة بيانات التطبيق إلى Neon
 */

const { Client } = require('pg');
const { Database } = require('@sqlitecloud/drivers');
const { DatabaseAPIClient } = require('./database-api');
require('dotenv').config();

// إحصائيات الميجريشن
const stats = {
  started_at: null,
  completed_at: null,
  tables: {},
  errors: []
};

// الاتصال بقاعدة بيانات التطبيق
async function connectToAppDatabase() {
  console.log('🔗 الاتصال بقاعدة بيانات التطبيق...');
  
  const credentials = {
    username: process.env.SQLITECLOUD_USERNAME || 'admin@example.com',
    password: process.env.SQLITECLOUD_PASSWORD || 'admin123',
    host: process.env.SQLITECLOUD_HOST || 'cjh4w9vank.g4.sqlite.cloud',
    port: process.env.SQLITECLOUD_PORT || '8860',
    database: process.env.SQLITECLOUD_DATABASE || 'Djadwal'
  };
  
  console.log(`🔗 محاولة الاتصال بـ: ${credentials.host}:${credentials.port}/${credentials.database}`);
  
  // محاولة الاتصال المباشر أولاً
  try {
    console.log("🔄 محاولة الاتصال المباشر...");
    const connectionString = `sqlitecloud://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database}`;
    const db = new Database(connectionString);
    
    // اختبار الاتصال
    await db.sql('SELECT 1 as test');
    console.log('✅ تم الاتصال المباشر بنجاح');
    return db;
  } catch (directError) {
    console.log('⚠️ فشل الاتصال المباشر، محاولة استخدام API...');
    
    // استخدام API كبديل
    try {
      const db = new DatabaseAPIClient(credentials);
      await db.sql('SELECT 1 as test');
      console.log('✅ تم الاتصال عبر API بنجاح');
      return db;
    } catch (apiError) {
      console.error('❌ فشل جميع طرق الاتصال:', apiError.message);
      throw new Error(`فشل الاتصال بقاعدة البيانات: ${apiError.message}`);
    }
  }
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

// نقل جدول
async function migrateTable(tableName, appDb, neonClient, options = {}) {
  const startTime = Date.now();
  console.log(`\n📦 نقل ${tableName}...`);
  
  try {
    // 1. جلب البيانات من قاعدة بيانات التطبيق
    const rows = await appDb.sql(`SELECT * FROM ${tableName}`);
    console.log(`  📋 تم جلب ${rows.length} سجل`);
    
    if (rows.length === 0) {
      console.log(`  ⚠️ لا توجد بيانات`);
      stats.tables[tableName] = { count: 0, time: 0, status: 'empty' };
      return;
    }
    
    // 2. إدراج في Neon
    let inserted = 0;
    let errors = 0;
    
    for (const row of rows) {
      try {
        // بناء INSERT query
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `;
        
        await neonClient.query(query, values);
        inserted++;
        
        // Progress indicator
        if (inserted % 100 === 0) {
          process.stdout.write(`\r  ⚙️ ${inserted}/${rows.length}`);
        }
      } catch (err) {
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
    
    stats.tables[tableName] = {
      count: inserted,
      errors: errors,
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
  console.log('🚀 بدء نقل البيانات من قاعدة بيانات التطبيق إلى Neon...');
  console.log(`⏰ ${stats.started_at.toLocaleString('ar-DZ')}\n`);
  
  let appDb, neonClient;
  
  try {
    // الاتصال
    appDb = await connectToAppDatabase();
    neonClient = await connectToNeon();
    
    // نقل الجداول بالترتيب (بسبب Foreign Keys)
    
    // 1. الجداول الأساسية (بدون foreign keys)
    await migrateTable('academic_years', appDb, neonClient);
    await migrateTable('departments', appDb, neonClient);
    await migrateTable('professors', appDb, neonClient);
    await migrateTable('rooms', appDb, neonClient);
    
    // 2. الجداول التي تعتمد على الأساسية
    await migrateTable('semesters', appDb, neonClient);
    await migrateTable('specializations', appDb, neonClient);
    await migrateTable('courses', appDb, neonClient);
    await migrateTable('groups', appDb, neonClient);
    
    // 3. الحصص
    await migrateTable('assignments', appDb, neonClient);
    await migrateTable('extra_sessions', appDb, neonClient);
    
    // 4. جداول المصادقة والأمان
    await migrateTable('users', appDb, neonClient);
    await migrateTable('audit_log', appDb, neonClient);
    await migrateTable('backup_history', appDb, neonClient, { skipSequenceReset: true });
    
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
    
    for (const [table, info] of Object.entries(stats.tables)) {
      const status = info.status === 'success' ? '✅' : 
                     info.status === 'partial' ? '⚠️' : '❌';
      console.log(`${status} ${table.padEnd(20)} ${info.count || 0} سجل`);
      totalRecords += info.count || 0;
      totalErrors += info.errors || 0;
    }
    
    console.log(`\n📊 إجمالي: ${totalRecords} سجل`);
    
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
    if (appDb) {
      console.log('🔗 تم قطع الاتصال بقاعدة بيانات التطبيق');
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
