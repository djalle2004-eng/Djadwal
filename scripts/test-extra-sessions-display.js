#!/usr/bin/env node

/**
 * Test Extra Sessions Display Fix
 * اختبار إصلاح عرض الحصص الإضافية
 */

require('dotenv').config();

async function testExtraSessionsDisplay() {
  console.log('🧪 اختبار إصلاح عرض الحصص الإضافية...');
  console.log('=====================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    const { initDatabaseConnection } = require('../electron/database');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    console.log('\n2️⃣ اختبار جلب الحصص الإضافية...');
    
    // اختبار جلب الحصص الإضافية
    const { getExtraSessions } = require('../electron/database');
    const extraSessions = await getExtraSessions();
    console.log(`📊 إجمالي الحصص الإضافية: ${extraSessions.length}`);
    
    if (extraSessions.length > 0) {
      console.log('\n📋 عينة من الحصص الإضافية:');
      extraSessions.slice(0, 3).forEach((session, index) => {
        console.log(`  ${index + 1}. ID: ${session.id}`);
        console.log(`     التاريخ: ${session.session_date}`);
        console.log(`     التوقيت: ${session.start_time} - ${session.end_time}`);
        console.log(`     نوع الحصة: ${session.session_type}`);
        console.log(`     الأستاذ ID: ${session.professor_id}`);
        console.log(`     المقرر ID: ${session.course_id}`);
        console.log(`     المجموعة ID: ${session.group_id}`);
        console.log(`     القاعة ID: ${session.room_id}`);
        console.log('');
      });
    }
    
    console.log('\n3️⃣ اختبار معالجة البيانات...');
    
    // محاكاة معالجة البيانات كما في Sessions.tsx
    const processedSessions = extraSessions
      .filter(session => {
        return session.id &&
               session.professor_id &&
               session.course_id &&
               session.group_id &&
               session.room_id &&
               session.session_date &&
               session.start_time &&
               session.end_time;
      });
    
    console.log(`📊 الحصص المعالجة: ${processedSessions.length}`);
    console.log(`📊 الحصص المفلترة: ${extraSessions.length}`);
    console.log(`📊 الحصص المفقودة: ${extraSessions.length - processedSessions.length}`);
    
    if (processedSessions.length > 0) {
      console.log('\n📋 عينة من الحصص المعالجة:');
      processedSessions.slice(0, 2).forEach((session, index) => {
        console.log(`  ${index + 1}. نوع الحصة: ${session.session_type === 'makeup' ? 'حصة تعويض' : 'حصة إضافية'}`);
        console.log(`     التاريخ: ${session.session_date ? new Date(session.session_date).toLocaleDateString('ar-SA') : 'غير محدد'}`);
        console.log(`     التوقيت: ${session.start_time} - ${session.end_time}`);
        console.log(`     الأستاذ ID: ${session.professor_id}`);
        console.log(`     المقرر ID: ${session.course_id}`);
        console.log(`     المجموعة ID: ${session.group_id}`);
        console.log(`     القاعة ID: ${session.room_id}`);
      });
    }
    
    console.log('\n4️⃣ اختبار جلب البيانات المرتبطة...');
    
    // اختبار جلب البيانات المرتبطة
    const { getProfessors, getCourses, getGroups, getRooms } = require('../electron/database');
    
    const [professors, courses, groups, rooms] = await Promise.all([
      getProfessors(),
      getCourses(),
      getGroups(),
      getRooms()
    ]);
    
    console.log(`📊 الأساتذة: ${professors.length}`);
    console.log(`📊 المقررات: ${courses.length}`);
    console.log(`📊 المجموعات: ${groups.length}`);
    console.log(`📊 القاعات: ${rooms.length}`);
    
    // اختبار ربط البيانات
    if (processedSessions.length > 0) {
      const sampleSession = processedSessions[0];
      const professor = professors.find(p => p.id === sampleSession.professor_id);
      const course = courses.find(c => c.id === sampleSession.course_id);
      const group = groups.find(g => g.id === sampleSession.group_id);
      const room = rooms.find(r => r.id === sampleSession.room_id);
      
      console.log('\n📋 اختبار ربط البيانات:');
      console.log(`  الأستاذ: ${professor ? professor.name : 'غير موجود'}`);
      console.log(`  المقرر: ${course ? course.name : 'غير موجود'}`);
      console.log(`  المجموعة: ${group ? group.name : 'غير موجود'}`);
      console.log(`  القاعة: ${room ? room.name : 'غير موجود'}`);
    }
    
    console.log('\n🎉 الاختبار مكتمل!');
    console.log('✅ صفحة الحصص يجب أن تعرض الآن البيانات من جدول extra_sessions');
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testExtraSessionsDisplay()
    .then(() => {
      console.log('\n✅ تم اختبار إصلاح عرض الحصص الإضافية بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testExtraSessionsDisplay };
