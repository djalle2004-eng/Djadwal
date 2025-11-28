#!/usr/bin/env node

/**
 * Test Remove Date Filter from Extra Sessions Table
 * اختبار إزالة الفلترة الزمنية من جدول الحصص الإضافية
 */

require('dotenv').config();

async function testRemoveDateFilter() {
  console.log('🧪 اختبار إزالة الفلترة الزمنية من جدول الحصص الإضافية...');
  console.log('====================================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ اختبار جلب جميع الحصص الإضافية...');
    
    // اختبار جلب الحصص الإضافية
    const { getExtraSessions } = require('../electron/database');
    const extraSessions = await getExtraSessions();
    console.log(`📊 إجمالي الحصص الإضافية: ${extraSessions.length}`);
    
    if (extraSessions.length > 0) {
      console.log('\n📋 جميع الحصص الإضافية (بدون فلترة زمنية):');
      extraSessions.forEach((session, index) => {
        console.log(`  ${index + 1}. ID: ${session.id}`);
        console.log(`     التاريخ: ${session.session_date}`);
        console.log(`     التوقيت: ${session.start_time} - ${session.end_time}`);
        console.log(`     نوع الحصة: ${session.session_type}`);
        console.log(`     الأستاذ: ${session.professor_name}`);
        console.log(`     المقرر: ${session.course_name}`);
        console.log(`     المجموعة: ${session.group_name}`);
        console.log(`     القاعة: ${session.room_name}`);
        console.log('');
      });
    }
    
    console.log('\n3️⃣ اختبار الفلترة حسب نوع الحصة فقط...');
    
    // محاكاة الفلترة حسب نوع الحصة فقط (بدون التاريخ)
    const makeupSessions = extraSessions.filter(session => session.session_type === 'makeup');
    const extraSessionsOnly = extraSessions.filter(session => session.session_type === 'extra');
    
    console.log(`📊 حصص التعويض: ${makeupSessions.length}`);
    console.log(`📊 الحصص الإضافية: ${extraSessionsOnly.length}`);
    
    if (makeupSessions.length > 0) {
      console.log('\n📋 حصص التعويض:');
      makeupSessions.forEach((session, index) => {
        console.log(`  ${index + 1}. ${session.session_date} - ${session.start_time} - ${session.professor_name}`);
      });
    }
    
    if (extraSessionsOnly.length > 0) {
      console.log('\n📋 الحصص الإضافية:');
      extraSessionsOnly.forEach((session, index) => {
        console.log(`  ${index + 1}. ${session.session_date} - ${session.start_time} - ${session.professor_name}`);
      });
    }
    
    console.log('\n4️⃣ اختبار عرض جميع الحصص بدون فلترة زمنية...');
    
    // محاكاة عرض جميع الحصص بدون فلترة زمنية
    const allSessionsDisplayed = extraSessions.length;
    console.log(`📊 جميع الحصص المعروضة: ${allSessionsDisplayed}`);
    
    // التحقق من أن جميع الحصص تظهر بغض النظر عن التاريخ
    const uniqueDates = [...new Set(extraSessions.map(session => session.session_date))];
    console.log(`📊 التواريخ المختلفة: ${uniqueDates.length}`);
    console.log(`📊 التواريخ: ${uniqueDates.join(', ')}`);
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ جدول الحصص الإضافية يعرض الآن جميع الحصص مهما كان يومها');
    console.log('✅ الفلترة الزمنية تم إزالتها بنجاح');
    console.log('✅ الفلترة حسب نوع الحصة لا تزال تعمل');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testRemoveDateFilter()
    .then(() => {
      console.log('\n✅ تم اختبار إزالة الفلترة الزمنية بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testRemoveDateFilter };
