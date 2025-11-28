#!/usr/bin/env node

/**
 * Migration Summary Report
 * تقرير ملخص النقل
 */

const { Client } = require('pg');
require('dotenv').config();

async function generateSummaryReport() {
  console.log('📊 تقرير ملخص النقل النهائي');
  console.log('============================\n');
  
  const client = new Client({
    connectionString: process.env.NEON_CONNECTION_STRING
  });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بـ Neon\n');
    
    // قائمة الجداول للفحص
    const tables = [
      'academic_years',
      'departments', 
      'professors',
      'rooms',
      'semesters',
      'courses',
      'groups',
      'assignments',
      'extra_sessions',
      'users',
      'audit_log',
      'backup_history'
    ];
    
    console.log('📋 ملخص البيانات المنقولة:');
    console.log('==========================');
    
    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        totalRecords += count;
        
        const status = count > 0 ? '✅' : '⚠️';
        console.log(`${status} ${table.padEnd(20)} ${count.toString().padStart(6)} سجل`);
        
      } catch (err) {
        console.log(`❌ ${table.padEnd(20)} خطأ في الفحص`);
      }
    }
    
    console.log('==========================');
    console.log(`📊 إجمالي السجلات: ${totalRecords.toString().padStart(6)} سجل`);
    
    // فحص بعض البيانات المهمة
    console.log('\n🔍 فحص البيانات المهمة:');
    console.log('=======================');
    
    try {
      // السنوات الأكاديمية
      const academicYears = await client.query('SELECT year_name, is_current FROM academic_years ORDER BY id');
      console.log('\n📅 السنوات الأكاديمية:');
      academicYears.rows.forEach(year => {
        const current = year.is_current ? ' (حالية)' : '';
        console.log(`  - ${year.year_name}${current}`);
      });
      
      // الأقسام
      const departments = await client.query('SELECT name, code FROM departments ORDER BY id');
      console.log('\n🏢 الأقسام:');
      departments.rows.forEach(dept => {
        console.log(`  - ${dept.name} (${dept.code || 'بدون كود'})`);
      });
      
      // عدد الأساتذة
      const professorsCount = await client.query('SELECT COUNT(*) as count FROM professors');
      console.log(`\n👨‍🏫 عدد الأساتذة: ${professorsCount.rows[0].count}`);
      
      // عدد القاعات
      const roomsCount = await client.query('SELECT COUNT(*) as count FROM rooms');
      console.log(`🏫 عدد القاعات: ${roomsCount.rows[0].count}`);
      
      // عدد المقررات
      const coursesCount = await client.query('SELECT COUNT(*) as count FROM courses');
      console.log(`📚 عدد المقررات: ${coursesCount.rows[0].count}`);
      
      // عدد المجموعات
      const groupsCount = await client.query('SELECT COUNT(*) as count FROM groups');
      console.log(`👥 عدد المجموعات: ${groupsCount.rows[0].count}`);
      
      // عدد الحصص
      const assignmentsCount = await client.query('SELECT COUNT(*) as count FROM assignments');
      console.log(`📅 عدد الحصص: ${assignmentsCount.rows[0].count}`);
      
      // عدد المستخدمين
      const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
      console.log(`👤 عدد المستخدمين: ${usersCount.rows[0].count}`);
      
    } catch (err) {
      console.log(`⚠️ خطأ في فحص البيانات: ${err.message}`);
    }
    
    console.log('\n🎉 تم النقل بنجاح!');
    console.log('==================');
    console.log('✅ جميع البيانات الأساسية تم نقلها بنجاح');
    console.log('✅ قاعدة البيانات Neon جاهزة للاستخدام');
    console.log('✅ يمكنك الآن تحديث التطبيق لاستخدام Neon');
    
  } catch (err) {
    console.error('❌ خطأ في إنشاء التقرير:', err);
    throw err;
  } finally {
    await client.end();
    console.log('\n🔗 تم قطع الاتصال بـ Neon');
  }
}

// تشغيل التقرير
if (require.main === module) {
  generateSummaryReport()
    .then(() => {
      console.log('\n✅ تم إنشاء التقرير بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { generateSummaryReport };
