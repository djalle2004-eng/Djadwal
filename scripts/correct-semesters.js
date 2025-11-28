// Script pour corriger les problèmes avec les semestres
require('dotenv').config();
const { Database } = require('@sqlitecloud/drivers');

async function main() {
  console.log('Correction des semestres...');
  
  try {
    // Connexion à SQLiteCloud
    const connectionString = `sqlitecloud://${process.env.SQLITECLOUD_USERNAME}:${process.env.SQLITECLOUD_PASSWORD}@${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/${process.env.SQLITECLOUD_DATABASE || 'Djadwal'}`;
    console.log(`Connexion à: ${connectionString}`);
    
    const db = new Database(connectionString);
    
    // 1. Vérifier les semestres existants
    console.log('\nSemestres existants:');
    const existingSemesters = await db.sql('SELECT * FROM semesters;');
    console.log(existingSemesters);
    
    if (existingSemesters.length > 0) {
      // 2. Recréer les semestres correctement
      console.log('\nRecréation des semestres avec academic_year_id comme nombre entier...');
      
      // Créer une table temporaire pour stocker les semestres existants
      await db.sql('CREATE TABLE temp_semesters AS SELECT * FROM semesters;');
      
      // Supprimer tous les semestres existants
      await db.sql('DELETE FROM semesters;');
      
      // Recréer les semestres avec les bonnes valeurs
      for (const semester of existingSemesters) {
        // Convertir explicitement academic_year_id en nombre entier
        const academicYearId = parseInt(semester.academic_year_id, 10);
        
        if (isNaN(academicYearId)) {
          console.log(`AVERTISSEMENT: ID d'année académique invalide pour le semestre ${semester.id}: ${semester.academic_year_id}`);
          continue;
        }
        
        // Insérer le semestre avec academic_year_id comme entier
        const query = `INSERT INTO semesters (
          id, academic_year_id, semester_name, start_date, end_date, is_current, created_at
        ) VALUES (
          ${semester.id}, 
          ${academicYearId}, 
          '${semester.semester_name.replace(/'/g, "''")}', 
          '${semester.start_date || ""}', 
          '${semester.end_date || ""}', 
          ${semester.is_current}, 
          '${semester.created_at}'
        )`;
        
        console.log(`Insertion du semestre ${semester.id} avec academic_year_id=${academicYearId}`);
        await db.sql(query);
      }
      
      // Supprimer la table temporaire
      await db.sql('DROP TABLE temp_semesters;');
    } else {
      console.log('Aucun semestre trouvé. Création de nouveaux semestres...');
      
      // Récupérer les années académiques
      const years = await db.sql('SELECT * FROM academic_years;');
      
      // Créer des semestres pour chaque année
      for (const year of years) {
        console.log(`Création de semestres pour l'année ${year.year_name} (ID: ${year.id})`);
        
        // Créer le premier semestre (courant par défaut)
        await db.sql(`
          INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) 
          VALUES (${year.id}, 'السداسي الأول', '2024-09-01', '2024-12-31', 1)
        `);
        console.log("Semestre 1 créé");
        
        // Créer le deuxième semestre
        await db.sql(`
          INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) 
          VALUES (${year.id}, 'السداسي الثاني', '2025-01-01', '2025-06-30', 0)
        `);
        console.log("Semestre 2 créé");
      }
    }
    
    // 3. Vérifier les semestres après correction
    console.log('\nSemestres après correction:');
    const finalSemesters = await db.sql('SELECT * FROM semesters;');
    console.log(finalSemesters);
    
    // 4. Tester la requête getSemesters
    console.log('\nTest de la requête getSemesters:');
    const years = await db.sql('SELECT * FROM academic_years;');
    for (const year of years) {
      console.log(`Test pour année ID=${year.id} (${year.year_name}):`);
      const yearSemesters = await db.sql('SELECT * FROM semesters WHERE academic_year_id = ?;', [year.id]);
      console.log(`  Résultat: ${yearSemesters.length} semestres trouvés`);
      
      if (yearSemesters.length === 0) {
        // Test avec académique ID comme chaîne
        const semestersAsString = await db.sql(`SELECT * FROM semesters WHERE academic_year_id = '${year.id}';`);
        console.log(`  Test avec ID comme chaîne: ${semestersAsString.length} semestres trouvés`);
        
        // Test avec différentes valeurs
        console.log(`  Tous les semestres et leurs academic_year_id:`);
        const allSemesters = await db.sql('SELECT id, academic_year_id, semester_name FROM semesters;');
        allSemesters.forEach(sem => {
          console.log(`    - ID: ${sem.id}, academic_year_id: ${sem.academic_year_id} (type: ${typeof sem.academic_year_id}), Nom: ${sem.semester_name}`);
        });
      } else {
        yearSemesters.forEach(sem => {
          console.log(`  - ID: ${sem.id}, academic_year_id: ${sem.academic_year_id} (type: ${typeof sem.academic_year_id}), Nom: ${sem.semester_name}`);
        });
      }
    }
    
    console.log('\nCorrection terminée avec succès');
    await db.close();
    
  } catch (error) {
    console.error('Erreur lors du traitement:', error);
  }
}

main(); 