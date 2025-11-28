interface DB {
  // Professors
  getProfessors: () => Promise<any[]>;
  addProfessor: (name: string, email: string, metadata: string) => Promise<any>;
  updateProfessor: (id: number, name: string, email: string, metadata: string) => Promise<any>;
  deleteProfessor: (id: number) => Promise<void>;

  // Courses
  getCourses: () => Promise<any[]>;
  addCourse: (name: string, code: string, metadata: string) => Promise<any>;
  updateCourse: (id: number, name: string, code: string, metadata: string) => Promise<any>;
  deleteCourse: (id: number) => Promise<void>;

  // Groups
  getGroups: () => Promise<any[]>;
  addGroup: (name: string, metadata: string) => Promise<any>;
  updateGroup: (id: number, name: string, metadata: string) => Promise<any>;
  deleteGroup: (id: number) => Promise<void>;

  // Rooms
  getRooms: () => Promise<any[]>;
  addRoom: (name: string, capacity: number, metadata: string) => Promise<any>;
  updateRoom: (id: number, name: string, capacity: number, metadata: string) => Promise<any>;
  deleteRoom: (id: number) => Promise<void>;

  // Assignments
  getAssignments: (academicYear: string | null, semester: string | null) => Promise<any[]>;
  addAssignment: (assignment: any) => Promise<any>;
  updateAssignment: (id: number, assignment: any) => Promise<any>;
  deleteAssignment: (id: number) => Promise<void>;
  checkConflicts: (assignment: any) => Promise<any[]>;

  // Academic Years
  getAcademicYears: () => Promise<any[]>;
  getActiveAcademicYear: () => Promise<any>;
  addAcademicYear: (yearName: string, setAsCurrent: boolean) => Promise<any>;
  setActiveAcademicYear: (yearId: number) => Promise<void>;
  deleteAcademicYear: (yearId: number) => Promise<void>;

  // Semesters
  getSemesters: (academicYearId: number) => Promise<any[]>;
  getActiveSemester: (academicYearId: number) => Promise<any>;
  addSemester: (academicYearId: number, semesterName: string, startDate: string, endDate: string, setAsCurrent: boolean) => Promise<any>;
  setActiveSemester: (semesterId: number) => Promise<void>;
  deleteSemester: (semesterId: number) => Promise<void>;

  // Departments
  getDepartments: () => Promise<any[]>;
  addDepartment: (name: string, code: string) => Promise<any>;
  updateDepartment: (id: number, name: string, code: string) => Promise<any>;
  deleteDepartment: (id: number) => Promise<void>;

  // Authentication & User Management
  login: (username: string, password: string) => Promise<any>;
  logout: (userId: number) => Promise<boolean>;
  getUsers: () => Promise<any[]>;
  addUser: (userData: any) => Promise<any>;
  updateUser: (id: number, userData: any) => Promise<any>;
  deleteUser: (id: number) => Promise<void>;
  changePassword: (userId: number, oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (userId: number, newPassword: string) => Promise<{ success: boolean; message: string }>;
  toggleUserStatus: (userId: number, isActive: boolean) => Promise<{ success: boolean }>;
  getAuditLogs: (filters?: any) => Promise<any[]>;

  // Extra Sessions
  getExtraSessions: () => Promise<any[]>;
  createExtraSession: (session: any) => Promise<any>;
  updateExtraSession: (id: number, session: any) => Promise<any>;
  deleteExtraSession: (id: number) => Promise<void>;
}

declare global {
  interface Window {
    db: DB;
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}
