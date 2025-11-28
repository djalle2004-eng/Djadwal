import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import * as XLSX from 'xlsx';
import { AcademicYearContext } from '../context/AcademicYearContext';
import { useAssignments } from '../context/AssignmentContext';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { 
  printContent, 
  generateStyledTable, 
  generateFullDocument 
} from '../utils/printUtils';

// Import MUI DataGrid instead of AG Grid
import { DataGrid, GridColDef, GridRenderCellParams, GridPaginationModel } from '@mui/x-data-grid';

// No need for module registration with MUI DataGrid

interface FetchedData {
  id: number;
  [key: string]: any;
}

interface FetchedAssignment extends FetchedData {
  course_id: number;
  professor_id: number;
  group_id: number;
  room_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year: string;
  semester: string;
}

interface FetchedProfessor extends FetchedData {
  name: string;
  email: string;
}

interface FetchedCourse extends FetchedData {
  name: string;
  code: string;
}

interface FetchedRoom extends FetchedData {
  name: string;
  capacity?: number;
}

interface AssignmentWithDetails extends FetchedAssignment {
  professor_name: string;
  course_name: string;
  group_name: string;
  room_name: string;
  day_name?: string;
  [key: string]: any;
}

interface Assignment {
  id?: number;
  professor_id: number;
  course_id: number;
  group_id: number;
  room_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year?: string;
  semester?: string;
  group_specialization?: string;
  department_id?: number;
}

const LECTURE_TIMES = [
  { start: '08:00', end: '09:30' },
  { start: '09:30', end: '11:00' },
  { start: '11:00', end: '12:30' },
  { start: '12:30', end: '14:00' },
  { start: '14:00', end: '15:30' },
  { start: '15:30', end: '17:00' }
];

const DAYS_OF_WEEK = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' },
  { id: 6, name: 'الجمعة' }
];

// Custom action renderer for the DataGrid
const ActionsRenderer = ({ row }: GridRenderCellParams<AssignmentWithDetails>) => {
  const { can } = usePermissions();
  const assignment = row as AssignmentWithDetails;
  
  // Use the parent component's functions through props
  const handleEditClick = () => {
    // Find the parent component's openEditForm function through the global window object
    if (window.courseAssignmentsComponent && typeof window.courseAssignmentsComponent.openEditForm === 'function') {
      window.courseAssignmentsComponent.openEditForm(assignment);
    } else {
      console.log('Edit assignment:', assignment);
    }
  };
  
  const handleDeleteClick = () => {
    // Find the parent component's confirmDeleteAssignment function through the global window object
    if (window.courseAssignmentsComponent && typeof window.courseAssignmentsComponent.confirmDeleteAssignment === 'function') {
      window.courseAssignmentsComponent.confirmDeleteAssignment(assignment.id);
    } else {
      console.log('Delete assignment:', assignment.id);
    }
  };
  
  return (
    <div className="flex space-x-2">
      {can('update', 'sessions') && (
        <button
          onClick={handleEditClick}
          className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded"
        >
          تعديل
        </button>
      )}
      {can('delete', 'sessions') && (
        <button
          onClick={handleDeleteClick}
          className="bg-red-500 hover:bg-red-600 text-white p-1 rounded"
        >
          حذف
        </button>
      )}
      {!can('update', 'sessions') && !can('delete', 'sessions') && (
        <span className="text-gray-400 text-xs">عرض فقط</span>
      )}
    </div>
  );
};

// Declare global window interface
declare global {
  interface Window {
    courseAssignmentsComponent?: {
      openEditForm: (assignment: AssignmentWithDetails) => void;
      confirmDeleteAssignment: (id: number) => void;
    };
    electronAPI?: {
      onTriggerSearch: (callback: () => void) => void;
      removeTriggerSearchListener: (callback: () => void) => void;
    };
  }
}

// Fonction d'exportation Excel avec filtrage des doublons (déplacée à l'extérieur du composant)
const exportToExcel = (assignmentsData: any[]) => {
  console.log(`Nombre total d'affectations avant filtrage: ${assignmentsData.length}`);
  
  // Étape 1: Filtrer les doublons en utilisant une combinaison unique de critères
  const uniqueKeys = new Set<string>();
  const filteredAssignments = assignmentsData.filter(item => {
    // Créer une clé unique basée sur plusieurs champs
    const uniqueKey = `${item.professor_id}-${item.course_id}-${item.group_id}-${item.room_id}-${item.day_of_week}-${item.start_time}-${item.end_time}`;
    
    // Si cette clé existe déjà, c'est un doublon
    if (uniqueKeys.has(uniqueKey)) {
      return false;
    }
    
    // Sinon, ajouter la clé et garder l'affectation
    uniqueKeys.add(uniqueKey);
    return true;
  });
  
  console.log(`Nombre d'affectations après filtrage des doublons: ${filteredAssignments.length}`);
  
  // Étape 2: Préparer les données pour Excel
  const workbookData = filteredAssignments.map(assignment => {
    // Conversion du numéro du jour en nom du jour si nécessaire
    const dayName = assignment.day_name || DAYS_OF_WEEK.find(d => d.id === assignment.day_of_week)?.name || '';
    
    return {
      'الأستاذ': assignment.professor_name,
      'المادة': assignment.course_name,
      'المجموعة': assignment.group_name,
      'القاعة': assignment.room_name,
      'اليوم': dayName,
      'التوقيت': `${assignment.start_time} - ${assignment.end_time}`,
      'السنة الدراسية': assignment.academic_year || '',
      'الفصل': assignment.semester || '',
      'التخصص': assignment.group_specialization || '',
    };
  });
  
  // Étape 3: Création du classeur Excel
  const worksheet = XLSX.utils.json_to_sheet(workbookData);
  
  // Configurer la largeur des colonnes
  const columnWidths = [
    { wch: 20 }, // الأستاذ
    { wch: 25 }, // المادة
    { wch: 15 }, // المجموعة
    { wch: 15 }, // القاعة
    { wch: 10 }, // اليوم
    { wch: 15 }, // التوقيت
    { wch: 15 }, // السنة الدراسية
    { wch: 10 }, // الفصل
    { wch: 20 }, // التخصص
  ];
  worksheet['!cols'] = columnWidths;
  
  // Créer un classeur et y ajouter la feuille
  const workbook = XLSX.utils.book_new();
  
  // Configurer le classeur pour l'arabe (droite à gauche)
  workbook.Workbook = {
    Views: [{ RTL: true }]
  };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة الحصص');
  
  // Obtenir le nom du fichier avec date
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
  const filename = `جدول_الحصص_${dateStr}.xlsx`;
  
  // Enregistrer le fichier
  XLSX.writeFile(workbook, filename);
  console.log(`تم تصدير الملف: ${filename}`);
};

const CourseAssignments: React.FC = () => {
  const { can } = usePermissions();
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [professors, setProfessors] = useState<FetchedProfessor[]>([]);
  const [courses, setCourses] = useState<FetchedCourse[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [rooms, setRooms] = useState<FetchedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<any[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<AssignmentWithDetails[]>([]);
  const [selectedProfessor, setSelectedProfessor] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<number>(0);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<number>(0);
  
  const academicYearContext = useContext(AcademicYearContext);
  const currentYear = academicYearContext?.currentYear || null;
  const currentSemester = academicYearContext?.currentSemester || null;
  
  // Initialize form data with current academic year and semester
  const [formData, setFormData] = useState<Assignment>({
    professor_id: 0,
    course_id: 0,
    group_id: 0,
    room_id: 0,
    day_of_week: 0,
    start_time: '',
    end_time: '',
    academic_year: currentYear?.year_name || '',
    semester: currentSemester?.semester_name || '',
    group_specialization: '',
    department_id: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithDetails | null>(null);
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [filteredCourses, setFilteredCourses] = useState<FetchedCourse[]>([]);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    pageSize: 5,
    page: 0,
  });
  const [conflictCheckResult, setConflictCheckResult] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { getAssignments, addAssignment, updateAssignment, deleteAssignment } = useAssignments();

  // Memoize the fetchData function to prevent unnecessary re-renders
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all necessary data in parallel
      const [professorsData, coursesData, groupsData, roomsData, departmentsData] = await Promise.all([
        window.db.getProfessors(),
        window.db.getCourses(),
        window.db.getGroups(),
        window.db.getRooms(),
        window.db.getDepartments()
      ]);
      
      setProfessors(professorsData);
      setCourses(coursesData);
      setGroups(groupsData);
      setRooms(roomsData);
      setDepartments(departmentsData);

      // Get the current academic year and semester from context
      const yearName = currentYear ? currentYear.year_name : null;
      const semesterName = currentSemester ? currentSemester.semester_name : null;
      
      console.log('CourseAssignments - Current context values:', {
        currentYear: currentYear,
        currentSemester: currentSemester,
        yearName,
        semesterName
      });
      
      if (!yearName || !semesterName) {
        console.warn('No active academic year or semester selected');
        // You might want to show a message to the user here
      }
      
      // Use the current academic year and semester for fetching assignments
      // استدعاء قاعدة البيانات مباشرة للتأكد من الفلترة
      const assignmentsData = await window.db.getAssignments(yearName, semesterName);
      
      console.log('CourseAssignments - Fetching assignments with filters:', {
        yearName,
        semesterName,
        totalAssignments: assignmentsData.length,
        sampleAssignment: assignmentsData.length > 0 ? {
          academic_year: assignmentsData[0].academic_year,
          semester: assignmentsData[0].semester
        } : null
      });
      
      // Debug: Log a sample assignment to see its structure
      if (assignmentsData.length > 0) {
        console.log('Sample assignment structure:', assignmentsData[0]);
      }
      
      // Process assignments to include names instead of just IDs
      const assignmentsWithDetails = assignmentsData.map((assignment: any) => {
        const professor = professorsData.find((p: any) => p.id === assignment.professor_id);
        const course = coursesData.find((c: any) => c.id === assignment.course_id);
        const group = groupsData.find((g: any) => g.id === assignment.group_id);
        const room = roomsData.find((r: any) => r.id === assignment.room_id);
        const day = DAYS_OF_WEEK.find(d => d.id === assignment.day_of_week);
        
        return {
          ...assignment,
          professor_name: professor ? professor.name : 'غير معروف',
          course_name: course ? `${course.name} (${course.code})` : 'غير معروف',
          group_name: group ? group.name : 'غير معروف',
          room_name: room ? room.name : 'غير معروف',
          day_name: day ? day.name : 'غير معروف',
          time: `${assignment.start_time} - ${assignment.end_time}`
        } as AssignmentWithDetails;
      });
      
      setAssignments(assignmentsWithDetails);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('حدث خطأ أثناء جلب البيانات');
      }
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentSemester, getAssignments]);

  // Use a ref to track if we've already done the initial fetch
  const initialFetchDone = useRef(false);

  // Only fetch data when the component mounts or when academic year/semester changes
  useEffect(() => {
    // Skip if we've already fetched data and nothing has changed
    if (initialFetchDone.current && 
        assignments.length > 0 && 
        !assignments.some(a => 
          a.academic_year !== (currentYear?.year_name || '') || 
          a.semester !== (currentSemester?.semester_name || '')
        )) {
      return;
    }

    fetchData();
    initialFetchDone.current = true;
  }, [currentYear, currentSemester]);

  // Set up subscription to assignment changes (add, update, delete)
  useEffect(() => {
    // Function to handle assignment changes from other components
    const handleAssignmentChange = () => {
      // Only refresh data if necessary
      fetchData();
    };

    // Subscribe to assignment changes
    window.addEventListener('assignment-changed', handleAssignmentChange);
    
    return () => {
      window.removeEventListener('assignment-changed', handleAssignmentChange);
    };
  }, [fetchData]);

  // Utility function to get unique specializations from groups
  const getUniqueSpecializations = () => {
    if (!groups || groups.length === 0) {
      return [];
    }
    
    const allSpecializations = (groups
      .map(group => group.specialization)
      .filter(spec => spec !== undefined && spec !== null && spec !== '')
    );
    
    const uniqueSpecializations = [...new Set(allSpecializations)];
    
    return uniqueSpecializations.sort((a, b) => a.localeCompare(b, 'ar'));
  };

  // Filter groups based on selected specialization and department
  useEffect(() => {
    if (formData.group_specialization) {
      // Filter groups by selected specialization
      const filtered = groups.filter(group => 
        group.specialization === formData.group_specialization && 
        group.group_type === 'group'
      );
      setFilteredGroups(filtered);
    } else if (formData.department_id) {
      // If only department is selected, show all groups in that department
      const specializations = groups.filter(group => 
        group.department_id === formData.department_id && 
        group.group_type === 'specialization'
      );
      
      const specializationIds = specializations.map(spec => spec.id);
      
      const filtered = groups.filter(group => 
        (specializationIds.includes(group.parent_group_id) && group.group_type === 'group')
      );
      
      setFilteredGroups(filtered);
    } else {
      // If nothing selected, show all groups
      setFilteredGroups(groups.filter(group => group.group_type === 'group'));
    }
  }, [formData.group_specialization, formData.department_id, groups]);

  // Get all specializations for the selected department
  const departmentSpecializations = useMemo(() => {
    if (!formData.department_id) return [];
    
    return groups.filter(group => 
      group.department_id === formData.department_id && 
      group.group_type === 'specialization'
    );
  }, [formData.department_id, groups]);

  // Get specializations for dropdown based on department selection
  const specializations = useMemo(() => {
    if (formData.department_id) {
      // If department is selected, show only specializations for that department
      return departmentSpecializations.map(spec => spec.specialization || spec.name)
        .filter(spec => spec !== undefined && spec !== null && spec !== '') as string[];
    } else {
      // Otherwise show all specializations
      return getUniqueSpecializations();
    }
  }, [formData.department_id, departmentSpecializations, groups]);

  const handleDepartmentSelect = (departmentId: number) => {
    setFormData(prev => ({
      ...prev,
      department_id: departmentId,
      group_specialization: '' // Reset specialization when department changes
    }));
  };

  const filteredProfessors = professors
    .filter(professor => {
      const professorName = professor.name.toLowerCase();
      const searchTermLower = searchTerm.toLowerCase();
      return (
        professorName.includes(searchTermLower) || 
        (professor.academic_title && professor.academic_title.toLowerCase().includes(searchTermLower))
      );
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name, 'ar');
    });

  const handleProfessorSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
  };

  const handleProfessorSelect = (professorId: number) => {
    setFormData({ ...formData, professor_id: professorId });
    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  const handleCourseSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCourseSearchTerm(e.target.value);
    setIsCourseDropdownOpen(true);
    setFilteredCourses(courses.filter(course => 
      course.name.toLowerCase().includes(e.target.value.toLowerCase()) ||
      course.code.toLowerCase().includes(e.target.value.toLowerCase())
    ));
  };

  const handleCourseSelect = (course: FetchedCourse) => {
    setFormData({ ...formData, course_id: course.id });
    setCourseSearchTerm('');
    setIsCourseDropdownOpen(false);
  };

  const handleGroupSelect = (groupId: number) => {
    setFormData({ ...formData, group_id: groupId });
  };

  const handleRoomSelect = (roomId: number) => {
    setFormData({ ...formData, room_id: roomId });
  };

  const handleDaySelect = (dayId: number) => {
    setFormData({ ...formData, day_of_week: dayId });
  };

  const handleTimeSelect = (startTime: string, endTime: string) => {
    setFormData({ ...formData, start_time: startTime, end_time: endTime });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      if (editingAssignment) {
        // Update existing assignment
        await updateAssignment(editingAssignment.id, {
          professor_id: formData.professor_id,
          course_id: formData.course_id,
          group_id: formData.group_id,
          room_id: formData.room_id,
          day_of_week: formData.day_of_week,
          start_time: formData.start_time,
          end_time: formData.end_time,
          academic_year: currentYear?.year_name || '',
          semester: currentSemester?.semester_name || ''
        });
      } else {
        // Add new assignment
        await addAssignment({
          professor_id: formData.professor_id,
          course_id: formData.course_id,
          group_id: formData.group_id,
          room_id: formData.room_id,
          day_of_week: formData.day_of_week,
          start_time: formData.start_time,
          end_time: formData.end_time,
          academic_year: currentYear?.year_name || '',
          semester: currentSemester?.semester_name || ''
        });
      }
      
      // Reset form
      setFormData({
        professor_id: 0,
        course_id: 0,
        group_id: 0,
        room_id: 0,
        day_of_week: 0,
        start_time: '',
        end_time: '',
        department_id: 0,
        group_specialization: ''
      });
      
      setIsModalOpen(false);
      setEditingAssignment(null);
      await fetchData();
    } catch (error) {
      console.error('فشل إضافة/تعديل التكليف:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('خطأ غير معروف');
      }
    } finally {
      setLoading(false);
    }
  };

  const openEditForm = (assignment: AssignmentWithDetails) => {
    setFormData({
      professor_id: assignment.professor_id,
      course_id: assignment.course_id,
      group_id: assignment.group_id,
      room_id: assignment.room_id,
      day_of_week: assignment.day_of_week,
      start_time: assignment.start_time,
      end_time: assignment.end_time,
      department_id: 0, // Will need to be set based on the group
      group_specialization: ''
    });
    setEditingAssignment(assignment);
    setIsModalOpen(true);
  };

  const confirmDeleteAssignment = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التكليف؟')) {
      setLoading(true);
      try {
        await deleteAssignment(id);
        await fetchData();
      } catch (error) {
        console.error('فشل حذف التكليف:', error);
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('خطأ غير معروف');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const validateForm = () => {
    let isValid = true;
    
    if (!formData.professor_id || !formData.course_id || !formData.group_id || !formData.room_id || !formData.day_of_week || !formData.start_time || !formData.end_time) {
      setError('جميع الحقول مطلوبة');
      isValid = false;
    }
    
    return isValid;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Récupérer l'année et le semestre courants depuis le contexte
    const currentYearName = currentYear?.year_name;
    const currentSemesterName = currentSemester?.semester_name;

    if (!currentYearName || !currentSemesterName) {
      setError("Veuillez sélectionner une année académique et un semestre avant d'importer.");
      // Reset file input
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setLoading(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
        console.log('بيانات الاستيراد:', jsonData);

        // Validation initiale des données (peut être améliorée)
        for (const row of jsonData) {
          if (!row.professor_id || !row.course_id || !row.group_id || !row.room_id ||
              row.day_of_week === undefined || !row.start_time || !row.end_time) {
            // Optionnel: logger quelle ligne pose problème
            console.error('Ligne invalide dans le fichier Excel:', row);
            throw new Error('البيانات غير صالحة. تأكد من أن جميع الحقول المطلوبة موجودة في chaque ligne.');
          }
        }

        let successful = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const row of jsonData) {
          try {
            // Construction des données de l'affectation AVEC année et semestre
            const assignmentData: Assignment = {
              professor_id: Number(row.professor_id),
              course_id: Number(row.course_id),
              group_id: Number(row.group_id),
              room_id: Number(row.room_id),
              day_of_week: Number(row.day_of_week),
              start_time: row.start_time.toString(),
              end_time: row.end_time.toString(),
              academic_year: currentYearName, // Ajouté
              semester: currentSemesterName,  // Ajouté
              // Assurez-vous que les autres champs optionnels sont gérés si nécessaire
              group_specialization: row.group_specialization || '',
              department_id: row.department_id ? Number(row.department_id) : undefined,
            };

            // Valider que les IDs existent (prof, cours, groupe, salle)
            if (!professors.some(p => p.id === assignmentData.professor_id)) throw new Error(`Professeur ID ${assignmentData.professor_id} non trouvé.`);
            if (!courses.some(c => c.id === assignmentData.course_id)) throw new Error(`Cours ID ${assignmentData.course_id} non trouvé.`);
            if (!groups.some(g => g.id === assignmentData.group_id)) throw new Error(`Groupe ID ${assignmentData.group_id} non trouvé.`);
            if (!rooms.some(r => r.id === assignmentData.room_id)) throw new Error(`Salle ID ${assignmentData.room_id} non trouvé.`);


            // Utiliser la fonction addAssignment du contexte
            await addAssignment(assignmentData);
            successful++;
          } catch (error) {
            console.error('فشل استيراد صف:', error, row);
            errors.push(`Ligne ${jsonData.indexOf(row) + 2}: ${error instanceof Error ? error.message : String(error)}`);
            failed++;
          }
        }

        let message = `تم استيراد ${successful} تعيين بنجاح.`;
        if (failed > 0) {
          message += `\nفشل استيراد ${failed} تعيين.\nErreurs:\n${errors.join('\n\n')}`;
        }
        alert(message);

        // Pas besoin de fetchData() ici car le contexte AssignmentContext
        // devrait se mettre à jour automatiquement après addAssignment
        // et déclencher un re-render.

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };

      reader.onerror = (error) => {
        console.error("Erreur de lecture du fichier:", error);
        setError("Impossible de lire le fichier.");
        setLoading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('خطأ في استيراد الملف:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('خطأ غير معروف أثناء معالجة الملف.');
      }
      setLoading(false);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
    }
    // Ne mettez pas setLoading(false) ici car reader.onload est asynchrone
  };

  const columns: GridColDef[] = [
    { 
      field: 'professor_name', 
      headerName: 'الأستاذ',
      filterable: true,
      sortable: true,
      flex: 1,
      editable: true,
    },
    { 
      field: 'course_name', 
      headerName: 'المادة',
      filterable: true,
      sortable: true,
      flex: 1,
      editable: true,
    },
    { 
      field: 'group_name', 
      headerName: 'المجموعة',
      filterable: true,
      sortable: true,
      flex: 1,
      editable: true,
    },
    { 
      field: 'room_name', 
      headerName: 'القاعة',
      filterable: true,
      sortable: true,
      flex: 1,
      editable: true,
    },
    { 
      field: 'day_name', 
      headerName: 'اليوم',
      filterable: true,
      sortable: true,
      flex: 1,
      editable: true,
    },
    { 
      field: 'time', 
      headerName: 'الوقت',
      filterable: true,
      sortable: true,
      flex: 1,
      editable: true,
    },
    {
      field: 'actions',
      headerName: 'الإجراءات',
      sortable: false,
      filterable: false,
      width: 150,
      renderCell: (params: any) => (
        <ActionsRenderer {...params} />
      )
    },
  ];

  // Make the functions available globally
  useEffect(() => {
    window.courseAssignmentsComponent = {
      openEditForm,
      confirmDeleteAssignment
    };
    
    return () => {
      delete window.courseAssignmentsComponent;
    };
  }, []);

  // Keyboard navigation for professor dropdown
  const professorNavigation = useKeyboardNavigation({
    items: filteredProfessors,
    isOpen: isDropdownOpen,
    onSelect: (professor) => handleProfessorSelect(professor.id),
    onClose: () => setIsDropdownOpen(false),
    getItemId: (professor, index) => `professor-${professor.id}-${index}`
  });

  // Keyboard navigation for course dropdown
  const courseNavigation = useKeyboardNavigation({
    items: filteredCourses,
    isOpen: isCourseDropdownOpen,
    onSelect: (course) => handleCourseSelect(course),
    onClose: () => setIsCourseDropdownOpen(false),
    getItemId: (course, index) => `course-${course.id}-${index}`
  });

  // Ajouter cette fonction pour formater les données avant de les afficher
  const formatAssignmentsForDisplay = (assignments: AssignmentWithDetails[]) => {
    return assignments.map(assignment => {
      // Trouver le jour correspondant
      const day = DAYS_OF_WEEK.find(d => d.id === assignment.day_of_week);
      
      return {
        ...assignment,
        // S'assurer que le jour est correctement formaté
        day_name: day ? day.name : 'غير معروف',
        // S'assurer que le créneau horaire est correctement formaté
        time: assignment.start_time && assignment.end_time ? 
          `${assignment.start_time} - ${assignment.end_time}` : 'غير محدد'
      };
    });
  };

  // Mettre à jour useEffect pour utiliser les filtres
  useEffect(() => {
    applyFilters();
  }, [assignments, selectedProfessor, selectedDepartment, selectedSpecialization, selectedGroup]);

  // Fonction pour obtenir les spécialisations du département sélectionné
  const getDepartmentSpecializations = (departmentId: number) => {
    if (!departmentId) return [];
    
    const departmentGroups = groups.filter(group => 
      group.department_id === departmentId && 
      group.group_type === 'specialization'
    );
    
    const uniqueSpecializations = new Set(
      departmentGroups
        .map(group => group.specialization)
        .filter(spec => spec !== undefined && spec !== null && spec !== '')
    );
    
    return Array.from(uniqueSpecializations).sort((a, b) => a.localeCompare(b, 'ar'));
  };

  // Ajouter cette fonction pour gérer les filtres
  const applyFilters = () => {
    // استخدام التكليفات المفلترة حسب السنة الأكاديمية والفصل الدراسي
    let filtered = [...assignments];

    if (selectedProfessor) {
      filtered = filtered.filter(assignment => 
        assignment.professor_name.toLowerCase().includes(selectedProfessor.toLowerCase())
      );
    }

    if (selectedDepartment) {
      // Get all groups (both specializations and regular groups) for the department
      const departmentGroups = groups.filter(g => g.department_id === selectedDepartment);
      const departmentGroupIds = departmentGroups.map(g => g.id);
      
      // Also include groups that belong to specializations of this department
      const specializationIds = departmentGroups
        .filter(g => g.group_type === 'specialization')
        .map(g => g.id);
      
      const groupsInSpecializations = groups.filter(g => 
        specializationIds.includes(g.parent_group_id) && g.group_type === 'group'
      );
      
      const allRelevantGroupIds = [...departmentGroupIds, ...groupsInSpecializations.map(g => g.id)];
      
      filtered = filtered.filter(assignment => 
        allRelevantGroupIds.includes(assignment.group_id)
      );
    }

    if (selectedSpecialization) {
      filtered = filtered.filter(assignment => {
        const group = groups.find(g => g.id === assignment.group_id);
        if (!group) return false;
        
        // Check if the group itself has the specialization
        if (group.specialization === selectedSpecialization) {
          return true;
        }
        
        // Check if the group belongs to a specialization parent with this name
        if (group.parent_group_id) {
          const parentGroup = groups.find(g => g.id === group.parent_group_id);
          return parentGroup?.specialization === selectedSpecialization || parentGroup?.name === selectedSpecialization;
        }
        
        return false;
      });
    }

    if (selectedGroup) {
      filtered = filtered.filter(assignment => assignment.group_id === selectedGroup);
    }

    const formattedFiltered = formatAssignmentsForDisplay(filtered);
    setFilteredAssignments(formattedFiltered);
  };

  const handleProfessorFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedProfessor(event.target.value);
  };

  const handleDepartmentFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const departmentId = Number(event.target.value);
    setSelectedDepartment(departmentId);
    setSelectedSpecialization(''); // Réinitialiser la spécialisation lors du changement de département
  };

  const handleSpecializationFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSpecialization(event.target.value);
  };

  const handleGroupFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroup(Number(event.target.value));
  };

  const clearFilters = () => {
    setSelectedProfessor('');
    setSelectedDepartment(0);
    setSelectedSpecialization('');
    setSelectedGroup(0);
  };

  // ==============================================
  // FUNCTION TO DETECT SCHEDULING CONFLICTS
  // ==============================================
  const detectConflicts = (assignmentsToCheck: AssignmentWithDetails[]) => {
    console.log("Début de la détection des conflits pour", assignmentsToCheck.length, "affectations.");
    setLoading(true); // Show loading indicator
    setConflictCheckResult(null); // Reset previous results

    const conflicts: any[] = [];
    let remoteRoomId: number | null = null;
    let unassignedProfessorId: number | null = null;

    // Find the ID of the "remote" room ("عن بعد")
    const remoteRoom = rooms.find(room => room.name === 'عن بعد');
    if (remoteRoom) {
      remoteRoomId = remoteRoom.id;
      console.log(`Salle distante identifiée: ID ${remoteRoomId}`);
    } else {
      console.warn("La salle 'عن بعد' n'a pas été trouvée. La détection des conflits pour cette salle pourrait être imprécise.");
    }

    // Find the ID of the "unassigned" professor ("غير معين")
    const unassignedProfessor = professors.find(prof => prof.name === 'غير معين');
    if (unassignedProfessor) {
        unassignedProfessorId = unassignedProfessor.id;
        console.log(`Professeur non assigné identifié: ID ${unassignedProfessorId}`);
    } else {
        console.warn("Le professeur 'غير معين' n'a pas été trouvé. La règle d'ignorance ne sera pas appliquée.");
    }

    // Group assignments by time slot (day + start_time + end_time)
    const assignmentsByTimeSlot = new Map<string, AssignmentWithDetails[]>();

    assignmentsToCheck.forEach(assignment => {
      const timeSlotKey = `${assignment.day_of_week}-${assignment.start_time}-${assignment.end_time}`;
      if (!assignmentsByTimeSlot.has(timeSlotKey)) {
        assignmentsByTimeSlot.set(timeSlotKey, []);
      }
      assignmentsByTimeSlot.get(timeSlotKey)!.push(assignment);
    });

    console.log(`Groupement par créneau horaire: ${assignmentsByTimeSlot.size} créneaux trouvés.`);

    // Iterate through each time slot
    assignmentsByTimeSlot.forEach((slotAssignments, timeSlotKey) => {
      if (slotAssignments.length <= 1) {
        return; // No conflict possible with 0 or 1 assignment in a slot
      }

      const [dayId, startTime, endTime] = timeSlotKey.split('-');
      const dayName = DAYS_OF_WEEK.find(d => d.id === Number(dayId))?.name || `Jour ${dayId}`;
      const timeLabel = `${dayName} ${startTime}-${endTime}`;

      console.log(`Vérification du créneau: ${timeLabel} (${slotAssignments.length} affectations)`);

      const professorUsage = new Map<number, AssignmentWithDetails[]>();
      const roomUsage = new Map<number, AssignmentWithDetails[]>();

      slotAssignments.forEach(assignment => {
        // Track professor usage
        if (!professorUsage.has(assignment.professor_id)) {
          professorUsage.set(assignment.professor_id, []);
        }
        professorUsage.get(assignment.professor_id)!.push(assignment);

        // Track room usage (only for physical rooms)
        if (assignment.room_id !== remoteRoomId) {
          if (!roomUsage.has(assignment.room_id)) {
            roomUsage.set(assignment.room_id, []);
          }
          roomUsage.get(assignment.room_id)!.push(assignment);
        }
      });

      // Check Rule 1: Same professor in multiple *DIFFERENT* physical rooms
      professorUsage.forEach((profAssignments) => {
        if (profAssignments.length > 1) {
          // Skip check if this is the unassigned professor
          if (profAssignments[0].professor_id === unassignedProfessorId) {
            return; // Skip unassigned professor
          }
          
          // Filter assignments to only include those in physical rooms (exclude remote)
          const physicalAssignments = profAssignments.filter(a => a.room_id !== remoteRoomId);
          
          if (physicalAssignments.length > 1) {
            // Find all unique physical room IDs the professor is assigned to in this slot
            const uniquePhysicalRoomIds = new Set(physicalAssignments.map(a => a.room_id));
            
            // Only flag as conflict if professor is in more than one *distinct* physical room
            if (uniquePhysicalRoomIds.size > 1) {
              conflicts.push({
                type: 'professor',
                dayName,
                timeLabel,
                assignments: profAssignments
              });
            }
          }
        }
      });

      // Check Rule 2: Multiple professors in the same physical room
      roomUsage.forEach((roomAssignments) => {
        const uniqueProfessorIds = new Set(roomAssignments.map(a => a.professor_id));
        if (uniqueProfessorIds.size > 1) {
          conflicts.push({
            type: 'room',
            dayName,
            timeLabel,
            assignments: roomAssignments
          });
        }
      });
    });

    console.log("Fin de la détection des conflits.");
    setLoading(false); // Hide loading indicator

    // Display results
    if (conflicts.length === 0) {
      setConflictCheckResult("✅ Aucun conflit détecté.");
      alert("Aucun conflit détecté.");
    } else {
      const conflictMessage = `⚠️ ${conflicts.length} Conflit(s) détecté(s):\n\n${conflicts.map(conflict => {
        return `${conflict.type === 'professor' ? '👨‍🏫 صراع أستاذ' : '🏫 صراع قاعة'} - ${conflict.dayName} (${conflict.timeLabel})\n${conflict.assignments.map((assignment: AssignmentWithDetails) => {
          return `${assignment.professor_name} - ${assignment.course_name} - ${assignment.group_name} - ${assignment.room_name}`;
        }).join('\n')}`;
      }).join('\n\n')}`;
      setConflictCheckResult(conflictMessage);
      // Use alert for immediate feedback, but result is also stored in state
      alert(conflictMessage);
    }
  };
  // ==============================================
  // END OF CONFLICT DETECTION FUNCTION
  // ==============================================

  // Fonction pour exporter les conflits en PDF
  const exportConflictsToPDF = async () => {
    if (!conflictCheckResult || conflictCheckResult.startsWith('✅')) return;

    try {
      // Get print settings for branding
      const printSettings = await window.dataUtils.getPrintSettings();
      
      // Find the ID of the "remote" room ("عن بعد")
      let remoteRoomId: number | null = null;
      const remoteRoom = rooms.find(room => room.name === 'عن بعد');
      if (remoteRoom) {
        remoteRoomId = remoteRoom.id;
      }
      
      // Find the ID of the "unassigned professor" ("أستاذ غير معين")
      let unassignedProfessorId: number | null = null;
      const unassignedProf = professors.find(prof => prof.name === 'أستاذ غير معين');
      if (unassignedProf) {
        unassignedProfessorId = unassignedProf.id;
      }
      
      // Re-detect conflicts to get detailed assignment data
      const conflicts: any[] = [];
      const assignmentsByTimeSlot = new Map<string, AssignmentWithDetails[]>();
      
      // Group assignments by time slot (day-startTime-endTime)
      filteredAssignments.forEach(assignment => {
        const timeSlotKey = `${assignment.day_of_week}-${assignment.start_time}-${assignment.end_time}`;
        if (!assignmentsByTimeSlot.has(timeSlotKey)) {
          assignmentsByTimeSlot.set(timeSlotKey, []);
        }
        assignmentsByTimeSlot.get(timeSlotKey)!.push(assignment);
      });

      // Find conflicts and collect detailed data
      assignmentsByTimeSlot.forEach((slotAssignments, timeSlotKey) => {
        if (slotAssignments.length <= 1) return;

        const [dayId, startTime, endTime] = timeSlotKey.split('-');
        const dayName = DAYS_OF_WEEK.find(d => d.id === parseInt(dayId))?.name || 'غير معروف';
        const timeLabel = `${startTime} - ${endTime}`;

        // Group by professor to find professor conflicts
        const assignmentsByProfessor = new Map<number, AssignmentWithDetails[]>();
        slotAssignments.forEach(assignment => {
          if (!assignmentsByProfessor.has(assignment.professor_id)) {
            assignmentsByProfessor.set(assignment.professor_id, []);
          }
          assignmentsByProfessor.get(assignment.professor_id)!.push(assignment);
        });

        // Check for professor conflicts (same professor in multiple physical rooms)
        assignmentsByProfessor.forEach((professorAssignments) => {
          if (professorAssignments.length > 1) {
            // Skip check if this is the unassigned professor
            if (professorAssignments[0].professor_id === unassignedProfessorId) {
              return; // Skip unassigned professor
            }
            
            // Filter assignments to only include those in physical rooms (exclude remote)
            const physicalAssignments = professorAssignments.filter(a => a.room_id !== remoteRoomId);
            
            if (physicalAssignments.length > 1) {
              // Find all unique physical room IDs the professor is assigned to in this slot
              const uniquePhysicalRoomIds = new Set(physicalAssignments.map(a => a.room_id));
              
              // Only flag as conflict if professor is in more than one *distinct* physical room
              if (uniquePhysicalRoomIds.size > 1) {
                conflicts.push({
                  type: 'professor',
                  dayName,
                  timeLabel,
                  assignments: professorAssignments
                });
              }
            }
          }
        });

        // Group by room to find room conflicts
        const assignmentsByRoom = new Map<number, AssignmentWithDetails[]>();
        slotAssignments.filter(a => a.room_id > 0).forEach(assignment => {
          if (!assignmentsByRoom.has(assignment.room_id)) {
            assignmentsByRoom.set(assignment.room_id, []);
          }
          assignmentsByRoom.get(assignment.room_id)!.push(assignment);
        });

        // Check for room conflicts (multiple professors in same room)
        assignmentsByRoom.forEach((roomAssignments) => {
          const uniqueProfessorIds = new Set(roomAssignments.map(a => a.professor_id));
          if (uniqueProfessorIds.size > 1) {
            conflicts.push({
              type: 'room',
              dayName,
              timeLabel,
              assignments: roomAssignments
            });
          }
        });
      });

      // Create HTML content for the report
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>تقرير الصراعات في الجدول الزمني</title>
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
              text-align: right;
              font-size: ${printSettings?.cellContentFontSize || 10}px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
              border-bottom: 2px solid #333;
              padding-bottom: 8px;
            }
            .logo {
              width: ${printSettings?.logoSize || 60}px;
              height: ${printSettings?.logoSize || 60}px;
              object-fit: contain;
            }
            .header-text {
              text-align: center;
              flex: 1;
            }
            .university-name {
              font-size: ${(printSettings?.headerFontSize || 16) - 2}px;
              font-weight: bold;
              margin: 3px 0;
            }
            .ministry {
              font-size: ${(printSettings?.subtitleFontSize || 14) - 2}px;
              margin: 2px 0;
            }
            .faculty-name {
              font-size: ${(printSettings?.titleFontSize || 16) - 2}px;
              font-weight: bold;
              margin: 3px 0;
            }
            .dean-office {
              font-size: ${(printSettings?.subtitleFontSize || 14) - 2}px;
              margin: 2px 0;
            }
            .report-title {
              text-align: center;
              font-size: ${(printSettings?.titleFontSize || 16)}px;
              font-weight: bold;
              margin: 15px 0;
              color: #d32f2f;
            }
            .academic-year {
              text-align: center;
              margin: 10px 0;
              font-weight: bold;
              font-size: ${(printSettings?.subtitleFontSize || 14) - 1}px;
            }
            .conflict-section {
              margin: 20px 0;
              page-break-inside: avoid;
            }
            .conflict-header {
              background-color: #ffebee;
              border: 1px solid #f44336;
              border-radius: 5px;
              padding: 10px;
              margin-bottom: 10px;
              font-weight: bold;
              color: #d32f2f;
            }
            .conflict-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: ${(printSettings?.cellContentFontSize || 10)}px;
            }
            .conflict-table th {
              background-color: #f5f5f5;
              border: 1px solid #ddd;
              padding: 8px;
              text-align: center;
              font-weight: bold;
              font-size: ${printSettings?.cellContentFontSize || 10}px;
            }
            .conflict-table td {
              border: 1px solid #ddd;
              padding: 6px;
              text-align: center;
              vertical-align: middle;
            }
            .conflict-table tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .conflict-table tr:hover {
              background-color: #fff3e0;
            }
            .professor-conflict {
              background-color: #ffebee !important;
            }
            .room-conflict {
              background-color: #fff3e0 !important;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: ${(printSettings?.cellContentFontSize || 10) - 2}px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${printSettings?.universityLogoUrl ? `<img src="${printSettings.universityLogoUrl}" alt="شعار الجامعة" class="logo">` : '<div class="logo"></div>'}
            <div class="header-text">
              <div class="ministry">وزارة التعليم العالي والبحث العلمي</div>
              <div class="university-name">${printSettings?.universityName || 'اسم الجامعة'}</div>
              <div class="faculty-name">${printSettings?.facultyName || 'اسم الكلية'}</div>
              <div class="dean-office">نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة</div>
            </div>
            ${printSettings?.facultyLogoUrl ? `<img src="${printSettings.facultyLogoUrl}" alt="شعار الكلية" class="logo">` : '<div class="logo"></div>'}
          </div>

          <div class="academic-year">السنة الدراسية: ${currentYear?.year_name || ''} - الفصل: ${currentSemester?.semester_name || ''}</div>

          <div class="report-title">تقرير تفصيلي للصراعات في الجدول الزمني</div>

          ${conflicts.map((conflict) => {
            const conflictType = conflict.type === 'professor' ? '👨‍🏫 صراع أستاذ' : '🏫 صراع قاعة';
            const conflictClass = conflict.type === 'professor' ? 'professor-conflict' : 'room-conflict';
            
            return `
              <div class="conflict-section">
                <div class="conflict-header">
                  ${conflictType} - ${conflict.dayName} (${conflict.timeLabel})
                </div>
                
                <table class="conflict-table">
                  <thead>
                    <tr>
                      <th>الأستاذ</th>
                      <th>المادة</th>
                      <th>المجموعة</th>
                      <th>التخصص</th>
                      <th>القاعة</th>
                      <th>اليوم</th>
                      <th>التوقيت</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${conflict.assignments.map((assignment: AssignmentWithDetails) => {
                      const group = groups.find(g => g.id === assignment.group_id);
                      const specialization = group?.specialization || 'غير محدد';
                      
                      return `
                        <tr class="${conflictClass}">
                          <td>${assignment.professor_name}</td>
                          <td>${assignment.course_name}</td>
                          <td>${assignment.group_name}</td>
                          <td>${specialization}</td>
                          <td>${assignment.room_name}</td>
                          <td>${assignment.day_name}</td>
                          <td>${assignment.start_time} - ${assignment.end_time}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}

          ${conflicts.length === 0 ? '<div style="text-align: center; color: green; font-size: 16px; margin: 50px 0;">✅ لا توجد صراعات في الجدول الزمني</div>' : ''}

          <div class="footer">
            <div>تم إنشاء هذا التقرير في: ${new Date().toLocaleDateString('ar-DZ')} - عدد الصراعات: ${conflicts.length}</div>
            <div>نظام إدارة الجداول الزمنية الأكاديمية</div>
          </div>
        </body>
        </html>
      `;

      // Create a new window for printing
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
      console.error('خطأ في تصدير تقرير الصراعات:', error);
      alert('حدث خطأ أثناء إنشاء تقرير الصراعات');
    }
  };

  // Fonction pour exporter les cours non attribués en PDF
  const exportUnassignedCoursesPDF = async () => {
    try {
      // Get print settings for branding
      const printSettings = await window.dataUtils.getPrintSettings();
      
      // Find unassigned professor ID
      const unassignedProf = professors.find(p => p.name === 'أستاذ غير معين');
      const unassignedProfessorId = unassignedProf ? unassignedProf.id : null;
      
      // Get assignments with unassigned professor
      const unassignedAssignments = assignments.filter(assignment => 
        assignment.professor_id === unassignedProfessorId
      );
      
      // ✅ إنشاء صفوف الجدول
      const rows = unassignedAssignments.map(assignment => [
        assignment.course_name || 'غير محدد',
        assignment.group_name || 'غير محدد',
        assignment.day_name || '-',
        `${assignment.start_time || '-'} - ${assignment.end_time || '-'}`,
        assignment.room_name || 'غير محدد',
        assignment.academic_year || '-',
        assignment.semester || '-'
      ]);
      
      // ✅ إنشاء صندوق الإحصائيات
      const summaryBox = `
        <div style="
          background-color: ${unassignedAssignments.length > 0 ? '#fff3e0' : '#e8f5e9'};
          border: 2px solid ${unassignedAssignments.length > 0 ? '#ff9800' : '#4caf50'};
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        ">
          <div style="font-size: 20pt; font-weight: bold; color: ${unassignedAssignments.length > 0 ? '#e65100' : '#2e7d32'}; margin-bottom: 10px;">
            ${unassignedAssignments.length > 0 ? '⚠️' : '✅'} عدد المقاييس غير المسندة: ${unassignedAssignments.length}
          </div>
          ${unassignedAssignments.length === 0 ? 
            '<p style="font-size: 14pt; color: #2e7d32;">جميع المقاييس مسندة لأساتذة</p>' : 
            '<p style="font-size: 12pt; color: #e65100;">يرجى إسناد هذه المقاييس في أقرب وقت</p>'
          }
        </div>
      `;
      
      // ✅ إنشاء الجدول
      const table = unassignedAssignments.length > 0 ? generateStyledTable(
        ['المقياس', 'المجموعة', 'اليوم', 'التوقيت', 'القاعة', 'السنة', 'الفصل'],
        rows
      ) : '';
      
      // ✅ إنشاء المستند الكامل
      const content = generateFullDocument(
        'تقرير المقاييس غير المسندة',
        summaryBox + table,
        {
          universityName: printSettings.universityName,
          facultyName: printSettings.facultyName,
          logoUrl: printSettings.universityLogoUrl,
          tableCellAlignment: (printSettings as any).tableCellAlignment || 'center',
          footerRight: 'عميد الكلية'
        }
      );
      
      // ✅ حفظ كـ PDF
      printContent(content, {
        title: `مقاييس_غير_مسندة_${currentYear?.year_name || ''}_${currentSemester?.semester_name || ''}`,
        orientation: 'landscape',
        fontSize: '11pt',
        asPDF: true
      });
      
    } catch (error) {
      console.error('خطأ في تصدير تقرير المقاييس غير المسندة:', error);
      alert('حدث خطأ أثناء إنشاء تقرير المقاييس غير المسندة');
    }
  };
  
  

  // ---> START: Add listener for Menu Search Trigger <--- 
  useEffect(() => {
    const handleTriggerSearch = () => {
      console.log('Received trigger-search event from main process.');
      searchInputRef.current?.focus(); // Focus the search input field
    };

    // Check if the API exists (it should thanks to preload)
    if (window.electronAPI && typeof window.electronAPI.onTriggerSearch === 'function') {
      console.log('Registering trigger-search listener...');
      window.electronAPI.onTriggerSearch(handleTriggerSearch);
      
      // Optional: Notify main process that this component is ready
      // window.electronAPI.rendererReady(); 
    } else {
        console.warn('electronAPI.onTriggerSearch is not available. Menu search trigger will not work.');
    }

    // Cleanup function: remove the listener when the component unmounts
    return () => {
      if (window.electronAPI && typeof window.electronAPI.removeTriggerSearchListener === 'function') {
        console.log('Removing trigger-search listener...');
        window.electronAPI.removeTriggerSearchListener(handleTriggerSearch);
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount and cleans up on unmount
  // ---> END: Add listener for Menu Search Trigger <--- 

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">إدارة توزيع المقررات</h1>
      
      {/* Section des filtres */}
      <div className="mb-4 p-4 bg-white rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Search Input */}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="بحث عام..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-2 border border-gray-300 rounded-md md:col-span-1"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تصفية حسب الأستاذ
            </label>
            <input
              type="text"
              value={selectedProfessor}
              onChange={handleProfessorFilterChange}
              placeholder="ابحث عن أستاذ..."
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تصفية حسب القسم
            </label>
            <select
              value={selectedDepartment}
              onChange={handleDepartmentFilterChange}
              className="w-full p-2 border rounded"
            >
              <option value="0">كل الأقسام</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تصفية حسب التخصص
            </label>
            <select
              value={selectedSpecialization}
              onChange={handleSpecializationFilterChange}
              className="w-full p-2 border rounded"
              disabled={!selectedDepartment}
            >
              <option value="">كل التخصصات</option>
              {getDepartmentSpecializations(selectedDepartment).map((spec, index) => (
                <option key={index} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تصفية حسب المجموعة
            </label>
            <select
              value={selectedGroup}
              onChange={handleGroupFilterChange}
              className="w-full p-2 border rounded"
            >
              <option value="0">كل المجموعات</option>
              {groups
                .filter(group => group.group_type === 'group')
                .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                .map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            مسح التصفية
          </button>
        </div>
      </div>

      {/* Modifier la DataGrid pour utiliser filteredAssignments */}
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={filteredAssignments}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 10, 25]}
          checkboxSelection
          disableRowSelectionOnClick
        />
      </div>
      
      {/* Display current academic year and semester at the top of the page */}
      <div className="current-academic-info" style={{ 
        textAlign: 'center', 
        margin: '10px 0 20px', 
        padding: '10px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '5px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ margin: '0', color: '#0d6efd' }}>
          {currentYear ? currentYear.year_name : 'لم يتم تحديد السنة الدراسية'} - 
          {currentSemester ? currentSemester.semester_name : 'لم يتم تحديد الفصل الدراسي'}
        </h3>
        <p style={{ margin: '5px 0 0', color: '#6c757d' }}>
          يرجى تحديد السنة الدراسية والفصل من صفحة <a href="/academic-years">السنوات الدراسية</a>
        </p>
      </div>

      <h2 className="text-2xl font-bold mb-4 text-center">إدارة تعيينات المقررات</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
        <span className="block sm:inline">{error}</span>
      </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div className="flex gap-2 mt-auto">
            {can('create', 'sessions') && (
              <button 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                onClick={() => {
                  setEditingAssignment(null);
                  setFormData({
                    professor_id: 0,
                    course_id: 0,
                    group_id: 0,
                    room_id: 0,
                    day_of_week: 0,
                    start_time: '',
                    end_time: '',
                    academic_year: currentYear?.year_name || '',
                    semester: currentSemester?.semester_name || '',
                    group_specialization: '',
                    department_id: 0
                  });
                  setIsModalOpen(true);
                }}
              >
                إضافة تعيين جديد
              </button>
            )}
            
            {/* Bouton d'export Excel */}
            <button 
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
              onClick={() => exportToExcel(filteredAssignments)}
            >
              تصدير Excel
            </button>
            
            <button 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet([]);
                XLSX.utils.sheet_add_aoa(ws, [
                  ['professor_id', 'course_id', 'group_id', 'room_id', 'day_of_week', 'start_time', 'end_time', 'academic_year', 'semester', 'notes'],
                ]);
                
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "template_assignments");
                
                XLSX.writeFile(wb, "template_assignments.xlsx");
              }}
            >
              تنزيل قالب
            </button>
            
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
              <button 
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md"
                onClick={() => fileInputRef.current?.click()}
              >
                استيراد Excel
              </button>
            </div>

            {/* NOUVEAU BOUTON: Détection des Conflits */}
            <button
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md"
              onClick={() => detectConflicts(filteredAssignments)}
              disabled={loading} // Disable button while loading/checking
            >
              {loading ? 'Vérification...' : 'Détecter les Conflits'}
            </button>
            
            {/* NOUVEAU BOUTON: Impression des Conflits */}
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
              onClick={() => exportConflictsToPDF()}
              disabled={!conflictCheckResult || conflictCheckResult.startsWith('✅')}
            >
              طباعة تقرير الصراعات
            </button>
            
            {/* NOUVEAU BOUTON: Impression المقاييس غير المسندة */}
            <button
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md"
              onClick={() => exportUnassignedCoursesPDF()}
            >
              طباعة المقاييس غير المسندة
            </button>
            {/* FIN NOUVEAU BOUTON */}

          </div>
        </div>

        {/* Display Conflict Check Result */}
        {conflictCheckResult && (
          <div className={`p-3 mb-4 rounded ${conflictCheckResult.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <pre className="whitespace-pre-wrap">{conflictCheckResult}</pre>
          </div>
        )}

        <div className="h-[calc(100vh-250px)]">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-gray-600" role="status">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : (
            <DataGrid
              rows={filteredAssignments}
              columns={columns}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10, page: 0 },
                },
              }}
              pageSizeOptions={[10, 25, 50]}
              autoHeight
              disableRowSelectionOnClick
            />
          )}
        </div>
      </div>

      {/* نافذة إضافة/تعديل التعيين */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full" role="dialog" aria-modal="true" aria-describedby="modal-headline">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-headline">
                      {editingAssignment ? 'تعديل تعيين' : 'إضافة تعيين جديد'}
                    </h3>
                    <form 
                      className="space-y-4"
                      onSubmit={handleSubmit}
                    >
                      <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
                        {/* اختيار القسم */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">القسم</label>
                          <select
                            name="department_id"
                            className="w-full border rounded-md p-2"
                            value={formData.department_id || ''}
                            onChange={(e) => handleDepartmentSelect(Number(e.target.value))}
                          >
                            <option value="">-- اختر القسم --</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* اختيار التخصص */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">التخصص</label>
                          <select
                            name="group_specialization"
                            className="w-full border rounded-md p-2"
                            value={formData.group_specialization || ''}
                            onChange={handleInputChange}
                            disabled={!formData.department_id}
                          >
                            <option value="">-- اختر التخصص --</option>
                            {specializations.map((spec) => (
                              <option key={spec} value={spec}>{spec}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* اختيار الأستاذ */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">الأستاذ</label>
                          <input
                            type="text"
                            placeholder="ابحث عن أستاذ..."
                            className="w-full border rounded-md p-2"
                            value={searchTerm}
                            onChange={handleProfessorSearch}
                            onFocus={() => setIsDropdownOpen(true)}
                          />
                          {isDropdownOpen && filteredProfessors.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {filteredProfessors.map((professor, index) => (
                                <div
                                  key={professor.id}
                                  {...professorNavigation.getItemProps(professor, index)}
                                  className={`p-2 cursor-pointer text-right ${
                                    index === professorNavigation.selectedIndex 
                                      ? 'bg-blue-100' 
                                      : 'hover:bg-gray-100'
                                  }`}
                                  style={{ direction: 'rtl' }}
                                >
                                  {professor.name}
                                </div>
                              ))}
                            </div>
                          )}
                          {formData.professor_id > 0 && (
                            <div className="mt-1 text-sm text-blue-600">
                              الأستاذ المختار: {professors.find(p => p.id === formData.professor_id)?.name || 'غير معروف'}
                            </div>
                          )}
                        </div>
                        
                        {/* اختيار المقرر */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">المقرر</label>
                          <input
                            type="text"
                            placeholder="ابحث عن مقرر..."
                            className="w-full border rounded-md p-2"
                            value={courseSearchTerm}
                            onChange={handleCourseSearch}
                            onFocus={() => setIsCourseDropdownOpen(true)}
                          />
                          {isCourseDropdownOpen && filteredCourses.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {filteredCourses.map((course, index) => (
                                <div
                                  key={course.id}
                                  {...courseNavigation.getItemProps(course, index)}
                                  className={`p-2 cursor-pointer ${
                                    index === courseNavigation.selectedIndex 
                                      ? 'bg-blue-100' 
                                      : 'hover:bg-gray-100'
                                  }`}
                                >
                                  {course.name} ({course.code})
                                </div>
                              ))}
                            </div>
                          )}
                          {formData.course_id > 0 && (
                            <div className="mt-1 text-sm text-blue-600">
                              المقرر المختار: {courses.find(c => c.id === formData.course_id)?.name || 'غير معروف'}
                            </div>
                          )}
                        </div>
                        
                        {/* اختيار المجموعة */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">المجموعة</label>
                          <select
                            className="w-full border rounded-md p-2"
                            value={formData.group_id.toString()}
                            onChange={(e) => handleGroupSelect(Number(e.target.value))}
                            disabled={!formData.group_specialization && !formData.department_id}
                          >
                            <option value="">اختر المجموعة</option>
                            {filteredGroups.map(group => (
                              <option key={group.id} value={group.id.toString()}>{group.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* اختيار القاعة */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">القاعة</label>
                          <select
                            className="w-full border rounded-md p-2"
                            value={formData.room_id.toString()}
                            onChange={(e) => handleRoomSelect(Number(e.target.value))}
                          >
                            <option value="">اختر القاعة</option>
                            {rooms.map(room => (
                              <option key={room.id} value={room.id.toString()}>{room.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* اختيار اليوم */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">اليوم</label>
                          <select
                            className="w-full border rounded-md p-2"
                            value={formData.day_of_week.toString()}
                            onChange={(e) => handleDaySelect(Number(e.target.value))}
                          >
                            <option value="">اختر اليوم</option>
                            {DAYS_OF_WEEK.map(day => (
                              <option key={day.id} value={day.id.toString()}>{day.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* اختيار الوقت */}
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">وقت المحاضرة</label>
                          <select
                            className="w-full border rounded-md p-2"
                            value={formData.start_time && formData.end_time ? `${formData.start_time} - ${formData.end_time}` : ''}
                            onChange={(e) => {
                              const [start, end] = e.target.value.split(' - ');
                              if (start && end) {
                                handleTimeSelect(start, end);
                              }
                            }}
                          >
                            <option value="">اختر الوقت</option>
                            {LECTURE_TIMES.map((time, index) => (
                              <option key={index} value={`${time.start} - ${time.end}`}>
                                {time.start} - {time.end}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="button"
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                          onClick={() => {
                            setIsModalOpen(false);
                            setEditingAssignment(null);
                          }}
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                          disabled={loading}
                        >
                          {loading ? 'جاري الحفظ...' : (editingAssignment ? 'تحديث' : 'إضافة')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseAssignments;
