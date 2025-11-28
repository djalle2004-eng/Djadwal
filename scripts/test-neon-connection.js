#!/usr/bin/env node

/**
 * Test Neon Database Connection
 * اختبار اتصال قاعدة بيانات Neon
 */

require('dotenv').config();
const { initDatabaseConnection, executeQuery, getDepartments, getProfessors, getRooms } = require('../electron/database');

async function testNeonConnection() {
  console.log('🧪 اختبار اتصال قاعدة بيانات Neon...');
  console.log('=====================================\n');
  
  try {
    // اختبار الاتصال الأساسي
    console.log('1️⃣ اختبار الاتصال الأساسي...');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    // اختبار استعلام بسيط
    console.log('\n2️⃣ اختبار استعلام بسيط...');
    const testResult = await executeQuery('SELECT 1 as test, NOW() as current_time');
    console.log('✅ نتيجة الاختبار:', testResult[0]);
    
    // اختبار جلب الأقسام
    console.log('\n3️⃣ اختبار جلب الأقسام...');
    const departments = await getDepartments();
    console.log(`✅ تم جلب ${departments.length} قسم:`);
    departments.forEach(dept => {
      console.log(`   - ${dept.name} (${dept.code || 'بدون كود'})`);
    });
    
    // اختبار جلب الأساتذة
    console.log('\n4️⃣ اختبار جلب الأساتذة...');
    const professors = await getProfessors();
    console.log(`✅ تم جلب ${professors.length} أستاذ`);
    
    // اختبار جلب القاعات
    console.log('\n5️⃣ اختبار جلب القاعات...');
    const rooms = await getRooms();
    console.log(`✅ تم جلب ${rooms.length} قاعة`);
    
    // اختبار إحصائيات عامة
    console.log('\n6️⃣ الإحصائيات العامة...');
    const stats = await executeQuery(`
      SELECT 
        (SELECT COUNT(*) FROM departments) as departments_count,
        (SELECT COUNT(*) FROM professors) as professors_count,
        (SELECT COUNT(*) FROM rooms) as rooms_count,
        (SELECT COUNT(*) FROM courses) as courses_count,
        (SELECT COUNT(*) FROM groups) as groups_count,
        (SELECT COUNT(*) FROM assignments) as assignments_count,
        (SELECT COUNT(*) FROM users) as users_count
    `);
    
    const statsData = stats[0];
    console.log('📊 إحصائيات قاعدة البيانات:');
    console.log(`   - الأقسام: ${statsData.departments_count}`);
    console.log(`   - الأساتذة: ${statsData.professors_count}`);
    console.log(`   - القاعات: ${statsData.rooms_count}`);
    console.log(`   - المقررات: ${statsData.courses_count}`);
    console.log(`   - المجموعات: ${statsData.groups_count}`);
    console.log(`   - الحصص: ${statsData.assignments_count}`);
    console.log(`   - المستخدمين: ${statsData.users_count}`);
    
    console.log('\n🎉 جميع الاختبارات نجحت!');
    console.log('✅ قاعدة بيانات Neon تعمل بشكل صحيح');
    console.log('✅ التطبيق جاهز للاستخدام مع Neon');
    
  } catch (error) {
    console.error('\n❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    
    if (error.message.includes('connection')) {
      console.log('\n💡 اقتراحات لحل المشكلة:');
      console.log('1. تحقق من صحة NEON_CONNECTION_STRING');
      console.log('2. تأكد من أن قاعدة البيانات Neon نشطة');
      console.log('3. تحقق من إعدادات الشبكة والجدار الناري');
    }
    
    process.exit(1);
  }
}

// تشغيل الاختبار
if (require.main === module) {
  testNeonConnection()
    .then(() => {
      console.log('\n✅ تم اختبار الاتصال بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testNeonConnection };
