import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import url from 'url';
import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';

// Obtenir __dirname dans ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Imports locaux
import * as db from './database.js';
import { runMigrations, seedBasicData } from './migrations.js';

const isDev = process.env.NODE_ENV === 'development';

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
          "connect-src 'self' http://localhost:5173;"
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
}

// إعداد معالجات IPC للتعامل مع قاعدة البيانات
function setupIpcHandlers() {
  // معالجات الأقسام
  ipcMain.handle('get-departments', () => db.getDepartments());
  ipcMain.handle('add-department', (_, name, code) => db.addDepartment(name, code));
  ipcMain.handle('update-department', (_, id, name, code) => db.updateDepartment(id, name, code));
  ipcMain.handle('delete-department', (_, id) => db.deleteDepartment(id));

  // معالجات المجموعات - تحديث للهيكلية الجديدة
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
  ipcMain.handle('add-professor', (_, name, email) => db.addProfessor(name, email));
  ipcMain.handle('update-professor', (_, id, name, email) => db.updateProfessor(id, name, email));
  ipcMain.handle('delete-professor', (_, id) => db.deleteProfessor(id));

  // معالجات القاعات
  ipcMain.handle('get-rooms', () => db.getRooms());
  ipcMain.handle('add-room', (_, name, capacity) => db.addRoom(name, capacity));
  ipcMain.handle('update-room', (_, id, name, capacity) => db.updateRoom(id, name, capacity));
  ipcMain.handle('delete-room', (_, id) => db.deleteRoom(id));

  // معالجات التكاليف
  ipcMain.handle('get-assignments', (_, academicYear, semester, specialization) => db.getAssignments(academicYear, semester, specialization));
  ipcMain.handle('add-assignment', (_, assignment) => {
    // التحقق من التعارضات قبل الإضافة
    const conflicts = db.checkConflicts(assignment);
    if (conflicts.count > 0) {
      throw new Error('يوجد تعارض في الجدول الزمني');
    }
    return db.addAssignment(assignment);
  });
  ipcMain.handle('update-assignment', (_, id, assignment) => {
    // التحقق من التعارضات قبل التحديث
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
  ipcMain.handle('get-extra-sessions', () => db.getExtraSessions());
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
}

// إضافة وظائف استيراد وتصدير البيانات
function setupDataHandlers() {
  // تصدير البيانات إلى ملف JSON
  ipcMain.handle('export-data', async () => {
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
  ipcMain.handle('import-data', async (_, data) => {
    try {
      // حذف البيانات الحالية
      const assignments = db.getAssignments();
      for (const assignment of assignments) {
        db.deleteAssignment(assignment.id);
      }

      // استيراد التكاليف الجديدة
      for (const assignment of data.assignments) {
        // حذف الحقول التي لا تتطابق مع الجدول
        const { id, group_name, course_name, professor_name, room_name, created_at, ...newAssignment } = assignment;
        db.addAssignment(newAssignment);
      }

      return { success: true, message: 'تم استيراد البيانات بنجاح' };
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
  
  // إضافة معالج لإنشاء ملف PDF
  ipcMain.handle('generate-pdf', async (_, htmlContent, options) => {
    try {
      const puppeteer = require('puppeteer');
      const os = require('os');
      const path = require('path');
      
      // إنشاء مسار مؤقت للملف
      const tempDir = path.join(os.tmpdir(), 'suivie-pdf');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // تحديد اسم الملف
      const filename = options.filename || `document-${Date.now()}.pdf`;
      const outputPath = path.join(tempDir, filename);
      
      // إعداد خيارات إنشاء الملف
      const pdfOptions = {
        path: outputPath,
        format: options.format || 'A4',
        landscape: options.landscape !== undefined ? options.landscape : true,
        margin: options.margins || {
          top: '0.8cm',
          right: '0.8cm',
          bottom: '0.8cm',
          left: '0.8cm'
        },
        printBackground: true
      };
      
      // إنشاء متصفح Puppeteer
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // تعيين المحتوى HTML للملف
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // إنشاء الملف
      await page.pdf(pdfOptions);
      
      await browser.close();
      
      // قراءة الملف كـ Buffer
      const pdfBuffer = fs.readFileSync(outputPath);
      
      // حذف الملف المؤقت
      fs.unlinkSync(outputPath);
      
      return { success: true, buffer: pdfBuffer, filename };
    } catch (error) {
      console.error('Error generating PDF:', error);
      return { success: false, error: error.message };
    }
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
    const settingsData = fs.readFileSync(printSettingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    
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
    
    return settings;
  } catch (error) {
    console.error('Error getting print settings:', error);
    throw error;
  }
});

// Gestionnaire pour sauvegarder les paramètres d'impression
ipcMain.handle('save-print-settings', async (_, settings) => {
  try {
    console.log('🔵 [Main.cjs] Received settings to save:', settings);
    const settingsToSave = {
      universityName: settings.universityName,
      facultyName: settings.facultyName,
      // Ajouter les nouvelles propriétés pour les tailles de police et logo
      headerFontSize: settings.headerFontSize || 16,
      titleFontSize: settings.titleFontSize || 16,
      subtitleFontSize: settings.subtitleFontSize || 14,
      cellContentFontSize: settings.cellContentFontSize || 10,
      logoSize: settings.logoSize || 80,
      // إعدادات تنسيق الجداول الجديدة
      cellPadding: settings.cellPadding || 3,
      lineHeight: settings.lineHeight || 1.2,
      marginBetweenLines: settings.marginBetweenLines || 2,
      tableCellAlignment: settings.tableCellAlignment || 'center',
      pageMarginTop: settings.pageMarginTop || 5,
      pageMarginBottom: settings.pageMarginBottom || 5,
      pageMarginLeft: settings.pageMarginLeft || 5,
      pageMarginRight: settings.pageMarginRight || 5
    };
    
    // Sauvegarder les logos si fournis
    if (settings.universityLogoUrl && settings.universityLogoUrl.startsWith('data:')) {
      const filename = `university-logo-${uuidv4()}${getExtensionFromDataUrl(settings.universityLogoUrl)}`;
      settingsToSave.universityLogoPath = await saveDataUrlAsImage(settings.universityLogoUrl, filename);
    }
    
    if (settings.facultyLogoUrl && settings.facultyLogoUrl.startsWith('data:')) {
      const filename = `faculty-logo-${uuidv4()}${getExtensionFromDataUrl(settings.facultyLogoUrl)}`;
      settingsToSave.facultyLogoPath = await saveDataUrlAsImage(settings.facultyLogoUrl, filename);
    }
    
    // Écrire les paramètres dans le fichier
    console.log('💾 [Main.cjs] Writing settings to file:', settingsToSave);
    fs.writeFileSync(printSettingsPath, JSON.stringify(settingsToSave, null, 2));
    
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

app.whenReady().then(() => {
  try {
    // تشغيل ترقيات قاعدة البيانات وتهيئة البيانات الأساسية
    runMigrations();
    seedBasicData();
    
    // إعداد معالجات IPC
    setupIpcHandlers();
    setupDataHandlers();
    
    // إنشاء النافذة الرئيسية
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error('Error during app initialization:', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});