import React, { useState, useEffect } from 'react';
import { Box, Checkbox, FormControlLabel } from '@mui/material';
import { format, parseISO, isValid } from 'date-fns';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import FormHelperText from '@mui/material/FormHelperText';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { arSA } from 'date-fns/locale';
import { printContent, generateSessionsListContent, generateIndividualSessionContent, generateStudentAnnouncementContent } from '../utils/printUtils';
import PrintIcon from '@mui/icons-material/Print';
import { useAcademicYear } from '../context/AcademicYearContext';
import { getDepartments } from '../services/departmentService';
import { getSpecializationsByDepartment, getGroupsBySpecializationId } from '../services/groupService';

// Définition des types
interface Room {
  id: number;
  name: string;
  building?: string;
  floor?: number;
  capacity?: number;
}

interface Professor {
  id: number;
  name: string;
}

interface Group {
  id: number;
  name: string;
  specialization?: string;
}

interface Course {
  id: number;
  name: string;
}

interface ExtraSession {
  id?: number;
  room_id: number;
  room_name?: string;
  professor_id: number;
  professor_name?: string;
  group_id: number;
  group_name?: string;
  course_id: number;
  course_name?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  session_type: 'extra' | 'makeup' | 'exam';
  description?: string;
  exam_note?: string;
  is_archived?: number;
}

interface RegularAssignment {
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

interface FormErrors {
  professor?: string;
  course?: string;
  group?: string;
  room?: string;
  date?: string;
  sessionType?: string;
  startTime?: string;
  endTime?: string;
  time?: string;
}

interface Day {
  id: number;
  name: string;
}

// Propriétés pour le composant TabPanel
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Composant TabPanel pour gérer l'affichage des onglets
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// Méthodes de base de données pour les séances supplémentaires
// Ces méthodes doivent être implémentées dans la base de données
declare global {
  interface Window {
    db: Database;  // Utiliser le type Database au lieu de any
  }
}

// دالة مساعدة لتحويل الوقت إلى دقائق للمقارنة السهلة
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export default function AvailableRooms() {
  // États pour les données
  const [rooms, setRooms] = useState<Room[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]); // الحصص القادمة فقط (غير مؤرشفة)
  const [archivedSessions, setArchivedSessions] = useState<ExtraSession[]>([]); // الحصص المؤرشفة
  const [showArchived, setShowArchived] = useState(false); // إظهار/إخفاء الأرشيف
  const [regularAssignments, setRegularAssignments] = useState<RegularAssignment[]>([]);

  // États pour le chargement et les erreurs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // États pour la recherche de salles disponibles
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  // États pour la gestion des onglets
  const [tabValue, setTabValue] = useState(0);

  // États pour le formulaire d'ajout/modification de séance
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentSession, setCurrentSession] = useState<ExtraSession | null>(null);
  const [selectedProfessor, setSelectedProfessor] = useState<number | ''>('');
  const [selectedCourse, setSelectedCourse] = useState<number | ''>('');
  const [selectedGroup, setSelectedGroup] = useState<number | ''>('');
  const [selectedRoom, setSelectedRoom] = useState<number | ''>('');
  const [sessionDate, setSessionDate] = useState<Date | null>(new Date());
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [sessionType, setSessionType] = useState<'extra' | 'makeup' | 'exam'>('extra');
  const [description, setDescription] = useState<string>('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [customStartTime, setCustomStartTime] = useState<string>('');
  const [customEndTime, setCustomEndTime] = useState<string>('');
  const [ignoreConflicts, setIgnoreConflicts] = useState<boolean>(false);

  // États pour les notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // État pour le chef de département
  const [departmentHead, setDepartmentHead] = useState<string>('رئيس القسم');
  const [departmentHeadDialogOpen, setDepartmentHeadDialogOpen] = useState(false);

  // Éتات للفترة الزمنية للطباعة
  const [printDateRangeDialogOpen, setPrintDateRangeDialogOpen] = useState(false);
  const [printStartDate, setPrintStartDate] = useState<Date | null>(null);
  const [printEndDate, setPrintEndDate] = useState<Date | null>(null);
  const [printSessionType, setPrintSessionType] = useState<'extra' | 'makeup' | 'exam' | 'all'>('all');

  // Éتات للفترة الزمنية للطباعة
  const [roomAvailabilityStatus, setRoomAvailabilityStatus] = useState<{ [key: string]: boolean }>({});
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);

  // Récupération du contexte d'année académique
  const { currentYear, currentSemester } = useAcademicYear();

  // États pour la recherche de professeurs et cours
  const [professorSearchTerm, setProfessorSearchTerm] = useState('');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [isProfessorDropdownOpen, setIsProfessorDropdownOpen] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [filteredProfessors, setFilteredProfessors] = useState<Professor[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);

  // حالات لتصفية البيانات حسب الأستاذ المختار
  const [professorCourses, setProfessorCourses] = useState<Course[]>([]);
  const [professorDepartments, setProfessorDepartments] = useState<{ id: number, name: string }[]>([]);
  const [professorSpecializations, setProfessorSpecializations] = useState<{ id: number, name: string }[]>([]);
  const [professorGroups, setProfessorGroups] = useState<Group[]>([]);

  // Éتات للفترة الزمنية للطباعة
  const [departments, setDepartments] = useState<{ id: number, name: string }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | ''>('');
  const [specializations, setSpecializations] = useState<{ id: number, name: string }[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<number | ''>('');
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);

  // État pour les jours avec des séances supplémentaires
  const [extraSessionDates, setExtraSessionDates] = useState<Set<string>>(new Set());

  // حالة إعلان الطلبة
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [announcementDepartment, setAnnouncementDepartment] = useState<number | ''>('');
  const [announcementSpecialization, setAnnouncementSpecialization] = useState<number | ''>('');
  const [announcementGroup, setAnnouncementGroup] = useState<number | ''>('');
  const [announcementSessionType, setAnnouncementSessionType] = useState<'extra' | 'makeup' | 'exam' | 'all'>('all');
  const [announcementProfessor, setAnnouncementProfessor] = useState<number | ''>('');
  const [announcementStartDate, setAnnouncementStartDate] = useState<Date | null>(null);
  const [announcementEndDate, setAnnouncementEndDate] = useState<Date | null>(null);
  const [announcementSpecializations, setAnnouncementSpecializations] = useState<{ id: number, name: string }[]>([]);
  const [announcementGroups, setAnnouncementGroups] = useState<Group[]>([]);
  const [announcementProfessors, setAnnouncementProfessors] = useState<Professor[]>([]);

  // Fonctions de chargement des données
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log('Loading initial data...');

        const roomsData = await window.db.getRooms();
        const professorsData = await window.db.getProfessors();
        const coursesData = await window.db.getCourses();
        const groupsData = await window.db.getGroups();

        setRooms(roomsData);
        setProfessors(professorsData);
        setCourses(coursesData);
        setGroups(groupsData);

        console.log('Loaded data:', {
          rooms: roomsData.length,
          professors: professorsData.length,
          courses: coursesData.length,
          groups: groupsData.length
        });

      } catch (error) {
        console.error('Error loading initial data:', error);
        setSnackbar({
          open: true,
          message: 'خطأ في تحميل البيانات الأساسية',
          severity: 'error'
        });
      }
    };

    loadInitialData();
  }, []);

  // تحميل الأقسام بشكل منفصل
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const departmentsData = await getDepartments();
        setDepartments(departmentsData);
      } catch (error) {
        console.error('Error loading departments:', error);
      }
    };

    loadDepartments();
  }, []);

  // تحميل الحصص الإضافية عند تحميل الصفحة
  useEffect(() => {
    fetchExtraSessions();
  }, []);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        console.log('🔍 loadAllData - currentYear:', currentYear);
        console.log('🔍 loadAllData - currentSemester:', currentSemester);

        // Refresh all data when component mounts or academic year changes
        if (currentYear && currentSemester) {
          console.log('Loading assignments for current year/semester...');
          console.log(`🔍 السنة الأكاديمية: ${currentYear.year_name}`);
          console.log(`🔍 الفصل الدراسي: ${currentSemester.semester_name}`);

          // Load regular assignments
          await fetchRegularAssignments();
          await fetchExtraSessions();
        } else {
          console.log('❌ currentYear أو currentSemester غير محددين في loadAllData');
        }
      } catch (error) {
        console.error('Error loading data for matrix report:', error);
      }
    };

    loadAllData();
  }, [currentYear, currentSemester]);

  // دالة لتحميل الحصص الإضافية
  const fetchExtraSessions = async () => {
    try {
      const sessions = await window.db.getExtraSessions();
      console.log('📚 Loaded extra sessions:', sessions.length);

      // فصل الحصص إلى قادمة ومؤرشفة
      const upcoming = sessions.filter((s: ExtraSession) => !s.is_archived || s.is_archived === 0);
      const archived = sessions.filter((s: ExtraSession) => s.is_archived === 1);

      console.log(`✅ Upcoming sessions: ${upcoming.length}, Archived: ${archived.length}`);

      setExtraSessions(upcoming); // فقط الحصص القادمة
      setArchivedSessions(archived); // الحصص المؤرشفة
    } catch (error) {
      console.error('Error fetching extra sessions:', error);
      setSnackbar({
        open: true,
        message: 'خطأ في تحميل الحصص الإضافية',
        severity: 'error'
      });
    }
  };

  // دالة لتنفيذ الأرشفة يدوياً
  const manualArchivePastSessions = async () => {
    try {
      const result = await window.db.archivePastSessions();

      if (result.error) {
        setSnackbar({
          open: true,
          message: `خطأ في الأرشفة: ${result.error}`,
          severity: 'error'
        });
      } else {
        // إعادة تحميل الحصص بعد الأرشفة
        await fetchExtraSessions();

        setSnackbar({
          open: true,
          message: `تم أرشفة ${result.archived} حصة منتهية بنجاح`,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error in manual archiving:', error);
      setSnackbar({
        open: true,
        message: 'خطأ في تنفيذ الأرشفة',
        severity: 'error'
      });
    }
  };

  // Données statiques
  const days: Day[] = [
    { id: 0, name: 'السبت' },
    { id: 1, name: 'الأحد' },
    { id: 2, name: 'الاثنين' },
    { id: 3, name: 'الثلاثاء' },
    { id: 4, name: 'الأربعاء' },
    { id: 5, name: 'الخميس' },
    { id: 6, name: 'الجمعة' }
  ];

  // Liste des créneaux horaires
  const lectureTimes = [
    '08:00 - 09:30',
    '09:30 - 11:00',
    '11:00 - 12:30',
    '12:30 - 14:00',
    '14:00 - 15:30',
    '15:30 - 17:00'
  ];

  // Fonction pour طباعة قائمة الحصص الإضافية وحصص التعويض
  const printSessionsList = (type: 'extra' | 'makeup' | 'all' = 'all') => {
    setPrintSessionType(type);
    setPrintDateRangeDialogOpen(true);
  };

  // Fonction لطباعة قائمة الحصص الإضافية وحصص التعويض مع فترة زمنية محددة
  const executePrintSessionsList = () => {
    let filteredSessions = extraSessions;

    // Filtrer par type si nécessaire
    if (printSessionType !== 'all') {
      filteredSessions = filteredSessions.filter(session => session.session_type === printSessionType);
    }

    // Filtrer par فترة زمنية إذا كانت محددة
    if (printStartDate && printEndDate) {
      const startDateStr = format(printStartDate, 'yyyy-MM-dd');
      const endDateStr = format(printEndDate, 'yyyy-MM-dd');

      filteredSessions = filteredSessions.filter(session => {
        return session.session_date >= startDateStr && session.session_date <= endDateStr;
      });
    }

    const content = generateSessionsListContent(filteredSessions, printSessionType);
    const title = printSessionType === 'extra'
      ? 'قائمة الحصص الإضافية'
      : printSessionType === 'makeup'
        ? 'قائمة حصص التعويض'
        : printSessionType === 'exam'
          ? 'قائمة إمتحانات الأعمال الموجهة'
          : 'قائمة الحصص الإضافية وحصص التعويض وإمتحانات الأعمال الموجهة';

    const dateRangeText = (printStartDate && printEndDate)
      ? ` (من ${format(printStartDate, 'dd/MM/yyyy')} إلى ${format(printEndDate, 'dd/MM/yyyy')})`
      : '';

    printContent(content, {
      title: title + dateRangeText,
      orientation: 'landscape',
      fontSize: '12pt',
      asPDF: true // ✅ توليد PDF حقيقي
    });

    // إغلاق الحوار وإعادة تعيين القيم
    setPrintDateRangeDialogOpen(false);
    setPrintStartDate(null);
    setPrintEndDate(null);
  };

  // Fonction لطباعة شهادة حصة إضافية أو حصة تعويض
  const printIndividualSession = (session: ExtraSession) => {
    const content = generateIndividualSessionContent(session, departmentHead);
    const sessionType = session.session_type === 'extra' ? 'حصة إضافية' : 'حصة تعويض';
    const title = `شهادة ${sessionType} - ${session.professor_name}`;

    printContent(content, {
      title,
      orientation: 'portrait',
      fontSize: '14pt',
      asPDF: true // ✅ توليد PDF حقيقي
    });
  };

  // تحميل التخصصات عند تغيير القسم في إعلان الطلبة
  useEffect(() => {
    const loadAnnouncementSpecializations = async () => {
      if (announcementDepartment) {
        try {
          // تحميل جميع التخصصات للقسم بدون فلترة
          const specs = await getSpecializationsByDepartment(announcementDepartment as number);
          setAnnouncementSpecializations(specs);
          setAnnouncementSpecialization(''); // إعادة تعيين
          setAnnouncementGroups([]);
        } catch (error) {
          console.error('Error loading specializations:', error);
        }
      } else {
        setAnnouncementSpecializations([]);
        setAnnouncementSpecialization('');
      }
    };
    loadAnnouncementSpecializations();
  }, [announcementDepartment]);

  // تحميل الأفواج عند تغيير التخصص في إعلان الطلبة
  useEffect(() => {
    const loadAnnouncementGroups = async () => {
      if (announcementSpecialization) {
        try {
          // تحميل جميع الأفواج للتخصص باستخدام ID
          const grps = await getGroupsBySpecializationId(announcementSpecialization as number);
          console.log(`تم تحميل ${grps.length} فوج للتخصص ID: ${announcementSpecialization}`, grps);
          setAnnouncementGroups(grps);
          setAnnouncementGroup(''); // إعادة تعيين
        } catch (error) {
          console.error('Error loading groups:', error);
        }
      } else {
        setAnnouncementGroups([]);
        setAnnouncementGroup('');
      }
    };
    loadAnnouncementGroups();
  }, [announcementSpecialization]);

  // تحميل الأساتذة الذين لهم حصص إضافية أو تعويضية
  useEffect(() => {
    const loadAnnouncementProfessors = () => {
      // استخراج الأساتذة الفريدين من الحصص الإضافية
      const uniqueProfessors = new Map<number, Professor>();

      extraSessions.forEach(session => {
        if (session.professor_id && !uniqueProfessors.has(session.professor_id)) {
          uniqueProfessors.set(session.professor_id, {
            id: session.professor_id,
            name: session.professor_name || 'غير معروف'
          });
        }
      });

      const professorsArray = Array.from(uniqueProfessors.values());
      setAnnouncementProfessors(professorsArray);
    };

    loadAnnouncementProfessors();
  }, [extraSessions]);

  // دالة لطباعة إعلان الطلبة
  const printStudentAnnouncement = async () => {
    try {
      console.log('📝 بدء فلترة الحصص...');
      console.log('extraSessions الإجمالي:', extraSessions.length);
      console.log('المعايير:', {
        sessionType: announcementSessionType,
        department: announcementDepartment,
        specialization: announcementSpecialization,
        group: announcementGroup
      });

      // فلترة الحصص حسب المعايير المختارة
      let filteredSessions = extraSessions;
      console.log('1. بدء بعدد:', filteredSessions.length);

      // فلترة حسب نوع الحصة
      if (announcementSessionType !== 'all') {
        filteredSessions = filteredSessions.filter(s => s.session_type === announcementSessionType);
        console.log(`2. بعد فلترة نوع الحصة (${announcementSessionType}):`, filteredSessions.length);
      }

      // فلترة حسب القسم
      if (announcementDepartment) {
        const deptGroups = groups.filter(g => g.department_id === announcementDepartment);
        const deptGroupIds = deptGroups.map(g => g.id);
        console.log(`3. أفواج القسم (${announcementDepartment}):`, deptGroupIds.length, deptGroupIds);
        filteredSessions = filteredSessions.filter(s => deptGroupIds.includes(s.group_id));
        console.log('   بعد فلترة القسم:', filteredSessions.length);
        if (filteredSessions.length > 0) {
          const sessionSample = filteredSessions[0];
          const sessionGroup = groups.find(g => g.id === sessionSample.group_id);
          console.log('   تفاصيل الحصة المتبقية:', {
            group_id: sessionSample.group_id,
            group_name: sessionSample.group_name,
            course: sessionSample.course_name,
            groupDetails: sessionGroup
          });
          console.log('   ⚠️ ملاحظة: specialization الفعلي للفوج =', sessionGroup?.specialization, ', والتخصص المختار =', announcementSpecialization);
        }
      }

      // فلترة حسب التخصص
      if (announcementSpecialization) {
        // الحصول على اسم التخصص من ID
        const selectedSpec = announcementSpecializations.find(s => s.id === announcementSpecialization);
        const specName = selectedSpec?.name;
        console.log(`4. التخصص المختار: ID=${announcementSpecialization}, Name="${specName}"`);

        // فلترة الأفواج حسب اسم التخصص
        const specGroups = groups.filter(g => g.specialization === specName);
        const specGroupIds = specGroups.map(g => g.id);
        console.log(`   أفواج التخصص "${specName}":`, specGroupIds.length, specGroupIds);

        filteredSessions = filteredSessions.filter(s => specGroupIds.includes(s.group_id));
        console.log('   بعد فلترة التخصص:', filteredSessions.length);
      }

      // فلترة حسب الفوج
      if (announcementGroup) {
        filteredSessions = filteredSessions.filter(s => s.group_id === announcementGroup);
        console.log(`5. بعد فلترة الفوج (${announcementGroup}):`, filteredSessions.length);
      }

      // فلترة حسب الأستاذ
      if (announcementProfessor) {
        filteredSessions = filteredSessions.filter(s => s.professor_id === announcementProfessor);
        console.log(`6. بعد فلترة الأستاذ (${announcementProfessor}):`, filteredSessions.length);
      }

      // فلترة حسب تاريخ البداية
      if (announcementStartDate) {
        const startDateStr = format(announcementStartDate, 'yyyy-MM-dd');
        filteredSessions = filteredSessions.filter(s => s.session_date >= startDateStr);
        console.log(`7. بعد فلترة تاريخ البداية (${startDateStr}):`, filteredSessions.length);
      }

      // فلترة حسب تاريخ النهاية
      if (announcementEndDate) {
        const endDateStr = format(announcementEndDate, 'yyyy-MM-dd');
        filteredSessions = filteredSessions.filter(s => s.session_date <= endDateStr);
        console.log(`8. بعد فلترة تاريخ النهاية (${endDateStr}):`, filteredSessions.length);
      }

      console.log('🎯 النتيجة النهائية:', filteredSessions.length, 'حصص');
      if (filteredSessions.length > 0) {
        console.log('عينة من الحصص:', filteredSessions.slice(0, 2));
      }

      if (filteredSessions.length === 0) {
        setSnackbar({
          open: true,
          message: 'لا توجد حصص تطابق معايير البحث',
          severity: 'warning'
        });
        return;
      }

      // الحصول على إعدادات الطباعة
      const printSettings = await window.dataUtils.getPrintSettings();

      // الحصول على أسماء القسم والتخصص والأستاذ
      const departmentName = announcementDepartment
        ? departments.find(d => d.id === announcementDepartment)?.name || ''
        : '';
      const specializationName = announcementSpecialization
        ? announcementSpecializations.find(s => s.id === announcementSpecialization)?.name || ''
        : '';
      const professorName = announcementProfessor
        ? announcementProfessors.find(p => p.id === announcementProfessor)?.name || ''
        : '';

      // توليد محتوى الإعلان
      const content = generateStudentAnnouncementContent(
        filteredSessions,
        departmentName,
        specializationName,
        announcementSessionType,
        printSettings
      );

      // عنوان للطباعة مع تفاصيل الفلترة
      let title = 'إعلان للطلبة';
      const titleParts = [];

      if (departmentName) titleParts.push(departmentName);
      if (specializationName) titleParts.push(specializationName);
      if (professorName) titleParts.push(`أ. ${professorName}`);
      if (announcementStartDate || announcementEndDate) {
        const dateRange = announcementStartDate && announcementEndDate
          ? `${format(announcementStartDate, 'dd/MM/yyyy')} - ${format(announcementEndDate, 'dd/MM/yyyy')}`
          : announcementStartDate
            ? `من ${format(announcementStartDate, 'dd/MM/yyyy')}`
            : `حتى ${format(announcementEndDate!, 'dd/MM/yyyy')}`;
        titleParts.push(dateRange);
      }

      if (titleParts.length > 0) {
        title += ' - ' + titleParts.join(' | ');
      }

      // طباعة المحتوى
      printContent(content, {
        title,
        orientation: 'portrait',
        fontSize: '12pt',
        asPDF: true
      });

      // إغلاق الحوار
      setAnnouncementDialogOpen(false);
    } catch (error) {
      console.error('Error printing student announcement:', error);
      setSnackbar({
        open: true,
        message: 'حدث خطأ في طباعة الإعلان',
        severity: 'error'
      });
    }
  };

  // Fonction لتصدير مصفوفة توفر القاعات
  const exportRoomAvailabilityMatrix = async () => {
    try {
      // Get print settings for branding
      const printSettings = await window.dataUtils.getPrintSettings();

      // Force load all necessary data first
      console.log('=== Loading all necessary data for room availability matrix ===');

      // Load rooms if empty
      let currentRooms = rooms;
      if (currentRooms.length === 0) {
        console.log('Loading rooms...');
        try {
          currentRooms = await window.db.getRooms();
          console.log('Loaded rooms:', currentRooms.length);
        } catch (error) {
          console.error('Error loading rooms:', error);
          currentRooms = [];
        }
      }

      // Load professors if empty
      let currentProfessors = professors;
      if (currentProfessors.length === 0) {
        console.log('Loading professors...');
        try {
          currentProfessors = await window.db.getProfessors();
          console.log('Loaded professors:', currentProfessors.length);
        } catch (error) {
          console.error('Error loading professors:', error);
          currentProfessors = [];
        }
      }

      // Load courses if empty
      let currentCourses = courses;
      if (currentCourses.length === 0) {
        console.log('Loading courses...');
        try {
          currentCourses = await window.db.getCourses();
          console.log('Loaded courses:', currentCourses.length);
        } catch (error) {
          console.error('Error loading courses:', error);
          currentCourses = [];
        }
      }

      // Load groups if empty
      let currentGroups = groups;
      if (currentGroups.length === 0) {
        console.log('Loading groups...');
        try {
          currentGroups = await window.db.getGroups();
          console.log('Loaded groups:', currentGroups.length);
        } catch (error) {
          console.error('Error loading groups:', error);
          currentGroups = [];
        }
      }

      // Days excluding Friday (id: 6)
      const workingDays = days.filter(day => day.id !== 6);

      // Create room availability matrix
      const roomAvailabilityData: { [roomId: number]: { [timeSlot: string]: { [dayId: number]: { available: boolean; occupiedBy?: string } } } } = {};

      // Initialize matrix for all rooms
      currentRooms.forEach(room => {
        roomAvailabilityData[room.id] = {};
        lectureTimes.forEach(timeSlot => {
          roomAvailabilityData[room.id][timeSlot] = {};
          workingDays.forEach(day => {
            roomAvailabilityData[room.id][timeSlot][day.id] = { available: true }; // Initially available
          });
        });
      });

      // Mark occupied slots based on regular assignments
      regularAssignments.forEach(assignment => {
        if (assignment.day_of_week !== 6) { // Exclude Friday
          const timeSlot = `${assignment.start_time} - ${assignment.end_time}`;
          if (roomAvailabilityData[assignment.room_id] && roomAvailabilityData[assignment.room_id][timeSlot]) {
            // Get group details to find specialization
            const group = currentGroups.find(g => g.id === assignment.group_id);
            const professor = currentProfessors.find(p => p.id === assignment.professor_id);
            const course = currentCourses.find(c => c.id === assignment.course_id);

            const groupName = group?.name || 'مجموعة غير معروفة';
            const professorName = professor?.name || 'أستاذ غير معروف';
            const courseName = course?.name || 'مقياس غير معروف';
            const specialization = assignment.specialization || group?.specialization || 'تخصص غير محدد';

            roomAvailabilityData[assignment.room_id][timeSlot][assignment.day_of_week] = {
              available: false,
              occupiedBy: `${professorName} - ${courseName} - ${groupName} - ${specialization}`
            };
          }
        }
      });

      // Generate HTML content for the matrix
      let htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>مصفوفة توفر القاعات</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 15mm;
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 0;
              direction: rtl;
              font-size: ${printSettings?.cellContentFontSize || 10}px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .university-name {
              font-size: ${printSettings?.titleFontSize || 18}px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .faculty-name {
              font-size: ${printSettings?.subtitleFontSize || 14}px;
              margin-bottom: 5px;
            }
            .report-title {
              font-size: ${printSettings?.subtitleFontSize || 16}px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #333;
            }
            .matrix-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-size: ${printSettings?.cellContentFontSize || 8}px;
            }
            .matrix-table th, .matrix-table td {
              border: 1px solid #333;
              padding: 4px;
              text-align: center;
              vertical-align: middle;
            }
            .matrix-table th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .available-cell {
              background-color: #c8e6c9;
              color: #2e7d32;
            }
            .occupied-cell {
              background-color: #ffcdd2;
              color: #c62828;
              font-size: ${(printSettings?.cellContentFontSize || 8) - 1}px;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: ${(printSettings?.cellContentFontSize || 10) - 1}px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings?.universityName ? `<div class="university-name">${printSettings.universityName}</div>` : ''}
            ${printSettings?.facultyName ? `<div class="faculty-name">${printSettings.facultyName}</div>` : ''}
            <div class="report-title">مصفوفة توفر القاعات الدراسية</div>
            <div>السنة الأكاديمية: ${currentYear?.year_name || 'غير محدد'} - الفصل: ${currentSemester?.semester_name || 'غير محدد'}</div>
          </div>
          
          ${currentRooms.map(room => `
            <div style="page-break-inside: avoid; margin-bottom: 30px;">
              <h3 style="text-align: center; margin: 20px 0;">قاعة ${room.name}</h3>
              <table class="matrix-table">
                <thead>
                  <tr>
                    <th>الفترة الزمنية</th>
                    ${workingDays.map(day => `<th>${day.name}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${lectureTimes.map(timeSlot => `
                    <tr>
                      <td style="background-color: #e0e0e0; font-weight: bold;">${timeSlot}</td>
                      ${workingDays.map(day => {
        const cellData = roomAvailabilityData[room.id][timeSlot][day.id];
        const cellClass = cellData.available ? 'available-cell' : 'occupied-cell';
        const cellContent = cellData.available ? 'متاح' : cellData.occupiedBy;
        return `<td class="${cellClass}">${cellContent}</td>`;
      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
          
          <div class="footer">
            <div><strong>ملاحظة:</strong> الأخضر = متاح، الأحمر = مشغول</div>
            <div>تم إنشاء هذا التقرير في: ${new Date().toLocaleDateString('ar-SA')} الساعة ${new Date().toLocaleTimeString('ar-SA')}</div>
            <div>رئيس القسم: ${departmentHead}</div>
          </div>
        </body>
        </html>
      `;

      // Create and open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }

    } catch (error) {
      console.error('خطأ في تصدير مصفوفة توفر القاعات:', error);
      setSnackbar({
        open: true,
        message: `خطأ في تصدير التقرير: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        severity: 'error'
      });
    }
  };

  // Fonction لطباعة تقرير مصفوفي يومي لمتابعة القاعات
  const exportDailyRoomMatrix = async () => {
    try {
      // Debug selectedDay value
      console.log('=== DEBUG: Selected Day Validation ===');
      console.log('selectedDay value:', selectedDay);
      console.log('selectedDay type:', typeof selectedDay);
      console.log('Available days:', days);

      // Check if a day is selected
      if (!selectedDay && selectedDay !== 0) {
        setSnackbar({
          open: true,
          message: 'يرجى اختيار يوم من القائمة المنسدلة قبل إنشاء التقرير',
          severity: 'error'
        });
        return;
      }

      // Get the selected day name - handle both string and number types
      const dayId = typeof selectedDay === 'string' ? parseInt(selectedDay) : selectedDay;
      const selectedDayObj = days.find(day => day.id === dayId);

      console.log('Parsed dayId:', dayId);
      console.log('Found selectedDayObj:', selectedDayObj);

      if (!selectedDayObj) {
        console.log('Available day IDs:', days.map(d => d.id));
        setSnackbar({
          open: true,
          message: `اليوم المحدد غير صحيح. القيمة المحددة: ${selectedDay}`,
          severity: 'error'
        });
        return;
      }

      // Get print settings for branding
      const printSettings = await window.dataUtils.getPrintSettings();

      // Force load all necessary data first
      console.log('=== Loading all necessary data for matrix report ===');

      // Load rooms if empty
      let currentRooms = rooms;
      if (currentRooms.length === 0) {
        console.log('Loading rooms...');
        try {
          currentRooms = await window.db.getRooms();
          console.log('Loaded rooms:', currentRooms.length);
        } catch (error) {
          console.error('Error loading rooms:', error);
          currentRooms = [];
        }
      }

      // Load professors if empty
      let currentProfessors = professors;
      if (currentProfessors.length === 0) {
        console.log('Loading professors...');
        try {
          currentProfessors = await window.db.getProfessors();
          console.log('Loaded professors:', currentProfessors.length);
        } catch (error) {
          console.error('Error loading professors:', error);
          currentProfessors = [];
        }
      }

      // Load courses if empty
      let currentCourses = courses;
      if (currentCourses.length === 0) {
        console.log('Loading courses...');
        try {
          currentCourses = await window.db.getCourses();
          console.log('Loaded courses:', currentCourses.length);
        } catch (error) {
          console.error('Error loading courses:', error);
          currentCourses = [];
        }
      }

      // Load groups if empty
      let currentGroups = groups;
      if (currentGroups.length === 0) {
        console.log('Loading groups...');
        try {
          currentGroups = await window.db.getGroups();
          console.log('Loaded groups:', currentGroups.length);
        } catch (error) {
          console.error('Error loading groups:', error);
          currentGroups = [];
        }
      }

      // Load regular assignments for current year/semester
      let currentRegularAssignments = regularAssignments;
      console.log('Initial regular assignments:', currentRegularAssignments.length);

      // Force reload assignments if empty or if we need fresh data
      if (currentRegularAssignments.length === 0 || !currentYear || !currentSemester) {
        console.log('Loading fresh regular assignments...');
        try {
          if (currentYear && currentSemester) {
            currentRegularAssignments = await window.db.getAssignments(
              currentYear.year_name,
              currentSemester.semester_name,
              ''
            );
            console.log('Fresh assignments loaded:', currentRegularAssignments.length);
          }
        } catch (error) {
          console.error('Error loading fresh assignments:', error);
          currentRegularAssignments = [];
        }
      }

      // Debug: Check data availability after loading
      console.log('=== DEBUG: Daily Matrix Report Data ===');
      console.log('Selected Day:', dayId, selectedDayObj.name);
      console.log('Rooms:', currentRooms.length, currentRooms);
      console.log('Professors:', currentProfessors.length, currentProfessors);
      console.log('Courses:', currentCourses.length, currentCourses);
      console.log('Groups:', currentGroups.length, currentGroups);
      console.log('Regular Assignments:', currentRegularAssignments.length, currentRegularAssignments);
      console.log('Current Year:', currentYear);
      console.log('Current Semester:', currentSemester);

      // Check if we have necessary data
      if (currentRooms.length === 0) {
        setSnackbar({
          open: true,
          message: 'لا توجد قاعات متاحة لإنشاء التقرير',
          severity: 'error'
        });
        return;
      }

      if (currentRegularAssignments.length === 0) {
        setSnackbar({
          open: true,
          message: 'لا توجد تكليفات منتظمة لإنشاء التقرير للسنة والفصل الحاليين',
          severity: 'error'
        });
        return;
      }

      // Create room matrix data for the selected day only
      const roomMatrixData: { [roomId: number]: { [timeSlot: string]: string } } = {};

      // Initialize matrix for all rooms
      currentRooms.forEach(room => {
        roomMatrixData[room.id] = {};
        lectureTimes.forEach(timeSlot => {
          roomMatrixData[room.id][timeSlot] = 'فارغ'; // فارغ في البداية
        });
      });

      // Fill data from regular assignments for the selected day only
      let assignmentsProcessed = 0;
      currentRegularAssignments.forEach(assignment => {
        console.log('Processing assignment:', assignment);

        // Only process assignments for the selected day
        if (assignment.day_of_week === dayId) {
          const timeSlot = `${assignment.start_time} - ${assignment.end_time}`;
          const timeSlotNoSpaces = `${assignment.start_time}-${assignment.end_time}`;
          console.log('Time slot with spaces:', timeSlot);
          console.log('Time slot without spaces:', timeSlotNoSpaces);
          console.log('Room ID:', assignment.room_id);
          console.log('Available lecture times:', lectureTimes);

          if (roomMatrixData[assignment.room_id] && (lectureTimes.includes(timeSlot) || lectureTimes.includes(timeSlotNoSpaces))) {
            // Get professor, course, and group details
            const professor = currentProfessors.find(p => p.id === assignment.professor_id);
            const course = currentCourses.find(c => c.id === assignment.course_id);
            const group = currentGroups.find(g => g.id === assignment.group_id);

            console.log('Found professor:', professor);
            console.log('Found course:', course);
            console.log('Found group:', group);

            const professorName = professor?.name || `أستاذ ${assignment.professor_id}`;
            const courseName = course?.name || `مقياس ${assignment.course_id}`;
            const groupName = group?.name || `مجموعة ${assignment.group_id}`;
            const specialization = assignment.specialization || group?.specialization || 'تخصص غير محدد';

            // Use the correct time slot format that exists in lectureTimes
            const matrixTimeSlot = lectureTimes.includes(timeSlot) ? timeSlot : (lectureTimes.find(lt => lt.replace(' - ', '-') === timeSlotNoSpaces) || timeSlot);
            roomMatrixData[assignment.room_id][matrixTimeSlot] = `${professorName}<br/>${courseName}<br/>${groupName}<br/>${specialization}`;
            assignmentsProcessed++;

            console.log('Matrix time slot used:', matrixTimeSlot);
            console.log('Cell content set:', roomMatrixData[assignment.room_id][matrixTimeSlot]);
          } else {
            console.log('Skipping assignment - room or time slot not found');
          }
        }
      });

      console.log(`Processed ${assignmentsProcessed} assignments for ${selectedDayObj.name}`);
      console.log('Final matrix data:', roomMatrixData);

      // Generate HTML content for the matrix
      let htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>التقرير المصفوفي اليومي لمتابعة القاعات - ${selectedDayObj.name}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 0;
              direction: rtl;
              font-size: ${printSettings?.cellContentFontSize || 9}px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .university-name {
              font-size: ${printSettings?.titleFontSize || 18}px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .faculty-name {
              font-size: ${printSettings?.subtitleFontSize || 14}px;
              margin-bottom: 5px;
            }
            .report-title {
              font-size: ${printSettings?.subtitleFontSize || 16}px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #333;
            }
            .day-title {
              font-size: ${printSettings?.subtitleFontSize || 14}px;
              font-weight: bold;
              margin-bottom: 15px;
              color: #1976d2;
              background-color: #e3f2fd;
              padding: 10px;
              border-radius: 5px;
            }
            .matrix-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .matrix-table th, .matrix-table td {
              border: 1px solid #333;
              padding: 8px;
              text-align: center;
              vertical-align: middle;
              font-size: ${printSettings?.cellContentFontSize || 9}px;
            }
            .matrix-table th {
              background-color: #f0f0f0;
              font-weight: bold;
              font-size: ${printSettings?.cellContentFontSize || 10}px;
            }
            .room-header {
              background-color: #e0e0e0;
              font-weight: bold;
              width: 120px;
              min-width: 120px;
            }
            .time-header {
              background-color: #f0f0f0;
              font-weight: bold;
              min-width: 80px;
            }
            .occupied-cell {
              background-color: #ffeb3b;
              font-size: ${(printSettings?.cellContentFontSize || 9) - 1}px;
              line-height: 1.2;
            }
            .empty-cell {
              background-color: #ffffff;
              color: #999;
              font-style: italic;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: ${(printSettings?.cellContentFontSize || 10) - 1}px;
              color: #666;
            }
            .debug-info {
              margin-top: 10px;
              font-size: 10px;
              color: #666;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings?.universityName ? `<div class="university-name">${printSettings.universityName}</div>` : ''}
            ${printSettings?.facultyName ? `<div class="faculty-name">${printSettings.facultyName}</div>` : ''}
            <div class="report-title">التقرير المصفوفي اليومي لمتابعة القاعات</div>
            <div>السنة الأكاديمية: ${currentYear?.year_name || 'غير محدد'} - الفصل: ${currentSemester?.semester_name || 'غير محدد'}</div>
            <div class="day-title">يوم ${selectedDayObj.name}</div>
          </div>
          
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="room-header">القاعة</th>
                ${lectureTimes.map(timeSlot => `<th class="time-header">${timeSlot}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${currentRooms.map(room => `
                <tr>
                  <td class="room-header">قاعة ${room.name}</td>
                  ${lectureTimes.map(timeSlot => {
        const cellContent = roomMatrixData[room.id][timeSlot];
        const isEmpty = cellContent === 'فارغ';
        return `<td class="${isEmpty ? 'empty-cell' : 'occupied-cell'}">${cellContent}</td>`;
      }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <div><strong>ملاحظة:</strong> هذا التقرير يشمل الجدولة المنتظمة ليوم ${selectedDayObj.name} فقط</div>
            <div>تم إنشاء هذا التقرير في: ${new Date().toLocaleDateString('ar-SA')} الساعة ${new Date().toLocaleTimeString('ar-SA')}</div>
            <div>رئيس القسم: ${departmentHead}</div>
            <div class="debug-info">
              Debug: ${currentRooms.length} قاعات، ${assignmentsProcessed} تكليفات معالجة ليوم ${selectedDayObj.name}
            </div>
          </div>
        </body>
        </html>
      `;

      // Create and open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }

    } catch (error) {
      console.error('خطأ في تصدير التقرير المصفوفي اليومي:', error);
      setSnackbar({
        open: true,
        message: `خطأ في تصدير التقرير: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        severity: 'error'
      });
    }
  };

  // Fonction pour trouver les salles disponibles
  const findAvailableRooms = () => {
    if (!selectedDay || !selectedTime) {
      setSnackbar({
        open: true,
        message: 'Veuillez sélectionner un jour et un horaire',
        severity: 'error'
      });
      return;
    }

    // Extraction des heures de début et de fin du créneau sélectionné
    const [selectedStartTime, selectedEndTime] = selectedTime.split(' - ');

    // Conversion en minutes pour faciliter la comparaison
    const selectedStartMinutes = timeToMinutes(selectedStartTime);
    const selectedEndMinutes = timeToMinutes(selectedEndTime);

    // Conversion du jour sélectionné en indice numérique
    const selectedDayIndex = parseInt(selectedDay, 10);

    // Filtrage des salles déjà occupées par des cours réguliers
    const usedRoomIdsRegular: number[] = [];

    // Vérification des assignations régulières
    const conflictingRegularAssignments = regularAssignments.filter(assignment => {
      // Vérifier si c'est le même jour de la semaine
      if (assignment.day_of_week !== selectedDayIndex) {
        return false;
      }

      // ✅ تصفية حسب السنة الدراسية والفصل الحالي
      if (currentYear && currentSemester) {
        if (assignment.academic_year !== currentYear.year_name ||
          assignment.semester !== currentSemester.semester_name) {
          return false;
        }
      }

      // Vérifier si les horaires se chevauchent
      const assignmentStartMinutes = timeToMinutes(assignment.start_time);
      const assignmentEndMinutes = timeToMinutes(assignment.end_time);

      return (selectedStartMinutes < assignmentEndMinutes && selectedEndMinutes > assignmentStartMinutes);
    });

    conflictingRegularAssignments.forEach(assignment => {
      usedRoomIdsRegular.push(assignment.room_id);
    });

    // Si on a sélectionné une date spécifique, on vérifie aussi les séances exceptionnelles
    const usedRoomIdsExtra: number[] = [];

    if (selectedDate) {
      const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');

      const conflictingExtraSessions = extraSessions.filter(session => {
        // Vérification de la date
        if (session.session_date !== formattedSelectedDate) {
          return false;
        }

        // Vérification du chevauchement d'horaires
        const sessionStartMinutes = timeToMinutes(session.start_time);
        const sessionEndMinutes = timeToMinutes(session.end_time);

        return (selectedStartMinutes < sessionEndMinutes && selectedEndMinutes > sessionStartMinutes);
      });

      conflictingExtraSessions.forEach(session => {
        usedRoomIdsExtra.push(session.room_id);
      });
    }

    // Combinaison des deux listes de salles occupées
    const usedRoomIds = [...new Set([...usedRoomIdsRegular, ...usedRoomIdsExtra])];

    // Filtrage des salles disponibles selon les critères
    const available = rooms.filter(room => {
      const isNotUsed = !usedRoomIds.includes(room.id);
      const meetsCapacity = (minCapacity === 0 || (room.capacity || 0) >= minCapacity);

      return isNotUsed && meetsCapacity;
    });

    console.log(`${available.length} salles disponibles trouvées sur ${rooms.length} salles totales`);
    setAvailableRooms(available);
  };

  // Fonction pour vérifier s'il y a des conflits
  const checkForConflicts = (
    professorId: number,
    groupId: number,
    sessionDate: string,
    startTime: string,
    endTime: string,
    currentSessionId?: number,
    roomId?: number,
    sessionType?: 'extra' | 'makeup' | 'exam'
  ): { hasConflict: boolean, conflictMessage: string } => {
    // Conversion en minutes pour comparaison
    const newStartMinutes = timeToMinutes(startTime);
    const newEndMinutes = timeToMinutes(endTime);

    // Convertir la date de session en jour de la semaine
    // ✅ استخدام parseISO لتجنب مشاكل timezone
    const sessionDateObj = parseISO(sessionDate);
    const dayOfWeek = sessionDateObj.getDay(); // 0 = Dimanche, 1 = Lundi, etc.

    // Convertir au format utilisé dans le système
    // System: 0=السبت, 1=الأحد, 2=الاثنين, 3=الثلاثاء, 4=الأربعاء, 5=الخميس, 6=الجمعة
    // JS:     0=الأحد, 1=الاثنين, 2=الثلاثاء, 3=الأربعاء, 4=الخميس, 5=الجمعة, 6=السبت
    let systemDayOfWeek: number;
    if (dayOfWeek === 0) { // Sunday (الأحد) في JS
      systemDayOfWeek = 1; // الأحد في النظام
    } else if (dayOfWeek === 6) { // Saturday (السبت) في JS
      systemDayOfWeek = 0; // السبت في النظام
    } else { // Monday-Friday (1-5) في JS
      systemDayOfWeek = dayOfWeek + 1; // (2-6) في النظام
    }

    const conflictMessages: string[] = [];

    console.log(`🔍 checkForConflicts - regularAssignments.length: ${regularAssignments.length}`);
    console.log(`🔍 checkForConflicts - systemDayOfWeek: ${systemDayOfWeek}`);

    // تسجيل تفاصيل التكليفات العادية في اليوم المحدد
    const dayAssignments = regularAssignments.filter(assignment =>
      assignment.day_of_week === systemDayOfWeek
    );
    console.log(`🔍 التكليفات العادية في اليوم ${systemDayOfWeek}: ${dayAssignments.length}`);
    if (dayAssignments.length > 0) {
      console.log('📋 تفاصيل التكليفات العادية في اليوم المحدد:');
      dayAssignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     القاعة: ${assignment.room_id}`);
        console.log(`     السنة الأكاديمية: ${assignment.academic_year}`);
        console.log(`     الفصل الدراسي: ${assignment.semester}`);
        console.log('');
      });
    }

    // Vérification des conflits avec les assignations régulières
    const conflictingRegularAssignments = regularAssignments.filter(assignment => {
      // Vérifier si c'est le même jour de la semaine
      if (assignment.day_of_week !== systemDayOfWeek) {
        return false;
      }

      // ✅ تصفية حسب السنة الدراسية والفصل الحالي
      if (currentYear && currentSemester) {
        if (assignment.academic_year !== currentYear.year_name ||
          assignment.semester !== currentSemester.semester_name) {
          return false;
        }
      }

      // Vérifier le chevauchement d'horaires
      const assignmentStartMinutes = timeToMinutes(assignment.start_time);
      const assignmentEndMinutes = timeToMinutes(assignment.end_time);

      return (newStartMinutes < assignmentEndMinutes && newEndMinutes > assignmentStartMinutes);
    });

    console.log(`🔍 checkForConflicts - conflictingRegularAssignments.length: ${conflictingRegularAssignments.length}`);

    // Analyser les conflits avec les assignations régulières
    conflictingRegularAssignments.forEach(assignment => {
      // ✅ منطق خاص للفروض المحروسة: السماح بنفس الأستاذ والفوج والقاعة
      if (sessionType === 'exam') {
        if (assignment.professor_id === professorId &&
          assignment.group_id === groupId &&
          roomId && assignment.room_id === roomId) {
          // إمتحان الأعمال الموجهة لنفس الأستاذ والفوج والقاعة = لا تعارض
          return;
        }
      }

      if (assignment.professor_id === professorId) {
        // ✅ السماح لنفس الأستاذ بتدريس أكثر من فوج في نفس القاعة
        if (roomId && assignment.room_id === roomId) {
          // نفس الأستاذ ونفس القاعة = لا تعارض
          return;
        }
        const professorName = professors.find(p => p.id === professorId)?.name || 'أستاذ غير معروف';
        const groupName = groups.find(g => g.id === assignment.group_id)?.name || 'مجموعة غير معروفة';
        conflictMessages.push(`الأستاذ ${professorName} يدرس بالفعل المجموعة ${groupName} في هذا التوقيت (جدولة منتظمة)`);
      }

      if (assignment.group_id === groupId) {
        const groupName = groups.find(g => g.id === groupId)?.name || 'مجموعة غير معروفة';
        const professorName = professors.find(p => p.id === assignment.professor_id)?.name || 'أستاذ غير معروف';
        conflictMessages.push(`المجموعة ${groupName} لديها حصة بالفعل مع الأستاذ ${professorName} في هذا التوقيت (جدولة منتظمة)`);
      }

      // ✅ Strict Lecture Conflict Logic
      const currentGroup = groups.find(g => g.id === groupId);
      const targetGroup = groups.find(g => g.id === assignment.group_id);

      if (currentGroup && targetGroup && currentGroup.specialization && targetGroup.specialization && currentGroup.specialization === targetGroup.specialization) {
        const isCurrentLecture = currentGroup.name.toLowerCase().includes('lecture') || currentGroup.name.includes('محاضرة');
        const isTargetLecture = targetGroup.name.toLowerCase().includes('lecture') || targetGroup.name.includes('محاضرة');

        if (isCurrentLecture) {
          conflictMessages.push(`تعارض محاضرة: لا يمكن برمجة محاضرة (${currentGroup.name}) في وجود حصة أخرى لنفس التخصص (${targetGroup.name})`);
        } else if (isTargetLecture) {
          conflictMessages.push(`تعارض فوج: توجد محاضرة مبرمجة (${targetGroup.name}) تمنع برمجة حصة للفوج (${currentGroup.name})`);
        }
      }
    });

    // Vérification des conflits avec les séances supplémentaires existantes
    const conflictingSessions = extraSessions.filter(session => {
      // Ne pas comparer avec la session en cours de modification
      if (currentSessionId && session.id === currentSessionId) {
        return false;
      }

      // Vérification de la date
      if (session.session_date !== sessionDate) {
        return false;
      }

      // Vérification du chevauchement d'horaires
      const sessionStartMinutes = timeToMinutes(session.start_time);
      const sessionEndMinutes = timeToMinutes(session.end_time);

      return newStartMinutes < sessionEndMinutes && newEndMinutes > sessionStartMinutes;
    });

    // Analyser les conflits avec les séances supplémentaires
    conflictingSessions.forEach(session => {
      if (session.professor_id === professorId) {
        // ✅ السماح لنفس الأستاذ بتدريس أكثر من فوج في نفس القاعة
        if (roomId && session.room_id === roomId) {
          // نفس الأستاذ ونفس القاعة = لا تعارض
          return;
        }
        const professorName = professors.find(p => p.id === professorId)?.name || 'أستاذ غير معروف';
        const groupName = groups.find(g => g.id === session.group_id)?.name || 'مجموعة غير معروفة';
        conflictMessages.push(`الأستاذ ${professorName} لديه حصة إضافية بالفعل مع المجموعة ${groupName} في هذا التوقيت`);
      }

      if (session.group_id === groupId) {
        const groupName = groups.find(g => g.id === groupId)?.name || 'مجموعة غير معروفة';
        const professorName = professors.find(p => p.id === session.professor_id)?.name || 'أستاذ غير معروف';
        conflictMessages.push(`المجموعة ${groupName} لديها حصة إضافية بالفعل مع الأستاذ ${professorName} في هذا التوقيت`);
      }

      // ✅ Strict Lecture Conflict Logic (Extra Sessions)
      const currentGroup = groups.find(g => g.id === groupId);
      const targetGroup = groups.find(g => g.id === session.group_id);

      if (currentGroup && targetGroup && currentGroup.specialization && targetGroup.specialization && currentGroup.specialization === targetGroup.specialization) {
        const isCurrentLecture = currentGroup.name.toLowerCase().includes('lecture') || currentGroup.name.includes('محاضرة');
        const isTargetLecture = targetGroup.name.toLowerCase().includes('lecture') || targetGroup.name.includes('محاضرة');

        if (isCurrentLecture) {
          conflictMessages.push(`تعارض محاضرة: لا يمكن برمجة محاضرة (${currentGroup.name}) في وجود حصة أخرى لنفس التخصص (${targetGroup.name})`);
        } else if (isTargetLecture) {
          conflictMessages.push(`تعارض فوج: توجد محاضرة مبرمجة (${targetGroup.name}) تمنع برمجة حصة للفوج (${currentGroup.name})`);
        }
      }
    });

    if (conflictMessages.length > 0) {
      return {
        hasConflict: true,
        conflictMessage: conflictMessages.join('\n')
      };
    }

    return { hasConflict: false, conflictMessage: '' };
  };

  // Fonction pour vérifier si une salle est disponible
  const isRoomAvailable = (
    roomId: number,
    sessionDate: string,
    startTime: string,
    endTime: string,
    currentSessionId?: number,
    professorId?: number
  ): boolean => {
    // Conversion en minutes pour comparaison
    const newStartMinutes = timeToMinutes(startTime);
    const newEndMinutes = timeToMinutes(endTime);

    // Vérification des conflits avec les séances supplémentaires existantes
    const conflictingSessions = extraSessions.filter(session => {
      // Ne pas comparer avec la session en cours de modification
      if (currentSessionId && session.id === currentSessionId) {
        return false;
      }

      // Vérification de la date et de la salle
      if (session.session_date !== sessionDate || session.room_id !== roomId) {
        return false;
      }

      // ✅ السماح لنفس الأستاذ باستخدام نفس القاعة في نفس الوقت
      if (professorId && session.professor_id === professorId) {
        return false; // لا تعارض
      }

      // Vérification du chevauchement d'horaires
      const sessionStartMinutes = timeToMinutes(session.start_time);
      const sessionEndMinutes = timeToMinutes(session.end_time);

      return newStartMinutes < sessionEndMinutes && newEndMinutes > sessionStartMinutes;
    });

    if (conflictingSessions.length > 0) {
      return false;
    }

    // Vérification des conflits avec les assignations régulières
    // Convertir la date de session en jour de la semaine
    // ✅ استخدام parseISO لتجنب مشاكل timezone
    const sessionDateObj = parseISO(sessionDate);
    const dayOfWeek = sessionDateObj.getDay(); // 0 = Dimanche, 1 = Lundi, etc.

    // Convertir au format utilisé dans le système
    // System: 0=السبت, 1=الأحد, 2=الاثنين, 3=الثلاثاء, 4=الأربعاء, 5=الخميس, 6=الجمعة
    // JS:     0=الأحد, 1=الاثنين, 2=الثلاثاء, 3=الأربعاء, 4=الخميس, 5=الجمعة, 6=السبت
    let systemDayOfWeek: number;
    if (dayOfWeek === 0) { // Sunday (الأحد) في JS
      systemDayOfWeek = 1; // الأحد في النظام
    } else if (dayOfWeek === 6) { // Saturday (السبت) في JS
      systemDayOfWeek = 0; // السبت في النظام
    } else { // Monday-Friday (1-5) في JS
      systemDayOfWeek = dayOfWeek + 1; // (2-6) في النظام
    }

    console.log(`📅 Date: ${sessionDate}, JS dayOfWeek: ${dayOfWeek}, System dayOfWeek: ${systemDayOfWeek}`);
    console.log(`📅 التاريخ الكامل: ${sessionDateObj.toString()}`);
    console.log(`📅 اليوم بالعربي: ${days.find(d => d.id === systemDayOfWeek)?.name || 'غير معروف'}`);

    console.log(`🔍 isRoomAvailable - regularAssignments.length: ${regularAssignments.length}`);
    console.log(`🔍 isRoomAvailable - systemDayOfWeek: ${systemDayOfWeek}, roomId: ${roomId}`);
    console.log(`🔍 currentYear: ${currentYear?.year_name}, currentSemester: ${currentSemester?.semester_name}`);

    // تسجيل تفاصيل التكليفات العادية للقاعة المحددة في اليوم المحدد
    const roomDayAssignments = regularAssignments.filter(assignment =>
      assignment.room_id === roomId && assignment.day_of_week === systemDayOfWeek
    );
    console.log(`🔍 التكليفات العادية للقاعة ${roomId} في اليوم ${systemDayOfWeek}: ${roomDayAssignments.length}`);
    if (roomDayAssignments.length > 0) {
      console.log('📋 تفاصيل التكليفات العادية للقاعة المحددة في اليوم المحدد:');
      roomDayAssignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     السنة الأكاديمية: ${assignment.academic_year}`);
        console.log(`     الفصل الدراسي: ${assignment.semester}`);
        console.log('');
      });
    }

    const conflictingRegularAssignments = regularAssignments.filter(assignment => {
      // Vérifier si c'est le même jour de la semaine et la même salle
      if (assignment.day_of_week !== systemDayOfWeek || assignment.room_id !== roomId) {
        return false;
      }

      // ✅ السماح لنفس الأستاذ باستخدام نفس القاعة في نفس الوقت
      if (professorId && assignment.professor_id === professorId) {
        return false; // لا تعارض
      }

      // ✅ تصفية حسب السنة الدراسية والفصل الحالي
      if (currentYear && currentSemester) {
        if (assignment.academic_year !== currentYear.year_name ||
          assignment.semester !== currentSemester.semester_name) {
          return false;
        }
      }

      // Vérifier le chevauchement d'horaires
      const assignmentStartMinutes = timeToMinutes(assignment.start_time);
      const assignmentEndMinutes = timeToMinutes(assignment.end_time);

      return newStartMinutes < assignmentEndMinutes && newEndMinutes > assignmentStartMinutes;
    });

    console.log(`🔍 isRoomAvailable - conflictingRegularAssignments.length: ${conflictingRegularAssignments.length}`);

    if (conflictingRegularAssignments.length > 0) {
      console.log('Conflit détecté avec assignation régulière:', conflictingRegularAssignments);
      return false;
    }

    return true;
  };

  // Fonction pour vérifier la disponibilité en temps réel
  const checkRealTimeAvailability = () => {
    console.log('🔍 checkRealTimeAvailability - regularAssignments.length:', regularAssignments.length);
    console.log('🔍 checkRealTimeAvailability - currentYear:', currentYear);
    console.log('🔍 checkRealTimeAvailability - currentSemester:', currentSemester);

    if (!selectedRoom || !sessionDate || (!startTime && !customStartTime) || (!endTime && !customEndTime)) {
      setRoomAvailabilityStatus({});
      setConflictWarnings([]);
      return;
    }

    // تسجيل تفاصيل التكليفات العادية للقاعة المحددة
    const roomAssignments = regularAssignments.filter(assignment =>
      assignment.room_id === selectedRoom
    );
    console.log(`🔍 التكليفات العادية للقاعة ${selectedRoom}: ${roomAssignments.length}`);
    if (roomAssignments.length > 0) {
      console.log('📋 تفاصيل التكليفات العادية للقاعة المحددة:');
      roomAssignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`     اليوم: ${assignment.day_of_week}`);
        console.log(`     السنة الأكاديمية: ${assignment.academic_year}`);
        console.log(`     الفصل الدراسي: ${assignment.semester}`);
        console.log('');
      });
    }

    const formattedDate = format(sessionDate, 'yyyy-MM-dd');
    const actualStartTime = useCustomTime ? customStartTime : startTime;
    const actualEndTime = useCustomTime ? customEndTime : endTime;

    if (!actualStartTime || !actualEndTime) return;

    // Check room availability
    const isAvailable = isRoomAvailable(
      selectedRoom as number,
      formattedDate,
      actualStartTime,
      actualEndTime,
      currentSession?.id,
      selectedProfessor as number
    );

    setRoomAvailabilityStatus({
      [`${selectedRoom}-${formattedDate}-${actualStartTime}-${actualEndTime}`]: isAvailable
    });

    // Check for conflicts
    const warnings: string[] = [];

    if (selectedProfessor && selectedGroup) {
      const { hasConflict, conflictMessage } = checkForConflicts(
        selectedProfessor as number,
        selectedGroup as number,
        formattedDate,
        actualStartTime,
        actualEndTime,
        currentSession?.id,
        selectedRoom as number,
        sessionType
      );

      if (hasConflict) {
        warnings.push(conflictMessage);
      }
    }

    if (!isAvailable) {
      warnings.push('القاعة المختارة غير متاحة في هذا التوقيت');
    }

    setConflictWarnings(warnings);
  };

  // Effect for real-time checking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkRealTimeAvailability();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [selectedRoom, sessionDate, startTime, endTime, customStartTime, customEndTime, selectedProfessor, selectedGroup, useCustomTime]);

  // Gestion du changement d'onglet
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Fonction pour réinitialiser le formulaire
  const resetForm = () => {
    setSelectedProfessor('');
    setSelectedCourse('');
    setSelectedGroup('');
    setSelectedRoom('');
    setSessionDate(new Date());
    setStartTime('');
    setEndTime('');
    setSessionType('extra');
    setDescription('');
    setFormErrors({});
    setUseCustomTime(false);
    setCustomStartTime('');
    setCustomEndTime('');
    setIgnoreConflicts(false);
    setConflictWarnings([]);
    setRoomAvailabilityStatus({});
    setProfessorSearchTerm('');
    setCourseSearchTerm('');
    setIsProfessorDropdownOpen(false);
    setIsCourseDropdownOpen(false);
  };

  // Fonction pour ouvrir la boîte de dialogue en mode création
  const handleOpenCreateDialog = () => {
    setEditMode(false);
    setCurrentSession(null);
    resetForm();
    setOpen(true);
  };

  // Fonction pour ouvrir la boîte de dialogue en mode édition
  const handleOpenEditDialog = (session: ExtraSession) => {
    setEditMode(true);
    setCurrentSession(session);
    setSelectedProfessor(session.professor_id);
    setSelectedCourse(session.course_id);
    setSelectedGroup(session.group_id);
    setSelectedRoom(session.room_id);
    setSessionDate(parseISO(session.session_date));
    setStartTime(session.start_time);
    setEndTime(session.end_time);
    setSessionType(session.session_type);
    setDescription(session.description || '');
    setFormErrors({});
    setOpen(true);
  };

  // Fonction pour fermer la boîte de dialogue
  const handleCloseDialog = () => {
    setOpen(false);
  };

  // Fonction pour valider le formulaire
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!selectedProfessor) {
      errors.professor = 'Veuillez sélectionner un professeur';
    }

    if (!selectedCourse) {
      errors.course = 'Veuillez sélectionner un cours';
    }

    if (!selectedGroup) {
      errors.group = 'Veuillez sélectionner un groupe';
    }

    if (!selectedRoom) {
      errors.room = 'Veuillez sélectionner une salle';
    }

    if (!sessionDate) {
      errors.date = 'Veuillez sélectionner une date';
    }

    if (!startTime) {
      errors.startTime = 'Veuillez sélectionner une heure de début';
    }

    if (!endTime) {
      errors.endTime = 'Veuillez sélectionner une heure de fin';
    }

    // Vérification que l'heure de début est avant l'heure de fin
    if (startTime && endTime) {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      if (startMinutes >= endMinutes) {
        errors.time = "L'heure de fin doit être postérieure à l'heure de début";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Fonction pour soumettre le formulaire
  const handleSubmit = async () => {
    // Validation du formulaire
    if (!validateForm()) {
      return;
    }

    // Formatage de la date
    const formattedDate = format(sessionDate!, 'yyyy-MM-dd');

    // Vérification des conflits
    const { hasConflict, conflictMessage } = checkForConflicts(
      selectedProfessor as number,
      selectedGroup as number,
      formattedDate,
      useCustomTime ? customStartTime : startTime,
      useCustomTime ? customEndTime : endTime,
      currentSession?.id,
      selectedRoom as number,
      sessionType
    );

    if (hasConflict && !ignoreConflicts) {
      setSnackbar({
        open: true,
        message: conflictMessage,
        severity: 'error'
      });
      return;
    }

    // Vérification de la disponibilité de la salle
    if (!isRoomAvailable(
      selectedRoom as number,
      formattedDate,
      useCustomTime ? customStartTime : startTime,
      useCustomTime ? customEndTime : endTime,
      currentSession?.id,
      selectedProfessor as number
    ) && !ignoreConflicts) {
      setSnackbar({
        open: true,
        message: "La salle sélectionnée n'est pas disponible à cette date et à cet horaire",
        severity: 'error'
      });
      return;
    }

    try {
      // Préparation des données
      const sessionData: ExtraSession = {
        ...(currentSession?.id ? { id: currentSession.id } : {}),
        professor_id: selectedProfessor as number,
        course_id: selectedCourse as number,
        group_id: selectedGroup as number,
        room_id: selectedRoom as number,
        session_date: formattedDate,
        start_time: useCustomTime ? customStartTime : startTime,
        end_time: useCustomTime ? customEndTime : endTime,
        session_type: sessionType,
        description: description
      };

      // Ajout ou mise à jour dans la base de données
      if (editMode && currentSession?.id) {
        await window.db.updateExtraSession(currentSession.id, sessionData);

        // Mise à jour dans l'état local
        setExtraSessions(prev =>
          prev.map(s => s.id === currentSession.id ? {
            id: s.id,
            room_id: s.room_id,
            professor_id: s.professor_id,
            group_id: s.group_id,
            course_id: s.course_id,
            session_date: s.session_date,
            start_time: useCustomTime ? customStartTime : startTime,
            end_time: useCustomTime ? customEndTime : endTime,
            session_type: s.session_type,
            description: s.description,
            professor_name: professors.find(p => p.id === selectedProfessor)?.name,
            course_name: courses.find(c => c.id === selectedCourse)?.name,
            group_name: groups.find(g => g.id === selectedGroup)?.name,
            room_name: rooms.find(r => r.id === selectedRoom)?.name
          } : s)
        );

        setSnackbar({
          open: true,
          message: "La séance a été mise à jour avec succès",
          severity: 'success'
        });
      } else {
        // Ajouter l'interface pour la réponse de la base de données
        interface ExtraSessionResponse {
          id: number;
          room_id: number;
          professor_id: number;
          group_id: number;
          course_id: number;
          session_date: string;
          start_time: string;
          end_time: string;
          session_type: 'extra' | 'makeup';
          description?: string;
        }

        const newSession = await window.db.createExtraSession(sessionData) as unknown as ExtraSessionResponse;

        // Ajout dans l'état local avec les noms complets
        setExtraSessions(prev => [...prev, {
          id: newSession.id,
          room_id: selectedRoom as number,
          professor_id: selectedProfessor as number,
          group_id: selectedGroup as number,
          course_id: selectedCourse as number,
          session_date: sessionDate ? format(sessionDate, 'yyyy-MM-dd') : '',
          start_time: useCustomTime ? customStartTime : startTime,
          end_time: useCustomTime ? customEndTime : endTime,
          session_type: sessionType,
          description: description,
          professor_name: professors.find(p => p.id === selectedProfessor)?.name,
          course_name: courses.find(c => c.id === selectedCourse)?.name,
          group_name: groups.find(g => g.id === selectedGroup)?.name,
          room_name: rooms.find(r => r.id === selectedRoom)?.name
        }]);

        setSnackbar({
          open: true,
          message: "La séance a été ajoutée avec succès",
          severity: 'success'
        });
      }

      // Fermeture de la boîte de dialogue
      handleCloseDialog();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la séance:', error);
      setSnackbar({
        open: true,
        message: `Une erreur est survenue: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        severity: 'error'
      });
    }
  };

  // Fonction pour supprimer une séance
  const handleDeleteSession = async (sessionId: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette séance ?')) {
      try {
        await window.db.deleteExtraSession(sessionId);

        // Mise à jour de l'état local
        setExtraSessions(prev => prev.filter(s => s.id !== sessionId));

        setSnackbar({
          open: true,
          message: "La séance a été supprimée avec succès",
          severity: 'success'
        });
      } catch (error) {
        console.error('Erreur lors de la suppression de la séance:', error);
        setSnackbar({
          open: true,
          message: `Une erreur est survenue: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          severity: 'error'
        });
      }
    }
  };

  // Gestion de la fermeture de la notification
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Fonction pour récupérer les assignations régulières
  const fetchRegularAssignments = async () => {
    try {
      console.log('🔍 fetchRegularAssignments - currentYear:', currentYear);
      console.log('🔍 fetchRegularAssignments - currentSemester:', currentSemester);

      if (currentYear && currentSemester) {
        console.log(`🔍 جلب التكليفات العادية للسنة: ${currentYear.year_name}, الفصل: ${currentSemester.semester_name}`);
        const assignments = await window.db.getAssignments(
          currentYear.year_name,
          currentSemester.semester_name,
          ''
        );
        setRegularAssignments(assignments);
        console.log(`✅ تم جلب ${assignments.length} تكليف عادي`);

        // تسجيل تفاصيل التكليفات العادية للقاعة 10 في الأحد
        const room10SundayAssignments = assignments.filter(assignment =>
          assignment.room_id === 11 && assignment.day_of_week === 1
        );
        console.log(`🔍 التكليفات العادية للقاعة 10 في الأحد: ${room10SundayAssignments.length}`);
        if (room10SundayAssignments.length > 0) {
          console.log('📋 تفاصيل التكليفات العادية للقاعة 10 في الأحد:');
          room10SundayAssignments.forEach((assignment, index) => {
            console.log(`  ${index + 1}. التوقيت: ${assignment.start_time} - ${assignment.end_time}`);
            console.log(`     السنة الأكاديمية: ${assignment.academic_year}`);
            console.log(`     الفصل الدراسي: ${assignment.semester}`);
            console.log('');
          });
        }
      } else {
        console.log('❌ currentYear أو currentSemester غير محددين');
        setRegularAssignments([]);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des assignations régulières:', err);
      // Continuer même en cas d'erreur
      setRegularAssignments([]);
    }
  };

  // دوال البحث والتصفية
  const handleProfessorSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfessorSearchTerm(e.target.value);
  };

  const handleSelectProfessor = (id: number) => {
    setSelectedProfessor(id);
    setProfessorSearchTerm('');
    setIsProfessorDropdownOpen(false);

    // إعادة تعيين الحقول الأخرى عند تغيير الأستاذ
    setSelectedCourse('');
    setCourseSearchTerm('');
    setSelectedDepartment('');
    setSelectedSpecialization('');
    setSelectedGroup('');
  };

  const handleCourseSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCourseSearchTerm(e.target.value);
  };

  const handleSelectCourse = (id: number) => {
    setSelectedCourse(id);
    setCourseSearchTerm('');
    setIsCourseDropdownOpen(false);
  };

  const handleDepartmentChange = (e: SelectChangeEvent<number | ''>) => {
    const deptId = e.target.value as number | '';
    setSelectedDepartment(deptId);
    setSelectedSpecialization('');
    setSelectedGroup('');
    setFilteredGroups([]);
  };

  const handleSpecializationChange = (e: SelectChangeEvent<number | ''>) => {
    const specId = e.target.value as number | '';
    setSelectedSpecialization(specId);
    setSelectedGroup('');
  };

  // تصفية الأساتذة والمقررات حسب البحث
  useEffect(() => {
    if (professorSearchTerm) {
      const filtered = professors.filter(prof =>
        prof.name.toLowerCase().includes(professorSearchTerm.toLowerCase())
      );
      setFilteredProfessors(filtered);
    } else {
      setFilteredProfessors([]);
    }
  }, [professorSearchTerm, professors]);

  useEffect(() => {
    if (courseSearchTerm) {
      // إذا تم اختيار أستاذ، استخدم مقرراته فقط، وإلا استخدم جميع المقررات
      const coursesToFilter = selectedProfessor ? professorCourses : courses;
      const filtered = coursesToFilter.filter(course =>
        course.name.toLowerCase().includes(courseSearchTerm.toLowerCase())
      );
      setFilteredCourses(filtered);
    } else {
      setFilteredCourses([]);
    }
  }, [courseSearchTerm, courses, selectedProfessor, professorCourses]);

  // تصفية البيانات حسب الأستاذ المختار
  useEffect(() => {
    if (!selectedProfessor) {
      // إذا لم يتم اختيار أستاذ، مسح التصفية
      setProfessorCourses([]);
      setProfessorDepartments([]);
      setProfessorSpecializations([]);
      setProfessorGroups([]);
      return;
    }

    // جمع المقررات والمجموعات من التكليفات العادية
    const professorAssignments = regularAssignments.filter(
      assignment => assignment.professor_id === selectedProfessor
    );

    // استخراج المقررات الفريدة
    const uniqueCourseIds = new Set<number>();
    professorAssignments.forEach(assignment => {
      uniqueCourseIds.add(assignment.course_id);
    });
    const profCourses = courses.filter(c => uniqueCourseIds.has(c.id));
    setProfessorCourses(profCourses);

    // استخراج المجموعات الفريدة
    const uniqueGroupIds = new Set<number>();
    professorAssignments.forEach(assignment => {
      uniqueGroupIds.add(assignment.group_id);
    });
    const profGroups = groups.filter(g => uniqueGroupIds.has(g.id));
    setProfessorGroups(profGroups);

    // استخراج التخصصات الفريدة من المجموعات
    const uniqueSpecializations = new Map<number, string>();

    profGroups.forEach(group => {
      if (group.specialization) {
        const groupSpec = specializations.find(spec => spec.name === group.specialization);
        if (groupSpec) {
          uniqueSpecializations.set(groupSpec.id, groupSpec.name);
        }
      }
    });

    // للأقسام: نعرض جميع الأقسام المتاحة
    // لأن الأستاذ قد يدرس في أكثر من قسم
    setProfessorDepartments(departments);
    setProfessorSpecializations(
      Array.from(uniqueSpecializations.entries()).map(([id, name]) => ({ id, name }))
    );

    console.log('📊 تصفية بيانات الأستاذ:', {
      courses: profCourses.length,
      groups: profGroups.length,
      departments: departments.length,
      specializations: uniqueSpecializations.size
    });

  }, [selectedProfessor, regularAssignments, courses, groups, departments, specializations]);

  // تصفية المجموعات حسب القسم والتخصص
  useEffect(() => {
    if (selectedSpecialization) {
      const loadGroups = async () => {
        try {
          // تحميل الأفواج باستخدام ID التخصص مباشرة
          console.log('Loading groups for specialization ID:', selectedSpecialization);
          const groupsData = await getGroupsBySpecializationId(selectedSpecialization as number);
          console.log('Loaded groups:', groupsData);
          setFilteredGroups(groupsData);
        } catch (error) {
          console.error('Error loading groups by specialization:', error);
          setFilteredGroups([]);
        }
      };
      loadGroups();
    } else if (selectedDepartment) {
      const loadSpecializations = async () => {
        try {
          const specsData = await getSpecializationsByDepartment(selectedDepartment as number);
          console.log('Loaded specializations:', specsData);
          setSpecializations(specsData);
          // مسح المجموعات عند تغيير القسم
          setFilteredGroups([]);
        } catch (error) {
          console.error('Error loading specializations:', error);
        }
      };
      loadSpecializations();
    } else {
      // مسح كل شيء إذا لم يتم اختيار شيء
      setSpecializations([]);
      setFilteredGroups([]);
    }
  }, [selectedDepartment, selectedSpecialization]);

  // Composant de rendu
  return (
    <Box className="container mx-auto px-4 py-8">
      <Typography variant="h4" component="h1" gutterBottom align="right" sx={{ mb: 4 }}>
        برمجة التعويضات والحصص الإضافية
      </Typography>

      {/* Onglets pour la navigation */}
      <Paper sx={{ width: '100%', mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab label="البحث عن القاعات المتاحة" />
          <Tab label="برمجة الحصص الإضافية" />
          <Tab label="جدول التعويضات والحصص" />
        </Tabs>
      </Paper>

      {/* Affichage des erreurs */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        >
          <Typography>{error.message}</Typography>
        </Alert>
      )}

      {/* Indicateur de chargement */}
      {loading && (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Panel de recherche de salles disponibles */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="day-select-label">اليوم</InputLabel>
              <Select
                labelId="day-select-label"
                id="day-select"
                value={selectedDay}
                label="اليوم"
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                <MenuItem value=""><em>اختر اليوم</em></MenuItem>
                {days.map((day) => (
                  <MenuItem key={day.id} value={day.id.toString()}>
                    {day.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="time-select-label">التوقيت</InputLabel>
              <Select
                labelId="time-select-label"
                id="time-select"
                value={selectedTime}
                label="التوقيت"
                onChange={(e) => setSelectedTime(e.target.value)}
              >
                <MenuItem value=""><em>اختر التوقيت</em></MenuItem>
                {lectureTimes.map((time) => (
                  <MenuItem key={time} value={time}>
                    {time}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={arSA}>
                <DatePicker
                  label="تاريخ محدد"
                  value={selectedDate}
                  onChange={(newValue) => setSelectedDate(newValue)}
                />
              </LocalizationProvider>
              <FormHelperText>اختياري: للتحقق من توفر القاعات في تاريخ محدد</FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="الحد الأدنى للسعة"
              value={minCapacity}
              onChange={(e) => setMinCapacity(parseInt(e.target.value) || 0)}
              InputProps={{ inputProps: { min: 0 } }}
              sx={{ mb: 2 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={findAvailableRooms}
              startIcon={<CalendarTodayIcon />}
              sx={{ mb: 4 }}
            >
              البحث عن القاعات المتاحة
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={exportRoomAvailabilityMatrix}
              startIcon={<PrintIcon />}
              sx={{ mb: 4, ml: 2 }}
            >
              تصدير مصفوفة توفر القاعات
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={exportDailyRoomMatrix}
              startIcon={<PrintIcon />}
              sx={{ mb: 4, ml: 2 }}
            >
              تصدير تقرير مصفوفي يومي
            </Button>
          </Grid>
        </Grid>

        {/* Affichage des résultats */}
        {availableRooms.length > 0 && (
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="right">اسم القاعة</TableCell>
                  <TableCell align="right">المبنى</TableCell>
                  <TableCell align="right">الطابق</TableCell>
                  <TableCell align="right">السعة</TableCell>
                  <TableCell align="center">الإجراءات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell align="right">{room.name}</TableCell>
                    <TableCell align="right">{room.building || 'غير محدد'}</TableCell>
                    <TableCell align="right">{room.floor !== undefined ? room.floor : 'غير محدد'}</TableCell>
                    <TableCell align="right">{room.capacity !== undefined ? room.capacity : 'غير محدد'}</TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          handleOpenCreateDialog();
                          setSelectedRoom(room.id);
                          if (selectedDate) {
                            setSessionDate(selectedDate);
                          }
                          if (selectedTime) {
                            const [start, end] = selectedTime.split(' - ');
                            setStartTime(start);
                            setEndTime(end);
                          }
                        }}
                      >
                        برمجة حصة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {availableRooms.length === 0 && selectedDay && selectedTime && !loading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            لا توجد قاعات متاحة تلبي المعايير المحددة
          </Alert>
        )}
      </TabPanel>

      {/* Panel de programmation de séances supplémentaires */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenCreateDialog}
              startIcon={<AddIcon />}
              sx={{ mb: 3 }}
            >
              إضافة حصة جديدة
            </Button>
          </Grid>

          <Grid item xs={12}>
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                ملاحظات حول البرمجة:
              </Typography>
              <Typography variant="body2" paragraph>
                - يمكنك إضافة حصة إضافية أو حصة تعويض جديدة في أي وقت
              </Typography>
              <Typography variant="body2" paragraph>
                - النظام سيتحقق تلقائيًا من عدم وجود تعارض بين مواعيد الأساتذة والمجموعات
              </Typography>
              <Typography variant="body2">
                - يمكنك استخدام البحث عن القاعات المتاحة أولاً للتأكد من توفر القاعات
              </Typography>
            </FormControl>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Panel du calendrier des séances */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="session-type-filter-label">نوع الحصة</InputLabel>
              <Select
                labelId="session-type-filter-label"
                value={sessionType}
                label="نوع الحصة"
                onChange={(e) => setSessionType(e.target.value as 'extra' | 'makeup' | 'exam')}
              >
                <MenuItem value="extra">حصة إضافية</MenuItem>
                <MenuItem value="makeup">حصة تعويض</MenuItem>
                <MenuItem value="exam">إمتحان الأعمال الموجهة</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant={showArchived ? "contained" : "outlined"}
              color="secondary"
              onClick={() => setShowArchived(!showArchived)}
              fullWidth
              sx={{ height: '56px' }}
            >
              {showArchived ? `إخفاء الأرشيف (${archivedSessions.length})` : `عرض الأرشيف (${archivedSessions.length})`}
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              color="warning"
              onClick={manualArchivePastSessions}
              fullWidth
              sx={{ height: '56px' }}
              title="أرشف جميع الحصص القديمة يدوياً"
            >
              🔄 أرشفة
            </Button>
          </Grid>
        </Grid>

        {/* عرض معلومات عن الحصص */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: 'info.contrastText' }}>
            📊 {showArchived ? 'الحصص المؤرشفة' : 'الحصص القادمة'}: {showArchived ? archivedSessions.length : extraSessions.length} حصة
            {!showArchived && <span> | 📦 الحصص المؤرشفة: {archivedSessions.length} حصة</span>}
          </Typography>
          {!showArchived && (
            <Typography variant="caption" sx={{ color: 'info.contrastText', display: 'block', mt: 0.5 }}>
              💡 يتم أرشفة الحصص المنتهية تلقائياً كل يوم
            </Typography>
          )}
        </Box>

        {/* Tableau des séances programmées */}
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => printSessionsList('all')}
            startIcon={<PrintIcon />}
          >
            طباعة جميع الحصص
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => printSessionsList('extra')}
            startIcon={<PrintIcon />}
          >
            طباعة الحصص الإضافية
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => printSessionsList('makeup')}
            startIcon={<PrintIcon />}
          >
            طباعة حصص التعويض
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setDepartmentHeadDialogOpen(true)}
            startIcon={<EditIcon />}
          >
            تعديل اسم رئيس القسم
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => setAnnouncementDialogOpen(true)}
            startIcon={<PrintIcon />}
          >
            إعلان للطلبة 📝
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="right">نوع الحصة</TableCell>
                <TableCell align="right">اليوم والتاريخ</TableCell>
                <TableCell align="right">التوقيت</TableCell>
                <TableCell align="right">الأستاذ</TableCell>
                <TableCell align="right">المقرر</TableCell>
                <TableCell align="right">المجموعة</TableCell>
                <TableCell align="right">القاعة</TableCell>
                <TableCell align="center">الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(showArchived ? archivedSessions : extraSessions)
                .filter(session => {
                  // Filtrer par type si nécessaire
                  if (sessionType && session.session_type !== sessionType) {
                    return false;
                  }

                  return true;
                })
                .map((session) => (
                  <TableRow key={session.id}>
                    <TableCell align="right">
                      {session.session_type === 'extra' ? 'حصة إضافية' : session.session_type === 'makeup' ? 'حصة تعويض' : 'إمتحان الأعمال'}
                    </TableCell>
                    <TableCell align="right">{format(new Date(session.session_date), 'EEEE dd/MM/yyyy', { locale: arSA })}</TableCell>
                    <TableCell align="right">{`${session.start_time} - ${session.end_time}`}</TableCell>
                    <TableCell align="right">{session.professor_name}</TableCell>
                    <TableCell align="right">{session.course_name}</TableCell>
                    <TableCell align="right">{session.group_name}</TableCell>
                    <TableCell align="right">{session.room_name}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        aria-label="edit"
                        color="primary"
                        onClick={() => handleOpenEditDialog(session)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        aria-label="delete"
                        color="error"
                        onClick={() => handleDeleteSession(session.id!)}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <IconButton
                        aria-label="print"
                        color="primary"
                        onClick={() => printIndividualSession(session)}
                      >
                        <PrintIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        {extraSessions.length === 0 && !loading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            لا توجد حصص مبرمجة بعد
          </Alert>
        )}

      </TabPanel>

      {/* Boîte de dialogue pour ajouter/modifier une séance */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editMode ? 'تعديل حصة' : 'إضافة حصة جديدة'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!formErrors.professor}>
                <InputLabel id="professor-select-label">الأستاذ</InputLabel>
                <TextField
                  placeholder="البحث عن أستاذ..."
                  value={professorSearchTerm}
                  onChange={handleProfessorSearch}
                  fullWidth
                  onFocus={() => setIsProfessorDropdownOpen(true)}
                  variant="outlined"
                />
                {isProfessorDropdownOpen && filteredProfessors.length > 0 && (
                  <Paper
                    style={{
                      position: 'absolute',
                      zIndex: 1000,
                      width: '100%',
                      maxHeight: '200px',
                      overflow: 'auto',
                      marginTop: '55px'
                    }}
                  >
                    {filteredProfessors.map((prof) => (
                      <MenuItem
                        key={prof.id}
                        onClick={() => handleSelectProfessor(prof.id)}
                      >
                        {prof.name}
                      </MenuItem>
                    ))}
                  </Paper>
                )}
                {/* Affichage du professeur sélectionné */}
                {selectedProfessor && (
                  <Typography variant="body2" sx={{ mt: 1, color: 'primary.main' }}>
                    الأستاذ المختار: {professors.find(p => p.id === selectedProfessor)?.name}
                  </Typography>
                )}
                {formErrors.professor && <FormHelperText>{formErrors.professor}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!formErrors.course} disabled={!selectedProfessor}>
                <InputLabel id="course-select-label">المقرر</InputLabel>
                <TextField
                  placeholder={selectedProfessor ? "البحث عن مقرر..." : "اختر أستاذاً أولاً"}
                  value={courseSearchTerm}
                  onChange={handleCourseSearch}
                  fullWidth
                  onFocus={() => setIsCourseDropdownOpen(true)}
                  variant="outlined"
                  disabled={!selectedProfessor}
                />
                {isCourseDropdownOpen && filteredCourses.length > 0 && (
                  <Paper
                    style={{
                      position: 'absolute',
                      zIndex: 1000,
                      width: '100%',
                      maxHeight: '200px',
                      overflow: 'auto',
                      marginTop: '55px'
                    }}
                  >
                    {filteredCourses.map((course) => (
                      <MenuItem
                        key={course.id}
                        onClick={() => handleSelectCourse(course.id)}
                      >
                        {course.name}
                      </MenuItem>
                    ))}
                  </Paper>
                )}
                {/* Affichage du cours sélectionné */}
                {selectedCourse && (
                  <Typography variant="body2" sx={{ mt: 1, color: 'primary.main' }}>
                    المقرر المختار: {courses.find(c => c.id === selectedCourse)?.name}
                  </Typography>
                )}
                {!selectedProfessor && (
                  <FormHelperText>يرجى اختيار الأستاذ أولاً</FormHelperText>
                )}
                {formErrors.course && <FormHelperText>{formErrors.course}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth disabled={!selectedProfessor}>
                <InputLabel id="department-select-label">القسم</InputLabel>
                <Select
                  labelId="department-select-label"
                  id="department-select"
                  value={selectedDepartment}
                  label="القسم"
                  onChange={handleDepartmentChange}
                >
                  <MenuItem value=""><em>اختر القسم</em></MenuItem>
                  {(selectedProfessor ? professorDepartments : departments).map((dept) => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
                {!selectedProfessor && (
                  <FormHelperText>يرجى اختيار الأستاذ أولاً</FormHelperText>
                )}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth disabled={!selectedDepartment || !selectedProfessor}>
                <InputLabel id="specialization-select-label">التخصص</InputLabel>
                <Select
                  labelId="specialization-select-label"
                  id="specialization-select"
                  value={selectedSpecialization}
                  label="التخصص"
                  onChange={handleSpecializationChange}
                >
                  <MenuItem value=""><em>اختر التخصص</em></MenuItem>
                  {(selectedProfessor ? professorSpecializations : specializations).map((spec) => (
                    <MenuItem key={spec.id} value={spec.id}>
                      {spec.name}
                    </MenuItem>
                  ))}
                </Select>
                {!selectedProfessor && (
                  <FormHelperText>يرجى اختيار الأستاذ أولاً</FormHelperText>
                )}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth error={!!formErrors.group} disabled={!selectedSpecialization || !selectedProfessor}>
                <InputLabel id="group-select-label">المجموعة</InputLabel>
                <Select
                  labelId="group-select-label"
                  id="group-select"
                  value={selectedGroup}
                  label="المجموعة"
                  onChange={(e) => setSelectedGroup(e.target.value as number | '')}
                >
                  <MenuItem value=""><em>اختر المجموعة</em></MenuItem>
                  {(selectedProfessor && selectedSpecialization ? filteredGroups : selectedProfessor ? professorGroups : groups).map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
                {!selectedProfessor && (
                  <FormHelperText>يرجى اختيار الأستاذ أولاً</FormHelperText>
                )}
                {formErrors.group && <FormHelperText>{formErrors.group}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!formErrors.room}>
                <InputLabel id="room-select-label">القاعة</InputLabel>
                <Select
                  labelId="room-select-label"
                  id="room-select"
                  value={selectedRoom}
                  label="القاعة"
                  onChange={(e) => setSelectedRoom(e.target.value as number | '')}
                >
                  <MenuItem value=""><em>اختر القاعة</em></MenuItem>
                  {rooms.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                      {room.name} {room.capacity ? `(السعة: ${room.capacity})` : ''}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.room && <FormHelperText>{formErrors.room}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!formErrors.date}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={arSA}>
                  <DatePicker
                    label="التاريخ"
                    value={sessionDate}
                    onChange={(newValue) => setSessionDate(newValue)}
                  />
                </LocalizationProvider>
                {formErrors.date && <FormHelperText>{formErrors.date}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="session-type-select-label">نوع الحصة</InputLabel>
                <Select
                  labelId="session-type-select-label"
                  value={sessionType}
                  label="نوع الحصة"
                  onChange={(e) => setSessionType(e.target.value as 'extra' | 'makeup' | 'exam')}
                >
                  <MenuItem value="extra">حصة إضافية</MenuItem>
                  <MenuItem value="makeup">حصة تعويض</MenuItem>
                  <MenuItem value="exam">إمتحان الأعمال الموجهة</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="start-time-select-label">وقت البداية</InputLabel>
                <Select
                  labelId="start-time-select-label"
                  value={startTime}
                  label="وقت البداية"
                  onChange={(e) => setStartTime(e.target.value)}
                >
                  <MenuItem value=""><em>اختر وقت البداية</em></MenuItem>
                  <MenuItem value="08:00">08:00</MenuItem>
                  <MenuItem value="09:30">09:30</MenuItem>
                  <MenuItem value="11:00">11:00</MenuItem>
                  <MenuItem value="12:30">12:30</MenuItem>
                  <MenuItem value="14:00">14:00</MenuItem>
                  <MenuItem value="15:30">15:30</MenuItem>
                </Select>
                <Button variant="text" onClick={() => setUseCustomTime(true)}>استخدام وقت مخصص</Button>
              </FormControl>
              {useCustomTime && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <TextField
                      label="وقت البداية المخصص"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                    />
                  </FormControl>
                </Grid>
              )}
              {formErrors.startTime && <FormHelperText>{formErrors.startTime}</FormHelperText>}
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="end-time-select-label">وقت النهاية</InputLabel>
                <Select
                  labelId="end-time-select-label"
                  value={endTime}
                  label="وقت النهاية"
                  onChange={(e) => setEndTime(e.target.value)}
                >
                  <MenuItem value=""><em>اختر وقت النهاية</em></MenuItem>
                  <MenuItem value="09:30">09:30</MenuItem>
                  <MenuItem value="11:00">11:00</MenuItem>
                  <MenuItem value="12:30">12:30</MenuItem>
                  <MenuItem value="14:00">14:00</MenuItem>
                  <MenuItem value="15:30">15:30</MenuItem>
                  <MenuItem value="17:00">17:00</MenuItem>
                </Select>
                <Button variant="text" onClick={() => setUseCustomTime(true)}>استخدام وقت مخصص</Button>
              </FormControl>
              {useCustomTime && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <TextField
                      label="وقت النهاية المخصص"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                    />
                  </FormControl>
                </Grid>
              )}
              {formErrors.endTime && <FormHelperText>{formErrors.endTime}</FormHelperText>}
              {formErrors.time && (
                <FormHelperText error>{formErrors.time}</FormHelperText>
              )}
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="ملاحظات"
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={ignoreConflicts}
                    onChange={(e) => setIgnoreConflicts(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Typography variant="body2" color="warning.main" fontWeight="bold">
                    تجاهل التعارضات (فرض الإضافة) - استخدم هذا الخيار بحذر!
                  </Typography>
                }
              />
            </Grid>

            {/* Real-time conflict warnings */}
            {conflictWarnings.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    تحذيرات الصراعات:
                  </Typography>
                  {conflictWarnings.map((warning, index) => (
                    <Typography key={index} variant="body2">
                      • {warning}
                    </Typography>
                  ))}
                </Alert>
              </Grid>
            )}

            {/* Room availability status */}
            {selectedRoom && sessionDate && (startTime || customStartTime) && (endTime || customEndTime) && (
              <Grid item xs={12}>
                {Object.values(roomAvailabilityStatus).some(status => status === false) ? (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    ❌ القاعة غير متاحة في هذا التوقيت
                  </Alert>
                ) : Object.keys(roomAvailabilityStatus).length > 0 ? (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    ✅ القاعة متاحة في هذا التوقيت
                  </Alert>
                ) : null}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>إلغاء</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editMode ? 'تحديث' : 'إضافة'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* حوار اختيار نطاق التواريخ للطباعة */}
      <Dialog
        open={printDateRangeDialogOpen}
        onClose={() => setPrintDateRangeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          تحديد نطاق التواريخ للطباعة
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                اختر نطاق التواريخ لتصفية الحصص المراد طباعتها (اختياري)
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={arSA}>
                <DatePicker
                  label="تاريخ البداية"
                  value={printStartDate}
                  onChange={(newValue) => setPrintStartDate(newValue)}
                  sx={{ width: '100%' }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={arSA}>
                <DatePicker
                  label="تاريخ النهاية"
                  value={printEndDate}
                  onChange={(newValue) => setPrintEndDate(newValue)}
                  sx={{ width: '100%' }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintDateRangeDialogOpen(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => {
              // طباعة عادية (window.print)
              let filteredSessions = extraSessions;

              // Filtrer par type si nécessaire
              if (printSessionType !== 'all') {
                filteredSessions = filteredSessions.filter(session => session.session_type === printSessionType);
              }

              // Filtrer par فترة زمنية إذا كانت محددة
              if (printStartDate && printEndDate) {
                const startDateStr = format(printStartDate, 'yyyy-MM-dd');
                const endDateStr = format(printEndDate, 'yyyy-MM-dd');

                filteredSessions = filteredSessions.filter(session => {
                  return session.session_date >= startDateStr && session.session_date <= endDateStr;
                });
              }

              const content = generateSessionsListContent(filteredSessions, printSessionType);
              const title = printSessionType === 'extra'
                ? 'قائمة الحصص الإضافية'
                : printSessionType === 'makeup'
                  ? 'قائمة حصص التعويض'
                  : printSessionType === 'exam'
                    ? 'قائمة الفروض المحروسة'
                    : 'قائمة الحصص الإضافية وحصص التعويض والفروض المحروسة';

              const dateRangeText = (printStartDate && printEndDate)
                ? ` (من ${format(printStartDate, 'dd/MM/yyyy')} إلى ${format(printEndDate, 'dd/MM/yyyy')})`
                : '';

              printContent(content, {
                title: title + dateRangeText,
                orientation: 'landscape',
                fontSize: '12pt',
                asPDF: false // ❌ طباعة عادية
              });

              setPrintDateRangeDialogOpen(false);
              setPrintStartDate(null);
              setPrintEndDate(null);
            }}
            variant="outlined"
            color="primary"
          >
            طباعة عادية
          </Button>
          <Button
            onClick={executePrintSessionsList}
            variant="contained"
            color="success"
            startIcon={<PrintIcon />}
          >
            حفظ كـ PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* Boîte de dialogue pour configurer le chef de département */}
      <Dialog
        open={departmentHeadDialogOpen}
        onClose={() => setDepartmentHeadDialogOpen(false)}
      >
        <DialogTitle>تعديل اسم رئيس القسم</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="اسم رئيس القسم"
            type="text"
            fullWidth
            variant="outlined"
            value={departmentHead}
            onChange={(e) => setDepartmentHead(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepartmentHeadDialogOpen(false)}>إلغاء</Button>
          <Button onClick={() => setDepartmentHeadDialogOpen(false)} color="primary" variant="contained">
            حفظ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog إعلان للطلبة */}
      <Dialog
        open={announcementDialogOpen}
        onClose={() => setAnnouncementDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>إعداد إعلان للطلبة 📝</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, mt: 2 }}>
            📌 اختر القسم والتخصص والفوج لفلترة الحصص التي ستظهر في الإعلان. إذا لم تختر، سيتم عرض جميع الحصص مع الفلترة المختارة.
          </Alert>

          <Grid container spacing={3}>
            {/* نوع الحصة */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>نوع الحصة</InputLabel>
                <Select
                  value={announcementSessionType}
                  label="نوع الحصة"
                  onChange={(e) => setAnnouncementSessionType(e.target.value as 'extra' | 'makeup' | 'exam' | 'all')}
                >
                  <MenuItem value="all">جميع الحصص (تعويضية وإضافية وفروض محروسة)</MenuItem>
                  <MenuItem value="makeup">حصص تعويضية فقط</MenuItem>
                  <MenuItem value="extra">حصص إضافية فقط</MenuItem>
                  <MenuItem value="exam">فروض محروسة فقط</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* القسم */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>القسم</InputLabel>
                <Select
                  value={announcementDepartment}
                  label="القسم"
                  onChange={(e) => setAnnouncementDepartment(e.target.value)}
                >
                  <MenuItem value="">جميع الأقسام</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* التخصص */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!announcementDepartment}>
                <InputLabel>التخصص</InputLabel>
                <Select
                  value={announcementSpecialization}
                  label="التخصص"
                  onChange={(e) => setAnnouncementSpecialization(e.target.value)}
                >
                  <MenuItem value="">جميع التخصصات</MenuItem>
                  {announcementSpecializations.map(spec => (
                    <MenuItem key={spec.id} value={spec.id}>{spec.name}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  اختر قسمًا أولًا لتفعيل هذا الخيار
                </FormHelperText>
              </FormControl>
            </Grid>

            {/* الفوج */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!announcementSpecialization}>
                <InputLabel>الفوج</InputLabel>
                <Select
                  value={announcementGroup}
                  label="الفوج"
                  onChange={(e) => setAnnouncementGroup(e.target.value)}
                >
                  <MenuItem value="">جميع الأفواج</MenuItem>
                  {announcementGroups.map(group => (
                    <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  اختر تخصصًا أولًا لتفعيل هذا الخيار
                </FormHelperText>
              </FormControl>
            </Grid>

            {/* الأستاذ */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>الأستاذ</InputLabel>
                <Select
                  value={announcementProfessor}
                  label="الأستاذ"
                  onChange={(e) => setAnnouncementProfessor(e.target.value)}
                >
                  <MenuItem value="">جميع الأساتذة</MenuItem>
                  {announcementProfessors.map(prof => (
                    <MenuItem key={prof.id} value={prof.id}>{prof.name}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  فقط الأساتذة الذين لهم حصص إضافية أو تعويضية
                </FormHelperText>
              </FormControl>
            </Grid>

            {/* تاريخ البداية */}
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={arSA}>
                <DatePicker
                  label="من تاريخ"
                  value={announcementStartDate}
                  onChange={(newValue) => setAnnouncementStartDate(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'اختياري - لتصفية الحصص من تاريخ معين'
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>

            {/* تاريخ النهاية */}
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={arSA}>
                <DatePicker
                  label="إلى تاريخ"
                  value={announcementEndDate}
                  onChange={(newValue) => setAnnouncementEndDate(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'اختياري - لتصفية الحصص حتى تاريخ معين'
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnnouncementDialogOpen(false)}>إلغاء</Button>
          <Button
            onClick={() => {
              setAnnouncementDepartment('');
              setAnnouncementSpecialization('');
              setAnnouncementGroup('');
              setAnnouncementProfessor('');
              setAnnouncementStartDate(null);
              setAnnouncementEndDate(null);
              setAnnouncementSessionType('all');
            }}
          >
            مسح الفلاتر
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={printStudentAnnouncement}
            startIcon={<PrintIcon />}
          >
            طباعة الإعلان
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}