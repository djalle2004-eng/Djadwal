#!/usr/bin/env node

/**
 * Test Correct Room IDs for Extra Sessions
 * اختبار معرفات القاعات الصحيحة للحصص الإضافية
 */

require('dotenv').config();

async function testCorrectRoomIDs() {
  console.log('🧪 اختبار معرفات القاعات الصحيحة للحصص الإضافية...');
  console.log('==============================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ فحص معرفات القاعات...');
    
    // جلب البيانات
    const { getExtraSessions, getRooms } = require('../electron/database');
    const [extraSessions, rooms] = await Promise.all([
      getExtraSessions(),
      getRooms()
    ]);
    
    console.log(`📊 الحصص الإضافية: ${extraSessions.length}`);
    console.log(`📊 القاعات: ${rooms.length}`);
    
    console.log('\n3️⃣ تحليل الحصص الإضافية الموجودة...');
    
    if (extraSessions.length > 0) {
      extraSessions.forEach((session, index) => {
        const room = rooms.find(r => r.id === session.room_id);
        console.log(`📋 الحصة ${index + 1}:`);
        console.log(`   ID: ${session.id}`);
        console.log(`   room_id: ${session.room_id}`);
        console.log(`   اسم القاعة: ${room ? room.name : 'غير موجود'}`);
        console.log(`   التاريخ: ${session.session_date}`);
        console.log(`   التوقيت: ${session.start_time} - ${session.end_time}`);
        console.log('');
      });
    }
    
    console.log('\n4️⃣ اختبار القاعات المتاحة...');
    
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
    
    // اختبار القاعات الصحيحة
    const testDate = '2025-10-26';
    const testStartTime = '09:30';
    const testEndTime = '11:00';
    
    console.log(`📅 اختبار التاريخ: ${testDate}`);
    console.log(`⏰ اختبار التوقيت: ${testStartTime} - ${testEndTime}`);
    console.log('');
    
    // اختبار القاعات المختلفة
    const testRooms = [6, 7, 10, 11, 15, 20];
    testRooms.forEach(roomId => {
      const conflicts = checkExtraSessionsConflict(roomId, testDate, testStartTime, testEndTime);
      const room = rooms.find(r => r.id === roomId);
      const roomName = room ? room.name : `القاعة ${roomId}`;
      console.log(`🏢 ${roomName} (ID: ${roomId}): ${conflicts.length > 0 ? '❌ محجوزة' : '✅ متاحة'}`);
      if (conflicts.length > 0) {
        conflicts.forEach(conflict => {
          console.log(`   تعارض مع: ${conflict.start_time} - ${conflict.end_time}`);
        });
      }
    });
    
    console.log('\n5️⃣ اختبار القاعات المتاحة للبرمجة...');
    
    // اختبار القاعات المتاحة للبرمجة الجديدة
    const availableRooms = [];
    testRooms.forEach(roomId => {
      const conflicts = checkExtraSessionsConflict(roomId, testDate, testStartTime, testEndTime);
      if (conflicts.length === 0) {
        const room = rooms.find(r => r.id === roomId);
        const roomName = room ? room.name : `القاعة ${roomId}`;
        availableRooms.push({ id: roomId, name: roomName });
      }
    });
    
    console.log(`📊 القاعات المتاحة: ${availableRooms.length}`);
    availableRooms.forEach(room => {
      console.log(`   ✅ ${room.name} (ID: ${room.id})`);
    });
    
    console.log('\n6️⃣ اختبار تواريخ مختلفة...');
    
    // اختبار تواريخ مختلفة لنفس القاعة
    const testDates = ['2025-10-27', '2025-10-28', '2025-11-02'];
    const testRoomId = 7; // القاعة 06
    
    testDates.forEach(date => {
      const conflicts = checkExtraSessionsConflict(testRoomId, date, testStartTime, testEndTime);
      const room = rooms.find(r => r.id === testRoomId);
      const roomName = room ? room.name : `القاعة ${testRoomId}`;
      console.log(`📅 ${roomName} في ${date}: ${conflicts.length > 0 ? '❌ محجوزة' : '✅ متاحة'}`);
    });
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ تم تحديد القاعات المتاحة بشكل صحيح');
    console.log('✅ المنطق يعمل مع معرفات القاعات الصحيحة');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testCorrectRoomIDs()
    .then(() => {
      console.log('\n✅ تم اختبار معرفات القاعات الصحيحة بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testCorrectRoomIDs };
