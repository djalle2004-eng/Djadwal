import { useState, useEffect } from 'react';
import { printContent, generateFullDocument } from '../utils/printUtils';
import DatabaseErrorAlert from '../components/DatabaseErrorAlert';
import { useAcademicYear } from '../context/AcademicYearContext';
import { useAssignments } from '../context/AssignmentContext';

// واجهة للمجموعة
interface Group {
  id: number;
  name: string;
  year: string;
  specialization?: string;
  department_name?: string;
}

// واجهة للتكليف
interface Assignment {
  id?: number;
  group_id: number;
  course_id: number;
  professor_id: number;
  room_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
  group_name?: string;
  course_name?: string;
  professor_name?: string;
  room_name?: string;
  group_year?: string;
}

// واجهة للأستاذ
interface Professor {
  id: number;
  name: string;
  title?: string;
}

// واجهة للمقرر
interface Course {
  id: number;
  name: string;
  hours: number;
}

// واجهة للقاعة
interface Room {
  id: number;
  name: string;
  capacity: number;
}

// واجهة لليوم
interface Day {
  id: number;
  name: string;
}

// واجهة للوقت
interface TimeSlot {
  id: number;
  start_time: string;
  end_time: string;
}

export default function GroupTimetables() {
  // الحالة
  const { currentYear, currentSemester, refreshCurrentSemester } = useAcademicYear();
  const { assignments } = useAssignments();
  const [groups, setGroups] = useState<Group[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // إعدادات الطباعة
  const [printSettings, setPrintSettings] = useState({
    universityName: 'الجمهورية الجزائرية الديمقراطية الشعبية',
    facultyName: 'جـامـعـة عمار ثليجي الأغواط',
    universityLogoUrl: '',
    facultyLogoUrl: '',
    logoSize: 80,
    headerFontSize: 16,
    titleFontSize: 16,
    subtitleFontSize: 14,
    cellContentFontSize: 10,
    cellPadding: 3,
    lineHeight: 1.2,
    marginBetweenLines: 2,
    tableCellAlignment: 'center' as 'left' | 'center' | 'right'
  });

  // أيام الأسبوع
  const days: Day[] = [
    { id: 0, name: 'السبت' },
    { id: 1, name: 'الأحد' },
    { id: 2, name: 'الاثنين' },
    { id: 3, name: 'الثلاثاء' },
    { id: 4, name: 'الأربعاء' },
    { id: 5, name: 'الخميس' },
    { id: 6, name: 'الجمعة' },
  ];

  // الأوقات الافتراضية
  const defaultTimeSlots: TimeSlot[] = [
    { id: 1, start_time: '08:00', end_time: '09:30' },
    { id: 2, start_time: '09:30', end_time: '11:00' },
    { id: 3, start_time: '11:15', end_time: '12:45' },
    { id: 4, start_time: '12:45', end_time: '14:15' },
    { id: 5, start_time: '14:15', end_time: '15:45' },
    { id: 6, start_time: '15:45', end_time: '17:15' },
  ];

  // استرجاع إعدادات الطباعة
  const loadPrintSettings = async () => {
    try {
      const savedSettings = await window.dataUtils.getPrintSettings();
      if (savedSettings) {
        setPrintSettings({
          universityName: savedSettings.universityName || 'الجمهورية الجزائرية الديمقراطية الشعبية',
          facultyName: savedSettings.facultyName || 'جـامـعـة عمار ثليجي الأغواط',
          universityLogoUrl: savedSettings.universityLogoUrl || '',
          facultyLogoUrl: savedSettings.facultyLogoUrl || '',
          logoSize: savedSettings.logoSize || 80,
          headerFontSize: savedSettings.headerFontSize || 16,
          titleFontSize: savedSettings.titleFontSize || 16,
          subtitleFontSize: savedSettings.subtitleFontSize || 14,
          cellContentFontSize: savedSettings.cellContentFontSize || 10,
          cellPadding: (savedSettings as any).cellPadding || 3,
          lineHeight: (savedSettings as any).lineHeight || 1.2,
          marginBetweenLines: (savedSettings as any).marginBetweenLines || 2,
          tableCellAlignment: (savedSettings as any).tableCellAlignment || 'center'
        });
      }
    } catch (err) {
      console.error('خطأ في تحميل إعدادات الطباعة:', err);
    }
  };

  // دالة جلب البيانات
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const db = (window as any).db;
      const [groupsData, professorsData, coursesData, roomsData] = await Promise.all([
        db.getGroups(),
        db.getProfessors(),
        db.getCourses(),
        db.getRooms()
      ]);
      
      setGroups(groupsData);
      setProfessors(professorsData);
      setCourses(coursesData);
      setRooms(roomsData);
      setTimeSlots(defaultTimeSlots);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    fetchData();
    loadPrintSettings();
  }, []);

  // تصفية المجموعات حسب البحث
  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.specialization && group.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // الحصول على المجموعة المختارة
  const selectedGroupData = selectedGroup 
    ? groups.find(g => g.id === selectedGroup) 
    : null;

  // الحصول على تكليفات المجموعة المختارة
  const groupAssignments = selectedGroup 
    ? assignments.filter(a => a.group_id === selectedGroup)
    : [];

  // ✅ تصفية الأيام - إظهار فقط الأيام التي تحتوي على تكليفات
  const activeDays = days.filter(day => 
    groupAssignments.some(assignment => assignment.day_of_week === day.id)
  );

  // دالة لتحديد المستوى الأكاديمي من السنة
  const getAcademicLevel = (year: string): string => {
    if (!year) return '-';
    
    const yearUpper = year.toUpperCase();
    
    if (yearUpper === 'L1') {
      return 'جذع مشترك';
    } else if (yearUpper === 'L2' || yearUpper === 'L3') {
      return 'ليسانس';
    } else if (yearUpper === 'M1' || yearUpper === 'M2') {
      return 'ماستر';
    }
    
    return year;
  };

  // دالة عرض خلية الجدول الزمني
  const renderScheduleCell = (dayId: number, timeSlot: TimeSlot) => {
    const assignment = groupAssignments.find(a => 
      a.day_of_week === dayId && 
      a.start_time === timeSlot.start_time
    );

    if (!assignment) {
      return (
        <td key={`${dayId}-${timeSlot.id}`} className="border border-gray-300 p-2 h-20 bg-gray-50">
          <div className="text-xs text-gray-400">فارغ</div>
        </td>
      );
    }

    const course = courses.find(c => c.id === assignment.course_id);
    const professor = professors.find(p => p.id === assignment.professor_id);
    const room = rooms.find(r => r.id === assignment.room_id);

    return (
      <td key={`${dayId}-${timeSlot.id}`} className="border border-gray-300 p-2 h-20 bg-blue-50">
        <div className="text-xs">
          <div className="font-semibold text-blue-800">{course?.name || 'مقرر غير محدد'}</div>
          <div className="text-blue-600">{professor?.name || 'أستاذ غير محدد'}</div>
          <div className="text-blue-500">{room?.name || 'قاعة غير محددة'}</div>
        </div>
      </td>
    );
  };

  // تصدير الجدول الزمني إلى PDF أو طباعة
  const exportTimetableToPDF = async (asPDF: boolean = true) => {
    if (!selectedGroupData || !currentYear || !currentSemester) {
      alert('يرجى اختيار مجموعة أولاً');
      return;
    }

    try {
      await refreshCurrentSemester();
      
      // ✅ بناء معلومات المجموعة
      const groupInfo = `
        <div style="
          margin: 20px 0; 
          text-align: center; 
          background-color: #f0f0f0; 
          padding: 15px; 
          border: 2px solid #ccc;
          border-radius: 8px;
        ">
          <h3 style="margin: 5px 0; font-size: 16pt; color: #333;">
            فوج: <strong>${selectedGroupData.name}</strong> - ${getAcademicLevel(selectedGroupData.year || '')}
          </h3>
          <p style="margin: 5px 0; font-size: 12pt;">
            <strong>التخصص:</strong> ${selectedGroupData.specialization || 'غير محدد'}
          </p>
          <p style="margin: 5px 0; font-size: 12pt;">
            <strong>السنة الدراسية:</strong> ${currentYear.year_name} - ${currentSemester.semester_name}
          </p>
        </div>
      `;
      
      // ✅ بناء جدول الحصص - الوقت في الصفوف والأيام في الأعمدة (إظهار الأيام النشطة فقط)
      const daysToShow = activeDays.length > 0 ? activeDays : days;
      
      const tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin: 5px auto; font-size: ${printSettings.cellContentFontSize}pt;">
          <thead>
            <tr style="background-color: #d0d0d0;">
              <th style="border: 2px solid #333; padding: ${printSettings.cellPadding}px; text-align: ${printSettings.tableCellAlignment}; font-weight: bold; width: 60px; background-color: #f5f5f5; font-size: ${printSettings.cellContentFontSize}pt;">الوقت</th>
              ${daysToShow.map(day => 
                `<th style="border: 2px solid #333; padding: ${printSettings.cellPadding}px; text-align: ${printSettings.tableCellAlignment}; font-weight: bold; background-color: #d0d0d0; font-size: ${printSettings.cellContentFontSize}pt;">${day.name}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${defaultTimeSlots.map(timeSlot => `
              <tr>
                <td style="border: 1px solid #666; padding: ${printSettings.cellPadding}px; text-align: ${printSettings.tableCellAlignment}; background-color: #f5f5f5; font-weight: bold; font-size: ${Math.max(printSettings.cellContentFontSize - 1, 6)}pt;">
                  ${timeSlot.start_time}<br>${timeSlot.end_time}
                </td>
                ${daysToShow.map(day => {
                  const assignment = groupAssignments.find(a => 
                    a.day_of_week === day.id && 
                    a.start_time === timeSlot.start_time
                  );
                  
                  if (!assignment) {
                    return `<td style="border: 1px solid #666; padding: ${printSettings.cellPadding}px; text-align: ${printSettings.tableCellAlignment} !important; background-color: #f9f9f9; color: #999; font-size: ${printSettings.cellContentFontSize}pt;">-</td>`;
                  }
                  
                  const course = courses.find(c => c.id === assignment.course_id);
                  const professor = professors.find(p => p.id === assignment.professor_id);
                  const room = rooms.find(r => r.id === assignment.room_id);
                  
                  return `
                    <td style="border: 1px solid #666; padding: ${printSettings.cellPadding}px; text-align: ${printSettings.tableCellAlignment} !important; background-color: #cce5ff; font-size: ${printSettings.cellContentFontSize}pt; vertical-align: middle; line-height: ${printSettings.lineHeight};">
                      <div style="color: #b91c1c; font-weight: bold; font-size: ${Math.max(printSettings.cellContentFontSize + 1, 7)}pt; margin-bottom: ${printSettings.marginBetweenLines}px; line-height: ${printSettings.lineHeight}; text-align: ${printSettings.tableCellAlignment} !important; width: 100%; display: block;">${course?.name || 'غير محدد'}</div>
                      <div style="color: #1e40af; font-size: ${printSettings.cellContentFontSize}pt; margin-bottom: ${printSettings.marginBetweenLines}px; line-height: ${printSettings.lineHeight}; text-align: ${printSettings.tableCellAlignment} !important; width: 100%; display: block;">${professor?.name || 'غير محدد'}</div>
                      <div style="color: #1e40af; font-size: ${Math.max(printSettings.cellContentFontSize - 1, 5)}pt; line-height: ${printSettings.lineHeight}; text-align: ${printSettings.tableCellAlignment} !important; width: 100%; display: block;">${room?.name || 'غير محددة'}</div>
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      // ✅ إنشاء المستند الكامل
      const content = generateFullDocument(
        'الجدول الزمني للفوج',
        groupInfo + tableHTML,
        {
          universityName: printSettings.universityName,
          facultyName: printSettings.facultyName,
          universityLogoUrl: printSettings.universityLogoUrl,
          facultyLogoUrl: printSettings.facultyLogoUrl,
          logoSize: printSettings.logoSize,
          headerFontSize: printSettings.headerFontSize,
          titleFontSize: printSettings.titleFontSize,
          subtitleFontSize: printSettings.subtitleFontSize,
          cellContentFontSize: printSettings.cellContentFontSize,
          tableCellAlignment: printSettings.tableCellAlignment
        }
      );
      
      // ✅ حفظ كـ PDF أو طباعة عادية
      printContent(content, {
        title: `جدول_زمني_${selectedGroupData.name}_${currentYear.year_name}`,
        orientation: 'landscape',
        fontSize: '10pt',
        asPDF: asPDF // ✅ استخدام المعامل
      });
      
    } catch (error) {
      console.error('خطأ في تصدير PDF:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF');
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">الجداول الزمنية للأفواج</h1>
      
      {error && <DatabaseErrorAlert error={error} />}
      
      {/* شريط البحث واختيار المجموعة */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              البحث عن فوج
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم أو التخصص..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اختيار الفوج
            </label>
            <select
              value={selectedGroup || ''}
              onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">اختر فوجاً</option>
              {filteredGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} - {getAcademicLevel(group.year || '')} - {group.specialization || 'غير محدد'}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* أزرار الطباعة */}
        {selectedGroup && (
          <div className="mt-4 flex gap-3 justify-end">
            <button
              onClick={() => exportTimetableToPDF(false)}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 font-semibold"
            >
              🖨️ طباعة عادية
            </button>
            <button
              onClick={() => exportTimetableToPDF(true)}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 font-semibold"
            >
              📄 حفظ كـ PDF
            </button>
          </div>
        )}
      </div>

      {/* عرض الجدول الزمني */}
      {selectedGroupData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-600 text-white p-4">
            <h2 className="text-xl font-bold">
              الجدول الزمني للفوج: {selectedGroupData.name}
            </h2>
            <p className="text-blue-100">
              {getAcademicLevel(selectedGroupData.year || '')} - {selectedGroupData.specialization || 'غير محدد'}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 p-3 bg-gray-100 font-bold">الوقت</th>
                  {(activeDays.length > 0 ? activeDays : days).map(day => (
                    <th key={day.id} className="border border-gray-300 p-3 bg-gray-100 font-bold">
                      {day.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defaultTimeSlots.map(timeSlot => (
                  <tr key={timeSlot.id}>
                    <td className="border border-gray-300 p-2 bg-gray-50 text-center font-medium">
                      <div>{timeSlot.start_time}</div>
                      <div>{timeSlot.end_time}</div>
                    </td>
                    {(activeDays.length > 0 ? activeDays : days).map(day => renderScheduleCell(day.id, timeSlot))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {!selectedGroupData && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">يرجى اختيار فوج لعرض الجدول الزمني</div>
        </div>
      )}
    </div>
  );
}
