// Script pour diagnostiquer les problèmes de base de données
require('dotenv').config();
const { Database } = require('@sqlitecloud/drivers');
const fs = require('fs');

async function main() {
  console.log('Diagnostic de la base de données SQLiteCloud...');
  const rapport = [];
  
  function log(message) {
    console.log(message);
    rapport.push(message);
  }
  
  try {
    // Connexion à SQLiteCloud
    const connectionString = `sqlitecloud://${process.env.SQLITECLOUD_USERNAME}:${process.env.SQLITECLOUD_PASSWORD}@${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/${process.env.SQLITECLOUD_DATABASE || 'Djadwal'}`;
    log(`Connexion à: ${connectionString}`);
    
    const db = new Database(connectionString);
    
    // 1. Vérifier les variables d'environnement
    log('\n--- VARIABLES D\'ENVIRONNEMENT ---');
    log(`SQLITECLOUD_HOST: ${process.env.SQLITECLOUD_HOST}`);
    log(`SQLITECLOUD_PORT: ${process.env.SQLITECLOUD_PORT}`);
    log(`SQLITECLOUD_USERNAME: ${process.env.SQLITECLOUD_USERNAME}`);
    log(`SQLITECLOUD_DATABASE: ${process.env.SQLITECLOUD_DATABASE}`);
    
    // 2. Lister toutes les tables
    log('\n--- TABLES DANS LA BASE DE DONNÉES ---');
    const tables = await db.sql("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    log(`Nombre de tables: ${tables.length}`);
    tables.forEach(table => {
      log(`- ${table.name}`);
    });
    
    // 3. Vérifier la structure de la table 'semesters'
    log('\n--- STRUCTURE DE LA TABLE SEMESTERS ---');
    const semestersStructure = await db.sql("PRAGMA table_info(semesters);");
    semestersStructure.forEach(col => {
      log(`- ${col.name} (${col.type})`);
    });
    
    // 4. Compter le nombre d'enregistrements dans les principales tables
    log('\n--- COMPTAGE DES ENREGISTREMENTS ---');
    const tables_to_check = ['academic_years', 'semesters', 'departments', 'groups', 'courses', 'professors', 'rooms', 'assignments'];
    for (const table of tables_to_check) {
      try {
        const count = await db.sql(`SELECT COUNT(*) as count FROM ${table};`);
        log(`${table}: ${count[0].count} enregistrements`);
      } catch (error) {
        log(`Erreur lors du comptage de ${table}: ${error.message}`);
      }
    }
    
    // 5. Vérifier spécifiquement le contenu de 'academic_years'
    log('\n--- CONTENU DE LA TABLE ACADEMIC_YEARS ---');
    const years = await db.sql('SELECT * FROM academic_years;');
    years.forEach(year => {
      log(`- ID: ${year.id}, Nom: ${year.year_name}, Est actif: ${year.is_current}`);
    });
    
    // 6. Vérifier spécifiquement le contenu de 'semesters'
    log('\n--- CONTENU DE LA TABLE SEMESTERS ---');
    const semesters = await db.sql('SELECT * FROM semesters;');
    semesters.forEach(semester => {
      log(`- ID: ${semester.id}, Année académique: ${semester.academic_year_id}, Nom: ${semester.semester_name}, Est actif: ${semester.is_current}`);
    });
    
    // 7. Tester la requête getSemesters avec les IDs des années académiques
    log('\n--- TEST DE LA REQUÊTE getSemesters ---');
    for (const year of years) {
      log(`Test pour année ID=${year.id} (${year.year_name}):`);
      const yearSemesters = await db.sql('SELECT * FROM semesters WHERE academic_year_id = ?;', [year.id]);
      log(`  Résultat: ${yearSemesters.length} semestres trouvés`);
      yearSemesters.forEach(sem => {
        log(`  - ID: ${sem.id}, Nom: ${sem.semester_name}, Est actif: ${sem.is_current}`);
      });
    }
    
    // 8. Sauvegarder le rapport dans un fichier
    fs.writeFileSync('db-diagnostic.txt', rapport.join('\n'));
    log('\nDiagnostic terminé avec succès. Rapport sauvegardé dans db-diagnostic.txt');
    
    await db.close();
  } catch (error) {
    console.error('Erreur lors du diagnostic:', error);
  }
}

main(); 