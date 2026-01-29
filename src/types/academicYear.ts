// Types for academic year and semester management

export interface AcademicYear {
  id: number;
  year_name: string;
  is_current: boolean;
  created_at?: string;
}

export interface Semester {
  id: number;
  academic_year_id: number;
  semester_name: string;
  is_current: boolean;
  is_public: boolean;
  start_date: string;
  end_date: string;
  created_at?: string;
}

export interface ImportOptions {
  importSpecializations: boolean;
  importGroups: boolean;
  importCourses: boolean;
}
