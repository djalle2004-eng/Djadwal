const { app } = require('electron');
const { Database } = require('@sqlitecloud/drivers');
const bcrypt = require('bcrypt');
const { DatabaseAPIClient } = require('./database-api');

// Charger dotenv en mode développement, ignorer en production
try {
  require('dotenv').config();
} catch (error) {
  console.log('Module dotenv non disponible, utilisation des variables d\'environnement système');
}

// Connection mode: 'direct' or 'api'
let connectionMode = 'direct';
const USE_API_FALLBACK = process.env.USE_API_FALLBACK !== 'false';

console.log('🔧 Connection settings:', {
  mode: connectionMode,
  fallback: USE_API_FALLBACK,
  apiUrl: process.env.VERCEL_API_URL
});

// Variables globales
let db = null;
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds
let connectionHealthInterval = null;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Fonction pour fermer la connexion existante
function closeConnection() {
  if (db) {
    try {
      db.close();
    } catch (error) {
      console.log('Erreur lors de la fermeture de connexion:', error);
    }
    db = null;
  }
  
  // Clear health check interval
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
    connectionHealthInterval = null;
  }
}

// Fonction pour vérifier la santé de la connexion
async function checkConnectionHealth() {
  if (!db || isReconnecting) return;
  
  try {
    await db.sql('SELECT 1 as health_check');
    console.log('✅ Connexion SQLiteCloud en bonne santé');
  } catch (error) {
    console.log('❌ Problème de connexion détecté, reconnexion...');
    if (isConnectionError(error)) {
      await reconnectDatabase();
    }
  }
}

// Démarrer la surveillance de la connexion
function startConnectionMonitoring() {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }
  
  connectionHealthInterval = setInterval(checkConnectionHealth, HEALTH_CHECK_INTERVAL);
  console.log(`🔍 Surveillance de connexion démarrée (${HEALTH_CHECK_INTERVAL}ms)`);
}

// Initialiser la connexion à la base de données avec retry logic
async function initDatabaseConnection() {
  try {
    if (!db) {
      const credentials = {
        username: process.env.SQLITECLOUD_USERNAME || 'admin@example.com',
        password: process.env.SQLITECLOUD_PASSWORD || 'admin123',
        host: process.env.SQLITECLOUD_HOST || 'cjh4w9vank.g4.sqlite.cloud',
        port: process.env.SQLITECLOUD_PORT || '8860',
        database: process.env.SQLITECLOUD_DATABASE || 'Djadwal'
      };
      
      // Try direct connection first
      if (connectionMode === 'direct') {
        try {
          console.log("🔄 Attempting direct SQLiteCloud connection...");
          const connectionString = `sqlitecloud://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.database}`;
          
          db = new Database(connectionString);
          
          // Add timeout to connection test (10 seconds)
          console.log('⏱️ Testing connection with 10s timeout...');
          const testPromise = db.sql('SELECT 1 as test');
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
          );
          
          await Promise.race([testPromise, timeoutPromise]);
          console.log('✅ Direct connection established');
          
          startConnectionMonitoring();
          reconnectAttempts = 0;
          isReconnecting = false;
          
          return db;
        } catch (directError) {
          console.error('❌ Direct connection failed:', directError.message);
          
          // Close failed connection
          if (db) {
            try { 
              console.log('🗑️ Closing failed connection...');
              db.close(); 
            } catch (e) {
              console.log('⚠️ Could not close connection:', e.message);
            }
            db = null;
          }
          
          // Fallback to API if enabled
          if (USE_API_FALLBACK) {
            console.log('🔄 Trying API connection as fallback...');
            connectionMode = 'api';
          } else {
            throw directError;
          }
        }
      }
      
      // Use API connection
      if (connectionMode === 'api') {
        try {
          console.log("🔄 Using API connection mode...");
          db = new DatabaseAPIClient(credentials);
          console.log('🧪 Testing API connection...');
          const testResult = await db.sql('SELECT 1 as test');
          console.log('✅ API connection test result:', testResult);
          console.log('✅ API connection established successfully!');
          
          reconnectAttempts = 0;
          isReconnecting = false;
          
          return db;
        } catch (apiError) {
          console.error('❌ API connection failed:', apiError);
          console.error('❌ API Error details:', apiError.message);
          throw apiError;
        }
      }
    }
    return db;
  } catch (error) {
    console.error('❌ All connection methods failed:', error);
    closeConnection();
    throw new Error(`فشل الاتصال بقاعدة البيانات: ${error.message}`);
  }
}

// Fonction pour reconnecter automatiquement
async function reconnectDatabase() {
  if (isReconnecting) {
    console.log('Reconnexion déjà en cours...');
    return;
  }

  isReconnecting = true;
  console.log(`Tentative de reconnexion ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}...`);

  try {
    closeConnection();
    await delay(RECONNECT_DELAY);
    await initDatabaseConnection();
    console.log('Reconnexion réussie!');
    return true;
  } catch (error) {
    reconnectAttempts++;
    console.error(`Échec de reconnexion ${reconnectAttempts}:`, error);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`Nouvelle tentative dans ${RECONNECT_DELAY}ms...`);
      await delay(RECONNECT_DELAY);
      return await reconnectDatabase();
    } else {
      isReconnecting = false;
      throw new Error(`فشل في إعادة الاتصال بعد ${MAX_RECONNECT_ATTEMPTS} محاولات`);
    }
  }
}

// Vérifier si l'erreur est liée à la connexion
function isConnectionError(error) {
  const connectionErrors = [
    'connection lost',
    'connection closed',
    'network error',
    'timeout',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'socket hang up'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return connectionErrors.some(errType => errorMessage.includes(errType));
}

// Exécuter une requête
async function executeQuery(query, params = []) {
  try {
    const connection = await initDatabaseConnection();
    return await connection.sql(query, params);
  } catch (error) {
    if (isConnectionError(error)) {
      console.log('Erreur de connexion, tentative de reconnexion...');
      await reconnectDatabase();
      return await executeQuery(query, params);
    } else {
      console.error('Erreur d\'exécution de requête:', error);
      throw error;
    }
  }
}

// Exécuter une requête avec traitement des erreurs
async function executeQueryWithErrorHandling(query, params = [], operation = 'query') {
  try {
    console.log('🔍 executeQueryWithErrorHandling DEBUG:');
    console.log('Query:', query);
    console.log('Params:', params);
    console.log('Params count:', params.length);
    console.log('Question marks in query:', (query.match(/\?/g) || []).length);
    
    const result = await executeQuery(query, params);
    return result;
  } catch (error) {
    console.error(`❌ Erreur d'exécution ${operation} (${query}):`, error);
    console.error('Parameters that caused error:', params);
    
    // Check if it's a connection error and try to reconnect
    if (isConnectionError(error)) {
      console.log('Erreur de connexion détectée, tentative de reconnexion...');
      try {
        await reconnectDatabase();
        console.log('Reconnexion réussie, nouvelle tentative de requête...');
        return await executeQuery(query, params);
      } catch (reconnectError) {
        console.error('Échec de reconnexion:', reconnectError);
        throw new Error(`فشل في الاتصال وإعادة الاتصال بقاعدة البيانات: ${error.message}`);
      }
    }
    
    throw new Error(`فشل في تنفيذ الاستعلام: ${error.message}`);
  }
}

// Initialiser la base de données
async function initializeDatabase() {
  try {
    await initDatabaseConnection();
    
    // Création de la table des départements
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created departments table');
    
    // Création de la table des groupes
    await executeQuery(`
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
    await executeQuery(`
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
    await createProfessorsTable();
    
    // Création de la table des salles
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        capacity INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created rooms table');

    // Création de la table des attributions
    await executeQuery(`
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
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_name TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created academic_years table');

    // Création de la table des semestres
    await executeQuery(`
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
    await executeQuery(`
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
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_group ON assignments(group_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_professor ON assignments(professor_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_room ON assignments(room_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_day ON assignments(day_of_week)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_semesters_academic_year ON semesters(academic_year_id)');

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw new Error(`فشل تهيئة قاعدة البيانات: ${error.message}`);
  }
}

// Exécuter les migrations
async function runMigrations() {
  try {
    console.log('Running migrations...');
    
    // Vérifier si la colonne academic_year existe dans la table assignments
    const assignmentsColumns = await executeQuery("PRAGMA table_info(assignments)");
    const hasAcademicYearColumn = assignmentsColumns.some(col => col.name === 'academic_year');
    const hasSemesterColumn = assignmentsColumns.some(col => col.name === 'semester');
    const hasSpecializationColumn = assignmentsColumns.some(col => col.name === 'specialization');
    
    // Ajouter la colonne academic_year si elle n'existe pas
    if (!hasAcademicYearColumn) {
      console.log('Adding academic_year column to assignments table...');
      await executeQuery('ALTER TABLE assignments ADD COLUMN academic_year TEXT DEFAULT ""');
    }
    
    // Ajouter la colonne semester si elle n'existe pas
    if (!hasSemesterColumn) {
      console.log('Adding semester column to assignments table...');
      await executeQuery('ALTER TABLE assignments ADD COLUMN semester TEXT DEFAULT "1"');
    }
    
    // Ajouter la colonne specialization si elle n'existe pas
    if (!hasSpecializationColumn) {
      console.log('Adding specialization column to assignments table...');
      await executeQuery('ALTER TABLE assignments ADD COLUMN specialization TEXT DEFAULT ""');
    }
    
    // Vérifier si la colonne metadata existe dans la table courses
    const coursesColumns = await executeQuery("PRAGMA table_info(courses)");
    const hasMetadataColumn = coursesColumns.some(col => col.name === 'metadata');
    
    // Ajouter la colonne metadata si elle n'existe pas
    if (!hasMetadataColumn) {
      console.log('Adding metadata column to courses table...');
      await executeQuery('ALTER TABLE courses ADD COLUMN metadata TEXT DEFAULT "{}"');
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running database migrations:', error);
  }
}

// Fonctions pour les départements
async function getDepartments() {
  console.log(`[DEBUG] getDepartments appelé`);
  
  try {
    const query = `
      SELECT d.*, 
        (SELECT COUNT(*) FROM groups g WHERE g.department_id = d.id) as group_count
      FROM departments d
      ORDER BY d.name
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    console.log(`[DEBUG] getDepartments a trouvé ${result.length} départements`);
    
    return result;
  } catch (error) {
    console.error(`[ERROR] Erreur dans getDepartments:`, error);
    throw error;
  }
}

async function addDepartment(name, code) {
  console.log(`[DEBUG] addDepartment appelé avec:`, { name, code });
  
  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      INSERT INTO departments (name, code) 
      VALUES ('${name.replace(/'/g, "''")}', '${(code || '').replace(/'/g, "''")}')
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de l'insertion:`, result);
    return { id: result.lastInsertRowid, name, code };
  } catch (error) {
    console.error(`[ERROR] Erreur dans addDepartment:`, error);
    throw error;
  }
}

async function updateDepartment(id, name, code) {
  console.log(`[DEBUG] updateDepartment appelé avec:`, { id, name, code });
  
  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      UPDATE departments 
      SET name = '${name.replace(/'/g, "''")}', 
          code = '${(code || '').replace(/'/g, "''")}'
      WHERE id = '${id}'
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la mise à jour:`, result);
    return { id, name, code };
  } catch (error) {
    console.error(`[ERROR] Erreur dans updateDepartment:`, error);
    throw error;
  }
}

async function deleteDepartment(id) {
  console.log(`[DEBUG] deleteDepartment appelé avec id: ${id}`);
  
  try {
    const query = `DELETE FROM departments WHERE id = '${id}'`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la suppression:`, result);
    return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans deleteDepartment:`, error);
    throw error;
  }
}

// Fonctions pour les groupes
async function getGroups() {
  return await executeQueryWithErrorHandling(`
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
    ORDER BY g.name
  `);
}

async function getGroupsByDepartment(departmentId) {
  console.log(`[DEBUG] getGroupsByDepartment appelé avec departmentId: ${departmentId} (type: ${typeof departmentId})`);
  
  try {
    const query = `
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
      WHERE g.department_id = '${departmentId}'
    ORDER BY g.name
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    console.log(`[DEBUG] getGroupsByDepartment a trouvé ${result.length} groupes`);
    
    return result;
  } catch (error) {
    console.error(`[ERROR] Erreur dans getGroupsByDepartment:`, error);
    throw error;
  }
}

async function getGroupsBySpecialization(specialization) {
  console.log(`[DEBUG] getGroupsBySpecialization appelé avec specialization: ${specialization} (type: ${typeof specialization})`);
  
  try {
    const query = `
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
      WHERE g.specialization = '${specialization}' AND g.group_type = 'group'
    ORDER BY g.name
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    console.log(`[DEBUG] getGroupsBySpecialization a trouvé ${result.length} groupes`);
    
    return result;
  } catch (error) {
    console.error(`[ERROR] Erreur dans getGroupsBySpecialization:`, error);
    throw error;
  }
}

async function getSpecializationsByDepartment(departmentId) {
  return await executeQueryWithErrorHandling(`
    SELECT g.*, d.name as department_name
    FROM groups g
    LEFT JOIN departments d ON g.department_id = d.id
    WHERE g.department_id = ? AND g.group_type = 'specialization'
    ORDER BY g.name
  `, [departmentId]);
}

async function addGroup(name, specialization, parent_group_id, department_id, group_type, year) {
  console.log('=== addGroup Debug Info ===');
  console.log('Parameters received:');
  console.log('- name:', name, typeof name);
  console.log('- specialization:', specialization, typeof specialization);
  console.log('- parent_group_id:', parent_group_id, typeof parent_group_id);
  console.log('- department_id:', department_id, typeof department_id);
  console.log('- group_type:', group_type, typeof group_type);
  console.log('- year:', year, typeof year);
  
  // Prepare values with proper null handling
  const nameValue = name;
  const specializationValue = specialization || null;
  const parentGroupIdValue = parent_group_id || null;
  const departmentIdValue = department_id || null;
  const groupTypeValue = group_type || 'group';
  const yearValue = year || null;
  
  console.log('Final values for SQLiteCloud template:');
  console.log('- nameValue:', nameValue);
  console.log('- specializationValue:', specializationValue);
  console.log('- parentGroupIdValue:', parentGroupIdValue);
  console.log('- departmentIdValue:', departmentIdValue);
  console.log('- groupTypeValue:', groupTypeValue);
  console.log('- yearValue:', yearValue);
  
  try {
    const connection = await initDatabaseConnection();
    const result = await connection.sql`
      INSERT INTO groups (
        name, specialization, parent_group_id, 
        department_id, group_type, year
      ) VALUES (${nameValue}, ${specializationValue}, ${parentGroupIdValue}, ${departmentIdValue}, ${groupTypeValue}, ${yearValue})
    `;
    
    console.log('Insert result:', result);
    
    return { 
      id: result.lastInsertRowid, 
      name, 
      specialization, 
      parent_group_id, 
      department_id,
      group_type,
      year
    };
  } catch (error) {
    console.error('Error in addGroup:', error);
    throw new Error(`فشل في تنفيذ الاستعلام: ${error.message}`);
  }
}

async function updateGroup(id, name, specialization, parent_group_id, department_id, group_type, year) {
  // Prepare values with proper null handling
  const nameValue = name;
  const specializationValue = specialization || null;
  const parentGroupIdValue = parent_group_id || null;
  const departmentIdValue = department_id || null;
  const groupTypeValue = group_type || 'group';
  const yearValue = year || null;
  const idValue = id;
  
  try {
    const connection = await initDatabaseConnection();
    await connection.sql`
      UPDATE groups SET 
        name = ${nameValue}, 
        specialization = ${specializationValue}, 
        parent_group_id = ${parentGroupIdValue},
        department_id = ${departmentIdValue},
        group_type = ${groupTypeValue},
        year = ${yearValue}
      WHERE id = ${idValue}
    `;
    
    return { 
      id: Number(id), 
      name, 
      specialization, 
      parent_group_id, 
      department_id,
      group_type,
      year
    };
  } catch (error) {
    console.error('Error in updateGroup:', error);
    throw new Error(`فشل في تنفيذ الاستعلام: ${error.message}`);
  }
}

async function deleteGroup(id) {
  console.log(`[Database] بدء حذف المجموعة بالمعرف: ${id} (نوع: ${typeof id})`);
  try {
    // Ensure we have a proper database connection
    const connection = await initDatabaseConnection();
    console.log(`[Database] تأكيد الاتصال بقاعدة البيانات...`);
    
    // Explicitly select the database to ensure we're querying the right one
    await connection.sql('USE DATABASE Djadwal');
    console.log(`[Database] تم تحديد قاعدة البيانات Djadwal`);
    
    // Check database connection and table existence first
    console.log(`[Database] فحص الاتصال بقاعدة البيانات...`);
    const tableCheck = await connection.sql('SELECT name FROM sqlite_master WHERE type="table" AND name="groups"');
    console.log(`[Database] جدول المجموعات موجود:`, tableCheck);
    
    // Get all groups to see what's actually in the database
    console.log(`[Database] جلب جميع المجموعات لفحص المحتوى...`);
    const allGroups = await connection.sql('SELECT id, name FROM groups ORDER BY id');
    console.log(`[Database] جميع المجموعات في قاعدة البيانات (${allGroups.length}):`, allGroups.map(g => `ID: ${g.id}, Name: ${g.name}`));
    
    // Check if our specific ID exists with different query approaches
    console.log(`[Database] البحث عن المجموعة ${id} بطرق مختلفة...`);
    
    // Method 1: Direct SELECT with exact ID
    const existingGroup1 = await connection.sql('SELECT * FROM groups WHERE id = ?', [id]);
    console.log(`[Database] الطريقة 1 - البحث المباشر:`, existingGroup1);
    
    // Method 2: SELECT with string conversion
    const existingGroup2 = await connection.sql('SELECT * FROM groups WHERE id = ?', [String(id)]);
    console.log(`[Database] الطريقة 2 - البحث بالنص:`, existingGroup2);
    
    // Method 3: SELECT with CAST
    const existingGroup3 = await connection.sql('SELECT * FROM groups WHERE CAST(id AS TEXT) = ?', [String(id)]);
    console.log(`[Database] الطريقة 3 - البحث مع CAST:`, existingGroup3);
    
    // Method 4: Check if ID exists in the list we just retrieved
    const foundInList = allGroups.find(g => g.id == id || g.id === id || String(g.id) === String(id));
    console.log(`[Database] الطريقة 4 - البحث في القائمة:`, foundInList);
    
    // Debug the fallback logic
    console.log(`[Database] تشخيص المنطق الاحتياطي:`);
    console.log(`[Database] - existingGroup1.length:`, existingGroup1.length);
    console.log(`[Database] - foundInList:`, foundInList);
    console.log(`[Database] - foundInList exists:`, !!foundInList);
    
    // Use the group found in list if direct queries fail
    const existingGroup = existingGroup1.length > 0 ? existingGroup1 : (foundInList ? [foundInList] : []);
    console.log(`[Database] - existingGroup after fallback:`, existingGroup);
    console.log(`[Database] - existingGroup.length:`, existingGroup.length);
    
    if (!existingGroup || existingGroup.length === 0) {
      console.warn(`[Database] المجموعة بالمعرف ${id} غير موجودة في قاعدة البيانات`);
      console.warn(`[Database] لكن المجموعة قد تكون موجودة في الواجهة - مشكلة في التزامن`);
      return { changes: 0, message: 'Group not found in database but may exist in UI cache' };
    }
    
    console.log(`[Database] المجموعة موجودة، المتابعة مع الحذف...`);
    
    // Check for foreign key references that might prevent deletion
    console.log(`[Database] فحص المراجع الخارجية للمجموعة ${id}...`);
    
    // Check if group is referenced as parent_group_id
    const childGroups = await connection.sql('SELECT * FROM groups WHERE parent_group_id = ?', [id]);
    if (childGroups && childGroups.length > 0) {
      console.warn(`[Database] المجموعة ${id} لها مجموعات فرعية (${childGroups.length}):`, childGroups.map(g => g.name));
    }
    
    // Check if group is referenced in sessions table
    const sessions = await connection.sql('SELECT * FROM sessions WHERE group_id = ?', [id]);
    if (sessions && sessions.length > 0) {
      console.warn(`[Database] المجموعة ${id} مرتبطة بجلسات (${sessions.length})`);
    }
    
    // Check if group is referenced in course_assignments table
    const assignments = await connection.sql('SELECT * FROM course_assignments WHERE group_id = ?', [id]);
    if (assignments && assignments.length > 0) {
      console.warn(`[Database] المجموعة ${id} مرتبطة بتكليفات المقررات (${assignments.length})`);
    }
    
    // Check if group is referenced in schedule table
    const schedules = await connection.sql('SELECT * FROM schedule WHERE group_id = ?', [id]);
    if (schedules && schedules.length > 0) {
      console.warn(`[Database] المجموعة ${id} مرتبطة بالجدول الزمني (${schedules.length})`);
    }
    
    console.log(`[Database] المجموعة موجودة، المتابعة مع الحذف...`);
    const result = await connection.sql('DELETE FROM groups WHERE id = ?', [id]);
    console.log(`[Database] نتيجة حذف المجموعة ${id}:`, result);
    
    // التحقق من عدد الصفوف المتأثرة
    if (result && result.changes !== undefined) {
      console.log(`[Database] عدد الصفوف المحذوفة: ${result.changes}`);
      if (result.changes === 0) {
        console.warn(`[Database] تحذير: لم يتم حذف أي صف للمعرف ${id}`);
        
        // Double-check if group still exists after deletion attempt
        const stillExists = await connection.sql('SELECT * FROM groups WHERE id = ?', [id]);
        console.log(`[Database] هل المجموعة ما زالت موجودة بعد محاولة الحذف؟`, stillExists);
        
        // Check database integrity
        const pragmaCheck = await connection.sql('PRAGMA foreign_key_check');
        console.log(`[Database] فحص سلامة المراجع الخارجية:`, pragmaCheck);
        
      } else {
        console.log(`[Database] تم حذف المجموعة ${id} بنجاح`);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`[Database] خطأ في حذف المجموعة ${id}:`, error);
    throw error;
  }
}

async function deleteAllGroups() {
  return await executeQueryWithErrorHandling('DELETE FROM groups', [], 'run');
}

// Fonctions pour les cours
async function getCourses() {
  return await executeQueryWithErrorHandling('SELECT * FROM courses ORDER BY name');
}

async function addCourse(name, code, metadata = '{}') {
  console.log(`[DEBUG] addCourse appelé avec:`, { name, code, metadata });
  
  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      INSERT INTO courses (name, code, metadata) 
      VALUES ('${name.replace(/'/g, "''")}', '${(code || '').replace(/'/g, "''")}', '${(metadata || '{}').replace(/'/g, "''")}')
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de l'insertion:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'create', 'course', result.lastInsertRowid, `إضافة مقياس: ${name}`);
    
  return { id: result.lastInsertRowid, name, code, metadata };
  } catch (error) {
    console.error(`[ERROR] Erreur dans addCourse:`, error);
    throw error;
  }
}

async function updateCourse(id, name, code, metadata = '{}') {
  console.log(`[DEBUG] updateCourse appelé avec:`, { id, name, code, metadata });
  
  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      UPDATE courses 
      SET name = '${name.replace(/'/g, "''")}', 
          code = '${(code || '').replace(/'/g, "''")}',
          metadata = '${(metadata || '{}').replace(/'/g, "''")}'
      WHERE id = '${id}'
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la mise à jour:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'update', 'course', id, `تحديث مقياس: ${name}`);
    
  return { id, name, code, metadata };
  } catch (error) {
    console.error(`[ERROR] Erreur dans updateCourse:`, error);
    throw error;
  }
}

async function deleteCourse(id) {
  console.log(`[DEBUG] deleteCourse appelé avec id: ${id}`);
  
  try {
    const query = `DELETE FROM courses WHERE id = '${id}'`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la suppression:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'delete', 'course', id, 'حذف مقياس');
    
    return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans deleteCourse:`, error);
    throw error;
  }
}

// Fonctions pour les professeurs
async function getProfessors() {
  try {
    const query = 'SELECT id, name, email, Title, Phone, "Academic Title", created_at FROM professors ORDER BY name';
    console.log(`[DEBUG] Exécution de la requête getProfessors: ${query}`);
    
    const rows = await executeQuery(query);
    console.log(`[DEBUG] Nombre de professeurs récupérés: ${rows.length}`);
    
    // Affichage détaillé de chaque professeur pour le débogage
    for (const row of rows) {
      console.log(`[DEBUG] Professeur ID=${row.id}, Name=${row.name}, Email=${row.email}, Title=${row.Title}, Phone=${row.Phone}, Academic Title=${row["Academic Title"]}`);
      console.log(`[DEBUG] Raw row data:`, row);
      console.log(`[DEBUG] All keys in row:`, Object.keys(row));
    }
    
    // Conversion pour retourner tous les champs
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      Title: row.Title,  // Préserver la casse originale
      Phone: row.Phone,  // Préserver la casse originale
      "Academic Title": row["Academic Title"],  // Nouveau champ
      title: row.Title,  // Ajouter aussi en minuscules pour compatibilité
      phone: row.Phone,  // Ajouter aussi en minuscules pour compatibilité
      academic_title: row["Academic Title"] || '', // Conversion pour le front-end
      created_at: row.created_at
    }));
  } catch (error) {
    console.error('Error getting professors:', error);
    throw error;
  }
}

async function addProfessor(name, email, metadata = '{}') {
  console.log(`[DEBUG] addProfessor appelé avec:`, { name, email, metadata });
  
  try {
    let metadataObj = {};
    try {
      metadataObj = JSON.parse(metadata);
    } catch (e) {
      console.warn('Invalid metadata JSON in addProfessor:', e);
    }
    
    const title = metadataObj.title || '';
    const phone = metadataObj.phone || '';
    const academicTitle = metadataObj.academic_title || '';
    
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      INSERT INTO professors (name, email, Title, Phone, "Academic Title") 
      VALUES ('${name.replace(/'/g, "''")}', 
              '${(email || '').replace(/'/g, "''")}',
              '${(title || '').replace(/'/g, "''")}',
              '${(phone || '').replace(/'/g, "''")}',
              '${(academicTitle || '').replace(/'/g, "''")}'
      )
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de l'insertion:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'create', 'professor', result.lastInsertRowid, `إضافة أستاذ: ${name}`);
    
    return { 
      id: result.lastInsertRowid, 
      name, 
      email, 
      title, 
      phone, 
      academic_title: academicTitle 
    };
  } catch (error) {
    console.error(`[ERROR] Erreur dans addProfessor:`, error);
    throw error;
  }
}

async function updateProfessor(id, name, email, metadata = '{}') {
  console.log(`[DEBUG] updateProfessor appelé avec:`, { id, name, email, metadata });
  
  try {
    let metadataObj = {};
    try {
      metadataObj = JSON.parse(metadata);
    } catch (e) {
      console.warn('Invalid metadata JSON in updateProfessor:', e);
    }
    
    const title = metadataObj.title || '';
    const phone = metadataObj.phone || '';
    const academicTitle = metadataObj.academic_title || '';
    
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      UPDATE professors 
      SET name = '${name.replace(/'/g, "''")}', 
          email = '${(email || '').replace(/'/g, "''")}',
          Title = '${(title || '').replace(/'/g, "''")}',
          Phone = '${(phone || '').replace(/'/g, "''")}',
          "Academic Title" = '${(academicTitle || '').replace(/'/g, "''")}'
      WHERE id = '${id}'
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la mise à jour:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'update', 'professor', id, `تحديث أستاذ: ${name}`);
    
    return { 
      id, 
      name, 
      email, 
      title, 
      phone, 
      academic_title: academicTitle
    };
  } catch (error) {
    console.error(`[ERROR] Erreur dans updateProfessor:`, error);
    throw error;
  }
}

async function deleteProfessor(id) {
  console.log(`[DEBUG] deleteProfessor appelé avec id: ${id}`);
  
  try {
    // Vérifier si le professeur a des affectations
    const assignmentsQuery = `SELECT COUNT(*) as count FROM assignments WHERE professor_id = '${id}'`;
    const assignmentsResult = await executeQuery(assignmentsQuery);
    const assignmentsCount = assignmentsResult[0].count;
    
    // Vérifier si le professeur a des sessions supplémentaires
    const extraSessionsQuery = `SELECT COUNT(*) as count FROM extra_sessions WHERE professor_id = '${id}'`;
    const extraSessionsResult = await executeQuery(extraSessionsQuery);
    const extraSessionsCount = extraSessionsResult[0].count;
    
    console.log(`[DEBUG] Professeur ${id} a ${assignmentsCount} affectations et ${extraSessionsCount} sessions supplémentaires`);
    
    if (assignmentsCount > 0 || extraSessionsCount > 0) {
      const errorMessage = `Impossible de supprimer le professeur. Il a ${assignmentsCount} affectation(s) et ${extraSessionsCount} session(s) supplémentaire(s). Supprimez d'abord ces éléments.`;
      console.log(`[DEBUG] ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    const query = `DELETE FROM professors WHERE id = '${id}'`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    
    const result = await executeQuery(query);
    console.log(`[DEBUG] Résultat de la suppression:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'delete', 'professor', id, 'حذف أستاذ');
    
    return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans deleteProfessor:`, error);
    throw error;
  }
}

// Fonctions pour les salles
async function getRooms() {
  return await executeQueryWithErrorHandling('SELECT * FROM rooms ORDER BY name');
}

async function addRoom(name, capacity) {
  console.log(`[DEBUG] addRoom appelé avec:`, { name, capacity });
  
  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      INSERT INTO rooms (name, capacity) 
      VALUES ('${name.replace(/'/g, "''")}', '${capacity || 0}')
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de l'insertion:`, result);
  return { id: result.lastInsertRowid, name, capacity };
  } catch (error) {
    console.error(`[ERROR] Erreur dans addRoom:`, error);
    throw error;
  }
}

async function updateRoom(id, name, capacity) {
  console.log(`[DEBUG] updateRoom appelé avec:`, { id, name, capacity });
  
  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      UPDATE rooms 
      SET name = '${name.replace(/'/g, "''")}', 
          capacity = '${capacity || 0}'
      WHERE id = '${id}'
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la mise à jour:`, result);
  return { id, name, capacity };
  } catch (error) {
    console.error(`[ERROR] Erreur dans updateRoom:`, error);
    throw error;
  }
}

async function deleteRoom(id) {
  console.log(`[DEBUG] deleteRoom appelé avec id: ${id}`);
  
  try {
    const query = `DELETE FROM rooms WHERE id = '${id}'`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la suppression:`, result);
    return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans deleteRoom:`, error);
    throw error;
  }
}

// Fonctions pour les assignations
async function getAssignments(academicYear = null, semester = null, specialization = null) {
  console.log(`[DEBUG] getAssignments appelé avec:`, { academicYear, semester, specialization });
  
  try {
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
  
    // Ajouter des conditions de filtrage
  const conditions = [];
  
  if (academicYear) {
      conditions.push(`a.academic_year = '${academicYear}'`);
  }
  
  if (semester) {
      conditions.push(`a.semester = '${semester}'`);
  }
  
  if (specialization) {
      conditions.push(`a.specialization = '${specialization}'`);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY a.day_of_week, a.start_time';
  
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    
    const result = await executeQuery(query);
    console.log(`[DEBUG] getAssignments a trouvé ${result.length} assignments`);
    
    return result;
  } catch (error) {
    console.error(`[ERROR] Erreur dans getAssignments:`, error);
    throw error;
  }
}

async function addAssignment(assignment) {
  console.log(`[DEBUG] addAssignment appelé avec:`, JSON.stringify(assignment));

  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
    INSERT INTO assignments (
      group_id, course_id, professor_id, room_id, 
      day_of_week, start_time, end_time, 
      academic_year, semester, specialization
      ) VALUES (
        '${assignment.group_id}',
        '${assignment.course_id}',
        '${assignment.professor_id}',
        '${assignment.room_id}',
        '${assignment.day_of_week}',
        '${assignment.start_time}',
        '${assignment.end_time}',
        '${assignment.academic_year || ''}',
        '${assignment.semester || '1'}',
        '${assignment.specialization || ''}'
      )
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de l'insertion:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'create', 'assignment', result.lastInsertRowid, `إضافة حصة`);
    
  return { id: result.lastInsertRowid, ...assignment };
  } catch (error) {
    console.error(`[ERROR] Erreur dans addAssignment:`, error);
    throw error;
  }
}

async function updateAssignment(id, assignment) {
  console.log(`[DEBUG] updateAssignment appelé avec id: ${id}, données:`, JSON.stringify(assignment));

  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
    UPDATE assignments SET 
        group_id = '${assignment.group_id}', 
        course_id = '${assignment.course_id}', 
        professor_id = '${assignment.professor_id}', 
        room_id = '${assignment.room_id}', 
        day_of_week = '${assignment.day_of_week}', 
        start_time = '${assignment.start_time}', 
        end_time = '${assignment.end_time}',
        academic_year = '${assignment.academic_year || ''}',
        semester = '${assignment.semester || '1'}',
        specialization = '${assignment.specialization || ''}'
      WHERE id = '${id}'
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la mise à jour:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'update', 'assignment', id, `تحديث حصة`);
    
  return { id, ...assignment };
  } catch (error) {
    console.error(`[ERROR] Erreur dans updateAssignment:`, error);
    throw error;
  }
}

async function deleteAssignment(id) {
  console.log(`[DEBUG] deleteAssignment appelé avec id: ${id}`);

  try {
    const query = `DELETE FROM assignments WHERE id = '${id}'`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la suppression:`, result);
    
    // تسجيل في audit_log
    await logAudit(null, 'delete', 'assignment', id, 'حذف حصة');
    
    return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans deleteAssignment:`, error);
    throw error;
  }
}

// Fonctions de vérification des conflits
async function checkConflicts(assignment) {
  // Désactivation temporaire de la vérification des conflits
  return {
    count: 0,
    details: {
      professor: 0,
      group: 0,
      room: 0
    }
  };
}

// Fonctions pour les années académiques
async function getAcademicYears() {
  return await executeQueryWithErrorHandling('SELECT * FROM academic_years ORDER BY year_name DESC');
}

async function getActiveAcademicYear() {
  const years = await executeQueryWithErrorHandling('SELECT * FROM academic_years WHERE is_current = 1 LIMIT 1');
  return years.length > 0 ? years[0] : null;
}

async function addAcademicYear(yearName, setAsCurrent = false) {
  // Si défini comme année courante, désactiver l'année courante précédente
  if (setAsCurrent) {
    await executeQueryWithErrorHandling('UPDATE academic_years SET is_current = 0', [], 'run');
  }
  
  const result = await executeQueryWithErrorHandling(
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

async function setActiveAcademicYear(yearId) {
  console.log(`[DEBUG] setActiveAcademicYear appelé avec yearId: ${yearId} (type: ${typeof yearId})`);
  
  try {
    // Vérifier si l'année existe d'abord
    const checkQuery = `SELECT * FROM academic_years WHERE id = '${yearId}'`;
    console.log(`[DEBUG] Vérification de l'existence de l'année: ${checkQuery}`);
    const yearExists = await executeQuery(checkQuery);
    
    if (yearExists.length === 0) {
      console.error(`[ERROR] Année académique avec ID=${yearId} non trouvée`);
      throw new Error('السنة الدراسية غير موجودة');
    }
    
    // Désactiver toutes les années académiques
    const updateQuery1 = `UPDATE academic_years SET is_current = 0`;
    console.log(`[DEBUG] Exécution de la requête: ${updateQuery1}`);
    await executeQuery(updateQuery1);
    
    // Définir la nouvelle année comme active
    const updateQuery2 = `UPDATE academic_years SET is_current = 1 WHERE id = '${yearId}'`;
    console.log(`[DEBUG] Exécution de la requête: ${updateQuery2}`);
    await executeQuery(updateQuery2);
    
    // Vérifier que la mise à jour a réussi
    const verifyQuery = `SELECT * FROM academic_years WHERE id = '${yearId}' AND is_current = 1`;
    console.log(`[DEBUG] Vérification de la mise à jour: ${verifyQuery}`);
    const updatedYear = await executeQuery(verifyQuery);
    
    if (updatedYear.length === 0) {
      console.error(`[ERROR] Échec de la mise à jour de l'année académique avec ID=${yearId}`);
      throw new Error('فشل في تحديث السنة الدراسية');
    }
    
    console.log(`[DEBUG] Année académique ${yearId} mise à jour avec succès`);
  return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans setActiveAcademicYear:`, error);
    throw error;
  }
}

async function deleteAcademicYear(yearId) {
  return await executeQueryWithErrorHandling('DELETE FROM academic_years WHERE id = ?', [yearId], 'run');
}

// Fonctions pour les semestres
async function getSemesters(academicYearId) {
  console.log(`[DEBUG] getSemesters appelé avec academicYearId: ${academicYearId} (type: ${typeof academicYearId})`);
  
  // Vérifier si academicYearId est défini
  if (!academicYearId) {
    console.error('[ERROR] academicYearId non défini dans getSemesters');
    return [];
  }
  
  try {
    // Convertir academicYearId en string pour s'assurer que la requête fonctionne
    // SQLiteCloud semble stocker les nombres comme des strings
    const query = `SELECT * FROM semesters WHERE academic_year_id = '${academicYearId}' ORDER BY semester_name`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] getSemesters a trouvé ${result.length} semestres:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error(`[ERROR] Erreur dans getSemesters:`, error);
    return [];
  }
}

async function getActiveSemester(academicYearId) {
  const semesters = await executeQueryWithErrorHandling(
    'SELECT * FROM semesters WHERE academic_year_id = ? AND is_current = 1 LIMIT 1',
    [academicYearId]
  );
  return semesters.length > 0 ? semesters[0] : null;
}

async function addSemester(academicYearId, semesterName, startDate, endDate, setAsCurrent = false) {
  // Si défini comme semestre courant, désactiver le semestre courant précédent
  if (setAsCurrent) {
    await executeQueryWithErrorHandling(
      'UPDATE semesters SET is_current = 0 WHERE academic_year_id = ?',
      [academicYearId],
      'run'
    );
  }
  
  console.log(`[DEBUG] addSemester: Paramètres reçus:`, { academicYearId, semesterName, startDate, endDate, setAsCurrent });
  
  try {
    // Construire la requête SQL avec les valeurs directement dans la chaîne
    const isCurrent = setAsCurrent ? 1 : 0;
    
    const query = `INSERT INTO semesters (
      academic_year_id, semester_name, start_date, end_date, is_current
    ) VALUES (
      '${academicYearId}', 
      '${semesterName.replace(/'/g, "''")}', 
      '${startDate || ""}', 
      '${endDate || ""}', 
      ${isCurrent}
    )`;
    
    console.log(`[DEBUG] addSemester: Exécution de la requête:`, query);
    
    const result = await executeQuery(query);
    console.log(`[DEBUG] addSemester: Résultat:`, result);
  
  return { 
    id: result.lastInsertRowid, 
    academic_year_id: academicYearId,
    semester_name: semesterName, 
    start_date: startDate,
    end_date: endDate,
    is_current: setAsCurrent ? 1 : 0,
    created_at: new Date().toISOString()
  };
  } catch (error) {
    console.error(`[ERROR] Erreur dans addSemester:`, error);
    throw error;
  }
}

async function setActiveSemester(semesterId) {
  console.log(`[DEBUG] setActiveSemester appelé avec semesterId: ${semesterId} (type: ${typeof semesterId})`);
  
  try {
    // Obtenir les informations sur le semestre avec une requête directe
    const query = `SELECT * FROM semesters WHERE id = '${semesterId}'`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    
    const semesters = await executeQuery(query);
    console.log(`[DEBUG] Résultat de la requête:`, JSON.stringify(semesters));
    
    if (semesters.length === 0) {
      console.error(`[ERROR] Semestre avec ID=${semesterId} non trouvé`);
    throw new Error('الفصل الدراسي غير موجود');
  }
  
    const semester = semesters[0];
    
    // Désactiver le semestre courant précédent
    const updateQuery1 = `UPDATE semesters SET is_current = 0 WHERE academic_year_id = '${semester.academic_year_id}'`;
    console.log(`[DEBUG] Exécution de la requête: ${updateQuery1}`);
    await executeQuery(updateQuery1);
    
    // Définir le nouveau semestre comme courant
    const updateQuery2 = `UPDATE semesters SET is_current = 1 WHERE id = '${semesterId}'`;
    console.log(`[DEBUG] Exécution de la requête: ${updateQuery2}`);
    await executeQuery(updateQuery2);
  
  return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans setActiveSemester:`, error);
    throw error;
  }
}

async function deleteSemester(semesterId) {
  console.log(`[DEBUG] deleteSemester appelé avec semesterId: ${semesterId} (type: ${typeof semesterId})`);
  
  try {
    // Supprimer le semestre avec une requête directe
    const query = `DELETE FROM semesters WHERE id = '${semesterId}'`;
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    
    const result = await executeQuery(query);
    console.log(`[DEBUG] Résultat de la suppression:`, JSON.stringify(result));
    
    return { success: true };
  } catch (error) {
    console.error(`[ERROR] Erreur dans deleteSemester:`, error);
    throw error;
  }
}

async function updateSemester(semesterId, semesterName, startDate, endDate) {
  console.log(`[DEBUG] updateSemester appelé avec:`, { semesterId, semesterName, startDate, endDate });
  
  try {
    // Construction manuelle de la requête SQL pour éviter les problèmes de paramètres
    const query = `
      UPDATE semesters SET 
        semester_name = '${semesterName.replace(/'/g, "''")}', 
        start_date = '${startDate}', 
        end_date = '${endDate}'
      WHERE id = '${semesterId}'
    `;
    
    console.log(`[DEBUG] Exécution de la requête: ${query}`);
    const result = await executeQuery(query);
    
    console.log(`[DEBUG] Résultat de la mise à jour:`, result);
    
    // Récupérer le semestre mis à jour
    const selectQuery = `SELECT * FROM semesters WHERE id = '${semesterId}'`;
    const updatedSemester = await executeQuery(selectQuery);
    
    if (updatedSemester.length === 0) {
      throw new Error('Semestre non trouvé après mise à jour');
    }
    
    return updatedSemester[0];
  } catch (error) {
    console.error(`[ERROR] Erreur dans updateSemester:`, error);
    throw error;
  }
}

// Fonctions pour les sessions supplémentaires
async function getExtraSessions() {
  return await executeQueryWithErrorHandling(`
    SELECT es.*, 
      g.name as group_name,
      p.name as professor_name,
      c.name as course_name,
      r.name as room_name
    FROM extra_sessions es
    LEFT JOIN groups g ON es.group_id = g.id
    LEFT JOIN professors p ON es.professor_id = p.id
    LEFT JOIN courses c ON es.course_id = c.id
    LEFT JOIN rooms r ON es.room_id = r.id
    ORDER BY es.session_date, es.start_time
  `);
}

async function createExtraSession(session) {
  console.log('🚀 createExtraSession called with MANUAL query string 🚀');
  console.log('Session data received:', session);

  // Helper to safely escape values for SQL string
  const s = (value) => {
    if (value === null || value === undefined) return 'NULL';
    return `'${String(value).replace(/'/g, "''")}'`;
  };

  const query = `
    INSERT INTO extra_sessions (
      group_id, course_id, professor_id, room_id, session_date, 
      start_time, end_time, description, session_type, reason, 
      is_makeup, academic_year, semester
    ) VALUES (
      ${s(session.group_id)},
      ${s(session.course_id)},
      ${s(session.professor_id)},
      ${s(session.room_id)},
      ${s(session.session_date)},
      ${s(session.start_time)},
      ${s(session.end_time)},
      ${s(session.description || '')},
      ${s(session.session_type || 'makeup')},
      ${s(session.description || '')}, 
      ${session.session_type === 'makeup' ? 1 : 0},
      ${s(session.academic_year || '')},
      ${s(session.semester || '')}
    )
  `;

  try {
    // We pass an empty array for params because the values are in the query string
    const result = await executeQueryWithErrorHandling(query, [], 'run');
    console.log('✅ Successfully inserted extra session with manual query. ID:', result.lastInsertRowid);
    
    // تسجيل في audit_log
    const sessionType = session.session_type === 'makeup' ? 'حصة تعويض' : 'حصة إضافية';
    await logAudit(null, 'create', 'extra_session', result.lastInsertRowid, `إضافة ${sessionType} في ${session.session_date}`);
    
    return { id: result.lastInsertRowid, ...session };
  } catch (error) {
    console.error('❌ Failed to insert extra session with manual query:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

async function updateExtraSession(session) {
  await executeQueryWithErrorHandling(`
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
    session.description || '',  // reason
    session.session_type === 'makeup' ? 1 : 0,  // is_makeup
    session.academic_year || '',
    session.semester || '',
    session.id
  ], 'run');
  
  // تسجيل في audit_log
  const sessionType = session.session_type === 'makeup' ? 'حصة تعويض' : 'حصة إضافية';
  await logAudit(null, 'update', 'extra_session', session.id, `تحديث ${sessionType} في ${session.session_date}`);
  
  return { ...session };
}

async function deleteExtraSession(id) {
  // تسجيل في audit_log
  await logAudit(null, 'delete', 'extra_session', id, 'حذف حصة إضافية');
  
  return await executeQueryWithErrorHandling('DELETE FROM extra_sessions WHERE id = ?', [id], 'run');
}

// Fonction pour importer des données d'une année précédente
async function importDataFromPreviousYear(sourceYearId, targetYearId, importSpecializations = true, importGroups = true, importCourses = true) {
  try {
    // Obtenir les années source et cible
    const sourceYearResult = await executeQueryWithErrorHandling('SELECT * FROM academic_years WHERE id = ?', [sourceYearId]);
    const targetYearResult = await executeQueryWithErrorHandling('SELECT * FROM academic_years WHERE id = ?', [targetYearId]);
    
    if (sourceYearResult.length === 0 || targetYearResult.length === 0) {
      throw new Error('السنة الدراسية المصدر أو الهدف غير موجودة');
    }
    
    const sourceYear = sourceYearResult[0];
    const targetYear = targetYearResult[0];
    
    // Importer les spécialisations si nécessaire
    if (importSpecializations) {
      const specializations = await executeQueryWithErrorHandling(`
        SELECT * FROM groups 
        WHERE group_type = 'specialization' 
        AND id IN (
          SELECT DISTINCT g.id FROM groups g
          JOIN assignments a ON a.group_id = g.id
          WHERE a.academic_year = ?
        )
      `, [sourceYear.year_name]);
      
      for (const spec of specializations) {
        // Vérifier si la spécialisation existe déjà
        const existingSpec = await executeQueryWithErrorHandling(`
          SELECT * FROM groups 
          WHERE specialization = ? AND group_type = 'specialization'
          AND id IN (
            SELECT DISTINCT g.id FROM groups g
            JOIN assignments a ON a.group_id = g.id
            WHERE a.academic_year = ?
          )
        `, [spec.specialization, targetYear.year_name]);
        
        if (existingSpec.length === 0) {
          // Créer une nouvelle spécialisation
          await executeQueryWithErrorHandling(`
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
    
    // Importer les groupes si nécessaire
      if (importGroups) {
      const groups = await executeQueryWithErrorHandling(`
        SELECT * FROM groups 
        WHERE group_type = 'group' 
        AND id IN (
          SELECT DISTINCT g.id FROM groups g
          JOIN assignments a ON a.group_id = g.id
          WHERE a.academic_year = ?
        )
      `, [sourceYear.year_name]);
      
      for (const group of groups) {
        // Vérifier si le groupe existe déjà
        const existingGroup = await executeQueryWithErrorHandling(`
          SELECT * FROM groups 
          WHERE name = ? AND specialization = ? AND group_type = 'group'
          AND id IN (
            SELECT DISTINCT g.id FROM groups g
            JOIN assignments a ON a.group_id = g.id
            WHERE a.academic_year = ?
          )
        `, [group.name, group.specialization, targetYear.year_name]);
          
          if (existingGroup.length === 0) {
          // Créer un nouveau groupe
          await executeQueryWithErrorHandling(`
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
    
    // Importer les cours si nécessaire
    if (importCourses) {
      const courses = await executeQueryWithErrorHandling(`
        SELECT DISTINCT c.* FROM courses c
        JOIN assignments a ON a.course_id = c.id
        WHERE a.academic_year = ?
      `, [sourceYear.year_name]);
      
      for (const course of courses) {
        // Vérifier si le cours existe déjà
        const existingCourse = await executeQueryWithErrorHandling('SELECT * FROM courses WHERE name = ? AND code = ?', [course.name, course.code]);
        
        if (existingCourse.length === 0) {
          // Créer un nouveau cours
          await executeQueryWithErrorHandling(
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

// Fonction pour créer la table des professeurs
async function createProfessorsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS professors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      Title TEXT,
      Phone TEXT,
      "Academic Title" TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  try {
    await executeQuery(query);
    console.log('Created professors table');
  } catch (error) {
    console.error('Error creating professors table:', error);
    throw error;
  }
}

// Fonction pour arrêter proprement la surveillance et fermer la connexion
function gracefulShutdown() {
  console.log('🔄 Arrêt propre de la connexion SQLiteCloud...');
  closeConnection();
  console.log('✅ Connexion fermée proprement');
}

// Écouter les événements d'arrêt de l'application
if (typeof process !== 'undefined') {
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('exit', gracefulShutdown);
}

// Initialiser la base de données
async function initializeDatabase() {
  try {
    await initDatabaseConnection();
    
    // Création de la table des départements
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created departments table');
    
    // Création de la table des groupes
    await executeQuery(`
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
    await executeQuery(`
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
    await createProfessorsTable();
    
    // Création de la table des salles
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        capacity INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created rooms table');

    // Création de la table des attributions
    await executeQuery(`
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
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_name TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created academic_years table');

    // Création de la table des semestres
    await executeQuery(`
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
    await executeQuery(`
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

    // Création de la table des utilisateurs (Authentication & Authorization)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL CHECK(role IN ('admin', 'schedule_manager', 'staff', 'professor')) DEFAULT 'staff',
        professor_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        FOREIGN KEY(professor_id) REFERENCES professors(id) ON DELETE SET NULL
      )
    `);
    console.log('Created users table');

    // Création de la table d'audit (enregistrement des actions sensibles uniquement)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'login', 'logout', 'backup', 'restore')),
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('Created audit_log table');

    // Création de la table d'historique des sauvegardes
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS backup_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_name TEXT NOT NULL,
        backup_path TEXT NOT NULL,
        backup_type TEXT NOT NULL CHECK(backup_type IN ('full', 'partial', 'auto', 'manual')),
        backup_format TEXT NOT NULL CHECK(backup_format IN ('sqlite', 'sql', 'json')),
        file_size INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('Created backup_history table');

    // Création des index pour la recherche rapide
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_group ON assignments(group_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_professor ON assignments(professor_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_room ON assignments(room_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_assignments_day ON assignments(day_of_week)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_semesters_academic_year ON semesters(academic_year_id)');
    
    // Index pour users
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    
    // Index pour audit_log
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_log(entity_type)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)');
    
    // Index pour backup_history
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_backup_created_at ON backup_history(created_at)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_backup_type ON backup_history(backup_type)');

    // Insérer un utilisateur admin par défaut (mot de passe: admin123)
    // Générer un nouveau hash bcrypt pour 'admin123'
    try {
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      
      // Vérifier si l'utilisateur admin existe
      const existingAdmin = await executeQuery("SELECT id FROM users WHERE username = 'admin'");
      
      if (existingAdmin.length === 0) {
        // Créer l'utilisateur admin s'il n'existe pas
        await executeQuery(`
          INSERT INTO users (id, username, password_hash, full_name, role, is_active)
          VALUES (1, 'admin', '${adminPasswordHash}', 'المدير', 'admin', 1)
        `);
        console.log('Default admin user created');
      } else {
        // Mettre à jour le mot de passe de l'admin existant
        await executeQuery(`
          UPDATE users SET password_hash = '${adminPasswordHash}' WHERE username = 'admin'
        `);
        console.log('Default admin user password updated');
      }
    } catch (error) {
      console.log('Error creating/updating admin user:', error.message);
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw new Error(`فشل تهيئة قاعدة البيانات: ${error.message}`);
  }
}

// ========================================
// Authentication & User Management Functions
// ========================================

/**
 * تسجيل الدخول
 */
async function login(username, password) {
  try {
    console.log('🔐 Login attempt for user:', username);
    const query = `SELECT * FROM users WHERE username = '${username}' AND is_active = 1`;
    const users = await executeQuery(query);
    
    console.log('📊 Users found:', users.length);
    
    if (users.length === 0) {
      console.log('❌ No user found or user is inactive');
      return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }
    
    const user = users[0];
    console.log('👤 User found:', user.username, 'ID:', user.id);
    console.log('🔑 Password hash from DB:', user.password_hash?.substring(0, 20) + '...');
    
    // التحقق من كلمة المرور
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    console.log('🔐 Password match:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('❌ Password does not match');
      return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }
    
    // تحديث وقت آخر تسجيل دخول
    await executeQuery(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${user.id}`);
    
    // تسجيل في audit_log
    await logAudit(user.id, 'login', 'user', user.id, null);
    
    // إرجاع بيانات المستخدم (بدون كلمة المرور)
    const { password_hash, ...userWithoutPassword } = user;
    
    return { 
      success: true, 
      user: userWithoutPassword
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'حدث خطأ أثناء تسجيل الدخول' };
  }
}

/**
 * تسجيل الخروج
 */
async function logout(userId) {
  try {
    await logAudit(userId, 'logout', 'user', userId, null);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false };
  }
}

/**
 * جلب كل المستخدمين
 */
async function getUsers() {
  try {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.professor_id,
        u.is_active,
        u.created_at,
        u.updated_at,
        u.last_login,
        p.name as professor_name
      FROM users u
      LEFT JOIN professors p ON u.professor_id = p.id
      ORDER BY u.created_at DESC
    `;
    
    return await executeQuery(query, []);
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
}

/**
 * إضافة مستخدم جديد
 */
async function addUser(userData) {
  try {
    const { username, password, full_name, email, role, professor_id, is_active } = userData;
    
    // التحقق من عدم وجود المستخدم
    const existingUsers = await executeQuery(`SELECT id FROM users WHERE username = '${username}'`);
    if (existingUsers.length > 0) {
      throw new Error('اسم المستخدم موجود بالفعل');
    }
    
    // تشفير كلمة المرور
    const password_hash = await bcrypt.hash(password, 10);
    
    const emailValue = email ? `'${email}'` : 'NULL';
    const professorIdValue = professor_id ? professor_id : 'NULL';
    const isActiveValue = is_active ? 1 : 0;
    
    const query = `
      INSERT INTO users (username, password_hash, full_name, email, role, professor_id, is_active)
      VALUES ('${username}', '${password_hash}', '${full_name}', ${emailValue}, '${role}', ${professorIdValue}, ${isActiveValue})
    `;
    
    await executeQuery(query);
    
    // جلب المستخدم المضاف
    const newUsers = await executeQuery(`SELECT * FROM users WHERE username = '${username}'`);
    const newUser = newUsers[0];
    
    // تسجيل في audit_log
    await logAudit(null, 'create', 'user', newUser.id, JSON.stringify({ username, role }));
    
    // إرجاع بدون كلمة المرور
    const { password_hash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

/**
 * تحديث مستخدم
 */
async function updateUser(userId, userData) {
  try {
    const { username, full_name, email, role, professor_id, is_active } = userData;
    
    // التحقق من عدم تكرار اسم المستخدم
    if (username) {
      const existingUsers = await executeQuery(
        `SELECT id FROM users WHERE username = '${username}' AND id != ${userId}`
      );
      if (existingUsers.length > 0) {
        throw new Error('اسم المستخدم موجود بالفعل');
      }
    }
    
    const updates = [];
    
    if (username !== undefined) updates.push(`username = '${username}'`);
    if (full_name !== undefined) updates.push(`full_name = '${full_name}'`);
    if (email !== undefined) updates.push(`email = ${email ? `'${email}'` : 'NULL'}`);
    if (role !== undefined) updates.push(`role = '${role}'`);
    if (professor_id !== undefined) updates.push(`professor_id = ${professor_id || 'NULL'}`);
    if (is_active !== undefined) updates.push(`is_active = ${is_active ? 1 : 0}`);
    
    if (updates.length === 0) {
      throw new Error('لا توجد بيانات للتحديث');
    }
    
    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;
    await executeQuery(query);
    
    // تسجيل في audit_log
    await logAudit(null, 'update', 'user', userId, JSON.stringify(userData));
    
    // جلب المستخدم المحدث
    const updatedUsers = await executeQuery(`SELECT * FROM users WHERE id = ${userId}`);
    const updatedUser = updatedUsers[0];
    
    const { password_hash, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * حذف مستخدم
 */
async function deleteUser(userId) {
  try {
    // منع حذف المدير الأساسي
    if (userId === 1) {
      throw new Error('لا يمكن حذف المدير الأساسي');
    }
    
    await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
    
    // تسجيل في audit_log
    await logAudit(null, 'delete', 'user', userId, null);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * تغيير كلمة المرور
 */
async function changePassword(userId, oldPassword, newPassword) {
  try {
    // جلب المستخدم
    const users = await executeQuery('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return { success: false, message: 'المستخدم غير موجود' };
    }
    
    const user = users[0];
    
    // التحقق من كلمة المرور القديمة
    const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!passwordMatch) {
      return { success: false, message: 'كلمة المرور القديمة غير صحيحة' };
    }
    
    // تشفير كلمة المرور الجديدة
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    await executeQuery('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newPasswordHash, userId]);
    
    // تسجيل في audit_log
    await logAudit(userId, 'update', 'user', userId, 'تغيير كلمة المرور');
    
    return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
  } catch (error) {
    console.error('Error changing password:', error);
    return { success: false, message: 'حدث خطأ أثناء تغيير كلمة المرور' };
  }
}

/**
 * إعادة تعيين كلمة المرور (للمدير فقط)
 */
async function resetPassword(userId, newPassword) {
  try {
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await executeQuery('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newPasswordHash, userId]);
    
    // تسجيل في audit_log
    await logAudit(null, 'update', 'user', userId, 'إعادة تعيين كلمة المرور');
    
    return { success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, message: 'حدث خطأ أثناء إعادة تعيين كلمة المرور' };
  }
}

/**
 * تفعيل/تعطيل مستخدم
 */
async function toggleUserStatus(userId, isActive) {
  try {
    await executeQuery('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [isActive ? 1 : 0, userId]);
    
    // تسجيل في audit_log
    await logAudit(null, 'update', 'user', userId, `${isActive ? 'تفعيل' : 'تعطيل'} المستخدم`);
    
    return { success: true };
  } catch (error) {
    console.error('Error toggling user status:', error);
    throw error;
  }
}

/**
 * تسجيل في سجل الأنشطة (التغييرات الحساسة فقط)
 */
async function logAudit(userId, action, entityType, entityId, details) {
  try {
    const userIdValue = userId ? userId : 'NULL';
    const entityIdValue = entityId ? entityId : 'NULL';
    const detailsValue = details ? `'${details.replace(/'/g, "''")}'` : 'NULL';
    
    const query = `
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
      VALUES (${userIdValue}, '${action}', '${entityType}', ${entityIdValue}, ${detailsValue})
    `;
    
    await executeQuery(query);
  } catch (error) {
    console.error('Error logging audit:', error);
    // لا نرمي خطأ إذا فشل التسجيل
  }
}

/**
 * جلب سجل الأنشطة
 */
async function getAuditLogs(filters = {}) {
  try {
    let query = `
      SELECT 
        a.id,
        a.user_id,
        u.username as user_name,
        u.full_name,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.ip_address,
        a.created_at
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.userId) {
      query += ' AND a.user_id = ?';
      params.push(filters.userId);
    }
    
    if (filters.action) {
      query += ' AND a.action = ?';
      params.push(filters.action);
    }
    
    if (filters.startDate) {
      query += ' AND a.created_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ' AND a.created_at <= ?';
      params.push(filters.endDate);
    }
    
    query += ' ORDER BY a.created_at DESC LIMIT 1000';
    
    return await executeQuery(query, params);
  } catch (error) {
    console.error('Error getting audit logs:', error);
    throw error;
  }
}

// Exporter toutes les fonctions
module.exports = {
  initializeDatabase,
  runMigrations,
  executeQuery,
  closeConnection,
  initDatabaseConnection,
  reconnectDatabase,
  gracefulShutdown,
  
  // Départements
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  
  // Groupes
  getGroups,
  getGroupsByDepartment,
  getGroupsBySpecialization,
  getSpecializationsByDepartment,
  addGroup,
  updateGroup,
  deleteGroup,
  deleteAllGroups,
  
  // Cours
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  
  // Professeurs
  getProfessors,
  addProfessor,
  updateProfessor,
  deleteProfessor,
  
  // Salles
  getRooms,
  addRoom,
  updateRoom,
  deleteRoom,
  
  // Attributions
  getAssignments,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  checkConflicts,
  
  // Années académiques
  getAcademicYears,
  getActiveAcademicYear,
  addAcademicYear,
  setActiveAcademicYear,
  deleteAcademicYear,
  
  // Semestres
  getSemesters,
  getActiveSemester,
  addSemester,
  setActiveSemester,
  deleteSemester,
  updateSemester,
  
  // Sessions supplémentaires
  getExtraSessions,
  createExtraSession,
  updateExtraSession,
  deleteExtraSession,
  
  // Importation de données
  importDataFromPreviousYear,
  
  // Fonction pour obtenir les créneaux horaires standards
  getTimeSlots: async function() {
    // Retourner les créneaux horaires standards utilisés dans l'application
    return [
      { id: 0, label: '8.00 - 9.30', start: '08:00', end: '09:30' },
      { id: 1, label: '9.30 - 11.00', start: '09:30', end: '11:00' },
      { id: 2, label: '11.00 - 12.30', start: '11:00', end: '12:30' },
      { id: 3, label: '12.30 - 14.00', start: '12:30', end: '14:00' },
      { id: 4, label: '14.00 - 15.30', start: '14:00', end: '15:30' },
      { id: 5, label: '15.30 - 17.00', start: '15:30', end: '17:00' }
    ];
  },

  // Authentification et utilisateurs
  login,
  logout,
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  changePassword,
  resetPassword,
  toggleUserStatus,
  logAudit,
  getAuditLogs
};