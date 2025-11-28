#!/usr/bin/env node

/**
 * Test Room 10 Assignments for 2025-2026
 * اختبار تكليفات القاعة 10 للسنة الأكاديمية 2025-2026
 */

require('dotenv').config();

async function testRoom10Assignments2025() {
  console.log('🧪 اختبار تكليفات القاعة 10 للسنة الأكاديمية 2025-2026...');
  console.log('================================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ فحص التكليفات العادية للقاعة 10 في الأحد للسنة 2025-2026...');
    
    // جلب البيانات
    const { executeQuery } = require('../electron/database');
    
    // فحص التكليفات العادية للقاعة 10 في الأحد للسنة 2025-2026
    const assignments2025 = await executeQuery('SELECT * FROM assignments WHERE room_id = 11 AND day_of_week = 1 AND academic_year = $1', ['2025-2026']);
    console.log(`📊 التكليفات العادية للقاعة 10 في الأحد للسنة 2025-2026: ${assignments2025.length}`);
    
    if (assignments2025.length > 0) {
      console.log('\n📋 تفاصيل التكليفات العادية للقاعة 10 في الأحد للسنة 2025-2026:');
      assignments2025.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     السنة الأكاديمية: ${assignment.academic_year}`);
        console.log(`     الفصل الدراسي: ${assignment.semester}`);
        console.log(`     التخصص: ${assignment.specialization}`);
        console.log('');
      });
    }
    
    // فحص التكليفات العادية للقاعة 10 في الأحد في التوقيت 09:30-11:00 للسنة 2025-2026
    const assignmentsInTime2025 = await executeQuery('SELECT * FROM assignments WHERE room_id = 11 AND day_of_week = 1 AND academic_year = $1 AND start_time = $2 AND end_time = $3', ['2025-2026', '09:30', '11:00']);
    console.log(`📊 التكليفات العادية للقاعة 10 في الأحد 09:30-11:00 للسنة 2025-2026: ${assignmentsInTime2025.length}`);
    
    if (assignmentsInTime2025.length > 0) {
      console.log('\n📋 التكليفات العادية المتعارضة في التوقيت 09:30-11:00:');
      assignmentsInTime2025.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     السنة الأكاديمية: ${assignment.academic_year}`);
        console.log(`     الفصل الدراسي: ${assignment.semester}`);
        console.log(`     التخصص: ${assignment.specialization}`);
        console.log('');
      });
    }
    
    console.log('\n3️⃣ اختبار توفر القاعة 10 للأحد 02/11/2025...');
    
    // اختبار التاريخ الصحيح
    const testDate = '2025-11-02';
    const sessionDateObj = new Date(testDate + 'T12:00:00');
    const dayOfWeek = sessionDateObj.getDay();
    
    let systemDayOfWeek;
    if (dayOfWeek === 0) { // الأحد
      systemDayOfWeek = 1;
    } else if (dayOfWeek === 6) { // السبت
      systemDayOfWeek = 0;
    } else { // الاثنين إلى الجمعة
      systemDayOfWeek = dayOfWeek + 1;
    }
    
    console.log(`📅 التاريخ: ${testDate}`);
    console.log(`📅 JavaScript dayOfWeek: ${dayOfWeek} (${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dayOfWeek]})`);
    console.log(`📅 System dayOfWeek: ${systemDayOfWeek} (${['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][systemDayOfWeek]})`);
    
    // فحص التكليفات العادية للقاعة 10 في systemDayOfWeek للسنة 2025-2026
    const regularAssignments2025 = await executeQuery('SELECT * FROM assignments WHERE room_id = 11 AND day_of_week = $1 AND academic_year = $2', [systemDayOfWeek, '2025-2026']);
    console.log(`📊 التكليفات العادية للقاعة 10 في systemDayOfWeek ${systemDayOfWeek} للسنة 2025-2026: ${regularAssignments2025.length}`);
    
    // فحص التكليفات العادية في التوقيت 09:30-11:00
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const testStartTime = '09:30';
    const testEndTime = '11:00';
    const newStartMinutes = timeToMinutes(testStartTime);
    const newEndMinutes = timeToMinutes(testEndTime);
    
    const conflictingAssignments = regularAssignments2025.filter(assignment => {
      const assignmentStartMinutes = timeToMinutes(assignment.start_time);
      const assignmentEndMinutes = timeToMinutes(assignment.end_time);
      
      return newStartMinutes < assignmentEndMinutes && newEndMinutes > assignmentStartMinutes;
    });
    
    console.log(`📊 التكليفات العادية المتعارضة للسنة 2025-2026: ${conflictingAssignments.length}`);
    
    if (conflictingAssignments.length > 0) {
      console.log('\n📋 التكليفات العادية المتعارضة للسنة 2025-2026:');
      conflictingAssignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     السنة الأكاديمية: ${assignment.academic_year}`);
        console.log(`     الفصل الدراسي: ${assignment.semester}`);
        console.log(`     التخصص: ${assignment.specialization}`);
        console.log('');
      });
    }
    
    console.log('\n4️⃣ تحليل النتائج...');
    
    if (conflictingAssignments.length > 0) {
      console.log('❌ القاعة 10 غير متاحة للأحد 02/11/2025 من 09:30 إلى 11:00');
      console.log('❌ هناك تكليفات عادية متعارضة للسنة 2025-2026');
      console.log('❌ لا يمكن إضافة حصة تعويضية في هذا التوقيت');
    } else {
      console.log('✅ القاعة 10 متاحة للأحد 02/11/2025 من 09:30 إلى 11:00');
      console.log('✅ لا توجد تكليفات عادية متعارضة للسنة 2025-2026');
      console.log('✅ يمكن إضافة حصة تعويضية في هذا التوقيت');
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ تم تحليل تكليفات القاعة 10 للسنة الأكاديمية 2025-2026');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testRoom10Assignments2025()
    .then(() => {
      console.log('\n✅ تم اختبار تكليفات القاعة 10 للسنة الأكاديمية 2025-2026 بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testRoom10Assignments2025 };


