import { useState, useEffect, useContext } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
// تعليق استيرادات Firebase
// import { 
//   collection, 
//   getDocs, 
//   doc,
//   getDoc,
//   getCountFromServer
// } from 'firebase/firestore';
// import { db } from '../lib/firebase';
import { Users, BookOpen, DoorOpen, Users2, CalendarClock, CalendarPlus, FileText, Clock, AlertTriangle } from 'lucide-react';
import { AcademicYearContext } from '../context/AcademicYearContext';
import packageJson from '../../package.json';

// واجهات البيانات

interface ProfessorTypeStats {
  name: string;
  value: number;
}

interface OverloadedProfessor {
  professorName: string;
  totalHours: number;
  limit: number;
}

interface SessionTypeStats {
  name: string;
  value: number;
}

interface PeakDayStats {
  day: string;
  count: number;
}

interface LevelStats {
  name: string;
  value: number;
}

interface Stats {
  professors: number;
  courses: number;
  rooms: number;
  sessions: number;
  groups: number;
  extraSessions: number;
  makeupSessions: number;
  examSessions: number;
}

interface LatestSession {
  id: number;
  course_id: number;
  professor_id: number;
  room_id: number;
  group_id: number;
  day_of_week: number;
  lecture_time: string;
  courseName?: string;
  professorName?: string;
  roomName?: string;
  groupName?: string;
}

interface RoomOccupancy {
  roomName: string;
  occupancyRate: number;
  totalSlots: number;
  usedSlots: number;
}

interface ProfessorWorkload {
  professorName: string;
  totalHours: number;
  sessionsCount: number;
}

interface DepartmentStats {
  departmentName: string;
  coursesCount: number;
  groupsCount: number;
  professorsCount: number;
  sessionsCount: number;
  tempSessions: number;
  permSessions: number;
  permLicence: number;
  permMaster: number;
  tempLicence: number;
  tempMaster: number;
}

interface DatabaseInfo {
  type: string;
  status: string;
  name: string;
  isCloud: boolean;
  hasConnectionString: boolean;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    professors: 0,
    courses: 0,
    rooms: 0,
    sessions: 0,
    groups: 0,
    extraSessions: 0,
    makeupSessions: 0,
    examSessions: 0
  });
  const [latestSessions, setLatestSessions] = useState<LatestSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomOccupancy, setRoomOccupancy] = useState<RoomOccupancy[]>([]);
  const [professorWorkload, setProfessorWorkload] = useState<ProfessorWorkload[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);

  const [profTypeStats, setProfTypeStats] = useState<ProfessorTypeStats[]>([]);
  const [overloadedProfs, setOverloadedProfs] = useState<OverloadedProfessor[]>([]);
  const [sessionTypeStats, setSessionTypeStats] = useState<SessionTypeStats[]>([]);
  const [peakDayStats, setPeakDayStats] = useState<PeakDayStats[]>([]);
  const [levelStats, setLevelStats] = useState<LevelStats[]>([]);

  const COLORS = ['#4f46e5', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

  const academicYearContext = useContext(AcademicYearContext);
  const currentYear = academicYearContext?.currentYear || null;
  const currentSemester = academicYearContext?.currentSemester || null;

  const handleDebugDatabase = async () => {
    try {
      const data = await window.electron.invoke('debug-database-content');
      setDebugData(data);
      setShowDebug(true);
      console.log('🔍 Debug Data:', data);
    } catch (error) {
      console.error('Debug error:', error);
      alert('فشل في جلب بيانات التشخيص');
    }
  };

  const handleFixSemesterNames = async () => {
    if (!confirm('هل تريد تحديث أسماء الفصول من "السـداسي" إلى "الفصل"؟\n\nسيتم مسح الإعدادات المحفوظة وإعادة تحميل الصفحة.')) {
      return;
    }

    try {
      const result = await window.electron.invoke('fix-semester-names');
      if (result.success) {
        // مسح localStorage لإجبار إعادة التحميل من قاعدة البيانات
        localStorage.removeItem('selectedSemester');
        localStorage.removeItem('selectedAcademicYear');

        alert('✅ تم تحديث أسماء الفصول بنجاح!\n\nسيتم إعادة تحميل الصفحة الآن.');
        window.location.reload();
      } else {
        alert('❌ فشل في تحديث أسماء الفصول: ' + result.error);
      }
    } catch (error) {
      console.error('Fix error:', error);
      alert('فشل في تحديث أسماء الفصول');
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // جلب معلومات قاعدة البيانات
        const databaseInfo = {
          type: 'Turso',
          status: 'متصل',
          name: 'Djadwal (Cloud)',
          isCloud: true,
          hasConnectionString: true
        };
        setDbInfo(databaseInfo);

        // استخدام SQLite بدلاً من Firebase
        const [
          professorsData,
          coursesData,
          roomsData,
          assignmentsData,
          groupsData,
          departmentsData,
          extraSessionsData,
        ] = await Promise.all([
          window.db.getProfessors(),
          window.db.getCourses(),
          window.db.getRooms(),
          window.db.getAssignments(),
          window.db.getGroups(),
          window.db.getDepartments(),
          window.db.getExtraSessions(),
        ]);

        // Filter assignments by current academic year and semester
        const filteredAssignments = assignmentsData?.filter((assignment: any) => {
          if (!currentYear || !currentSemester) return true; // Show all if no year/semester selected
          return assignment.academic_year === currentYear.year_name &&
            assignment.semester === currentSemester.semester_name;
        }) || [];

        setStats({
          professors: professorsData?.length || 0,
          courses: coursesData?.length || 0,
          rooms: roomsData?.length || 0,
          sessions: filteredAssignments.length,
          groups: groupsData?.length || 0,
          extraSessions: extraSessionsData?.filter((s: any) => s.session_type === 'extra').length || 0,
          makeupSessions: extraSessionsData?.filter((s: any) => s.session_type === 'makeup').length || 0,
          examSessions: extraSessionsData?.filter((s: any) => s.session_type === 'exam').length || 0
        });

        // جلب أحدث الجلسات من SQLite - استخدام البيانات المفلترة
        // نستخدم slice لأخذ آخر 5 عناصر فقط
        const assignments = filteredAssignments.slice(0, 5);

        // استخدام Promise.all لجلب البيانات المرتبطة لكل جلسة
        const fetchedSessions = await Promise.all(
          assignments.map(async (assignment: any) => {
            const sessionData: LatestSession = {
              id: assignment.id,
              course_id: assignment.course_id,
              professor_id: assignment.professor_id,
              room_id: assignment.room_id,
              group_id: assignment.group_id,
              day_of_week: assignment.day_of_week,
              lecture_time: assignment.lecture_time
            };

            // جلب التفاصيل المرتبطة
            // نحتاج لتصفية البيانات للعثور على العناصر المرتبطة
            const course = coursesData.find(c => c.id === assignment.course_id);
            const professor = professorsData.find(p => p.id === assignment.professor_id);
            const room = roomsData.find(r => r.id === assignment.room_id);
            const group = groupsData.find(g => g.id === assignment.group_id);

            // استخراج البيانات من النتائج
            sessionData.courseName = course ? course.name : 'Unknown Course';
            sessionData.professorName = professor
              ? `${(professor as any)["Academic Title"] || ''} ${(professor as any).name || ''}`.trim()
              : 'Unknown Professor';
            sessionData.roomName = room ? room.name : 'Unknown Room';
            sessionData.groupName = group ? group.name : 'Unknown Group';

            return sessionData;
          })
        );

        setLatestSessions(fetchedSessions);

        // Calculate room occupancy statistics
        const roomOccupancyStats = roomsData?.map((room: any) => {
          // Filter out Friday (day 5) as it's a holiday
          const roomAssignments = filteredAssignments.filter((assignment: any) =>
            assignment.room_id === room.id && assignment.day_of_week !== 5
          );
          const usedSlots = roomAssignments.length;
          // 6 working days (Sun-Sat except Friday) * 6 time slots per day = 36 total possible slots per week
          const totalSlots = 36;
          const occupancyRate = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

          return {
            roomName: room.name,
            usedSlots,
            totalSlots,
            occupancyRate
          };
        }).sort((a, b) => b.occupancyRate - a.occupancyRate) || [];

        setRoomOccupancy(roomOccupancyStats);

        // Calculate professor workload statistics
        const professorWorkloadStats = professorsData?.map((professor: any) => {
          const professorAssignments = filteredAssignments.filter((assignment: any) => assignment.professor_id === professor.id);
          const sessionsCount = professorAssignments.length;
          // Assuming each session is 1.5 hours on average
          const totalHours = sessionsCount * 1.5;

          return {
            professorName: `${professor["Academic Title"] || ''} ${professor.name || ''}`.trim(),
            sessionsCount,
            totalHours: Math.round(totalHours * 10) / 10 // Round to 1 decimal place
          };
        }).filter(prof => prof.sessionsCount > 0)
          .sort((a, b) => b.sessionsCount - a.sessionsCount) || [];

        setProfessorWorkload(professorWorkloadStats);

        // --- New Advanced Statistics ---
        const isProfessorTemporary = (professor: any) => {
          return professor.title?.includes('مؤقت') || professor.title?.includes('Vacataire') || false;
        };

        // Calculate department statistics
        const departmentStatsMap = new Map();

        departmentsData?.forEach((dept: any) => {
          // الأفواج المرتبطة بالقسم
          const deptGroups = groupsData?.filter((group: any) => group.department_id === dept.id) || [];

          // المقاييس المرتبطة بالقسم
          const deptCourses = coursesData?.filter((course: any) => course.department_id === dept.id) || [];

          // الأساتذة المدرّسين لهذا القسم (من خلال الحصص)
          const deptGroupIds = deptGroups.map((g: any) => g.id);
          const deptAssignments = filteredAssignments.filter((assignment: any) =>
            deptGroupIds.includes(assignment.group_id)
          );
          const deptProfessorIds = new Set(deptAssignments.map((a: any) => a.professor_id));
          const professorsCount = deptProfessorIds.size;

          let tempS = 0;
          let permS = 0;
          let permLicence = 0;
          let permMaster = 0;
          let tempLicence = 0;
          let tempMaster = 0;
          deptAssignments.forEach((assignment: any) => {
             const prof = professorsData?.find((p: any) => p.id === assignment.professor_id);
             const grp  = groupsData?.find((g: any) => g.id === assignment.group_id);
             const isTemp = prof ? isProfessorTemporary(prof) : false;
             const yearStr = grp?.year ? String(grp.year).toUpperCase() : '';
             const isLicence = yearStr.startsWith('L');
             const isMaster  = yearStr.startsWith('M');
             if (isTemp) {
                tempS++;
                if (isLicence) tempLicence++;
                else if (isMaster) tempMaster++;
             } else {
                permS++;
                if (isLicence) permLicence++;
                else if (isMaster) permMaster++;
             }
          });

          departmentStatsMap.set(dept.id, {
            departmentName: dept.name,
            groupsCount: deptGroups.length,
            coursesCount: deptCourses.length,
            professorsCount: professorsCount,
            sessionsCount: deptAssignments.length,
            tempSessions: tempS,
            permSessions: permS,
            permLicence,
            permMaster,
            tempLicence,
            tempMaster
          });
        });

        setDepartmentStats(Array.from(departmentStatsMap.values()));

        let tempHours = 0;
        let permHours = 0;
        let coursCount = 0;
        let tdCount = 0;
        let tpCount = 0;
        let licenceCount = 0;
        let masterCount = 0;
        
        const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        const profHoursMap = new Map<number, number>();

        filteredAssignments.forEach((assignment: any) => {
          const hours = 1.5;
          const currHours = profHoursMap.get(assignment.professor_id) || 0;
          profHoursMap.set(assignment.professor_id, currHours + hours);

          if (assignment.day_of_week !== undefined) {
            dayCounts[assignment.day_of_week] = (dayCounts[assignment.day_of_week] || 0) + 1;
          }

          if (assignment.session_type === 'lecture_group' || assignment.session_type === 'lecture') {
            coursCount++;
          } else if (assignment.session_type === 'tp') {
            tpCount++;
          } else {
            tdCount++;
          }

          const group = groupsData?.find((g: any) => g.id === assignment.group_id);
          if (group && group.year) {
             const yearStr = String(group.year).toUpperCase();
             if (yearStr.startsWith('L')) {
                licenceCount++;
             } else if (yearStr.startsWith('M')) {
                masterCount++;
             }
          }
        });

        professorsData?.forEach((prof: any) => {
          const hours = profHoursMap.get(prof.id) || 0;
          if (hours > 0) {
            if (isProfessorTemporary(prof)) {
              tempHours += hours;
            } else {
              permHours += hours;
            }
          }
        });

        setProfTypeStats([
          { name: 'أساتذة دائمين', value: Math.round(permHours * 10) / 10 },
          { name: 'أساتذة مؤقتين', value: Math.round(tempHours * 10) / 10 }
        ]);

        setSessionTypeStats([
          { name: 'محاضرات (Cours)', value: coursCount },
          { name: 'أعمال موجهة (TD)', value: tdCount },
          { name: 'أعمال تطبيقية (TP)', value: tpCount }
        ]);

        setLevelStats([
          { name: 'ليسانس', value: licenceCount },
          { name: 'ماستر', value: masterCount }
        ]);

        const overloaded: OverloadedProfessor[] = [];
        professorsData?.forEach((prof: any) => {
          if (!isProfessorTemporary(prof)) {
            const hours = profHoursMap.get(prof.id) || 0;
            const limit = 12; // Default legal limit
            if (hours > limit) {
              overloaded.push({
                professorName: `${prof["Academic Title"] || ''} ${prof.name || prof.first_name + ' ' + prof.last_name}`.trim(),
                totalHours: Math.round(hours * 10) / 10,
                limit
              });
            }
          }
        });
        setOverloadedProfs(overloaded.sort((a, b) => b.totalHours - a.totalHours));

        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const peakStats = Object.keys(dayCounts).map(day => ({
          day: dayNames[parseInt(day)],
          count: dayCounts[parseInt(day)]
        })).filter(d => d.count > 0);
        setPeakDayStats(peakStats);
        // --- End Advanced Statistics ---

        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to fetch dashboard data');
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentYear, currentSemester]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="min-h-full">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-gray-600">
                {currentYear && currentSemester ? (
                  <span>
                    السنة الدراسية: {currentYear.year_name} | الفصل: {currentSemester.semester_name}
                  </span>
                ) : (
                  <span className="text-red-500">لم يتم تحديد السنة الدراسية والفصل</span>
                )}
              </div>
              {dbInfo && (
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full ${dbInfo.status === 'متصل' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {dbInfo.status}
                  </span>
                  <span className="text-gray-600">
                    {dbInfo.name} ({dbInfo.type})
                  </span>
                  {dbInfo.isCloud && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">☁️ Cloud</span>
                  )}
                  <button
                    onClick={handleDebugDatabase}
                    className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full hover:bg-yellow-200 transition-colors"
                    title="عرض محتوى قاعدة البيانات"
                  >
                    🔍 Debug
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Debug Modal */}
      {showDebug && debugData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowDebug(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">🔍 محتوى قاعدة البيانات</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleFixSemesterNames}
                  className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors text-sm"
                >
                  🔧 إصلاح أسماء الفصول
                </button>
                <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded">
                <h3 className="font-bold mb-2">📅 السنوات الدراسية ({debugData.years?.length || 0}):</h3>
                <pre className="text-sm overflow-auto">{JSON.stringify(debugData.years, null, 2)}</pre>
              </div>

              <div className="bg-green-50 p-4 rounded">
                <h3 className="font-bold mb-2">📚 الفصول الدراسية ({debugData.semesters?.length || 0}):</h3>
                <pre className="text-sm overflow-auto">{JSON.stringify(debugData.semesters, null, 2)}</pre>
              </div>

              <div className="bg-yellow-50 p-4 rounded">
                <h3 className="font-bold mb-2">📊 إجمالي التكاليف: {debugData.assignmentsCount}</h3>
                <p className="text-sm text-gray-600 mb-2">عينة من أول 3 تكاليف:</p>
                <pre className="text-sm overflow-auto">{JSON.stringify(debugData.sampleAssignments, null, 2)}</pre>
              </div>

              {debugData.error && (
                <div className="bg-red-50 p-4 rounded">
                  <h3 className="font-bold mb-2 text-red-800">❌ خطأ:</h3>
                  <p className="text-sm text-red-600">{debugData.error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Professors</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.professors}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BookOpen className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Courses</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.courses}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DoorOpen className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Rooms</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.rooms}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users2 className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Groups</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.groups}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CalendarClock className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Sessions</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.sessions}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarPlus className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Extra Sessions</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.extraSessions}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-orange-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Makeup Sessions</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.makeupSessions}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Exam Sessions</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.examSessions}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Analytics Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Department Sessions Chart - by type & level */}
          <div className="bg-white shadow rounded-lg p-5 lg:col-span-2">
            <h2 className="text-lg font-medium text-gray-900 mb-4">الحصص المبرمجة حسب القسم (مؤقتين/دائمين × ليسانس/ماستر)</h2>
            <div className="h-80 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentStats} margin={{ bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="departmentName"
                    tick={{ fontSize: 11, fill: '#374151' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis />
                  <RechartsTooltip
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        permLicence: 'دائمين – ليسانس',
                        permMaster:  'دائمين – ماستر',
                        tempLicence: 'مؤقتين – ليسانس',
                        tempMaster:  'مؤقتين – ماستر',
                      };
                      return [`${value} حصة`, labels[name as string] ?? name];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    payload={[
                      { value: 'دائمين – ليسانس', type: 'rect', color: '#4f46e5' },
                      { value: 'دائمين – ماستر',  type: 'rect', color: '#8b5cf6' },
                      { value: 'مؤقتين – ليسانس', type: 'rect', color: '#f59e0b' },
                      { value: 'مؤقتين – ماستر',  type: 'rect', color: '#ef4444' },
                    ]}
                  />
                  <Bar dataKey="permLicence" stackId="perm" fill="#4f46e5" name="permLicence" radius={[0,0,0,0]} />
                  <Bar dataKey="permMaster"  stackId="perm" fill="#8b5cf6" name="permMaster"  radius={[4,4,0,0]} />
                  <Bar dataKey="tempLicence" stackId="temp" fill="#f59e0b" name="tempLicence" radius={[0,0,0,0]} />
                  <Bar dataKey="tempMaster"  stackId="temp" fill="#ef4444" name="tempMaster"  radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Professor Types Pie Chart */}
          <div className="bg-white shadow rounded-lg p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4">توزيع ساعات التدريس (مؤقتين مقابل دائمين)</h2>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={profTypeStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {profTypeStats.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `${value} ساعة`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Level Stats Pie Chart */}
          <div className="bg-white shadow rounded-lg p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4">توزيع الحصص المبرمجة (ليسانس مقابل ماستر)</h2>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={levelStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#10b981"
                    dataKey="value"
                  >
                    {levelStats.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `${value} حصة`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Session Types Bar Chart */}
          <div className="bg-white shadow rounded-lg p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4">أنواع الجلسات المبرمجة</h2>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionTypeStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#4f46e5">
                    {sessionTypeStats.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak Days Heatmap (Bar Chart) */}
          <div className="bg-white shadow rounded-lg p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4">أيام الذروة (حسب عدد الحصص)</h2>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakDayStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="day" type="category" width={80} />
                  <RechartsTooltip formatter={(value) => `${value} حصة`} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overloaded Professors List */}
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-medium text-gray-900">الأساتذة متجاوزي النصاب ({'>'} 12 ساعة)</h2>
            </div>
            <div className="overflow-y-auto h-64 pr-2">
              <ul className="divide-y divide-gray-200">
                {overloadedProfs.map((prof, index) => (
                  <li key={index} className="py-3 flex justify-between items-center">
                    <div className="text-sm font-medium text-gray-900">{prof.professorName}</div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-red-500 h-2.5 rounded-full" 
                          style={{ width: `${Math.min((prof.totalHours / 20) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-red-600">{prof.totalHours} س</span>
                    </div>
                  </li>
                ))}
                {overloadedProfs.length === 0 && (
                  <li className="py-4 text-sm text-gray-500 text-center">لا يوجد أساتذة متجاوزين للنصاب.</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Latest Sessions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">Latest Sessions</h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {latestSessions.map((session) => (
                <li key={session.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-indigo-600">
                      {session.courseName || 'Unknown Course'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][session.day_of_week || 0] || 'Unknown Day'}{' '}
                      {session.lecture_time || 'Unknown Time'}
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="text-sm text-gray-500">
                        {session.professorName || 'Unknown Professor'} • {session.roomName || 'Unknown Room'}
                      </p>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 sm:mt-0">
                      {session.groupName || 'Unknown Group'}
                    </div>
                  </div>
                </li>
              ))}
              {latestSessions.length === 0 && (
                <li className="px-4 py-4 sm:px-6 text-sm text-gray-500">
                  No sessions found
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Room Occupancy */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">معدل إشغال القاعات</h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {roomOccupancy.slice(0, 10).map((room) => (
                <li key={room.roomName} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-indigo-600">
                      {room.roomName}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${room.occupancyRate > 70 ? 'bg-red-100 text-red-800' :
                        room.occupancyRate > 40 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                        {room.occupancyRate}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="text-sm text-gray-500">
                        الحصص المستخدمة: {room.usedSlots}
                      </p>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 sm:mt-0">
                      إجمالي الحصص: {room.totalSlots}
                    </div>
                  </div>
                </li>
              ))}
              {roomOccupancy.length === 0 && (
                <li className="px-4 py-4 sm:px-6 text-sm text-gray-500">
                  لا توجد بيانات إشغال القاعات
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Professor Workload */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">أعباء الأساتذة</h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {professorWorkload.slice(0, 10).map((professor) => (
                <li key={professor.professorName} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-indigo-600">
                      {professor.professorName}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${professor.totalHours > 20 ? 'bg-red-100 text-red-800' :
                        professor.totalHours > 10 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                        {professor.totalHours} ساعة
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="text-sm text-gray-500">
                        عدد الحصص: {professor.sessionsCount}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
              {professorWorkload.length === 0 && (
                <li className="px-4 py-4 sm:px-6 text-sm text-gray-500">
                  لا توجد بيانات أعباء الأساتذة
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Department Stats */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">إحصائيات الأقسام</h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {departmentStats.map((department) => (
                <li key={department.departmentName} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-indigo-600">
                      {department.departmentName}
                    </div>
                    <div className="text-sm text-gray-500">
                      المقررات: {department.coursesCount}
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="text-sm text-gray-500">
                        المجموعات: {department.groupsCount}
                      </p>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 sm:mt-0">
                      الأساتذة: {department.professorsCount}
                    </div>
                  </div>
                </li>
              ))}
              {departmentStats.length === 0 && (
                <li className="px-4 py-4 sm:px-6 text-sm text-gray-500">
                  لا توجد بيانات إحصائيات الأقسام
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 text-xs text-gray-400">
        الإصدار: {packageJson.version}
      </div>
    </div >
  );
};