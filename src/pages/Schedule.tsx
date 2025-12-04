import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import DatabaseErrorAlert from '../components/DatabaseErrorAlert';
import { AcademicYearContext } from '../context/AcademicYearContext';
import { useAssignments } from '../context/AssignmentContext';
import { useSandbox } from '../context/SandboxContext';
import { printContent } from '../utils/printUtils';
import { jsPDF } from 'jspdf';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { usePermissions } from '../hooks/usePermissions';
import { usePrintSettings, createPrintOptions } from '../hooks/usePrintSettings';
import AIAssistant from '../components/AIAssistant';
import { exportScheduleToExcel } from '../utils/excelUtils';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor, closestCorners, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { DraggableAssignment } from '../components/schedule/DraggableAssignment';
import { DroppableCell } from '../components/schedule/DroppableCell';

// تعريف الخطوط العربية
// const arabicFontConfig = {
//   Amiri: {
//     normal: 'https://cdn.jsdelivr.net/npm/amiri-font@0.111/amiri/amiri-regular.ttf',
//     bold: 'https://cdn.jsdelivr.net/npm/amiri-font@0.111/amiri/amiri-bold.ttf',
//     italics: 'https://cdn.jsdelivr.net/npm/amiri-font@0.111/amiri/amiri-slanted.ttf',
//     bolditalics: 'https://cdn.jsdelivr.net/npm/amiri-font@0.111/amiri/amiri-boldslanted.ttf'
//   }
// };

// تهيئة الخطوط العربية
// pdfMake.fonts = {
//   ...pdfMake.fonts,
//   Amiri: arabicFontConfig.Amiri
// };

// واجهات البيانات - تحديث لتتوافق مع SQLite
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
  parent_group_id?: number;
  created_at?: string;
  group_type?: string;
  department_id?: number;
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
  group_id: number;
  course_id: number;
  professor_id: number;
  room_id: number;
  isLecture?: boolean; // إضافة حقل لتحديد ما إذا كانت محاضرة
  assignments?: Assignment[]; // إضافة حقل لتخزين التكاليف المتعددة
}

interface ScheduleData {
  [dayIndex: number]: {
    [timeIndex: number]: ScheduleCell;
  };
}

// قائمة الفصول الدراسية
const semesters = [
  { id: 1, name: 'الفصل الأول' },
  { id: 2, name: 'الفصل الثاني' }
];

// زمن المحاضرات
const timeSlots = [
  { id: 0, label: '8.00 - 9.30', start: '08:00', end: '09:30' },
  { id: 1, label: '9.30 - 11.00', start: '09:30', end: '11:00' },
  { id: 2, label: '11.00 - 12.30', start: '11:00', end: '12:30' },
  { id: 3, label: '12.30 - 14.00', start: '12:30', end: '14:00' },
  { id: 4, label: '14.00 - 15.30', start: '14:00', end: '15:30' },
  { id: 5, label: '15.30 - 17.00', start: '15:30', end: '17:00' }
];

// أيام الأسبوع
const days = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' },
  { id: 6, name: 'الجمعة' }
];

const daysOfWeek = days.map(day => day.name);

// Interface pour les paramètres d'impression
interface PrintSettings {
  universityName: string;
  facultyName: string;
  universityLogoUrl: string;
  facultyLogoUrl: string;
  headerFontSize?: number;
  titleFontSize?: number;
  subtitleFontSize?: number;
  cellContentFontSize?: number;
  logoSize?: number;
}

// Interface pour les affectations groupées par jour
interface GroupedAssignments {
  [key: string]: Assignment[];
}

// Interface pour les paramètres de style du tableau
interface ScheduleStyleSettings {
  filledCellColor: string;
  showThickTimeBorders: boolean;
  showDoubleDayBorders: boolean;
}

export default function Schedule() {
  // الصلاحيات
  const { can } = usePermissions();

  // الحالة المحلية
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number>(0);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [selectedCell, setSelectedCell] = useState<ScheduleCell & { dayIndex: number; timeIndex: number } | null>(null);
  const [isCellModalOpen, setIsCellModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // إضافة حالات البحث
  const [professorSearchTerm, setProfessorSearchTerm] = useState('');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [isProfessorDropdownOpen, setIsProfessorDropdownOpen] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const [filteredProfessors, setFilteredProfessors] = useState<Professor[]>([]);
  const [filteredCoursesSearch, setFilteredCoursesSearch] = useState<Course[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);

  // Sandbox Save/Load State
  const [isSaveDraftModalOpen, setIsSaveDraftModalOpen] = useState(false);
  const [isLoadDraftModalOpen, setIsLoadDraftModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const { saveDraft, loadDraft, listDrafts, deleteDraft } = useSandbox();

  // Day/time filters state (used by professors filtering)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<number | null>(null);

  // Keyboard navigation for professor dropdown
  const professorNavigation = useKeyboardNavigation({
    items: filteredProfessors,
    isOpen: isProfessorDropdownOpen,
    onSelect: (professor) => {
      handleProfessorSelect(professor.id);
    },
    onClose: () => setIsProfessorDropdownOpen(false),
    getItemId: (professor, index) => `schedule-professor-${professor?.id || 0}-${index}`
  });

  // Keyboard navigation for course dropdown
  const courseNavigation = useKeyboardNavigation({
    items: filteredCoursesSearch,
    isOpen: isCourseDropdownOpen,
    onSelect: (course) => {
      handleCourseSelect(course.id);
    },
    onClose: () => setIsCourseDropdownOpen(false),
    getItemId: (course, index) => `schedule-course-${course?.id || 0}-${index}`
  });

  // Keyboard navigation for room dropdown
  const roomNavigation = useKeyboardNavigation({
    items: filteredRooms,
    isOpen: isRoomDropdownOpen,
    onSelect: (room) => {
      handleRoomSelect(room.id);
    },
    onClose: () => setIsRoomDropdownOpen(false),
    getItemId: (room, index) => `schedule-room-${room?.id || 0}-${index}`
  });

  // إعدادات تصميم الجدول
  const [scheduleStyle, setScheduleStyle] = useState<ScheduleStyleSettings>({
    filledCellColor: '#dbeafe', // أزرق فاتح افتراضي
    showThickTimeBorders: false,
    showDoubleDayBorders: false
  });

  // استخدام hook إعدادات الطباعة
  const { settings: printSettingsHook } = usePrintSettings();

  // الحصول على السياق الأكاديمي
  const academicYearContext = useContext(AcademicYearContext);
  const currentYear = academicYearContext?.currentYear;
  const currentSemester = academicYearContext?.currentSemester;

  // استخدام السياق للتعامل مع التكاليف
  const { assignments: contextAssignments, refreshAssignments, addAssignment, updateAssignment, deleteAssignment } = useAssignments();
  const {
    isSandboxMode,
    enterSandboxMode,
    exitSandboxMode,
    sandboxAssignments,
    addSandboxAssignment,
    updateSandboxAssignment,
    deleteSandboxAssignment,
    commitChanges,
    discardChanges,
    hasChanges,
    undo,
    redo,
    canUndo,
    canRedo
  } = useSandbox();

  // Drag & Drop State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    // Find the assignment being dragged
    const assignmentId = parseInt((active.id as string).split('-')[1]);
    const assignment = (isSandboxMode ? sandboxAssignments : contextAssignments).find((a: Assignment) => a.id === assignmentId);
    if (assignment) {
      setActiveAssignment(assignment);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveAssignment(null);

    if (!over) return;

    const activeIdString = active.id as string;
    const overIdString = over.id as string;

    if (activeIdString === overIdString) return;

    // Parse IDs
    // activeId format: assignment-{id}-{index} or assignment-{id}
    // overId format: cell-{dayIndex}-{timeIndex}

    const assignmentId = parseInt(activeIdString.split('-')[1]);

    if (!overIdString.startsWith('cell-')) return;

    const [_, dayIndexStr, timeIndexStr] = overIdString.split('-');
    const newDayIndex = parseInt(dayIndexStr);
    const newTimeIndex = parseInt(timeIndexStr);
    const newTimeSlot = timeSlots[newTimeIndex];

    // Find the assignment
    const assignmentsList = isSandboxMode ? sandboxAssignments : contextAssignments;
    const assignment = assignmentsList.find((a: Assignment) => a.id === assignmentId);

    if (!assignment) return;

    // Check for conflicts/occupancy in the target cell
    // We look for assignments in the target slot that belong to the SAME GROUP or SAME PROFESSOR or SAME ROOM
    // If we find one, we swap. If we find multiple, it's ambiguous, but we can try to swap with the one that conflicts.

    const conflictingAssignments = assignmentsList.filter((a: Assignment) =>
      a.day_of_week === newDayIndex &&
      a.start_time === newTimeSlot.start &&
      a.end_time === newTimeSlot.end &&
      (a.group_id === assignment.group_id || a.professor_id === assignment.professor_id || a.room_id === assignment.room_id) &&
      a.id !== assignment.id
    );

    const targetAssignment = conflictingAssignments[0]; // Take the first conflicting one for swapping

    try {
      if (targetAssignment) {
        // SWAP LOGIC
        const newSourceDay = assignment.day_of_week;
        const newSourceStart = assignment.start_time;
        const newSourceEnd = assignment.end_time;

        const updatedSourceAssignment = {
          ...assignment,
          day_of_week: newDayIndex,
          start_time: newTimeSlot.start,
          end_time: newTimeSlot.end
        };

        const updatedTargetAssignment = {
          ...targetAssignment,
          day_of_week: newSourceDay,
          start_time: newSourceStart,
          end_time: newSourceEnd
        };

        if (isSandboxMode) {
          updateSandboxAssignment(assignment.id!, updatedSourceAssignment);
          updateSandboxAssignment(targetAssignment.id!, updatedTargetAssignment);
        } else {
          // In live mode, we need to be careful. Update one then the other.
          // Or better, use a batch update if available.
          // For now, sequential updates.
          await updateAssignment(assignment.id!, updatedSourceAssignment);
          await updateAssignment(targetAssignment.id!, updatedTargetAssignment);
          await refreshAssignments();
        }
      } else {
        // MOVE LOGIC (No conflict)
        const updatedAssignment = {
          ...assignment,
          day_of_week: newDayIndex,
          start_time: newTimeSlot.start,
          end_time: newTimeSlot.end
        };

        if (isSandboxMode) {
          updateSandboxAssignment(assignment.id!, updatedAssignment);
        } else {
          await updateAssignment(assignment.id!, updatedAssignment);
          await refreshAssignments();
        }
      }
    } catch (error) {
      console.error("Error moving/swapping assignment:", error);
      // setError(error instanceof Error ? error : new Error("خطأ أثناء نقل التكليف"));
    }
  };

  // Helper function to check if a professor is temporary
  const isProfessorTemporary = (professor: Professor) => {
    return professor.Title === 'أستاذ(ة) مؤقت(ة)';
  };

  // Use ref to track if initial data has been loaded
  const initialDataLoaded = useRef(false);
  const lastUpdateTimestamp = useRef(Date.now());

  // استخراج قائمة التخصصات الفريقة من المجموعات
  const uniqueSpecializations = useMemo(() => {
    const uniqueSpecializations = new Set<string>();

    // إضافة جميع التخصصات الموجودة في المجموعات
    groups.forEach(group => {
      if (group.specialization && group.specialization.trim() !== '') {
        uniqueSpecializations.add(group.specialization.trim());
      }
    });

    return Array.from(uniqueSpecializations).sort();
  }, [groups]);

  useEffect(() => {
    setSpecializations(uniqueSpecializations);
  }, [uniqueSpecializations]);

  // تصفية المجموعات حسب التخصص المحدد
  const filteredGroupsBySpecialization = useMemo(() => {
    if (!selectedSpecialization) {
      // إذا لم يتم اختيار تخصص، سنعرض فقط المجموعات المحاضرات العامة
      return groups.filter(group =>
        group.name?.includes('محاضرة') ||
        group.name?.includes('lecture') ||
        group.group_type === 'lecture_group'
      );
    }

    // Use a Map to ensure unique groups by ID
    const uniqueGroups = new Map();

    // تصفية المجموعات الخاصة بالتخصص المحدد (أفواج التخصص)
    const specializedGroups = groups.filter(group =>
      group.specialization === selectedSpecialization
    );

    // Add specialized groups to our unique map
    specializedGroups.forEach(group => {
      uniqueGroups.set(group.id, group);
    });

    // تصفية مجموعات المحاضرات العامة
    const lectureGroups = groups.filter(group =>
      (group.name?.includes('محاضرة') ||
        group.name?.includes('lecture') ||
        group.group_type === 'lecture_group') &&
      (!group.specialization || group.specialization === selectedSpecialization)
    );

    // Add lecture groups to our unique map (won't add duplicates)
    lectureGroups.forEach(group => {
      if (!uniqueGroups.has(group.id)) {
        uniqueGroups.set(group.id, group);
      }
    });

    // Convert map values back to array
    return Array.from(uniqueGroups.values());
  }, [groups, selectedSpecialization]);

  // Initial data load when component mounts or year/semester changes
  useEffect(() => {
    if (currentYear && currentSemester && !initialDataLoaded.current) {
      fetchData();
      initialDataLoaded.current = true;
    }
  }, [currentYear, currentSemester]);

  // Update schedule data when contextAssignments or sandboxAssignments changes
  useEffect(() => {
    const assignmentsToUse = isSandboxMode ? sandboxAssignments : contextAssignments;
    if (assignmentsToUse.length >= 0 && currentYear && currentSemester) {
      prepareScheduleData(assignmentsToUse);
    }
  }, [contextAssignments, sandboxAssignments, isSandboxMode, currentYear, currentSemester, selectedSpecialization]);

  // Update schedule data when specialization changes
  useEffect(() => {
    const assignmentsToUse = isSandboxMode ? sandboxAssignments : contextAssignments;
    if (selectedSpecialization && assignmentsToUse.length > 0) {
      prepareScheduleData(assignmentsToUse);
    }
  }, [selectedSpecialization]);

  // جلب البيانات من قاعدة البيانات
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // جلب البيانات من قاعدة البيانات
      const [fetchedGroups, fetchedCourses, fetchedProfessors, fetchedRooms, fetchedDepartments] = await Promise.all([
        window.db.getGroups(),
        window.db.getCourses(),
        window.db.getProfessors(),
        window.db.getRooms(),
        window.db.getDepartments()
      ]);

      // تعيين البيانات في الحالة
      setGroups(fetchedGroups);
      setCourses(fetchedCourses);
      setProfessors(fetchedProfessors);
      setRooms(fetchedRooms);
      setDepartments(fetchedDepartments);

      // تعيين التخصص الافتراضي إذا كانت هناك تخصصات
      const uniqueSpecializations = new Set<string>();
      fetchedGroups.forEach(group => {
        if (group.specialization && group.specialization.trim() !== '') {
          uniqueSpecializations.add(group.specialization.trim());
        }
      });

      // تعيين قائمة التخصصات
      const specializationsList = Array.from(uniqueSpecializations).sort();
      setSpecializations(specializationsList);

      // تعيين التخصص الافتراضي إذا لم يكن محددًا بالفعل
      if (specializationsList.length > 0 && (!selectedSpecialization || !specializationsList.includes(selectedSpecialization))) {
        setSelectedSpecialization(specializationsList[0]);
      }

      // تحديث التكاليف من السياق
      await refreshAssignments();

      // تجهيز بيانات الجدول
      const assignmentsToUse = isSandboxMode ? sandboxAssignments : contextAssignments;
      prepareScheduleData(assignmentsToUse);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء جلب البيانات"));
    } finally {
      setIsLoading(false);
    }
  };

  // تحويل البيانات من قاعدة البيانات إلى تنسيق جدول الزمن
  const prepareScheduleData = (assignments: Assignment[]) => {
    const data: ScheduleData = {};

    // تصفية التكاليف حسب السنة الدراسية والسداسي
    const yearSemesterFilteredAssignments = assignments.filter(assignment =>
      (assignment.academic_year === currentYear?.year_name || !assignment.academic_year) &&
      (assignment.semester === currentSemester?.semester_name || !assignment.semester)
    );

    // Get all groups for the selected specialization
    const specializationGroupIds = filteredGroupsBySpecialization.map(group => group.id);

    // Filter assignments by specialization using the group IDs
    const filteredAssignments = yearSemesterFilteredAssignments.filter(assignment =>
      specializationGroupIds.includes(assignment.group_id)
    );

    console.log('Filtered assignments:', filteredAssignments);
    console.log('Selected specialization:', selectedSpecialization);
    console.log('Specialization group IDs:', specializationGroupIds);

    // تصفية التكاليف حسب اليوم والوقت
    const groupedAssignments = new Map<string, Assignment[]>();

    for (const assignment of filteredAssignments) {
      const key = `${assignment.day_of_week}-${assignment.start_time}-${assignment.end_time}`;
      if (!groupedAssignments.has(key)) {
        groupedAssignments.set(key, []);
      }
      groupedAssignments.get(key)?.push(assignment);
    }

    // تحويل التكاليف إلى تنسيق جدول الزمن
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      if (!data[dayIndex]) {
        data[dayIndex] = {};
      }

      for (let timeIndex = 0; timeIndex < timeSlots.length; timeIndex++) {
        const key = `${dayIndex}-${timeSlots[timeIndex].start}-${timeSlots[timeIndex].end}`;
        const assignmentGroup = groupedAssignments.get(key);

        if (assignmentGroup && assignmentGroup.length > 0) {
          // تحديد ما إذا كانت الجلسة محاضرة
          const isLecture = assignmentGroup.some(a => {
            const group = groups.find(g => g.id === a.group_id);
            return group?.name.includes('محاضرة') || false;
          });

          if (assignmentGroup.length === 1 || isLecture) {
            // إذا كانت الجلسة محاضرة أو جلسة واحدة، قم بتعيين البيانات بشكل مباشر
            const assignment = assignmentGroup[0];
            data[dayIndex][timeIndex] = {
              group_id: assignment.group_id,
              course_id: assignment.course_id,
              professor_id: assignment.professor_id,
              room_id: assignment.room_id,
              isLecture: isLecture
            };
          } else {
            // إذا كانت الجلسة تحتوي على عدة تكاليف، قم بتعيين البيانات بشكل متداخل
            data[dayIndex][timeIndex] = {
              group_id: assignmentGroup[0].group_id, // قم بتعيين المجموعة الأولى كقيمة افتراضية
              course_id: assignmentGroup[0].course_id,
              professor_id: assignmentGroup[0].professor_id,
              room_id: assignmentGroup[0].room_id,
              assignments: assignmentGroup,
              isLecture: false
            };
          }
        }
      }
    }

    console.log("Prepared schedule data:", data);
    setScheduleData(data);
  };

  // معالجة النقر على الخلية
  const handleCellClick = (dayIndex: number, timeIndex: number, isNewAssignment: boolean = false) => {
    // التحقق من وجود بيانات للخلية المحددة
    const existingCell = scheduleData[dayIndex]?.[timeIndex];

    // إنشاء كائن الخلية المحددة مع القيم الافتراضية إذا لم تكن موجودة أو إذا كان إضافة جديدة
    setSelectedCell({
      dayIndex,
      timeIndex,
      group_id: isNewAssignment ? 0 : (existingCell?.group_id || 0),
      course_id: isNewAssignment ? 0 : (existingCell?.course_id || 0),
      professor_id: isNewAssignment ? 0 : (existingCell?.professor_id || 0),
      room_id: isNewAssignment ? 0 : (existingCell?.room_id || 0)
    });

    console.log('Cell data for edit:', selectedCell);
    console.log('Available groups for dropdown:', filteredGroupsBySpecialization);
    console.log('Is new assignment:', isNewAssignment);

    setIsCellModalOpen(true);
  };

  // حفظ بيانات الخلية
  const handleSaveCell = async (dayIndex: number, timeIndex: number, cell: ScheduleCell & { dayIndex: number; timeIndex: number }) => {
    try {
      setIsLoading(true);
      setError(null);

      // التحقق من صحة البيانات
      if (!cell.group_id || !cell.course_id || !cell.professor_id || !cell.room_id) {
        setError(new Error("جميع الحقول مطلوبة"));
        setIsLoading(false);
        return;
      }

      // Get the specialization from the selected group
      const selectedGroup = groups.find(g => g.id === cell.group_id);
      if (!selectedGroup) {
        setError(new Error("المجموعة المحددة غير موجودة"));
        setIsLoading(false);
        return;
      }

      const groupSpecialization = selectedGroup.specialization || '';

      // إنشاء كائن التكليف
      const assignment: Assignment = {
        group_id: cell.group_id,
        course_id: cell.course_id,
        professor_id: cell.professor_id,
        room_id: cell.room_id,
        day_of_week: dayIndex,
        start_time: timeSlots[timeIndex].start,
        end_time: timeSlots[timeIndex].end,
        academic_year: currentYear?.year_name || '',
        semester: currentSemester?.semester_name || '',
        specialization: groupSpecialization // Use the group's specialization
      };

      console.log('Saving assignment:', assignment);

      // التحقق من وجود تكليف سابق لهذه الخلية
      const existingAssignment = contextAssignments.find((a: Assignment) =>
        a.day_of_week === dayIndex &&
        a.start_time === timeSlots[timeIndex].start &&
        a.end_time === timeSlots[timeIndex].end &&
        a.academic_year === (currentYear?.year_name || '') &&
        a.semester === (currentSemester?.semester_name || '') &&
        a.group_id === cell.group_id // Match by group_id instead of specialization
      );

      try {
        // إذا كان في وضع التجربة (Sandbox Mode)
        if (isSandboxMode) {
          if (existingAssignment && existingAssignment.id) {
            updateSandboxAssignment(existingAssignment.id, assignment);
            console.log(`تم تحديث التكليف في وضع التجربة`);
          } else {
            addSandboxAssignment(assignment);
            console.log("تم إضافة تكليف جديد في وضع التجربة");
          }
          setIsLoading(false);
          setIsCellModalOpen(false);
          return;
        }

        // إذا كان هناك تكليف سابق، قم بتحديثه، وإلا قم بإضافة تكليف جديد
        if (existingAssignment && existingAssignment.id) {
          await updateAssignment(existingAssignment.id, assignment);
          console.log(`تم تحديث التكليف رقم ${existingAssignment.id}`);
        } else {
          // Check for conflicts before adding the assignment
          const result = await addAssignment(assignment);
          console.log("تم إضافة تكليف جديد", result);
        }

        // إعادة تحميل البيانات
        await refreshAssignments();
      } catch (error) {
        console.error("Error saving cell:", error);

        // Check if it's a conflict error
        if (error instanceof Error && error.message.includes("تعارض في الجدول الزمني")) {
          // Get professor, group and room names for better error message
          const professorName = professors.find(p => p.id === cell.professor_id)?.name || '';
          const groupName = groups.find(g => g.id === cell.group_id)?.name || '';
          const roomName = rooms.find(r => r.id === cell.room_id)?.name || '';

          setError(new Error(`يوجد تعارض في الجدول الزمني:
          - قد يكون الأستاذ "${professorName}" مشغولاً في هذا الوقت
          - أو المجموعة "${groupName}" لديها محاضرة أخرى
          - أو القاعة "${roomName}" محجوزة لمحاضرة أخرى
          
          الرجاء اختيار وقت آخر أو تغيير الأستاذ/المجموعة/القاعة.`));
        } else {
          setError(error instanceof Error ? error : new Error("خطأ أثناء حفظ التكليف"));
        }
      }
    } catch (error) {
      console.error("Error saving cell:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء حفظ التكليف"));
    } finally {
      setIsLoading(false);
      setIsCellModalOpen(false);
    }
  };

  // حذف خلية من الجدول
  const handleDeleteCell = async (dayIndex: number, timeIndex: number) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!window.confirm("هل أنت متأكد من حذف هذا التكليف؟")) {
        setIsLoading(false);
        return;
      }

      // Get the cell data from the schedule
      const cellData = scheduleData[dayIndex]?.[timeIndex];
      if (!cellData) {
        console.log("لا توجد بيانات في هذه الخلية");
        setIsLoading(false);
        return;
      }

      // If the cell has multiple assignments
      if (cellData.assignments && cellData.assignments.length > 0) {
        // Delete all assignments in this cell
        for (const assignment of cellData.assignments) {
          if (assignment.id) {
            if (isSandboxMode) {
              deleteSandboxAssignment(assignment.id);
            } else {
              await deleteAssignment(assignment.id);
            }
            console.log(`تم حذف التكليف رقم ${assignment.id}`);
          }
        }
      } else {
        // Find the assignment by day, time, and group_id
        const assignment = (isSandboxMode ? sandboxAssignments : contextAssignments).find((a: Assignment) =>
          a.day_of_week === dayIndex &&
          a.start_time === timeSlots[timeIndex].start &&
          a.end_time === timeSlots[timeIndex].end &&
          a.academic_year === (currentYear?.year_name || '') &&
          a.semester === (currentSemester?.semester_name || '') &&
          a.group_id === cellData.group_id
        );

        if (assignment && assignment.id) {
          if (isSandboxMode) {
            deleteSandboxAssignment(assignment.id);
          } else {
            await deleteAssignment(assignment.id);
          }
          console.log(`تم حذف التكليف رقم ${assignment.id}`);
        } else {
          console.log("لم يتم العثور على التكليف المطلوب حذفه");
        }
      }

      // Update the schedule data
      const newScheduleData = { ...scheduleData };
      if (newScheduleData[dayIndex]) {
        delete newScheduleData[dayIndex][timeIndex];
        if (Object.keys(newScheduleData[dayIndex]).length === 0) {
          delete newScheduleData[dayIndex];
        }
      }
      setScheduleData(newScheduleData);

      // Refresh the assignments
      if (!isSandboxMode) {
        await refreshAssignments();
      }
    } catch (error) {
      console.error("Error deleting cell:", error);
      setError(error instanceof Error ? error : new Error("خطأ أثناء حذف التكليف"));
    } finally {
      setIsLoading(false);
    }
  };

  // معالجة البحث عن أستاذ
  const handleProfessorSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    setProfessorSearchTerm(searchValue);

    // تصفية الأساتذة حسب جزء من الاسم
    const filtered = professors.filter(professor =>
      professor.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    setFilteredProfessors(filtered);
    setIsProfessorDropdownOpen(searchValue.length > 0);
  };

  // معالجة اختيار أستاذ من نتائج البحث
  const handleProfessorSelect = (professorId: number) => {
    const selectedProfessor = professors.find(p => p.id === professorId);
    if (selectedCell) {
      setSelectedCell({ ...selectedCell, professor_id: professorId });
    }
    setProfessorSearchTerm('');
    setIsProfessorDropdownOpen(false);
  };

  // معالجة البحث عن مقرر
  const handleCourseSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    setCourseSearchTerm(searchValue);

    // تصفية المقررات حسب جزء من الاسم أو الرمز
    const filtered = courses.filter(course =>
      course.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (course.code && course.code.toLowerCase().includes(searchValue.toLowerCase()))
    );

    setFilteredCoursesSearch(filtered);
    setIsCourseDropdownOpen(searchValue.length > 0);
  };

  // معالجة اختيار مقرر من نتائج البحث
  const handleCourseSelect = (courseId: number) => {
    const selectedCourse = courses.find(c => c.id === courseId);
    if (selectedCell) {
      setSelectedCell({ ...selectedCell, course_id: courseId });
    }
    setCourseSearchTerm(''); // Clear search term
    setIsCourseDropdownOpen(false);
  };

  // معالجة البحث عن قاعة
  const handleRoomSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    setRoomSearchTerm(searchValue);

    // تصفية القاعات حسب جزء من الاسم
    const filtered = rooms.filter(room =>
      room.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    setFilteredRooms(filtered);
    setIsRoomDropdownOpen(searchValue.length > 0);
  };

  // معالجة اختيار قاعة من نتائج البحث
  const handleRoomSelect = (roomId: number) => {
    const selectedRoom = rooms.find(r => r.id === roomId);
    if (selectedCell) {
      setSelectedCell({ ...selectedCell, room_id: roomId });
    }
    setRoomSearchTerm(''); // Clear search term
    setIsRoomDropdownOpen(false);
  };

  // دالة لرسم خلية في الجدول
  const renderCell = (dayIndex: number, timeIndex: number) => {
    const cell = scheduleData[dayIndex]?.[timeIndex];

    // Calculate validity for Drag & Drop
    let isValid = true;
    if (activeAssignment) {
      const assignmentsList = isSandboxMode ? sandboxAssignments : contextAssignments;
      // Check for hard conflicts (Professor or Group busy in ANOTHER cell)
      const isHardConflict = assignmentsList.some((a: Assignment) =>
        a.id !== activeAssignment.id &&
        a.day_of_week === dayIndex &&
        a.start_time === timeSlots[timeIndex].start &&
        a.end_time === timeSlots[timeIndex].end &&
        (a.professor_id === activeAssignment.professor_id || a.group_id === activeAssignment.group_id) &&
        // If the conflicting assignment is in the current cell (target), it's a swap (not a hard conflict)
        // We assume assignments in the same cell share the same day/time/group(usually)/room
        // But wait, if I drop on a cell, I am targeting that cell.
        // If the conflicting assignment is NOT in this cell, it is a conflict.
        // How to check if 'a' is in this cell?
        // We can check if 'a' is one of the assignments currently rendered in this cell?
        // Or simply: if 'a' is in the target cell, it means 'a' has the same group/course/etc as the cell.
        // But 'a' IS at this day/time (checked above).
        // So the question is: Is 'a' the assignment I would be swapping with?
        // If I swap, I take 'a's place.
        // If 'a' is in a different group (not visible or visible in another column if we had columns), it's a conflict.
        // In this grid, we show ALL groups for the selected specialization.
        // So if 'a' is in this grid, it is in this cell (since day/time match).
        // So 'a' is visible.
        // If 'a' is NOT in this grid (e.g. another specialization), then it is NOT in this cell.
        // So we need to check if 'a' belongs to the currently filtered view?
        // Actually, if 'a' is in the same cell, it's a swap.
        // If 'a' is in a different cell (same time), it's a conflict.
        // Since this is a 2D grid (Time x Day), there is only ONE cell for a given Time/Day.
        // So ANY assignment at this Time/Day is "in this cell" visually, UNLESS the grid is filtered.
        // The grid IS filtered by Specialization/Department.
        // So if 'a' belongs to a different specialization, it won't be in `scheduleData`.
        // But it IS in `assignmentsList`.
        // So:
        // If 'a' is in `scheduleData[dayIndex][timeIndex]`, it's a swap.
        // If 'a' is NOT in `scheduleData[dayIndex][timeIndex]`, it's a hard conflict (busy elsewhere).
        !scheduleData[dayIndex]?.[timeIndex]?.assignments?.some(sa => sa.id === a.id) &&
        // Also check single assignment case
        !(scheduleData[dayIndex]?.[timeIndex]?.group_id === a.group_id && scheduleData[dayIndex]?.[timeIndex]?.course_id === a.course_id)
      );

      isValid = !isHardConflict;
    }

    // تحديد فئات CSS للحدود
    const getBorderClasses = () => {
      let classes = 'border';

      // حدود سميكة بين الفترات الزمنية
      if (scheduleStyle.showThickTimeBorders) {
        classes += ' border-t-2 border-b-2';
      }

      // حدود مزدوجة بين أعمدة الأيام
      if (scheduleStyle.showDoubleDayBorders) {
        if (dayIndex > 0) {
          classes += ' border-l-2';
        }
        if (dayIndex < 6) { // assuming 7 days (0-6)
          classes += ' border-r-2';
        }
      }

      return classes;
    };

    // التعامل مع الخلايا الفارغة
    if (!cell) {
      return (
        <DroppableCell id={`cell-${dayIndex}-${timeIndex}`} isOver={false} isValid={isValid}>
          <div
            className={`${getBorderClasses()} p-2 h-20 cursor-pointer hover:bg-gray-100 relative group`}
            onClick={() => handleCellClick(dayIndex, timeIndex)}
          >
            <div className="text-gray-400 text-center">فارغ</div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="bg-blue-500 text-white rounded-full p-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellClick(dayIndex, timeIndex);
                }}
                title="إضافة"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </DroppableCell>
      );
    }

    // التعامل مع الخلايا التي تحتوي على تكاليف متعددة
    if (cell.assignments && cell.assignments.length > 0) {
      return (
        <DroppableCell id={`cell-${dayIndex}-${timeIndex}`} isOver={false} isValid={isValid}>
          <div
            className={`${getBorderClasses()} p-2 h-auto min-h-20 cursor-pointer hover:opacity-80 relative group`}
            style={{ backgroundColor: scheduleStyle.filledCellColor }}
            onClick={() => handleCellClick(dayIndex, timeIndex)}
          >
            <div className="max-h-none overflow-visible">
              {cell.assignments.map((assignment, index) => {
                const group = groups.find(g => g.id === assignment.group_id);
                const course = courses.find(c => c.id === assignment.course_id);
                const professor = professors.find(p => p.id === assignment.professor_id);
                const room = rooms.find(r => r.id === assignment.room_id);

                return (
                  <DraggableAssignment
                    key={`assignment-${assignment.id}-${index}`}
                    id={`assignment-${assignment.id}-${index}`}
                    data={assignment}
                    disabled={!isSandboxMode && !can('update', 'sessions')}
                  >
                    <div
                      className={`mb-1 pb-1 ${index < (cell.assignments?.length || 0) - 1 ? 'border-b border-gray-300' : ''}`}
                    >
                      {group && <div className="font-bold text-xs">{group.name}</div>}
                      {course && <div className="text-xs">{course.name}</div>}
                      {professor && (
                        <div className={`text-xs ${isProfessorTemporary(professor) ? 'text-red-600' : ''}`}>
                          {professor.name}
                        </div>
                      )}
                      {room && <div className="text-xs text-gray-500">{room.name}</div>}
                    </div>
                  </DraggableAssignment>
                );
              })}
            </div>

            {/* أزرار تظهر عند تمرير المؤشر */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex">
              <button
                className="bg-green-500 text-white rounded-full p-1 mx-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellClick(dayIndex, timeIndex, true);
                }}
                title="إضافة تكليف جديد"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                className="bg-red-500 text-white rounded-full p-1 mx-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCell(dayIndex, timeIndex);
                }}
                title="حذف جميع التكاليف"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </DroppableCell>
      );
    }

    // التعامل مع الخلايا التي تحتوي على تكليف واحد
    const group = groups.find(g => g.id === cell.group_id);
    const course = courses.find(c => c.id === cell.course_id);
    const professor = professors.find(p => p.id === cell.professor_id);
    const room = rooms.find(r => r.id === cell.room_id);

    // Find the assignment object to get the ID
    const singleAssignment = (isSandboxMode ? sandboxAssignments : contextAssignments).find((a: Assignment) =>
      a.day_of_week === dayIndex &&
      a.start_time === timeSlots[timeIndex].start &&
      a.end_time === timeSlots[timeIndex].end &&
      a.group_id === cell.group_id
    );

    return (
      <DroppableCell id={`cell-${dayIndex}-${timeIndex}`} isOver={false} isValid={isValid}>
        <div
          className={`${getBorderClasses()} p-2 h-auto min-h-20 cursor-pointer hover:opacity-80 relative group`}
          style={{ backgroundColor: scheduleStyle.filledCellColor }}
          onClick={() => handleCellClick(dayIndex, timeIndex)}
        >
          <div className="max-h-none overflow-visible">
            {singleAssignment ? (
              <DraggableAssignment
                id={`assignment-${singleAssignment.id}`}
                data={singleAssignment}
                disabled={!isSandboxMode && !can('update', 'sessions')}
              >
                <div>
                  {group && <div className="font-bold">{group.name}</div>}
                  {course && <div>{course.name}</div>}
                  {professor && (
                    <div className={`text-xs ${professor.Title === 'أستاذ(ة) مؤقت(ة)' ? 'text-red-600 font-bold' : ''}`}>
                      {professor.name}
                    </div>
                  )}
                  {room && <div className="text-xs text-gray-500">{room.name}</div>}
                </div>
              </DraggableAssignment>
            ) : (
              <div>
                {group && <div className="font-bold">{group.name}</div>}
                {course && <div>{course.name}</div>}
                {professor && (
                  <div className={`text-xs ${professor.Title === 'أستاذ(ة) مؤقت(ة)' ? 'text-red-600 font-bold' : ''}`}>
                    {professor.name}
                  </div>
                )}
                {room && <div className="text-xs text-gray-500">{room.name}</div>}
              </div>
            )}
          </div>

          {/* أزرار تظهر عند تمرير المؤشر */}
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex">
            {can('create', 'sessions') && (
              <button
                className="bg-green-500 text-white rounded-full p-1 mx-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellClick(dayIndex, timeIndex, true);
                }}
                title="إضافة تكليف جديد"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            {can('update', 'sessions') && (
              <button
                className="bg-blue-500 text-white rounded-full p-1 mx-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellClick(dayIndex, timeIndex);
                }}
                title="تعديل التكليف"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {can('delete', 'sessions') && (
              <button
                className="bg-red-500 text-white rounded-full p-1 mx-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  // handleDeleteCell will delete all assignments in this cell
                  // For individual assignment deletion, need to implement separate function
                }}
                title="حذف التكليف"
                disabled
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </DroppableCell>
    );
  };

  // الحصول على اسم السداسي المحدد
  const getSelectedSemesterName = () => {
    if (!currentSemester) return '';
    const semester = semesters.find(s => s.id === currentSemester.id);
    return semester ? semester.name : '';
  };

  // دالة تصدير الجدول إلى PDF
  const exportToPDF = async () => {
    try {
      // إظهار رسالة تحميل
      setIsLoading(true);

      if (!currentYear || !currentSemester) {
        setIsLoading(false);
        return;
      }

      // Afficher la structure de scheduleData pour débogage
      console.log("Structure complète de scheduleData:", scheduleData);

      // تحضير البيانات للجدول
      const tableData: any[][] = [];

      // Initialiser le tableau avec des tableaux vides pour chaque jour
      for (let i = 0; i < days.length; i++) {
        tableData[i] = [];
        for (let j = 0; j < timeSlots.length; j++) {
          tableData[i][j] = [];
        }
      }

      // تنظيم البيانات حسب اليوم والوقت
      days.forEach((_, dayIndex) => {
        timeSlots.forEach((_, timeIndex) => {
          // البحث عن الحصص في هذا اليوم وهذا الوقت
          if (scheduleData[dayIndex] && scheduleData[dayIndex][timeIndex]) {
            const cell = scheduleData[dayIndex][timeIndex];

            // Vérifier si la cellule a des affectations
            if (cell.assignments && cell.assignments.length > 0) {
              for (const assignment of cell.assignments) {
                const professor = professors.find(p => p.id === assignment.professor_id);
                const course = courses.find(c => c.id === assignment.course_id);
                const group = groups.find(g => g.id === assignment.group_id);
                const room = rooms.find(r => r.id === assignment.room_id);

                tableData[dayIndex][timeIndex].push({
                  course: course ? `${course.name}` : 'غير محدد',
                  professor: professor ? `${professor.name}` : 'غير محدد',
                  group: group ? abbrGroupName(group.name) : 'غير محدد',
                  room: room ? room.name : 'غير محدد'
                });
              }
            }
            // Vérifier si la cellule a une affectation directe (ancien format)
            else if (cell.group_id && cell.course_id && cell.professor_id) {
              const professor = professors.find(p => p.id === cell.professor_id);
              const course = courses.find(c => c.id === cell.course_id);
              const group = groups.find(g => g.id === cell.group_id);
              const room = rooms.find(r => r.id === cell.room_id);

              tableData[dayIndex][timeIndex].push({
                course: course ? `${course.name}` : 'غير محدد',
                professor: professor ? `${professor.name}` : 'غير محدد',
                group: group ? abbrGroupName(group.name) : 'غير محدد',
                room: room ? room.name : 'غير محدد'
              });
            }
          }
        });
      });

      // Afficher le nombre d'affectations par jour pour débogage
      tableData.forEach((dayData, dayIndex) => {
        let assignmentsCount = 0;
        dayData.forEach(timeData => {
          assignmentsCount += timeData.length;
        });
        console.log(`Jour ${dayIndex} (${days[dayIndex].name}): ${assignmentsCount} affectations`);
      });

      // Identifier les jours qui ont des affectations
      const daysWithAssignments: number[] = [];
      tableData.forEach((dayData, dayIndex) => {
        let hasAssignments = false;
        dayData.forEach(timeData => {
          if (timeData.length > 0) {
            hasAssignments = true;
          }
        });
        if (hasAssignments) {
          daysWithAssignments.push(dayIndex);
        }
      });

      console.log("Jours avec affectations:", daysWithAssignments);

      // Filtrer les jours sans affectations pour optimiser l'espace
      const filteredDaysWithAssignments = daysWithAssignments.filter(dayIndex => {
        // Vérifier si le jour a au moins une affectation
        return tableData[dayIndex].some(timeData => timeData.length > 0);
      });

      console.log("Jours filtrés avec affectations:", filteredDaysWithAssignments);

      // إنشاء عنوان ومعلومات الجدول
      const title = `التوزيع الزمني - ${selectedSpecialization}`;
      const semesterName = currentSemester?.semester_name || getSelectedSemesterName();
      const subtitle = `السنة الدراسية: ${currentYear?.year_name || ''}`;

      // استخدام إعدادات الطباعة من الـ hook
      const cellWidth = Math.max(40, Math.min(90, Math.floor(600 / timeSlots.length)));

      // استخدام الإعدادات المحملة من الـ hook
      const headerFontSize = printSettingsHook.headerFontSize || 16;
      const titleFontSize = printSettingsHook.titleFontSize || 16;
      const subtitleFontSize = printSettingsHook.subtitleFontSize || 14;
      const cellContentFontSize = printSettingsHook.cellContentFontSize || 10;
      const logoSize = printSettingsHook.logoSize || 80;
      const cellPadding = printSettingsHook.cellPadding || 3;
      const lineHeight = printSettingsHook.lineHeight || 1.2;
      const marginBetweenLines = printSettingsHook.marginBetweenLines || 2;
      const sessionGap = printSettingsHook.sessionGap || 8;
      const tableCellAlignment = printSettingsHook.tableCellAlignment || 'center';
      const tableBorderWidth = printSettingsHook.tableBorderWidth || 1;
      const tableBorderColor = printSettingsHook.tableBorderColor || '#000000';

      // Générer les en-têtes de colonnes (créneaux horaires)
      let timeHeaders = '';
      timeSlots.forEach(slot => {
        timeHeaders += `<th class="time-header" style="width: ${cellWidth}px; text-align: center !important; vertical-align: middle !important;">${slot.start} - ${slot.end}</th>`;
      });

      // Générer les lignes du tableau
      let tableRows = '';

      // Générer une ligne uniquement pour les jours avec des affectations
      filteredDaysWithAssignments.forEach(dayIndex => {
        tableRows += `<tr>
          <th class="day-header" style="text-align: center !important; vertical-align: middle !important;">${days[dayIndex].name}</th>`;

        // Ajouter les cellules pour chaque créneau horaire
        timeSlots.forEach((_, timeIndex) => {
          const cellData = tableData[dayIndex][timeIndex];

          if (cellData && cellData.length > 0) {
            // استخدام حاوية Flex للحصص المتعددة
            tableRows += `<td class="schedule-cell">`;
            tableRows += `<div class="sessions-container">`;

            // إضافة كل حصة كعنصر منفصل
            cellData.forEach((session: any) => {
              tableRows += `<div class="session">
                <div class="course-group-info">${session.course || ''} (${session.group || ''})</div>
                <div class="professor-room-info">${session.professor || ''} (${session.room || ''})</div>
              </div>`;
            });

            tableRows += `</div>`;
            tableRows += `</td>`;
          } else {
            // Minimiser les cellules vides
            tableRows += `<td class="empty-cell"></td>`;
          }
        });

        tableRows += `</tr>`;
      });

      // Créer le HTML complet avec des styles optimisés pour une seule page
      const htmlContent = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 0.3cm;
      direction: rtl;
      font-size: ${cellContentFontSize}px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .page-container {
      max-width: 100%;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .logo {
      height: ${logoSize * 0.8}px;
      max-width: ${logoSize * 0.8}px;
      object-fit: contain;
    }
    .institution-info {
      text-align: center;
      flex-grow: 1;
    }
    .university-name {
      font-size: ${headerFontSize}px;
      font-weight: bold;
      margin-bottom: 2px;
      text-align: center !important;
    }
    .faculty-name {
      font-size: ${headerFontSize - 2}px;
      margin-bottom: 2px;
      text-align: center !important;
    }
    .title {
      font-size: ${titleFontSize}px;
      font-weight: bold;
      margin-bottom: 2px;
      text-align: center !important;
    }
    .subtitle {
      font-size: ${subtitleFontSize}px;
      margin-bottom: 2px;
    }
    .semester-info {
      font-size: ${subtitleFontSize - 2}px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .highlight-semester {
      color: #d00;
      font-weight: bold;
      padding: 0 5px;
    }
    .specialization-info {
      font-size: ${subtitleFontSize}px;
      margin-bottom: 3px;
      font-weight: bold;
      background-color: #ffff00;
      display: inline-block;
      padding: 2px 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 5px auto !important;
      direction: rtl;
      table-layout: auto;
      page-break-inside: avoid;
    }
    th, td {
      border: ${tableBorderWidth}px solid ${tableBorderColor};
      padding: ${cellPadding}px;
      text-align: center !important;
      font-size: ${cellContentFontSize}px;
      max-width: ${cellWidth}px;
      overflow: visible;
      white-space: normal;
      word-break: break-word;
      vertical-align: top;
      line-height: ${lineHeight};
      ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333; border-bottom: 2px solid #333;' : ''}
    }
    th div, td div {
      text-align: center !important;
      margin: 0 auto !important;
    }
    .day-header {
      width: 50px;
      background-color: #e6e6e3;
      text-align: center !important;
      vertical-align: middle !important;
      ${scheduleStyle.showDoubleDayBorders ? 'border-left: 2px solid #333; border-right: 2px solid #333;' : ''}
    }
    .time-header {
      background-color: #e6e6e3;
      text-align: center !important;
      vertical-align: middle !important;
      ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333; border-bottom: 2px solid #333;' : ''}
    }
    .schedule-cell {
      vertical-align: middle;
      padding: ${cellPadding}px;
      background-color: ${scheduleStyle.filledCellColor};
      overflow: visible;
      white-space: normal;
      word-wrap: break-word;
      ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333; border-bottom: 2px solid #333;' : ''}
    }
    .sessions-container {
      display: inline-flex;
      flex-direction: column;
      justify-content: center;
      gap: ${sessionGap}px;
      width: 100%;
    }
    .empty-cell {
      background-color: #ffffff;
      width: ${cellWidth}px;
      height: 12px;
      ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333; border-bottom: 2px solid #333;' : ''}
    }
    ${scheduleStyle.showDoubleDayBorders ? `
    .schedule-cell:not(:first-child), .empty-cell:not(:first-child) {
      border-left: 2px solid #333;
    }
    .schedule-cell:not(:last-child), .empty-cell:not(:last-child) {
      border-right: 2px solid #333;
    }
    .time-header:not(:first-child) {
      border-left: 2px solid #333;
    }
    .time-header:not(:last-child) {
      border-right: 2px solid #333;
    }
    ` : ''}
    .session {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
      background: transparent;
      border: none;
      border-radius: 0;
      box-shadow: none;
      border-bottom: 1px dashed #ccc;
      text-align: center !important;
      width: 100%;
    }
    .session:last-child {
      border-bottom: none;
    }
    .session-divider {
      display: none;
    }
    .course-group-info {
      font-weight: bold;
      font-size: ${Math.max(cellContentFontSize - 1, 7)}px;
      text-align: center !important;
      width: 100%;
      display: block;
      margin-bottom: ${marginBetweenLines}px;
      line-height: ${lineHeight};
    }
    .professor-room-info {
      font-size: ${Math.max(cellContentFontSize - 2, 6)}px;
      text-align: center !important;
      width: 100%;
      display: block;
      line-height: ${lineHeight};
    }
    @media print {
      body {
        padding: 0;
        font-size: ${cellContentFontSize}px;
      }
      @page {
        size: A4 landscape;
        margin: 5mm;
      }
      .course-group-info {
        font-size: ${Math.max(cellContentFontSize - 1, 7)}px;
      }
      .professor-room-info {
        font-size: ${Math.max(cellContentFontSize - 2, 6)}px;
      }
      th, td {
        ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333 !important; border-bottom: 2px solid #333 !important;' : ''}
      }
      .schedule-cell {
        background-color: ${scheduleStyle.filledCellColor} !important;
        ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333 !important; border-bottom: 2px solid #333 !important;' : ''}
      }
      ${scheduleStyle.showDoubleDayBorders ? `
      .schedule-cell:not(:first-child), .empty-cell:not(:first-child) {
        border-left: 2px solid #333 !important;
      }
      .schedule-cell:not(:last-child), .empty-cell:not(:last-child) {
        border-right: 2px solid #333 !important;
      }
      .time-header:not(:first-child) {
        border-left: 2px solid #333 !important;
      }
      .time-header:not(:last-child) {
        border-right: 2px solid #333 !important;
      }
      .day-header {
        border-left: 2px solid #333 !important;
        border-right: 2px solid #333 !important;
      }
      ` : ''}
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header-container">
      ${printSettingsHook.universityLogoUrl ? `<img src="${printSettingsHook.universityLogoUrl}" alt="شعار الجامعة" class="logo" />` : `<div style="width: ${logoSize * 0.8}px;"></div>`}
      <div class="institution-info">
        ${printSettingsHook.universityName ? `<div class="university-name">${printSettingsHook.universityName}</div>` : ''}
        ${printSettingsHook.facultyName ? `<div class="faculty-name">${printSettingsHook.facultyName}</div>` : ''}
        <div class="title">${title}</div>
        <div class="semester-info">السنة الدراسية: ${currentYear?.year_name || ''} - الفصل: <span class="highlight-semester">${semesterName}</span></div>
        
      </div>
      ${printSettingsHook.facultyLogoUrl ? `<img src="${printSettingsHook.facultyLogoUrl}" alt="شعار الكلية" class="logo" />` : `<div style="width: ${logoSize * 0.8}px;"></div>`}
    </div>
  
    <table>
      <thead>
        <tr>
          <th class="day-header" style="text-align: center !important; vertical-align: middle !important;"></th>
          ${timeHeaders}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;

      // ✅ تحويل HTML إلى PDF باستخدام printUtils الجديد مع الإعدادات الكاملة
      const printOptions = createPrintOptions(
        `التوزيع الزمني - ${selectedSpecialization}`,
        printSettingsHook,
        {
          orientation: 'landscape',
          asPDF: true
        }
      );
      printContent(htmlContent, printOptions);

      setIsLoading(false);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      setIsLoading(false);
    }
  };

  // دالة تصدير الجدول إلى PDF بدون أسماء الأساتذة المؤقتين
  const exportToPDFWithoutTemporaryProfessors = async () => {
    try {
      // إظهار رسالة تحميل
      setIsLoading(true);

      if (!currentYear || !currentSemester) {
        alert('الرجاء اختيار السنة الدراسية والفصل الدراسي');
        setIsLoading(false);
        return;
      }

      // Afficher la structure de scheduleData pour débogage
      console.log("Structure complète de scheduleData:", scheduleData);

      // تحضير البيانات للجدول
      const tableData: any[][] = [];

      // Initialiser le tableau avec des tableaux vides pour chaque jour
      for (let i = 0; i < days.length; i++) {
        tableData[i] = [];
        for (let j = 0; j < timeSlots.length; j++) {
          tableData[i][j] = [];
        }
      }

      // تنظيم البيانات حسب اليوم والوقت
      days.forEach((_, dayIndex) => {
        timeSlots.forEach((_, timeIndex) => {
          // البحث عن الحصص في هذا اليوم وهذا الوقت
          if (scheduleData[dayIndex] && scheduleData[dayIndex][timeIndex]) {
            const cell = scheduleData[dayIndex][timeIndex];

            // Vérifier si la cellule a des affectations
            if (cell.assignments && cell.assignments.length > 0) {
              for (const assignment of cell.assignments) {
                const professor = professors.find(p => p.id === assignment.professor_id);
                const course = courses.find(c => c.id === assignment.course_id);
                const group = groups.find(g => g.id === assignment.group_id);
                const room = rooms.find(r => r.id === assignment.room_id);

                // إخفاء اسم الأستاذ إذا كان مؤقتاً
                const professorName = professor && isProfessorTemporary(professor)
                  ? 'أستاذ غير محدد'
                  : (professor ? professor.name : 'غير محدد');

                tableData[dayIndex][timeIndex].push({
                  course: course ? `${course.name}` : 'غير محدد',
                  professor: professorName,
                  group: group ? abbrGroupName(group.name) : 'غير محدد',
                  room: room ? room.name : 'غير محدد'
                });
              }
            }
            // Vérifier si la cellule a une affectation directe (ancien format)
            else if (cell.group_id && cell.course_id && cell.professor_id) {
              const professor = professors.find(p => p.id === cell.professor_id);
              const course = courses.find(c => c.id === cell.course_id);
              const group = groups.find(g => g.id === cell.group_id);
              const room = rooms.find(r => r.id === cell.room_id);

              // إخفاء اسم الأستاذ إذا كان مؤقتاً
              const professorName = professor && isProfessorTemporary(professor)
                ? 'أستاذ غير محدد'
                : (professor ? professor.name : 'غير محدد');

              tableData[dayIndex][timeIndex].push({
                course: course ? `${course.name}` : 'غير محدد',
                professor: professorName,
                group: group ? abbrGroupName(group.name) : 'غير محدد',
                room: room ? room.name : 'غير محدد'
              });
            }
          }
        });
      });

      // Afficher le nombre d'affectations par jour pour débogage
      tableData.forEach((dayData, dayIndex) => {
        let assignmentsCount = 0;
        dayData.forEach(timeData => {
          assignmentsCount += timeData.length;
        });
        console.log(`Jour ${dayIndex} (${days[dayIndex].name}): ${assignmentsCount} affectations`);
      });

      // Identifier les jours qui ont des affectations
      const daysWithAssignments: number[] = [];
      tableData.forEach((dayData, dayIndex) => {
        let hasAssignments = false;
        dayData.forEach(timeData => {
          if (timeData.length > 0) {
            hasAssignments = true;
          }
        });
        if (hasAssignments) {
          daysWithAssignments.push(dayIndex);
        }
      });

      console.log("Jours avec affectations:", daysWithAssignments);

      // Filtrer les jours sans affectations pour optimiser l'espace
      const filteredDaysWithAssignments = daysWithAssignments.filter(dayIndex => {
        // Vérifier si le jour a au moins une affectation
        return tableData[dayIndex].some(timeData => timeData.length > 0);
      });

      console.log("Jours filtrés avec affectations:", filteredDaysWithAssignments);

      // إنشاء عنوان ومعلومات الجدول
      const title = `التوزيع الزمني - ${selectedSpecialization}`;
      const semesterName = currentSemester?.semester_name || getSelectedSemesterName();
      const subtitle = `السنة الدراسية: ${currentYear?.year_name || ''}`;

      // استخدام إعدادات الطباعة من الـ hook
      const cellWidth = Math.max(40, Math.min(90, Math.floor(600 / timeSlots.length)));

      // استخدام الإعدادات المحملة من الـ hook
      const headerFontSize = printSettingsHook.headerFontSize || 16;
      const titleFontSize = printSettingsHook.titleFontSize || 16;
      const subtitleFontSize = printSettingsHook.subtitleFontSize || 14;
      const cellContentFontSize = printSettingsHook.cellContentFontSize || 10;
      const logoSize = printSettingsHook.logoSize || 80;
      const cellPadding = printSettingsHook.cellPadding || 3;
      const lineHeight = printSettingsHook.lineHeight || 1.2;
      const marginBetweenLines = printSettingsHook.marginBetweenLines || 2;
      const sessionGap = printSettingsHook.sessionGap || 8;
      const tableCellAlignment = printSettingsHook.tableCellAlignment || 'center';
      const tableBorderWidth = printSettingsHook.tableBorderWidth || 1;
      const tableBorderColor = printSettingsHook.tableBorderColor || '#000000';

      // Générer les en-têtes de colonnes (créneaux horaires)
      let timeHeaders = '';
      timeSlots.forEach(slot => {
        timeHeaders += `<th class="time-header" style="width: ${cellWidth}px; text-align: center !important; vertical-align: middle !important;">${slot.start} - ${slot.end}</th>`;
      });

      // Générer les lignes du tableau
      let tableRows = '';

      // Générer une ligne uniquement pour les jours avec des affectations
      filteredDaysWithAssignments.forEach(dayIndex => {
        tableRows += `<tr>
          <th class="day-header" style="text-align: center; vertical-align: middle;">${days[dayIndex].name}</th>`;

        // Ajouter les cellules pour chaque créneau horaire
        timeSlots.forEach((_, timeIndex) => {
          const cellData = tableData[dayIndex][timeIndex];

          if (cellData && cellData.length > 0) {
            // استخدام حاوية Flex للحصص المتعددة
            tableRows += `<td class="schedule-cell">`;
            tableRows += `<div class="sessions-container">`;

            // إضافة كل حصة كعنصر منفصل
            cellData.forEach((session: any) => {
              tableRows += `<div class="session">
                <div class="course-group-info">${session.course || ''} (${session.group || ''})</div>
                <div class="professor-room-info">${session.professor || ''} (${session.room || ''})</div>
              </div>`;
            });

            tableRows += `</div>`;
            tableRows += `</td>`;
          } else {
            // Minimiser les cellules vides
            tableRows += `<td class="empty-cell"></td>`;
          }
        });

        tableRows += `</tr>`;
      });

      // Créer le HTML complet avec des styles optimisés pour une seule page
      const htmlContent = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 0.3cm;
      direction: rtl;
      font-size: ${cellContentFontSize}px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .page-container {
      max-width: 100%;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .logo {
      height: ${logoSize * 0.8}px;
      max-width: ${logoSize * 0.8}px;
      object-fit: contain;
    }
    .institution-info {
      text-align: center;
      flex: 1;
    }
    .university-name {
      font-size: ${headerFontSize}px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .faculty-name {
      font-size: ${subtitleFontSize}px;
      margin-bottom: 2px;
    }
    .title {
      font-size: ${titleFontSize}px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .subtitle {
      font-size: ${subtitleFontSize}px;
      margin-bottom: 2px;
    }
    .semester-info {
      font-size: ${subtitleFontSize - 2}px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .highlight-semester {
      background-color: #ffeb3b;
      padding: 2px 4px;
      border-radius: 3px;
      font-weight: bold;
    }
    .specialization-info {
      font-size: ${subtitleFontSize}px;
      margin-bottom: 3px;
      font-weight: bold;
      background-color: #ffff00;
      display: inline-block;
      padding: 2px 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${cellContentFontSize}px;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #333;
      text-align: center;
      vertical-align: middle;
      padding: 2px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .day-header {
      background-color: #f0f0f0;
      font-weight: bold;
      width: 80px;
      min-width: 80px;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
    .time-header {
      background-color: #f0f0f0;
      font-weight: bold;
      font-size: ${Math.max(cellContentFontSize - 1, 8)}px;
    }
    .schedule-cell {
      background-color: ${scheduleStyle.filledCellColor};
      font-size: ${Math.max(cellContentFontSize - 1, 7)}px;
      line-height: 1.1;
      padding: 2px;
      vertical-align: middle;
      overflow: visible;
      white-space: normal;
      word-wrap: break-word;
    }
    .empty-cell {
      background-color: #ffffff;
      height: 20px;
      min-height: 20px;
    }
    .session {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
      background: transparent;
      border: none;
      border-radius: 0;
      box-shadow: none;
      border-bottom: 1px dashed #ccc;
      text-align: center !important;
      width: 100%;
    }
    .session:last-child {
      border-bottom: none;
    }
    .session-divider {
      display: none;
    }
    .course-group-info {
      font-weight: bold;
      font-size: ${Math.max(cellContentFontSize - 1, 7)}px;
      text-align: center !important;
      width: 100%;
      display: block;
      margin-bottom: ${marginBetweenLines}px;
      line-height: ${lineHeight};
    }
    .professor-room-info {
      font-size: ${Math.max(cellContentFontSize - 2, 6)}px;
      text-align: center !important;
      width: 100%;
      display: block;
      line-height: ${lineHeight};
    }
    @media print {
      body {
        padding: 0;
        font-size: ${cellContentFontSize}px;
      }
      @page {
        size: A4 landscape;
        margin: 5mm;
      }
      .course-group-info {
        font-size: ${Math.max(cellContentFontSize - 1, 7)}px;
      }
      .professor-room-info {
        font-size: ${Math.max(cellContentFontSize - 2, 6)}px;
      }
      th, td {
        ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333 !important; border-bottom: 2px solid #333 !important;' : ''}
      }
      .schedule-cell {
        background-color: ${scheduleStyle.filledCellColor} !important;
        ${scheduleStyle.showThickTimeBorders ? 'border-top: 2px solid #333 !important; border-bottom: 2px solid #333 !important;' : ''}
      }
      ${scheduleStyle.showDoubleDayBorders ? `
      .schedule-cell:not(:first-child), .empty-cell:not(:first-child) {
        border-left: 2px solid #333 !important;
      }
      .schedule-cell:not(:last-child), .empty-cell:not(:last-child) {
        border-right: 2px solid #333 !important;
      }
      .time-header:not(:first-child) {
        border-left: 2px solid #333 !important;
      }
      .time-header:not(:last-child) {
        border-right: 2px solid #333 !important;
      }
      .day-header {
        border-left: 2px solid #333 !important;
        border-right: 2px solid #333 !important;
      }
      ` : ''}
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header-container">
      ${printSettingsHook.universityLogoUrl ? `<img src="${printSettingsHook.universityLogoUrl}" alt="شعار الجامعة" class="logo" />` : `<div style="width: ${logoSize * 0.8}px;"></div>`}
      <div class="institution-info">
        ${printSettingsHook.universityName ? `<div class="university-name">${printSettingsHook.universityName}</div>` : ''}
        ${printSettingsHook.facultyName ? `<div class="faculty-name">${printSettingsHook.facultyName}</div>` : ''}
        <div class="title">${title}</div>
        <div class="semester-info">السنة الدراسية: ${currentYear?.year_name || ''} - الفصل: <span class="highlight-semester">${semesterName}</span></div>
        
      </div>
      ${printSettingsHook.facultyLogoUrl ? `<img src="${printSettingsHook.facultyLogoUrl}" alt="شعار الكلية" class="logo" />` : `<div style="width: ${logoSize * 0.8}px;"></div>`}
    </div>
  
    <table>
      <thead>
        <tr>
          <th class="day-header" style="text-align: center; vertical-align: middle;"></th>
          ${timeHeaders}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;

      // ✅ تحويل HTML إلى PDF باستخدام printUtils الجديد
      printContent(htmlContent, {
        title: `التوزيع الزمني - ${selectedSpecialization} (بدون أسماء مؤقتين)`,
        orientation: 'landscape',
        fontSize: `${cellContentFontSize}pt`,
        asPDF: true
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Error exporting to PDF without temporary professors:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      setIsLoading(false);
    }
  };

  // دالة تصدير الجدول إلى Excel باستخدام ExcelJS
  const exportToExcel = async () => {
    try {
      setIsLoading(true);

      if (!currentYear || !currentSemester) {
        alert('الرجاء اختيار السنة الدراسية والفصل الدراسي');
        setIsLoading(false);
        return;
      }

      // تحضير بيانات الجدول بنفس طريقة PDF
      const tableData: any[][] = [];

      timeSlots.forEach((timeSlot) => {
        const rowData: any[] = [];

        days.forEach((_, dayIndex) => {
          const dayAssignments = contextAssignments.filter(
            (a: any) =>
              a.day_of_week == dayIndex &&
              a.start_time == timeSlot.start &&
              a.end_time == timeSlot.end &&
              (selectedSpecialization ? groups.find(g => g.id == a.group_id)?.specialization == selectedSpecialization : true) &&
              (selectedDepartment ? groups.find(g => g.id == a.group_id)?.department_id == selectedDepartment : true)
          );

          // إثراء البيانات بالأسماء لضمان ظهورها في Excel
          const enrichedAssignments = dayAssignments.map((a: any) => {
            const group = groups.find(g => g.id == a.group_id);
            const course = courses.find(c => c.id == a.course_id);
            const professor = professors.find(p => p.id == a.professor_id);
            const room = rooms.find(r => r.id == a.room_id);

            return {
              ...a,
              group_name: group ? group.name : (a.group_name || ''),
              course_name: course ? course.name : (a.course_name || ''),
              professor_name: professor ? professor.name : (a.professor_name || ''),
              room_name: room ? room.name : (a.room_name || ''),
            };
          });

          rowData.push(enrichedAssignments);
        });

        tableData.push(rowData);
      });

      const title = `جدول المحاضرات - ${selectedSpecialization || 'جميع التخصصات'}`;
      const subtitle = `السنة الدراسية: ${currentYear.year_name} - الفصل: ${currentSemester.semester_name}`;
      const dayNames = days.map(d => d.name);

      await exportScheduleToExcel(
        tableData,
        dayNames,
        timeSlots,
        title,
        subtitle,
        printSettingsHook
      );

      setIsLoading(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('حدث خطأ أثناء التصدير إلى Excel');
      setIsLoading(false);
    }
  };

  // دالة اختصار اسم المجموعة
  const abbrGroupName = (groupName: string) => {
    // Extraire "الفوج X" du nom complet
    const match = groupName.match(/الفوج\s*\d+/);
    if (match) {
      return match[0]; // Retourne "الفوج X"
    }
    // Si le format ne correspond pas, retourner une version abrégée
    return groupName.length > 10 ? groupName.substring(0, 10) + '...' : groupName;
  };

  // Fonction pour obtenir les spécialisations d'un département
  const getDepartmentSpecializations = (departmentId: number) => {
    if (!departmentId) return [];

    const departmentGroups = groups.filter(group =>
      group.department_id === departmentId
    );

    const uniqueSpecializations = new Set<string>();
    departmentGroups.forEach(group => {
      if (group.specialization) {
        uniqueSpecializations.add(group.specialization);
      }
    });

    return Array.from(uniqueSpecializations).sort();
  };

  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const tableWidth = pageWidth - 2 * margin;
    const cellPadding = 2;

    // Configuration pour améliorer la lisibilité
    doc.setFont('helvetica');
    doc.setFontSize(14);

    // En-tête
    doc.setFontSize(18);
    doc.text('جدول المحاضرات', pageWidth / 2, margin + 10, { align: 'center' });

    if (selectedDepartment) {
      const department = departments.find(d => d.id === selectedDepartment);
      if (department) {
        doc.setFontSize(14);
        doc.text(`القسم: ${department.name}`, margin, margin + 20);
      }
    }
    if (selectedSpecialization) {
      doc.setFontSize(14);
      doc.text(`التخصص: ${selectedSpecialization}`, margin, margin + 28);
    }

    // Information sur l'année académique et le semestre
    if (currentYear && currentSemester) {
      doc.setFontSize(12);
      doc.text(`السنة الدراسية: ${currentYear.year_name} - الفصل: ${currentSemester.semester_name}`,
        pageWidth - margin, margin + 20, { align: 'right' });
    }

    // Calculer la hauteur des cellules en fonction du contenu
    const calculateCellHeight = (content: string): number => {
      const lines = doc.splitTextToSize(content, tableWidth / 7 - 2 * cellPadding);
      return lines.length * 6 + 2 * cellPadding;
    };

    // Trouver la hauteur maximale des cellules pour chaque créneau horaire
    const maxHeights = Array(timeSlots.length).fill(0);
    const assignmentsByDay: GroupedAssignments = {};

    // Grouper les affectations par jour
    contextAssignments.forEach((assignment: Assignment) => {
      const day = days[assignment.day_of_week].name;
      if (!assignmentsByDay[day]) {
        assignmentsByDay[day] = [];
      }
      assignmentsByDay[day].push(assignment);
    });

    // Calculer la hauteur maximale pour chaque créneau horaire
    timeSlots.forEach((timeSlot, timeIndex) => {
      Object.entries(assignmentsByDay).forEach(([day, dayAssignments]) => {
        const matchingAssignments = dayAssignments.filter((a: Assignment) =>
          a.day_of_week === days.findIndex(d => d.name === day) &&
          a.start_time === timeSlot.start &&
          a.end_time === timeSlot.end
        );

        if (matchingAssignments.length > 0) {
          const combinedContent = matchingAssignments.map((a: Assignment) => {
            const professor = professors.find(p => p.id === a.professor_id);
            const course = courses.find(c => c.id === a.course_id);
            const group = groups.find(g => g.id === a.group_id);
            const room = rooms.find(r => r.id === a.room_id);

            return `${group?.name || ''}\n${course?.name || ''}\n${professor?.name || ''}\n${room?.name || ''}`;
          }).join('\n---\n');

          const height = calculateCellHeight(combinedContent);
          if (height > maxHeights[timeIndex]) {
            maxHeights[timeIndex] = height;
          }
        }
      });
    });

    // Dessiner le tableau
    let y = margin + 40; // Position de départ après l'en-tête
    const headerHeight = 10;

    // En-tête du tableau
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, tableWidth, headerHeight, 'F');
    doc.setFontSize(10);
    doc.text('الوقت / اليوم', margin + cellPadding, y + headerHeight - cellPadding);

    const daysArabic = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    const cellWidth = tableWidth / 7;

    daysArabic.forEach((day, index) => {
      doc.text(day, margin + (index + 1) * cellWidth + cellWidth / 2, y + headerHeight - cellPadding, { align: 'center' });
    });

    y += headerHeight;

    // Lignes pour chaque créneau horaire
    timeSlots.forEach((timeSlot, timeIndex) => {
      const rowHeight = Math.max(maxHeights[timeIndex], 15);

      // Dessiner la cellule de l'heure
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, cellWidth, rowHeight, 'F');
      doc.setFontSize(9);
      doc.text(`${timeSlot.start} - ${timeSlot.end}`, margin + cellWidth / 2, y + rowHeight / 2, { align: 'center' });

      // Dessiner les cellules pour chaque jour
      daysArabic.forEach((day, dayIndex) => {
        const x = margin + (dayIndex + 1) * cellWidth;
        const assignments = assignmentsByDay[day]?.filter((a: Assignment) =>
          a.day_of_week === days.findIndex(d => d.name === day) &&
          a.start_time === timeSlot.start &&
          a.end_time === timeSlot.end
        ) || [];

        // Dessiner la bordure de la cellule
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, cellWidth, rowHeight);

        if (assignments.length > 0) {
          let cellY = y + 5; // Début du texte dans la cellule

          assignments.forEach((a: Assignment, index) => {
            if (index > 0) {
              // Ajouter un séparateur entre les affectations
              doc.setDrawColor(180, 180, 180);
              doc.line(x + 2, cellY, x + cellWidth - 2, cellY);
              cellY += 3;
            }

            // Cours et groupe
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            const courseLine = `${a.course_name} (${a.group_name})`;
            const courseLineWrapped = doc.splitTextToSize(courseLine, cellWidth - 4);
            doc.text(courseLineWrapped, x + cellWidth / 2, cellY, { align: 'center' });
            cellY += courseLineWrapped.length * 5;

            // Professeur et salle
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const profLine = `${a.professor_name} (${a.room_name})`;
            const profLineWrapped = doc.splitTextToSize(profLine, cellWidth - 4);
            doc.text(profLineWrapped, x + cellWidth / 2, cellY, { align: 'center' });
            cellY += profLineWrapped.length * 4 + 2;
          });
        }
      });

      y += rowHeight;

      // Vérifier si on doit passer à une nouvelle page
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    });

    // Pied de page
    doc.setFontSize(8);
    doc.text(`تم إنشاؤه في ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - margin, { align: 'center' });

    // Sauvegarder le PDF
    doc.save(`جدول_المحاضرات_${selectedSpecialization || 'الكل'}.pdf`);
  };

  // Fonction pour nettoyer les doublons
  const cleanDuplicateAssignments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Récupérer toutes les affectations
      const allAssignments = await window.db.getAssignments();
      console.log(`Nombre total d'affectations avant nettoyage: ${allAssignments.length}`);

      // Créer un Map pour stocker les affectations uniques
      const uniqueAssignments = new Map<string, any>();
      const duplicates: { id: number, key: string }[] = [];

      // Parcourir toutes les affectations
      allAssignments.forEach(assignment => {
        // Vérifier que tous les champs nécessaires sont présents
        if (assignment.id &&
          assignment.professor_id &&
          assignment.course_id &&
          assignment.group_id &&
          assignment.room_id &&
          assignment.day_of_week &&
          assignment.start_time &&
          assignment.end_time) {
          // Créer une clé unique basée sur les champs importants
          const key = `${assignment.professor_id}-${assignment.course_id}-${assignment.group_id}-${assignment.room_id}-${assignment.day_of_week}-${assignment.start_time}-${assignment.end_time}-${assignment.academic_year || ''}-${assignment.semester || ''}`;

          if (uniqueAssignments.has(key)) {
            // Si la clé existe déjà, c'est un doublon
            duplicates.push({ id: assignment.id, key });
            console.log(`Doublon trouvé - ID: ${assignment.id}, Clé: ${key}`);
          } else {
            // Sinon, ajouter l'affectation au Map
            uniqueAssignments.set(key, assignment);
          }
        }
      });

      console.log(`Nombre d'affectations uniques: ${uniqueAssignments.size}`);
      console.log(`Nombre de doublons trouvés: ${duplicates.length}`);

      // Supprimer les doublons
      if (duplicates.length > 0) {
        // Supprimer les doublons un par un
        for (const { id, key } of duplicates) {
          if (id) {
            await window.db.deleteAssignment(id);
            console.log(`Affectation supprimée - ID: ${id}, Clé: ${key}`);
          }
        }

        // Rafraîchir les affectations
        await refreshAssignments();

        // Vérifier le nombre d'affectations après nettoyage
        const remainingAssignments = await window.db.getAssignments();
        console.log(`Nombre d'affectations après nettoyage: ${remainingAssignments.length}`);

        alert(`تم حذف ${duplicates.length} تكليف مكرر بنجاح\nعدد التكاليف المتبقية: ${remainingAssignments.length}`);
      } else {
        alert('لم يتم العثور على تكاليف مكررة');
      }
    } catch (error) {
      console.error('خطأ في تنظيف التكاليف المكررة:', error);
      setError(error instanceof Error ? error : new Error('خطأ غير معروف'));
    } finally {
      setIsLoading(false);
    }
  };

  // Compute professors assigned for the selected specialization/day/time slot
  const filteredAssignedProfessors = useMemo(() => {
    try {
      if (!selectedSpecialization || selectedDayId == null || selectedTimeSlotId == null) return [] as Professor[];
      const slot = timeSlots.find(ts => ts.id === selectedTimeSlotId);
      if (!slot) return [] as Professor[];

      // Groups matching selected specialization
      const specGroupIds = new Set(
        groups
          .filter(g => (g.specialization || '') === selectedSpecialization)
          .map(g => g.id)
      );

      const filtered = contextAssignments.filter(a =>
        (a.academic_year === currentYear?.year_name || !a.academic_year) &&
        (a.semester === currentSemester?.semester_name || !a.semester) &&
        specGroupIds.has(a.group_id) &&
        a.day_of_week === selectedDayId &&
        a.start_time === slot.start &&
        a.end_time === slot.end
      );

      const profIds = Array.from(new Set(filtered.map(a => a.professor_id)));
      return profIds
        .map(pid => professors.find(p => p.id === pid))
        .filter((p): p is Professor => Boolean(p));
    } catch {
      return [] as Professor[];
    }
  }, [contextAssignments, selectedSpecialization, selectedDayId, selectedTimeSlotId, currentYear, currentSemester, groups, professors]);

  // Sandbox Save/Load Handlers
  const handleSaveDraft = async () => {
    try {
      setIsLoading(true);
      await saveDraft(draftName || `مسودة ${new Date().toLocaleString('ar-EG')}`);
      setIsSaveDraftModalOpen(false);
      setDraftName('');
      alert('تم حفظ المسودة بنجاح');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('حدث خطأ أثناء حفظ المسودة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLoadDraftModal = async () => {
    try {
      setIsLoading(true);
      const drafts = await listDrafts();
      setSavedDrafts(drafts);
      setIsLoadDraftModalOpen(true);
    } catch (error) {
      console.error('Error listing drafts:', error);
      alert('حدث خطأ أثناء تحميل قائمة المسودات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDraft = async (id: number) => {
    try {
      setIsLoading(true);
      await loadDraft(id);
      setIsLoadDraftModalOpen(false);
      alert('تم تحميل المسودة بنجاح');
    } catch (error) {
      console.error('Error loading draft:', error);
      alert('حدث خطأ أثناء تحميل المسودة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDraft = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المسودة؟')) return;
    try {
      setIsLoading(true);
      await deleteDraft(id);
      // Refresh list
      const drafts = await listDrafts();
      setSavedDrafts(drafts);
    } catch (error) {
      console.error('Error deleting draft:', error);
      alert('حدث خطأ أثناء حذف المسودة');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      {/* Sandbox Mode Banner */}
      {isSandboxMode && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 mr-3">
                <h3 className="text-lg leading-6 font-medium text-yellow-800">وضع التجربة (Sandbox Mode)</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>أنت الآن في وضع التجربة. يمكنك إجراء تغييرات دون التأثير على الجدول الفعلي.</p>
                </div>
              </div>
            </div>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => setIsSaveDraftModalOpen(true)}
                className="px-4 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700"
              >
                حفظ مسودة
              </button>
              <button
                onClick={handleOpenLoadDraftModal}
                className="px-4 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700"
              >
                تحميل مسودة
              </button>
              <button
                onClick={commitChanges}
                disabled={!hasChanges}
                className={`px-4 py-2 rounded-md text-white font-medium ${hasChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                تطبيق التغييرات
              </button>
              <button
                onClick={undo}
                disabled={!canUndo}
                className={`px-3 py-2 rounded-md font-medium flex items-center ${canUndo ? 'text-gray-700 bg-white hover:bg-gray-50' : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}
                title="تراجع (Ctrl+Z)"
              >
                <span className="ml-1">↩️</span> تراجع
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={`px-3 py-2 rounded-md font-medium flex items-center ${canRedo ? 'text-gray-700 bg-white hover:bg-gray-50' : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}
                title="إعادة (Ctrl+Y)"
              >
                <span className="ml-1">↪️</span> إعادة
              </button>
              <button
                onClick={discardChanges}
                className="px-4 py-2 rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 font-medium"
              >
                إلغاء التغييرات
              </button>
              <button
                onClick={exitSandboxMode}
                className="px-4 py-2 rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium"
              >
                خروج
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">جدول المحاضرات</h1>

        <div className="flex space-x-2">
          {!isSandboxMode && (
            <button
              onClick={enterSandboxMode}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center"
            >
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              وضع التجربة
            </button>
          )}
          {/* Bouton de nettoyage des doublons */}
          <button
            onClick={() => cleanDuplicateAssignments()}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
            disabled={isLoading}
          >
            {isLoading ? 'جاري التنظيف...' : 'تنظيف التكاليف المكررة'}
          </button>

          {/* Boutons existants */}
          <button
            onClick={() => exportToPDF()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
            disabled={isLoading}
          >
            تصدير PDF
          </button>

          <button
            onClick={() => exportToExcel()}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
            disabled={isLoading}
          >
            تصدير Excel
          </button>

          <button
            onClick={() => exportToPDFWithoutTemporaryProfessors()}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md"
            disabled={isLoading}
          >
            تصدير PDF بدون أسماء مؤقتين
          </button>

          <button
            onClick={() => setIsAIAssistantOpen(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md flex items-center space-x-2"
            disabled={isLoading}
          >
            <span>🤖</span>
            <span>مساعد الذكاء الاصطناعي</span>
          </button>
        </div>
      </div>

      {/* بطاقة معلومات السداسي والسنة الجامعية والتخصص */}
      <div className="bg-white p-4 mb-6 rounded-lg shadow">
        <div className="text-center mb-4">
          <h2 className="text-lg font-semibold">
            السنة الجامعية: <span className="text-indigo-600">{currentYear?.year_name || 'غير محدد'}</span> |
            الفصل: <span className="text-indigo-600">{currentSemester?.semester_name || 'غير محدد'}</span>
          </h2>
          <p className="text-sm text-gray-500">
            يمكنك تحديد السنة الجامعية والفصل من صفحة الإعدادات
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* اختيار القسم */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">القسم</label>
            <select
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedDepartment}
              onChange={(e) => {
                const deptId = Number(e.target.value);
                setSelectedDepartment(deptId);
                setSelectedSpecialization('');
              }}
            >
              <option value={0}>-- اختر القسم --</option>
              {departments.map((dept) => (
                <option key={`dept-${dept.id}`} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* اختيار التخصص */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">التخصص</label>
            <select
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              disabled={!selectedDepartment}
            >
              <option value="">-- اختر التخصص --</option>
              {getDepartmentSpecializations(selectedDepartment).map((spec, index) => (
                <option key={`spec-${index}`} value={spec}>{spec}</option>
              ))}
            </select>
          </div>
        </div>

        {/* عرض المعلومات المختارة */}
        <div className="mt-4 p-3 bg-gray-50 rounded text-center">
          <h2 className="text-lg font-semibold">
            جدول محاضرات {selectedSpecialization || 'جميع التخصصات'} | {getSelectedSemesterName()} | السنة الجامعية {currentYear?.year_name || 'غير محدد'}
          </h2>
        </div>
      </div>

      {
        error && (
          <DatabaseErrorAlert error={error} onRetry={() => fetchData()} />
        )
      }

      {
        isLoading ? (
          <div className="text-center py-4">جاري التحميل...</div>
        ) : (
          <div>
            {/* Filters for day and time slot with assigned professors list */}
            <div className="mb-4 bg-white p-4 rounded-lg shadow">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اليوم</label>
                  <select
                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={selectedDayId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedDayId(v === '' ? null : Number(v));
                    }}
                  >
                    <option value="">اختر اليوم</option>
                    {days.map(d => (
                      <option key={`day-${d.id}`} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدة الزمنية</label>
                  <select
                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={selectedTimeSlotId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedTimeSlotId(v === '' ? null : Number(v));
                    }}
                  >
                    <option value="">اختر المدة</option>
                    {timeSlots.map(ts => (
                      <option key={`slot-${ts.id}`} value={ts.id}>{ts.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الأساتذة المعيّنون</label>
                  <div className="text-sm">
                    {(selectedDayId == null || selectedTimeSlotId == null) ? (
                      <span className="text-gray-500">اختر اليوم والمدة الزمنية لعرض الأساتذة</span>
                    ) : (
                      filteredAssignedProfessors.length > 0 ? (
                        <ul className="list-disc pl-5">
                          {filteredAssignedProfessors.map(p => (
                            <li key={`prof-${p.id}`}>{p.name}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-red-600">لا يوجد أساتذة معيّنون لهذا التخصص في هذا التوقيت</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* إعدادات تصميم الجدول */}
            <div className="mb-4 bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3">إعدادات تصميم الجدول</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* لون خلفية الخلايا المملوءة */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">لون خلفية الخلايا المملوءة</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={scheduleStyle.filledCellColor}
                      onChange={(e) => setScheduleStyle({ ...scheduleStyle, filledCellColor: e.target.value })}
                      className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={scheduleStyle.filledCellColor}
                      onChange={(e) => setScheduleStyle({ ...scheduleStyle, filledCellColor: e.target.value })}
                      className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="#dbeafe"
                    />
                  </div>
                </div>

                {/* حدود سميكة بين الفترات الزمنية */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">حدود سميكة بين الفترات الزمنية</label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={scheduleStyle.showThickTimeBorders}
                      onChange={(e) => setScheduleStyle({ ...scheduleStyle, showThickTimeBorders: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">تفعيل الحدود السميكة</span>
                  </div>
                </div>

                {/* حدود مزدوجة بين أعمدة الأيام */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">حدود مزدوجة بين أعمدة الأيام</label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={scheduleStyle.showDoubleDayBorders}
                      onChange={(e) => setScheduleStyle({ ...scheduleStyle, showDoubleDayBorders: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">تفعيل الحدود المزدوجة</span>
                  </div>
                </div>
              </div>

              {/* أزرار إعادة تعيين */}
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => setScheduleStyle({
                    filledCellColor: '#dbeafe',
                    showThickTimeBorders: false,
                    showDoubleDayBorders: false
                  })}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md"
                >
                  إعادة تعيين الإعدادات
                </button>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="overflow-x-auto">
                <table id="schedule-table" className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-100 w-20">الوقت / اليوم</th>
                      {daysOfWeek.map((day, index) => (
                        <th key={index} className="border p-2 bg-gray-100">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot, timeIndex) => (
                      <tr key={timeIndex}>
                        <td className="border p-2 bg-gray-50 text-center">
                          {slot.start} - {slot.end}
                        </td>
                        {daysOfWeek.map((_, dayIndex) => (
                          <td key={dayIndex} className="border p-0 align-top h-24">
                            {renderCell(dayIndex, timeIndex)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DragOverlay>
                {activeId && activeAssignment ? (
                  <div className="bg-blue-100 p-2 rounded shadow-lg border border-blue-300 opacity-90 w-40 h-20 overflow-hidden text-xs">
                    <div className="font-bold">{groups.find(g => g.id === activeAssignment.group_id)?.name}</div>
                    <div>{courses.find(c => c.id === activeAssignment.course_id)?.name}</div>
                    <div>{professors.find(p => p.id === activeAssignment.professor_id)?.name}</div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {isCellModalOpen && selectedCell && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
                  <h2 className="text-xl font-bold mb-4">
                    {scheduleData[selectedCell.dayIndex]?.[selectedCell.timeIndex] ? 'تعديل تكليف' : 'إضافة تكليف جديد'}
                  </h2>

                  <div className="grid grid-cols-1 gap-4 mb-4">
                    {/* المجموعة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">المجموعة</label>
                      <select
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={selectedCell.group_id}
                        onChange={(e) => setSelectedCell({ ...selectedCell, group_id: parseInt(e.target.value) })}
                      >
                        <option value={0}>اختر المجموعة</option>
                        {filteredGroupsBySpecialization.map(group => (
                          <option key={`group-${group.id}`} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* بحث المادة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">المادة</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="اكتب اسم المادة للبحث..."
                          value={courseSearchTerm}
                          onChange={handleCourseSearch}
                          onFocus={() => courseSearchTerm && setIsCourseDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setIsCourseDropdownOpen(false);
                            }
                          }}
                        />
                        {isCourseDropdownOpen && filteredCoursesSearch.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredCoursesSearch.map((course, index) => (
                              <div
                                key={`course-${course.id}`}
                                id={`schedule-course-${course.id}-${index}`}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${courseNavigation.selectedIndex === index ? 'bg-blue-100' : ''
                                  }`}
                                onClick={() => handleCourseSelect(course.id)}
                                onMouseEnter={() => courseNavigation.setSelectedIndex(index)}
                              >
                                {course.name} {course.code && `(${course.code})`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedCell.course_id > 0 && (
                        <div className="mt-1 text-sm text-indigo-600">
                          المقرر المحدد: {courses.find(c => c.id === selectedCell.course_id)?.name || 'غير محدد'}
                        </div>
                      )}
                    </div>

                    {/* بحث الأستاذ */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الأستاذ</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="اكتب اسم الأستاذ للبحث..."
                          value={professorSearchTerm}
                          onChange={handleProfessorSearch}
                          onFocus={() => professorSearchTerm && setIsProfessorDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setIsProfessorDropdownOpen(false);
                            }
                          }}
                        />
                        {isProfessorDropdownOpen && filteredProfessors.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredProfessors.map((professor, index) => (
                              <div
                                key={`professor-${professor.id}`}
                                id={`schedule-professor-${professor.id}-${index}`}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${professorNavigation.selectedIndex === index ? 'bg-blue-100' : ''
                                  } ${isProfessorTemporary(professor) ? 'text-red-600' : ''}`}
                                onClick={() => handleProfessorSelect(professor.id)}
                                onMouseEnter={() => professorNavigation.setSelectedIndex(index)}
                              >
                                {professor.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedCell.professor_id > 0 && (
                        <div className="mt-1 text-sm text-indigo-600">
                          الأستاذ المحدد: {professors.find(p => p.id === selectedCell.professor_id)?.name || 'غير محدد'}
                        </div>
                      )}
                    </div>

                    {/* بحث القاعة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">القاعة</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="اكتب اسم القاعة للبحث..."
                          value={roomSearchTerm}
                          onChange={handleRoomSearch}
                          onFocus={() => roomSearchTerm && setIsRoomDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setIsRoomDropdownOpen(false);
                            }
                          }}
                        />
                        {isRoomDropdownOpen && filteredRooms.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredRooms.map((room, index) => (
                              <div
                                key={`room-${room.id}`}
                                id={`schedule-room-${room.id}-${index}`}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${roomNavigation.selectedIndex === index ? 'bg-blue-100' : ''
                                  }`}
                                onClick={() => handleRoomSelect(room.id)}
                                onMouseEnter={() => roomNavigation.setSelectedIndex(index)}
                              >
                                {room.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedCell.room_id > 0 && (
                        <div className="mt-1 text-sm text-indigo-600">
                          القاعة المحددة: {rooms.find(r => r.id === selectedCell.room_id)?.name || 'غير محدد'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <button
                      className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 ml-2"
                      onClick={() => setIsCellModalOpen(false)}
                    >
                      إلغاء
                    </button>
                    <button
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      onClick={() => {
                        handleSaveCell(selectedCell.dayIndex, selectedCell.timeIndex, selectedCell);
                        setIsCellModalOpen(false);
                      }}
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }

      {/* AI Assistant Modal */}
      <AIAssistant
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        assignments={contextAssignments}
        professors={professors}
        courses={courses}
        groups={groups}
        rooms={rooms}
      />
      {/* Save Draft Modal */}
      {
        isSaveDraftModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96">
              <h3 className="text-lg font-bold mb-4">حفظ مسودة التجربة</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المسودة</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="أدخل اسمًا للمسودة (اختياري)"
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div className="flex justify-end space-x-2 space-x-reverse">
                <button
                  onClick={() => setIsSaveDraftModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Load Draft Modal */}
      {
        isLoadDraftModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">تحميل مسودة سابقة</h3>
              {savedDrafts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">لا توجد مسودات محفوظة</p>
              ) : (
                <div className="space-y-2">
                  {savedDrafts.map((draft) => (
                    <div key={draft.id} className="border rounded-md p-3 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <div className="font-medium">{draft.name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(draft.created_at).toLocaleString('ar-EG')}
                        </div>
                      </div>
                      <div className="flex space-x-2 space-x-reverse">
                        <button
                          onClick={() => handleLoadDraft(draft.id)}
                          className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm"
                        >
                          تحميل
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setIsLoadDraftModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
