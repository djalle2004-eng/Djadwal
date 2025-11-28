#!/usr/bin/env node

/**
 * SQLiteCloud Connection Tester
 * اختبار اتصال SQLiteCloud
 */

const { Database } = require('@sqlitecloud/drivers');
require('dotenv').config();

async function testConnection() {
  console.log('🧪 اختبار اتصالات SQLiteCloud المختلفة...');
  console.log('==========================================\n');
  
  const host = process.env.SQLITECLOUD_HOST;
  const port = process.env.SQLITECLOUD_PORT;
  const database = process.env.SQLITECLOUD_DATABASE;
  const apiKey = process.env.SQLITECLOUD_PASSWORD;
  
  console.log('📋 معلومات الاتصال:');
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);
  console.log(`  Database: ${database}`);
  console.log(`  API Key: ${apiKey.substring(0, 10)}...\n`);
  
  // اختبار 1: التنسيق الحالي
  console.log('🔍 اختبار 1: التنسيق الحالي');
  try {
    const connectionString1 = `sqlitecloud://apikey:${apiKey}@${host}:${port}/${database}`;
    console.log(`  Connection String: ${connectionString1.replace(apiKey, '***')}`);
    
    const db1 = new Database(connectionString1);
    await db1.sql('SELECT 1 as test');
    console.log('  ✅ نجح الاتصال!');
    return db1;
  } catch (err) {
    console.log(`  ❌ فشل: ${err.message}`);
  }
  
  // اختبار 2: بدون apikey في المسار
  console.log('\n🔍 اختبار 2: بدون apikey في المسار');
  try {
    const connectionString2 = `sqlitecloud://${apiKey}@${host}:${port}/${database}`;
    console.log(`  Connection String: ${connectionString2.replace(apiKey, '***')}`);
    
    const db2 = new Database(connectionString2);
    await db2.sql('SELECT 1 as test');
    console.log('  ✅ نجح الاتصال!');
    return db2;
  } catch (err) {
    console.log(`  ❌ فشل: ${err.message}`);
  }
  
  // اختبار 3: استخدام SQLITECLOUD_URL الموجود
  console.log('\n🔍 اختبار 3: استخدام SQLITECLOUD_URL الموجود');
  try {
    const existingUrl = process.env.SQLITECLOUD_URL;
    if (existingUrl) {
      console.log(`  Connection String: ${existingUrl.replace(apiKey, '***')}`);
      
      const db3 = new Database(existingUrl);
      await db3.sql('SELECT 1 as test');
      console.log('  ✅ نجح الاتصال!');
      return db3;
    } else {
      console.log('  ⚠️ SQLITECLOUD_URL غير موجود');
    }
  } catch (err) {
    console.log(`  ❌ فشل: ${err.message}`);
  }
  
  // اختبار 4: تنسيق مختلف
  console.log('\n🔍 اختبار 4: تنسيق مختلف');
  try {
    const connectionString4 = `sqlitecloud://${host}:${port}/${database}?apikey=${apiKey}`;
    console.log(`  Connection String: ${connectionString4.replace(apiKey, '***')}`);
    
    const db4 = new Database(connectionString4);
    await db4.sql('SELECT 1 as test');
    console.log('  ✅ نجح الاتصال!');
    return db4;
  } catch (err) {
    console.log(`  ❌ فشل: ${err.message}`);
  }
  
  console.log('\n❌ جميع اختبارات الاتصال فشلت');
  console.log('\n💡 اقتراحات:');
  console.log('1. تحقق من صحة API Key في لوحة تحكم SQLiteCloud');
  console.log('2. تأكد من أن الحساب نشط وغير منتهي الصلاحية');
  console.log('3. جرب إنشاء API Key جديد');
  console.log('4. تحقق من إعدادات قاعدة البيانات في SQLiteCloud');
  
  return null;
}

// تشغيل الاختبار
if (require.main === module) {
  testConnection()
    .then((db) => {
      if (db) {
        console.log('\n🎉 تم العثور على اتصال صالح!');
        console.log('يمكنك الآن استخدام هذا التنسيق في سكريبت النقل.');
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ خطأ في الاختبار:', err);
      process.exit(1);
    });
}

module.exports = { testConnection };
