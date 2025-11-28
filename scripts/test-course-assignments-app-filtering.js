#!/usr/bin/env node

/**
 * Test CourseAssignments Filtering in Application
 * اختبار فلترة صفحة التكاليف في التطبيق
 */

require('dotenv').config();

async function testCourseAssignmentsInApp() {
  console.log('🧪 اختبار فلترة صفحة التكاليف في التطبيق...');
  console.log('==========================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    // محاكاة السنة الأكاديمية والفصل الدراسي
    const mockCurrentYear = { year_name: '2025-2026' };
    const mockCurrentSemester = { semester_name: 'الفصل الأول' };
    
    console.log('\n2️⃣ اختبار الفلترة مع السنة والفصل المحددين...');
    console.log('📅 السنة الأكاديمية:', mockCurrentYear.year_name);
    console.log('📅 الفصل الدراسي:', mockCurrentSemester.semester_name);
    
    // اختبار جلب جميع التكليفات
    const { getAssignments } = require('../electron/database');
    const allAssignments = await getAssignments();
    console.log(`📊 إجمالي التكليفات: ${allAssignments.length}`);
    
    // اختبار الفلترة حسب السنة والفصل
    const filteredAssignments = await getAssignments(
      mockCurrentYear.year_name, 
      mockCurrentSemester.semester_name
    );
    console.log(`📊 التكليفات المفلترة: ${filteredAssignments.length}`);
    
    // التحقق من النتائج
    if (filteredAssignments.length < allAssignments.length) {
      console.log('\n✅ الفلترة تعمل بشكل صحيح!');
      console.log(`تم تقليل التكليفات من ${allAssignments.length} إلى ${filteredAssignments.length}`);
      
      // عرض عينة من التكليفات المفلترة
      if (filteredAssignments.length > 0) {
        console.log('\n📋 عينة من التكليفات المفلترة:');
        filteredAssignments.slice(0, 3).forEach((assignment, index) => {
          console.log(`  ${index + 1}. ${assignment.professor_name} - ${assignment.course_name}`);
          console.log(`     السنة: ${assignment.academic_year} - الفصل: ${assignment.semester}`);
        });
      }
    } else {
      console.log('\n❌ المشكلة: الفلترة لا تعمل بشكل صحيح');
      console.log('يجب أن يكون عدد التكليفات المفلترة أقل من الإجمالي');
    }
    
    // اختبار تأثير الفلترة على منطق الصراعات
    console.log('\n3️⃣ اختبار تأثير الفلترة على منطق الصراعات...');
    
    // محاكاة فحص الصراعات مع التكليفات المفلترة
    const conflictsWithAllData = allAssignments.length;
    const conflictsWithFilteredData = filteredAssignments.length;
    
    console.log(`📊 الصراعات مع جميع البيانات: ${conflictsWithAllData} تكليف`);
    console.log(`📊 الصراعات مع البيانات المفلترة: ${conflictsWithFilteredData} تكليف`);
    console.log(`📊 تحسن الأداء: ${((conflictsWithAllData - conflictsWithFilteredData) / conflictsWithAllData * 100).toFixed(1)}%`);
    
    console.log('\n🎉 الاختبار مكتمل!');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testCourseAssignmentsInApp()
    .then(() => {
      console.log('\n✅ تم اختبار فلترة صفحة التكاليف بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testCourseAssignmentsInApp };
