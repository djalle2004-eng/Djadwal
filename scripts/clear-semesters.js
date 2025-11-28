// Script pour nettoyer les semestres dupliqués
require('dotenv').config();
const { Database } = require('@sqlitecloud/drivers');

async function main() {
  console.log('Nettoyage des semestres dupliqués...');
  
  try {
    // Connexion à SQLiteCloud
    const connectionString = `sqlitecloud://${process.env.SQLITECLOUD_USERNAME}:${process.env.SQLITECLOUD_PASSWORD}@${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/${process.env.SQLITECLOUD_DATABASE || 'Djadwal'}`;
    console.log(`Connexion à: ${connectionString}`);
    
    const db = new Database(connectionString);
    
    // 1. Supprimer tous les semestres
    console.log('Suppression de tous les semestres...');
    await db.sql('DELETE FROM semesters');
    
    // 2. Récupérer toutes les années académiques
    console.log('\nRécupération des années académiques...');
    const years = await db.sql('SELECT * FROM academic_years;');
    console.log(`${years.length} années académiques trouvées`);
    
    // 3. Créer deux semestres pour chaque année
    for (const year of years) {
      console.log(`\nCréation de semestres pour l'année ${year.year_name} (ID: ${year.id})`);
      
      // Créer le premier semestre (courant par défaut)
      const sem1Query = `INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) 
        VALUES ('${year.id}', 'السداسي الأول', '2024-09-01', '2024-12-31', 1)`;
      await db.sql(sem1Query);
      console.log("Semestre 1 créé");
      
      // Créer le deuxième semestre
      const sem2Query = `INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) 
        VALUES ('${year.id}', 'السداسي الثاني', '2025-01-01', '2025-06-30', 0)`;
      await db.sql(sem2Query);
      console.log("Semestre 2 créé");
    }
    
    // Vérifier les semestres après création
    console.log('\nSemestres après nettoyage:');
    const finalSemesters = await db.sql('SELECT * FROM semesters;');
    console.log(finalSemesters);
    
    console.log('\nNettoyage terminé avec succès');
    await db.close();
    
  } catch (error) {
    console.error('Erreur lors du traitement:', error);
  }
}

main(); 