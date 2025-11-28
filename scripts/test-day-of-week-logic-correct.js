#!/usr/bin/env node

/**
 * Test Day of Week Logic - Correct Analysis
 * اختبار منطق أيام الأسبوع - التحليل الصحيح
 */

require('dotenv').config();

async function testDayOfWeekLogic() {
  console.log('🧪 اختبار منطق أيام الأسبوع - التحليل الصحيح...');
  console.log('============================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ فحص أيام الأسبوع في قاعدة البيانات...');
    
    // جلب أيام الأسبوع من قاعدة البيانات
    const { executeQuery } = require('../electron/database');
    const daysInDB = await executeQuery('SELECT DISTINCT day_of_week FROM assignments ORDER BY day_of_week');
    console.log('📊 أيام الأسبوع في قاعدة البيانات:', JSON.stringify(daysInDB, null, 2));
    
    console.log('\n3️⃣ تحليل أيام الأسبوع...');
    
    // تحليل أيام الأسبوع
    const dayNames = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    console.log('📋 أيام الأسبوع في قاعدة البيانات:');
    daysInDB.forEach(day => {
      console.log(`   ${day.day_of_week}: ${dayNames[day.day_of_week]}`);
    });
    
    console.log('\n4️⃣ اختبار التواريخ...');
    
    // اختبار التواريخ
    const testDates = [
      { date: '2025-10-26', expected: 'Saturday', expectedDB: 0 },
      { date: '2025-11-02', expected: 'Sunday', expectedDB: 1 },
      { date: '2025-11-03', expected: 'Monday', expectedDB: 2 }
    ];
    
    testDates.forEach(test => {
      const date = new Date(test.date);
      const dayOfWeek = date.getDay();
      
      let systemDayOfWeek;
      if (dayOfWeek === 0) { // الأحد
        systemDayOfWeek = 1;
      } else if (dayOfWeek === 6) { // السبت
        systemDayOfWeek = 0;
      } else { // الاثنين إلى الجمعة
        systemDayOfWeek = dayOfWeek + 1;
      }
      
      console.log(`📅 ${test.date}:`);
      console.log(`   JavaScript dayOfWeek: ${dayOfWeek} (${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][dayOfWeek]})`);
      console.log(`   System dayOfWeek: ${systemDayOfWeek} (${dayNames[systemDayOfWeek]})`);
      console.log(`   Expected: ${test.expected} (DB: ${test.expectedDB})`);
      console.log(`   Match: ${systemDayOfWeek === test.expectedDB ? '✅' : '❌'}`);
      console.log('');
    });
    
    console.log('\n5️⃣ فحص التكليفات العادية للأحد...');
    
    // فحص التكليفات العادية للأحد
    const sundayAssignments = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE day_of_week = 1');
    console.log(`📊 التكليفات العادية للأحد (day_of_week = 1): ${sundayAssignments[0].count}`);
    
    // فحص التكليفات العادية في التوقيت 09:30-11:00
    const sundayAssignmentsInTime = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE day_of_week = 1 AND start_time = $1 AND end_time = $2', ['09:30', '11:00']);
    console.log(`📊 التكليفات العادية للأحد في التوقيت 09:30-11:00: ${sundayAssignmentsInTime[0].count}`);
    
    console.log('\n6️⃣ تحليل المشكلة...');
    
    if (sundayAssignmentsInTime[0].count > 0) {
      console.log('❌ المشكلة: هناك تكليفات عادية للأحد في التوقيت 09:30-11:00');
      console.log('✅ هذا يفسر لماذا القاعات غير متاحة');
      console.log('✅ المنطق صحيح - التكليفات العادية تتكرر أسبوعياً');
    } else {
      console.log('✅ لا توجد تكليفات عادية للأحد في التوقيت 09:30-11:00');
      console.log('❌ المشكلة في مكان آخر');
    }
    
    console.log('\n7️⃣ اختبار التكليفات العادية للسبت...');
    
    // فحص التكليفات العادية للسبت
    const saturdayAssignments = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE day_of_week = 0');
    console.log(`📊 التكليفات العادية للسبت (day_of_week = 0): ${saturdayAssignments[0].count}`);
    
    // فحص التكليفات العادية للسبت في التوقيت 09:30-11:00
    const saturdayAssignmentsInTime = await executeQuery('SELECT COUNT(*) as count FROM assignments WHERE day_of_week = 0 AND start_time = $1 AND end_time = $2', ['09:30', '11:00']);
    console.log(`📊 التكليفات العادية للسبت في التوقيت 09:30-11:00: ${saturdayAssignmentsInTime[0].count}`);
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ تم تحليل منطق أيام الأسبوع');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testDayOfWeekLogic()
    .then(() => {
      console.log('\n✅ تم اختبار منطق أيام الأسبوع بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testDayOfWeekLogic };


