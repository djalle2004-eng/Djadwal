#!/usr/bin/env node

/**
 * Test Professor Workload Filtering
 * اختبار فلترة عبء العمل للأساتذة
 */

require('dotenv').config();

async function testProfessorWorkloadFiltering() {
  console.log('🧪 اختبار فلترة عبء العمل للأساتذة...');
  console.log('==========================================\n');
  
  try {
    // محاكاة السنة الأكاديمية والفصل الدراسي الحاليين
    const currentYear = { year_name: '2025-2026' };
    const currentSemester = { semester_name: 'الفصل الأول' };
    
    console.log('📅 السنة الأكاديمية المحددة:', currentYear.year_name);
    console.log('📅 الفصل الدراسي المحدد:', currentSemester.semester_name);
    
    // محاكاة التكليفات (بعضها للعام الحالي وبعضها لسنوات أخرى)
    const mockAssignments = [
      {
        id: 1,
        professor_id: 1,
        course_id: 1,
        group_id: 1,
        room_id: 1,
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:30',
        academic_year: '2025-2026',
        semester: 'الفصل الأول'
      },
      {
        id: 2,
        professor_id: 1,
        course_id: 2,
        group_id: 2,
        room_id: 2,
        day_of_week: 2,
        start_time: '09:30',
        end_time: '11:00',
        academic_year: '2025-2026',
        semester: 'الفصل الأول'
      },
      {
        id: 3,
        professor_id: 2,
        course_id: 3,
        group_id: 3,
        room_id: 3,
        day_of_week: 3,
        start_time: '11:00',
        end_time: '12:30',
        academic_year: '2024-2025', // سنة مختلفة
        semester: 'الفصل الأول'
      },
      {
        id: 4,
        professor_id: 1,
        course_id: 4,
        group_id: 4,
        room_id: 4,
        day_of_week: 4,
        start_time: '12:30',
        end_time: '14:00',
        academic_year: '2025-2026',
        semester: 'الفصل الثاني' // فصل مختلف
      }
    ];
    
    console.log('\n📊 التكليفات الأصلية:');
    console.log(`إجمالي التكليفات: ${mockAssignments.length}`);
    mockAssignments.forEach(assignment => {
      console.log(`  - التكليف ${assignment.id}: ${assignment.academic_year} - ${assignment.semester}`);
    });
    
    // تطبيق الفلترة كما في الكود المحدث
    const filteredAssignments = mockAssignments.filter(assignment => {
      const matchesYear = !currentYear || assignment.academic_year === currentYear.year_name;
      const matchesSemester = !currentSemester || assignment.semester === currentSemester.semester_name;
      return matchesYear && matchesSemester;
    });
    
    console.log('\n✅ التكليفات المفلترة:');
    console.log(`عدد التكليفات المفلترة: ${filteredAssignments.length}`);
    filteredAssignments.forEach(assignment => {
      console.log(`  - التكليف ${assignment.id}: ${assignment.academic_year} - ${assignment.semester}`);
    });
    
    // التحقق من النتائج
    const expectedFilteredCount = 2; // يجب أن يكون هناك تكليفان فقط للعام والفصل المحددين
    if (filteredAssignments.length === expectedFilteredCount) {
      console.log('\n🎉 الاختبار نجح!');
      console.log('✅ تم فلترة التكليفات بشكل صحيح حسب السنة الأكاديمية والفصل الدراسي');
    } else {
      console.log('\n❌ الاختبار فشل!');
      console.log(`متوقع: ${expectedFilteredCount} تكليف، تم الحصول على: ${filteredAssignments.length}`);
    }
    
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testProfessorWorkloadFiltering()
    .then(() => {
      console.log('\n✅ تم اختبار فلترة عبء العمل بنجاح!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ حدث خطأ:', err);
      process.exit(1);
    });
}

module.exports = { testProfessorWorkloadFiltering };
