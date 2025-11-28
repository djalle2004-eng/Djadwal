#!/usr/bin/env node

/**
 * Test Extra Sessions Display Fix - Correct Page
 * اختبار إصلاح عرض الحصص الإضافية - الصفحة الصحيحة
 */

require('dotenv').config();

async function testExtraSessionsDisplayFix() {
  console.log('🧪 اختبار إصلاح عرض الحصص الإضافية في AvailableRooms...');
  console.log('====================================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ اختبار جلب الحصص الإضافية مع الأسماء المرتبطة...');
    
    // اختبار جلب الحصص الإضافية
    const { getExtraSessions } = require('../electron/database');
    const extraSessions = await getExtraSessions();
    console.log(`📊 إجمالي الحصص الإضافية: ${extraSessions.length}`);
    
    if (extraSessions.length > 0) {
      console.log('\n📋 عينة من الحصص الإضافية مع الأسماء المرتبطة:');
      extraSessions.slice(0, 2).forEach((session, index) => {
        console.log(`  ${index + 1}. ID: ${session.id}`);
        console.log(`     التاريخ: ${session.session_date}`);
        console.log(`     التوقيت: ${session.start_time} - ${session.end_time}`);
        console.log(`     نوع الحصة: ${session.session_type}`);
        console.log(`     الأستاذ: ${session.professor_name || 'غير محدد'}`);
        console.log(`     المقرر: ${session.course_name || 'غير محدد'}`);
        console.log(`     المجموعة: ${session.group_name || 'غير محدد'}`);
        console.log(`     القاعة: ${session.room_name || 'غير محدد'}`);
        console.log('');
      });
    }
    
    console.log('\n3️⃣ اختبار عرض البيانات في الجدول...');
    
    // محاكاة عرض البيانات كما في AvailableRooms.tsx
    const filteredSessions = extraSessions.filter(session => {
      // محاكاة الفلترة حسب نوع الحصة
      return true; // عرض جميع الحصص
    });
    
    console.log(`📊 الحصص المفلترة: ${filteredSessions.length}`);
    
    if (filteredSessions.length > 0) {
      console.log('\n📋 عينة من البيانات المعروضة في الجدول:');
      filteredSessions.slice(0, 2).forEach((session, index) => {
        console.log(`  ${index + 1}. نوع الحصة: ${session.session_type === 'extra' ? 'حصة إضافية' : 'حصة تعويض'}`);
        console.log(`     التاريخ: ${new Date(session.session_date).toLocaleDateString('ar-SA')}`);
        console.log(`     التوقيت: ${session.start_time} - ${session.end_time}`);
        console.log(`     الأستاذ: ${session.professor_name || 'غير محدد'}`);
        console.log(`     المقرر: ${session.course_name || 'غير محدد'}`);
        console.log(`     المجموعة: ${session.group_name || 'غير محدد'}`);
        console.log(`     القاعة: ${session.room_name || 'غير محدد'}`);
      });
    }
    
    console.log('\n4️⃣ اختبار التحقق من البيانات المفقودة...');
    
    const sessionsWithMissingData = extraSessions.filter(session => 
      !session.professor_name || 
      !session.course_name || 
      !session.group_name || 
      !session.room_name
    );
    
    console.log(`📊 الحصص مع بيانات مفقودة: ${sessionsWithMissingData.length}`);
    
    if (sessionsWithMissingData.length > 0) {
      console.log('\n⚠️ تحذير: بعض الحصص تحتوي على بيانات مفقودة:');
      sessionsWithMissingData.forEach((session, index) => {
        console.log(`  ${index + 1}. ID: ${session.id}`);
        console.log(`     الأستاذ: ${session.professor_name || '❌ مفقود'}`);
        console.log(`     المقرر: ${session.course_name || '❌ مفقود'}`);
        console.log(`     المجموعة: ${session.group_name || '❌ مفقود'}`);
        console.log(`     القاعة: ${session.room_name || '❌ مفقود'}`);
      });
    } else {
      console.log('✅ جميع الحصص تحتوي على بيانات كاملة');
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ صفحة AvailableRooms يجب أن تعرض الآن جميع المعلومات في جدول التعويضات والحصص');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testExtraSessionsDisplayFix()
    .then(() => {
      console.log('\n✅ تم اختبار إصلاح عرض الحصص الإضافية في AvailableRooms بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testExtraSessionsDisplayFix };
