// Déclarations pour les API Electron exposées via preload.js

// Déclaration de l'interface DataUtils pour éviter l'erreur de type
interface DataUtils {
  exportData: () => Promise<any>;
  importData: (data: any) => Promise<any>;
  saveToFile: (data: any, defaultPath?: string) => Promise<any>;
  openFromFile: (defaultPath?: string) => Promise<any>;
  generatePDF: (htmlContent: string, options: any) => Promise<{
    success: boolean;
    buffer?: Uint8Array;
    filename?: string;
    error?: string;
  }>;

  // Fonctions de base de données
  getAssignments: () => Promise<any[]>;
  addAssignment: (assignment: any) => Promise<any>;
  updateAssignment: (id: number, assignment: any) => Promise<any>;
  deleteAssignment: (id: number) => Promise<any>;

  // Fonctions PDF
  generatePDF: (htmlContent: string, options: any) => Promise<Uint8Array>;

  // Paramètres d'impression
  getPrintSettings: () => Promise<{
    universityName?: string;
    facultyName?: string;
    universityLogoUrl?: string;
    facultyLogoUrl?: string;
    headerFontSize?: number;
    titleFontSize?: number;
    subtitleFontSize?: number;
    cellContentFontSize?: number;
    logoSize?: number;
  }>;
  savePrintSettings: (settings: {
    universityName?: string;
    facultyName?: string;
    universityLogoUrl?: string;
    facultyLogoUrl?: string;
    headerFontSize?: number;
    titleFontSize?: number;
    subtitleFontSize?: number;
    cellContentFontSize?: number;
    logoSize?: number;
  }) => Promise<void>;

  // Upload Logo
  uploadLogo: (file: File, type: 'university' | 'faculty') => Promise<{ url: string; message: string }>;
}

interface Window {
  db: {
    getDepartments: () => Promise<any[]>;
    addDepartment: (name: string, code: string) => Promise<any>;
    updateDepartment: (id: number, name: string, code: string) => Promise<any>;
    deleteDepartment: (id: number) => Promise<any>;

    getGroups: () => Promise<any[]>;
    addGroup: (name: string, specialization: string, parent_group_id: number | null, department_id: number, group_type: string, year: string) => Promise<any>;
    updateGroup: (id: number, name: string, specialization: string, parent_group_id: number | null, department_id: number, group_type: string, year: string) => Promise<any>;
    deleteGroup: (id: number) => Promise<any>;

    getCourses: () => Promise<any[]>;
    addCourse: (name: string, code: string, metadata: any) => Promise<any>;
    updateCourse: (id: number, name: string, code: string, metadata: any) => Promise<any>;
    deleteCourse: (id: number) => Promise<any>;

    getProfessors: () => Promise<any[]>;
    addProfessor: (name: string, email: string) => Promise<any>;
    updateProfessor: (id: number, name: string, email: string) => Promise<any>;
    deleteProfessor: (id: number) => Promise<any>;

    getRooms: () => Promise<any[]>;
    addRoom: (name: string, capacity: number) => Promise<any>;
    updateRoom: (id: number, name: string, capacity: number) => Promise<any>;
    deleteRoom: (id: number) => Promise<any>;

    getAssignments: (academicYear?: string, semester?: string, specialization?: string) => Promise<any[]>;
    addAssignment: (assignment: any) => Promise<any>;
    updateAssignment: (id: number, assignment: any) => Promise<any>;
    deleteAssignment: (id: number) => Promise<any>;
    checkConflicts: (assignment: any) => Promise<any>;

    getAcademicYears: () => Promise<any[]>;
    getActiveAcademicYear: () => Promise<any>;
    addAcademicYear: (yearName: string, setAsCurrent: boolean) => Promise<any>;
    setActiveAcademicYear: (yearId: number) => Promise<any>;
    deleteAcademicYear: (yearId: number) => Promise<any>;

    getSemesters: (academicYearId: number) => Promise<any[]>;
    getActiveSemester: (academicYearId: number) => Promise<any>;
    addSemester: (academicYearId: number, semesterName: string, startDate: string, endDate: string, setAsCurrent: boolean) => Promise<any>;
    setActiveSemester: (semesterId: number) => Promise<any>;
    deleteSemester: (semesterId: number) => Promise<any>;

    importDataFromPreviousYear: (sourceYearId: number, targetYearId: number, importSpecializations: boolean, importGroups: boolean, importCourses: boolean) => Promise<any>;
  };

  dataUtils: DataUtils;
}