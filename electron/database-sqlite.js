const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Chemin de la base de données locale
const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

// Initialiser la connexion à la base de données
let db = null;

// Initialiser la connexion à la base de données
function initDatabaseConnection() {
  try {
    if (!db) {
      db = new Database(dbPath);
      console.log('Database connected successfully to', dbPath);
    }
    return db;
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw new Error(`فشل الاتصال بقاعدة البيانات: ${error.message}`);
  }
}

// Exécuter une requête
function executeQuery(query, params = []) {
  try {
    const connection = initDatabaseConnection();
    return connection.prepare(query);
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Exécuter une requête de manière synchrone (wrapper)
function executeQuerySync(query, params = [], operation = 'query') {
  try {
    const connection = initDatabaseConnection();
    const stmt = connection.prepare(query);
    
    if (operation === 'run') {
      return stmt.run(...params);
    } else {
      return stmt.all(...params);
    }
  } catch (error) {
    console.error(`Error executing ${operation} (${query}):`, error);
    throw new Error(`فشل في تنفيذ الاستعلام: ${error.message}`);
  }
}

// Utiliser executeQuerySync comme alias pour executeQueryAsync
const executeQueryAsync = executeQuerySync;

// Initialiser la base de données
function initializeDatabase() {
  try {
    const db = initDatabaseConnection();

    // Création de la table des départements
    db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created departments table');

    // Création de la table des groupes
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT,
        parent_group_id INTEGER,
        department_id INTEGER,
        group_type TEXT DEFAULT 'group',
        year TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_group_id) REFERENCES groups (id),
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )
    `);
    console.log('Created groups table');

    // Création de la table des cours
    db.exec(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        metadata TEXT DEFAULT '{}',
        department_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )
    `);
    console.log('Created courses table');

    // Création de la table des professeurs
    db.exec(`
      CREATE TABLE IF NOT EXISTS professors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created professors table');

    // Création de la table des salles
    db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        capacity INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created rooms table');

    // Création de la table des attributions
    db.exec(`
      CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        course_id INTEGER NOT NULL,
        professor_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        session_type TEXT DEFAULT 'lecture',
        academic_year TEXT DEFAULT '',
        semester TEXT DEFAULT '1',
        specialization TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups (id),
        FOREIGN KEY (course_id) REFERENCES courses (id),
        FOREIGN KEY (professor_id) REFERENCES professors (id),
        FOREIGN KEY (room_id) REFERENCES rooms (id)
      )
    `);
    console.log('Created assignments table');

    // Création de la table des années académiques
    db.exec(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_name TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created academic_years table');

    // Création de la table des semestres
    db.exec(`
      CREATE TABLE IF NOT EXISTS semesters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        academic_year_id INTEGER NOT NULL,
        semester_name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        is_current INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years (id)
      )
    `);
    console.log('Created semesters table');

    // Création de la table des séances supplémentaires
    db.exec(`
      CREATE TABLE IF NOT EXISTS extra_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        course_id INTEGER NOT NULL,
        professor_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        session_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        description TEXT,
        session_type TEXT,
        academic_year TEXT,
        semester TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups (id),
        FOREIGN KEY (course_id) REFERENCES courses (id),
        FOREIGN KEY (professor_id) REFERENCES professors (id),
        FOREIGN KEY (room_id) REFERENCES rooms (id)
      )
    `);
    console.log('Created extra_sessions table');

    // Création des index pour la recherche rapide
    db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_group ON assignments(group_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_professor ON assignments(professor_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_room ON assignments(room_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_day ON assignments(day_of_week)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_semesters_academic_year ON semesters(academic_year_id)');

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw new Error(`فشل تهيئة قاعدة البيانات: ${error.message}`);
  }
}

// Exécuter les migrations de la base de données
function runMigrations() {
  try {
    console.log('Running database migrations...');
    const db = initDatabaseConnection();
    
    // Vérifier si la colonne academic_year existe dans la table assignments
    const assignmentsColumns = db.prepare("PRAGMA table_info(assignments)").all();
    const hasAcademicYearColumn = assignmentsColumns.some(col => col.name === 'academic_year');
    const hasSemesterColumn = assignmentsColumns.some(col => col.name === 'semester');
    const hasSpecializationColumn = assignmentsColumns.some(col => col.name === 'specialization');
    
    // Ajouter la colonne academic_year si elle n'existe pas
    if (!hasAcademicYearColumn) {
      console.log('Adding academic_year column to assignments table...');
      db.exec('ALTER TABLE assignments ADD COLUMN academic_year TEXT DEFAULT ""');
    }
    
    // Ajouter la colonne semester si elle n'existe pas
    if (!hasSemesterColumn) {
      console.log('Adding semester column to assignments table...');
      db.exec('ALTER TABLE assignments ADD COLUMN semester TEXT DEFAULT "1"');
    }
    
    // Ajouter la colonne specialization si elle n'existe pas
    if (!hasSpecializationColumn) {
      console.log('Adding specialization column to assignments table...');
      db.exec('ALTER TABLE assignments ADD COLUMN specialization TEXT DEFAULT ""');
    }
    
    // Vérifier si la colonne metadata existe dans la table courses
    const coursesColumns = db.prepare("PRAGMA table_info(courses)").all();
    const hasMetadataColumn = coursesColumns.some(col => col.name === 'metadata');
    
    // Ajouter la colonne metadata si elle n'existe pas
    if (!hasMetadataColumn) {
      console.log('Adding metadata column to courses table...');
      db.exec('ALTER TABLE courses ADD COLUMN metadata TEXT DEFAULT "{}"');
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running database migrations:', error);
  }
}

// دوال المجموعات - تحديث لدعم الهيكلية الجديدة
function getGroups() {
  return executeQuerySync(`
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
    ORDER BY g.name
  `);
}

function getGroupsByDepartment(departmentId) {
  return executeQuerySync(`
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
    WHERE g.department_id = ?
    ORDER BY g.name
  `, [departmentId]);
}

function getGroupsBySpecialization(specialization) {
  return executeQuerySync(`
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
    WHERE g.specialization = ? AND g.group_type = 'group'
    ORDER BY g.name
  `, [specialization]);
}

function getSpecializationsByDepartment(departmentId) {
  return executeQuerySync(`
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
    WHERE g.department_id = ? AND g.group_type = 'specialization'
    ORDER BY g.name
  `, [departmentId]);
}

function addGroup(name, specialization, parent_group_id, department_id, group_type, year) {
  const result = executeQuerySync(`
    INSERT INTO groups (
      name, specialization, parent_group_id, 
      department_id, group_type, year
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    name, 
    specialization || null, 
    parent_group_id || null, 
    department_id || null, 
    group_type || 'group', 
    year || null
  ], 'run');
  
  return { 
    id: result.lastInsertRowid, 
    name, 
    specialization, 
    parent_group_id, 
    department_id,
    group_type,
    year
  };
}

function updateGroup(id, name, specialization, parent_group_id, department_id, group_type, year) {
  executeQuerySync(`
    UPDATE groups SET 
      name = ?, 
      specialization = ?, 
      parent_group_id = ?,
      department_id = ?,
      group_type = ?,
      year = ?
    WHERE id = ?
  `, [
    name, 
    specialization || null, 
    parent_group_id || null, 
    department_id || null, 
    group_type || 'group', 
    year || null,
    id
  ], 'run');
  
  return { 
    id: Number(id), 
    name, 
    specialization, 
    parent_group_id, 
    department_id,
    group_type,
    year
  };
}

function deleteGroup(id) {
  return executeQuerySync('DELETE FROM groups WHERE id = ?', [id], 'run');
}

function deleteAllGroups() {
  return executeQuerySync('DELETE FROM groups', [], 'run');
}

// دوال المواد
function getCourses() {
  return executeQuerySync('SELECT * FROM courses ORDER BY name');
}

function addCourse(name, code, metadata = '{}') {
  const result = executeQuerySync(
    'INSERT INTO courses (name, code, metadata) VALUES (?, ?, ?)',
    [name, code, metadata],
    'run'
  );
  return { id: result.lastInsertRowid, name, code, metadata };
}

function updateCourse(id, name, code, metadata = '{}') {
  executeQuerySync(
    'UPDATE courses SET name = ?, code = ?, metadata = ? WHERE id = ?',
    [name, code, metadata, id],
    'run'
  );
  return { id, name, code, metadata };
}

function deleteCourse(id) {
  return executeQuerySync('DELETE FROM courses WHERE id = ?', [id], 'run');
}

// دوال الأساتذة
async function getProfessors() {
  try {
    return await executeQueryAsync('SELECT * FROM professors ORDER BY name');
  } catch (error) {
    console.error('Error getting professors:', error);
    throw error;
  }
}

async function addProfessor(name, email) {
  const result = await executeQueryAsync('INSERT INTO professors (name, email) VALUES (?, ?)', [name, email], 'run');
  return { id: result.lastInsertRowid, name, email };
}

async function updateProfessor(id, name, email) {
  await executeQueryAsync('UPDATE professors SET name = ?, email = ? WHERE id = ?', [name, email, id], 'run');
  return { id, name, email };
}

async function deleteProfessor(id) {
  return await executeQueryAsync('DELETE FROM professors WHERE id = ?', [id], 'run');
}

// دوال القاعات
async function getRooms() {
  return await executeQueryAsync('SELECT * FROM rooms ORDER BY name');
}

async function addRoom(name, capacity) {
  const result = await executeQueryAsync('INSERT INTO rooms (name, capacity) VALUES (?, ?)', [name, capacity], 'run');
  return { id: result.lastInsertRowid, name, capacity };
}

async function updateRoom(id, name, capacity) {
  await executeQueryAsync('UPDATE rooms SET name = ?, capacity = ? WHERE id = ?', [name, capacity, id], 'run');
  return { id, name, capacity };
}

async function deleteRoom(id) {
  return await executeQueryAsync('DELETE FROM rooms WHERE id = ?', [id], 'run');
}

// دوال التكاليف
function getAssignments(academicYear = null, semester = null, specialization = null) {
  let query = `
    SELECT a.*, 
      g.name as group_name, 
      c.name as course_name, 
      p.name as professor_name, 
      r.name as room_name
    FROM assignments a
    LEFT JOIN groups g ON a.group_id = g.id
    LEFT JOIN courses c ON a.course_id = c.id
    LEFT JOIN professors p ON a.professor_id = p.id
    LEFT JOIN rooms r ON a.room_id = r.id
  `;
  
  // إضافة شرط التصفية حسب السنة الدراسية أو الفصل
  const params = [];
  const conditions = [];
  
  if (academicYear) {
    conditions.push('a.academic_year = ?');
    params.push(academicYear);
  }
  
  if (semester) {
    conditions.push('a.semester = ?');
    params.push(semester);
  }
  
  if (specialization) {
    conditions.push('a.specialization = ?');
    params.push(specialization);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY a.day_of_week, a.start_time';
  
  return executeQuerySync(query, params);
}

function addAssignment(assignment) {
  const result = executeQuerySync(`
    INSERT INTO assignments (
      group_id, course_id, professor_id, room_id, 
      day_of_week, start_time, end_time, 
      academic_year, semester, specialization
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    assignment.group_id,
    assignment.course_id,
    assignment.professor_id,
    assignment.room_id,
    assignment.day_of_week,
    assignment.start_time,
    assignment.end_time,
    assignment.academic_year || '',
    assignment.semester || '1',
    assignment.specialization || ''
  ], 'run');
  
  return { id: result.lastInsertRowid, ...assignment };
}

function updateAssignment(id, assignment) {
  executeQuerySync(`
    UPDATE assignments SET 
      group_id = ?, 
      course_id = ?, 
      professor_id = ?, 
      room_id = ?, 
      day_of_week = ?, 
      start_time = ?, 
      end_time = ?,
      academic_year = ?,
      semester = ?,
      specialization = ?
    WHERE id = ?
  `, [
    assignment.group_id,
    assignment.course_id,
    assignment.professor_id,
    assignment.room_id,
    assignment.day_of_week,
    assignment.start_time,
    assignment.end_time,
    assignment.academic_year || '',
    assignment.semester || '1',
    assignment.specialization || '',
    id
  ], 'run');
  
  return { id, ...assignment };
}

function deleteAssignment(id) {
  return executeQuerySync('DELETE FROM assignments WHERE id = ?', [id], 'run');
}

// دوال التحقق من التعارضات
function checkConflicts(assignment) {
  // تعطيل التحقق من التعارضات مؤقتاً
  // تم تعطيل هذه الوظيفة مؤقتًا للسماح للأستاذ بتدريس عدة تخصصات في نفس الوقت والقاعة
  
  return {
    count: 0,
    details: {
      professor: 0,
      group: 0,
      room: 0
    }
  };
}

// دوال السنوات الدراسية
function getAcademicYears() {
  return executeQuerySync('SELECT * FROM academic_years ORDER BY year_name DESC');
}

function getActiveAcademicYear() {
  const years = executeQuerySync('SELECT * FROM academic_years WHERE is_current = 1 LIMIT 1');
  return years.length > 0 ? years[0] : null;
}

function addAcademicYear(yearName, setAsCurrent = false) {
  // إذا كان سيتم تعيين السنة كحالية، قم بإلغاء تعيين السنة الحالية السابقة
  if (setAsCurrent) {
    executeQuerySync('UPDATE academic_years SET is_current = 0', [], 'run');
  }
  
  const result = executeQuerySync(
    'INSERT INTO academic_years (year_name, is_current) VALUES (?, ?)',
    [yearName, setAsCurrent ? 1 : 0],
    'run'
  );
  
  return { 
    id: result.lastInsertRowid, 
    year_name: yearName, 
    is_current: setAsCurrent ? 1 : 0,
    created_at: new Date().toISOString()
  };
}

function setActiveAcademicYear(yearId) {
  // إلغاء تعيين السنة الحالية السابقة
  executeQuerySync('UPDATE academic_years SET is_current = 0', [], 'run');
  
  // تعيين السنة الجديدة كحالية
  executeQuerySync(
    'UPDATE academic_years SET is_current = 1 WHERE id = ?',
    [yearId],
    'run'
  );
  
  return { success: true };
}

function deleteAcademicYear(yearId) {
  return executeQuerySync('DELETE FROM academic_years WHERE id = ?', [yearId], 'run');
}

// دوال الفصول الدراسية
function getSemesters(academicYearId) {
  return executeQuerySync(
    'SELECT * FROM semesters WHERE academic_year_id = ? ORDER BY semester_name',
    [academicYearId]
  );
}

function getActiveSemester(academicYearId) {
  const semesters = executeQuerySync(
    'SELECT * FROM semesters WHERE academic_year_id = ? AND is_current = 1 LIMIT 1',
    [academicYearId]
  );
  return semesters.length > 0 ? semesters[0] : null;
}

function addSemester(academicYearId, semesterName, startDate, endDate, setAsCurrent = false) {
  // إذا كان سيتم تعيين الفصل كحالي، قم بإلغاء تعيين الفصل الحالي السابق
  if (setAsCurrent) {
    executeQuerySync(
      'UPDATE semesters SET is_current = 0 WHERE academic_year_id = ?',
      [academicYearId],
      'run'
    );
  }
  
  const result = executeQuerySync(
    `INSERT INTO semesters (
      academic_year_id, semester_name, start_date, end_date, is_current
    ) VALUES (?, ?, ?, ?, ?)`,
    [academicYearId, semesterName, startDate, endDate, setAsCurrent ? 1 : 0],
    'run'
  );
  
  return { 
    id: result.lastInsertRowid, 
    academic_year_id: academicYearId,
    semester_name: semesterName, 
    start_date: startDate,
    end_date: endDate,
    is_current: setAsCurrent ? 1 : 0,
    created_at: new Date().toISOString()
  };
}

function setActiveSemester(semesterId) {
  // الحصول على معلومات الفصل
  const semesters = executeQuerySync('SELECT * FROM semesters WHERE id = ?', [semesterId]);
  if (semesters.length === 0) {
    throw new Error('الفصل الدراسي غير موجود');
  }
  
  const semester = semesters[0];
  
  // إلغاء تعيين الفصل الحالي السابق
  executeQuerySync(
    'UPDATE semesters SET is_current = 0 WHERE academic_year_id = ?',
    [semester.academic_year_id],
    'run'
  );
  
  // تعيين الفصل الجديد كحالي
  executeQuerySync(
    'UPDATE semesters SET is_current = 1 WHERE id = ?',
    [semesterId],
    'run'
  );
  
  return { success: true };
}

function deleteSemester(semesterId) {
  return executeQuerySync('DELETE FROM semesters WHERE id = ?', [semesterId], 'run');
}

// دوال الحصص الإضافية والتعويضات
function getExtraSessions() {
  return executeQuerySync(`
    SELECT es.*, 
      g.name as group_name, 
      c.name as course_name, 
      p.name as professor_name, 
      r.name as room_name
    FROM extra_sessions es
    LEFT JOIN groups g ON es.group_id = g.id
    LEFT JOIN courses c ON es.course_id = c.id
    LEFT JOIN professors p ON es.professor_id = p.id
    LEFT JOIN rooms r ON es.room_id = r.id
    ORDER BY es.session_date, es.start_time
  `);
}

function createExtraSession(session) {
  console.log('Creating extra session with data:', session);
  
  const params = [
    session.group_id,
    session.course_id,
    session.professor_id,
    session.room_id,
    session.session_date,
    session.start_time,
    session.end_time,
    session.description || '',
    session.session_type || '',
    session.academic_year || '',
    session.semester || ''
  ];
  
  console.log('SQL Parameters:', params);
  console.log('Parameter count:', params.length);
  
  const result = executeQuerySync(`
    INSERT INTO extra_sessions (
      group_id, course_id, professor_id, room_id,
      session_date, start_time, end_time, description,
      session_type, academic_year, semester
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, params, 'run');
  
  return { id: result.lastInsertRowid, ...session };
}

function updateExtraSession(session) {
  executeQuerySync(`
    UPDATE extra_sessions SET
      group_id = ?, course_id = ?, professor_id = ?, room_id = ?,
      session_date = ?, start_time = ?, end_time = ?, description = ?,
      session_type = ?, academic_year = ?, semester = ?
    WHERE id = ?
  `, [
    session.group_id,
    session.course_id,
    session.professor_id,
    session.room_id,
    session.session_date,
    session.start_time,
    session.end_time,
    session.description || '',
    session.session_type || '',
    session.academic_year || '',
    session.semester || '',
    session.id
  ], 'run');
  
  return { ...session };
}

function deleteExtraSession(id) {
  return executeQuerySync('DELETE FROM extra_sessions WHERE id = ?', [id], 'run');
}

// دالة استيراد البيانات من سنة دراسية سابقة
function importDataFromPreviousYear(sourceYearId, targetYearId, importSpecializations = true, importGroups = true, importCourses = true) {
  try {
    // الحصول على السنة المصدر والهدف للتأكد من وجودهما
    const sourceYear = executeQuerySync('SELECT * FROM academic_years WHERE id = ?', [sourceYearId])[0];
    const targetYear = executeQuerySync('SELECT * FROM academic_years WHERE id = ?', [targetYearId])[0];
    
    if (!sourceYear || !targetYear) {
      throw new Error('السنة الدراسية المصدر أو الهدف غير موجودة');
    }
    
    // استيراد التخصصات إذا كان مطلوبًا
    if (importSpecializations) {
      const specializations = executeQuerySync(`
        SELECT * FROM groups 
        WHERE group_type = 'specialization' 
        AND id IN (
          SELECT DISTINCT g.id FROM groups g
          JOIN assignments a ON a.group_id = g.id
          WHERE a.academic_year = ?
        )
      `, [sourceYear.year_name]);
      
      for (const spec of specializations) {
        // التحقق مما إذا كان التخصص موجودًا بالفعل في السنة الهدف
        const existingSpec = executeQuerySync(`
          SELECT * FROM groups 
          WHERE specialization = ? AND group_type = 'specialization'
          AND id IN (
            SELECT DISTINCT g.id FROM groups g
            JOIN assignments a ON a.group_id = g.id
            WHERE a.academic_year = ?
          )
        `, [spec.specialization, targetYear.year_name])[0];
        
        if (!existingSpec) {
          // إنشاء تخصص جديد
          executeQuerySync(`
            INSERT INTO groups (
              name, specialization, parent_group_id, 
              department_id, group_type, year
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            spec.name,
            spec.specialization,
            spec.parent_group_id,
            spec.department_id,
            'specialization',
            targetYear.year_name
          ], 'run');
        }
      }
    }
    
    // استيراد المجموعات إذا كان مطلوبًا
    if (importGroups) {
      const groups = executeQuerySync(`
        SELECT * FROM groups 
        WHERE group_type = 'group' 
        AND id IN (
          SELECT DISTINCT g.id FROM groups g
          JOIN assignments a ON a.group_id = g.id
          WHERE a.academic_year = ?
        )
      `, [sourceYear.year_name]);
      
      for (const group of groups) {
        // التحقق مما إذا كانت المجموعة موجودة بالفعل في السنة الهدف
        const existingGroup = executeQuerySync(`
          SELECT * FROM groups 
          WHERE name = ? AND specialization = ? AND group_type = 'group'
          AND id IN (
            SELECT DISTINCT g.id FROM groups g
            JOIN assignments a ON a.group_id = g.id
            WHERE a.academic_year = ?
          )
        `, [group.name, group.specialization, targetYear.year_name])[0];
        
        if (!existingGroup) {
          // إنشاء مجموعة جديدة
          executeQuerySync(`
            INSERT INTO groups (
              name, specialization, parent_group_id, 
              department_id, group_type, year
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            group.name,
            group.specialization,
            group.parent_group_id,
            group.department_id,
            'group',
            targetYear.year_name
          ], 'run');
        }
      }
    }
    
    // استيراد المواد إذا كان مطلوبًا
    if (importCourses) {
      const courses = executeQuerySync(`
        SELECT DISTINCT c.* FROM courses c
        JOIN assignments a ON a.course_id = c.id
        WHERE a.academic_year = ?
      `, [sourceYear.year_name]);
      
      for (const course of courses) {
        // التحقق مما إذا كانت المادة موجودة بالفعل
        const existingCourse = executeQuerySync('SELECT * FROM courses WHERE name = ? AND code = ?', [course.name, course.code])[0];
        
        if (!existingCourse) {
          // إنشاء مادة جديدة
          executeQuerySync(
            'INSERT INTO courses (name, code, metadata) VALUES (?, ?, ?)',
            [course.name, course.code, course.metadata || '{}'],
            'run'
          );
        }
      }
    }
    
    return { success: true, message: 'تم استيراد البيانات بنجاح' };
  } catch (error) {
    console.error('Error importing data from previous year:', error);
    throw new Error(`فشل استيراد البيانات: ${error.message}`);
  }
}

// دوال الأقسام
function getDepartments() {
  return executeQuerySync('SELECT * FROM departments ORDER BY name');
}

function addDepartment(name, code) {
  const result = executeQuerySync('INSERT INTO departments (name, code) VALUES (?, ?)', [name, code], 'run');
  return { id: result.lastInsertRowid, name, code };
}

function updateDepartment(id, name, code) {
  executeQuerySync('UPDATE departments SET name = ?, code = ? WHERE id = ?', [name, code, id], 'run');
  return { id, name, code };
}

function deleteDepartment(id) {
  return executeQuerySync('DELETE FROM departments WHERE id = ?', [id], 'run');
}

// تصدير الدوال للتعامل مع قاعدة البيانات
module.exports = {
  executeQuery,
  initializeDatabase,
  runMigrations,
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  getGroups,
  getGroupsByDepartment,
  getGroupsBySpecialization,
  getSpecializationsByDepartment,
  addGroup,
  updateGroup,
  deleteGroup,
  deleteAllGroups,
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  getProfessors,
  addProfessor,
  updateProfessor,
  deleteProfessor,
  getRooms,
  addRoom,
  updateRoom,
  deleteRoom,
  getAssignments,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  checkConflicts,
  getAcademicYears,
  getActiveAcademicYear,
  addAcademicYear,
  setActiveAcademicYear,
  deleteAcademicYear,
  getSemesters,
  getActiveSemester,
  addSemester,
  setActiveSemester,
  deleteSemester,
  getExtraSessions,
  createExtraSession,
  updateExtraSession,
  deleteExtraSession,
  importDataFromPreviousYear
};