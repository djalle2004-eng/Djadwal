#!/usr/bin/env node

/**
 * Test Room 10 Sunday Assignments
 * اختبار تكليفات القاعة 10 للأحد
 */

require('dotenv').config();

async function testRoom10SundayAssignments() {
  console.log('🧪 اختبار تكليفات القاعة 10 للأحد...');
  console.log('================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ فحص التكليفات العادية للقاعة 10 في الأحد...');
    
    // جلب البيانات
    const { executeQuery } = require('../electron/database');
    
    // فحص التكليفات العادية للقاعة 10 في الأحد
    const sundayAssignments = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE room_id = 11 AND day_of_week = 1');
    console.log(`📊 التكليفات العادية للقاعة 10 في الأحد: ${sundayAssignments[0].count}`);
    
    // فحص التكليفات العادية للقاعة 10 في الأحد في التوقيت 09:30-11:00
    const sundayAssignmentsInTime = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE room_id = 11 AND day_of_week = 1 AND start_time = $1 AND end_time = $2', ['09:30', '11:00']);
    console.log(`📊 التكليفات العادية للقاعة 10 في الأحد 09:30-11:00: ${sundayAssignmentsInTime[0].count}`);
    
    console.log('\n3️⃣ تحليل التكليفات العادية للقاعة 10 في الأحد...');
    
    if (sundayAssignments[0].count > 0) {
      // جلب تفاصيل التكليفات العادية للقاعة 10 في الأحد
      const assignmentsDetails = await executeQuery(`
        SELECT a.*, p.name as professor_name, c.name as course_name, g.name as group_name
        FROM assignments a
        LEFT JOIN professors p ON a.professor_id = p.id
        LEFT JOIN courses c ON a.course_id = c.id
        LEFT JOIN groups g ON a.group_id = g.id
        WHERE a.room_id = 11 AND a.day_of_week = 1
        ORDER BY a.start_time
      `);
      
      console.log(`📋 تفاصيل التكليفات العادية للقاعة 10 في الأحد:`);
      assignmentsDetails.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     الأستاذ: ${assignment.professor_name}`);
        console.log(`     المقرر: ${assignment.course_name}`);
        console.log(`     المجموعة: ${assignment.group_name}`);
        console.log('');
      });
    }
    
    console.log('\n4️⃣ اختبار توفر القاعة 10 للأحد 02/11/2025...');
    
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
    
    // فحص التكليفات العادية للقاعة 10 في systemDayOfWeek
    const regularAssignments = await executeQuery('SELECT * FROM assignments WHERE room_id = 11 AND day_of_week = $1', [systemDayOfWeek]);
    console.log(`📊 التكليفات العادية للقاعة 10 في systemDayOfWeek ${systemDayOfWeek}: ${regularAssignments.length}`);
    
    // فحص التكليفات العادية في التوقيت 09:30-11:00
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const testStartTime = '09:30';
    const testEndTime = '11:00';
    const newStartMinutes = timeToMinutes(testStartTime);
    const newEndMinutes = timeToMinutes(testEndTime);
    
    const conflictingAssignments = regularAssignments.filter(assignment => {
      const assignmentStartMinutes = timeToMinutes(assignment.start_time);
      const assignmentEndMinutes = timeToMinutes(assignment.end_time);
      
      return newStartMinutes < assignmentEndMinutes && newEndMinutes > assignmentStartMinutes;
    });
    
    console.log(`📊 التكليفات العادية المتعارضة: ${conflictingAssignments.length}`);
    
    if (conflictingAssignments.length > 0) {
      console.log('\n📋 التكليفات العادية المتعارضة:');
      conflictingAssignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     الأستاذ: ${assignment.professor_name}`);
        console.log(`     المقرر: ${assignment.course_name}`);
        console.log(`     المجموعة: ${assignment.group_name}`);
        console.log('');
      });
    }
    
    console.log('\n5️⃣ تحليل النتائج...');
    
    if (conflictingAssignments.length > 0) {
      console.log('❌ القاعة 10 غير متاحة للأحد 02/11/2025 من 09:30 إلى 11:00');
      console.log('❌ هناك تكليفات عادية متعارضة');
      console.log('❌ لا يمكن إضافة حصة تعويضية في هذا التوقيت');
    } else {
      console.log('✅ القاعة 10 متاحة للأحد 02/11/2025 من 09:30 إلى 11:00');
      console.log('✅ لا توجد تكليفات عادية متعارضة');
      console.log('✅ يمكن إضافة حصة تعويضية في هذا التوقيت');
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ تم تحليل تكليفات القاعة 10 للأحد');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testRoom10SundayAssignments()
    .then(() => {
      console.log('\n✅ تم اختبار تكليفات القاعة 10 للأحد بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testRoom10SundayAssignments };


