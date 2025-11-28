#!/usr/bin/env node

/**
 * Fix Timestamp Issues in Users Table
 * إصلاح مشاكل الطوابع الزمنية في جدول المستخدمين
 */

const { Client } = require('pg');
const { Database } = require('@sqlitecloud/drivers');
require('dotenv').config();

async function fixUsersTable() {
  console.log('🔧 إصلاح جدول المستخدمين...');
  console.log('=============================\n');
  
  const client = new Client({
    connectionString: process.env.NEON_CONNECTION_STRING
  });
  
  const sqliteDb = new Database(`sqlitecloud://${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/${process.env.SQLITECLOUD_DATABASE}?apikey=${process.env.SQLITECLOUD_PASSWORD}`);
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بـ Neon');
    
    // تغيير نوع البيانات للأعمدة الزمنية
    console.log('\n📝 تحديث أنواع البيانات الزمنية...');
    await client.query(`
      ALTER TABLE users 
      ALTER COLUMN created_at TYPE TEXT,
      ALTER COLUMN updated_at TYPE TEXT,
      ALTER COLUMN last_login TYPE TEXT
    `);
    console.log('✅ تم تحديث أنواع البيانات الزمنية');
    
    // جلب البيانات من SQLite
    console.log('\n📦 نقل بيانات المستخدمين...');
    const users = await sqliteDb.sql('SELECT * FROM users');
    console.log(`📋 تم جلب ${users.length} مستخدم`);
    
    let inserted = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        // تنظيف البيانات
        const cleanedUser = {
          id: user.id,
          username: user.username,
          password_hash: user.password_hash,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          professor_id: user.professor_id,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login
        };
        
        const columns = Object.keys(cleanedUser);
        const values = Object.values(cleanedUser);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
          INSERT INTO users (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING
        `;
        
        await client.query(query, values);
        inserted++;
        
      } catch (err) {
        errors++;
        console.error(`❌ خطأ في المستخدم ${user.id}: ${err.message}`);
      }
    }
    
    console.log(`\n✅ تم نقل ${inserted}/${users.length} مستخدم`);
    if (errors > 0) {
      console.log(`⚠️ ${errors} أخطاء`);
    }
    
  } catch (err) {
    console.error('❌ خطأ:', err);
    throw err;
  } finally {
    await client.end();
    console.log('🔗 تم قطع الاتصال بـ Neon');
  }
}

// تشغيل الإصلاح
if (require.main === module) {
  fixUsersTable()
    .then(() => {
      console.log('\n✅ تم إصلاح جدول المستخدمين بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { fixUsersTable };
