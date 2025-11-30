import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Edit, Trash2, Plus, Save, X, Clock, Users, BookOpen, MapPin } from 'lucide-react';
import DatabaseErrorAlert from '../components/DatabaseErrorAlert';
import { useAcademicYear } from '../context/AcademicYearContext';
import { useAssignments } from '../context/AssignmentContext';
import { usePermissions } from '../hooks/usePermissions';
import { printContent, generateFullDocument } from '../utils/printUtils';
import { exportScheduleToExcel } from '../utils/excelUtils';
import { usePrintSettings } from '../hooks/usePrintSettings';

// واجهات البيانات
interface Professor {
  id: number;
  name: string;
  email: string;
  Title?: string;
}

interface Course {
  id: number;
  name: string;
  code: string;
}

interface Room {
  id: number;
  name: string;
  capacity?: number;
}

interface Group {
  id: number;
  name: string;
  specialization?: string;
  year?: string;
}

interface TimeSlot {
  id: number;
  label: string;
  start: string;
  end: string;
}

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
}

interface ScheduleCell {
  assignment?: Assignment;
  conflicts?: Assignment[];
}

// أيام الأسبوع
const DAYS = [
  { id: 0, name: 'السبت', shortName: 'سبت' },
  { id: 1, name: 'الأحد', shortName: 'أحد' },
  { id: 2, name: 'الاثنين', shortName: 'اثنين' },
  { id: 3, name: 'الثلاثاء', shortName: 'ثلاثاء' },
  { id: 4, name: 'الأربعاء', shortName: 'أربعاء' },
  { id: 5, name: 'الخميس', shortName: 'خميس' },
  { id: 6, name: 'الجمعة', shortName: 'جمعة' },
];

export default function GroupSchedules() {
  // الصلاحيات
  const { can } = usePermissions();

  // الحالة الأساسية
  const { currentYear, currentSemester } = useAcademicYear();
  const { assignments, refreshAssignments } = useAssignments();

  const [groups, setGroups] = useState<Group[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // فلاتر التخصص والمجموعة
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // حالة التحرير
  const [editingCell, setEditingCell] = useState<{ day: number, timeSlot: number } | null>(null);
  const [editForm, setEditForm] = useState<Partial<Assignment>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);

  // حالات البحث الذكي
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [professorSearchTerm, setProfessorSearchTerm] = useState('');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isProfessorDropdownOpen, setIsProfessorDropdownOpen] = useState(false);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [filteredProfessors, setFilteredProfessors] = useState<Professor[]>([]);

  // إعدادات الطباعة
  const [printSettings, setPrintSettings] = useState({
    universityName: 'جامعة الشهيد حمه لخضر - الوادي',
    facultyName: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
    universityLogoUrl: '',
    facultyLogoUrl: '',
    logoSize: 80,
    headerFontSize: 16,
    titleFontSize: 16,
    subtitleFontSize: 14,
    cellContentFontSize: 10
  });
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(-1);
  const [selectedProfessorIndex, setSelectedProfessorIndex] = useState(-1);

  // دوال البحث الذكي
  const handleCourseSearch = (searchTerm: string) => {
    setCourseSearchTerm(searchTerm);
    if (searchTerm.trim()) {
      const filtered = courses.filter(course =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCourses(filtered);
      setIsCourseDropdownOpen(true);
    } else {
      setFilteredCourses([]);
      setIsCourseDropdownOpen(false);
    }
  };

  const handleProfessorSearch = (searchTerm: string) => {
    setProfessorSearchTerm(searchTerm);
    if (searchTerm.trim()) {
      const filtered = professors.filter(professor =>
        professor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (professor.email && professor.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredProfessors(filtered);
      setIsProfessorDropdownOpen(true);
    } else {
      setFilteredProfessors([]);
      setIsProfessorDropdownOpen(false);
    }
  };

  const selectCourse = (course: Course) => {
    setEditForm({ ...editForm, course_id: course.id });
    setCourseSearchTerm(course.name);
    setIsCourseDropdownOpen(false);
  };

  const selectProfessor = (professor: Professor) => {
    setEditForm({ ...editForm, professor_id: professor.id });
    setProfessorSearchTerm(professor.name);
    setIsProfessorDropdownOpen(false);
  };

  // إعادة تعيين نموذج التحرير
  const resetEditForm = () => {
    setEditForm({});
    setCourseSearchTerm('');
    setProfessorSearchTerm('');
    setIsCourseDropdownOpen(false);
    setIsProfessorDropdownOpen(false);
    setEditingCell(null);
    setIsAddingNew(false);
  };

  // بدء التحرير
  const startEditing = (day: number, timeSlot: number, assignment?: Assignment) => {
    setEditingCell({ day, timeSlot });
    if (assignment) {
      setEditForm(assignment);
      // تعيين أسماء البحث للعناصر المحددة
      const selectedCourse = courses.find(c => c.id === assignment.course_id);
      const selectedProfessor = professors.find(p => p.id === assignment.professor_id);
      setCourseSearchTerm(selectedCourse?.name || '');
      setProfessorSearchTerm(selectedProfessor?.name || '');
    } else {
      setEditForm({
        day_of_week: day,
        start_time: timeSlots.find(ts => ts.id === timeSlot)?.start || '',
        end_time: timeSlots.find(ts => ts.id === timeSlot)?.end || '',
      });
      setCourseSearchTerm('');
      setProfessorSearchTerm('');
      setIsAddingNew(true);
    }
  };

  // استخراج التخصصات الفريقة من المجموعات
  const specializations = useMemo(() => {
    const uniqueSpecs = [...new Set(groups.map(g => g.specialization).filter(Boolean))];
    return uniqueSpecs.sort();
  }, [groups]);

  // فلترة المجموعات حسب التخصص المحدد
  const filteredGroups = useMemo(() => {
    if (!selectedSpecialization) return groups;
    return groups.filter(g => g.specialization === selectedSpecialization);
  }, [groups, selectedSpecialization]);

  // استرجاع إعدادات الطباعة
  const loadPrintSettings = async () => {
    try {
      const savedSettings = await window.dataUtils.getPrintSettings();
      if (savedSettings) {
        setPrintSettings({
          universityName: savedSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي',
          facultyName: savedSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
          universityLogoUrl: savedSettings.universityLogoUrl || '',
          facultyLogoUrl: savedSettings.facultyLogoUrl || '',
          logoSize: savedSettings.logoSize || 80,
          headerFontSize: savedSettings.headerFontSize || 16,
          titleFontSize: savedSettings.titleFontSize || 16,
          subtitleFontSize: savedSettings.subtitleFontSize || 14,
          cellContentFontSize: savedSettings.cellContentFontSize || 10
        });
      }
    } catch (err) {
      console.error('خطأ في تحميل إعدادات الطباعة:', err);
    }
  };

  // جلب البيانات
  const fetchData = async () => {
    setLoading(true);
    try {
      const db = (window as any).db;

      const [groupsData, professorsData, coursesData, roomsData, timeSlotsData] = await Promise.all([
        db.getGroups(),
        db.getProfessors(),
        db.getCourses(),
        db.getRooms(),
        db.getTimeSlots()
      ]);

      setGroups(groupsData || []);
      setProfessors(professorsData || []);
      setCourses(coursesData || []);
      setRooms(roomsData || []);
      setTimeSlots(timeSlotsData || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    loadPrintSettings();
  }, []);

  // تصفية التكليفات للمجموعة المختارة
  const groupAssignments = useMemo(() => {
    if (!selectedGroup) return [];

    const filtered = assignments.filter(assignment => {
      const matches = assignment.group_id === selectedGroup &&
        assignment.academic_year === currentYear?.year_name &&
        assignment.semester === currentSemester?.semester_name;
      return matches;
    });

    console.log('GroupSchedules - Selected Group:', selectedGroup);
    console.log('GroupSchedules - Current Year:', currentYear?.year_name);
    console.log('GroupSchedules - Current Semester:', currentSemester?.semester_name);
    console.log('GroupSchedules - All assignments:', assignments.length);
    console.log('GroupSchedules - Filtered assignments:', filtered.length);
    console.log('GroupSchedules - Filtered assignments data:', filtered);

    return filtered;
  }, [assignments, selectedGroup, currentYear, currentSemester]);

  // ✅ تصفية الأيام - إظهار فقط الأيام التي تحتوي على تكليفات
  const activeDays = useMemo(() => {
    return DAYS.filter(day =>
      groupAssignments.some(assignment => assignment.day_of_week === day.id)
    );
  }, [groupAssignments]);

  // إنشاء جدول الحصص
  const scheduleGrid = useMemo(() => {
    const grid: { [key: string]: ScheduleCell } = {};

    timeSlots.forEach(timeSlot => {
      DAYS.forEach(day => {
        const key = `${day.id}-${timeSlot.id}`;
        const cellAssignments = groupAssignments.filter(
          assignment => {
            const dayMatches = assignment.day_of_week === day.id;
            const timeMatches = assignment.start_time === timeSlot.start && assignment.end_time === timeSlot.end;
            return dayMatches && timeMatches;
          }
        );

        grid[key] = {
          assignment: cellAssignments[0],
          conflicts: cellAssignments.length > 1 ? cellAssignments.slice(1) : undefined
        };
      });
    });

    console.log('GroupSchedules - Schedule grid:', grid);
    return grid;
  }, [groupAssignments, timeSlots]);

  // حفظ التكليف
  const saveAssignment = async () => {
    if (!editForm.course_id || !editForm.professor_id || !editForm.room_id || !selectedGroup) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const db = (window as any).db;

      const assignmentData = {
        ...editForm,
        group_id: selectedGroup,
        academic_year: currentYear?.year_name,
        semester: currentSemester?.semester_name,
      };

      if (editForm.id) {
        // تحديث
        await db.updateAssignment(editForm.id, assignmentData);
      } else {
        // إضافة جديد
        await db.addAssignment(assignmentData);
      }

      await refreshAssignments();
      setEditingCell(null);
      setEditForm({});
      setIsAddingNew(false);
    } catch (err) {
      console.error('Error saving assignment:', err);
      alert('حدث خطأ أثناء حفظ التكليف');
    }
  };

  // حذف التكليف
  const deleteAssignment = async (assignmentId: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التكليف؟')) return;

    try {
      const db = (window as any).db;
      await db.deleteAssignment(assignmentId);
      await refreshAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('حدث خطأ أثناء حذف التكليف');
    }
  };

  // إلغاء التحرير
  const cancelEditing = () => {
    resetEditForm();
  };

  // عرض خلية الجدول
  const renderScheduleCell = (day: number, timeSlot: TimeSlot) => {
    const key = `${day}-${timeSlot.id}`;
    const cell = scheduleGrid[key];
    const isEditing = editingCell?.day === day && editingCell?.timeSlot === timeSlot.id;

    if (isEditing) {
      return (
        <div className="p-2 bg-blue-50 border-2 border-blue-300 min-h-[120px]">
          <div className="space-y-2">
            {/* اختيار المقرر */}
            <div className="relative search-dropdown">
              <input
                type="text"
                value={courseSearchTerm}
                onChange={(e) => handleCourseSearch(e.target.value)}
                onFocus={() => {
                  if (courseSearchTerm.trim()) {
                    setIsCourseDropdownOpen(true);
                  }
                }}
                className="w-full text-xs border rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                placeholder="ابحث عن المقرر..."
              />
              {isCourseDropdownOpen && filteredCourses.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                  {filteredCourses.map((course, index) => (
                    <div
                      key={course.id}
                      className={`p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${selectedCourseIndex === index ? 'bg-blue-100' : ''}`}
                      onClick={() => selectCourse(course)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          selectCourse(course);
                        }
                      }}
                      tabIndex={0}
                    >
                      <div className="font-medium text-xs">{course.name}</div>
                      <div className="text-xs text-gray-500">كود: {course.code}</div>
                    </div>
                  ))}
                </div>
              )}
              {isCourseDropdownOpen && filteredCourses.length === 0 && courseSearchTerm.trim() && (
                <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-50 p-2">
                  <div className="text-xs text-gray-500 text-center">لا توجد مقررات مطابقة</div>
                </div>
              )}
            </div>

            {/* اختيار الأستاذ */}
            <div className="relative search-dropdown">
              <input
                type="text"
                value={professorSearchTerm}
                onChange={(e) => handleProfessorSearch(e.target.value)}
                onFocus={() => {
                  if (professorSearchTerm.trim()) {
                    setIsProfessorDropdownOpen(true);
                  }
                }}
                className="w-full text-xs border rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                placeholder="ابحث عن الأستاذ..."
              />
              {isProfessorDropdownOpen && filteredProfessors.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                  {filteredProfessors.map((professor, index) => (
                    <div
                      key={professor.id}
                      className={`p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${selectedProfessorIndex === index ? 'bg-blue-100' : ''}`}
                      onClick={() => selectProfessor(professor)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          selectProfessor(professor);
                        }
                      }}
                      tabIndex={0}
                    >
                      <div className="font-medium text-xs">{professor.name}</div>
                      {professor.Title && (
                        <div className="text-xs text-gray-500">{professor.Title}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isProfessorDropdownOpen && filteredProfessors.length === 0 && professorSearchTerm.trim() && (
                <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-50 p-2">
                  <div className="text-xs text-gray-500 text-center">لا يوجد أساتذة مطابقون</div>
                </div>
              )}
            </div>

            {/* اختيار القاعة */}
            <select
              value={editForm.room_id || ''}
              onChange={(e) => setEditForm({ ...editForm, room_id: parseInt(e.target.value) })}
              className="w-full text-xs border rounded px-2 py-1"
            >
              <option value="">اختر القاعة</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex gap-1">
              {(can('create', 'sessions') || can('update', 'sessions')) && (
                <button
                  onClick={saveAssignment}
                  className="flex-1 bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600 flex items-center justify-center gap-1"
                >
                  <Save size={12} />
                  حفظ
                </button>
              )}
              <button
                onClick={cancelEditing}
                className="flex-1 bg-gray-500 text-white text-xs px-2 py-1 rounded hover:bg-gray-600 flex items-center justify-center gap-1"
              >
                <X size={12} />
                إلغاء
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`p-2 min-h-[120px] border border-gray-200 hover:bg-gray-50 cursor-pointer relative group ${cell.conflicts ? 'bg-red-50 border-red-300' : cell.assignment ? 'bg-green-50' : 'bg-white'
          }`}
        onClick={() => can('update', 'sessions') && startEditing(day, timeSlot.id, cell.assignment)}
      >
        {cell.assignment ? (
          <div className="space-y-1">
            <div className="font-semibold text-sm text-blue-800 flex items-center gap-1">
              <BookOpen size={12} />
              {cell.assignment.course_name}
            </div>
            <div className={`text-xs flex items-center gap-1 ${cell.assignment.professor_name && cell.assignment.professor_name.includes('أستاذ(ة) مؤقت(ة)') ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              <Users size={10} />
              {cell.assignment.professor_name}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin size={10} />
              {cell.assignment.room_name}
            </div>

            {/* أزرار التحرير والحذف */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              {can('update', 'sessions') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(day, timeSlot.id, cell.assignment);
                  }}
                  className="bg-blue-500 text-white p-1 rounded text-xs hover:bg-blue-600"
                >
                  <Edit size={10} />
                </button>
              )}
              {can('delete', 'sessions') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cell.assignment?.id) deleteAssignment(cell.assignment.id);
                  }}
                  className="bg-red-500 text-white p-1 rounded text-xs hover:bg-red-600"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Plus size={16} />
          </div>
        )}

        {cell.conflicts && (
          <div className="absolute top-0 left-0 bg-red-500 text-white text-xs px-1 rounded-br">
            تعارض!
          </div>
        )}
      </div>
    );
  };

  // إدارة إغلاق القوائم المنسدلة
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-dropdown')) {
        setIsCourseDropdownOpen(false);
        setIsProfessorDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // تصدير الجدول الزمني إلى PDF أو طباعة
  const exportScheduleToPDF = async (asPDF: boolean = true) => {
    if (!selectedGroup || !currentYear || !currentSemester) {
      alert('يرجى اختيار فوجاً أولاً');
      return;
    }

    try {
      const groupData = groups.find(g => g.id === selectedGroup);
      if (!groupData) return;

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
            فوج: <strong>${groupData.name}</strong>
          </h3>
          <p style="margin: 5px 0; font-size: 12pt;">
            <strong>التخصص:</strong> ${groupData.specialization || 'غير محدد'}
          </p>
          <p style="margin: 5px 0; font-size: 12pt;">
            <strong>السنة الدراسية:</strong> ${currentYear.year_name} - ${currentSemester.semester_name}
          </p>
        </div>
      `;

      // ✅ بناء جدول الحصص - الوقت في الصفوف والأيام في الأعمدة (إظهار الأيام النشطة فقط)
      const daysToShow = activeDays.length > 0 ? activeDays : DAYS;

      const tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin: 5px auto; font-size: 7pt;">
          <thead>
            <tr style="background-color: #d0d0d0;">
              <th style="border: 2px solid #333; padding: 3px; text-align: center; font-weight: bold; width: 60px; background-color: #f5f5f5; font-size: 7pt;">الوقت</th>
              ${daysToShow.map(day =>
        `<th style="border: 2px solid #333; padding: 3px; text-align: center; font-weight: bold; background-color: #d0d0d0; font-size: 7pt;">${day.name}</th>`
      ).join('')}
            </tr>
          </thead>
          <tbody>
            ${timeSlots.map(timeSlot => `
              <tr>
                <td style="border: 1px solid #666; padding: 2px; text-align: center; background-color: #f5f5f5; font-weight: bold; font-size: 6pt;">
                  ${timeSlot.start}<br>${timeSlot.end}
                </td>
                ${daysToShow.map(day => {
        const assignment = groupAssignments.find(a =>
          a.day_of_week === day.id &&
          a.start_time === timeSlot.start
        );

        if (!assignment) {
          return '<td style="border: 1px solid #666; padding: 2px; text-align: center; background-color: #f9f9f9; color: #999; font-size: 6pt;">-</td>';
        }

        const course = courses.find(c => c.id === assignment.course_id);
        const professor = professors.find(p => p.id === assignment.professor_id);
        const room = rooms.find(r => r.id === assignment.room_id);

        return `
                    <td style="border: 1px solid #666; padding: 2px; text-align: center; background-color: #e8f4fd;">
                      <div style="font-weight: bold; color: #1e40af; font-size: 7pt; margin-bottom: 1px;">${course?.name || 'غير محدد'}</div>
                      <div style="color: #1e40af; font-size: 6pt; margin-bottom: 1px;">${professor?.name || 'غير محدد'}</div>
                      <div style="color: #1e40af; font-size: 5pt;">${room?.name || 'غير محددة'}</div>
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
          tableCellAlignment: (printSettings as any).tableCellAlignment || 'center'
        }
      );

      // ✅ حفظ كـ PDF أو طباعة عادية
      printContent(content, {
        title: `جدول_زمني_${groupData.name}_${currentYear.year_name}`,
        orientation: 'landscape',
        fontSize: '10pt',
        asPDF: asPDF
      });

    } catch (error) {
      console.error('خطأ في تصدير الجدول:', error);
      alert('حدث خطأ أثناء تصدير الجدول');
    }
  };

  // تصدير الجدول إلى Excel
  const { settings: printSettingsHook } = usePrintSettings();

  const exportGroupScheduleToExcel = async () => {
    if (!selectedGroup || !currentYear || !currentSemester) {
      alert('يرجى اختيار فوجاً أولاً');
      return;
    }

    try {
      const groupData = groups.find(g => g.id === selectedGroup);
      if (!groupData) return;

      // تحضير بيانات الجدول
      const tableData: any[][] = [];

      timeSlots.forEach((timeSlot) => {
        const rowData: any[] = [];

        activeDays.forEach((day) => {
          const assignment = groupAssignments.find(a =>
            a.day_of_week === day.id &&
            a.start_time === timeSlot.start
          );

          rowData.push(assignment ? [assignment] : []);
        });

        tableData.push(rowData);
      });

      const title = `الجدول الزمني - ${groupData.name}`;
      const subtitle = `${groupData.specialization || ''} - ${currentYear.year_name} - ${currentSemester.semester_name}`;
      const dayNames = activeDays.map(d => d.name);

      await exportScheduleToExcel(
        tableData,
        dayNames,
        timeSlots.map(ts => ({ start: ts.start, end: ts.end })),
        title,
        subtitle,
        printSettingsHook
      );
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('حدث خطأ أثناء التصدير إلى Excel');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">جاري التحميل...</div>
      </div>
    );
  }

  if (error) {
    return <DatabaseErrorAlert error={error} onRetry={fetchData} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">جداول الأفواج</h1>
        <p className="text-gray-600">إدارة الجداول الزمنية للأفواج الدراسية</p>
      </div>

      {error && <DatabaseErrorAlert error={error} />}

      {/* فلاتر التخصص والمجموعة */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">اختيار التخصص والفوج</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* فلتر التخصص */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              التخصص
            </label>
            <select
              value={selectedSpecialization}
              onChange={(e) => {
                setSelectedSpecialization(e.target.value);
                setSelectedGroup(null); // إعادة تعيين المجموعة عند تغيير التخصص
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">جميع التخصصات</option>
              {specializations.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>

          {/* فلتر المجموعة */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الفوج
            </label>
            <select
              value={selectedGroup || ''}
              onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!selectedSpecialization}
            >
              <option value="">اختر الفوج</option>
              {filteredGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} {group.year ? `- ${group.year}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* معلومات إضافية */}
        {selectedSpecialization && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>التخصص المحدد:</strong> {selectedSpecialization}
              {filteredGroups.length > 0 && (
                <span className="mr-4">
                  <strong>عدد الأفواج:</strong> {filteredGroups.length}
                </span>
              )}
            </p>
          </div>
        )}

        {/* أزرار الطباعة والتصدير */}
        {selectedGroup && can('view', 'reports') && (
          <div className="mt-4 flex gap-3 justify-end">
            <button
              onClick={() => exportScheduleToPDF(false)}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 font-semibold"
            >
              🖨️ طباعة عادية
            </button>
            <button
              onClick={() => exportScheduleToPDF(true)}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 font-semibold"
            >
              📄 حفظ كـ PDF
            </button>
            <button
              onClick={exportGroupScheduleToExcel}
              className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center gap-2 font-semibold"
            >
              📊 تصدير Excel
            </button>
          </div>
        )}
      </div>

      {/* الجدول الزمني */}
      {selectedGroup && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className="border border-gray-300 p-3 bg-gray-100 w-24">
                  <Clock size={16} className="mx-auto" />
                </th>
                {DAYS.map(day => (
                  <th key={day.id} className="border border-gray-300 p-3 bg-gray-100 text-center min-w-[200px]">
                    {day.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(timeSlot => (
                <tr key={timeSlot.id}>
                  <td className="border border-gray-300 p-3 bg-gray-50 text-center font-medium">
                    <div className="text-sm">
                      {timeSlot.start}
                    </div>
                    <div className="text-xs text-gray-500">
                      {timeSlot.end}
                    </div>
                  </td>
                  {DAYS.map(day => (
                    <td key={`${day.id}-${timeSlot.id}`} className="border border-gray-300 p-0">
                      {renderScheduleCell(day.id, timeSlot)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!selectedGroup && (
        <div className="text-center py-12 text-gray-500">
          <Calendar size={48} className="mx-auto mb-4 opacity-50" />
          <p>يرجى اختيار مجموعة لعرض جدولها الزمني</p>
        </div>
      )}
    </div>
  );
}
