#!/usr/bin/env node

/**
 * Migration Script: SQLiteCloud → Neon (API Fallback)
 * نقل البيانات من SQLiteCloud إلى Neon باستخدام API
 */

const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

// إحصائيات الميجريشن
const stats = {
  started_at: null,
  completed_at: null,
  tables: {},
  errors: []
};

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

// جلب البيانات من SQLiteCloud عبر API
async function fetchDataFromSQLiteCloud(tableName) {
  console.log(`📡 جلب البيانات من ${tableName} عبر API...`);
  
  const apiUrl = process.env.VERCEL_API_URL || 'https://djadwal-95zzyaw3a-djalle2004-1566s-projects.vercel.app/api/query';
  
  try {
    const response = await axios.post(apiUrl, {
      query: `SELECT * FROM ${tableName}`,
      params: [],
      credentials: {
        username: process.env.SQLITECLOUD_USERNAME,
        password: process.env.SQLITECLOUD_PASSWORD,
        host: process.env.SQLITECLOUD_HOST,
        port: process.env.SQLITECLOUD_PORT,
        database: process.env.SQLITECLOUD_DATABASE
      }
    });
    
    if (response.data.success) {
      console.log(`  ✅ تم جلب ${response.data.data.length} سجل من ${tableName}`);
      return response.data.data;
    } else {
      throw new Error(`فشل في جلب البيانات: ${response.data.error}`);
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`خطأ API: ${error.response.data.error || error.response.statusText}`);
    } else {
      throw new Error(`خطأ في الاتصال: ${error.message}`);
    }
  }
}

// نقل جدول
async function migrateTable(tableName, neonClient, options = {}) {
  const startTime = Date.now();
  console.log(`\n📦 نقل ${tableName}...`);
  
  try {
    // 1. جلب البيانات من SQLiteCloud عبر API
    const rows = await fetchDataFromSQLiteCloud(tableName);
    
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
  console.log('🚀 بدء نقل البيانات من SQLiteCloud إلى Neon (API Mode)...');
  console.log(`⏰ ${stats.started_at.toLocaleString('ar-DZ')}\n`);
  
  let neonClient;
  
  try {
    // الاتصال بـ Neon
    neonClient = await connectToNeon();
    
    // نقل الجداول بالترتيب (بسبب Foreign Keys)
    
    // 1. الجداول الأساسية (بدون foreign keys)
    await migrateTable('academic_years', neonClient);
    await migrateTable('departments', neonClient);
    await migrateTable('professors', neonClient);
    await migrateTable('rooms', neonClient);
    
    // 2. الجداول التي تعتمد على الأساسية
    await migrateTable('semesters', neonClient);
    await migrateTable('specializations', neonClient);
    await migrateTable('courses', neonClient);
    await migrateTable('groups', neonClient);
    
    // 3. الحصص
    await migrateTable('assignments', neonClient);
    await migrateTable('extra_sessions', neonClient);
    
    // 4. جداول المصادقة والأمان
    await migrateTable('users', neonClient);
    await migrateTable('audit_log', neonClient);
    await migrateTable('backup_history', neonClient, { skipSequenceReset: true });
    
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
