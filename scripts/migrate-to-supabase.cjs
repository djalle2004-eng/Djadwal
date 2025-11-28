import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Récupération des variables d'environnement
dotenv.config();

// Configuration des chemins pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Vérification des variables d'environnement
if (!supabaseUrl || !supabaseKey) {
  console.error('Erreur: Variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises');
  process.exit(1);
}

// Chemin vers la base de données SQLite
const dbPath = path.join(__dirname, '..', 'suivi.db');

// Création du client Supabase avec la clé de service si disponible, sinon avec la clé anonyme
const supabase = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Stockage des mappages d'ID SQLite à UUID Supabase
const idMappings = {
  departments: {},
  professors: {},
  academic_years: {},
  rooms: {},
  groups: {},
  courses: {},
  assignments: {}
};

/**
 * Ouvre la connexion à la base de données SQLite
 */
async function openSqliteDb() {
  try {
    console.log(`Ouverture de la base de données SQLite: ${dbPath}`);
    return await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  } catch (err) {
    console.error('Erreur lors de l\'ouverture de la base de données SQLite:', err);
    throw err;
  }
}

/**
 * Vérifie si la table existe dans la base de données SQLite
 */
async function tableExists(db, tableName) {
  try {
    const result = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return !!result;
  } catch (err) {
    console.error(`Erreur lors de la vérification de l'existence de la table ${tableName}:`, err);
    return false;
  }
}

/**
 * Migre les départements
 */
async function migrateDepartments(db) {
  console.log('\n=== Migration des départements ===');
  
  const exists = await tableExists(db, 'departments');
  if (!exists) {
    console.log('La table departments n\'existe pas dans SQLite, migration ignorée.');
    return;
  }
  
  try {
    // Récupération des départements depuis SQLite
    const departments = await db.all('SELECT * FROM departments');
    console.log(`${departments.length} départements trouvés dans SQLite`);
    
    if (departments.length === 0) {
      console.log('Aucun département à migrer.');
      return;
    }
    
    // Préparation des données pour Supabase
    const supabaseDepartments = departments.map(dept => {
      const uuid = uuidv4();
      idMappings.departments[dept.id] = uuid;
      
      return {
        id: uuid,
        name: dept.name,
        code: dept.code || null,
        created_at: new Date().toISOString()
      };
    });
    
    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('departments')
      .insert(supabaseDepartments)
      .select();
    
    if (error) {
      console.error('Erreur lors de la migration des départements:', error);
      throw error;
    }
    
    console.log(`${data.length} départements migrés vers Supabase avec succès`);
  } catch (err) {
    console.error('Exception lors de la migration des départements:', err);
    throw err;
  }
}

/**
 * Migre les années académiques
 */
async function migrateAcademicYears(db) {
  console.log('\n=== Migration des années académiques ===');
  
  const exists = await tableExists(db, 'academic_years');
  if (!exists) {
    console.log('La table academic_years n\'existe pas dans SQLite, migration ignorée.');
    return;
  }
  
  try {
    // Récupération des années académiques depuis SQLite
    const academicYears = await db.all('SELECT * FROM academic_years');
    console.log(`${academicYears.length} années académiques trouvées dans SQLite`);
    
    if (academicYears.length === 0) {
      console.log('Aucune année académique à migrer.');
      return;
    }
    
    // Préparation des données pour Supabase
    const supabaseAcademicYears = academicYears.map(year => {
      const uuid = uuidv4();
      idMappings.academic_years[year.id] = uuid;
      
      return {
        id: uuid,
        year_name: year.year_name,
        is_current: year.is_current === 1,
        created_at: new Date().toISOString()
      };
    });
    
    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('academic_years')
      .insert(supabaseAcademicYears)
      .select();
    
    if (error) {
      console.error('Erreur lors de la migration des années académiques:', error);
      throw error;
    }
    
    console.log(`${data.length} années académiques migrées vers Supabase avec succès`);
  } catch (err) {
    console.error('Exception lors de la migration des années académiques:', err);
    throw err;
  }
}

/**
 * Migre les salles
 */
async function migrateRooms(db) {
  console.log('\n=== Migration des salles ===');
  
  const exists = await tableExists(db, 'rooms');
  if (!exists) {
    console.log('La table rooms n\'existe pas dans SQLite, migration ignorée.');
    return;
  }
  
  try {
    // Récupération des salles depuis SQLite
    const rooms = await db.all('SELECT * FROM rooms');
    console.log(`${rooms.length} salles trouvées dans SQLite`);
    
    if (rooms.length === 0) {
      console.log('Aucune salle à migrer.');
      return;
    }
    
    // Préparation des données pour Supabase
    const supabaseRooms = rooms.map(room => {
      const uuid = uuidv4();
      idMappings.rooms[room.id] = uuid;
      
      return {
        id: uuid,
        name: room.name,
        capacity: room.capacity || null,
        created_at: new Date().toISOString()
      };
    });
    
    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('rooms')
      .insert(supabaseRooms)
      .select();
    
    if (error) {
      console.error('Erreur lors de la migration des salles:', error);
      throw error;
    }
    
    console.log(`${data.length} salles migrées vers Supabase avec succès`);
  } catch (err) {
    console.error('Exception lors de la migration des salles:', err);
    throw err;
  }
}

/**
 * Migre les professeurs
 */
async function migrateProfessors(db) {
  console.log('\n=== Migration des professeurs ===');
  
  const exists = await tableExists(db, 'professors');
  if (!exists) {
    console.log('La table professors n\'existe pas dans SQLite, migration ignorée.');
    return;
  }
  
  try {
    // Récupération des professeurs depuis SQLite
    const professors = await db.all('SELECT * FROM professors');
    console.log(`${professors.length} professeurs trouvés dans SQLite`);
    
    if (professors.length === 0) {
      console.log('Aucun professeur à migrer.');
      return;
    }
    
    // Préparation des données pour Supabase
    const supabaseProfessors = professors.map(prof => {
      const uuid = uuidv4();
      idMappings.professors[prof.id] = uuid;
      
      // Construction des métadonnées
      const metadata = {};
      if (prof.first_name) metadata.first_name = prof.first_name;
      if (prof.last_name) metadata.last_name = prof.last_name;
      if (prof.academic_title) metadata.academic_title = prof.academic_title;
      if (prof.specialization) metadata.specialization = prof.specialization;
      if (prof.weekly_hours !== undefined) metadata.weekly_hours = prof.weekly_hours;
      if (prof.phone) metadata.phone = prof.phone;
      
      return {
        id: uuid,
        name: `${prof.first_name || ''} ${prof.last_name || ''}`.trim(),
        email: prof.email || null,
        metadata,
        created_at: new Date().toISOString()
      };
    });
    
    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('professors')
      .insert(supabaseProfessors)
      .select();
    
    if (error) {
      console.error('Erreur lors de la migration des professeurs:', error);
      throw error;
    }
    
    console.log(`${data.length} professeurs migrés vers Supabase avec succès`);
  } catch (err) {
    console.error('Exception lors de la migration des professeurs:', err);
    throw err;
  }
}

/**
 * Migre les groupes
 */
async function migrateGroups(db) {
  console.log('\n=== Migration des groupes ===');
  
  const exists = await tableExists(db, 'groups');
  if (!exists) {
    console.log('La table groups n\'existe pas dans SQLite, migration ignorée.');
    return;
  }
  
  try {
    // Récupération des groupes depuis SQLite
    const groups = await db.all('SELECT * FROM groups');
    console.log(`${groups.length} groupes trouvés dans SQLite`);
    
    if (groups.length === 0) {
      console.log('Aucun groupe à migrer.');
      return;
    }
    
    // On fait d'abord un premier passage pour créer tous les UUIDs
    groups.forEach(group => {
      idMappings.groups[group.id] = uuidv4();
    });
    
    // Préparation des données pour Supabase en utilisant les UUIDs déjà générés
    const supabaseGroups = groups.map(group => {
      return {
        id: idMappings.groups[group.id],
        name: group.name,
        specialization: group.specialization || null,
        parent_group_id: group.parent_group_id ? idMappings.groups[group.parent_group_id] : null,
        department_id: group.department_id ? idMappings.departments[group.department_id] : null,
        group_type: group.group_type || null,
        year: group.year || null,
        created_at: new Date().toISOString()
      };
    });
    
    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('groups')
      .insert(supabaseGroups)
      .select();
    
    if (error) {
      console.error('Erreur lors de la migration des groupes:', error);
      throw error;
    }
    
    console.log(`${data.length} groupes migrés vers Supabase avec succès`);
  } catch (err) {
    console.error('Exception lors de la migration des groupes:', err);
    throw err;
  }
}

/**
 * Migre les cours
 */
async function migrateCourses(db) {
  console.log('\n=== Migration des cours ===');
  
  const exists = await tableExists(db, 'courses');
  if (!exists) {
    console.log('La table courses n\'existe pas dans SQLite, migration ignorée.');
    return;
  }
  
  try {
    // Récupération des cours depuis SQLite
    const courses = await db.all('SELECT * FROM courses');
    console.log(`${courses.length} cours trouvés dans SQLite`);
    
    if (courses.length === 0) {
      console.log('Aucun cours à migrer.');
      return;
    }
    
    // Préparation des données pour Supabase
    const supabaseCourses = courses.map(course => {
      const uuid = uuidv4();
      idMappings.courses[course.id] = uuid;
      
      // Construction des métadonnées
      const metadata = {};
      if (course.description) metadata.description = course.description;
      if (course.credits !== undefined) metadata.credits = course.credits;
      if (course.hours !== undefined) metadata.hours = course.hours;
      
      return {
        id: uuid,
        name: course.name,
        code: course.code || null,
        metadata,
        created_at: new Date().toISOString()
      };
    });
    
    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('courses')
      .insert(supabaseCourses)
      .select();
    
    if (error) {
      console.error('Erreur lors de la migration des cours:', error);
      throw error;
    }
    
    console.log(`${data.length} cours migrés vers Supabase avec succès`);
  } catch (err) {
    console.error('Exception lors de la migration des cours:', err);
    throw err;
  }
}

/**
 * Migre les affectations
 */
async function migrateAssignments(db) {
  console.log('\n=== Migration des affectations ===');
  
  const exists = await tableExists(db, 'assignments');
  if (!exists) {
    console.log('La table assignments n\'existe pas dans SQLite, migration ignorée.');
    return;
  }
  
  try {
    // Récupération des affectations depuis SQLite
    const assignments = await db.all('SELECT * FROM assignments');
    console.log(`${assignments.length} affectations trouvées dans SQLite`);
    
    if (assignments.length === 0) {
      console.log('Aucune affectation à migrer.');
      return;
    }
    
    // Préparation des données pour Supabase
    const supabaseAssignments = assignments
      .filter(assignment => {
        // Filtrer les affectations dont les clés étrangères n'ont pas été migrées
        const groupExists = !assignment.group_id || idMappings.groups[assignment.group_id];
        const courseExists = !assignment.course_id || idMappings.courses[assignment.course_id];
        const professorExists = !assignment.professor_id || idMappings.professors[assignment.professor_id];
        const roomExists = !assignment.room_id || idMappings.rooms[assignment.room_id];
        
        if (!groupExists || !courseExists || !professorExists) {
          console.warn(`Affectation ignorée - clés étrangères manquantes: ${JSON.stringify(assignment)}`);
          return false;
        }
        
        return true;
      })
      .map(assignment => {
        const uuid = uuidv4();
        idMappings.assignments[assignment.id] = uuid;
        
        return {
          id: uuid,
          group_id: assignment.group_id ? idMappings.groups[assignment.group_id] : null,
          course_id: assignment.course_id ? idMappings.courses[assignment.course_id] : null,
          professor_id: assignment.professor_id ? idMappings.professors[assignment.professor_id] : null,
          room_id: assignment.room_id ? idMappings.rooms[assignment.room_id] : null,
          day_of_week: assignment.day_of_week,
          start_time: assignment.start_time,
          end_time: assignment.end_time,
          session_type: assignment.session_type || null,
          created_at: new Date().toISOString()
        };
      });
    
    if (supabaseAssignments.length === 0) {
      console.log('Aucune affectation valide à migrer.');
      return;
    }
    
    // Insertion dans Supabase
    const { data, error } = await supabase
      .from('assignments')
      .insert(supabaseAssignments)
      .select();
    
    if (error) {
      console.error('Erreur lors de la migration des affectations:', error);
      throw error;
    }
    
    console.log(`${data.length} affectations migrées vers Supabase avec succès`);
  } catch (err) {
    console.error('Exception lors de la migration des affectations:', err);
    throw err;
  }
}

/**
 * Sauvegarde les mappages d'ID
 */
function saveIdMappings() {
  try {
    const mappingsPath = path.join(__dirname, 'id-mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify(idMappings, null, 2));
    console.log(`Mappages d'ID sauvegardés dans ${mappingsPath}`);
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des mappages d\'ID:', err);
  }
}

/**
 * Fonction principale
 */
async function migrate() {
  console.log('=== Début de la migration SQLite vers Supabase ===\n');
  
  let db;
  try {
    // Ouverture de la base de données SQLite
    db = await openSqliteDb();
    
    // Migration des données dans l'ordre des dépendances
    await migrateDepartments(db);
    await migrateAcademicYears(db);
    await migrateRooms(db);
    await migrateProfessors(db);
    await migrateGroups(db);
    await migrateCourses(db);
    await migrateAssignments(db);
    
    // Sauvegarde des mappages d'ID
    saveIdMappings();
    
    console.log('\n=== Migration terminée avec succès ===');
  } catch (err) {
    console.error('\n=== Erreur pendant la migration ===');
    console.error(err);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
      console.log('Connexion SQLite fermée');
    }
  }
}

// Exécution de la fonction principale
migrate(); 