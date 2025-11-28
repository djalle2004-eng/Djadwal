import { useState, useEffect, useContext } from 'react';
import { AcademicYearContext } from '../context/AcademicYearContext';
import { useAssignments } from '../context/AssignmentContext';
import { usePermissions } from '../hooks/usePermissions';
import { ArrowLeftRight, Calendar, Clock, User, BookOpen, MapPin, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

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
}

interface SessionInfo extends Assignment {
  professor_name?: string;
  course_name?: string;
  group_name?: string;
  room_name?: string;
}

// أيام الأسبوع
const days = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' }
];

// الفترات الزمنية
const timeSlots = [
  { id: 0, label: '8.00 - 9.30', start: '08:00', end: '09:30' },
  { id: 1, label: '9.30 - 11.00', start: '09:30', end: '11:00' },
  { id: 2, label: '11.00 - 12.30', start: '11:00', end: '12:30' },
  { id: 3, label: '12.30 - 14.00', start: '12:30', end: '14:00' },
  { id: 4, label: '14.00 - 15.30', start: '14:00', end: '15:30' },
  { id: 5, label: '15.30 - 17.00', start: '15:30', end: '17:00' }
];

export default function SessionSwap() {
  // الصلاحيات
  const { can } = usePermissions();
  
  // الحالة المحلية
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionInfo[]>([]);
  
  // حالات التبديل
  const [selectedSession1, setSelectedSession1] = useState<SessionInfo | null>(null);
  const [selectedSession2, setSelectedSession2] = useState<SessionInfo | null>(null);
  const [swapResult, setSwapResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // حالات التصفية
  const [filterProfessor, setFilterProfessor] = useState<string>('');
  const [filterCourse, setFilterCourse] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterTime, setFilterTime] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // الحصول على السياق الأكاديمي
  const academicYearContext = useContext(AcademicYearContext);
  const currentYear = academicYearContext?.currentYear;
  const currentSemester = academicYearContext?.currentSemester;

  // استخدام السياق للتعامل مع التكاليف
  const { assignments: contextAssignments, refreshAssignments, updateAssignment } = useAssignments();

  // تحميل البيانات عند بدء التشغيل
  useEffect(() => {
    if (currentYear && currentSemester) {
      fetchData();
    }
  }, [currentYear, currentSemester]);

  // تحديث الجلسات عند تغيير التكاليف
  useEffect(() => {
    if (contextAssignments.length > 0) {
      prepareSessions();
    }
  }, [contextAssignments, professors, courses, rooms, groups]);

  // تطبيق التصفية
  useEffect(() => {
    applyFilters();
  }, [sessions, filterProfessor, filterCourse, filterDay, filterTime]);

  // جلب البيانات من قاعدة البيانات
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [fetchedGroups, fetchedCourses, fetchedProfessors, fetchedRooms] = await Promise.all([
        window.db.getGroups(),
        window.db.getCourses(),
        window.db.getProfessors(),
        window.db.getRooms()
      ]);

      setGroups(fetchedGroups);
      setCourses(fetchedCourses);
      setProfessors(fetchedProfessors);
      setRooms(fetchedRooms);

      await refreshAssignments();
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("خطأ في تحميل البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  // تحضير بيانات الجلسات
  const prepareSessions = () => {
    const yearSemesterFilteredAssignments = contextAssignments.filter(assignment => 
      (assignment.academic_year === currentYear?.year_name || !assignment.academic_year) &&
      (assignment.semester === currentSemester?.semester_name || !assignment.semester)
    );

    const sessionsWithDetails: SessionInfo[] = yearSemesterFilteredAssignments.map(assignment => {
      const professor = professors.find(p => p.id === assignment.professor_id);
      const course = courses.find(c => c.id === assignment.course_id);
      const group = groups.find(g => g.id === assignment.group_id);
      const room = rooms.find(r => r.id === assignment.room_id);

      return {
        ...assignment,
        professor_name: professor?.name || 'غير محدد',
        course_name: course?.name || 'غير محدد',
        group_name: group?.name || 'غير محدد',
        room_name: room?.name || 'غير محدد'
      };
    });

    setSessions(sessionsWithDetails);
  };

  // تطبيق التصفية
  const applyFilters = () => {
    let filtered = sessions;

    if (filterProfessor) {
      filtered = filtered.filter(session => 
        session.professor_name?.toLowerCase().includes(filterProfessor.toLowerCase())
      );
    }

    if (filterCourse) {
      filtered = filtered.filter(session => 
        session.course_name?.toLowerCase().includes(filterCourse.toLowerCase())
      );
    }

    if (filterDay) {
      filtered = filtered.filter(session => 
        session.day_of_week === parseInt(filterDay)
      );
    }

    if (filterTime) {
      const timeSlot = timeSlots.find(t => t.id === parseInt(filterTime));
      if (timeSlot) {
        filtered = filtered.filter(session => 
          session.start_time === timeSlot.start && session.end_time === timeSlot.end
        );
      }
    }

    setFilteredSessions(filtered);
  };

  // التحقق من إمكانية التبديل
  const canSwapSessions = (session1: SessionInfo, session2: SessionInfo): { canSwap: boolean; conflicts: string[] } => {
    const conflicts: string[] = [];

    // الحصول على الجلسات الأخرى (باستثناء الجلستين المحددتين للتبديل)
    const otherSessions = sessions.filter(s => s.id !== session1.id && s.id !== session2.id);

    // التحقق من أن الأستاذ ليس "غير محدد" قبل فحص التعارض
    const isUnspecifiedProfessor = (professorName: string | undefined) => {
      return !professorName || professorName === 'غير محدد' || professorName === 'أستاذ غير محدد';
    };

    // التحقق من تعارض الأستاذ الأول في موقع الثاني (نفس الوقت واليوم)
    // تجاهل التعارض إذا كان الأستاذ "غير محدد"
    if (!isUnspecifiedProfessor(session1.professor_name)) {
      const conflictWithProfessor1InSession2Position = otherSessions.find(s => 
        s.day_of_week === session2.day_of_week &&
        s.start_time === session2.start_time &&
        s.end_time === session2.end_time &&
        s.professor_id === session1.professor_id
      );

      if (conflictWithProfessor1InSession2Position) {
        const dayName = days.find(d => d.id === session2.day_of_week)?.name || 'غير محدد';
        conflicts.push(`الأستاذ ${session1.professor_name} لديه جلسة أخرى (${conflictWithProfessor1InSession2Position.course_name}) يوم ${dayName} في ${session2.start_time}-${session2.end_time}`);
      }
    }

    // التحقق من تعارض الأستاذ الثاني في موقع الأول (نفس الوقت واليوم)
    // تجاهل التعارض إذا كان الأستاذ "غير محدد"
    if (!isUnspecifiedProfessor(session2.professor_name)) {
      const conflictWithProfessor2InSession1Position = otherSessions.find(s => 
        s.day_of_week === session1.day_of_week &&
        s.start_time === session1.start_time &&
        s.end_time === session1.end_time &&
        s.professor_id === session2.professor_id
      );

      if (conflictWithProfessor2InSession1Position) {
        const dayName = days.find(d => d.id === session1.day_of_week)?.name || 'غير محدد';
        conflicts.push(`الأستاذ ${session2.professor_name} لديه جلسة أخرى (${conflictWithProfessor2InSession1Position.course_name}) يوم ${dayName} في ${session1.start_time}-${session1.end_time}`);
      }
    }

    // التحقق من أن المجموعة في الحصة الأولى لا تتعارض مع الأستاذ الجديد
    // تجاهل التعارض إذا كان الأستاذ الجديد "غير محدد"
    if (!isUnspecifiedProfessor(session2.professor_name)) {
      const groupConflictInSession1 = otherSessions.find(s => 
        s.day_of_week === session1.day_of_week &&
        s.start_time === session1.start_time &&
        s.end_time === session1.end_time &&
        s.group_id === session1.group_id &&
        s.professor_id !== session1.professor_id &&
        !isUnspecifiedProfessor(s.professor_name)
      );

      if (groupConflictInSession1) {
        const dayName = days.find(d => d.id === session1.day_of_week)?.name || 'غير محدد';
        const conflictProfessor = professors.find(p => p.id === groupConflictInSession1.professor_id);
        conflicts.push(`المجموعة ${session1.group_name} لديها جلسة أخرى مع الأستاذ ${conflictProfessor?.name || 'غير محدد'} يوم ${dayName} في ${session1.start_time}-${session1.end_time}`);
      }
    }

    // التحقق من أن المجموعة في الحصة الثانية لا تتعارض مع الأستاذ الجديد
    // تجاهل التعارض إذا كان الأستاذ الجديد "غير محدد"
    if (!isUnspecifiedProfessor(session1.professor_name)) {
      const groupConflictInSession2 = otherSessions.find(s => 
        s.day_of_week === session2.day_of_week &&
        s.start_time === session2.start_time &&
        s.end_time === session2.end_time &&
        s.group_id === session2.group_id &&
        s.professor_id !== session2.professor_id &&
        !isUnspecifiedProfessor(s.professor_name)
      );

      if (groupConflictInSession2) {
        const dayName = days.find(d => d.id === session2.day_of_week)?.name || 'غير محدد';
        const conflictProfessor = professors.find(p => p.id === groupConflictInSession2.professor_id);
        conflicts.push(`المجموعة ${session2.group_name} لديها جلسة أخرى مع الأستاذ ${conflictProfessor?.name || 'غير محدد'} يوم ${dayName} في ${session2.start_time}-${session2.end_time}`);
      }
    }

    return { canSwap: conflicts.length === 0, conflicts };
  };

  // تنفيذ التبديل
  const executeSwap = async () => {
    if (!selectedSession1 || !selectedSession2) return;

    try {
      setIsLoading(true);
      setError(null);

      // التحقق من إمكانية التبديل
      const { canSwap, conflicts } = canSwapSessions(selectedSession1, selectedSession2);
      
      if (!canSwap) {
        setSwapResult({
          success: false,
          message: `لا يمكن تنفيذ التبديل:\n${conflicts.join('\n')}`
        });
        return;
      }

      // إنشاء نسخ محدثة من الجلسات - تبديل الأساتذة والمقاييس فقط
      const updatedSession1: Assignment = {
        ...selectedSession1,
        professor_id: selectedSession2.professor_id,
        course_id: selectedSession2.course_id
        // الوقت واليوم والقاعة والمجموعة تبقى كما هي
      };

      const updatedSession2: Assignment = {
        ...selectedSession2,
        professor_id: selectedSession1.professor_id,
        course_id: selectedSession1.course_id
        // الوقت واليوم والقاعة والمجموعة تبقى كما هي
      };

      // تحديث الجلسات في قاعدة البيانات
      if (selectedSession1.id && selectedSession2.id) {
        await updateAssignment(selectedSession1.id, updatedSession1);
        await updateAssignment(selectedSession2.id, updatedSession2);

        // تحديث البيانات
        await refreshAssignments();

        setSwapResult({
          success: true,
          message: `تم تبديل الأساتذة والمقاييس بنجاح!\n• ${selectedSession2.professor_name} سيدرس ${selectedSession2.course_name} للمجموعة ${selectedSession1.group_name}\n• ${selectedSession1.professor_name} سيدرس ${selectedSession1.course_name} للمجموعة ${selectedSession2.group_name}`
        });

        // إعادة تعيين الاختيارات
        setSelectedSession1(null);
        setSelectedSession2(null);
      }
    } catch (error) {
      console.error("Error swapping sessions:", error);
      setSwapResult({
        success: false,
        message: 'خطأ في تنفيذ التبديل'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // مسح الاختيارات
  const clearSelections = () => {
    setSelectedSession1(null);
    setSelectedSession2(null);
    setSwapResult(null);
  };

  // مسح التصفية
  const clearFilters = () => {
    setFilterProfessor('');
    setFilterCourse('');
    setFilterDay('');
    setFilterTime('');
  };

  // عرض معلومات الجلسة
  const renderSessionCard = (session: SessionInfo, isSelected: boolean, onClick: () => void) => {
    const dayName = days.find(d => d.id === session.day_of_week)?.name || 'غير محدد';
    const timeSlot = `${session.start_time} - ${session.end_time}`;

    return (
      <div
        key={session.id}
        className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
          isSelected 
            ? 'border-blue-500 bg-blue-50 shadow-md' 
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">{session.course_name}</h3>
          {isSelected && <CheckCircle className="w-5 h-5 text-blue-500" />}
        </div>
        
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex items-center">
            <User className="w-4 h-4 ml-2" />
            <span>{session.professor_name}</span>
          </div>
          <div className="flex items-center">
            <BookOpen className="w-4 h-4 ml-2" />
            <span>{session.group_name}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 ml-2" />
            <span>{session.room_name}</span>
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 ml-2" />
            <span>{dayName}</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 ml-2" />
            <span>{timeSlot}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">نظام تبديل الأساتذة والمقاييس</h1>
        <button
          onClick={fetchData}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md flex items-center"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث البيانات
        </button>
      </div>

      {/* معلومات السنة والفصل */}
      <div className="bg-white p-4 mb-6 rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-lg font-semibold">
            السنة الأكاديمية: <span className="text-indigo-600">{currentYear?.year_name || 'غير محدد'}</span> | 
            الفصل: <span className="text-indigo-600">{currentSemester?.semester_name || 'غير محدد'}</span>
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            يتيح لك هذا النظام تبديل الأساتذة والمقاييس بين الحصص مع الحفاظ على نفس الوقت والقاعة والمجموعة
          </p>
        </div>
      </div>

      {/* أدوات التصفية */}
      <div className="bg-white p-4 mb-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">تصفية الحصص</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الأستاذ</label>
            <input
              type="text"
              value={filterProfessor}
              onChange={(e) => setFilterProfessor(e.target.value)}
              placeholder="ابحث عن أستاذ..."
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المقرر</label>
            <input
              type="text"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              placeholder="ابحث عن مقرر..."
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اليوم</label>
            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">جميع الأيام</option>
              {days.map(day => (
                <option key={day.id} value={day.id}>{day.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الوقت</label>
            <select
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">جميع الأوقات</option>
              {timeSlots.map(slot => (
                <option key={slot.id} value={slot.id}>{slot.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={clearFilters}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
          >
            مسح التصفية
          </button>
        </div>
      </div>

      {/* منطقة التبديل */}
      <div className="bg-white p-6 mb-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">منطقة تبديل الأساتذة والمقاييس</h3>
        <p className="text-sm text-gray-600 mb-4">
          اختر حصتين لتبديل الأساتذة والمقاييس بينهما. سيتم الحفاظ على نفس الوقت والقاعة والمجموعة لكل حصة.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* الحصة الأولى */}
          <div className="text-center">
            <h4 className="font-medium mb-3">الحصة الأولى</h4>
            {selectedSession1 ? (
              <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50">
                <div className="font-semibold">{selectedSession1.course_name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  الأستاذ: {selectedSession1.professor_name}<br/>
                  المجموعة: {selectedSession1.group_name}<br/>
                  {days.find(d => d.id === selectedSession1.day_of_week)?.name} - {selectedSession1.start_time}
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                اختر الحصة الأولى
              </div>
            )}
          </div>

          {/* أيقونة التبديل */}
          <div className="text-center">
            <ArrowLeftRight className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-xs text-gray-500 mt-1">تبديل الأساتذة والمقاييس</p>
          </div>

          {/* الحصة الثانية */}
          <div className="text-center">
            <h4 className="font-medium mb-3">الحصة الثانية</h4>
            {selectedSession2 ? (
              <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50">
                <div className="font-semibold">{selectedSession2.course_name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  الأستاذ: {selectedSession2.professor_name}<br/>
                  المجموعة: {selectedSession2.group_name}<br/>
                  {days.find(d => d.id === selectedSession2.day_of_week)?.name} - {selectedSession2.start_time}
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                اختر الحصة الثانية
              </div>
            )}
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex justify-center space-x-4 mt-6">
          <button
            onClick={executeSwap}
            disabled={!can('update', 'sessions') || !selectedSession1 || !selectedSession2 || isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-md flex items-center"
            title={!can('update', 'sessions') ? 'ليس لديك صلاحية تعديل الحصص' : ''}
          >
            <ArrowLeftRight className="w-4 h-4 ml-2" />
            {isLoading ? 'جاري التبديل...' : 'تبديل الأساتذة والمقاييس'}
          </button>
          <button
            onClick={clearSelections}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md"
          >
            مسح الاختيارات
          </button>
        </div>

        {/* نتيجة التبديل */}
        {swapResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            swapResult.success ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'
          }`}>
            <div className="flex items-center">
              {swapResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 ml-2" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 ml-2" />
              )}
              <div className={`${swapResult.success ? 'text-green-800' : 'text-red-800'} whitespace-pre-line`}>
                {swapResult.message}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* قائمة الحصص */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">
          قائمة الحصص ({filteredSessions.length} حصة)
        </h3>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">جاري تحميل الحصص...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map(session => 
              renderSessionCard(
                session,
                selectedSession1?.id === session.id || selectedSession2?.id === session.id,
                () => {
                  if (selectedSession1?.id === session.id) {
                    setSelectedSession1(null);
                  } else if (selectedSession2?.id === session.id) {
                    setSelectedSession2(null);
                  } else if (!selectedSession1) {
                    setSelectedSession1(session);
                    setSwapResult(null);
                  } else if (!selectedSession2) {
                    setSelectedSession2(session);
                    setSwapResult(null);
                  } else {
                    // إذا كانت الحصتان محددتان، استبدل الأولى
                    setSelectedSession1(session);
                    setSelectedSession2(null);
                    setSwapResult(null);
                  }
                }
              )
            )}
          </div>
        )}

        {!isLoading && filteredSessions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            لا توجد حصص متاحة
          </div>
        )}
      </div>
    </div>
  );
}
