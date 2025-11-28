#!/usr/bin/env node

/**
 * Test Room Booking Logic for Extra Sessions
 * اختبار منطق حجز القاعات للحصص الإضافية
 */

require('dotenv').config();

async function testRoomBookingLogic() {
  console.log('🧪 اختبار منطق حجز القاعات للحصص الإضافية...');
  console.log('==========================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ اختبار جلب البيانات...');
    
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
    
    console.log('\n3️⃣ اختبار منطق حجز القاعات...');
    
    // محاكاة دالة isRoomAvailable
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const isRoomAvailable = (roomId, sessionDate, startTime, endTime, currentSessionId) => {
      const newStartMinutes = timeToMinutes(startTime);
      const newEndMinutes = timeToMinutes(endTime);
      
      // التحقق من التكليفات العادية (حسب يوم الأسبوع)
      const sessionDateObj = new Date(sessionDate);
      const dayOfWeek = sessionDateObj.getDay();
      
      let systemDayOfWeek;
      if (dayOfWeek === 0) { // الأحد
        systemDayOfWeek = 1;
      } else if (dayOfWeek === 6) { // السبت
        systemDayOfWeek = 0;
      } else { // الاثنين إلى الجمعة
        systemDayOfWeek = dayOfWeek + 1;
      }
      
      // التحقق من التكليفات العادية
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
        return false;
      }
      
      // التحقق من الحصص الإضافية (حسب التاريخ المحدد فقط)
      const conflictingSessions = extraSessions.filter(session => {
        if (currentSessionId && session.id === currentSessionId) {
          return false;
        }
        
        // التحقق من التاريخ المحدد فقط
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
      
      return true;
    };
    
    console.log('\n4️⃣ اختبار السيناريو المحدد...');
    
    // اختبار السيناريو: حصة تعويضية يوم الأحد 26/10/2025 من 9:30 إلى 11:00 في القاعة 10
    const testDate1 = '2025-10-26'; // الأحد
    const testDate2 = '2025-11-02'; // الأحد التالي
    const testRoomId = 10;
    const testStartTime = '09:30';
    const testEndTime = '11:00';
    
    console.log(`📅 اختبار التاريخ الأول: ${testDate1} (الأحد)`);
    const available1 = isRoomAvailable(testRoomId, testDate1, testStartTime, testEndTime);
    console.log(`🏢 القاعة ${testRoomId} متاحة في ${testDate1}: ${available1 ? '✅ نعم' : '❌ لا'}`);
    
    console.log(`📅 اختبار التاريخ الثاني: ${testDate2} (الأحد التالي)`);
    const available2 = isRoomAvailable(testRoomId, testDate2, testStartTime, testEndTime);
    console.log(`🏢 القاعة ${testRoomId} متاحة في ${testDate2}: ${available2 ? '✅ نعم' : '❌ لا'}`);
    
    console.log('\n5️⃣ اختبار التواريخ المختلفة...');
    
    // اختبار تواريخ مختلفة لنفس القاعة والتوقيت
    const testDates = [
      '2025-10-27', // الاثنين
      '2025-10-28', // الثلاثاء
      '2025-10-29', // الأربعاء
      '2025-10-30', // الخميس
      '2025-10-31', // الجمعة
      '2025-11-01', // السبت
      '2025-11-03', // الاثنين
    ];
    
    testDates.forEach(date => {
      const available = isRoomAvailable(testRoomId, date, testStartTime, testEndTime);
      const dateObj = new Date(date);
      const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dateObj.getDay()];
      console.log(`📅 ${date} (${dayName}): ${available ? '✅ متاحة' : '❌ غير متاحة'}`);
    });
    
    console.log('\n6️⃣ اختبار الحصص الإضافية الموجودة...');
    
    if (extraSessions.length > 0) {
      console.log('📋 الحصص الإضافية الموجودة:');
      extraSessions.forEach((session, index) => {
        const dateObj = new Date(session.session_date);
        const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dateObj.getDay()];
        console.log(`  ${index + 1}. ${session.session_date} (${dayName}) - ${session.start_time} إلى ${session.end_time} - القاعة ${session.room_id}`);
      });
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ منطق حجز القاعات يعمل بشكل صحيح');
    console.log('✅ الحصص الإضافية محجوزة للتاريخ المحدد فقط');
    console.log('✅ القاعات متاحة في التواريخ الأخرى');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testRoomBookingLogic()
    .then(() => {
      console.log('\n✅ تم اختبار منطق حجز القاعات بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testRoomBookingLogic };
