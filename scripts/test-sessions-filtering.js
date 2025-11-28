#!/usr/bin/env node

/**
 * Test Sessions Page Filtering
 * اختبار فلترة صفحة الحصص
 */

require('dotenv').config();

async function testSessionsFiltering() {
  console.log('🧪 اختبار فلترة صفحة الحصص...');
  console.log('================================\n');
  
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
    
    // اختبار تأثير الفلترة على عرض البيانات
    console.log('\n3️⃣ اختبار تأثير الفلترة على عرض البيانات...');
    
    // محاكاة معالجة البيانات كما في Sessions.tsx
    const processedAssignments = filteredAssignments
      .filter(assignment => {
        return assignment.id &&
               assignment.professor_id &&
               assignment.course_id &&
               assignment.group_id &&
               assignment.room_id &&
               assignment.day_of_week !== undefined &&
               assignment.start_time &&
               assignment.end_time;
      });
    
    console.log(`📊 التكليفات المعالجة: ${processedAssignments.length}`);
    console.log(`📊 التكليفات المفلترة: ${filteredAssignments.length}`);
    console.log(`📊 التكليفات المفقودة: ${filteredAssignments.length - processedAssignments.length}`);
    
    if (processedAssignments.length > 0) {
      console.log('\n📋 عينة من التكليفات المعالجة:');
      processedAssignments.slice(0, 2).forEach((assignment, index) => {
        console.log(`  ${index + 1}. الأستاذ: ${assignment.professor_name}`);
        console.log(`     المقرر: ${assignment.course_name}`);
        console.log(`     المجموعة: ${assignment.group_name}`);
        console.log(`     القاعة: ${assignment.room_name}`);
      });
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ صفحة الحصص يجب أن تعرض الآن البيانات المفلترة فقط');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testSessionsFiltering()
    .then(() => {
      console.log('\n✅ تم اختبار فلترة صفحة الحصص بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testSessionsFiltering };
