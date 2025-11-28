#!/usr/bin/env node

/**
 * Test Room 10 Availability for Sunday
 * اختبار توفر القاعة 10 للأحد
 */

require('dotenv').config();

async function testRoom10Availability() {
  console.log('🧪 اختبار توفر القاعة 10 للأحد 02/11/2025...');
  console.log('==========================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ فحص القاعة 10 (ID: 11) للأحد...');
    
    // جلب البيانات
    const { executeQuery } = require('../electron/database');
    
    // فحص التكليفات العادية للقاعة 10 في الأحد
    const sundayAssignments = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE room_id = 11 AND day_of_week = 1');
    console.log(`📊 التكليفات العادية للقاعة 10 في الأحد: ${sundayAssignments[0].count}`);
    
    // فحص التكليفات العادية للقاعة 10 في الأحد في التوقيت 09:30-11:00
    const sundayAssignmentsInTime = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE room_id = 11 AND day_of_week = 1 AND start_time = $1 AND end_time = $2', ['09:30', '11:00']);
    console.log(`📊 التكليفات العادية للقاعة 10 في الأحد 09:30-11:00: ${sundayAssignmentsInTime[0].count}`);
    
    // فحص الحصص الإضافية للقاعة 10 في التاريخ 2025-11-02
    const extraSessions = await executeQuery('SELECT COUNT(*) as count FROM extra_sessions WHERE room_id = 11 AND session_date = $1', ['2025-11-02']);
    console.log(`📊 الحصص الإضافية للقاعة 10 في 2025-11-02: ${extraSessions[0].count}`);
    
    console.log('\n3️⃣ تحليل التكليفات العادية للقاعة 10...');
    
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
    
    // محاكاة دالة isRoomAvailable
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const isRoomAvailable = async (roomId, sessionDate, startTime, endTime) => {
      const newStartMinutes = timeToMinutes(startTime);
      const newEndMinutes = timeToMinutes(endTime);
      
      // التحقق من الحصص الإضافية (حسب التاريخ المحدد فقط)
      const extraSessions = await executeQuery('SELECT * FROM extra_sessions WHERE room_id = $1 AND session_date = $2', [roomId, sessionDate]);
      
      const conflictingSessions = extraSessions.filter(session => {
        const sessionStartMinutes = timeToMinutes(session.start_time);
        const sessionEndMinutes = timeToMinutes(session.end_time);
        
        return newStartMinutes < sessionEndMinutes && newEndMinutes > sessionStartMinutes;
      });
      
      if (conflictingSessions.length > 0) {
        console.log(`❌ تعارض مع الحصص الإضافية: ${conflictingSessions.length}`);
        return false;
      }
      
      // التحقق من التكليفات العادية (حسب يوم الأسبوع)
      const sessionDateObj = new Date(sessionDate);
      const dayOfWeek = sessionDateObj.getDay(); // 0 = الأحد، 1 = الاثنين، إلخ
      
      let systemDayOfWeek;
      if (dayOfWeek === 0) { // الأحد
        systemDayOfWeek = 1;
      } else if (dayOfWeek === 6) { // السبت
        systemDayOfWeek = 0;
      } else { // الاثنين إلى الجمعة
        systemDayOfWeek = dayOfWeek + 1;
      }
      
      console.log(`📅 التاريخ: ${sessionDate}, JS dayOfWeek: ${dayOfWeek}, System dayOfWeek: ${systemDayOfWeek}`);
      
      const regularAssignments = await executeQuery('SELECT * FROM assignments WHERE room_id = $1 AND day_of_week = $2', [roomId, systemDayOfWeek]);
      
      const conflictingRegularAssignments = regularAssignments.filter(assignment => {
        const assignmentStartMinutes = timeToMinutes(assignment.start_time);
        const assignmentEndMinutes = timeToMinutes(assignment.end_time);
        
        return newStartMinutes < assignmentEndMinutes && newEndMinutes > assignmentStartMinutes;
      });
      
      if (conflictingRegularAssignments.length > 0) {
        console.log(`❌ تعارض مع التكليفات العادية: ${conflictingRegularAssignments.length}`);
        conflictingRegularAssignments.forEach(conflict => {
          console.log(`   تعارض مع: ${conflict.start_time} - ${conflict.end_time}`);
        });
        return false;
      }
      
      return true;
    };
    
    // اختبار القاعة 10 للأحد 02/11/2025
    const testDate = '2025-11-02';
    const testStartTime = '09:30';
    const testEndTime = '11:00';
    const roomId = 11; // القاعة 10
    
    console.log(`📅 اختبار القاعة 10 (ID: ${roomId}) للأحد ${testDate}`);
    console.log(`⏰ التوقيت: ${testStartTime} - ${testEndTime}`);
    console.log('');
    
    const available = await isRoomAvailable(roomId, testDate, testStartTime, testEndTime);
    console.log(`🏢 القاعة 10: ${available ? '✅ متاحة' : '❌ غير متاحة'}`);
    
    console.log('\n5️⃣ تحليل النتائج...');
    
    if (available) {
      console.log('✅ القاعة 10 متاحة للأحد 02/11/2025 من 09:30 إلى 11:00');
      console.log('✅ يمكن إضافة حصة تعويضية في هذا التوقيت');
    } else {
      console.log('❌ القاعة 10 غير متاحة للأحد 02/11/2025 من 09:30 إلى 11:00');
      console.log('❌ لا يمكن إضافة حصة تعويضية في هذا التوقيت');
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ تم تحليل توفر القاعة 10 للأحد');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testRoom10Availability()
    .then(() => {
      console.log('\n✅ تم اختبار توفر القاعة 10 للأحد بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testRoom10Availability };


