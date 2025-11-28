/**
 * Migration Script: SQLiteCloud → Neon PostgreSQL
 * نقل البيانات من SQLiteCloud إلى Neon
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
  
  // التحقق من وجود متغيرات البيئة المطلوبة
  const requiredEnvVars = [
    'SQLITECLOUD_HOST',
    'SQLITECLOUD_PORT', 
    'SQLITECLOUD_DATABASE',
    'SQLITECLOUD_USERNAME',
    'SQLITECLOUD_PASSWORD'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ متغيرات البيئة المفقودة:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n📝 يرجى إنشاء ملف .env مع المتغيرات التالية:');
    console.error('SQLITECLOUD_HOST=your-host.sqlite.cloud');
    console.error('SQLITECLOUD_PORT=8860');
    console.error('SQLITECLOUD_DATABASE=your-database-name');
    console.error('SQLITECLOUD_USERNAME=your-api-key');
    console.error('SQLITECLOUD_PASSWORD=your-api-secret');
    throw new Error('متغيرات البيئة المطلوبة غير موجودة');
  }
  
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
    console.error('\n📝 يرجى إضافة متغير البيئة التالي إلى ملف .env:');
    console.error('NEON_CONNECTION_STRING=postgresql://username:password@host:port/database?sslmode=require');
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
async function migrateTable(tableName, sqliteDb, neonClient, options = {}) {
  const startTime = Date.now();
  console.log(`\n📦 نقل ${tableName}...`);
  
  try {
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
  console.log('🚀 بدء نقل البيانات من SQLiteCloud إلى Neon...');
  console.log(`⏰ ${stats.started_at.toLocaleString('ar-DZ')}\n`);
  
  let sqliteDb, neonClient;
  
  try {
    // الاتصال
    sqliteDb = await connectToSQLiteCloud();
    neonClient = await connectToNeon();
    
    // نقل الجداول بالترتيب (بسبب Foreign Keys)
    
    // 1. الجداول الأساسية (بدون foreign keys)
    await migrateTable('academic_years', sqliteDb, neonClient);
    await migrateTable('departments', sqliteDb, neonClient);
    await migrateTable('professors', sqliteDb, neonClient);
    await migrateTable('rooms', sqliteDb, neonClient);
    
    // 2. الجداول التي تعتمد على الأساسية
    await migrateTable('semesters', sqliteDb, neonClient);
    await migrateTable('specializations', sqliteDb, neonClient);
    await migrateTable('courses', sqliteDb, neonClient);
    await migrateTable('groups', sqliteDb, neonClient);
    
    // 3. الحصص
    await migrateTable('assignments', sqliteDb, neonClient);
    await migrateTable('extra_sessions', sqliteDb, neonClient);
    
    // 4. جداول المصادقة والأمان
    await migrateTable('users', sqliteDb, neonClient);
    await migrateTable('audit_log', sqliteDb, neonClient);
    await migrateTable('backup_history', sqliteDb, neonClient, { skipSequenceReset: true });
    
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