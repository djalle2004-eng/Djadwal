#!/usr/bin/env node

/**
 * Fix Neon Database Schema
 * إصلاح مخطط قاعدة بيانات Neon
 */

const { Client } = require('pg');
require('dotenv').config();

async function fixNeonSchema() {
  console.log('🔧 إصلاح مخطط قاعدة بيانات Neon...');
  console.log('=====================================\n');
  
  if (!process.env.NEON_CONNECTION_STRING) {
    console.error('❌ متغير البيئة NEON_CONNECTION_STRING غير موجود');
    throw new Error('متغير البيئة NEON_CONNECTION_STRING غير موجود');
  }
  
  const client = new Client({
    connectionString: process.env.NEON_CONNECTION_STRING
  });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بـ Neon');
    
    // إصلاح جدول professors
    console.log('\n📝 إصلاح جدول professors...');
    try {
      await client.query(`
        ALTER TABLE professors 
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS title TEXT,
        ADD COLUMN IF NOT EXISTS academic_title TEXT
      `);
      console.log('✅ تم إضافة الأعمدة المفقودة إلى جدول professors');
    } catch (err) {
      console.log(`⚠️ تحذير في جدول professors: ${err.message}`);
    }
    
    // إصلاح جدول users
    console.log('\n📝 إصلاح جدول users...');
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_login NUMERIC
      `);
      console.log('✅ تم إضافة العمود المفقود إلى جدول users');
    } catch (err) {
      console.log(`⚠️ تحذير في جدول users: ${err.message}`);
    }
    
    // إصلاح جدول assignments - تغيير نوع البيانات للمشاكل
    console.log('\n📝 فحص جدول assignments...');
    try {
      // فحص الأعمدة التي قد تسبب مشاكل
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'assignments' 
        AND column_name IN ('created_at', 'academic_year', 'semester')
      `);
      
      console.log('📋 أعمدة assignments الحالية:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      
      // تغيير نوع البيانات للأعمدة المشكوك فيها
      await client.query(`
        ALTER TABLE assignments 
        ALTER COLUMN created_at TYPE TEXT,
        ALTER COLUMN academic_year TYPE TEXT,
        ALTER COLUMN semester TYPE TEXT
      `);
      console.log('✅ تم تحديث أنواع البيانات في جدول assignments');
      
    } catch (err) {
      console.log(`⚠️ تحذير في جدول assignments: ${err.message}`);
    }
    
    console.log('\n🎉 تم إصلاح المخطط بنجاح!');
    
  } catch (err) {
    console.error('❌ خطأ في إصلاح المخطط:', err);
    throw err;
  } finally {
    await client.end();
    console.log('🔗 تم قطع الاتصال بـ Neon');
  }
}

// تشغيل الإصلاح
if (require.main === module) {
  fixNeonSchema()
    .then(() => {
      console.log('\n✅ تم إصلاح المخطط بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { fixNeonSchema };
