import React, { useState, useEffect, useContext, useRef } from 'react';
import { AcademicYearContext } from '../context/AcademicYearContext';
import { useAssignments, AssignmentProvider } from '../context/AssignmentContext';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import * as XLSX from 'xlsx';
import { createTableTemplate, generatePDFFromHTML, generatePDFFromHTMLFallback } from '../utils/pdfUtils';
import DatabaseErrorAlert from '../components/DatabaseErrorAlert';

// Interfaces pour les types de données
interface Professor {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  academic_title?: string;
}

interface Course {
  id: number;
  name: string;
  code?: string;
}

interface Group {
  id: number;
  name: string;
  specialization?: string;
}

interface Room {
  id: number;
  name: string;
}

interface Assignment {
  id: number;
  professor_id: number;
  course_id: number;
  group_id: number;
  room_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year?: string;
  semester?: string;
}

interface AssignmentWithDetails extends Assignment {
  professorName: string;
  courseName: string;
  groupName: string;
  groupSpecialization: string;
  roomName: string;
  lecture_time: string;
  dayName: string;
}

// Fonction utilitaire pour traduire les titres académiques
const translateProfessorTitle = (title: string): string => {
  const titles: { [key: string]: string } = {
    'PROF': 'أستاذ',
    'MC': 'أستاذ محاضر',
    'MAA': 'أستاذ مساعد',
    'MAB': 'أستاذ مساعد ب',
    'MCB': 'أستاذ محاضر ب',
    'PROFB': 'أستاذ ب',
    'VAC': 'أستاذ زائر',
    'ASS': 'معيد',
    'DR': 'دكتور',
    'ING': 'مهندس',
    'MRS': 'السيدة',
    'MR': 'السيد'
  };
  return titles[title] || title;
};

// Fonction utilitaire pour convertir le jour en arabe
const convertDay = (day: number): string => {
  const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  return days[day] || 'يوم غير محدد';
};

// Fonction utilitaire pour gérer les erreurs
const handleError = (error: any): Error => {
  console.error('Erreur:', error);
  if (error instanceof Error) {
    return error;
  }
  return new Error('Une erreur inconnue est survenue');
};

// Fonction utilitaire pour comparer les chaînes en arabe
const arabicCompare = (a: string, b: string): number => {
  return a.localeCompare(b, 'ar');
};

// Composant conteneur qui utilise le provider et passe le composant enfant
const SessionsWithProvider = () => {
  return (
    <AssignmentProvider>
      <SessionsContent />
    </AssignmentProvider>
  );
};

// Composant principal avec le contenu
const SessionsContent = () => {
  // Accéder au contexte de l'année académique
  const academicContext = useContext(AcademicYearContext);
  const currentYear = academicContext?.currentYear;
  const currentSemester = academicContext?.currentSemester;
  
  // قائمة توقيتات المحاضرات مرتبة
  const lectureTimes = [
    '8.00 - 9.30',
    '9.30 - 11.00',
    '11.00 - 12.30',
    '12.30 - 14.00',
    '14.00 - 15.30',
    '15.30 - 17.00'
  ];

  const [sessions, setSessions] = useState<AssignmentWithDetails[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<AssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<keyof AssignmentWithDetails | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // استخدام React.useState للتأكد من استخدام React
  const [filterDay, setFilterDay] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterGroupSpecialization, setFilterGroupSpecialization] = useState('');
  const [filterProfessor, setFilterProfessor] = useState('');

  // حالة البحث عن الأستاذ
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Accéder au contexte d'affectation
  const assignmentContext = useAssignments();

  // Fetch sessions data
  const fetchData = async () => {
    try {
      console.log('جاري جلب البيانات...');
      
      // Récupérer les données avec le contexte ou directement
      let assignmentsData;
      
      try {
        // الحصول على السنة الأكاديمية والفصل الدراسي الحاليين
        const yearName = currentYear ? currentYear.year_name : null;
        const semesterName = currentSemester ? currentSemester.semester_name : null;
        
        console.log('Sessions - Current context values:', {
          currentYear: currentYear,
          currentSemester: currentSemester,
          yearName,
          semesterName
        });
        
        // Utiliser le contexte pour la cohérence des données مع الفلترة
        assignmentsData = await assignmentContext.getAssignments(yearName, semesterName);
        console.log(`تم العثور على ${assignmentsData.length} تكليف من السياق (مفلتر)`);
      } catch (err) {
        console.error("Erreur lors de l'accès au contexte d'affectation:", err);
        // Fallback: Utiliser l'appel direct à la base de données مع الفلترة
        const yearName = currentYear ? currentYear.year_name : null;
        const semesterName = currentSemester ? currentSemester.semester_name : null;
        assignmentsData = await window.db.getAssignments(yearName, semesterName);
        console.log(`تم العثور على ${assignmentsData.length} تكليف (طريقة بديلة - مفلتر)`);
      }
      
      // Fetch related collections for data enrichment
      console.log('جاري جلب البيانات المرتبطة...');
      
      try {
        // Use double casting through unknown to avoid TypeScript errors
        const professorsData = await window.db.getProfessors() as unknown as Professor[];
        const coursesData = await window.db.getCourses() as unknown as Course[];
        const groupsData = await window.db.getGroups() as unknown as Group[];
        const roomsData = await window.db.getRooms() as unknown as Room[];
        
        console.log(`تم جلب: ${professorsData.length} أستاذ, ${coursesData.length} مقرر, ${groupsData.length} مجموعة, ${roomsData.length} قاعة`);
        
        // Combine data for display
        const assignmentsWithDetails: AssignmentWithDetails[] = assignmentsData
          .filter(assignment => {
            // Vérifier que tous les champs requis sont présents
            return assignment.id &&
                   assignment.professor_id &&
                   assignment.course_id &&
                   assignment.group_id &&
                   assignment.room_id &&
                   assignment.day_of_week !== undefined &&
                   assignment.start_time &&
                   assignment.end_time;
          })
          .map(assignment => {
          const professor = professorsData.find(p => p.id === assignment.professor_id);
          const course = coursesData.find(c => c.id === assignment.course_id);
          const group = groupsData.find(g => g.id === assignment.group_id);
          const room = roomsData.find(r => r.id === assignment.room_id);
          
            // Vérifier que tous les objets associés existent
            if (!professor || !course || !group || !room) {
              console.warn('Données manquantes pour l\'affectation:', assignment);
              return null;
            }

          return {
            ...assignment,
            professorName: professor.name || `${professor.first_name || ''} ${professor.last_name || ''}`.trim(),
            courseName: course.name,
            groupName: group.name,
            groupSpecialization: group.specialization || '',
            roomName: room.name,
            lecture_time: `${assignment.start_time} - ${assignment.end_time}`,
            dayName: convertDay(assignment.day_of_week)
          };
        })
        .filter((assignment): assignment is AssignmentWithDetails => assignment !== null);
        
        console.log(`تم معالجة ${assignmentsWithDetails.length} جلسة بنجاح`);
        
        setSessions(assignmentsWithDetails);
        setFilteredSessions(assignmentsWithDetails);
        console.log('تم تحميل البيانات بنجاح');
      } catch (innerError) {
        console.error('خطأ في جلب البيانات المرتبطة:', innerError);
        setError(handleError(innerError));
      }
    } catch (err) {
      console.error('خطأ في fetchData:', err);
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  // Apply filters whenever filter state or sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      applyFilters();
    }
  }, [
    sessions, 
    filterDay, 
    filterRoom, 
    filterGroupSpecialization,
    currentYear,
    currentSemester
    // إزالة filterProfessor من هنا لتجنب التطبيق المزدوج للفلترة
  ]);

  const applyFilters = (professorFilter?: string) => {
    let result = sessions;

    // Filter by day
    if (filterDay) {
      result = result.filter(session => 
        session.dayName === filterDay
      );
    }

    // Filter by room
    if (filterRoom) {
      result = result.filter(session => 
        session.roomName === filterRoom
      );
    }

    // Filter by group specialization
    if (filterGroupSpecialization) {
      console.log(`Filtering by specialization: ${filterGroupSpecialization}`);
      result = result.filter(session => {
        const matchesSpecialization = session.groupSpecialization === filterGroupSpecialization;
        // Also include lecture groups when filtering by specialization
        const isLectureGroup = session.groupName.includes('محاضرة');
        return matchesSpecialization || isLectureGroup;
      });
    }

    // Filter by academic year and semester
    if (currentYear && currentSemester) {
      result = result.filter(session => 
        session.academic_year === currentYear.year_name && 
        session.semester === currentSemester.semester_name
      );
    }

    // Filter by professor name (including partial search)
    // استخدام professorFilter إذا تم تمريره، وإلا استخدام filterProfessor
    const currentProfessorFilter = professorFilter !== undefined ? professorFilter : filterProfessor;
    
    if (currentProfessorFilter) {
      result = result.filter(session => 
        session.professorName?.includes(currentProfessorFilter)
      );
    }

    // Additional search for professors - نستخدم هذا فقط إذا لم يكن هناك فلترة للأستاذ
    if (searchTerm && !currentProfessorFilter) {
      const searchTermLower = searchTerm.toLowerCase();
      result = result.filter(session => 
        session.professorName?.toLowerCase().includes(searchTermLower)
      );
    }

    console.log(`Filtered sessions count: ${result.length}`);
    setFilteredSessions(result);
  };

  // Advanced sorting function
  const sortedAndFilteredSessions = React.useMemo(() => {
    let result = filteredSessions;

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const valueA = a[sortColumn];
        const valueB = b[sortColumn];

        // Special handling for professor name
        if (sortColumn === 'professorName') {
          return sortDirection === 'asc' 
            ? arabicCompare(String(valueA || ''), String(valueB || ''))
            : arabicCompare(String(valueB || ''), String(valueA || ''));
        }

        // Special handling for lecture time
        if (sortColumn === 'lecture_time') {
          const indexA = lectureTimes.indexOf(String(valueA || ''));
          const indexB = lectureTimes.indexOf(String(valueB || ''));
          
          return sortDirection === 'asc'
            ? indexA - indexB
            : indexB - indexA;
        }

        // Default sorting for other columns
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return sortDirection === 'asc'
            ? arabicCompare(valueA, valueB)
            : arabicCompare(valueB, valueA);
        }

        // Fallback for non-string values
        return 0;
      });
    }

    return result;
  }, [filteredSessions, sortColumn, sortDirection, lectureTimes]);

  // Sortable header component
  const SortableHeader = ({ 
    column, 
    children 
  }: { 
    column: keyof AssignmentWithDetails, 
    children: React.ReactNode 
  }) => {
    const isSorted = sortColumn === column;
    const isAscending = isSorted && sortDirection === 'asc';

    const handleSort = () => {
      if (isSorted) {
        // Toggle direction if already sorted
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // Set new column and default to ascending
        setSortColumn(column);
        setSortDirection('asc');
      }
    };

    return (
      <th 
        scope="col" 
        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
        onClick={handleSort}
      >
        <div className="flex items-center">
          {children}
          {isSorted && (
            <span className="ml-2">
              {isAscending ? '▲' : '▼'}
            </span>
          )}
        </div>
      </th>
    );
  };

  // Render method for professor name
  const renderProfessorName = (name?: string) => {
    return translateProfessorTitle(name);
  };

  // Get unique values for filters
  const uniqueDays = [...new Set(sessions.map(s => s.dayName))];
  const uniqueRooms = [...new Set(sessions.map(s => s.roomName))];
  const uniqueGroupSpecializations = [...new Set(sessions.map(s => s.groupSpecialization || 'غير محدد'))];

  // احصل على قائمة الأساتذة الفريدة مع دعم البحث
  const uniqueProfessors = React.useMemo(() => {
    // جميع الأساتذة الفريدين
    const allProfessors = [...new Set(
      sessions
        .filter(s => s.professorName)
        .map(s => s.professorName || 'أستاذ غير معروف')
    )];

    // إذا كان هناك بحث، قم بتصفية الأساتذة
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      return allProfessors.filter(prof => 
        prof.toLowerCase().includes(searchTermLower)
      );
    }
    
    return allProfessors;
  }, [sessions, searchTerm]);

  // Keyboard navigation for professor dropdown
  const professorNavigation = useKeyboardNavigation({
    items: uniqueProfessors,
    isOpen: isDropdownOpen && searchTerm !== '',
    onSelect: (professor) => handleProfessorSelect(professor),
    onClose: () => setIsDropdownOpen(false),
    getItemId: (professor, index) => `sessions-professor-${index}`
  });

  // دالة اختيار الأستاذ
  const handleProfessorSelect = (professor: string) => {
    setFilterProfessor(professor);
    setSearchTerm(professor);
    setIsDropdownOpen(false);
    
    // تطبيق الفلترة مباشرة بعد اختيار الأستاذ
    applyFilters(professor);
  };

  // دالة إلغاء الفلترة
  const clearProfessorFilter = () => {
    setFilterProfessor('');
    setSearchTerm('');
    setIsDropdownOpen(false);
    
    // تطبيق الفلترة بدون أستاذ محدد
    applyFilters('');
  };

  const handleDeleteAssignment = async (assignment: AssignmentWithDetails) => {
    try {
      // Vérifier si c'est une affectation unique
      const isUnique = sessions.filter(s => 
        s.professor_id === assignment.professor_id && 
        s.course_id === assignment.course_id && 
        s.group_id === assignment.group_id && 
        s.room_id === assignment.room_id && 
        s.day_of_week === assignment.day_of_week && 
        s.start_time === assignment.start_time && 
        s.end_time === assignment.end_time
      ).length === 1;

      if (isUnique) {
        // Afficher une boîte de dialogue de confirmation
        const confirmMessage = `هل أنت متأكد من حذف هذه المحاضرة؟\n\n` +
          `المادة: ${assignment.courseName}\n` +
          `الأستاذ: ${assignment.professorName}\n` +
          `المجموعة: ${assignment.groupName}\n` +
          `القاعة: ${assignment.roomName}\n` +
          `اليوم: ${assignment.dayName}\n` +
          `الوقت: ${assignment.lecture_time}`;

        if (!window.confirm(confirmMessage)) {
          return;
        }
      }

      // Supprimer l'affectation
      await window.db.deleteAssignment(assignment.id);
      
      // Rafraîchir les données
      await fetchData();
      
      // Afficher un message de succès
      alert('تم حذف المحاضرة بنجاح');
    } catch (error) {
      console.error('خطأ في حذف المحاضرة:', error);
      alert('حدث خطأ أثناء حذف المحاضرة');
    }
  };

  // Fonction pour exporter vers Excel
  const exportToScheduleExcel = (sessions: AssignmentWithDetails[]) => {
    const worksheet = XLSX.utils.json_to_sheet(sessions.map(session => ({
      'اليوم': session.dayName,
      'الوقت': session.lecture_time,
      'المادة': session.courseName,
      'الأستاذ': session.professorName,
      'المجموعة': session.groupName,
      'القاعة': session.roomName
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'جدول المحاضرات');
    XLSX.writeFile(workbook, 'جدول_المحاضرات.xlsx');
  };

  // دالة التصدير إلى PDF
  const exportToPDF = async () => {
    try {
      // إعداد بيانات الجدول للتصدير
      const tableData: string[][] = [];
      
      // إضافة بيانات الجلسات إلى الجدول
      sortedAndFilteredSessions.forEach(session => {
        tableData.push([
          session.dayName,
          session.lecture_time || `${session.start_time} - ${session.end_time}`,
          session.groupName,
          session.courseName,
          renderProfessorName(session.professorName),
          session.roomName
        ]);
      });
      
      // إنشاء عنوان ومعلومات الجدول
      const title = 'جدول المحاضرات';
      const today = new Date();
      const formattedDate = today.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const subtitle = `${filterGroupSpecialization ? `التخصص: ${filterGroupSpecialization}` : 'جميع التخصصات'} - ${formattedDate}`;
      
      // إنشاء رأس الجدول
      const headers = ['اليوم', 'الوقت', 'المجموعة', 'المقرر', 'الأستاذ', 'القاعة'];
      
      // إنشاء قالب HTML للجدول
      const htmlContent = await createTableTemplate(title, subtitle, headers, tableData);
      
      try {
        // إنشاء ملف PDF من قالب HTML
        await generatePDFFromHTML(htmlContent, {
          filename: `جدول_المحاضرات_${filterGroupSpecialization || 'جميع_التخصصات'}.pdf`,
          format: 'A4',
          landscape: true,
          margins: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
          }
        });
      } catch (pdfError) {
        console.error('خطأ في إنشاء PDF:', pdfError);
        // استخدام حل بديل إذا لم تنجح إنشاء PDF
        await generatePDFFromHTMLFallback(htmlContent, {
          filename: `جدول_المحاضرات_${filterGroupSpecialization || 'جميع_التخصصات'}.pdf`,
          format: 'A4',
          landscape: true
        });
      }
    } catch (error) {
      console.error('خطأ في تصدير PDF:', error);
      alert('حدث خطأ أثناء تصدير الملف. يرجى المحاولة مرة أخرى.');
    }
  };

  const tableElement = React.useRef<HTMLTableElement>(null);

  // تحميل البيانات عند تحميل الصفحة
  useEffect(() => {
    fetchData();
  }, []);

  // إعادة جلب البيانات عند تغيير السنة الأكاديمية أو الفصل الدراسي
  useEffect(() => {
    if (currentYear && currentSemester) {
      console.log('Sessions - Academic year or semester changed, refetching data...');
      fetchData();
    }
  }, [currentYear, currentSemester]);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex space-x-2 mb-4">
        <button 
          onClick={() => exportToScheduleExcel(sortedAndFilteredSessions)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          تصدير Excel
        </button>
        <button 
          onClick={exportToPDF}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          تصدير PDF
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Day Filter */}
        <select 
          value={filterDay} 
          onChange={(e) => setFilterDay(e.target.value)}
          className="px-2 py-1 border rounded"
        >
          <option value="">كل الأيام</option>
          {uniqueDays.map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>

        {/* Room Filter */}
        <select 
          value={filterRoom} 
          onChange={(e) => setFilterRoom(e.target.value)}
          className="px-2 py-1 border rounded"
        >
          <option value="">كل القاعات</option>
          {uniqueRooms.map(room => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>

        {/* Group Specialization Filter */}
        <select 
          value={filterGroupSpecialization} 
          onChange={(e) => setFilterGroupSpecialization(e.target.value)}
          className="px-2 py-1 border rounded"
        >
          <option value="">كل التخصصات</option>
          {uniqueGroupSpecializations.map(spec => (
            <option key={spec} value={spec}>{spec}</option>
          ))}
        </select>

        {/* Professor Search and Filter */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="البحث عن أستاذ"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              
              // إذا تم محو الحقل، قم بإلغاء الفلترة
              if (value === '') {
                clearProfessorFilter();
              } else {
                setIsDropdownOpen(true);
              }
            }}
            onFocus={() => setIsDropdownOpen(true)}
            className="w-full px-2 py-1 border rounded"
          />
          
          {isDropdownOpen && searchTerm && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
              {uniqueProfessors.length > 0 ? (
                uniqueProfessors.map((professor, index) => (
                  <div
                    key={professor}
                    {...professorNavigation.getItemProps(professor, index)}
                    className={`px-4 py-2 cursor-pointer ${
                      index === professorNavigation.selectedIndex 
                        ? 'bg-blue-100' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {professor}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-gray-500">لا توجد نتائج</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* عرض رسالة الخطأ إذا كان هناك خطأ */}
      {error && (
        <div className="mt-6">
          <DatabaseErrorAlert 
            error={error} 
            onClose={() => setError(null)} 
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">جاري تحميل البيانات...</p>
        </div>
      ) : !error ? (
        <>
          <div className="mt-8 flex flex-col">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table id="sessions-table" ref={tableElement} className="min-w-full divide-y divide-gray-300">
                    <thead>
                      <tr>
                        <SortableHeader column="courseName">المادة</SortableHeader>
                        <SortableHeader column="professorName">الأستاذ</SortableHeader>
                        <SortableHeader column="dayName">اليوم</SortableHeader>
                        <SortableHeader column="roomName">القاعة</SortableHeader>
                        <SortableHeader column="groupName">المجموعة</SortableHeader>
                        <SortableHeader column="lecture_time">وقت المحاضرة</SortableHeader>
                        <th className="border p-2">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedAndFilteredSessions.map((session) => (
                        <tr key={session.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-left text-sm font-medium text-gray-900 sm:pl-0">
                            {session.courseName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-left text-sm text-gray-500">
                            {renderProfessorName(session.professorName)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-left text-sm text-gray-500">
                            {session.dayName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-left text-sm text-gray-500">
                            {session.roomName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-left text-sm text-gray-500">
                            {session.groupName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-left text-sm text-gray-500">
                            {session.lecture_time}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-left text-sm text-gray-500">
                            <button
                              onClick={() => handleDeleteAssignment(session)}
                              className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                              title="حذف المحاضرة"
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

// Exporter le composant avec le provider
export default SessionsWithProvider;