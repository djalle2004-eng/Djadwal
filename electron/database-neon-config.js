const { app } = require('electron');
const bcrypt = require('bcrypt');
const NeonDatabaseAdapter = require('./database-neon');

// Charger dotenv en mode développement, ignorer en production
try {
  require('dotenv').config();
} catch (error) {
  console.log('Module dotenv non disponible, utilisation des variables d\'environnement système');
}

// Database configuration
const USE_NEON = process.env.USE_NEON !== 'false';
const NEON_CONNECTION_STRING = process.env.NEON_CONNECTION_STRING;

console.log('🔧 Database settings:', {
  useNeon: USE_NEON,
  hasConnectionString: !!NEON_CONNECTION_STRING
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
  if (!db) return false;
  
  try {
    await db.sql('SELECT 1 as health_check');
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

// Initialiser la connexion à la base de données avec retry logic
async function initDatabaseConnection() {
  try {
    if (!db) {
      if (!USE_NEON || !NEON_CONNECTION_STRING) {
        throw new Error('Neon configuration is missing. Please set USE_NEON=true and NEON_CONNECTION_STRING in your environment variables.');
      }

      console.log("🔄 Initializing Neon PostgreSQL connection...");
      db = new NeonDatabaseAdapter(NEON_CONNECTION_STRING);
      
      // Test connection
      console.log('⏱️ Testing connection with 10s timeout...');
      const testPromise = db.sql('SELECT 1 as test');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      );
      
      await Promise.race([testPromise, timeoutPromise]);
      console.log('✅ Neon connection established');
      
      startConnectionMonitoring();
      reconnectAttempts = 0;
      isReconnecting = false;
      
      return db;
    }
    return db;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    closeConnection();
    throw new Error(`فشل الاتصال بقاعدة البيانات: ${error.message}`);
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
    
    const result = await db.sql(query, params);
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
        const result = await db.sql(query, params);
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
async function addProfessor(professorData) {
  const { name, email, phone, title, academic_title } = professorData;
  const query = `
    INSERT INTO professors (name, email, phone, title, academic_title) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING *
  `;
  const result = await executeQuery(query, [name, email, phone, title, academic_title]);
  return result[0];
}

// Fonction pour mettre à jour un professeur
async function updateProfessor(id, professorData) {
  const { name, email, phone, title, academic_title } = professorData;
  const query = `
    UPDATE professors 
    SET name = $1, email = $2, phone = $3, title = $4, academic_title = $5 
    WHERE id = $6 
    RETURNING *
  `;
  const result = await executeQuery(query, [name, email, phone, title, academic_title, id]);
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

// Fonction pour définir le semestre courant
async function setCurrentSemester(semesterId) {
  // D'abord, désactiver tous les semestres
  await executeQuery('UPDATE semesters SET is_current = 0');
  
  // Ensuite, activer le semestre sélectionné
  const query = 'UPDATE semesters SET is_current = 1 WHERE id = $1 RETURNING *';
  const result = await executeQuery(query, [semesterId]);
  return result[0];
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
  return true;
}

// Fonction pour basculer le statut d'un utilisateur
async function toggleUserStatus(userId, isActive) {
  const query = 'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *';
  const result = await executeQuery(query, [isActive, userId]);
  return result[0];
}

// Fonction pour obtenir les logs d'audit
async function getAuditLogs(filters = {}) {
  let query = 'SELECT * FROM audit_log';
  const params = [];
  let paramCount = 0;
  
  if (filters.user_id) {
    paramCount++;
    query += ` WHERE user_id = $${paramCount}`;
    params.push(filters.user_id);
  }
  
  if (filters.action) {
    paramCount++;
    query += paramCount === 1 ? ' WHERE' : ' AND';
    query += ` action = $${paramCount}`;
    params.push(filters.action);
  }
  
  if (filters.entity_type) {
    paramCount++;
    query += paramCount === 1 ? ' WHERE' : ' AND';
    query += ` entity_type = $${paramCount}`;
    params.push(filters.entity_type);
  }
  
  query += ' ORDER BY created_at DESC LIMIT 100';
  
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
    const query = `
      SELECT COUNT(*) as conflict_count
      FROM assignments 
      WHERE id != $1 
        AND room_id = $2 
        AND day_of_week = $3 
        AND (
          (start_time <= $4 AND end_time > $4) OR
          (start_time < $5 AND end_time >= $5) OR
          (start_time >= $4 AND end_time <= $5)
        )
    `;
    const result = await executeQuery(query, [
      assignment.id || 0,
      assignment.room_id,
      assignment.day_of_week,
      assignment.start_time,
      assignment.end_time
    ]);
    
    return {
      count: parseInt(result[0].conflict_count),
      conflicts: result
    };
  } catch (error) {
    console.error('Error checking conflicts:', error);
    return { count: 0, conflicts: [] };
  }
}


// Fonction للحصص الإضافية مع الأسماء المرتبطة
async function getExtraSessions() {
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
  const { room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year } = session;
  const query = `
    INSERT INTO extra_sessions (room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
    RETURNING *
  `;
  const result = await executeQuery(query, [room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year]);
  return result[0];
}

// Fonction لتحديث حصة إضافية
async function updateExtraSession(session) {
  const { id, room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year } = session;
  const query = `
    UPDATE extra_sessions 
    SET room_id = $1, professor_id = $2, group_id = $3, course_id = $4, session_date = $5, start_time = $6, end_time = $7, session_type = $8, description = $9, reason = $10, semester = $11, academic_year = $12 
    WHERE id = $13 
    RETURNING *
  `;
  const result = await executeQuery(query, [room_id, professor_id, group_id, course_id, session_date, start_time, end_time, session_type, description, reason, semester, academic_year, id]);
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
  const query = 'SELECT * FROM users WHERE username = $1 AND is_active = 1';
  const users = await executeQuery(query, [username]);
  
  if (users.length === 0) {
    throw new Error('اسم المستخدم غير صحيح');
  }
  
  const user = users[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    throw new Error('كلمة المرور غير صحيحة');
  }
  
  // تحديث آخر تسجيل دخول
  await executeQuery('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
  
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

// Export des fonctions
module.exports = {
  initDatabaseConnection,
  executeQuery,
  closeConnection,
  reconnectDatabase,
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
  getSemesters,
  getCurrentSemester,
  setCurrentSemester,
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
  login,
  logout
};
