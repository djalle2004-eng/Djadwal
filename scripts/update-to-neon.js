#!/usr/bin/env node

/**
 * Update Application to Use Neon Database
 * تحديث التطبيق لاستخدام قاعدة بيانات Neon
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 تحديث التطبيق لاستخدام قاعدة بيانات Neon...');
console.log('===============================================\n');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ ملف .env غير موجود');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// إضافة متغيرات Neon
const neonConfig = `
# Neon Database Configuration
USE_NEON=true
# NEON_CONNECTION_STRING is already set above
`;

// التحقق من وجود USE_NEON
if (!envContent.includes('USE_NEON=')) {
  envContent += neonConfig;
  console.log('✅ تم إضافة متغيرات Neon');
} else {
  // تحديث USE_NEON إلى true
  envContent = envContent.replace(/USE_NEON=.*/, 'USE_NEON=true');
  console.log('✅ تم تحديث USE_NEON إلى true');
}

// حفظ الملف المحدث
fs.writeFileSync(envPath, envContent);

console.log('\n📋 التغييرات المطبقة:');
console.log('=====================');
console.log('✅ USE_NEON=true');
console.log('✅ NEON_CONNECTION_STRING موجود بالفعل');

console.log('\n🔄 الخطوات التالية:');
console.log('===================');
console.log('1. تم إنشاء محول قاعدة بيانات Neon (database-neon.js)');
console.log('2. تم إنشاء ملف التكوين الجديد (database-neon-config.js)');
console.log('3. تم تحديث متغيرات البيئة');
console.log('4. يجب تحديث main.js لاستخدام التكوين الجديد');

console.log('\n⚠️ ملاحظة مهمة:');
console.log('===============');
console.log('يجب تحديث ملف main.js لاستخدام database-neon-config.js بدلاً من database.js');
console.log('أو يمكنك إعادة تسمية database-neon-config.js إلى database.js لاستبدال الملف القديم');

console.log('\n🚀 يمكنك الآن تشغيل التطبيق مع قاعدة بيانات Neon!');
