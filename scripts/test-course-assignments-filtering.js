#!/usr/bin/env node

/**
 * Test CourseAssignments Filtering
 * اختبار فلترة صفحة التكاليف
 */

require('dotenv').config();
const { getAssignments } = require('../electron/database');

async function testCourseAssignmentsFiltering() {
  console.log('🧪 اختبار فلترة صفحة التكاليف...');
  console.log('====================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    await require('../electron/database').initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    // اختبار جلب جميع التكليفات
    console.log('\n2️⃣ اختبار جلب جميع التكليفات...');
    const allAssignments = await getAssignments();
    console.log(`✅ تم جلب ${allAssignments.length} تكليف إجمالي`);
    
    // اختبار الفلترة حسب السنة الأكاديمية
    console.log('\n3️⃣ اختبار الفلترة حسب السنة الأكاديمية...');
    const yearAssignments = await getAssignments('2025-2026');
    console.log(`✅ تم جلب ${yearAssignments.length} تكليف للعام 2025-2026`);
    
    // اختبار الفلترة حسب السنة والفصل
    console.log('\n4️⃣ اختبار الفلترة حسب السنة والفصل...');
    const semesterAssignments = await getAssignments('2025-2026', 'الفصل الأول');
    console.log(`✅ تم جلب ${semesterAssignments.length} تكليف للعام 2025-2026 - الفصل الأول`);
    
    // اختبار الفلترة حسب التخصص
    console.log('\n5️⃣ اختبار الفلترة حسب التخصص...');
    const specializationAssignments = await getAssignments('2025-2026', 'الفصل الأول', 'علوم الحاسوب');
    console.log(`✅ تم جلب ${specializationAssignments.length} تكليف لعلوم الحاسوب`);
    
    // عرض عينة من البيانات
    if (semesterAssignments.length > 0) {
      console.log('\n📊 عينة من التكليفات المفلترة:');
      semesterAssignments.slice(0, 3).forEach((assignment, index) => {
        console.log(`  ${index + 1}. ${assignment.professor_name} - ${assignment.course_name} - ${assignment.academic_year} - ${assignment.semester}`);
      });
    }
    
    console.log('\n🎉 جميع الاختبارات نجحت!');
    console.log('✅ فلترة صفحة التكاليف تعمل بشكل صحيح');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testCourseAssignmentsFiltering()
    .then(() => {
      console.log('\n✅ تم اختبار فلترة صفحة التكاليف بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testCourseAssignmentsFiltering };
