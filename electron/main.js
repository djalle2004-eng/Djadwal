const { app, BrowserWindow, ipcMain, dialog, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabaseConnection, ...db } = require('./database');
const backup = require('./backup');
const url = require('url');
const isDev = process.env.NODE_ENV === 'development';
const { runMigrations, seedBasicData } = require('./migrations');
const { v4: uuidv4 } = require('uuid');
const { getConfigManager } = require('./config-manager');

function createWindow() {
  // Configuration de l'icône de l'application
  if (process.platform === 'win32') {
    app.setAppUserModelId(process.execPath);
  }

  // تعيين سياسة أمنية للمحتوى
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:5173;",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
          "style-src 'self' 'unsafe-inline' data: https:;",
          "img-src 'self' data: https:;",
          "font-src 'self' data: https:;",
          "connect-src 'self' http://localhost:5173 https://generativelanguage.googleapis.com;"
        ].join(' ')
      }
    });
  });

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

    // Function to show the About dialog
  function showAboutWindow() {
    const aboutWindow = new BrowserWindow({
      width: 600,
      height: 600,
      parent: win, // Make it modal
      modal: true,
      resizable: false,
      icon: path.join(__dirname, '../public/icon.ico'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Create HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>حول التطبيق</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background-color: #f5f5f5;
                  color: #333;
                  direction: rtl;
              }
              .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  padding: 30px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .header {
                  text-align: center;
                  margin-bottom: 20px;
                  padding-bottom: 15px;
                  border-bottom: 1px solid #eee;
              }
              .logo {
                  width: 80px;
                  height: 80px;
                  margin: 0 auto 15px;
                  display: block;
              }
              h1 {
                  margin: 0;
                  color: #2c3e50;
                  font-size: 24px;
              }
              .version {
                  color: #7f8c8d;
                  margin: 5px 0 15px;
                  font-size: 14px;
              }
              .info-section {
                  margin-bottom: 20px;
              }
              .info-section h2 {
                  color: #2c3e50;
                  font-size: 18px;
                  margin-bottom: 10px;
                  border-bottom: 1px solid #eee;
                  padding-bottom: 5px;
              }
              .info-item {
                  margin-bottom: 8px;
                  line-height: 1.5;
              }
              .footer {
                  margin-top: 25px;
                  text-align: center;
                  font-size: 13px;
                  color: #7f8c8d;
                  border-top: 1px solid #eee;
                  padding-top: 15px;
              }
              .btn-close {
                  display: block;
                  width: 100px;
                  margin: 20px auto 0;
                  padding: 8px 15px;
                  background-color: #3498db;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 14px;
              }
              .btn-close:hover {
                  background-color: #2980b9;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Djadwal</h1>
                  <div class="version">النسخة ${app.getVersion()}</div>
              </div>
              
              <div class="info-section">
                  <h2>معلومات التطبيق</h2>
                  <div class="info-item">
                      <strong>الاسم:</strong> Djadwal - نظام إدارة الجداول الدراسية
                  </div>
                  <div class="info-item">
                      <strong>الوصف:</strong> تطبيق لإنشاء وإدارة الجداول الدراسية للمؤسسات التعليمية
                  </div>
                  <div class="info-item">
                      <strong>الإصدار:</strong> ${app.getVersion()}
                  </div>
              </div>
              
              <div class="info-section">
                  <h2>الملكية الفكرية</h2>
                  <div class="info-item">
                      <strong>المطور:</strong> د. علي حسين
                  </div>
                  <div class="info-item">
                      <strong>البريد الإلكتروني:</strong> hussain-ali@univ-eloued.dz
                  </div>
                  <div class="info-item">
                      <strong>سنة التطوير:</strong> 2024-2025
                  </div>
                  <div class="info-item">
                      <strong>جميع الحقوق محفوظة &copy; 2024-2025</strong>
                  </div>
              </div>
              
              <div class="info-section">
                  <h2>الشروط والتراخيص</h2>
                  <div class="info-item">
                      هذا التطبيق مرخص بموجب شروط الاستخدام الخاصة بالمطور.
                      يمنع نسخ أو توزيع هذا التطبيق دون إذن كتابي مسبق.
                  </div>
              </div>
              
              <div class="footer">
                  <button class="btn-close" onclick="window.close()">إغلاق</button>
              </div>
          </div>
      </body>
      </html>
    `;

    // Set the content
    aboutWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`);
  }

// ---> START: Menu Creation <--- 
  const menuTemplate = [
    {
      label: 'ملف',
      submenu: [
        {
          label: 'لوحة التحكم',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            win.webContents.send('navigate-to', '/');
          }
        },
        { type: 'separator' },
        {
          label: 'إعدادات قاعدة البيانات',
          click: () => {
            win.webContents.send('navigate-to', '/database-settings');
          }
        },
        {
          label: 'إعدادات الطباعة',
          click: () => {
            win.webContents.send('navigate-to', '/print-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'نسخة احتياطية',
          submenu: [
            {
              label: 'إنشاء نسخة احتياطية',
              accelerator: 'CmdOrCtrl+B',
              click: () => {
                win.webContents.send('navigate-to', '/backup');
              }
            },
            {
              label: 'استعادة نسخة احتياطية',
              click: () => {
                win.webContents.send('navigate-to', '/backup');
              }
            }
          ]
        },
        {
          label: 'استيراد وتصدير',
          submenu: [
            {
              label: 'تصدير البيانات',
              click: () => {
                win.webContents.send('export-data-trigger');
              }
            },
            {
              label: 'استيراد البيانات',
              click: () => {
                win.webContents.send('import-data-trigger');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'طباعة',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            win.webContents.send('print-trigger');
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'خروج', accelerator: 'CmdOrCtrl+Q' }
      ]
    },
    {
      label: 'تحرير',
      submenu: [
        { role: 'undo', label: 'تراجع', accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo', label: 'إعادة', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { role: 'cut', label: 'قص', accelerator: 'CmdOrCtrl+X' },
        { role: 'copy', label: 'نسخ', accelerator: 'CmdOrCtrl+C' },
        { role: 'paste', label: 'لصق', accelerator: 'CmdOrCtrl+V' },
        { role: 'selectAll', label: 'تحديد الكل', accelerator: 'CmdOrCtrl+A' },
        { type: 'separator' },
        {
          label: 'بحث',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            win.webContents.send('trigger-search');
            console.log('Menu: Triggering search in renderer process.');
          }
        }
      ]
    },
    {
      label: 'البيانات',
      submenu: [
        {
          label: 'الأساتذة',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            win.webContents.send('navigate-to', '/professors');
          }
        },
        {
          label: 'المقاييس',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            win.webContents.send('navigate-to', '/courses');
          }
        },
        {
          label: 'القاعات',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            win.webContents.send('navigate-to', '/rooms');
          }
        },
        {
          label: 'الأفواج',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            win.webContents.send('navigate-to', '/groups');
          }
        },
        { type: 'separator' },
        {
          label: 'الأقسام',
          click: () => {
            win.webContents.send('navigate-to', '/departments');
          }
        },
        {
          label: 'التخصصات',
          click: () => {
            win.webContents.send('navigate-to', '/specializations');
          }
        },
        { type: 'separator' },
        {
          label: 'السنوات الدراسية',
          click: () => {
            win.webContents.send('navigate-to', '/academic-years');
          }
        }
      ]
    },
    {
      label: 'الجداول',
      submenu: [
        {
          label: 'عرض الجداول',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            win.webContents.send('navigate-to', '/schedule');
          }
        },
        {
          label: 'إدارة الحصص',
          click: () => {
            win.webContents.send('navigate-to', '/assignments');
          }
        },
        {
          label: 'الحصص الإضافية',
          click: () => {
            win.webContents.send('navigate-to', '/extra-sessions');
          }
        },
        { type: 'separator' },
        {
          label: 'التحقق من التعارضات',
          click: () => {
            win.webContents.send('check-conflicts');
          }
        },
        { type: 'separator' },
        {
          label: 'طباعة الجداول',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            win.webContents.send('print-schedules');
          }
        }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        { role: 'reload', label: 'إعادة تحميل', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', label: 'إعادة تحميل قسرية', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'حجم افتراضي', accelerator: 'CmdOrCtrl+0' },
        { role: 'zoomIn', label: 'تكبير', accelerator: 'CmdOrCtrl+Plus' },
        { role: 'zoomOut', label: 'تصغير', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'ملء الشاشة', accelerator: 'F11' },
        { type: 'separator' },
        { 
          role: 'toggleDevTools', 
          label: 'أدوات المطور', 
          accelerator: 'CmdOrCtrl+Shift+I',
          visible: isDev
        }
      ]
    },
    {
      label: 'نافذة',
      submenu: [
        { role: 'minimize', label: 'تصغير', accelerator: 'CmdOrCtrl+M' },
        { role: 'close', label: 'إغلاق', accelerator: 'CmdOrCtrl+W' }
      ]
    },
    {
      label: 'مساعدة',
      submenu: [
        {
          label: 'حول التطبيق',
          click: () => showAboutWindow()
        },
        { type: 'separator' },
        {
          label: 'دليل المستخدم',
          click: () => {
            win.webContents.send('show-user-guide');
          }
        },
        {
          label: 'اختصارات لوحة المفاتيح',
          accelerator: 'CmdOrCtrl+/',
          click: () => {
            win.webContents.send('show-keyboard-shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'سجل العمليات',
          click: () => {
            win.webContents.send('navigate-to', '/audit-log');
          }
        }
      ]
    }
  ];

  // Build the menu from the template
  const menu = Menu.buildFromTemplate(menuTemplate);
  // Set the application menu
  Menu.setApplicationMenu(menu);
  // ---> END: Menu Creation <--- 

  console.log('Current directory:', __dirname);
  console.log('Process environment:', process.env.NODE_ENV);
  
  // تحميل التطبيق من خادم التطوير أو من ملف HTML محلي في وضع الإنتاج
  if (isDev) {
    console.log('Running in development mode, loading from localhost');
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Running in production mode, loading from:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    
    // استخدم بروتوكول file: بشكل صريح
    win.loadURL(url.format({
      pathname: indexPath,
      protocol: 'file:',
      slashes: true
    }));
  }
  
  // Suppression de l'ouverture automatique des DevTools en production
  // win.webContents.openDevTools();
}

// معالجات الإعدادات (لا تحتاج لقاعدة البيانات)
function setupConfigHandlers() {
  // معالجات الإعدادات (Config)
  ipcMain.handle('get-config', () => {
    const configManager = getConfigManager();
    return configManager.getConfig();
  });

  ipcMain.handle('get-database-config', () => {
    const configManager = getConfigManager();
    return configManager.getDatabaseConfig();
  });

  ipcMain.handle('update-database-config', (_, dbConfig) => {
    const configManager = getConfigManager();
    return configManager.updateDatabaseConfig(dbConfig);
  });

  ipcMain.handle('is-database-configured', () => {
    const configManager = getConfigManager();
    return configManager.isDatabaseConfigured();
  });

  ipcMain.handle('get-config-path', () => {
    const configManager = getConfigManager();
    return configManager.getConfigPath();
  });
}

// إعداد معالجات IPC للتعامل مع قاعدة البيانات
function setupIpcHandlers() {
  // معالجات الأقسام
  ipcMain.handle('get-departments', () => db.getDepartments());
  ipcMain.handle('add-department', (_, name, code) => db.addDepartment(name, code));
  ipcMain.handle('update-department', (_, id, name, code) => db.updateDepartment(id, name, code));
  ipcMain.handle('delete-department', (_, id) => db.deleteDepartment(id));

  // معالجات المجموعات
  ipcMain.handle('get-groups', () => db.getGroups());
  ipcMain.handle('add-group', (_, name, specialization, parent_group_id, department_id, group_type, year) => 
    db.addGroup(name, specialization, parent_group_id, department_id, group_type, year)
  );
  ipcMain.handle('update-group', (_, id, name, specialization, parent_group_id, department_id, group_type, year) => 
    db.updateGroup(id, name, specialization, parent_group_id, department_id, group_type, year)
  );
  ipcMain.handle('delete-group', (_, id) => db.deleteGroup(id));

  // معالجات المواد
  ipcMain.handle('get-courses', () => db.getCourses());
  ipcMain.handle('add-course', (_, name, code, metadata) => db.addCourse(name, code, metadata));
  ipcMain.handle('update-course', (_, id, name, code, metadata) => db.updateCourse(id, name, code, metadata));
  ipcMain.handle('delete-course', (_, id) => db.deleteCourse(id));

  // معالجات الأساتذة
  ipcMain.handle('get-professors', () => db.getProfessors());
  ipcMain.handle('add-professor', (_, name, email, metadata) => db.addProfessor(name, email, metadata));
  ipcMain.handle('update-professor', (_, id, name, email, metadata) => db.updateProfessor(id, name, email, metadata));
  ipcMain.handle('delete-professor', (_, id) => db.deleteProfessor(id));

  // معالجات القاعات
  ipcMain.handle('get-rooms', () => db.getRooms());
  ipcMain.handle('add-room', (_, name, capacity) => db.addRoom(name, capacity));
  ipcMain.handle('update-room', (_, id, name, capacity) => db.updateRoom(id, name, capacity));
  ipcMain.handle('delete-room', (_, id) => db.deleteRoom(id));

  // معالجات التكاليف
  ipcMain.handle('get-assignments', (_, academicYear, semester, specialization) => 
    db.getAssignments(academicYear, semester, specialization)
  );
  ipcMain.handle('add-assignment', (_, assignment) => {
    const conflicts = db.checkConflicts(assignment);
    if (conflicts.count > 0) {
      throw new Error('يوجد تعارض في الجدول الزمني');
    }
    return db.addAssignment(assignment);
  });
  ipcMain.handle('update-assignment', (_, id, assignment) => {
    const conflicts = db.checkConflicts({ ...assignment, id });
    if (conflicts.count > 0) {
      throw new Error('يوجد تعارض في الجدول الزمني');
    }
    return db.updateAssignment(id, assignment);
  });
  ipcMain.handle('delete-assignment', (_, id) => db.deleteAssignment(id));
  ipcMain.handle('check-conflicts', (_, assignment) => db.checkConflicts(assignment));

  // معالجات السنوات الدراسية
  ipcMain.handle('get-academic-years', () => db.getAcademicYears());
  ipcMain.handle('get-active-academic-year', () => db.getActiveAcademicYear());
  ipcMain.handle('add-academic-year', (_, yearName, setAsCurrent) => db.addAcademicYear(yearName, setAsCurrent));
  ipcMain.handle('set-active-academic-year', (_, yearId) => db.setActiveAcademicYear(yearId));
  ipcMain.handle('delete-academic-year', (_, yearId) => db.deleteAcademicYear(yearId));

  // معالجات الفصول الدراسية
  ipcMain.handle('get-semesters', (_, academicYearId) => db.getSemesters(academicYearId));
  ipcMain.handle('get-active-semester', (_, academicYearId) => db.getActiveSemester(academicYearId));
  ipcMain.handle('add-semester', (_, academicYearId, semesterName, startDate, endDate, setAsCurrent) => 
    db.addSemester(academicYearId, semesterName, startDate, endDate, setAsCurrent)
  );
  ipcMain.handle('set-active-semester', (_, semesterId) => db.setActiveSemester(semesterId));
  ipcMain.handle('update-semester', (_, semesterId, semesterName, startDate, endDate) => 
    db.updateSemester(semesterId, semesterName, startDate, endDate)
  );
  ipcMain.handle('delete-semester', (_, semesterId) => db.deleteSemester(semesterId));

  // معالج لجلب معلومات قاعدة البيانات
  ipcMain.handle('get-database-info', async () => {
    const USE_NEON = process.env.USE_NEON !== 'false';
    const hasConnectionString = !!process.env.NEON_CONNECTION_STRING;
    
    return {
      type: USE_NEON ? 'Neon PostgreSQL' : 'SQLite',
      status: db ? 'متصل' : 'غير متصل',
      name: USE_NEON ? 'Djadwal (Cloud)' : 'Djadwal (Local)',
      isCloud: USE_NEON,
      hasConnectionString: hasConnectionString
    };
  });

  // معالج للتشخيص - عرض البيانات الفعلية
  ipcMain.handle('debug-database-content', async () => {
    try {
      const years = await db.getAcademicYears();
      const semesters = await db.getSemesters();
      const assignments = await db.getAssignments(null, null, null);
      
      console.log('📊 DATABASE CONTENT DEBUG:');
      console.log('Academic Years:', years);
      console.log('Semesters:', semesters);
      console.log('Total Assignments:', assignments.length);
      
      return {
        years,
        semesters,
        assignmentsCount: assignments.length,
        sampleAssignments: assignments.slice(0, 3)
      };
    } catch (error) {
      console.error('Debug error:', error);
      return { error: error.message };
    }
  });

  // معالج لإصلاح أسماء الفصول في قاعدة البيانات
  ipcMain.handle('fix-semester-names', async () => {
    try {
      console.log('🔧 Fixing semester names...');
      await db.executeQuery(
        "UPDATE semesters SET semester_name = 'الفصل الأول' WHERE semester_name LIKE '%داسي الأول%' OR semester_name LIKE '%السداسي الأول%'"
      );
      await db.executeQuery(
        "UPDATE semesters SET semester_name = 'الفصل الثاني' WHERE semester_name LIKE '%داسي الثاني%' OR semester_name LIKE '%السداسي الثاني%'"
      );
      console.log('✅ Semester names fixed!');
      return { success: true };
    } catch (error) {
      console.error('❌ Error fixing semester names:', error);
      return { success: false, error: error.message };
    }
  });

  // معالجات الحصص الإضافية والتعويضات
  ipcMain.handle('get-extra-sessions', async () => {
    return await db.getExtraSessions();
  });

  ipcMain.handle('get-time-slots', async () => {
    return await db.getTimeSlots();
  });

  ipcMain.handle('create-extra-session', (_, session) => {
    // TODO: Ajouter la vérification des conflits pour les séances supplémentaires
    return db.createExtraSession(session);
  });
  ipcMain.handle('update-extra-session', (_, session) => {
    // TODO: Ajouter la vérification des conflits pour les séances supplémentaires
    return db.updateExtraSession(session);
  });
  ipcMain.handle('delete-extra-session', (_, id) => db.deleteExtraSession(id));
  
  ipcMain.handle('archive-past-sessions', async () => {
    return await db.archivePastSessions();
  });

  // معالج استيراد البيانات من سنة دراسية سابقة
  ipcMain.handle('import-data-from-previous-year', (_, sourceYearId, targetYearId, importSpecializations, importGroups, importCourses) => 
    db.importDataFromPreviousYear(sourceYearId, targetYearId, importSpecializations, importGroups, importCourses)
  );

  // معالجات المصادقة والمستخدمين
  ipcMain.handle('login', (_, username, password) => db.login(username, password));
  ipcMain.handle('logout', (_, userId) => db.logout(userId));
  ipcMain.handle('get-users', () => db.getUsers());
  ipcMain.handle('add-user', (_, userData) => db.addUser(userData));
  ipcMain.handle('update-user', (_, id, userData) => db.updateUser(id, userData));
  ipcMain.handle('delete-user', (_, id) => db.deleteUser(id));
  ipcMain.handle('change-password', (_, userId, oldPassword, newPassword) => 
    db.changePassword(userId, oldPassword, newPassword)
  );
  ipcMain.handle('reset-password', (_, userId, newPassword) => db.resetPassword(userId, newPassword));
  ipcMain.handle('toggle-user-status', (_, userId, isActive) => db.toggleUserStatus(userId, isActive));
  ipcMain.handle('get-audit-logs', (_, filters) => db.getAuditLogs(filters));
  ipcMain.handle('get-user-permissions', (_, userId) => db.getUserPermissions(userId));
  ipcMain.handle('save-user-permissions', (_, userId, permissionsJson) => db.saveUserPermissions(userId, permissionsJson));

  // معالجات النسخ الاحتياطي
  ipcMain.handle('create-backup', async (_, options) => {
    try {
      return await backup.createFullBackup(options);
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  });

  ipcMain.handle('restore-backup', async (_, options) => {
    try {
      return await backup.restoreBackup(options);
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw error;
    }
  });

  ipcMain.handle('get-backup-history', async () => {
    try {
      return await backup.getBackupHistory();
    } catch (error) {
      console.error('Error getting backup history:', error);
      return [];
    }
  });

  ipcMain.handle('delete-backup', async (_, backupId) => {
    try {
      return await backup.deleteBackup(backupId);
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw error;
    }
  });

  // معالجات إضافية للنسخ الاحتياطي (مؤقتة)
  ipcMain.handle('export-to-json', async (_, academicYearId) => {
    return { message: 'Export to JSON not yet implemented' };
  });

  ipcMain.handle('import-from-json', async (_, jsonData, mode) => {
    return { message: 'Import from JSON not yet implemented' };
  });

  ipcMain.handle('get-backup-settings', async () => {
    return { autoBackup: false, backupPath: '', schedule: 'daily' };
  });

  ipcMain.handle('save-backup-settings', async (_, settings) => {
    return { success: true };
  });

  ipcMain.handle('schedule-auto-backup', async (_, settings) => {
    return { success: true };
  });

  ipcMain.handle('stop-auto-backup', async () => {
    return { success: true };
  });

  ipcMain.handle('preview-backup', async (_, backupId) => {
    return { message: 'Preview not yet implemented' };
  });

  ipcMain.handle('validate-backup', async (_, backupId) => {
    return { valid: true };
  });
}

// إضافة وظائف استيراد وتصدير البيانات
function setupDataHandlers() {
  // تصدير البيانات إلى ملف JSON
  ipcMain.handle('export-data', () => {
    try {
      const groups = db.getGroups();
      const courses = db.getCourses();
      const professors = db.getProfessors();
      const rooms = db.getRooms();
      const assignments = db.getAssignments();

      const data = {
        groups,
        courses,
        professors,
        rooms,
        assignments,
        exportDate: new Date().toISOString()
      };

      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  });

  // استيراد البيانات من ملف JSON
  ipcMain.handle('import-data', (_, data) => {
    try {
      // حذف البيانات الحالية
      const assignments = db.getAssignments();
      for (const assignment of assignments) {
        db.deleteAssignment(assignment.id);
      }

      // استيراد التكاليف الجديدة
      for (const assignment of data.assignments) {
        db.addAssignment(assignment);
      }

      return { success: true };
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  });
  
  // حفظ الملف
  ipcMain.handle('save-to-file', async (_, data, defaultPath) => {
    try {
      const { dialog } = require('electron');
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultPath || 'export.json',
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ]
      });
      
      if (!canceled && filePath) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return { success: true, path: filePath };
      }
      
      return { success: false, message: 'تم إلغاء العملية' };
    } catch (error) {
      console.error('Error saving file:', error);
      return { success: false, error: error.message };
    }
  });
  
  // فتح الملف
  ipcMain.handle('open-from-file', async (_, defaultPath) => {
    try {
      const { dialog } = require('electron');
      const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: defaultPath || '',
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ],
        properties: ['openFile']
      });
      
      if (!canceled && filePaths.length > 0) {
        const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
        return { success: true, data, path: filePaths[0] };
      }
      
      return { success: false, message: 'تم إلغاء العملية' };
    } catch (error) {
      console.error('Error opening file:', error);
      return { success: false, error: error.message };
    }
  });
  
  // ✅ PDF generation now handled by html2pdf.js in the frontend
  // This handler is kept for backward compatibility but returns an error
  ipcMain.handle('generate-pdf', async (_, htmlContent, options) => {
    console.warn('Legacy generate-pdf handler called. Please use html2pdf.js in the frontend instead.');
    return { 
      success: false, 
      error: 'PDF generation moved to frontend. Use printContent() from printUtils.ts instead.' 
    };
  });
}

// Chemin vers le fichier de paramètres d'impression
const printSettingsPath = path.join(app.getPath('userData'), 'print-settings.json');

// Fonction pour créer le dossier des logos si nécessaire
function ensureLogosDirectory() {
  const logosDir = path.join(app.getPath('userData'), 'logos');
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }
  return logosDir;
}

// Fonction pour sauvegarder une image depuis une URL de données
async function saveDataUrlAsImage(dataUrl, filename) {
  const logosDir = ensureLogosDirectory();
  const filePath = path.join(logosDir, filename);
  
  // Extraire les données de base64
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL');
  }
  
  const data = Buffer.from(matches[2], 'base64');
  fs.writeFileSync(filePath, data);
  
  return filePath;
}

// Gestionnaire pour récupérer les paramètres d'impression
ipcMain.handle('get-print-settings', async () => {
  try {
    // Vérifier si le fichier existe
    if (!fs.existsSync(printSettingsPath)) {
      // Retourner des valeurs par défaut si le fichier n'existe pas
      return {
        universityName: '',
        facultyName: '',
        universityLogoUrl: '',
        facultyLogoUrl: '',
        headerFontSize: 16,
        titleFontSize: 16,
        subtitleFontSize: 14,
        cellContentFontSize: 10,
        logoSize: 80,
        cellPadding: 3,
        lineHeight: 1.2,
        marginBetweenLines: 2,
        tableCellAlignment: 'center',
        pageMarginTop: 5,
        pageMarginBottom: 5,
        pageMarginLeft: 5,
        pageMarginRight: 5
      };
    }
    
    // Lire et parser le fichier JSON
    console.log('📖 [Main] Reading settings from:', printSettingsPath);
    const settingsData = fs.readFileSync(printSettingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    console.log('📥 [Main] Loaded raw settings:', settings);
    
    // Vérifier si les logos existent et les convertir en URLs de données
    if (settings.universityLogoPath && fs.existsSync(settings.universityLogoPath)) {
      const logoData = fs.readFileSync(settings.universityLogoPath);
      const extension = path.extname(settings.universityLogoPath).substring(1);
      settings.universityLogoUrl = `data:image/${extension};base64,${logoData.toString('base64')}`;
    }
    
    if (settings.facultyLogoPath && fs.existsSync(settings.facultyLogoPath)) {
      const logoData = fs.readFileSync(settings.facultyLogoPath);
      const extension = path.extname(settings.facultyLogoPath).substring(1);
      settings.facultyLogoUrl = `data:image/${extension};base64,${logoData.toString('base64')}`;
    }
    
    // S'assurer que les paramètres de taille ont des valeurs par défaut s'ils n'existent pas
    settings.headerFontSize = settings.headerFontSize || 16;
    settings.titleFontSize = settings.titleFontSize || 16;
    settings.subtitleFontSize = settings.subtitleFontSize || 14;
    settings.cellContentFontSize = settings.cellContentFontSize || 10;
    settings.logoSize = settings.logoSize || 80;
    // القيم الافتراضية للإعدادات الجديدة
    settings.cellPadding = settings.cellPadding ?? 3;
    settings.lineHeight = settings.lineHeight ?? 1.2;
    settings.marginBetweenLines = settings.marginBetweenLines ?? 2;
    settings.tableCellAlignment = settings.tableCellAlignment || 'center';
    settings.pageMarginTop = settings.pageMarginTop ?? 5;
    settings.pageMarginBottom = settings.pageMarginBottom ?? 5;
    settings.pageMarginLeft = settings.pageMarginLeft ?? 5;
    settings.pageMarginRight = settings.pageMarginRight ?? 5;
    
    console.log('✅ [Main] Final settings to return:', settings);
    return settings;
  } catch (error) {
    console.error('Error getting print settings:', error);
    throw error;
  }
});

// Gestionnaire pour sauvegarder les paramètres d'impression
ipcMain.handle('save-print-settings', async (event, settings) => {
  try {
    console.log('🔵 [Main] Received settings to save:', settings);
    
    // حذف الشعارات القديمة إذا تم تحديث الشعارات
    const oldSettings = fs.existsSync(printSettingsPath) 
      ? JSON.parse(fs.readFileSync(printSettingsPath, 'utf8'))
      : {};
    
    const settingsToSave = {
      universityName: settings.universityName,
      facultyName: settings.facultyName,
      departmentName: settings.departmentName,
      // أحجام الخطوط
      headerFontSize: settings.headerFontSize || 16,
      titleFontSize: settings.titleFontSize || 16,
      subtitleFontSize: settings.subtitleFontSize || 14,
      cellContentFontSize: settings.cellContentFontSize || 10,
      footerFontSize: settings.footerFontSize || 10,
      logoSize: settings.logoSize || 80,
      // إعدادات تنسيق الجداول
      cellPadding: settings.cellPadding || 3,
      lineHeight: settings.lineHeight || 1.2,
      marginBetweenLines: settings.marginBetweenLines || 2,
      sessionGap: settings.sessionGap || 8,
      tableCellAlignment: settings.tableCellAlignment || 'center',
      tableBorderWidth: settings.tableBorderWidth || 1,
      tableBorderColor: settings.tableBorderColor || '#000000',
      // هوامش الصفحة
      pageMarginTop: settings.pageMarginTop || 5,
      pageMarginBottom: settings.pageMarginBottom || 5,
      pageMarginLeft: settings.pageMarginLeft || 5,
      pageMarginRight: settings.pageMarginRight || 5,
      // إعدادات الصفحة
      pageSize: settings.pageSize || 'A4',
      showPageNumbers: settings.showPageNumbers || false,
      showPrintDate: settings.showPrintDate ?? true,
      // علامة مائية
      watermarkText: settings.watermarkText || '',
      watermarkOpacity: settings.watermarkOpacity || 0.1,
      // تاريخ التحديث
      updatedAt: new Date().toISOString()
    };
    
    // Sauvegarder les logos si fournis
    if (settings.universityLogoUrl && settings.universityLogoUrl.startsWith('data:')) {
      // حذف الشعار القديم
      if (oldSettings.universityLogoPath && fs.existsSync(oldSettings.universityLogoPath)) {
        try {
          fs.unlinkSync(oldSettings.universityLogoPath);
        } catch (err) {
          console.warn('Could not delete old university logo:', err);
        }
      }
      const filename = `university-logo-${uuidv4()}${getExtensionFromDataUrl(settings.universityLogoUrl)}`;
      settingsToSave.universityLogoPath = await saveDataUrlAsImage(settings.universityLogoUrl, filename);
    } else if (oldSettings.universityLogoPath) {
      settingsToSave.universityLogoPath = oldSettings.universityLogoPath;
    }
    
    if (settings.facultyLogoUrl && settings.facultyLogoUrl.startsWith('data:')) {
      // حذف الشعار القديم
      if (oldSettings.facultyLogoPath && fs.existsSync(oldSettings.facultyLogoPath)) {
        try {
          fs.unlinkSync(oldSettings.facultyLogoPath);
        } catch (err) {
          console.warn('Could not delete old faculty logo:', err);
        }
      }
      const filename = `faculty-logo-${uuidv4()}${getExtensionFromDataUrl(settings.facultyLogoUrl)}`;
      settingsToSave.facultyLogoPath = await saveDataUrlAsImage(settings.facultyLogoUrl, filename);
    } else if (oldSettings.facultyLogoPath) {
      settingsToSave.facultyLogoPath = oldSettings.facultyLogoPath;
    }
    
    // Écrire les paramètres dans le fichier
    console.log('💾 [Main] Writing settings to file:', settingsToSave);
    console.log('📂 [Main] File path:', printSettingsPath);
    fs.writeFileSync(printSettingsPath, JSON.stringify(settingsToSave, null, 2));
    
    // تسجيل في Audit Log
    try {
      await db.addAuditLog({
        user_id: null, // يمكن تمرير user_id من الواجهة
        action: 'update',
        entity_type: 'print_settings',
        entity_id: null,
        details: 'تحديث إعدادات الطباعة',
        ip_address: null
      });
    } catch (auditError) {
      console.warn('Failed to log print settings update:', auditError);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving print settings:', error);
    throw error;
  }
});

// Fonction pour obtenir l'extension de fichier à partir d'une URL de données
function getExtensionFromDataUrl(dataUrl) {
  const matches = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,/);
  if (matches && matches.length > 1) {
    return `.${matches[1]}`;
  }
  return '.png'; // Extension par défaut
}

// ---> START: Listener for Renderer Process Ready <--- 
// Handle message from renderer when it's ready for search (optional but good practice)
ipcMain.on('renderer-ready-for-search', (event) => {
  console.log('Renderer process is ready for search events.');
  // You could enable the menu item here if it was initially disabled
});
// ---> END: Listener for Renderer Process Ready <--- 

// تهيئة التطبيق عند الاستعداد
app.whenReady().then(async () => {
  try {
    console.log('Initializing application...');
    
    // إعداد معالجات الإعدادات أولاً (لا تحتاج لـ DB)
    setupConfigHandlers();
    
    // التحقق من إعدادات قاعدة البيانات
    const configManager = getConfigManager();
    const isConfigured = configManager.isDatabaseConfigured();
    
    if (!isConfigured) {
      console.log('⚠️ Database not configured, opening settings page...');
      
      // إنشاء النافذة وتوجيهها لصفحة الإعدادات
      createWindow();
      
      // تأخير بسيط للتأكد من تحميل النافذة
      setTimeout(() => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const win = windows[0];
          if (isDev) {
            win.loadURL('http://localhost:5173/#/database-settings');
          } else {
            const indexPath = path.join(__dirname, '../dist/index.html');
            win.loadURL(url.format({
              pathname: indexPath,
              protocol: 'file:',
              slashes: true,
              hash: '/database-settings'
            }));
          }
        }
      }, 1000);
      
    } else {
      // إعداد قاعدة البيانات وتشغيل الترقيات
      try {
        console.log('📊 Initializing database connection...');
        await initDatabaseConnection();
        console.log('✅ Database connected successfully');
        
        console.log('🔄 Running migrations...');
        runMigrations();
        console.log('✅ Migrations completed');
        
        console.log('🌱 Seeding basic data...');
        seedBasicData();
        console.log('✅ Data seeded');
        
        // إعداد معالجات IPC للبيانات (بعد تهيئة DB)
        console.log('🔌 Setting up IPC handlers...');
        setupIpcHandlers();
        setupDataHandlers();
        console.log('✅ IPC handlers ready');
        
        createWindow();
      } catch (dbError) {
        console.error('❌ Database initialization failed:', dbError);
        
        // فتح صفحة الإعدادات
        createWindow();
        setTimeout(() => {
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            const win = windows[0];
            if (isDev) {
              win.loadURL('http://localhost:5173/#/database-settings');
            } else {
              const indexPath = path.join(__dirname, '../dist/index.html');
              win.loadURL(url.format({
                pathname: indexPath,
                protocol: 'file:',
                slashes: true,
                hash: '/database-settings'
              }));
            }
          }
        }, 1000);
        
        // إظهار رسالة خطأ
        setTimeout(() => {
          dialog.showErrorBox(
            'خطأ في الاتصال بقاعدة البيانات', 
            `فشل الاتصال بقاعدة البيانات:\n\n${dbError.message}\n\nيُرجى التحقق من إعدادات الاتصال.`
          );
        }, 2000);
      }
    }
    
    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error('Error initializing app:', error);
    dialog.showErrorBox('خطأ في تهيئة التطبيق', `حدث خطأ أثناء تهيئة التطبيق: ${error.message}\n\nيُرجى التحقق من إعدادات قاعدة البيانات.`);
    
    // إنشاء النافذة وفتح صفحة الإعدادات (بدون setupIpcHandlers لأن DB غير موجود)
    createWindow();
    
    setTimeout(() => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const win = windows[0];
        if (isDev) {
          win.loadURL('http://localhost:5173/#/database-settings');
        } else {
          const indexPath = path.join(__dirname, '../dist/index.html');
          win.loadURL(url.format({
            pathname: indexPath,
            protocol: 'file:',
            slashes: true,
            hash: '/database-settings'
          }));
        }
      }
    }, 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});