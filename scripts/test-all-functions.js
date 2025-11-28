#!/usr/bin/env node

/**
 * Comprehensive Database Function Test
 * اختبار شامل لوظائف قاعدة البيانات
 */

require('dotenv').config();
const { 
  initDatabaseConnection, 
  getTimeSlots, 
  getDepartments, 
  getProfessors, 
  getRooms,
  getCourses,
  getGroups,
  getAssignments,
  getAcademicYears,
  getCurrentAcademicYear,
  getSemesters,
  getUsers,
  checkConflicts,
  getExtraSessions,
  login
} = require('../electron/database');

async function testAllFunctions() {
  console.log('🧪 اختبار شامل لوظائف قاعدة البيانات...');
  console.log('==========================================\n');
  
  try {
    // اختبار الاتصال
    console.log('1️⃣ اختبار الاتصال...');
    await initDatabaseConnection();
    console.log('✅ تم الاتصال بنجاح');
    
    // اختبار getTimeSlots
    console.log('\n2️⃣ اختبار getTimeSlots...');
    const timeSlots = await getTimeSlots();
    console.log(`✅ تم جلب ${timeSlots.length} فترة زمنية`);
    
    // اختبار getDepartments
    console.log('\n3️⃣ اختبار getDepartments...');
    const departments = await getDepartments();
    console.log(`✅ تم جلب ${departments.length} قسم`);
    
    // اختبار getProfessors
    console.log('\n4️⃣ اختبار getProfessors...');
    const professors = await getProfessors();
    console.log(`✅ تم جلب ${professors.length} أستاذ`);
    
    // اختبار getRooms
    console.log('\n5️⃣ اختبار getRooms...');
    const rooms = await getRooms();
    console.log(`✅ تم جلب ${rooms.length} قاعة`);
    
    // اختبار getCourses
    console.log('\n6️⃣ اختبار getCourses...');
    const courses = await getCourses();
    console.log(`✅ تم جلب ${courses.length} مقرر`);
    
    // اختبار getGroups
    console.log('\n7️⃣ اختبار getGroups...');
    const groups = await getGroups();
    console.log(`✅ تم جلب ${groups.length} مجموعة`);
    
    // اختبار getAssignments
    console.log('\n8️⃣ اختبار getAssignments...');
    const assignments = await getAssignments();
    console.log(`✅ تم جلب ${assignments.length} حصة`);
    
    // اختبار getAcademicYears
    console.log('\n9️⃣ اختبار getAcademicYears...');
    const academicYears = await getAcademicYears();
    console.log(`✅ تم جلب ${academicYears.length} سنة أكاديمية`);
    
    // اختبار getCurrentAcademicYear
    console.log('\n🔟 اختبار getCurrentAcademicYear...');
    const currentYear = await getCurrentAcademicYear();
    console.log(`✅ السنة الحالية: ${currentYear ? currentYear.year_name : 'غير محدد'}`);
    
    // اختبار getSemesters
    console.log('\n1️⃣1️⃣ اختبار getSemesters...');
    const semesters = await getSemesters();
    console.log(`✅ تم جلب ${semesters.length} فصل دراسي`);
    
    // اختبار getUsers
    console.log('\n1️⃣2️⃣ اختبار getUsers...');
    const users = await getUsers();
    console.log(`✅ تم جلب ${users.length} مستخدم`);
    
    // اختبار checkConflicts
    console.log('\n1️⃣3️⃣ اختبار checkConflicts...');
    const testAssignment = {
      id: 0,
      room_id: 1,
      day_of_week: 1,
      start_time: '08:00',
      end_time: '09:30'
    };
    const conflicts = await checkConflicts(testAssignment);
    console.log(`✅ تم فحص التعارضات: ${conflicts.count} تعارض`);
    
    // اختبار getExtraSessions
    console.log('\n1️⃣4️⃣ اختبار getExtraSessions...');
    const extraSessions = await getExtraSessions();
    console.log(`✅ تم جلب ${extraSessions.length} حصة إضافية`);
    
    console.log('\n🎉 جميع الاختبارات نجحت!');
    console.log('✅ قاعدة البيانات تعمل بشكل صحيح');
    console.log('✅ جميع الوظائف متاحة');
    console.log('✅ التطبيق جاهز للاستخدام');
    
  } catch (error) {
    console.error('\n❌ فشل الاختبار:', error.message);
    console.error('📝 تفاصيل الخطأ:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testAllFunctions()
    .then(() => {
      console.log('\n✅ تم اختبار جميع الوظائف بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testAllFunctions };
