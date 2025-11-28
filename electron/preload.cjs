const { contextBridge, ipcRenderer } = require('electron');

// تعريض واجهة برمجة التطبيقات للتعامل مع قاعدة البيانات
contextBridge.exposeInMainWorld('db', {
  // دوال الأقسام
  getDepartments: () => ipcRenderer.invoke('get-departments'),
  addDepartment: (name, code) => ipcRenderer.invoke('add-department', name, code),
  updateDepartment: (id, name, code) => ipcRenderer.invoke('update-department', id, name, code),
  deleteDepartment: (id) => ipcRenderer.invoke('delete-department', id),

  // دوال المجموعات
  getGroups: () => ipcRenderer.invoke('get-groups'),
  addGroup: (name, specialization, parent_group_id, department_id, group_type, year) => 
    ipcRenderer.invoke('add-group', name, specialization, parent_group_id, department_id, group_type, year),
  updateGroup: (id, name, specialization, parent_group_id, department_id, group_type, year) => 
    ipcRenderer.invoke('update-group', id, name, specialization, parent_group_id, department_id, group_type, year),
  deleteGroup: (id) => ipcRenderer.invoke('delete-group', id),

  // دوال المواد
  getCourses: () => ipcRenderer.invoke('get-courses'),
  addCourse: (name, code, metadata) => ipcRenderer.invoke('add-course', name, code, metadata),
  updateCourse: (id, name, code, metadata) => ipcRenderer.invoke('update-course', id, name, code, metadata),
  deleteCourse: (id) => ipcRenderer.invoke('delete-course', id),

  // دوال الأساتذة
  getProfessors: () => ipcRenderer.invoke('get-professors'),
  addProfessor: (name, email) => ipcRenderer.invoke('add-professor', name, email),
  updateProfessor: (id, name, email) => ipcRenderer.invoke('update-professor', id, name, email),
  deleteProfessor: (id) => ipcRenderer.invoke('delete-professor', id),

  // دوال القاعات
  getRooms: () => ipcRenderer.invoke('get-rooms'),
  addRoom: (name, capacity) => ipcRenderer.invoke('add-room', name, capacity),
  updateRoom: (id, name, capacity) => ipcRenderer.invoke('update-room', id, name, capacity),
  deleteRoom: (id) => ipcRenderer.invoke('delete-room', id),

  // دوال التكاليف
  getAssignments: (academicYear, semester, specialization) => ipcRenderer.invoke('get-assignments', academicYear, semester, specialization),
  addAssignment: (assignment) => ipcRenderer.invoke('add-assignment', assignment),
  updateAssignment: (id, assignment) => ipcRenderer.invoke('update-assignment', id, assignment),
  deleteAssignment: (id) => ipcRenderer.invoke('delete-assignment', id),
  checkConflicts: (assignment) => ipcRenderer.invoke('check-conflicts', assignment),

  // دوال السنوات الدراسية
  getAcademicYears: () => ipcRenderer.invoke('get-academic-years'),
  getActiveAcademicYear: () => ipcRenderer.invoke('get-active-academic-year'),
  addAcademicYear: (yearName, setAsCurrent) => ipcRenderer.invoke('add-academic-year', yearName, setAsCurrent),
  setActiveAcademicYear: (yearId) => ipcRenderer.invoke('set-active-academic-year', yearId),
  deleteAcademicYear: (yearId) => ipcRenderer.invoke('delete-academic-year', yearId),

  // دوال الفصول الدراسية
  getSemesters: (academicYearId) => ipcRenderer.invoke('get-semesters', academicYearId),
  getActiveSemester: (academicYearId) => ipcRenderer.invoke('get-active-semester', academicYearId),
  addSemester: (academicYearId, semesterName, startDate, endDate, setAsCurrent) => 
    ipcRenderer.invoke('add-semester', academicYearId, semesterName, startDate, endDate, setAsCurrent),
  setActiveSemester: (semesterId) => ipcRenderer.invoke('set-active-semester', semesterId),
  deleteSemester: (semesterId) => ipcRenderer.invoke('delete-semester', semesterId),

  // دوال الحصص الإضافية والتعويضات
  getExtraSessions: () => ipcRenderer.invoke('get-extra-sessions'),
  createExtraSession: (session) => ipcRenderer.invoke('create-extra-session', session),
  updateExtraSession: (session) => ipcRenderer.invoke('update-extra-session', session),
  deleteExtraSession: (id) => ipcRenderer.invoke('delete-extra-session', id),
  archivePastSessions: () => ipcRenderer.invoke('archive-past-sessions'),

  // دالة استيراد البيانات من سنة دراسية سابقة
  importDataFromPreviousYear: (sourceYearId, targetYearId, importSpecializations, importGroups, importCourses) => 
    ipcRenderer.invoke('import-data-from-previous-year', sourceYearId, targetYearId, importSpecializations, importGroups, importCourses)
});

// إضافة وظائف استيراد وتصدير البيانات إلى واجهة برمجة التطبيقات
contextBridge.exposeInMainWorld('dataUtils', {
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (data) => ipcRenderer.invoke('import-data', data),
  saveToFile: (data, defaultPath) => ipcRenderer.invoke('save-to-file', data, defaultPath),
  openFromFile: (defaultPath) => ipcRenderer.invoke('open-from-file', defaultPath),
  generatePDF: (htmlContent, options) => ipcRenderer.invoke('generate-pdf', htmlContent, options),
  getPrintSettings: () => ipcRenderer.invoke('get-print-settings'),
  savePrintSettings: (settings) => ipcRenderer.invoke('save-print-settings', settings)
});