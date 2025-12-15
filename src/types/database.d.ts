interface Group {
  id: number;
  name: string;
  specialization?: string;
  parent_group_id?: number;
  created_at?: string;
  department_id?: number;
  department_name?: string;
  group_type?: 'department' | 'specialization' | 'group' | 'lecture_group';
  year?: string;
}

interface Course {
  id: number;
  name: string;
  code: string;
  created_at?: string;
}

interface Professor {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

interface Room {
  id: number;
  name: string;
  capacity?: number;
  created_at?: string;
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
  created_at?: string;
  group_name?: string;
  course_name?: string;
  professor_name?: string;
  room_name?: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
}

interface ConflictResult {
  count: number;
}

interface Department {
  id: number;
  name: string;
  code?: string;
  created_at?: string;
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
  session_type: 'extra' | 'makeup' | 'semester_exam';
  description?: string;
  is_archived?: number;
}

interface Database {
  // دوال المجموعات
  getGroups: () => Promise<Group[]>;
  getGroupsByDepartment: (departmentId: number) => Promise<Group[]>;
  getGroupsBySpecialization: (specializationName: string, departmentId?: number) => Promise<Group[]>;
  getSpecializationsByDepartment: (departmentId: number) => Promise<string[]>;
  addGroup: (name: string, specialization?: string, parent_group_id?: number, department_id?: number, group_type?: string, year?: string) => Promise<any>;
  updateGroup: (id: number, name: string, specialization?: string, parent_group_id?: number, department_id?: number, group_type?: string, year?: string) => Promise<any>;
  deleteGroup: (id: number) => Promise<any>;
  deleteAllGroups: () => Promise<any>;

  // دوال المواد
  getCourses: () => Promise<Course[]>;
  addCourse: (name: string, code: string, metadata?: string) => Promise<any>;
  updateCourse: (id: number, name: string, code: string, metadata?: string) => Promise<any>;
  deleteCourse: (id: number) => Promise<any>;

  // دوال الأساتذة
  getProfessors: () => Promise<Professor[]>;
  addProfessor: (name: string, email: string) => Promise<any>;
  updateProfessor: (id: number, name: string, email: string) => Promise<any>;
  deleteProfessor: (id: number) => Promise<any>;

  // دوال القاعات
  getRooms: () => Promise<Room[]>;
  addRoom: (name: string, capacity?: number) => Promise<any>;
  updateRoom: (id: number, name: string, capacity?: number) => Promise<any>;
  deleteRoom: (id: number) => Promise<any>;

  // دوال الأقسام
  getDepartments: () => Promise<Department[]>;
  addDepartment: (name: string, code?: string) => Promise<any>;
  updateDepartment: (id: number, name: string, code?: string) => Promise<any>;
  deleteDepartment: (id: number) => Promise<any>;

  // دوال التكاليف
  getAssignments: (academicYear?: string | null, semester?: string | null, specialization?: string | null) => Promise<Assignment[]>;
  addAssignment: (assignment: Assignment) => Promise<any>;
  updateAssignment: (id: number, assignment: Assignment) => Promise<any>;
  deleteAssignment: (id: number) => Promise<any>;
  checkConflicts: (assignment: Assignment) => Promise<ConflictResult>;

  // دوال الحصص الإضافية
  getExtraSessions: () => Promise<ExtraSession[]>;
  createExtraSession: (session: ExtraSession) => Promise<number>;
  updateExtraSession: (id: number, session: ExtraSession) => Promise<void>;
  deleteExtraSession: (id: number) => Promise<void>;
  archivePastSessions: () => Promise<{ archived: number; error?: string }>;

  // دوال المصادقة والمستخدمين
  login: (username: string, password: string) => Promise<{ success: boolean; user?: any; message?: string }>;
  logout: (userId: number) => Promise<{ success: boolean }>;
  getUsers: () => Promise<any[]>;
  addUser: (userData: any) => Promise<any>;
  updateUser: (id: number, userData: any) => Promise<any>;
  deleteUser: (id: number) => Promise<void>;
  changePassword: (userId: number, oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (userId: number, newPassword: string) => Promise<{ success: boolean; message: string }>;
  toggleUserStatus: (userId: number, isActive: boolean) => Promise<{ success: boolean }>;
  getAuditLogs: (filters?: any) => Promise<any[]>;

  // دوال Sandbox (حفظ المسودات)
  saveSandboxDraft: (name: string, data: any) => Promise<any>;
  getSandboxDrafts: () => Promise<any[]>;
  loadSandboxDraft: (id: number) => Promise<any>;
  deleteSandboxDraft: (id: number) => Promise<boolean>;

  // دوال النسخ الاحتياطي
  createBackup: (options: any) => Promise<any>;
  restoreBackup: (options: any) => Promise<void>;
  getBackupHistory: () => Promise<any[]>;
  deleteBackup: (backupId: number) => Promise<void>;
  exportToJSON: (academicYearId?: number) => Promise<any>;
  importFromJSON: (jsonData: any, mode: 'replace' | 'merge') => Promise<void>;
  getBackupSettings: () => Promise<any>;
  saveBackupSettings: (settings: any) => Promise<void>;
  scheduleAutoBackup: (settings: any) => Promise<void>;
  stopAutoBackup: () => Promise<void>;
  previewBackup: (backupId: number) => Promise<any>;
  validateBackup: (backupId: number) => Promise<{ valid: boolean; errors?: string[] }>;
}

interface DataUtils {
  exportData: () => Promise<any>;
  importData: (data: any) => Promise<any>;
  saveToFile: (data: any, defaultPath?: string) => Promise<any>;
  openFromFile: (defaultPath?: string) => Promise<any>;
}

interface Window {
  db: Database;
  dataUtils: DataUtils;
}