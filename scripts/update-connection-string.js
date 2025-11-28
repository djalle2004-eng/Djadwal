#!/usr/bin/env node

/**
 * Update SQLiteCloud Connection String
 * تحديث سلسلة اتصال SQLiteCloud
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 تحديث سلسلة اتصال SQLiteCloud...');
console.log('====================================\n');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ ملف .env غير موجود');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// تحديث SQLITECLOUD_URL بالشكل الصحيح
const newUrl = 'sqlitecloud://cjh4w9vank.g4.sqlite.cloud:8860/Djadwal?apikey=78aNzNpDYNpQjJQmPaH6PN7wpdRKe4keSEYiTaxRYyM';

// استبدال أو إضافة SQLITECLOUD_URL
if (envContent.includes('SQLITECLOUD_URL=')) {
  envContent = envContent.replace(/SQLITECLOUD_URL=.*/, `SQLITECLOUD_URL=${newUrl}`);
} else {
  envContent += `\nSQLITECLOUD_URL=${newUrl}`;
}

// تحديث SQLITECLOUD_PASSWORD ليكون فقط API key
envContent = envContent.replace(
  /SQLITECLOUD_PASSWORD=.*/,
  'SQLITECLOUD_PASSWORD=78aNzNpDYNpQjJQmPaH6PN7wpdRKe4keSEYiTaxRYyM'
);

// تحديث SQLITECLOUD_USERNAME
envContent = envContent.replace(
  /SQLITECLOUD_USERNAME=.*/,
  'SQLITECLOUD_USERNAME=apikey'
);

// حفظ الملف المحدث
fs.writeFileSync(envPath, envContent);

console.log('✅ تم تحديث ملف .env');
console.log('📝 التغييرات:');
console.log('   - SQLITECLOUD_URL: sqlitecloud://cjh4w9vank.g4.sqlite.cloud:8860/Djadwal?apikey=***');
console.log('   - SQLITECLOUD_USERNAME: apikey');
console.log('   - SQLITECLOUD_PASSWORD: 78aNzNpDYN...');

console.log('\n🚀 يمكنك الآن تشغيل سكريبت النقل:');
console.log('   node electron/migrate-to-neon.js');
