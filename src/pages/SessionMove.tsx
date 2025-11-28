import { useState, useEffect, useContext } from 'react';
import { AcademicYearContext } from '../context/AcademicYearContext';
import { useAssignments } from '../context/AssignmentContext';
import { usePermissions } from '../hooks/usePermissions';
import { Move, Calendar, Clock, User, BookOpen, MapPin, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

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

interface AvailableRoom {
  id: number;
  name: string;
  capacity?: number;
  isRecommended: boolean;
  conflictReason?: string;
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

export default function SessionMove() {
  // الصلاحيات
  const { can } = usePermissions();
  
  // الحالة المحلية
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionInfo[]>([]);
  
  // حالات النقل
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [targetDay, setTargetDay] = useState<number>(-1);
  const [targetTimeSlot, setTargetTimeSlot] = useState<number>(-1);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number>(-1);
  const [moveResult, setMoveResult] = useState<{ success: boolean; message: string } | null>(null);
  
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

  // البحث عن القاعات المتاحة عند تغيير اليوم أو الوقت
  useEffect(() => {
    if (targetDay !== -1 && targetTimeSlot !== -1) {
      findAvailableRooms();
    } else {
      setAvailableRooms([]);
      setSelectedRoom(-1);
    }
  }, [targetDay, targetTimeSlot, selectedSession, sessions]);

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

  // التحقق من أن الأستاذ ليس "غير محدد" أو "غير معين"
  const isUnspecifiedProfessor = (professorName: string | undefined) => {
    if (!professorName) return true;
    
    const normalizedName = professorName.toLowerCase().trim();
    
    // قائمة بأسماء الأساتذة غير المحددين
    const unspecifiedPatterns = [
      'غير محدد',
      'غير معين',
      'أستاذ غير',
      'unspecified',
      'not assigned',
      'undefined',
      'null'
    ];
    
    return unspecifiedPatterns.some(pattern => 
      normalizedName.includes(pattern.toLowerCase())
    );
  };

  // البحث عن القاعات المتاحة
  const findAvailableRooms = () => {
    if (!selectedSession || targetDay === -1 || targetTimeSlot === -1) {
      setAvailableRooms([]);
      return;
    }

    const targetTimeSlotData = timeSlots.find(t => t.id === targetTimeSlot);
    if (!targetTimeSlotData) {
      setAvailableRooms([]);
      return;
    }

    const availableRoomsList: AvailableRoom[] = rooms.map(room => {
      let isRecommended = true;
      let conflictReason = '';

      // فحص تعارض القاعة في الوقت المحدد
      const roomConflict = sessions.find(s => 
        s.id !== selectedSession.id &&
        s.room_id === room.id &&
        s.day_of_week === targetDay &&
        s.start_time === targetTimeSlotData.start &&
        s.end_time === targetTimeSlotData.end
      );

      if (roomConflict) {
        isRecommended = false;
        conflictReason = `محجوزة للمجموعة ${roomConflict.group_name} - ${roomConflict.course_name}`;
      }

      // فحص تعارض الأستاذ (إذا لم يكن "غير محدد" أو "غير معين")
      const isProfessorUnspecified = isUnspecifiedProfessor(selectedSession.professor_name);
      console.log('Professor check:', {
        professorName: selectedSession.professor_name,
        isUnspecified: isProfessorUnspecified,
        roomName: room.name
      });
      
      if (isRecommended && !isProfessorUnspecified) {
        const professorConflict = sessions.find(s => 
          s.id !== selectedSession.id &&
          s.professor_id === selectedSession.professor_id &&
          s.day_of_week === targetDay &&
          s.start_time === targetTimeSlotData.start &&
          s.end_time === targetTimeSlotData.end
        );

        if (professorConflict) {
          isRecommended = false;
          conflictReason = `الأستاذ ${selectedSession.professor_name} لديه حصة أخرى`;
          console.log('Professor conflict found:', {
            professorName: selectedSession.professor_name,
            conflictingSession: professorConflict
          });
        }
      } else if (isProfessorUnspecified) {
        console.log('Skipping professor conflict check for unspecified professor:', selectedSession.professor_name);
      }

      // فحص تعارض المجموعة
      if (isRecommended) {
        const groupConflict = sessions.find(s => 
          s.id !== selectedSession.id &&
          s.group_id === selectedSession.group_id &&
          s.day_of_week === targetDay &&
          s.start_time === targetTimeSlotData.start &&
          s.end_time === targetTimeSlotData.end
        );

        if (groupConflict) {
          isRecommended = false;
          conflictReason = `المجموعة ${selectedSession.group_name} لديها حصة أخرى`;
        }
      }

      return {
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        isRecommended,
        conflictReason: conflictReason || undefined
      };
    });

    // ترتيب القاعات: المتاحة أولاً ثم المحجوزة
    const sortedRooms = availableRoomsList.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return a.name.localeCompare(b.name);
    });

    setAvailableRooms(sortedRooms);
  };

  // تنفيذ عملية النقل
  const executeMove = async () => {
    if (!selectedSession || targetDay === -1 || targetTimeSlot === -1 || selectedRoom === -1) {
      setMoveResult({
        success: false,
        message: 'يرجى اختيار جميع البيانات المطلوبة'
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const targetTimeSlotData = timeSlots.find(t => t.id === targetTimeSlot);
      if (!targetTimeSlotData) {
        throw new Error('فترة زمنية غير صحيحة');
      }

      // إنشاء نسخة محدثة من الحصة
      const updatedSession: Assignment = {
        ...selectedSession,
        day_of_week: targetDay,
        start_time: targetTimeSlotData.start,
        end_time: targetTimeSlotData.end,
        room_id: selectedRoom
      };

      // تحديث الحصة في قاعدة البيانات
      if (selectedSession.id) {
        await updateAssignment(selectedSession.id, updatedSession);
        await refreshAssignments();

        const dayName = days.find(d => d.id === targetDay)?.name || 'غير محدد';
        const roomName = rooms.find(r => r.id === selectedRoom)?.name || 'غير محدد';
        
        setMoveResult({
          success: true,
          message: `تم نقل الحصة بنجاح!\n• المقرر: ${selectedSession.course_name}\n• الأستاذ: ${selectedSession.professor_name}\n• المجموعة: ${selectedSession.group_name}\n• اليوم الجديد: ${dayName}\n• الوقت الجديد: ${targetTimeSlotData.label}\n• القاعة الجديدة: ${roomName}`
        });

        // إعادة تعيين الاختيارات
        clearSelections();
      }
    } catch (error) {
      console.error("Error moving session:", error);
      setMoveResult({
        success: false,
        message: 'خطأ في نقل الحصة'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // مسح الاختيارات
  const clearSelections = () => {
    setSelectedSession(null);
    setTargetDay(-1);
    setTargetTimeSlot(-1);
    setSelectedRoom(-1);
    setMoveResult(null);
  };

  // مسح التصفية
  const clearFilters = () => {
    setFilterProfessor('');
    setFilterCourse('');
    setFilterDay('');
    setFilterTime('');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">نظام نقل الحصص</h1>
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
            يتيح لك هذا النظام نقل الحصص إلى يوم ووقت جديد مع اقتراح القاعات المتاحة
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

      {/* منطقة النقل */}
      <div className="bg-white p-6 mb-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">منطقة نقل الحصة</h3>
        <p className="text-sm text-gray-600 mb-4">
          اختر حصة لنقلها، ثم حدد اليوم والوقت الجديد، وأخيراً اختر القاعة المناسبة
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* الحصة المحددة */}
          <div className="text-center">
            <h4 className="font-medium mb-3">الحصة المحددة</h4>
            {selectedSession ? (
              <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50">
                <div className="font-semibold">{selectedSession.course_name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  الأستاذ: {selectedSession.professor_name}<br/>
                  المجموعة: {selectedSession.group_name}<br/>
                  {days.find(d => d.id === selectedSession.day_of_week)?.name} - {selectedSession.start_time}
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                اختر حصة من القائمة أدناه
              </div>
            )}
          </div>

          {/* الوجهة الجديدة */}
          <div className="text-center">
            <h4 className="font-medium mb-3">الوجهة الجديدة</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اليوم الجديد</label>
                <select
                  value={targetDay}
                  onChange={(e) => setTargetDay(parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  disabled={!selectedSession}
                >
                  <option value={-1}>اختر اليوم</option>
                  {days.map(day => (
                    <option key={day.id} value={day.id}>{day.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوقت الجديد</label>
                <select
                  value={targetTimeSlot}
                  onChange={(e) => setTargetTimeSlot(parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  disabled={!selectedSession || targetDay === -1}
                >
                  <option value={-1}>اختر الوقت</option>
                  {timeSlots.map(slot => (
                    <option key={slot.id} value={slot.id}>{slot.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* القاعة المختارة */}
          <div className="text-center">
            <h4 className="font-medium mb-3">القاعة المختارة</h4>
            {selectedRoom !== -1 ? (
              <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50">
                <div className="font-semibold">
                  {rooms.find(r => r.id === selectedRoom)?.name || 'غير محدد'}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  السعة: {rooms.find(r => r.id === selectedRoom)?.capacity || 'غير محدد'}
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                {targetDay !== -1 && targetTimeSlot !== -1 ? 
                  'اختر قاعة من القائمة أدناه' : 
                  'حدد اليوم والوقت أولاً'
                }
              </div>
            )}
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex justify-center space-x-4 mt-6">
          <button
            onClick={executeMove}
            disabled={!can('update', 'sessions') || !selectedSession || targetDay === -1 || targetTimeSlot === -1 || selectedRoom === -1 || isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-md flex items-center"
            title={!can('update', 'sessions') ? 'ليس لديك صلاحية تعديل الحصص' : ''}
          >
            <Move className="w-4 h-4 ml-2" />
            {isLoading ? 'جاري النقل...' : 'نقل الحصة'}
          </button>
          <button
            onClick={clearSelections}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md"
          >
            مسح الاختيارات
          </button>
        </div>

        {/* نتيجة النقل */}
        {moveResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            moveResult.success ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'
          }`}>
            <div className="flex items-center">
              {moveResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 ml-2" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 ml-2" />
              )}
              <div className={`${moveResult.success ? 'text-green-800' : 'text-red-800'} whitespace-pre-line`}>
                {moveResult.message}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* القاعات المتاحة */}
      {availableRooms.length > 0 && (
        <div className="bg-white p-6 mb-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            القاعات المتاحة ({availableRooms.filter(r => r.isRecommended).length} متاحة، {availableRooms.filter(r => !r.isRecommended).length} محجوزة)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableRooms.map(room => (
              <div
                key={room.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedRoom === room.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : room.isRecommended
                    ? 'border-green-300 bg-green-50 hover:border-green-400'
                    : 'border-red-300 bg-red-50 hover:border-red-400'
                }`}
                onClick={() => setSelectedRoom(room.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{room.name}</h4>
                  {selectedRoom === room.id && <CheckCircle className="w-5 h-5 text-blue-500" />}
                  {room.isRecommended ? (
                    <span className="text-green-600 text-sm">✓ متاحة</span>
                  ) : (
                    <span className="text-red-600 text-sm">✗ محجوزة</span>
                  )}
                </div>
                
                <div className="text-sm text-gray-600">
                  <div className="flex items-center mb-1">
                    <MapPin className="w-4 h-4 ml-1" />
                    <span>السعة: {room.capacity || 'غير محدد'}</span>
                  </div>
                  {room.conflictReason && (
                    <div className="text-red-600 text-xs mt-2">
                      {room.conflictReason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {filteredSessions.map(session => (
              <div
                key={session.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedSession?.id === session.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => {
                  if (selectedSession?.id === session.id) {
                    setSelectedSession(null);
                  } else {
                    setSelectedSession(session);
                    setMoveResult(null);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-lg">{session.course_name}</h4>
                  {selectedSession?.id === session.id && <CheckCircle className="w-5 h-5 text-blue-500" />}
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
                    <span>{days.find(d => d.id === session.day_of_week)?.name}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 ml-2" />
                    <span>{session.start_time} - {session.end_time}</span>
                  </div>
                </div>
              </div>
            ))}
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
