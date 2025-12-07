const { app } = require('electron');
const path = require('path');
const bcrypt = require('bcrypt');
const NeonDatabaseAdapter = require('./database-neon');
const { Database } = require('@sqlitecloud/drivers');
const { DatabaseAPIClient } = require('./database-api');
const { createClient } = require('@libsql/client');
const BetterSQLite3 = require('better-sqlite3');
const { getConfigManager } = require('./config-manager');

// Charger dotenv en mode développement, ignorer en production
try {
  require('dotenv').config();
} catch (error) {
  console.log('Module dotenv non disponible en production');
}

// Fonction pour obtenir la configuration de la base de données
function getDatabaseConfig() {
  const configManager = getConfigManager();
  const dbConfig = configManager.getDatabaseConfig();

  console.log('🔧 getDatabaseConfig() called');
  console.log('   - useTurso:', dbConfig.useTurso);
  console.log('   - Turso URL:', dbConfig.turso?.url);

  return {
    useTurso: dbConfig.useTurso || false,
    turso: dbConfig.turso
  };
}

// Database configuration
let dbConfigCache = null;
function getDbConfig() {
  if (!dbConfigCache) {
    dbConfigCache = getDatabaseConfig();
  }
  return dbConfigCache;
}

// Reset config cache (يُستدعى بعد تحديث الإعدادات)
function resetDbConfigCache() {
  dbConfigCache = null;
}

console.log('🔧 Database settings: Turso');

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
  if (!db) return false;

  try {
    await db.sql('SELECT 1 as health_check', []);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

// Fonction pour démarrer la surveillance de la connexion
function startConnectionMonitoring() {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }

  connectionHealthInterval = setInterval(async () => {
    const isHealthy = await checkConnectionHealth();
    if (!isHealthy) {
      console.log('⚠️ Connection health check failed, attempting reconnection...');
      await reconnectDatabase();
    }
  }, HEALTH_CHECK_INTERVAL);

  console.log(`🔍 Started connection monitoring (every ${HEALTH_CHECK_INTERVAL}ms)`);
}

// Fonction pour s'assurer que la colonne last_login existe
async function ensureLastLoginColumn() {
  try {
    // Vérifier si la colonne last_login existe déjà
    await executeQuery('SELECT last_login FROM users LIMIT 1');
    console.log('✅ last_login column already exists');
  } catch (error) {
    if (error.message.includes('no such column') || error.message.includes('does not exist')) {
      console.log('ℹ️ Adding last_login column to users table...');
      await executeQuery('ALTER TABLE users ADD COLUMN last_login TEXT');
      console.log('✅ Added last_login column to users table');
    } else {
      throw error;
    }
  }
}

// Fonction pour s'assurer que la colonne permissions existe
async function ensurePermissionsColumn() {
  try {
    // Vérifier si la colonne permissions existe déjà
    await executeQuery('SELECT permissions FROM users LIMIT 1');
    console.log('✅ permissions column already exists');
  } catch (error) {
    if (error.message.includes('no such column') || error.message.includes('does not exist')) {
      console.log('ℹ️ Adding permissions column to users table...');
      await executeQuery('ALTER TABLE users ADD COLUMN permissions TEXT');
      console.log('✅ Added permissions column to users table');
    } else {
      throw error;
    }
  }
}

// Fonction pour s'assurer que la table sandbox_snapshots existe
async function ensureSandboxTable() {
  try {
    await executeQuery('SELECT 1 FROM sandbox_snapshots LIMIT 1');
    console.log('✅ sandbox_snapshots table already exists');
  } catch (error) {
    if (error.message.includes('no such table') || error.message.includes('does not exist')) {
      console.log('ℹ️ Creating sandbox_snapshots table...');
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS sandbox_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created sandbox_snapshots table');
    } else {
      throw error;
    }
  }
}

// Fonction pour s'assurer que la table audit_log existe
async function ensureAuditLogTable() {
  try {
    // Vérifier si la table audit_log existe déjà
    await executeQuery('SELECT 1 FROM audit_log LIMIT 1');
    console.log('✅ audit_log table already exists');
  } catch (error) {
    if (error.message.includes('no such table') || error.message.includes('does not exist')) {
      console.log('ℹ️ Creating audit_log table...');
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id INTEGER,
          details TEXT,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ Created audit_log table');
    } else {
      throw error;
    }
  }
}

// Fonction pour s'assurer que la table sandbox_snapshots existe
async function ensureSandboxTable() {
  try {
    await executeQuery('SELECT 1 FROM sandbox_snapshots LIMIT 1');
    console.log('✅ sandbox_snapshots table already exists');
  } catch (error) {
    if (error.message.includes('no such table') || error.message.includes('does not exist')) {
      console.log('ℹ️ Creating sandbox_snapshots table...');
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS sandbox_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created sandbox_snapshots table');
    } else {
      throw error;
    }
  }
}

// Initialiser la connexion à la base de données avec retry logic
async function initDatabaseConnection(retryCount = 0) {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30000; // 30 seconds

  try {
    if (!db) {
      const config = getDbConfig();

      console.log('🔍 Config received:', JSON.stringify(config, null, 2));

      if (!config.useTurso || !config.turso) {
        throw new Error('Turso configuration is missing! useTurso: ' + config.useTurso + ', turso: ' + JSON.stringify(config.turso));
      }

      // Turso only - Multi-user mode via HTTPS (Port 443)
      console.log(`🚀 Initializing Turso connection... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      console.log(`⏱️ Connecting to: ${config.turso.url}`);

      const tursoClient = createClient({
        url: config.turso.url,
        authToken: config.turso.authToken
      });

      // Wrap Turso client to match expected API
      db = {
        sql: async (query, params = []) => {
          const result = await tursoClient.execute({
            sql: query,
            args: params
          });
          return result.rows;
        },
        close: () => tursoClient.close(),
        raw: tursoClient
      };

      // Test connection
      const testPromise = db.sql('SELECT 1 as test', []);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );

      await Promise.race([testPromise, timeoutPromise]);
      console.log('✅ Database connected successfully');

      // Ensure the last_login column exists
      await ensureLastLoginColumn();

      // Ensure the permissions column exists
      await ensurePermissionsColumn();

      // Ensure the audit_log table exists
      await ensureAuditLogTable();

      // Ensure the sandbox_snapshots table exists
      await ensureSandboxTable();

      reconnectAttempts = 0;
      isReconnecting = false;

      return db;
    }
    return db;
  } catch (error) {
    console.error(`❌ Database connection failed (Attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);
    closeConnection();

    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const delayMs = (retryCount + 1) * 2000; // 2s, 4s, 6s
      console.log(`⏳ Retrying in ${delayMs / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return initDatabaseConnection(retryCount + 1);
    }

    // After all retries failed
    throw new Error(`فشل الاتصال بقاعدة البيانات بعد ${MAX_RETRIES + 1} محاولات: ${error.message}`);
  }
}

// Fonction pour reconnecter automatiquement
async function reconnectDatabase() {
  if (isReconnecting) return;

  isReconnecting = true;
  reconnectAttempts++;

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ Max reconnection attempts reached');
    isReconnecting = false;
    return;
  }

  console.log(`🔄 Attempting reconnection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  try {
    closeConnection();
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
    await initDatabaseConnection();
    console.log('✅ Reconnection successful');
  } catch (error) {
    console.error('❌ Reconnection failed:', error.message);
    setTimeout(() => reconnectDatabase(), RECONNECT_DELAY);
  }

  isReconnecting = false;
}

// Exécuter une requête avec gestion d'erreur et retry
async function executeQuery(query, params = []) {
  try {
    if (!db) {
      await initDatabaseConnection();
    }

    // Convert PostgreSQL placeholders ($1, $2, ...) to SQLite placeholders (?)
    let sqliteQuery = query;
    const cleanParams = params.map(p => p === undefined ? null : p);

    // Replace $1, $2, etc. with ?
    if (query.includes('$')) {
      let index = 1;
      while (sqliteQuery.includes(`$${index}`)) {
        sqliteQuery = sqliteQuery.replace(`$${index}`, '?');
        index++;
      }
    }

    const result = await db.sql(sqliteQuery, cleanParams);
    return result;
  } catch (error) {
    console.error('❌ Query execution failed:', error.message);
    console.error('📝 Query:', query);
    console.error('📝 Params:', params);

    // Try to reconnect and retry once
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log('🔄 Attempting reconnection and retry...');
      await reconnectDatabase();
      try {
        // Use same conversion for retry
        let sqliteQuery = query;
        const cleanParams = params.map(p => p === undefined ? null : p);
        if (query.includes('$')) {
          let index = 1;
          while (sqliteQuery.includes(`$${index}`)) {
            sqliteQuery = sqliteQuery.replace(`$${index}`, '?');
            index++;
          }
        }
        const result = await db.sql(sqliteQuery, cleanParams);
        return result;
      } catch (retryError) {
        console.error('❌ Retry failed:', retryError.message);
        throw retryError;
      }
    }

    throw error;
  }
}

// Fonction pour obtenir les départements
async function getDepartments() {
  const query = 'SELECT * FROM departments ORDER BY name';
  return await executeQuery(query);
}

// Fonction pour ajouter un département
async function addDepartment(name, code) {
  const query = 'INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING *';
  const result = await executeQuery(query, [name, code]);
  return result[0];
}

// Fonction pour mettre à jour un département
async function updateDepartment(id, name, code) {
  const query = 'UPDATE departments SET name = $1, code = $2 WHERE id = $3 RETURNING *';
  const result = await executeQuery(query, [name, code, id]);
  return result[0];
}

// Fonction pour supprimer un département
async function deleteDepartment(id) {
  const query = 'DELETE FROM departments WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction pour obtenir les professeurs
async function getProfessors() {
  const query = 'SELECT * FROM professors ORDER BY name';
  return await executeQuery(query);
}

// Fonction pour ajouter un professeur
async function addProfessor(name, email, metadataJson) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Professor name is required');
  }

  let metadata = {};
  if (metadataJson) {
    try {
      metadata = typeof metadataJson === 'string' ? JSON.parse(metadataJson) : metadataJson;
    } catch (error) {
      console.warn('❗️ Failed to parse professor metadata, continuing with empty object:', error);
      metadata = {};
    }
  }

  const phone = (metadata.phone || '').trim();
  const title = (metadata.title || '').trim();
  const academic_title = (metadata.academic_title || '').trim();

  const query = `
    INSERT INTO professors (name, email, phone, title, academic_title) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING *
  `;
  const result = await executeQuery(query, [name.trim(), email ?? null, phone, title, academic_title]);
  return result[0];
}

// Fonction pour mettre à jour un professeur
async function updateProfessor(id, name, email, metadataJson) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Professor name is required');
  }

  let metadata = {};
  if (metadataJson) {
    try {
      metadata = typeof metadataJson === 'string' ? JSON.parse(metadataJson) : metadataJson;
    } catch (error) {
      console.warn('❗️ Failed to parse professor metadata on update, continuing with empty object:', error);
      metadata = {};
    }
  }

  const phone = (metadata.phone || '').trim();
  const title = (metadata.title || '').trim();
  const academic_title = (metadata.academic_title || '').trim();

  const query = `
    UPDATE professors 
    SET name = $1, email = $2, phone = $3, title = $4, academic_title = $5 
    WHERE id = $6 
    RETURNING *
  `;
  const result = await executeQuery(query, [name.trim(), email ?? null, phone, title, academic_title, id]);
  return result[0];
}

// Fonction pour supprimer un professeur
async function deleteProfessor(id) {
  const query = 'DELETE FROM professors WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction pour obtenir les salles
async function getRooms() {
  const query = 'SELECT * FROM rooms ORDER BY name';
  return await executeQuery(query);
}

// Fonction pour ajouter une salle
async function addRoom(roomData) {
  const { name, capacity } = roomData;
  const query = 'INSERT INTO rooms (name, capacity) VALUES ($1, $2) RETURNING *';
  const result = await executeQuery(query, [name, capacity]);
  return result[0];
}

// Fonction pour mettre à jour une salle
async function updateRoom(id, roomData) {
  const { name, capacity } = roomData;
  const query = 'UPDATE rooms SET name = $1, capacity = $2 WHERE id = $3 RETURNING *';
  const result = await executeQuery(query, [name, capacity, id]);
  return result[0];
}

// Fonction pour supprimer une salle
async function deleteRoom(id) {
  const query = 'DELETE FROM rooms WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction pour obtenir les cours
async function getCourses() {
  const query = 'SELECT * FROM courses ORDER BY name';
  return await executeQuery(query);
}

// Fonction pour ajouter un cours
async function addCourse(courseData) {
  const { name, code, metadata } = courseData;
  const query = 'INSERT INTO courses (name, code, metadata) VALUES ($1, $2, $3) RETURNING *';
  const result = await executeQuery(query, [name, code, metadata]);
  return result[0];
}

// Fonction pour mettre à jour un cours
async function updateCourse(id, courseData) {
  const { name, code, metadata } = courseData;
  const query = 'UPDATE courses SET name = $1, code = $2, metadata = $3 WHERE id = $4 RETURNING *';
  const result = await executeQuery(query, [name, code, metadata, id]);
  return result[0];
}

// Fonction pour supprimer un cours
async function deleteCourse(id) {
  const query = 'DELETE FROM courses WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction pour obtenir les groupes
async function getGroups() {
  const query = 'SELECT * FROM groups ORDER BY name';
  return await executeQuery(query);
}

// Fonction pour ajouter un groupe
async function addGroup(groupData) {
  const { name, department_id, group_type, specialization, parent_group_id, year } = groupData;
  const query = `
    INSERT INTO groups (name, department_id, group_type, specialization, parent_group_id, year) 
    VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING *
  `;
  const result = await executeQuery(query, [name, department_id, group_type, specialization, parent_group_id, year]);
  return result[0];
}

// Fonction pour mettre à jour un groupe
async function updateGroup(id, groupData) {
  const { name, department_id, group_type, specialization, parent_group_id, year } = groupData;
  const query = `
    UPDATE groups 
    SET name = $1, department_id = $2, group_type = $3, specialization = $4, parent_group_id = $5, year = $6 
    WHERE id = $7 
    RETURNING *
  `;
  const result = await executeQuery(query, [name, department_id, group_type, specialization, parent_group_id, year, id]);
  return result[0];
}

// Fonction pour supprimer un groupe
async function deleteGroup(id) {
  const query = 'DELETE FROM groups WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction pour obtenir les affectations
async function getAssignments(academicYear = null, semester = null, specialization = null) {
  let query = `
    SELECT a.*, 
           p.name as professor_name,
           c.name as course_name,
           r.name as room_name,
           g.name as group_name
    FROM assignments a
    LEFT JOIN professors p ON a.professor_id = p.id
    LEFT JOIN courses c ON a.course_id = c.id
    LEFT JOIN rooms r ON a.room_id = r.id
    LEFT JOIN groups g ON a.group_id = g.id
  `;

  const conditions = [];
  const params = [];

  // إضافة فلترة حسب السنة الأكاديمية
  if (academicYear) {
    conditions.push('a.academic_year = $' + (params.length + 1));
    params.push(academicYear);
  }

  // إضافة فلترة حسب الفصل الدراسي
  if (semester) {
    conditions.push('a.semester = $' + (params.length + 1));
    params.push(semester);
  }

  // إضافة فلترة حسب التخصص
  if (specialization) {
    conditions.push('g.specialization = $' + (params.length + 1));
    params.push(specialization);
  }

  // إضافة الشروط إلى الاستعلام
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY a.day_of_week, a.start_time';

  console.log('getAssignments query:', { query, params, academicYear, semester, specialization });

  return await executeQuery(query, params);
}

// Fonction pour ajouter une affectation
async function addAssignment(assignmentData) {
  const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization } = assignmentData;
  const query = `
    INSERT INTO assignments (group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
    RETURNING *
  `;
  const result = await executeQuery(query, [group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization]);
  return result[0];
}

// Fonction pour mettre à jour une affectation
async function updateAssignment(id, assignmentData) {
  const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization } = assignmentData;
  const query = `
    UPDATE assignments 
    SET group_id = $1, course_id = $2, professor_id = $3, room_id = $4, day_of_week = $5, start_time = $6, end_time = $7, academic_year = $8, semester = $9, specialization = $10 
    WHERE id = $11 
    RETURNING *
  `;
  const result = await executeQuery(query, [group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, id]);
  return result[0];
}

// Fonction pour supprimer une affectation
async function deleteAssignment(id) {
  const query = 'DELETE FROM assignments WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction pour obtenir les années académiques
async function getAcademicYears() {
  const query = 'SELECT * FROM academic_years ORDER BY year_name';
  return await executeQuery(query);
}

// Fonction pour obtenir l'année académique courante
async function getCurrentAcademicYear() {
  const query = 'SELECT * FROM academic_years WHERE is_current = 1 LIMIT 1';
  const result = await executeQuery(query);
  return result[0] || null;
}

// Alias pour la compatibilité
async function getActiveAcademicYear() {
  return await getCurrentAcademicYear();
}

// Fonction pour définir l'année académique courante
async function setCurrentAcademicYear(yearId) {
  // D'abord, désactiver toutes les années
  await executeQuery('UPDATE academic_years SET is_current = 0');

  // Ensuite, activer l'année sélectionnée
  const query = 'UPDATE academic_years SET is_current = 1 WHERE id = $1 RETURNING *';
  const result = await executeQuery(query, [yearId]);
  return result[0];
}

// Alias pour la compatibilité
async function setActiveAcademicYear(yearId) {
  return await setCurrentAcademicYear(yearId);
}

// Fonction pour ajouter une année académique
async function addAcademicYear(yearName, setAsCurrent) {
  const query = `
    INSERT INTO academic_years (year_name, is_current) 
    VALUES ($1, $2) 
    RETURNING *
  `;
  const result = await executeQuery(query, [yearName, setAsCurrent ? 1 : 0]);

  if (setAsCurrent) {
    // Désactiver toutes les autres années
    await executeQuery('UPDATE academic_years SET is_current = 0 WHERE id != $1', [result[0].id]);
  }

  return result[0];
}

// Fonction pour supprimer une année académique
async function deleteAcademicYear(yearId) {
  const query = 'DELETE FROM academic_years WHERE id = $1';
  await executeQuery(query, [yearId]);
  return true;
}

// Fonction pour obtenir les semestres
async function getSemesters() {
  const query = 'SELECT * FROM semesters ORDER BY semester_name';
  return await executeQuery(query);
}

// Fonction pour obtenir le semestre courant
async function getCurrentSemester() {
  const query = 'SELECT * FROM semesters WHERE is_current = 1 LIMIT 1';
  const result = await executeQuery(query);
  return result[0] || null;
}

// Fonction pour obtenir le semestre actif d'une année académique
async function getActiveSemester(academicYearId) {
  if (!academicYearId) {
    return await getCurrentSemester();
  }
  const query = 'SELECT * FROM semesters WHERE academic_year_id = $1 AND is_current = 1 LIMIT 1';
  const result = await executeQuery(query, [academicYearId]);
  return result[0] || null;
}

// Fonction pour définir le semestre courant
async function setCurrentSemester(semesterId) {
  // D'abord, désactiver tous les semestres
  await executeQuery('UPDATE semesters SET is_current = 0');

  // Ensuite, activer le semestre sélectionné
  const query = 'UPDATE semesters SET is_current = 1 WHERE id = $1 RETURNING *';
  const result = await executeQuery(query, [semesterId]);
  return result[0];
}

// Alias pour la compatibilité
async function setActiveSemester(semesterId) {
  return await setCurrentSemester(semesterId);
}

// Fonction pour ajouter un semestre
async function addSemester(academicYearId, semesterName, startDate, endDate, setAsCurrent) {
  const query = `
    INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING *
  `;
  const result = await executeQuery(query, [
    academicYearId,
    semesterName,
    startDate,
    endDate,
    setAsCurrent ? 1 : 0
  ]);

  if (setAsCurrent) {
    // Désactiver tous les autres semestres
    await executeQuery('UPDATE semesters SET is_current = 0 WHERE id != $1', [result[0].id]);
  }

  return result[0];
}

// Fonction pour mettre à jour un semestre
async function updateSemester(semesterId, semesterName, startDate, endDate) {
  const query = `
    UPDATE semesters 
    SET semester_name = $1, start_date = $2, end_date = $3
    WHERE id = $4 
    RETURNING *
  `;
  const result = await executeQuery(query, [semesterName, startDate, endDate, semesterId]);
  return result[0];
}

// Fonction pour supprimer un semestre
async function deleteSemester(semesterId) {
  const query = 'DELETE FROM semesters WHERE id = $1';
  await executeQuery(query, [semesterId]);
  return true;
}

// Fonction pour obtenir les utilisateurs
async function getUsers() {
  const query = 'SELECT * FROM users ORDER BY username';
  return await executeQuery(query);
}

// Fonction pour ajouter un utilisateur
async function addUser(userData) {
  const { username, password, full_name, email, role, professor_id } = userData;
  const password_hash = await bcrypt.hash(password, 10);
  const query = `
    INSERT INTO users (username, password_hash, full_name, email, role, professor_id) 
    VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING *
  `;
  const result = await executeQuery(query, [username, password_hash, full_name, email, role, professor_id]);
  return result[0];
}

// Fonction pour mettre à jour un utilisateur
async function updateUser(id, userData) {
  const { username, full_name, email, role, professor_id, is_active } = userData;
  const query = `
    UPDATE users 
    SET username = $1, full_name = $2, email = $3, role = $4, professor_id = $5, is_active = $6 
    WHERE id = $7 
    RETURNING *
  `;
  const result = await executeQuery(query, [username, full_name, email, role, professor_id, is_active, id]);
  return result[0];
}

// Fonction pour supprimer un utilisateur
async function deleteUser(id) {
  const query = 'DELETE FROM users WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction pour changer le mot de passe
async function changePassword(userId, oldPassword, newPassword) {
  const user = await executeQuery('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!user[0]) {
    throw new Error('Utilisateur non trouvé');
  }

  const isValid = await bcrypt.compare(oldPassword, user[0].password_hash);
  if (!isValid) {
    throw new Error('Ancien mot de passe incorrect');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await executeQuery('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
  return true;
}

// Fonction pour réinitialiser le mot de passe
async function resetPassword(userId, newPassword) {
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await executeQuery('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
  return { success: true };
}

// Fonction pour basculer le statut d'un utilisateur
async function toggleUserStatus(userId, isActive) {
  const query = 'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *';
  const result = await executeQuery(query, [isActive, userId]);
  return result[0];
}

// Fonction pour obtenir les logs d'audit
async function getAuditLogs(filters = {}) {
  let query = `
    SELECT 
      al.*, 
      u.username as user_name,
      u.full_name as full_name
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
  `;

  const params = [];
  const conditions = [];

  if (filters.user_id) {
    params.push(filters.user_id);
    conditions.push(`al.user_id = $${params.length}`);
  }

  if (filters.action) {
    params.push(filters.action);
    conditions.push(`al.action = $${params.length}`);
  }

  if (filters.entity_type) {
    params.push(filters.entity_type);
    conditions.push(`al.entity_type = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY al.created_at DESC LIMIT 100';

  return await executeQuery(query, params);
}

// Fonction pour ajouter un log d'audit
async function addAuditLog(logData) {
  const { user_id, action, entity_type, entity_id, details, ip_address } = logData;
  const query = `
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) 
    VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING *
  `;
  const result = await executeQuery(query, [user_id, action, entity_type, entity_id, details, ip_address]);
  return result[0];
}

// Fonction pour obtenir les créneaux horaires standards
async function getTimeSlots() {
  // Retourner les créneaux horaires standards utilisés dans l'application
  return [
    { id: 0, label: '8.00 - 9.30', start: '08:00', end: '09:30' },
    { id: 1, label: '9.30 - 11.00', start: '09:30', end: '11:00' },
    { id: 2, label: '11.00 - 12.30', start: '11:00', end: '12:30' },
    { id: 3, label: '12.30 - 14.00', start: '12:30', end: '14:00' },
    { id: 4, label: '14.00 - 15.30', start: '14:00', end: '15:30' },
    { id: 5, label: '15.30 - 17.00', start: '15:30', end: '17:00' }
  ];
}

// Fonction pour التحقق من التعارضات
async function checkConflicts(assignment) {
  try {
    const conflicts = [];

    // 1. تحقق من تعارض القاعة (Room Conflict)
    // لا يمكن لقاعة أن تستقبل درسين في نفس الوقت
    const roomQuery = `
      SELECT a.*, r.name as room_name, g.name as group_name
      FROM assignments a
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN groups g ON a.group_id = g.id
      WHERE a.id != $1 
        AND a.room_id = $2 
        AND a.day_of_week = $3 
        AND (
          (a.start_time <= $4 AND a.end_time > $4) OR
          (a.start_time < $5 AND a.end_time >= $5) OR
          (a.start_time >= $4 AND a.end_time <= $5)
        )
    `;
    const roomConflicts = await executeQuery(roomQuery, [
      assignment.id || 0,
      assignment.room_id,
      assignment.day_of_week,
      assignment.start_time,
      assignment.end_time
    ]);

    if (roomConflicts.length > 0) {
      conflicts.push(...roomConflicts.map(c => ({ ...c, type: 'room', message: `تعارض قاعة: ${c.room_name} مشغولة مع ${c.group_name}` })));
    }

    // 2. تحقق من تعارض الأستاذ (Professor Conflict)
    // لا يمكن لأستاذ أن يدرس درسين في نفس الوقت
    const profQuery = `
      SELECT a.*, p.name as professor_name, g.name as group_name
      FROM assignments a
      LEFT JOIN professors p ON a.professor_id = p.id
      LEFT JOIN groups g ON a.group_id = g.id
      WHERE a.id != $1 
        AND a.professor_id = $2 
        AND a.day_of_week = $3 
        AND (
          (a.start_time <= $4 AND a.end_time > $4) OR
          (a.start_time < $5 AND a.end_time >= $5) OR
          (a.start_time >= $4 AND a.end_time <= $5)
        )
    `;
    const profConflicts = await executeQuery(profQuery, [
      assignment.id || 0,
      assignment.professor_id,
      assignment.day_of_week,
      assignment.start_time,
      assignment.end_time
    ]);

    if (profConflicts.length > 0) {
      conflicts.push(...profConflicts.map(c => ({ ...c, type: 'professor', message: `تعارض أستاذ: ${c.professor_name} مشغول مع ${c.group_name}` })));
    }

    // 3. تحقق من منطق المحاضرة (Lecture Logic)
    // إذا كان الفوج محاضرة، فلا يمكن لأي فوج آخر في نفس التخصص والسنة الدراسة
    // إذا كان الفوج عادي، فلا يمكن أن تكون هناك محاضرة في نفس الوقت
    const groupDetails = await executeQuery('SELECT * FROM groups WHERE id = $1', [assignment.group_id]);

    if (groupDetails.length > 0) {
      const group = groupDetails[0];
      const isLecture = group.group_type === 'lecture_group' ||
        group.name.toLowerCase().includes('lecture') ||
        group.name.includes('محاضرة');

      const lectureQuery = `
        SELECT a.*, g.name as group_name, g.group_type
        FROM assignments a
        JOIN groups g ON a.group_id = g.id
        WHERE a.id != $1
          AND a.day_of_week = $2
          AND (
            (a.start_time <= $3 AND a.end_time > $3) OR
            (a.start_time < $4 AND a.end_time >= $4) OR
            (a.start_time >= $3 AND a.end_time <= $4)
          )
          AND g.specialization = $5
          ${group.year ? 'AND g.year = $6' : ''}
          AND (
            -- الحالة 1: الفوج الحالي محاضرة -> تعارض مع أي فوج آخر في نفس السياق
            ($7 = 1)
            OR
            -- الحالة 2: الفوج الحالي عادي -> تعارض مع أي محاضرة في نفس السياق
            ($7 = 0 AND (g.group_type = 'lecture_group' OR g.name LIKE '%lecture%' OR g.name LIKE '%محاضرة%'))
          )
      `;

      const params = [
        assignment.id || 0,
        assignment.day_of_week,
        assignment.start_time,
        assignment.end_time,
        group.specialization
      ];

      if (group.year) params.push(group.year);
      params.push(isLecture ? 1 : 0);

      const lectureConflicts = await executeQuery(lectureQuery, params);

      if (lectureConflicts.length > 0) {
        if (isLecture) {
          conflicts.push(...lectureConflicts.map(c => ({ ...c, type: 'group', message: `تعارض محاضرة: لا يمكن برمجة محاضرة في وجود أفواج أخرى (${c.group_name})` })));
        } else {
          conflicts.push(...lectureConflicts.map(c => ({ ...c, type: 'group', message: `تعارض فوج: توجد محاضرة مبرمجة في هذا الوقت (${c.group_name})` })));
        }
      }
    }

    return {
      count: conflicts.length,
      conflicts: conflicts
    };
  } catch (error) {
    console.error('Error checking conflicts:', error);
    return { count: 0, conflicts: [] };
  }
}


// Fonction لإضافة عمود is_archived إن لم يكن موجوداً
async function ensureArchivedColumn() {
  try {
    // محاولة إضافة العمود (سيتم تجاهل الخطأ إذا كان العمود موجوداً)
    await executeQuery(`
      ALTER TABLE extra_sessions 
      ADD COLUMN is_archived INTEGER DEFAULT 0
    `);
    console.log('✅ Added is_archived column to extra_sessions');
  } catch (error) {
    // تجاهل الخطأ إذا كان العمود موجوداً بالفعل
    if (!error.message.includes('duplicate column') && !error.message.includes('already exists')) {
      console.error('Error adding is_archived column:', error);
    }
  }
}

// Fonction لإضافة عمود exam_note إن لم يكن موجوداً
async function ensureExamNoteColumn() {
  try {
    // محاولة إضافة العمود (سيتم تجاهل الخطأ إذا كان العمود موجوداً)
    await executeQuery(`
      ALTER TABLE extra_sessions 
      ADD COLUMN exam_note TEXT DEFAULT ''
    `);
    console.log('✅ Added exam_note column to extra_sessions');
  } catch (error) {
    // تجاهل الخطأ إذا كان العمود موجوداً بالفعل
    if (!error.message.includes('duplicate column') && !error.message.includes('already exists')) {
      console.error('Error adding exam_note column:', error);
    }
  }
}

// Fonction لأرشفة الحصص المنتهية تلقائياً
async function archivePastSessions() {
  try {
    const today = new Date().toISOString().split('T')[0]; // تاريخ اليوم بصيغة YYYY-MM-DD

    // أولاً: احصل على عدد الحصص التي سيتم أرشفتها
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM extra_sessions 
      WHERE session_date < $1 AND (is_archived IS NULL OR is_archived = 0)
    `;
    const countResult = await executeQuery(countQuery, [today]);
    const sessionsToArchive = countResult[0]?.count || 0;

    if (sessionsToArchive > 0) {
      // ثانياً: قم بأرشفة الحصص
      const updateQuery = `
        UPDATE extra_sessions 
        SET is_archived = 1 
        WHERE session_date < $1 AND (is_archived IS NULL OR is_archived = 0)
      `;
      await executeQuery(updateQuery, [today]);
      console.log(`📦 Archived ${sessionsToArchive} past sessions (before ${today})`);
    } else {
      console.log('✅ No past sessions to archive');
    }

    return { archived: sessionsToArchive };
  } catch (error) {
    console.error('❌ Error archiving past sessions:', error);
    return { archived: 0, error: error.message };
  }
}

// Fonction للحصص الإضافية مع الأسماء المرتبطة
async function getExtraSessions() {
  // التأكد من وجود عمود is_archived
  await ensureArchivedColumn();

  // أرشفة الحصص المنتهية تلقائياً
  await archivePastSessions();

  const query = `
    SELECT es.*, 
           p.name as professor_name,
           c.name as course_name,
           r.name as room_name,
           g.name as group_name
    FROM extra_sessions es
    LEFT JOIN professors p ON es.professor_id = p.id
    LEFT JOIN courses c ON es.course_id = c.id
    LEFT JOIN rooms r ON es.room_id = r.id
    LEFT JOIN groups g ON es.group_id = g.id
    ORDER BY es.session_date, es.start_time
  `;
  return await executeQuery(query);
}

// Fonction لإنشاء حصة إضافية
async function createExtraSession(session) {
  const { room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year, exam_note } = session;
  await ensureArchivedColumn();
  await ensureExamNoteColumn();

  const query = `
    INSERT INTO extra_sessions (room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year, exam_note, is_archived) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0) 
    RETURNING *
  `;
  const result = await executeQuery(query, [room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year, exam_note || '']);
  return result[0];
}

// Fonction لتحديث حصة إضافية
async function updateExtraSession(session) {
  const { id, room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year, exam_note } = session;
  await ensureExamNoteColumn();
  const query = `
    UPDATE extra_sessions 
    SET room_id = $1, professor_id = $2, group_id = $3, course_id = $4, session_date = $5, start_time = $6, end_time = $7, session_type = $8, description = $9, reason = $10, semester = $11, academic_year = $12, exam_note = $13 
    WHERE id = $14 
    RETURNING *
  `;
  const result = await executeQuery(query, [room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year, exam_note || '', id]);
  return result[0];
}

// Fonction لحذف حصة إضافية
async function deleteExtraSession(id) {
  const query = 'DELETE FROM extra_sessions WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}

// Fonction للمصادقة
async function login(username, password) {
  console.log('🔐 Login attempt:', { username, passwordLength: password.length });
  const query = 'SELECT * FROM users WHERE username = $1 AND is_active = 1';
  const users = await executeQuery(query, [username]);

  console.log('👤 Users found:', users.length);

  if (users.length === 0) {
    throw new Error('اسم المستخدم غير صحيح');
  }

  const user = users[0];
  console.log('🔑 User found:', { id: user.id, username: user.username, hashPreview: user.password_hash?.substring(0, 20) });

  const isValid = await bcrypt.compare(password, user.password_hash);
  console.log('✅ Password valid:', isValid);

  if (!isValid) {
    throw new Error('كلمة المرور غير صحيحة [v2-updated]');
  }

  // تحديث آخر تسجيل دخول
  const currentTime = new Date().toISOString();
  await executeQuery('UPDATE users SET last_login = $1 WHERE id = $2', [currentTime, user.id]);

  // تسجيل النشاط
  try {
    await addAuditLog({
      user_id: user.id,
      action: 'login',
      entity_type: 'user',
      entity_id: user.id,
      details: `تسجيل دخول: ${user.username}`,
      ip_address: null
    });
  } catch (auditError) {
    console.error('⚠️ Failed to log audit:', auditError);
  }

  return user;
}

// Fonction لتسجيل الخروج
async function logout(userId) {
  // تسجيل النشاط
  try {
    await addAuditLog({
      user_id: userId,
      action: 'logout',
      entity_type: 'user',
      entity_id: userId,
      details: 'تسجيل خروج',
      ip_address: null
    });
  } catch (auditError) {
    console.error('⚠️ Failed to log audit:', auditError);
  }

  return true;
}

// Fonction للحصول على صلاحيات مستخدم
async function getUserPermissions(userId) {
  const query = 'SELECT permissions FROM users WHERE id = $1';
  const result = await executeQuery(query, [userId]);
  if (result.length > 0 && result[0].permissions) {
    return result[0].permissions;
  }
  return null;
}

// Fonction لحفظ صلاحيات مستخدم
async function saveUserPermissions(userId, permissionsJson) {
  const query = 'UPDATE users SET permissions = $1 WHERE id = $2';
  await executeQuery(query, [permissionsJson, userId]);
  return { success: true };
}

// Export des fonctions
module.exports = {
  initDatabaseConnection,
  executeQuery,
  closeConnection,
  reconnectDatabase,
  resetDbConfigCache,
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  getProfessors,
  addProfessor,
  updateProfessor,
  deleteProfessor,
  getRooms,
  addRoom,
  updateRoom,
  deleteRoom,
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  getGroups,
  addGroup,
  updateGroup,
  deleteGroup,
  getAssignments,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  getAcademicYears,
  getCurrentAcademicYear,
  getActiveAcademicYear,
  setCurrentAcademicYear,
  setActiveAcademicYear,
  addAcademicYear,
  deleteAcademicYear,
  getSemesters,
  getCurrentSemester,
  getActiveSemester,
  setCurrentSemester,
  setActiveSemester,
  addSemester,
  updateSemester,
  deleteSemester,
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  changePassword,
  resetPassword,
  toggleUserStatus,
  getAuditLogs,
  addAuditLog,
  getTimeSlots,
  checkConflicts,
  getExtraSessions,
  createExtraSession,
  updateExtraSession,
  deleteExtraSession,
  archivePastSessions,
  login,
  logout,
  getUserPermissions,
  saveUserPermissions,

  // Sandbox functions
  saveSandboxDraft,
  getSandboxDrafts,
  loadSandboxDraft,
  deleteSandboxDraft
};

// ==========================================
// Sandbox Functions
// ==========================================

async function saveSandboxDraft(name, data) {
  const query = 'INSERT INTO sandbox_snapshots (name, data) VALUES ($1, $2) RETURNING id';
  const result = await executeQuery(query, [name || `Draft ${new Date().toLocaleString()}`, JSON.stringify(data)]);
  return result[0];
}

async function getSandboxDrafts() {
  const query = 'SELECT id, name, created_at FROM sandbox_snapshots ORDER BY created_at DESC';
  return await executeQuery(query);
}

async function loadSandboxDraft(id) {
  const query = 'SELECT * FROM sandbox_snapshots WHERE id = $1';
  const result = await executeQuery(query, [id]);
  return result[0];
}

async function deleteSandboxDraft(id) {
  const query = 'DELETE FROM sandbox_snapshots WHERE id = $1';
  await executeQuery(query, [id]);
  return true;
}
