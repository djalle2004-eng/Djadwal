// Script pour vérifier et créer les semestres manquants dans SQLiteCloud
require('dotenv').config();
const { Database } = require('@sqlitecloud/drivers');

async function main() {
  console.log('Vérification et création des semestres...');
  
  try {
    // Connexion à SQLiteCloud
    const connectionString = `sqlitecloud://${process.env.SQLITECLOUD_USERNAME}:${process.env.SQLITECLOUD_PASSWORD}@${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/${process.env.SQLITECLOUD_DATABASE || 'Djadwal'}`;
    console.log(`Connexion à: ${connectionString}`);
    
    const db = new Database(connectionString);
    
    // Récupérer toutes les années académiques
    console.log('Récupération des années académiques...');
    const years = await db.sql('SELECT * FROM academic_years;');
    console.log(`${years.length} années académiques trouvées:`);
    console.log(years);
    
    // Vérifier les semestres existants
    console.log('\nSemestres existants:');
    const existingSemesters = await db.sql('SELECT * FROM semesters;');
    console.log(existingSemesters);
    
    // Créer des semestres pour chaque année si nécessaire
    for (const year of years) {
      console.log(`\nVérification des semestres pour l'année ${year.year_name} (ID: ${year.id})`);
      
      // Compter les semestres pour cette année
      const yearSemesters = await db.sql('SELECT COUNT(*) as count FROM semesters WHERE academic_year_id = ?;', [year.id]);
      const semesterCount = yearSemesters[0].count;
      
      console.log(`Cette année a ${semesterCount} semestres`);
      
      if (semesterCount === 0) {
        console.log(`Création de semestres pour l'année ${year.year_name}`);
        
        // Désactiver tout semestre existant pour cette année (par précaution)
        await db.sql('UPDATE semesters SET is_current = 0 WHERE academic_year_id = ?', [year.id]);
        
        // Créer le premier semestre
        const sem1Query = `INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) 
          VALUES ('${year.id}', 'Semestre 1', '2023-09-01', '2024-01-31', 1)`;
        await db.sql(sem1Query);
        console.log("Semestre 1 créé");
        
        // Créer le deuxième semestre
        const sem2Query = `INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) 
          VALUES ('${year.id}', 'Semestre 2', '2024-02-01', '2024-06-30', 0)`;
        await db.sql(sem2Query);
        console.log("Semestre 2 créé");
        
        console.log(`Deux semestres créés pour l'année ${year.year_name}`);
      } else {
        console.log(`Des semestres existent déjà pour l'année ${year.year_name}, vérification des semestres actifs...`);
        
        // Vérifier s'il y a un semestre actif
        const activeSemesters = await db.sql(
          'SELECT COUNT(*) as count FROM semesters WHERE academic_year_id = ? AND is_current = 1', 
          [year.id]
        );
        
        if (activeSemesters[0].count === 0) {
          console.log(`Aucun semestre actif pour l'année ${year.year_name}, activation du premier semestre...`);
          
          // Activer le premier semestre de l'année
          const firstSemester = await db.sql(
            'SELECT id FROM semesters WHERE academic_year_id = ? ORDER BY id LIMIT 1', 
            [year.id]
          );
          
          if (firstSemester.length > 0) {
            await db.sql(
              'UPDATE semesters SET is_current = 1 WHERE id = ?', 
              [firstSemester[0].id]
            );
            console.log(`Semestre ID ${firstSemester[0].id} activé pour l'année ${year.year_name}`);
          }
        }
      }
    }
    
    // Vérifier les semestres après création
    console.log('\nSemestres après création/mise à jour:');
    const finalSemesters = await db.sql('SELECT * FROM semesters;');
    console.log(finalSemesters);
    
    console.log('\nOpération terminée avec succès');
    await db.close();
    
  } catch (error) {
    console.error('Erreur lors du traitement:', error);
  }
}

main(); 