const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

async function createAdminUser() {
  const client = new Client({
    connectionString: process.env.NEON_CONNECTION_STRING || process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات');

    // توليد hash لكلمة المرور
    const passwordHash = await bcrypt.hash('admin123', 10);
    console.log('🔐 تم توليد hash لكلمة المرور');

    // إنشاء مستخدم جديد أو تحديث الموجود
    const result = await client.query(`
      INSERT INTO users (username, password_hash, full_name, email, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) 
      DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        is_active = EXCLUDED.is_active
      RETURNING id, username, full_name, role
    `, ['admin', passwordHash, 'المدير', 'admin@djadwal.com', 'admin', 1]);

    console.log('✅ تم إنشاء المستخدم بنجاح:');
    console.log(result.rows[0]);
    console.log('\n📝 بيانات الدخول:');
    console.log('   اسم المستخدم: admin');
    console.log('   كلمة المرور: admin123');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await client.end();
  }
}

createAdminUser();
