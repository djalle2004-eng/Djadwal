import { AcademicYear, Semester, ImportOptions } from '../types/academicYear';

/**
 * جلب كل السنوات الدراسية من قاعدة البيانات
 */
export const getAcademicYears = async (): Promise<AcademicYear[]> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const years = await window.db.getAcademicYears();

    return years.map((year: any) => ({
      id: year.id,
      year_name: year.year_name,
      is_current: Boolean(year.is_current),
      created_at: year.created_at
    }));
  } catch (error) {
    console.error('Error fetching academic years:', error);
    throw error;
  }
};

/**
 * جلب السنة الدراسية الحالية
 */
export const getActiveAcademicYear = async (): Promise<AcademicYear | null> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const year = await window.db.getActiveAcademicYear();

    if (!year) return null;

    return {
      id: year.id,
      year_name: year.year_name,
      is_current: true,
      created_at: year.created_at
    };
  } catch (error) {
    console.error('Error fetching active academic year:', error);
    throw error;
  }
};

/**
 * إضافة سنة دراسية جديدة
 */
export const addAcademicYear = async (yearName: string, setAsCurrent: boolean = false): Promise<AcademicYear> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const newYear = await window.db.addAcademicYear(yearName, setAsCurrent);

    return {
      id: newYear.id,
      year_name: yearName,
      is_current: setAsCurrent,
      created_at: newYear.created_at
    };
  } catch (error) {
    console.error('Error adding academic year:', error);
    throw error;
  }
};

/**
 * تعيين السنة الدراسية الحالية
 */
export const setActiveAcademicYear = async (yearId: number): Promise<void> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.setActiveAcademicYear(yearId);
  } catch (error) {
    console.error('Error setting active academic year:', error);
    throw error;
  }
};

/**
 * جلب الفصول الدراسية لسنة دراسية معينة
 */
export const getSemesters = async (academicYearId: number): Promise<Semester[]> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const semesters = await window.db.getSemesters(academicYearId);

    return semesters.map((semester: any) => ({
      id: semester.id,
      academic_year_id: semester.academic_year_id,
      semester_name: semester.semester_name,
      is_current: Boolean(semester.is_current),
      is_public: Boolean(semester.is_public ?? true),
      start_date: semester.start_date,
      end_date: semester.end_date,
      created_at: semester.created_at
    }));
  } catch (error) {
    console.error('Error fetching semesters:', error);
    throw error;
  }
};

/**
 * جلب الفصل الدراسي الحالي
 */
export const getActiveSemester = async (academicYearId: number): Promise<Semester | null> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const semester = await window.db.getActiveSemester(academicYearId);

    if (!semester) return null;

    return {
      id: semester.id,
      academic_year_id: academicYearId,
      semester_name: semester.semester_name,
      is_current: true,
      is_public: Boolean(semester.is_public ?? true),
      start_date: semester.start_date,
      end_date: semester.end_date,
      created_at: semester.created_at
    };
  } catch (error) {
    console.error('Error fetching active semester:', error);
    throw error;
  }
};

/**
 * إضافة فصل دراسي جديد
 */
export const addSemester = async (
  academicYearId: number,
  semesterName: string,
  startDate: string,
  endDate: string,
  setAsCurrent: boolean = false,
  isPublic: boolean = true
): Promise<Semester> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const newSemester = await window.db.addSemester(
      academicYearId,
      semesterName,
      startDate,
      endDate,
      setAsCurrent,
      isPublic
    );

    return {
      id: newSemester.id,
      academic_year_id: academicYearId,
      semester_name: semesterName,
      is_current: setAsCurrent,
      is_public: isPublic,
      start_date: startDate,
      end_date: endDate,
      created_at: newSemester.created_at
    };
  } catch (error) {
    console.error('Error adding semester:', error);
    throw error;
  }
};

/**
 * تعيين الفصل الدراسي الحالي
 */
export const setActiveSemester = async (semesterId: number): Promise<void> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.setActiveSemester(semesterId);
  } catch (error) {
    console.error('Error setting active semester:', error);
    throw error;
  }
};

/**
 * تحديث فصل دراسي موجود
 */
export const updateSemester = async (
  semesterId: number,
  semesterName: string,
  startDate: string,
  endDate: string,
  isPublic?: boolean
): Promise<Semester> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    const updatedSemester = await window.db.updateSemester(
      semesterId,
      semesterName,
      startDate,
      endDate,
      isPublic
    );

    return {
      id: updatedSemester.id,
      academic_year_id: updatedSemester.academic_year_id,
      semester_name: semesterName,
      is_current: Boolean(updatedSemester.is_current),
      is_public: Boolean(updatedSemester.is_public ?? true),
      start_date: startDate,
      end_date: endDate,
      created_at: updatedSemester.created_at
    };
  } catch (error) {
    console.error('Error updating semester:', error);
    throw error;
  }
};

/**
 * استيراد البيانات من سنة دراسية سابقة
 */
export const importDataFromPreviousYear = async (
  sourceYearId: number,
  targetYearId: number,
  options: ImportOptions
): Promise<void> => {
  try {
    // @ts-ignore - window.db يتم تعريفه في وقت التشغيل
    await window.db.importDataFromPreviousYear(
      sourceYearId,
      targetYearId,
      options.importSpecializations,
      options.importGroups,
      options.importCourses
    );
  } catch (error) {
    console.error('Error importing data from previous year:', error);
    throw error;
  }
};
