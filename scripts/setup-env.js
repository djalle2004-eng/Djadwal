#!/usr/bin/env node

/**
 * Environment Setup Helper
 * مساعد إعداد متغيرات البيئة
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 مساعد إعداد متغيرات البيئة');
console.log('================================\n');

// قالب ملف .env
const envTemplate = `# SQLiteCloud Configuration
# استبدل هذه القيم بمعلومات SQLiteCloud الخاصة بك
SQLITECLOUD_HOST=your-host.sqlite.cloud
SQLITECLOUD_PORT=8860
SQLITECLOUD_DATABASE=your-database-name
SQLITECLOUD_USERNAME=your-api-key
SQLITECLOUD_PASSWORD=your-api-secret

# Neon PostgreSQL Configuration
# استبدل بمسار الاتصال الخاص بـ Neon
NEON_CONNECTION_STRING=postgresql://username:password@host:port/database?sslmode=require

# مثال:
# SQLITECLOUD_HOST=cjh4w9vank.g4.sqlite.cloud
# SQLITECLOUD_PORT=8860
# SQLITECLOUD_DATABASE=my-database
# SQLITECLOUD_USERNAME=my-api-key
# SQLITECLOUD_PASSWORD=my-api-secret
# NEON_CONNECTION_STRING=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
`;

const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  console.log('⚠️ ملف .env موجود بالفعل');
  console.log('هل تريد استبداله؟ (y/n)');
  
  // في بيئة غير تفاعلية، نعرض المحتوى فقط
  console.log('\n📄 محتوى ملف .env الحالي:');
  console.log('========================');
  console.log(fs.readFileSync(envPath, 'utf8'));
} else {
  console.log('📝 إنشاء ملف .env جديد...');
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ تم إنشاء ملف .env');
}

console.log('\n📋 خطوات الإعداد:');
console.log('==================');
console.log('1. افتح ملف .env في محرر النصوص');
console.log('2. استبدل القيم الافتراضية بمعلوماتك الحقيقية:');
console.log('   - SQLITECLOUD_HOST: عنوان خادم SQLiteCloud');
console.log('   - SQLITECLOUD_DATABASE: اسم قاعدة البيانات');
console.log('   - SQLITECLOUD_USERNAME: مفتاح API');
console.log('   - SQLITECLOUD_PASSWORD: سر API');
console.log('   - NEON_CONNECTION_STRING: رابط اتصال Neon');
console.log('3. احفظ الملف');
console.log('4. شغل سكريبت النقل مرة أخرى');

console.log('\n🔗 روابط مفيدة:');
console.log('===============');
console.log('- SQLiteCloud Dashboard: https://sqlitecloud.com/dashboard');
console.log('- Neon Console: https://console.neon.tech/');
console.log('- دليل SQLiteCloud: https://docs.sqlitecloud.com/');

console.log('\n📞 إذا كنت تحتاج مساعدة في الحصول على هذه المعلومات،');
console.log('   تحقق من لوحات التحكم الخاصة بك في SQLiteCloud و Neon.');
