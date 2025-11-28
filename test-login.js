const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

async function testLogin() {
  const client = new Client({
    connectionString: process.env.NEON_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات');

    // جلب المستخدم admin
    const result = await client.query("SELECT * FROM users WHERE username = 'admin'");
    
    if (result.rows.length === 0) {
      console.log('❌ المستخدم admin غير موجود');
      return;
    }

    const user = result.rows[0];
    console.log('\n📋 بيانات المستخدم:');
    console.log('   ID:', user.id);
    console.log('   Username:', user.username);
    console.log('   Is Active:', user.is_active);
    console.log('   Hash (first 30 chars):', user.password_hash.substring(0, 30));

    // اختبار كلمة المرور
    const testPassword = 'admin123';
    console.log('\n🔐 اختبار كلمة المرور:', testPassword);
    
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log('✅ النتيجة:', isValid ? 'كلمة المرور صحيحة ✓' : 'كلمة المرور خاطئة ✗');

    if (!isValid) {
      console.log('\n🔧 سأحاول إنشاء hash جديد...');
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('New hash:', newHash.substring(0, 30) + '...');
      
      await client.query('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, 'admin']);
      console.log('✅ تم تحديث كلمة المرور بنجاح!');
      console.log('🔄 حاول تسجيل الدخول مرة أخرى');
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

testLogin();
