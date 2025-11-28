#!/usr/bin/env node

/**
 * Test Room Availability for Next Week
 * اختبار توفر القاعات للأسبوع الموالي
 */

require('dotenv').config();

async function testRoomAvailabilityNextWeek() {
  console.log('🧪 اختبار توفر القاعات للأسبوع الموالي...');
  console.log('=====================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ جلب البيانات...');
    
    // جلب البيانات
    const { getExtraSessions, getAssignments, getRooms } = require('../electron/database');
    const [extraSessions, regularAssignments, rooms] = await Promise.all([
      getExtraSessions(),
      getAssignments(),
      getRooms()
    ]);
    
    console.log(`📊 الحصص الإضافية: ${extraSessions.length}`);
    console.log(`📊 التكليفات العادية: ${regularAssignments.length}`);
    console.log(`📊 القاعات: ${rooms.length}`);
    
    console.log('\n3️⃣ تحليل التكليفات العادية للأحد...');
    
    // تحليل التكليفات العادية للأحد (day_of_week = 1)
    const sundayAssignments = regularAssignments.filter(assignment => assignment.day_of_week === 1);
    console.log(`📊 التكليفات العادية للأحد: ${sundayAssignments.length}`);
    
    if (sundayAssignments.length > 0) {
      console.log('\n📋 عينة من التكليفات العادية للأحد:');
      sundayAssignments.slice(0, 5).forEach((assignment, index) => {
        const room = rooms.find(r => r.id === assignment.room_id);
        console.log(`  ${index + 1}. القاعة: ${room ? room.name : 'غير موجود'} (ID: ${assignment.room_id})`);
        console.log(`     التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     الأستاذ: ${assignment.professor_name}`);
        console.log(`     المقرر: ${assignment.course_name}`);
        console.log('');
      });
    }
    
    console.log('\n4️⃣ اختبار توفر القاعات للأسبوع الموالي...');
    
    // محاكاة دالة isRoomAvailable
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const isRoomAvailable = (roomId, sessionDate, startTime, endTime, currentSessionId) => {
      const newStartMinutes = timeToMinutes(startTime);
      const newEndMinutes = timeToMinutes(endTime);
      
      // التحقق من الحصص الإضافية (حسب التاريخ المحدد فقط)
      const conflictingSessions = extraSessions.filter(session => {
        if (currentSessionId && session.id === currentSessionId) {
          return false;
        }
        
        if (session.session_date !== sessionDate || session.room_id !== roomId) {
          return false;
        }
        
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
      
      const conflictingRegularAssignments = regularAssignments.filter(assignment => {
        if (assignment.day_of_week !== systemDayOfWeek || assignment.room_id !== roomId) {
          return false;
        }
        
        const assignmentStartMinutes = timeToMinutes(assignment.start_time);
        const assignmentEndMinutes = timeToMinutes(assignment.end_time);
        
        return newStartMinutes < assignmentEndMinutes && newEndMinutes > assignmentStartMinutes;
      });
      
      if (conflictingRegularAssignments.length > 0) {
        console.log(`❌ تعارض مع التكليفات العادية: ${conflictingRegularAssignments.length}`);
        conflictingRegularAssignments.forEach(conflict => {
          console.log(`   تعارض مع: ${conflict.start_time} - ${conflict.end_time} (${conflict.professor_name})`);
        });
        return false;
      }
      
      return true;
    };
    
    // اختبار القاعات للأسبوع الموالي
    const testDate = '2025-11-02'; // الأحد الموالي
    const testStartTime = '09:30';
    const testEndTime = '11:00';
    
    console.log(`📅 اختبار التاريخ: ${testDate} (الأحد الموالي)`);
    console.log(`⏰ اختبار التوقيت: ${testStartTime} - ${testEndTime}`);
    console.log('');
    
    // اختبار القاعات المختلفة
    const testRooms = [6, 7, 10, 11, 15, 20];
    testRooms.forEach(roomId => {
      console.log(`\n🏢 اختبار القاعة ${roomId}:`);
      const available = isRoomAvailable(roomId, testDate, testStartTime, testEndTime);
      const room = rooms.find(r => r.id === roomId);
      const roomName = room ? room.name : `القاعة ${roomId}`;
      console.log(`   ${roomName}: ${available ? '✅ متاحة' : '❌ غير متاحة'}`);
    });
    
    console.log('\n5️⃣ اختبار القاعات المتاحة للأسبوع الموالي...');
    
    const availableRooms = [];
    testRooms.forEach(roomId => {
      const available = isRoomAvailable(roomId, testDate, testStartTime, testEndTime);
      if (available) {
        const room = rooms.find(r => r.id === roomId);
        const roomName = room ? room.name : `القاعة ${roomId}`;
        availableRooms.push({ id: roomId, name: roomName });
      }
    });
    
    console.log(`📊 القاعات المتاحة للأسبوع الموالي: ${availableRooms.length}`);
    availableRooms.forEach(room => {
      console.log(`   ✅ ${room.name} (ID: ${room.id})`);
    });
    
    console.log('\n6️⃣ تحليل التكليفات العادية للأحد...');
    
    // تحليل التكليفات العادية للأحد في التوقيت المحدد
    const sundayAssignmentsInTime = sundayAssignments.filter(assignment => {
      const assignmentStartMinutes = timeToMinutes(assignment.start_time);
      const assignmentEndMinutes = timeToMinutes(assignment.end_time);
      const testStartMinutes = timeToMinutes(testStartTime);
      const testEndMinutes = timeToMinutes(testEndTime);
      
      return testStartMinutes < assignmentEndMinutes && testEndMinutes > assignmentStartMinutes;
    });
    
    console.log(`📊 التكليفات العادية للأحد في التوقيت ${testStartTime}-${testEndTime}: ${sundayAssignmentsInTime.length}`);
    
    if (sundayAssignmentsInTime.length > 0) {
      console.log('\n📋 التكليفات العادية المتعارضة:');
      sundayAssignmentsInTime.forEach((assignment, index) => {
        const room = rooms.find(r => r.id === assignment.room_id);
        console.log(`  ${index + 1}. القاعة: ${room ? room.name : 'غير موجود'} (ID: ${assignment.room_id})`);
        console.log(`     التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     الأستاذ: ${assignment.professor_name}`);
        console.log(`     المقرر: ${assignment.course_name}`);
        console.log('');
      });
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ تم تحليل توفر القاعات للأسبوع الموالي');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testRoomAvailabilityNextWeek()
    .then(() => {
      console.log('\n✅ تم اختبار توفر القاعات للأسبوع الموالي بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testRoomAvailabilityNextWeek };
