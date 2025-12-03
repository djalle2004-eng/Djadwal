import { useState, useEffect } from 'react';
import { printContent } from '../utils/printUtils';
import html2canvas from 'html2canvas';
import DatabaseErrorAlert from '../components/DatabaseErrorAlert';
import { useAcademicYear } from '../context/AcademicYearContext';
import { useAssignments } from '../context/AssignmentContext';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Snackbar, Alert } from '@mui/material';
import { Email as EmailIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { emailService, EmailStatus } from '../services/emailService';
import EmailDialog from '../components/EmailDialog';
import EmailStatusTracker from '../components/EmailStatusTracker';
import { getPDFBlobFromHTML } from '../utils/printUtils';

// واجهة للأستاذ
interface Professor {
  id: number;
  name: string;
  title?: string;       // Titre professionnel (poste)
  academic_title?: string; // Titre académique (Dr., Prof., etc.)
  email?: string;
}

// واجهة للمقرر
interface Course {
  id: number;
  name: string;
  hours: number;
  specialization_id: number;
  specialization?: string;
  group_year?: string;
  year?: string;
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

  group_year?: string;  // إضافة حقل سنة المجموعة
  year?: string;
}

// واجهة لعبء العمل
interface ProfessorWorkloadData {
  professor: Professor;
  courses: {
    course: Course;
    hours: number;
    count: number;
    lectureCount: number;  // Nombre de cours magistraux
    tdCount: number;       // Nombre de travaux dirigés
    totalHours: number;
    specialization?: string;
    group_year?: string;
  }[];
  totalHours: number;
  totalLectureHours: number;  // Total des heures de cours magistraux
  totalTDHours: number;       // Total des heures de travaux dirigés
  days: {
    [key: string]: {
      count: number;
      hours: number;
      lectureCount: number;  // Nombre de cours magistraux par jour
      tdCount: number;       // Nombre de travaux dirigés par jour
    };
  };
}

// واجهة لليوم
interface Day {
  id: number;
  name: string;
}

// واجهة للمجموعة
interface Group {
  id: number;
  name: string;
  year: string;
  specialization?: string;
}

// واجهة للقاعة
interface Room {
  id: number;
  name: string;
}

// تحويل HTML إلى Blob باستخدام html2canvas
async function htmlToBlob(htmlContent: string): Promise<Blob | null> {
  try {
    // إنشاء عنصر div مؤقت للمحتوى HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    // التقاط صورة للمحتوى HTML
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false
    });

    // تنظيف العنصر المؤقت
    document.body.removeChild(tempDiv);

    // تحويل الصورة إلى Blob
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob: Blob | null) => {
        resolve(blob);
      }, 'image/png', 1.0);
    });
  } catch (error: any) {
    console.error('خطأ في تحويل HTML إلى Blob:', error);
    return null;
  }
}

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

  return year; // إرجاع السنة كما هي إذا لم تطابق النمط المتوقع
};

const translateAcademicTitle = (title: string): string => {
  const titles: { [key: string]: string } = {
    'Professor': 'أستاذ',
    'Associate Professor': 'أستاذ محاضر أ',
    'Assistant Professor': 'أستاذ محاضر ب',
    'Lecturer': 'أستاذ مساعد أ',
    'Assistant Lecturer': 'أستاذ مساعد ب',
    'Doctor': 'دكتور',
    'Master': 'ماستر',
    'Engineer': 'مهندس'
  };
  return titles[title] || title;
};

export default function ProfessorWorkload() {
  // الحالة
  const { currentYear, currentSemester, refreshCurrentSemester } = useAcademicYear();
  const { assignments } = useAssignments();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]); // إضافة حالة للمجموعات
  const [rooms, setRooms] = useState<Room[]>([]); // إضافة حالة للقاعات
  const [workloads, setWorkloads] = useState<ProfessorWorkloadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedProfessor, setSelectedProfessor] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [courseSearchTerm, setCourseSearchTerm] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  // إعدادات الطباعة
  const [printSettings, setPrintSettings] = useState({
    universityName: 'جامعة الشهيد حمه لخضر - الوادي',
    facultyName: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
    universityLogoUrl: '',
    facultyLogoUrl: ''
  });

  // Email State
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailStatusOpen, setEmailStatusOpen] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus[]>([]);
  const [isGmailAuthenticated, setIsGmailAuthenticated] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    checkGmailAuth();
  }, []);

  const checkGmailAuth = async () => {
    const authenticated = await emailService.checkAuthStatus();
    setIsGmailAuthenticated(authenticated);
  };

  const handleGmailSetup = async () => {
    try {
      const url = await emailService.initiateGmailAuth();
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      window.open(
        url,
        'Gmail Auth',
        `width=${width},height=${height},top=${top},left=${left}`
      );

      const interval = setInterval(async () => {
        const authenticated = await emailService.checkAuthStatus();
        if (authenticated) {
          setIsGmailAuthenticated(true);
          clearInterval(interval);
          setSnackbar({
            open: true,
            message: 'تم ربط Gmail بنجاح',
            severity: 'success'
          });
        }
      }, 2000);

      setTimeout(() => clearInterval(interval), 120000);
    } catch (error) {
      console.error('Error initiating Gmail auth:', error);
      setSnackbar({
        open: true,
        message: 'فشل في بدء عملية الربط',
        severity: 'error'
      });
    }
  };

  const generateProfessorSchedulePDF = async (professorId: number): Promise<Blob | null> => {
    const professor = professors.find(p => p.id === professorId);
    if (!professor) return null;

    const allDays = [
      { id: 0, name: 'السبت' },
      { id: 1, name: 'الأحد' },
      { id: 2, name: 'الاثنين' },
      { id: 3, name: 'الثلاثاء' },
      { id: 4, name: 'الأربعاء' },
      { id: 5, name: 'الخميس' },
      { id: 6, name: 'الجمعة' }
    ];

    const timeSlots = [
      { start: '08:00', end: '09:30' },
      { start: '09:30', end: '11:00' },
      { start: '11:00', end: '12:30' },
      { start: '12:30', end: '14:00' },
      { start: '14:00', end: '15:30' },
      { start: '15:30', end: '17:00' }
    ];

    const professorAssignments = assignments.filter(a => a.professor_id === professor.id);

    const activeDays = allDays.filter(day =>
      professorAssignments.some(a => a.day_of_week === day.id)
    );

    const activeTimeSlots = timeSlots.filter(timeSlot =>
      professorAssignments.some(a =>
        a.start_time === timeSlot.start && a.end_time === timeSlot.end
      )
    );

    if (activeDays.length === 0 || activeTimeSlots.length === 0) {
      return null;
    }

    let scheduleContent = `
      <table class="schedule-table">
        <thead>
          <tr>
            <th>التوقيت</th>
            ${activeDays.map(day => `<th>${day.name}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    activeTimeSlots.forEach(timeSlot => {
      scheduleContent += `<tr><td class="time-slot">${timeSlot.start} - ${timeSlot.end}</td>`;

      activeDays.forEach(day => {
        const assignment = professorAssignments.find(a =>
          a.day_of_week === day.id &&
          a.start_time === timeSlot.start && a.end_time === timeSlot.end
        );

        if (assignment) {
          const course = courses.find(c => c.id === assignment.course_id);
          const group = groups.find(g => g.id === assignment.group_id);
          const room = rooms.find(r => r.id === assignment.room_id);

          scheduleContent += `
            <td class="assignment-cell">
              <div class="course-name">${course?.name || 'مقياس غير محدد'}</div>
              <div class="group-info">${assignment.group_name || group?.name || 'مجموعة غير محددة'}</div>
              <div class="room-info">القاعة: ${room?.name || 'غير محددة'}</div>
              <div class="specialization-info">التخصص: ${assignment.specialization || group?.specialization || 'غير محدد'}</div>
            </td>
          `;
        } else {
          scheduleContent += '<td class="empty-cell">-</td>';
        }
      });

      scheduleContent += '</tr>';
    });

    scheduleContent += `
        </tbody>
      </table>
    `;

    const htmlContent = `
      <div class="professor-page">
        <div class="header">
          <div class="header-text">
            <p>${printSettings.universityName}</p>
            <p>${printSettings.facultyName}</p>
            <p>قسم: علوم التسيير</p>
          </div>
        </div>
        
        <div class="title">جدول توقيت الأستاذ: ${professor.name}</div>
        <div class="subtitle">
          ${professor.academic_title ? `الرتبة: ${translateAcademicTitle(professor.academic_title)}` : ''}
          ${professor.title ? ` - الصفة: ${professor.title}` : ''}
        </div>
        
        ${scheduleContent}
        
        <div class="footer">
          <div class="date-signature">
            حرر بتاريخ: ${new Date().toLocaleDateString('ar-DZ')}
          </div>
          <div class="signature">
            رئيس القسم
          </div>
        </div>
      </div>
    `;

    return await getPDFBlobFromHTML(htmlContent, {
      title: `جدول_${professor.name}`,
      orientation: 'landscape',
      pageSize: 'A4',
      pageMarginTop: 10,
      pageMarginBottom: 10,
      pageMarginLeft: 10,
      pageMarginRight: 10,
      customCSS: `
        .schedule-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .schedule-table th, .schedule-table td { border: 1px solid #000; padding: 5px; text-align: center; }
        .schedule-table th { background-color: #f0f0f0; font-weight: bold; }
        .assignment-cell { font-size: 11px; }
        .course-name { font-weight: bold; margin-bottom: 2px; }
        .group-info, .room-info, .specialization-info { font-size: 10px; }
        .title { font-size: 18px; font-weight: bold; text-align: center; margin: 15px 0; }
        .subtitle { font-size: 14px; text-align: center; margin-bottom: 15px; }
        .header { display: flex; justify-content: center; margin-bottom: 20px; text-align: center; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; }
      `
    });
  };

  const handleSendEmails = async (selectedIds: number[]) => {
    setIsSending(true);
    setEmailDialogOpen(false);
    setEmailStatusOpen(true);

    const statuses: EmailStatus[] = selectedIds.map(id => ({
      professorId: id,
      professorName: professors.find(p => p.id === id)?.name || '',
      email: professors.find(p => p.id === id)?.email || '',
      status: 'pending'
    }));

    setEmailStatus(statuses);

    for (let i = 0; i < selectedIds.length; i++) {
      const profId = selectedIds[i];

      setEmailStatus(prev => prev.map(s =>
        s.professorId === profId ? { ...s, status: 'sending' } : s
      ));

      try {
        const pdfBlob = await generateProfessorSchedulePDF(profId);
        if (!pdfBlob) {
          throw new Error('فشل في توليد ملف PDF (قد لا يوجد جدول)');
        }

        await emailService.sendProfessorSchedule(
          profId,
          pdfBlob,
          currentSemester?.semester_name || ''
        );

        setEmailStatus(prev => prev.map(s =>
          s.professorId === profId ? { ...s, status: 'sent' } : s
        ));
      } catch (error: any) {
        setEmailStatus(prev => prev.map(s =>
          s.professorId === profId
            ? { ...s, status: 'failed', error: error.message || 'خطأ غير معروف' }
            : s
        ));
      }

      if (i < selectedIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsSending(false);
  };

  // دوال البحث والفلترة للمقاييس
  const handleCourseSearch = (searchTerm: string) => {
    setCourseSearchTerm(searchTerm);
    if (searchTerm.trim()) {
      const filtered = allCourses.filter(course =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCourses(filtered);
      setIsCourseDropdownOpen(true);
    } else {
      setFilteredCourses([]);
      setIsCourseDropdownOpen(false);
    }
  };

  const selectCourse = (course: Course) => {
    setSelectedCourse(course.id);
    setCourseSearchTerm(course.name);
    setIsCourseDropdownOpen(false);
  };

  const clearCourseFilter = () => {
    setSelectedCourse(null);
    setCourseSearchTerm('');
    setIsCourseDropdownOpen(false);
  };

  // إدارة إغلاق القائمة المنسدلة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.course-search-dropdown')) {
        setIsCourseDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // استرجاع إعدادات الطباعة
  const loadPrintSettings = async () => {
    try {
      const savedSettings = await window.dataUtils.getPrintSettings();
      if (savedSettings) {
        setPrintSettings({
          universityName: savedSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي',
          facultyName: savedSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
          universityLogoUrl: savedSettings.universityLogoUrl || '',
          facultyLogoUrl: savedSettings.facultyLogoUrl || ''
        });
      }
    } catch (err) {
      console.error('خطأ في تحميل إعدادات الطباعة:', err);
    }
  };

  // دالة جلب البيانات للأساتذة والمقررات والمجموعات
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // الحصول على بيانات الأساتذة والمقررات والمجموعات والقاعات
      const db = (window as any).db;
      const professorsData = await db.getProfessors();
      const coursesData = await db.getCourses();
      const groupsData = await db.getGroups();
      const roomsData = await db.getRooms();

      // تحديث قائمة المقاييس للفلترة
      setAllCourses(coursesData || []);

      console.log("Données des professeurs brutes:", professorsData);
      console.log("Données des cours brutes:", coursesData);
      console.log("Données des groupes brutes:", groupsData);
      console.log("Données des salles brutes:", roomsData);

      // Log détaillé de chaque groupe pour voir les champs disponibles
      if (groupsData && groupsData.length > 0) {
        console.log(`Premier groupe: `, {
          id: groupsData[0].id,
          name: groupsData[0].name,
          year: groupsData[0].year,
          specialization: groupsData[0].specialization,
          allFields: Object.keys(groupsData[0])
        });
      }

      // Log détaillé de chaque cours pour voir les champs disponibles
      if (coursesData && coursesData.length > 0) {
        console.log(`Premier cours: `, {
          id: coursesData[0].id,
          name: coursesData[0].name,
          specialization_id: coursesData[0].specialization_id,
          specialization: coursesData[0].specialization,
          group_year: coursesData[0].group_year,
          year: coursesData[0].year,
          allFields: Object.keys(coursesData[0])
        });
      }

      // Log détaillé de chaque professeur pour voir les champs disponibles
      professorsData.forEach((prof: any, index: number) => {
        console.log(`Professeur ${index + 1}:`, {
          id: prof.id,
          name: prof.name,
          title: prof.title,
          Title: prof.Title,
          academic_title: prof.academic_title,
          'Academic Title': prof['Academic Title'],
          allFields: Object.keys(prof)
        });
      });

      // Traiter les données des professeurs pour inclure title et academic_title
      const mappedProfessors = professorsData.map((prof: any) => {
        console.log('Raw professor data from API:', {
          id: prof.id,
          name: prof.name,
          title: prof.title,
          Title: prof.Title,
          academic_title: prof.academic_title,
          'Academic Title': prof['Academic Title'],
          allKeys: Object.keys(prof)
        });

        return {
          id: prof.id,
          name: prof.name,
          title: prof.title || prof.Title || '',
          academic_title: prof.academic_title || prof["Academic Title"] || '',
          email: prof.email || ''
        };
      });

      console.log("Professeurs avec title et academic_title:", mappedProfessors);

      // تعيين البيانات للحالة
      setProfessors(mappedProfessors);
      setCourses(coursesData);
      setGroups(groupsData);
      setRooms(roomsData);
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

  // حساب عبء العمل عند تغيير البيانات
  useEffect(() => {
    if (professors.length > 0 && courses.length > 0 && assignments.length > 0 && groups.length > 0 && rooms.length > 0) {
      calculateWorkloads();
    }
  }, [professors, courses, assignments, groups, rooms, currentYear, currentSemester]);

  // حساب عبء العمل
  const calculateWorkloads = () => {
    const calculatedWorkloads: ProfessorWorkloadData[] = [];
    // ساعات مختلفة حسب نوع الحصة
    const LECTURE_HOURS = 2.25;  // المحاضرات
    const TD_TP_HOURS = 1.5;     // الأعمال الموجهة والتطبيقية

    // فلترة التكليفات حسب السنة الأكاديمية والفصل الدراسي المحددين
    const filteredAssignments = assignments.filter(assignment => {
      const matchesYear = !currentYear || assignment.academic_year === currentYear.year_name;
      const matchesSemester = !currentSemester || assignment.semester === currentSemester.semester_name;
      return matchesYear && matchesSemester;
    });

    console.log('Filtered assignments for workload calculation:', {
      totalAssignments: assignments.length,
      filteredAssignments: filteredAssignments.length,
      currentYear: currentYear?.year_name,
      currentSemester: currentSemester?.semester_name
    });

    // معالجة كل أستاذ
    professors.forEach(professor => {
      // التكليفات الخاصة بالأستاذ (مفلترة حسب السنة والفصل)
      const professorAssignments = filteredAssignments.filter(a => a.professor_id === professor.id);

      if (professorAssignments.length === 0) {
        return; // تخطي الأستاذ إذا لم يكن لديه تكليفات
      }

      // المقررات التي يدرسها الأستاذ - تجميع حسب المقرر والتخصص معاً
      const courseMap: Map<string, {
        course: Course;
        hours: number;
        count: number;
        lectureCount: number;  // Nombre de cours magistraux
        tdCount: number;       // Nombre de travaux dirigés
        totalHours: number;
        specialization?: string;
        group_year?: string;
      }> = new Map();

      // الأيام التي يدرس فيها الأستاذ
      const dayMap: {
        [key: string]: {
          count: number;
          hours: number;
          lectureCount: number;  // Nombre de cours magistraux par jour
          tdCount: number;       // Nombre de travaux dirigés par jour
        }
      } = {};

      // حساب عبء العمل لكل مقرر
      professorAssignments.forEach(assignment => {
        const courseId = assignment.course_id;
        const course = courses.find(c => c.id === courseId);
        const dayId = assignment.day_of_week;
        const groupId = assignment.group_id;
        const group = groups.find(g => g.id === groupId);
        const roomId = assignment.room_id;
        const room = rooms.find(r => r.id === roomId);

        // Debug logging للتحقق من بيانات التكليف والمقرر
        console.log('Assignment data:', {
          assignment_id: assignment.id,
          course_id: assignment.course_id,
          group_id: assignment.group_id,
          specialization: assignment.specialization,
          group_name: assignment.group_name,
          group_year: assignment.group_year,
          year: assignment.year,
          academic_year: assignment.academic_year,
          semester: assignment.semester,
          allAssignmentFields: Object.keys(assignment)
        });

        if (course) {
          console.log('Course data:', {
            course_id: course.id,
            course_name: course.name,
            specialization_id: course.specialization_id,
            specialization: course.specialization,
            group_year: course.group_year,
            year: course.year,
            allCourseFields: Object.keys(course)
          });
        }

        if (group) {
          console.log('Group data:', {
            group_id: group.id,
            group_name: group.name,
            group_year: group.year,
            allGroupFields: Object.keys(group)
          });
        }

        if (room) {
          console.log('Room data:', {
            room_id: room.id,
            room_name: room.name,
            allRoomFields: Object.keys(room)
          });
        }

        // محاولة الحصول على التخصص من التكليف أولاً، ثم من المجموعة
        let specialization = assignment.specialization;
        if (!specialization && group) {
          specialization = group.specialization;
        }
        if (!specialization) {
          specialization = 'غير محدد';
        }

        // Vérifier si c'est un cours magistral ou TD
        const isLecture = assignment.group_name === 'محاضرة';

        // إنشاء مفتاح فريد يجمع بين المقرر والتخصص معاً
        const courseSpecializationKey = `${courseId}_${specialization} `;

        // إضافة المقرر إلى قاموس المقررات
        if (!courseMap.has(courseSpecializationKey)) {
          courseMap.set(courseSpecializationKey, {
            course,
            count: 0,
            lectureCount: 0,
            tdCount: 0,
            specialization: specialization,
            group_year: group?.year // إضافة سنة المجموعة من بيانات المجموعة
          });
        }
        const courseData = courseMap.get(courseSpecializationKey);
        if (courseData) {
          courseData.count += 1;

          // تحديث التخصص وسنة المجموعة إذا لم تكن موجودة
          if (!courseData.specialization) {
            courseData.specialization = specialization;
          }
          if (!courseData.group_year && group?.year) {
            courseData.group_year = group.year;
          }

          // Comptabiliser les cours et TD séparément
          if (isLecture) {
            courseData.lectureCount += 1;
          } else {
            courseData.tdCount += 1;
          }
        }

        // S'assurer que l'ID du jour est valide
        let dayName = 'يوم غير معروف';

        // Vérifier si dayId est défini
        if (dayId !== undefined && dayId !== null) {
          const day = days.find(d => d.id === dayId);
          if (day) {
            dayName = day.name;
          } else {
            console.warn(`Jour inconnu pour l'affectation: ID=${dayId}, valeurs valides: ${days.map(d => d.id).join(', ')}`);
          }
        } else {
          console.warn(`Affectation sans jour défini (undefined/null): course_id=${courseId}`);
        }

        // إضافة اليوم إلى قاموس الأيام
        if (!dayMap[dayName]) {
          dayMap[dayName] = { count: 0, hours: 0, lectureCount: 0, tdCount: 0 };
        }
        dayMap[dayName].count += 1;

        // Compter les cours et TD par jour également
        if (isLecture) {
          dayMap[dayName].lectureCount += 1;
          // إضافة ساعات المحاضرة (2.25 ساعة)
          dayMap[dayName].hours += LECTURE_HOURS;
        } else {
          dayMap[dayName].tdCount += 1;
          // إضافة ساعات الأعمال الموجهة/التطبيقية (1.5 ساعة)
          dayMap[dayName].hours += TD_TP_HOURS;
        }
      });

      // تحويل قاموس المقررات إلى مصفوفة
      const coursesArray = Array.from(courseMap.values()).map(({ course, count, lectureCount, tdCount, specialization, group_year }) => {
        // حساب عدد الساعات الإجمالي لهذا المقرر (محاضرات + أعمال موجهة)
        const lectureTotalHours = lectureCount * LECTURE_HOURS;
        const tdTotalHours = tdCount * TD_TP_HOURS;
        const totalCourseHours = lectureTotalHours + tdTotalHours;

        return {
          course,
          hours: count > 0 ? totalCourseHours / count : 0, // متوسط الساعات لكل حصة
          count,
          lectureCount,   // Nombre de cours magistraux
          tdCount,        // Nombre de travaux dirigés
          totalHours: totalCourseHours,
          specialization,
          group_year
        };
      });

      // حساب إجمالي الساعات (محاضرات × 2.25 + أعمال موجهة × 1.5)
      const totalLectureHours = Array.from(courseMap.values()).reduce((sum, { lectureCount }) => sum + (lectureCount * LECTURE_HOURS), 0);
      const totalTDHours = Array.from(courseMap.values()).reduce((sum, { tdCount }) => sum + (tdCount * TD_TP_HOURS), 0);
      const totalHours = totalLectureHours + totalTDHours;

      // Vérifier si le total correspond à la somme des heures par jour
      const totalDayHours = Object.values(dayMap).reduce((sum, day) => sum + day.hours, 0);

      console.log(`Professor ${professor.name}:`);
      console.log(`- Total assignments: ${professorAssignments.length}`);
      console.log(`- Total lecture hours (${Array.from(courseMap.values()).reduce((sum, { lectureCount }) => sum + lectureCount, 0)} × ${LECTURE_HOURS}): ${totalLectureHours}`);
      console.log(`- Total TD hours (${Array.from(courseMap.values()).reduce((sum, { tdCount }) => sum + tdCount, 0)} × ${TD_TP_HOURS}): ${totalTDHours}`);
      console.log(`- Total hours: ${totalHours}`);
      console.log(`- Total hours from days: ${totalDayHours}`);

      // إضافة عبء العمل للأستاذ إلى مصفوفة عبء العمل
      calculatedWorkloads.push({
        professor,
        courses: coursesArray,
        totalHours,
        totalLectureHours,
        totalTDHours,
        days: dayMap
      });
    });

    // ترتيب عبء العمل حسب إجمالي الساعات
    calculatedWorkloads.sort((a, b) => b.totalHours - a.totalHours);

    setWorkloads(calculatedWorkloads);
  };

  // تصدير الجدول إلى PDF
  const exportToPDF = async () => {
    if (!selectedWorkload) return;

    // Exporter directement sans ouvrir la boîte de dialogue
    await handleExportPDF();
  };

  // Fonction pour traduire les titres académiques en arabe
  const translateAcademicTitle = (title: string): string => {
    if (!title || title.trim() === '') return '';

    const titleMap: { [key: string]: string } = {
      'Dr': 'د.',
      'Dr.': 'د.',
      'Prof.Dr': 'أ.د.',
      'Prof.Dr.': 'أ.د.',
      'Prof': 'أ.',
      'Prof.': 'أ.',
      'Professor': 'أ.',
      'Doctor': 'د.',
      // Ajout de versions françaises courantes
      'Docteur': 'د.',
      'Professeur': 'أ.',
      'Professeur Docteur': 'أ.د.',
      // Versions en arabe déjà présentes
      'دكتور': 'د.',
      'أستاذ': 'أ.',
      'أستاذ دكتور': 'أ.د.',
      // Versions mixtes
      'Pr': 'أ.',
      'Pr.': 'أ.'
    };

    // Nettoyer le titre (supprimer espaces en début/fin)
    const cleanTitle = title.trim();

    // Chercher une correspondance exacte d'abord
    if (titleMap[cleanTitle]) {
      return titleMap[cleanTitle];
    }

    // Chercher une correspondance insensible à la casse
    const lowerTitle = cleanTitle.toLowerCase();
    for (const [key, value] of Object.entries(titleMap)) {
      if (key.toLowerCase() === lowerTitle) {
        return value;
      }
    }

    // Si aucune correspondance, retourner le titre original
    return cleanTitle;
  };

  // معالجة التصدير - version modifiée sans demander la صفة
  const handleExportPDF = async () => {
    if (!selectedWorkload || !currentYear || !currentSemester) {
      console.error('خطأ: بيانات مفقودة للتصدير', { selectedWorkload, currentYear, currentSemester });
      alert('تعذر التصدير: بيانات مفقودة');
      return;
    }

    console.log('جاري تصدير PDF للأستاذ:', selectedWorkload.professor.name);

    try {
      // Call refreshCurrentSemester before generating PDF
      await refreshCurrentSemester();

      // الحصول على التاريخ الحالي
      const today = new Date();
      const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      // استخراج تاريخ بداية الفصل الدراسي
      const semesterStartDate = currentSemester.start_date ? new Date(currentSemester.start_date) : new Date();
      const formattedStartDate = `${semesterStartDate.getDate().toString().padStart(2, '0')}/${(semesterStartDate.getMonth() + 1).toString().padStart(2, '0')}/${semesterStartDate.getFullYear()}`;

      // Récupérer les données du professeur
      const academicTitleRaw = selectedWorkload.professor.academic_title || '';
      const professionalTitle = selectedWorkload.professor.title || '';

      // Debug logging pour vérifier les données du professeur
      console.log('Professor data:', {
        name: selectedWorkload.professor.name,
        academicTitleRaw,
        professionalTitle,
        fullProfessor: selectedWorkload.professor
      });

      // Traduire le titre académique en arabe
      const academicTitle = translateAcademicTitle(academicTitleRaw);

      console.log(`Titre académique: "${academicTitleRaw}" traduit en "${academicTitle}"`);

      // Ajouter le titre académique au nom
      const professorNameWithTitle = academicTitle
        ? `${academicTitle} ${selectedWorkload.professor.name}`
        : selectedWorkload.professor.name;

      console.log(`Nom final avec titre: "${professorNameWithTitle}"`);
      console.log(`Titre professionnel: "${professionalTitle}"`);

      // إنشاء محتوى HTML للمستند على غرار الصورة المقدمة
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              margin: 5mm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              direction: rtl;
              text-align: right;
            }
            .container {
              padding: 5mm;
            }
            .header {
              text-align: center;
              border-bottom: 1px solid #000;
              padding-bottom: 5mm;
              position: relative;
            }
            .logo {
              position: absolute;
              right: 10%;
              top: 50%;
              transform: translateY(-50%);
              width: 80px;
              height: auto;
              z-index: 1;
            }
            .faculty-logo {
              position: absolute;
              left: 10%;
              top: 50%;
              transform: translateY(-50%);
              width: 80px;
              height: auto;
              z-index: 1;
            }
            .header-text {
              position: relative;
              z-index: 2;
            }
            .header-text p {
              margin: 2mm 0;
            }
            .document-title {
              font-size: 18px;
              font-weight: bold;
              margin: 5mm 0;
              text-align: center;
              border: 1px solid #000;
              padding: 2mm;
              background-color: #f0f0f0;
            }
            .document-info {
              margin: 5mm 0;
            }
            .document-info p {
              margin: 2mm 0;
            }
            .professor-info {
              display: flex;
              justify-content: space-between;
            }
            .professor-details {
              width: 48%;
            }
            .professor-name, .professor-title {
              font-weight: bold;
              font-size: 16px;
              margin: 3mm 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 5mm 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 2mm;
              text-align: center;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .footer {
              margin-top: 5mm;
              text-align: center;
            }
            .signature {
              margin-top: 5mm;
              text-align: left;
            }
            .politesse {
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              margin: 5mm 0 3mm 0;
            }
            .date-signature {
              text-align: left;
              margin-bottom: 3mm;
            }
            .signataire-title {
              font-weight: bold;
              margin-top: 5mm;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${printSettings.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="Logo" class="logo">` : ''}
              ${printSettings.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="Logo" class="faculty-logo">` : ''}
              <div class="header-text">
                <p>${printSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
                <p>وزارة التعليم العالي و البحث العلمي</p>
                <p>${printSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
                <p>نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</p>
                <p>مصلحة التدريس</p>
                <p>الـرقم:................../ ك. ع. إ. ت. ع. ت/ ن. ع. م. د/ م. ت/ ${currentYear.year_name}</p>
              </div>
            </div>
            
            <div class="document-title">
              تكليف بمقاييس ${currentSemester?.semester_name || 'الفصل الأول'} للموسم الجامعي:${currentYear.year_name}
            </div>
            
            <div class="document-info">
              <div>
                <p>نحيط علم سيادتكم أنه قد تم تكليفكم بالمقاييس التالية إبتداءًا من: ${currentSemester?.start_date ? new Date(currentSemester.start_date).toLocaleDateString('fr-FR') : formattedStartDate}</p>
              </div>
              <div class="professor-info">
                <div class="professor-details">
                  <p class="professor-name">الإسم واللقب: ${professorNameWithTitle}</p>
                  <p class="professor-title">الصفة: ${professionalTitle}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3>ملخص الحجم الساعي الإسبوعي</h3>
              <table class="hours-summary">
                <thead>
                  <tr>
                    <th>المحاضرات</th>
                    <th>الأعمال الموجهة</th>
                    <th>المجموع الكلي</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${selectedWorkload.totalLectureHours.toFixed(1)}</td>
                    <td>${selectedWorkload.totalTDHours.toFixed(1)}</td>
                    <td>${selectedWorkload.totalHours.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
              
              <table>
                <thead>
                  <tr>
                    <th>المقرر</th>
                    <th>عدد الساعات</th>
                    <th>عدد الحصص</th>
                    <th>الإجمالي</th>
                    <th>التخصص</th>
                    <th>المستوى</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedWorkload.courses.map(course => `
                    <tr>
                      <td>${course.course.name || 'غير محدد'}</td>
                      <td>${(course.hours !== undefined ? course.hours : 0).toString()}</td>
                      <td>${(course.count !== undefined ? course.count : 0).toString()}</td>
                      <td>${(course.totalHours !== undefined ? course.totalHours.toFixed(1) : '0.0')}</td>
                      <td>${course.specialization || 'غير محدد'}</td>
                      <td>${getAcademicLevel(course.group_year || '')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <table>
                <thead>
                  <tr>
                    <th>اليوم</th>
                    <th>عدد الحصص</th>
                    <th>عدد الساعات</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(selectedWorkload.days).map(([day, data]) => `
                    <tr>
                      <td>${day}</td>
                      <td>${data.count}</td>
                      <td>${data.hours.toFixed(1)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="footer">
              <div class="politesse">
                <p>وفي الأخير تقبلوا منا أسمى عبارات التقدير والاحترام</p>
              </div>
              
              <div class="date-signature">
                <p>الــوادي فـــي: ${formattedDate}</p>
              </div>
              
              <div class="signature">
                <p class="signataire-title">نائب العميد المكلف بالدراسات والمسائل المرتبطة بالطلبة</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // طباعة طول المحتوى
      console.log('حجم المحتوى HTML:', htmlContent.length);

      // إنشاء PDF
      printContent(htmlContent, {
        title: `تكليف_${selectedWorkload.professor.name}_${currentYear.year_name}`,
        orientation: 'portrait',
        asPDF: true
      });

      console.log('تم تصدير PDF بنجاح.');
    } catch (error) {
      console.error('خطأ في تصدير PDF:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF');
    }
  };

  // تصدير جميع التكاليف إلى PDF
  const exportAllToPDF = async () => {
    if (!workloads || workloads.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }

    console.log(`Exporting assignments for ${workloads.length} professors`);
    setIsLoading(true);

    try {
      // Tableau pour stocker tous les contenus HTML générés
      const allHTMLContents: string[] = [];

      // Générer le HTML pour chaque professeur
      for (const workload of workloads) {
        // Créer une version temporaire de selectedWorkload pour ce professeur
        const tempSelectedWorkload = workload;

        // Récupérer les données du professeur
        const academicTitleRaw = tempSelectedWorkload.professor.academic_title || '';
        const professionalTitle = tempSelectedWorkload.professor.title || '';

        // Debug logging pour vérifier les données du professeur
        console.log('Professor data:', {
          name: tempSelectedWorkload.professor.name,
          academicTitleRaw,
          professionalTitle,
          fullProfessor: tempSelectedWorkload.professor
        });

        // Traduire le titre académique en arabe
        const academicTitle = translateAcademicTitle(academicTitleRaw);

        console.log(`Titre académique: "${academicTitleRaw}" traduit en "${academicTitle}"`);

        // Ajouter le titre académique au nom
        const professorNameWithTitle = academicTitle
          ? `${academicTitle} ${tempSelectedWorkload.professor.name}`
          : tempSelectedWorkload.professor.name;

        console.log(`Nom final avec titre: "${professorNameWithTitle}"`);
        console.log(`Titre professionnel: "${professionalTitle}"`);

        // Obtenir la date actuelle
        const today = new Date();
        const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

        // Extraire la date de début du semestre
        const semesterStartDate = currentSemester?.start_date ? new Date(currentSemester.start_date) : new Date();
        const formattedStartDate = `${semesterStartDate.getDate().toString().padStart(2, '0')}/${(semesterStartDate.getMonth() + 1).toString().padStart(2, '0')}/${semesterStartDate.getFullYear()}`;

        // Créer le HTML pour ce professeur
        const htmlContent = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                margin: 5mm;
                size: A4;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                direction: rtl;
                text-align: right;
              }
              .container {
                padding: 5mm;
              }
              .header {
                text-align: center;
                border-bottom: 1px solid #000;
                padding-bottom: 5mm;
                position: relative;
              }
              .logo {
                position: absolute;
                right: 10%;
                top: 50%;
                transform: translateY(-50%);
                width: 80px;
                height: auto;
                z-index: 1;
              }
              .faculty-logo {
                position: absolute;
                left: 10%;
                top: 50%;
                transform: translateY(-50%);
                width: 80px;
                height: auto;
                z-index: 1;
              }
              .header-text {
                position: relative;
                z-index: 2;
              }
              .header-text p {
                margin: 2mm 0;
              }
              .document-title {
                font-size: 18px;
                font-weight: bold;
                margin: 5mm 0;
                text-align: center;
                border: 1px solid #000;
                padding: 2mm;
                background-color: #f0f0f0;
              }
              .document-info {
                margin: 5mm 0;
              }
              .document-info p {
                margin: 2mm 0;
              }
              .professor-info {
                display: flex;
                justify-content: space-between;
              }
              .professor-details {
                width: 48%;
              }
              .professor-name, .professor-title {
                font-weight: bold;
                font-size: 16px;
                margin: 3mm 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 5mm 0;
              }
              th, td {
                border: 1px solid #000;
                padding: 2mm;
                text-align: center;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
              }
              .footer {
                margin-top: 5mm;
                text-align: center;
              }
              .signature {
                margin-top: 5mm;
                text-align: left;
              }
              .politesse {
                font-size: 18px;
                font-weight: bold;
                text-align: center;
                margin: 5mm 0 3mm 0;
              }
              .date-signature {
                text-align: left;
                margin-bottom: 3mm;
              }
              .signataire-title {
                font-weight: bold;
                margin-top: 5mm;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${printSettings.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="Logo" class="logo">` : ''}
                <div class="header-text">
                  <p>${printSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
                  <p>وزارة التعليم العالي و البحث العلمي</p>
                  <p>${printSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
                  <p>نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</p>
                  <p>مصلحة التدريس</p>
                  <p>الـرقم:................../ ك. ع. إ. ت. ع. ت/ ن. ع. م. د/ م. ت/ ${currentYear.year_name}</p>
                </div>
                ${printSettings.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="Logo" class="faculty-logo">` : ''}
              </div>
              
              <div class="document-title">
                تكليف بمقاييس ${currentSemester?.semester_name || 'الفصل الأول'} للموسم الجامعي:${currentYear.year_name}
              </div>
              
              <div class="document-info">
                <div>
                  <p>نحيط علم سيادتكم أنه قد تم تكليفكم بالمقاييس التالية إبتداءًا من: ${currentSemester?.start_date ? new Date(currentSemester.start_date).toLocaleDateString('fr-FR') : formattedStartDate}</p>
                </div>
                <div class="professor-info">
                  <div class="professor-details">
                    <p class="professor-name">الإسم واللقب: ${professorNameWithTitle}</p>
                    <p class="professor-title">الصفة: ${professionalTitle}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3>ملخص الحجم الساعي الإسبوعي</h3>
                <table class="hours-summary">
                  <thead>
                    <tr>
                      <th>المحاضرات</th>
                      <th>الأعمال الموجهة</th>
                      <th>المجموع الكلي</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>${tempSelectedWorkload.totalLectureHours.toFixed(1)}</td>
                      <td>${tempSelectedWorkload.totalTDHours.toFixed(1)}</td>
                      <td>${tempSelectedWorkload.totalHours.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
                
                <table>
                  <thead>
                    <tr>
                      <th>المقرر</th>
                      <th>عدد الساعات</th>
                      <th>عدد الحصص</th>
                      <th>الإجمالي</th>
                      <th>التخصص</th>
                      <th>المستوى</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tempSelectedWorkload.courses.map(course => `
                      <tr>
                        <td>${course.course.name || 'غير محدد'}</td>
                        <td>${(course.hours !== undefined ? course.hours : 0).toString()}</td>
                        <td>${(course.count !== undefined ? course.count : 0).toString()}</td>
                        <td>${(course.totalHours !== undefined ? course.totalHours.toFixed(1) : '0.0')}</td>
                        <td>${course.specialization || 'غير محدد'}</td>
                        <td>${getAcademicLevel(course.group_year || '')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                
                <table>
                  <thead>
                    <tr>
                      <th>اليوم</th>
                      <th>عدد الحصص</th>
                      <th>عدد الساعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.entries(tempSelectedWorkload.days).map(([day, data]) => `
                      <tr>
                        <td>${day}</td>
                        <td>${data.count}</td>
                        <td>${data.hours.toFixed(1)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              
              <div class="footer">
                <div class="politesse">
                  <p>وفي الأخير تقبلوا منا أسمى عبارات التقدير والاحترام</p>
                </div>
                
                <div class="date-signature">
                  <p>الــوادي فـــي: ${formattedDate}</p>
                </div>
                
                <div class="signature">
                  <p class="signataire-title">نائب العميد المكلف بالدراسات والمسائل المرتبطة بالطلبة</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        // Ajouter ce HTML au tableau
        allHTMLContents.push(htmlContent);
      }

      // Exporter tous les PDF dans un seul fichier - دمج كل HTML في ملف واحد
      const combinedHTML = allHTMLContents.join('<div style="page-break-after: always;"></div>');
      printContent(combinedHTML, {
        title: `تكليفات_الأساتذة_${currentYear.year_name}_${currentSemester.semester_name}`,
        orientation: 'portrait',
        asPDF: true
      });

      console.log('Tous les PDF ont été générés et combinés avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'exportation des PDF:', error);
      alert('حدث خطأ أثناء تصدير ملفات PDF');
    } finally {
      setIsLoading(false);
    }
  };

  // تصدير تقرير الأساتذة بدون تكليفات
  const exportProfessorsWithoutAssignments = async () => {
    try {
      setIsLoading(true);

      // العثور على الأساتذة بدون تكليفات واستبعاد الأساتذة المؤقتين
      const professorsWithoutAssignments = professors.filter(professor =>
        !assignments.some(assignment => assignment.professor_id === professor.id) &&
        !professor.title?.includes('أستاذ(ة) مؤقت(ة)')
      );

      if (professorsWithoutAssignments.length === 0) {
        alert('جميع الأساتذة لديهم تكليفات أو هم أساتذة مؤقتون');
        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير الأساتذة بدون تكليفات</title>
          <style>
            @page { size: A4 landscape; margin: 15mm; }
            body { font-family: 'Arial', sans-serif; margin: 0; direction: rtl; font-size: ${printSettings.cellContentFontSize || 10}px; }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              padding: 10px;
              border-bottom: 2px solid #000;
            }
            .logo {
              width: ${printSettings.logoSize || 80}px;
              height: ${printSettings.logoSize || 80}px;
              object-fit: contain;
            }
            .faculty-logo {
              width: ${printSettings.logoSize || 80}px;
              height: ${printSettings.logoSize || 80}px;
              object-fit: contain;
            }
            .header-text {
              text-align: center;
              flex: 1;
              margin: 0 20px;
            }
            .header-text p {
              margin: 2px 0;
              font-size: ${printSettings.headerFontSize || 16}px;
              font-weight: bold;
            }
            .title {
              font-size: ${printSettings.titleFontSize || 24}px;
              font-weight: bold;
              margin: 20px 0;
              text-align: center;
              border: 2px solid #000;
              padding: 10px;
              background-color: #f0f0f0;
            }
            .info {
              margin: 20px 0;
              text-align: center;
              font-size: ${printSettings.subtitleFontSize || 14}px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: center;
              font-size: ${printSettings.cellContentFontSize || 10}px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .count {
              font-size: ${printSettings.subtitleFontSize || 18}px;
              font-weight: bold;
              margin: 20px 0;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="Logo" class="logo">` : ''}
            <div class="header-text">
              <p>${printSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
              <p>وزارة التعليم العالي و البحث العلمي</p>
              <p>${printSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
              <p>نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</p>
            </div>
            ${printSettings.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="Logo" class="faculty-logo">` : ''}
          </div>
          
          <div class="title">
            تقرير الأساتذة بدون تكليفات للموسم الجامعي: ${currentYear.year_name}
          </div>
          
          <div class="info">
            <p>التاريخ: ${new Date().toLocaleDateString('ar-DZ')}</p>
            <p>السداسي: ${currentSemester.semester_name}</p>
          </div>
          
          <div class="count">
            إجمالي عدد الأساتذة بدون تكليفات: ${professorsWithoutAssignments.length}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>اسم الأستاذ</th>
                <th>الصفة</th>
                <th>اللقب الأكاديمي</th>
                <th>التخصص</th>
                <th>المستوى</th>
              </tr>
            </thead>
            <tbody>
              ${professorsWithoutAssignments.map((professor, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${professor.name}</td>
                  <td>${professor.title || '-'}</td>
                  <td>${professor.academic_title || '-'}</td>
                  <td>${professor.specialization_id || '-'}</td>
                  <td>${getAcademicLevel(professor.group_year || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printContent(htmlContent, {
        title: `الأساتذة_بدون_تكليفات_${currentYear.year_name}_${currentSemester.semester_name}`,
        orientation: 'portrait',
        asPDF: true
      });

      console.log('تم تصدير تقرير الأساتذة بدون تكليفات بنجاح');
    } catch (error) {
      console.error('خطأ في تصدير تقرير الأساتذة بدون تكليفات:', error);
      alert('حدث خطأ أثناء تصدير التقرير');
    } finally {
      setIsLoading(false);
    }
  };

  // تصدير تقرير ترتيب الأساتذة حسب عبء العمل
  const exportWorkloadRanking = async () => {
    try {
      setIsLoading(true);

      if (!workloads || workloads.length === 0) {
        alert('لا توجد بيانات عبء العمل للتصدير');
        return;
      }

      // ترتيب الأساتذة حسب عبء العمل (تنازلي)
      const sortedWorkloads = [...workloads].sort((a, b) => b.totalHours - a.totalHours);

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير ترتيب الأساتذة حسب عبء العمل</title>
          <style>
            @page { size: A4 landscape; margin: 15mm; }
            body { font-family: 'Arial', sans-serif; margin: 0; direction: rtl; font-size: ${printSettings.cellContentFontSize || 10}px; }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              padding: 10px;
              border-bottom: 2px solid #000;
            }
            .logo {
              width: ${printSettings.logoSize || 80}px;
              height: ${printSettings.logoSize || 80}px;
              object-fit: contain;
            }
            .faculty-logo {
              width: ${printSettings.logoSize || 80}px;
              height: ${printSettings.logoSize || 80}px;
              object-fit: contain;
            }
            .header-text {
              text-align: center;
              flex: 1;
              margin: 0 20px;
            }
            .header-text p {
              margin: 2px 0;
              font-size: ${printSettings.headerFontSize || 16}px;
              font-weight: bold;
            }
            .title {
              font-size: ${printSettings.titleFontSize || 24}px;
              font-weight: bold;
              margin: 20px 0;
              text-align: center;
              border: 2px solid #000;
              padding: 10px;
              background-color: #f0f0f0;
            }
            .info {
              margin: 20px 0;
              text-align: center;
              font-size: ${printSettings.subtitleFontSize || 14}px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: center;
              font-size: ${printSettings.cellContentFontSize || 10}px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .rank-1 { background-color: #ffeb3b; }
            .rank-2 { background-color: #fff3c4; }
            .rank-3 { background-color: #fff8dc; }
            .summary {
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #ccc;
              background-color: #f9f9f9;
              font-size: ${printSettings.subtitleFontSize || 14}px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="Logo" class="logo">` : ''}
            <div class="header-text">
              <p>${printSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
              <p>وزارة التعليم العالي و البحث العلمي</p>
              <p>${printSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
              <p>نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</p>
            </div>
            ${printSettings.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="Logo" class="faculty-logo">` : ''}
          </div>
          
          <div class="title">
            تقرير ترتيب الأساتذة حسب عبء العمل للموسم الجامعي: ${currentYear.year_name}
          </div>
          
          <div class="info">
            <p>التاريخ: ${new Date().toLocaleDateString('ar-DZ')}</p>
            <p>السداسي: ${currentSemester.semester_name}</p>
          </div>
          
          <div class="summary">
            <h3>ملخص إحصائي:</h3>
            <p>إجمالي عدد الأساتذة: ${sortedWorkloads.length}</p>
            <p>متوسط عبء العمل: ${(sortedWorkloads.reduce((sum, w) => sum + w.totalHours, 0) / sortedWorkloads.length).toFixed(1)} ساعة</p>
            <p>أعلى عبء عمل: ${sortedWorkloads.length > 0 ? sortedWorkloads[0].totalHours.toFixed(1) : 0} ساعة</p>
            <p>أقل عبء عمل: ${sortedWorkloads.length > 0 ? sortedWorkloads[sortedWorkloads.length - 1].totalHours.toFixed(1) : 0} ساعة</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>الترتيب</th>
                <th>اسم الأستاذ</th>
                <th>الصفة</th>
                <th>ساعات المحاضرات</th>
                <th>ساعات الأعمال الموجهة</th>
                <th>إجمالي الساعات</th>
                <th>عدد المقررات</th>
                <th>التخصص</th>
                <th>المستوى</th>
              </tr>
            </thead>
            <tbody>
              ${sortedWorkloads.map((workload, index) => `
                <tr class="${index < 3 ? `rank-${index + 1}` : ''}">
                  <td>${index + 1}</td>
                  <td>${workload.professor.name}</td>
                  <td>${workload.professor.title || '-'}</td>
                  <td>${workload.totalLectureHours.toFixed(1)}</td>
                  <td>${workload.totalTDHours.toFixed(1)}</td>
                  <td><strong>${workload.totalHours.toFixed(1)}</strong></td>
                  <td>${workload.courses.length}</td>
                  <td>${workload.courses[0].specialization || '-'}</td>
                  <td>${getAcademicLevel(workload.courses[0].group_year || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printContent(htmlContent, {
        title: `ترتيب_الأساتذة_حسب_عبء_العمل_${currentYear.year_name}_${currentSemester.semester_name}`,
        orientation: 'portrait',
        asPDF: true
      });

      console.log('تم تصدير تقرير ترتيب الأساتذة بنجاح');
    } catch (error) {
      console.error('خطأ في تصدير تقرير ترتيب الأساتذة:', error);
      alert('حدث خطأ أثناء تصدير التقرير');
    } finally {
      setIsLoading(false);
    }
  };

  // طباعة جداول توقيت الأساتذة
  const exportProfessorSchedules = async () => {
    try {
      setIsLoading(true);

      if (!professors || professors.length === 0) {
        alert('لا توجد بيانات الأساتذة للطباعة');
        return;
      }

      // أيام الأسبوع
      const allDays = [
        { id: 0, name: 'السبت' },
        { id: 1, name: 'الأحد' },
        { id: 2, name: 'الاثنين' },
        { id: 3, name: 'الثلاثاء' },
        { id: 4, name: 'الأربعاء' },
        { id: 5, name: 'الخميس' },
        { id: 6, name: 'الجمعة' }
      ];

      // الأوقات
      const timeSlots = [
        { start: '08:00', end: '09:30' },
        { start: '09:30', end: '11:00' },
        { start: '11:00', end: '12:30' },
        { start: '12:30', end: '14:00' },
        { start: '14:00', end: '15:30' },
        { start: '15:30', end: '17:00' }
      ];

      // إنشاء HTML لكل أستاذ
      const professorsHTML = professors.map((professor, index) => {
        const professorAssignments = assignments.filter(a => a.professor_id === professor.id);

        // تحديد الأيام التي يدرس فيها الأستاذ فقط
        const activeDays = allDays.filter(day =>
          professorAssignments.some(a => a.day_of_week === day.id)
        );

        // تحديد الأوقات التي يدرس فيها الأستاذ فقط
        const activeTimeSlots = timeSlots.filter(timeSlot =>
          professorAssignments.some(a =>
            a.start_time === timeSlot.start && a.end_time === timeSlot.end
          )
        );

        // إذا لم يكن للأستاذ أي تكليفات، لا نطبع جدوله
        if (activeDays.length === 0 || activeTimeSlots.length === 0) {
          return '';
        }

        let scheduleTable = `
          <div class="professor-page">
            <div class="header">
              ${printSettings.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="Logo" class="logo">` : ''}
              <div class="header-text">
                <p>${printSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
                <p>وزارة التعليم العالي و البحث العلمي</p>
                <p>${printSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
                <p>نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</p>
              </div>
              ${printSettings.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="Faculty Logo" class="faculty-logo">` : ''}
            </div>

            <div class="title">جدول التوقيت الأسبوعي</div>
            
            <div class="professor-info">
              <p><strong>الأستاذ(ة):</strong> ${professor.name}</p>
              ${professor.title ? `<p><strong>المنصب:</strong> ${professor.title}</p>` : ''}
              ${professor.academic_title ? `<p><strong>اللقب العلمي:</strong> ${professor.academic_title}</p>` : ''}
            </div>
            
            <div class="info">
              <p><strong>السنة الجامعية:</strong> ${currentYear.year_name}</p>
              <p><strong>الفصل:</strong> ${currentSemester.semester_name}</p>
            </div>

            <table class="schedule-table">
              <thead>
                <tr>
                  <th>التوقيت</th>
                  ${activeDays.map(day => `<th>${day.name}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
        `;

        activeTimeSlots.forEach(timeSlot => {
          scheduleTable += `<tr><td class="time-slot">${timeSlot.start} - ${timeSlot.end}</td>`;

          activeDays.forEach(day => {
            const assignment = professorAssignments.find(a =>
              a.day_of_week === day.id &&
              a.start_time === timeSlot.start && a.end_time === timeSlot.end
            );

            if (assignment) {
              const course = courses.find(c => c.id === assignment.course_id);
              const group = groups.find(g => g.id === assignment.group_id);
              const room = rooms.find(r => r.id === assignment.room_id);

              scheduleTable += `
                <td class="assignment-cell">
                  <div class="course-name">${course?.name || 'مقياس غير محدد'}</div>
                  <div class="group-info">${assignment.group_name || group?.name || 'مجموعة غير محددة'}</div>
                  <div class="room-info">القاعة: ${room?.name || 'غير محددة'}</div>
                  <div class="specialization-info">التخصص: ${assignment.specialization || group?.specialization || 'غير محدد'}</div>
                </td>
              `;
            } else {
              scheduleTable += '<td class="empty-cell">-</td>';
            }
          });

          scheduleTable += '</tr>';
        });

        scheduleTable += `
              </tbody>
            </table>
          </div>
          ${index < professors.length - 1 ? '<div class="page-break"></div>' : ''}
        `;

        return scheduleTable;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>جداول التوقيت</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Arial', sans-serif; margin: 0; direction: rtl; font-size: ${printSettings.cellContentFontSize || 11}px; }
            .professor-page { min-height: 100vh; display: flex; flex-direction: column; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding: 10px; border-bottom: 2px solid #000; }
            .logo, .faculty-logo { width: ${printSettings.logoSize || 70}px; height: ${printSettings.logoSize || 70}px; object-fit: contain; }
            .header-text { text-align: center; flex: 1; margin: 0 20px; }
            .header-text p { margin: 3px 0; font-size: ${printSettings.headerFontSize || 15}px; font-weight: bold; }
            .title { font-size: ${printSettings.titleFontSize || 22}px; font-weight: bold; margin: 20px 0; text-align: center; border: 2px solid #000; padding: 10px; background-color: #f0f0f0; }
            .professor-info { margin: 20px 0; text-align: center; font-size: ${printSettings.subtitleFontSize || 14}px; background-color: #e3f2fd; padding: 15px; border-radius: 8px; border: 1px solid #2196f3; }
            .info { margin: 15px 0; text-align: center; font-size: ${printSettings.subtitleFontSize || 12}px; }
            .schedule-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .schedule-table th, .schedule-table td { border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; font-size: ${printSettings.cellContentFontSize || 10}px; }
            .schedule-table th { background-color: #f0f0f0; font-weight: bold; font-size: ${printSettings.cellContentFontSize || 11}px; text-align: center; vertical-align: middle; writing-mode: horizontal-tb; text-orientation: mixed; }
            .time-slot { background-color: #e5e7eb; font-weight: bold; min-width: 80px; }
            .assignment-cell { background-color: #dbeafe; padding: 6px; }
            .course-name { font-weight: bold; color: #1e40af; margin-bottom: 3px; font-size: ${printSettings.cellContentFontSize || 10}px; }
            .group-info { color: #059669; font-size: ${(printSettings.cellContentFontSize || 10) - 1}px; margin-bottom: 2px; }
            .room-info { color: #dc2626; font-size: ${(printSettings.cellContentFontSize || 10) - 1}px; margin-bottom: 2px; }
            .specialization-info { color: #7c2d12; font-size: ${(printSettings.cellContentFontSize || 10) - 2}px; }
            .empty-cell { background-color: #f9fafb; color: #9ca3af; }
            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>${professorsHTML}</body>
        </html>
      `;

      printContent(htmlContent, {
        title: `جداول_التوقيت_${currentYear.year_name}_${currentSemester.semester_name}`,
        orientation: 'landscape',
        asPDF: true
      });

    } catch (error) {
      console.error('Error exporting professor schedules:', error);
      alert('حدث خطأ أثناء طباعة الجداول');
    } finally {
      setIsLoading(false);
    }
  };

  // طباعة جدول توقيت فردي لأستاذ واحد
  const exportIndividualProfessorSchedule = async (professorId: number) => {
    try {
      setIsLoading(true);

      const professor = professors.find(p => p.id === professorId);
      if (!professor) {
        alert('لم يتم العثور على الأستاذ المحدد');
        return;
      }

      // أيام الأسبوع
      const allDays = [
        { id: 0, name: 'السبت' },
        { id: 1, name: 'الأحد' },
        { id: 2, name: 'الاثنين' },
        { id: 3, name: 'الثلاثاء' },
        { id: 4, name: 'الأربعاء' },
        { id: 5, name: 'الخميس' },
        { id: 6, name: 'الجمعة' }
      ];

      // الأوقات
      const timeSlots = [
        { start: '08:00', end: '09:30' },
        { start: '09:30', end: '11:00' },
        { start: '11:00', end: '12:30' },
        { start: '12:30', end: '14:00' },
        { start: '14:00', end: '15:30' },
        { start: '15:30', end: '17:00' }
      ];

      const professorAssignments = assignments.filter(a => a.professor_id === professor.id);

      // تحديد الأيام التي يدرس فيها الأستاذ فقط
      const activeDays = allDays.filter(day =>
        professorAssignments.some(a => a.day_of_week === day.id)
      );

      // تحديد الأوقات التي يدرس فيها الأستاذ فقط
      const activeTimeSlots = timeSlots.filter(timeSlot =>
        professorAssignments.some(a =>
          a.start_time === timeSlot.start && a.end_time === timeSlot.end
        )
      );

      // إذا لم يكن للأستاذ أي تكليفات، لا نطبع جدوله
      if (activeDays.length === 0 || activeTimeSlots.length === 0) {
        return '';
      }

      let scheduleContent = `
        <table class="schedule-table">
          <thead>
            <tr>
              <th>التوقيت</th>
              ${activeDays.map(day => `<th>${day.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
      `;

      activeTimeSlots.forEach(timeSlot => {
        scheduleContent += `<tr><td class="time-slot">${timeSlot.start} - ${timeSlot.end}</td>`;

        activeDays.forEach(day => {
          const assignment = professorAssignments.find(a =>
            a.day_of_week === day.id &&
            a.start_time === timeSlot.start && a.end_time === timeSlot.end
          );

          if (assignment) {
            const course = courses.find(c => c.id === assignment.course_id);
            const group = groups.find(g => g.id === assignment.group_id);
            const room = rooms.find(r => r.id === assignment.room_id);

            scheduleContent += `
              <td class="assignment-cell">
                <div class="course-name">${course?.name || 'مقياس غير محدد'}</div>
                <div class="group-info">${assignment.group_name || group?.name || 'مجموعة غير محددة'}</div>
                <div class="room-info">القاعة: ${room?.name || 'غير محددة'}</div>
                <div class="specialization-info">التخصص: ${assignment.specialization || group?.specialization || 'غير محدد'}</div>
              </td>
            `;
          } else {
            scheduleContent += '<td class="empty-cell">-</td>';
          }
        });

        scheduleContent += '</tr>';
      });

      scheduleContent += `
          </tbody>
        </table>
      `;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>جدول توقيت الأستاذ ${professor.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              direction: rtl;
              font-size: ${printSettings.cellContentFontSize || 11}px;
            }
            .professor-page {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              padding: 10px;
              border-bottom: 2px solid #000;
            }
            .logo {
              width: ${printSettings.logoSize || 70}px;
              height: ${printSettings.logoSize || 70}px;
              object-fit: contain;
            }
            .faculty-logo {
              width: ${printSettings.logoSize || 70}px;
              height: ${printSettings.logoSize || 70}px;
              object-fit: contain;
            }
            .header-text {
              text-align: center;
              flex: 1;
              margin: 0 20px;
            }
            .header-text p {
              margin: 3px 0;
              font-size: ${printSettings.headerFontSize || 15}px;
              font-weight: bold;
            }
            .title {
              font-size: ${printSettings.titleFontSize || 22}px;
              font-weight: bold;
              margin: 20px 0;
              text-align: center;
              border: 2px solid #000;
              padding: 10px;
              background-color: #f0f0f0;
            }
            .professor-info {
              margin: 20px 0;
              text-align: center;
              font-size: ${printSettings.subtitleFontSize || 14}px;
              background-color: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #2196f3;
            }
            .info {
              margin: 15px 0;
              text-align: center;
              font-size: ${printSettings.subtitleFontSize || 12}px;
            }
            .schedule-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .schedule-table th, .schedule-table td {
              border: 1px solid #000;
              padding: 8px;
              text-align: center;
              vertical-align: top;
              font-size: ${printSettings.cellContentFontSize || 10}px;
            }
            .schedule-table th {
              background-color: #f0f0f0;
              font-weight: bold;
              font-size: ${printSettings.cellContentFontSize || 11}px;
              text-align: center;
              vertical-align: middle;
              writing-mode: horizontal-tb;
              text-orientation: mixed;
            }
            .time-slot {
              background-color: #e5e7eb;
              font-weight: bold;
              min-width: 80px;
            }
            .assignment-cell {
              background-color: #dbeafe;
              padding: 6px;
            }
            .course-name {
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 3px;
              font-size: ${printSettings.cellContentFontSize || 10}px;
            }
            .group-info {
              color: #059669;
              font-size: ${(printSettings.cellContentFontSize || 10) - 1}px;
              margin-bottom: 2px;
            }
            .room-info {
              color: #dc2626;
              font-size: ${(printSettings.cellContentFontSize || 10) - 1}px;
              margin-bottom: 2px;
            }
            .specialization-info {
              color: #7c2d12;
              font-size: ${(printSettings.cellContentFontSize || 10) - 2}px;
            }
            .empty-cell {
              background-color: #f9fafb;
              color: #9ca3af;
            }
            .footer {
              position: fixed;
              bottom: 10mm;
              left: 15mm;
              right: 15mm;
              text-align: center;
              font-size: ${(printSettings.cellContentFontSize || 10) - 2}px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="Logo" class="logo">` : ''}
            <div class="header-text">
              <p>${printSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
              <p>وزارة التعليم العالي و البحث العلمي</p>
              <p>${printSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
              <p>نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</p>
            </div>
            ${printSettings.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="Faculty Logo" class="faculty-logo">` : ''}
          </div>

          <div class="title">جدول التوقيت الأسبوعي</div>
          
          <div class="professor-info">
            <p><strong>الأستاذ(ة):</strong> ${professor.name}</p>
            ${professor.title ? `<p><strong>المنصب:</strong> ${professor.title}</p>` : ''}
            ${professor.academic_title ? `<p><strong>اللقب العلمي:</strong> ${professor.academic_title}</p>` : ''}
          </div>
          
          <div class="info">
            <p><strong>السنة الجامعية:</strong> ${currentYear.year_name}</p>
            <p><strong>الفصل:</strong> ${currentSemester.semester_name}</p>
          </div>

          ${scheduleContent}

          <div class="footer">
            <p>تم إنشاء هذا الجدول في: ${new Date().toLocaleDateString('ar-DZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })} | نظام إدارة الجداول الدراسية</p>
          </div>
        </body>
        </html>
      `;

      // تصدير PDF
      printContent(htmlContent, {
        title: `جدول_توقيت_${professor.name.replace(/\s+/g, '_')}_${currentYear.year_name}_${currentSemester.semester_name}`,
        orientation: 'landscape',
        asPDF: true
      });

    } catch (error) {
      console.error('Error exporting individual professor schedule:', error);
      alert('حدث خطأ أثناء طباعة جدول التوقيت الفردي');
    } finally {
      setIsLoading(false);
    }
  };

  // تصفية الأساتذة حسب البحث والمقرر المحدد
  const filteredWorkloads = workloads.filter(workload => {
    // فلترة حسب اسم الأستاذ
    const matchesSearchTerm = workload.professor.name.toLowerCase().includes(searchTerm.toLowerCase());

    // فلترة حسب المقرر المحدد
    const matchesCourse = selectedCourse
      ? workload.courses.some(course => course.course.id === selectedCourse)
      : true;

    return matchesSearchTerm && matchesCourse;
  });

  // عرض عبء العمل للأستاذ المختار
  const selectedWorkload = selectedProfessor
    ? workloads.find(w => w.professor.id === selectedProfessor)
    : null;

  // دالة للتحقق من كون الأستاذ مؤقت
  const isProfessorTemporary = (professor: Professor) => {
    return professor.title?.includes('أستاذ(ة) مؤقت(ة)') || false;
  };

  // طباعة جداول توقيت الأساتذة بدون أسماء المؤقتين
  const exportProfessorSchedulesWithoutTemporary = async () => {
    try {
      setIsLoading(true);

      if (!professors || professors.length === 0) {
        alert('لا توجد بيانات الأساتذة للطباعة');
        return;
      }

      // أيام الأسبوع
      const allDays = [
        { id: 0, name: 'السبت' },
        { id: 1, name: 'الأحد' },
        { id: 2, name: 'الاثنين' },
        { id: 3, name: 'الثلاثاء' },
        { id: 4, name: 'الأربعاء' },
        { id: 5, name: 'الخميس' },
        { id: 6, name: 'الجمعة' }
      ];

      // الأوقات
      const timeSlots = [
        { start: '08:00', end: '09:30' },
        { start: '09:30', end: '11:00' },
        { start: '11:00', end: '12:30' },
        { start: '12:30', end: '14:00' },
        { start: '14:00', end: '15:30' },
        { start: '15:30', end: '17:00' }
      ];

      // إنشاء HTML لكل أستاذ مع إخفاء أسماء المؤقتين
      const professorsHTML = professors.map((professor, index) => {
        const professorAssignments = assignments.filter(a => a.professor_id === professor.id);

        const activeDays = allDays.filter(day =>
          professorAssignments.some(a => a.day_of_week === day.id)
        );

        const activeTimeSlots = timeSlots.filter(timeSlot =>
          professorAssignments.some(a =>
            a.start_time === timeSlot.start && a.end_time === timeSlot.end
          )
        );

        if (activeDays.length === 0 || activeTimeSlots.length === 0) {
          return '';
        }

        // اسم الأستاذ (مع إخفاء المؤقتين)
        const displayName = isProfessorTemporary(professor) ? 'أستاذ مؤقت' : professor.name;

        let scheduleTable = `
          <div class="professor-page">
            <div class="header">
              ${printSettings.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="Logo" class="logo">` : ''}
              <div class="header-text">
                <p>${printSettings.universityName || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
                <p>وزارة التعليم العالي و البحث العلمي</p>
                <p>${printSettings.facultyName || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
                <p>نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</p>
              </div>
              ${printSettings.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="Faculty Logo" class="faculty-logo">` : ''}
            </div>

            <div class="title">جدول التوقيت الأسبوعي</div>
            
            <div class="professor-info">
              <p><strong>الأستاذ(ة):</strong> ${displayName}</p>
              ${!isProfessorTemporary(professor) && professor.title ? `<p><strong>المنصب:</strong> ${professor.title}</p>` : ''}
              ${!isProfessorTemporary(professor) && professor.academic_title ? `<p><strong>اللقب العلمي:</strong> ${professor.academic_title}</p>` : ''}
            </div>
            
            <div class="info">
              <p><strong>السنة الجامعية:</strong> ${currentYear.year_name}</p>
              <p><strong>الفصل:</strong> ${currentSemester.semester_name}</p>
            </div>

            <table class="schedule-table">
              <thead>
                <tr>
                  <th>التوقيت</th>
                  ${activeDays.map(day => `<th>${day.name}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
        `;

        activeTimeSlots.forEach(timeSlot => {
          scheduleTable += `<tr><td class="time-slot">${timeSlot.start} - ${timeSlot.end}</td>`;

          activeDays.forEach(day => {
            const assignment = professorAssignments.find(a =>
              a.day_of_week === day.id &&
              a.start_time === timeSlot.start && a.end_time === timeSlot.end
            );

            if (assignment) {
              const course = courses.find(c => c.id === assignment.course_id);
              const group = groups.find(g => g.id === assignment.group_id);
              const room = rooms.find(r => r.id === assignment.room_id);

              scheduleTable += `
                <td class="assignment-cell">
                  <div class="course-name">${course?.name || 'مقياس غير محدد'}</div>
                  <div class="group-info">${assignment.group_name || group?.name || 'مجموعة غير محددة'}</div>
                  <div class="room-info">القاعة: ${room?.name || 'غير محددة'}</div>
                  <div class="specialization-info">التخصص: ${assignment.specialization || group?.specialization || 'غير محدد'}</div>
                </td>
              `;
            } else {
              scheduleTable += '<td class="empty-cell">-</td>';
            }
          });

          scheduleTable += '</tr>';
        });

        scheduleTable += `
              </tbody>
            </table>
          </div>
          ${index < professors.length - 1 ? '<div class="page-break"></div>' : ''}
        `;

        return scheduleTable;
      }).filter(html => html !== '').join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>جداول التوقيت</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Arial', sans-serif; margin: 0; direction: rtl; font-size: ${printSettings.cellContentFontSize || 11}px; }
            .professor-page { min-height: 100vh; display: flex; flex-direction: column; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding: 10px; border-bottom: 2px solid #000; }
            .logo, .faculty-logo { width: ${printSettings.logoSize || 70}px; height: ${printSettings.logoSize || 70}px; object-fit: contain; }
            .header-text { text-align: center; flex: 1; margin: 0 20px; }
            .header-text p { margin: 3px 0; font-size: ${printSettings.headerFontSize || 15}px; font-weight: bold; }
            .title { font-size: ${printSettings.titleFontSize || 22}px; font-weight: bold; margin: 20px 0; text-align: center; border: 2px solid #000; padding: 10px; background-color: #f0f0f0; }
            .professor-info { margin: 20px 0; text-align: center; font-size: ${printSettings.subtitleFontSize || 14}px; background-color: #e3f2fd; padding: 15px; border-radius: 8px; border: 1px solid #2196f3; }
            .info { margin: 15px 0; text-align: center; font-size: ${printSettings.subtitleFontSize || 12}px; }
            .schedule-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .schedule-table th, .schedule-table td { border: 1px solid #000; padding: 8px; text-align: center; vertical-align: top; font-size: ${printSettings.cellContentFontSize || 10}px; }
            .schedule-table th { background-color: #f0f0f0; font-weight: bold; font-size: ${printSettings.cellContentFontSize || 11}px; text-align: center; vertical-align: middle; writing-mode: horizontal-tb; text-orientation: mixed; }
            .time-slot { background-color: #e5e7eb; font-weight: bold; min-width: 80px; }
            .assignment-cell { background-color: #dbeafe; padding: 6px; }
            .course-name { font-weight: bold; color: #1e40af; margin-bottom: 3px; font-size: ${printSettings.cellContentFontSize || 10}px; }
            .group-info { color: #059669; font-size: ${(printSettings.cellContentFontSize || 10) - 1}px; margin-bottom: 2px; }
            .room-info { color: #dc2626; font-size: ${(printSettings.cellContentFontSize || 10) - 1}px; margin-bottom: 2px; }
            .specialization-info { color: #7c2d12; font-size: ${(printSettings.cellContentFontSize || 10) - 2}px; }
            .empty-cell { background-color: #f9fafb; color: #9ca3af; }
            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>${professorsHTML}</body>
        </html>
      `;

      printContent(htmlContent, {
        title: `جداول_التوقيت_${currentYear.year_name}_${currentSemester.semester_name}`,
        orientation: 'landscape',
        asPDF: true
      });

    } catch (error) {
      console.error('Error exporting schedules without temporary names:', error);
      alert('حدث خطأ أثناء طباعة الجداول');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">عبء العمل للأساتذة</h1>

      {/* عرض السنة الأكاديمية والفصل الدراسي الحاليين */}
      <div className="current-academic-info mb-6" style={{
        textAlign: 'center',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '2px solid #dee2e6',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#0d6efd', fontSize: '18px' }}>
          السنة الدراسية: {currentYear ? currentYear.year_name : 'لم يتم تحديد السنة الدراسية'}
        </h3>
        <h3 style={{ margin: '0 0 10px 0', color: '#0d6efd', fontSize: '18px' }}>
          الفصل الدراسي: {currentSemester ? currentSemester.semester_name : 'لم يتم تحديد الفصل الدراسي'}
        </h3>
        <p style={{ margin: '5px 0 0', color: '#6c757d', fontSize: '14px' }}>
          يرجى تحديد السنة الدراسية والفصل من صفحة <a href="/academic-years" style={{ color: '#0d6efd', textDecoration: 'underline' }}>السنوات الدراسية</a>
        </p>
      </div>

      {error && <DatabaseErrorAlert error={error} onRetry={async () => { }} />}

      {isLoading ? (
        <div className="text-center p-4">جاري التحميل...</div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4 bg-white p-4 rounded shadow">
            <div className="flex items-center gap-2">
              <Button
                variant="contained"
                color={isGmailAuthenticated ? "success" : "warning"}
                startIcon={<SettingsIcon />}
                onClick={handleGmailSetup}
                size="small"
              >
                {isGmailAuthenticated ? "Gmail متصل" : "ربط Gmail"}
              </Button>

              <Button
                variant="contained"
                color="primary"
                startIcon={<EmailIcon />}
                onClick={() => setEmailDialogOpen(true)}
                disabled={!isGmailAuthenticated || isLoading}
                size="small"
              >
                إرسال الجداول عبر الإيميل
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="md:w-1/3 bg-white p-4 rounded shadow">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="بحث عن أستاذ..."
                  className="w-full p-2 border rounded"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* فلترة المقاييس */}
              <div className="mb-4 course-search-dropdown">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  فلترة حسب المقرر
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث عن مقرر..."
                    className="w-full p-2 border rounded focus:border-blue-500 focus:outline-none"
                    value={courseSearchTerm}
                    onChange={(e) => handleCourseSearch(e.target.value)}
                    onFocus={() => {
                      if (courseSearchTerm.trim()) {
                        setIsCourseDropdownOpen(true);
                      }
                    }}
                  />
                  {selectedCourse && (
                    <button
                      onClick={clearCourseFilter}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}

                  {isCourseDropdownOpen && filteredCourses.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                      {filteredCourses.map(course => (
                        <div
                          key={course.id}
                          className="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => selectCourse(course)}
                        >
                          <div className="font-medium text-sm">{course.name}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isCourseDropdownOpen && filteredCourses.length === 0 && courseSearchTerm.trim() && (
                    <div className="absolute top-full left-0 w-full bg-white border rounded shadow-lg z-50 p-2">
                      <div className="text-sm text-gray-500 text-center">لا توجد مقررات مطابقة</div>
                    </div>
                  )}
                </div>

                {selectedCourse && (
                  <div className="mt-2 text-sm text-blue-600">
                    المقرر المحدد: {allCourses.find(c => c.id === selectedCourse)?.name}
                  </div>
                )}
              </div>

              <h2 className="text-lg font-semibold mb-2">قائمة الأساتذة ({filteredWorkloads.length})</h2>

              <div className="max-h-96 overflow-y-auto">
                {filteredWorkloads.length > 0 ? (
                  <ul className="divide-y">
                    {filteredWorkloads.map((workload) => (
                      <li
                        key={workload.professor.id}
                        className={`p-2 cursor-pointer hover:bg-gray-100 ${selectedProfessor === workload.professor.id ? 'bg-blue-100' : ''}`}
                        onClick={() => setSelectedProfessor(workload.professor.id)}
                      >
                        <div className="font-medium">{workload.professor.name}</div>
                        <div className="text-sm text-gray-600">
                          الساعات: {workload.totalHours.toFixed(1)} |
                          المقررات: {workload.courses.length}
                        </div>
                        <div className="mt-2">
                          <button
                            className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportIndividualProfessorSchedule(workload.professor.id);
                            }}
                            disabled={isLoading}
                          >
                            طباعة الجدول الفردي
                          </button>
                          <button
                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm mr-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isGmailAuthenticated) {
                                setSnackbar({ open: true, message: 'يجب ربط Gmail أولاً', severity: 'warning' });
                                return;
                              }
                              handleSendEmails([workload.professor.id]);
                            }}
                            disabled={isLoading || !workload.professor.email}
                            title={!workload.professor.email ? 'لا يوجد بريد إلكتروني' : ''}
                          >
                            إرسال إيميل
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center text-gray-500 p-4">
                    {searchTerm || selectedCourse ?
                      'لا توجد نتائج للبحث أو الفلترة المحددة' :
                      'لا توجد أساتذة مع تكليفات'
                    }
                  </div>
                )}
              </div>
            </div>

            <div className="md:w-2/3 bg-white p-4 rounded shadow">
              {selectedWorkload ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{selectedWorkload.professor.name}</h2>
                    <button
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      onClick={exportToPDF}
                    >
                      تصدير PDF
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="text-lg font-semibold">
                      إجمالي الساعات الأسبوعية: {selectedWorkload.totalHours.toFixed(1)} ساعة
                    </div>
                  </div>

                  <div id="workload-table" className="border rounded overflow-hidden">
                    <h3 className="text-lg font-semibold p-2 bg-gray-100">تفاصيل المقررات</h3>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 border-b text-right">المقرر</th>
                          <th className="p-2 border-b text-center">محاضرة</th>
                          <th className="p-2 border-b text-center">أعمال موجهة</th>
                          <th className="p-2 border-b text-center">المجموع</th>
                          <th className="p-2 border-b text-center">التخصص</th>
                          <th className="p-2 border-b text-center">المستوى</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkload.courses.map((course, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="p-2 border-b">{course.course.name}</td>
                            <td className="p-2 border-b text-center">{course.lectureCount}</td>
                            <td className="p-2 border-b text-center">{course.tdCount}</td>
                            <td className="p-2 border-b text-center">{course.count}</td>
                            <td className="p-2 border-b text-center">{course.specialization || '-'}</td>
                            <td className="p-2 border-b text-center">{getAcademicLevel(course.group_year || '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <h3 className="text-lg font-semibold p-2 bg-gray-100 mt-4">توزيع الأيام</h3>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 border-b text-right">اليوم</th>
                          <th className="p-2 border-b text-center">عدد الحصص</th>
                          <th className="p-2 border-b text-center">عدد الساعات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedWorkload.days).map(([day, data], index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="p-2 border-b">{day}</td>
                            <td className="p-2 border-b text-center">{data.count}</td>
                            <td className="p-2 border-b text-center">{data.hours.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  الرجاء اختيار أستاذ لعرض تفاصيل عبء العمل
                </div>
              )}
            </div>
          </div>


          {/* Boutons de filtre et d'export */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <input
                type="text"
                placeholder="ابحث عن أستاذ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border rounded"
              />
            </div>
            <div>
              {/* Bouton pour exporter toutes les affectations */}
              <button
                onClick={exportAllToPDF}
                className="mx-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                disabled={isLoading || !workloads || workloads.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                تصدير كل التكاليف
              </button>
              {/* Bouton pour exporter les professeurs sans affectations */}
              <button
                onClick={exportProfessorsWithoutAssignments}
                className="mx-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center"
                disabled={isLoading || !professors || professors.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                تصدير الأساتذة بدون تكليفات
              </button>
              {/* Bouton pour exporter le classement des professeurs */}
              <button
                onClick={exportWorkloadRanking}
                className="mx-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
                disabled={isLoading || !workloads || workloads.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                تصدير ترتيب الأساتذة
              </button>
              {/* Bouton pour exporter les professeurs par spécialité */}
              <button
                onClick={exportProfessorSchedules}
                className="mx-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                disabled={isLoading || !workloads || workloads.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                طباعة جداول التوقيت
              </button>
              {/* Bouton pour exporter les professeurs sans noms temporaires */}
              <button
                onClick={exportProfessorSchedulesWithoutTemporary}
                className="mx-2 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center"
                disabled={isLoading || !workloads || workloads.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                تصدير PDF بدون أسماء مؤقتين
              </button>
            </div>
          </div>
          <EmailDialog
            open={emailDialogOpen}
            onClose={() => setEmailDialogOpen(false)}
            professors={professors}
            onSend={handleSendEmails}
            isSending={isSending}
          />

          <EmailStatusTracker
            open={emailStatusOpen}
            onClose={() => setEmailStatusOpen(false)}
            statuses={emailStatus}
          />

          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </>
      )}
    </div>
  );
}