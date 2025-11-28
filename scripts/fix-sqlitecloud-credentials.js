#!/usr/bin/env node

/**
 * Fix SQLiteCloud Credentials
 * إصلاح بيانات اعتماد SQLiteCloud
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 إصلاح بيانات اعتماد SQLiteCloud');
console.log('===================================\n');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ ملف .env غير موجود');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// استخراج API key من SQLITECLOUD_URL
const urlMatch = envContent.match(/SQLITECLOUD_URL=sqlitecloud:\/\/apikey:([^@]+)@/);
if (!urlMatch) {
  console.error('❌ لم يتم العثور على SQLITECLOUD_URL صالح');
  process.exit(1);
}

const apiKey = urlMatch[1];
console.log(`🔑 تم العثور على API Key: ${apiKey.substring(0, 10)}...`);

// تحديث SQLITECLOUD_USERNAME و SQLITECLOUD_PASSWORD
envContent = envContent.replace(
  /SQLITECLOUD_USERNAME=.*/,
  'SQLITECLOUD_USERNAME=apikey'
);

envContent = envContent.replace(
  /SQLITECLOUD_PASSWORD=.*/,
  `SQLITECLOUD_PASSWORD=${apiKey}`
);

// حفظ الملف المحدث
fs.writeFileSync(envPath, envContent);

console.log('✅ تم تحديث بيانات اعتماد SQLiteCloud');
console.log('📝 التغييرات:');
console.log('   - SQLITECLOUD_USERNAME=apikey');
console.log(`   - SQLITECLOUD_PASSWORD=${apiKey.substring(0, 10)}...`);

console.log('\n🚀 يمكنك الآن تشغيل سكريبت النقل:');
console.log('   node electron/migrate-to-neon.js');
