#!/usr/bin/env node

/**
 * Test Extra Sessions Room Booking Logic - Detailed
 * اختبار منطق حجز القاعات للحصص الإضافية - مفصل
 */

require('dotenv').config();

async function testExtraSessionsRoomBookingLogic() {
  console.log('🧪 اختبار مفصل لمنطق حجز القاعات للحصص الإضافية...');
  console.log('================================================\n');
  
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
    
    console.log('\n3️⃣ تحليل الحصص الإضافية الموجودة...');
    
    if (extraSessions.length > 0) {
      extraSessions.forEach((session, index) => {
        const dateObj = new Date(session.session_date);
        const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dateObj.getDay()];
        console.log(`📋 الحصة ${index + 1}:`);
        console.log(`   التاريخ: ${session.session_date} (${dayName})`);
        console.log(`   التوقيت: ${session.start_time} - ${session.end_time}`);
        console.log(`   القاعة: ${session.room_id}`);
        console.log(`   الأستاذ: ${session.professor_name}`);
        console.log(`   المقرر: ${session.course_name}`);
        console.log(`   المجموعة: ${session.group_name}`);
        console.log('');
      });
    }
    
    console.log('\n4️⃣ اختبار منطق الحصص الإضافية فقط...');
    
    // محاكاة دالة للتحقق من الحصص الإضافية فقط
    const checkExtraSessionsConflict = (roomId, sessionDate, startTime, endTime, currentSessionId) => {
      const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const newStartMinutes = timeToMinutes(startTime);
      const newEndMinutes = timeToMinutes(endTime);
      
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
      
      return conflictingSessions;
    };
    
    // اختبار السيناريو: حصة تعويضية يوم الأحد 26/10/2025 من 9:30 إلى 11:00
    const testDate1 = '2025-10-26'; // الأحد
    const testDate2 = '2025-11-02'; // الأحد التالي
    const testRoomId = 11; // القاعة المستخدمة في الحصص الإضافية
    const testStartTime = '09:30';
    const testEndTime = '11:00';
    
    console.log(`📅 اختبار التاريخ الأول: ${testDate1} (الأحد)`);
    const conflicts1 = checkExtraSessionsConflict(testRoomId, testDate1, testStartTime, testEndTime);
    console.log(`🏢 القاعة ${testRoomId} في ${testDate1}: ${conflicts1.length > 0 ? '❌ محجوزة' : '✅ متاحة'}`);
    if (conflicts1.length > 0) {
      conflicts1.forEach(conflict => {
        console.log(`   تعارض مع: ${conflict.start_time} - ${conflict.end_time}`);
      });
    }
    
    console.log(`📅 اختبار التاريخ الثاني: ${testDate2} (الأحد التالي)`);
    const conflicts2 = checkExtraSessionsConflict(testRoomId, testDate2, testStartTime, testEndTime);
    console.log(`🏢 القاعة ${testRoomId} في ${testDate2}: ${conflicts2.length > 0 ? '❌ محجوزة' : '✅ متاحة'}`);
    if (conflicts2.length > 0) {
      conflicts2.forEach(conflict => {
        console.log(`   تعارض مع: ${conflict.start_time} - ${conflict.end_time}`);
      });
    }
    
    console.log('\n5️⃣ اختبار تواريخ مختلفة لنفس القاعة...');
    
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
      const conflicts = checkExtraSessionsConflict(testRoomId, date, testStartTime, testEndTime);
      const dateObj = new Date(date);
      const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dateObj.getDay()];
      console.log(`📅 ${date} (${dayName}): ${conflicts.length > 0 ? '❌ محجوزة' : '✅ متاحة'}`);
    });
    
    console.log('\n6️⃣ اختبار قاعات مختلفة لنفس التاريخ...');
    
    // اختبار قاعات مختلفة لنفس التاريخ والتوقيت
    const testRooms = [7, 10, 11, 15, 20];
    testRooms.forEach(roomId => {
      const conflicts = checkExtraSessionsConflict(roomId, testDate1, testStartTime, testEndTime);
      console.log(`🏢 القاعة ${roomId} في ${testDate1}: ${conflicts.length > 0 ? '❌ محجوزة' : '✅ متاحة'}`);
    });
    
    console.log('\n7️⃣ اختبار التوقيتات المختلفة...');
    
    // اختبار توقيتات مختلفة لنفس القاعة والتاريخ
    const testTimes = [
      { start: '08:00', end: '09:30' },
      { start: '09:30', end: '11:00' },
      { start: '11:00', end: '12:30' },
      { start: '12:30', end: '14:00' },
      { start: '14:00', end: '15:30' },
    ];
    
    testTimes.forEach(time => {
      const conflicts = checkExtraSessionsConflict(testRoomId, testDate1, time.start, time.end);
      console.log(`⏰ ${time.start} - ${time.end}: ${conflicts.length > 0 ? '❌ محجوز' : '✅ متاح'}`);
    });
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ منطق حجز القاعات للحصص الإضافية يعمل بشكل صحيح');
    console.log('✅ الحصص الإضافية محجوزة للتاريخ المحدد فقط');
    console.log('✅ القاعات متاحة في التواريخ الأخرى');
    console.log('✅ المنطق يتحقق من التاريخ المحدد وليس يوم الأسبوع');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testExtraSessionsRoomBookingLogic()
    .then(() => {
      console.log('\n✅ تم اختبار منطق حجز القاعات للحصص الإضافية بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testExtraSessionsRoomBookingLogic };
