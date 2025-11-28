const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration Supabase
const supabaseUrl = 'https://kdqpnjeehzaffypahdbi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcXBuamVlaHphZmZ5cGFoZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzgzMTIsImV4cCI6MjA3MjQxNDMxMn0.EEuXzyM14E03TL70vgbAitYYtfitFPcHEN6UyodpwAo';

// Création du client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Chemin vers la base de données SQLite
const dbPath = path.join(__dirname, '..', 'database.db');

// Stockage des mappages d'ID SQLite à UUID Supabase
const idMappings = {
  departments: new Map(),
  professors: new Map(),
  academic_years: new Map(),
  rooms: new Map(),
  groups: new Map(),
  courses: new Map(),
  assignments: new Map()
};

/**
 * Ouvre la connexion à la base de données SQLite
 */
async function openSqliteDb() {
  try {
    console.log(`Ouverture de la base de données SQLite: ${dbPath}`);
    
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Base de données SQLite non trouvée: ${dbPath}`);
    }
    
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
    
    for (const dept of departments) {
      try {
        // Création du département dans Supabase
        const { data, error } = await supabase
          .from('departments')
          .insert({
            name: dept.name,
            code: dept.code || null
          })
          .select()
          .single();
        
        if (error) {
          console.error(`Erreur lors de la création du département ${dept.name}:`, error);
          continue;
        }
        
        // Stockage du mappage d'ID
        idMappings.departments.set(dept.id, data.id);
        console.log(`✓ Département migré: ${dept.name} (${dept.id} → ${data.id})`);
        
      } catch (err) {
        console.error(`Erreur lors de la migration du département ${dept.name}:`, err);
      }
    }
    
    console.log(`Migration des départements terminée: ${idMappings.departments.size}/${departments.length}`);
    
  } catch (err) {
    console.error('Erreur lors de la migration des départements:', err);
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
    
    for (const prof of professors) {
      try {
        // Création du professeur dans Supabase
        const { data, error } = await supabase
          .from('professors')
          .insert({
            academic_title: prof.academic_title || prof.title || 'Dr.',
            specialization: prof.specialization || 'Général',
            weekly_hours: prof.weekly_hours || 40,
            email: prof.email || `prof${prof.id}@example.com`
          })
          .select()
          .single();
        
        if (error) {
          console.error(`Erreur lors de la création du professeur ${prof.name}:`, error);
          continue;
        }
        
        // Stockage du mappage d'ID
        idMappings.professors.set(prof.id, data.id);
        console.log(`✓ Professeur migré: ${prof.name} (${prof.id} → ${data.id})`);
        
      } catch (err) {
        console.error(`Erreur lors de la migration du professeur ${prof.name}:`, err);
      }
    }
    
    console.log(`Migration des professeurs terminée: ${idMappings.professors.size}/${professors.length}`);
    
  } catch (err) {
    console.error('Erreur lors de la migration des professeurs:', err);
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
    
    for (const course of courses) {
      try {
        // Création du cours dans Supabase
        const { data, error } = await supabase
          .from('courses')
          .insert({
            name: course.name,
            code: course.code || `COURSE${course.id}`,
            description: course.description || null,
            credits: course.credits || 3
          })
          .select()
          .single();
        
        if (error) {
          console.error(`Erreur lors de la création du cours ${course.name}:`, error);
          continue;
        }
        
        // Stockage du mappage d'ID
        idMappings.courses.set(course.id, data.id);
        console.log(`✓ Cours migré: ${course.name} (${course.id} → ${data.id})`);
        
      } catch (err) {
        console.error(`Erreur lors de la migration du cours ${course.name}:`, err);
      }
    }
    
    console.log(`Migration des cours terminée: ${idMappings.courses.size}/${courses.length}`);
    
  } catch (err) {
    console.error('Erreur lors de la migration des cours:', err);
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
    
    for (const room of rooms) {
      try {
        // Création de la salle dans Supabase
        const { data, error } = await supabase
          .from('rooms')
          .insert({
            name: room.name,
            capacity: room.capacity || 30,
            building: room.building || 'Bâtiment Principal',
            floor: room.floor || 1
          })
          .select()
          .single();
        
        if (error) {
          console.error(`Erreur lors de la création de la salle ${room.name}:`, error);
          continue;
        }
        
        // Stockage du mappage d'ID
        idMappings.rooms.set(room.id, data.id);
        console.log(`✓ Salle migrée: ${room.name} (${room.id} → ${data.id})`);
        
      } catch (err) {
        console.error(`Erreur lors de la migration de la salle ${room.name}:`, err);
      }
    }
    
    console.log(`Migration des salles terminée: ${idMappings.rooms.size}/${rooms.length}`);
    
  } catch (err) {
    console.error('Erreur lors de la migration des salles:', err);
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
    
    for (const group of groups) {
      try {
        // Création du groupe dans Supabase
        const { data, error } = await supabase
          .from('groups')
          .insert({
            name: group.name,
            year: parseInt(group.year) || 1,
            specialization: group.specialization || 'Général'
          })
          .select()
          .single();
        
        if (error) {
          console.error(`Erreur lors de la création du groupe ${group.name}:`, error);
          continue;
        }
        
        // Stockage du mappage d'ID
        idMappings.groups.set(group.id, data.id);
        console.log(`✓ Groupe migré: ${group.name} (${group.id} → ${data.id})`);
        
      } catch (err) {
        console.error(`Erreur lors de la migration du groupe ${group.name}:`, err);
      }
    }
    
    console.log(`Migration des groupes terminée: ${idMappings.groups.size}/${groups.length}`);
    
  } catch (err) {
    console.error('Erreur lors de la migration des groupes:', err);
  }
}

/**
 * Fonction principale de migration
 */
async function main() {
  console.log('🚀 Début de la migration vers Supabase...');
  console.log(`URL Supabase: ${supabaseUrl}`);
  
  try {
    // Ouverture de la base SQLite
    const db = await openSqliteDb();
    console.log('✓ Connexion à SQLite établie');
    
    // Migration des tables dans l'ordre
    await migrateDepartments(db);
    await migrateProfessors(db);
    await migrateCourses(db);
    await migrateRooms(db);
    await migrateGroups(db);
    
    // Fermeture de la connexion SQLite
    await db.close();
    console.log('✓ Connexion SQLite fermée');
    
    console.log('\n🎉 Migration terminée avec succès!');
    console.log('\n📊 Résumé de la migration:');
    console.log(`- Départements: ${idMappings.departments.size}`);
    console.log(`- Professeurs: ${idMappings.professors.size}`);
    console.log(`- Cours: ${idMappings.courses.size}`);
    console.log(`- Salles: ${idMappings.rooms.size}`);
    console.log(`- Groupes: ${idMappings.groups.size}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

// Exécution de la migration
if (require.main === module) {
  main();
}
