const { app } = require('electron');
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');
const { Database } = require('@sqlitecloud/drivers');

// Charger les variables d'environnement
require('dotenv').config();

// Fonction pour obtenir le chemin de la base de données locale
function getDbPath() {
  // Pour électron, utiliser app.getPath('userData')
  if (app) {
    return path.join(app.getPath('userData'), 'database.sqlite');
  }
  
  // Version autonome (pour exécuter ce script directement avec Node)
  const { remote } = require('electron');
  if (remote && remote.app) {
    return path.join(remote.app.getPath('userData'), 'database.sqlite');
  }
  
  // Repli si exécuté en dehors d'Electron
  const userDataPath = process.env.APPDATA || 
    (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
  return path.join(userDataPath, 'djadwal', 'database.sqlite');
}

// Connexion à SQLiteCloud
const cloudConnectionString = `sqlitecloud://${process.env.SQLITECLOUD_USERNAME}:${process.env.SQLITECLOUD_PASSWORD}@${process.env.SQLITECLOUD_HOST}:${process.env.SQLITECLOUD_PORT}/Djadwal`;

async function migrateDatabase() {
  console.log('Démarrage de la migration...');
  
  try {
    // Obtenir le chemin de la base de données locale
    const dbPath = getDbPath();
    console.log(`Base de données locale: ${dbPath}`);
    
    // Ouvrir les connexions
    const localDb = new BetterSqlite3(dbPath);
    const cloudDb = new Database(cloudConnectionString);
    
    // Vérifier la connexion à SQLiteCloud
    await cloudDb.sql('SELECT 1 as test');
    console.log('Connexion à SQLiteCloud établie avec succès');
    
    // Tables à migrer
    const tables = [
      'departments', 
      'groups', 
      'courses', 
      'professors', 
      'rooms', 
      'assignments', 
      'academic_years', 
      'semesters', 
      'extra_sessions'
    ];
    
    // 1. Créer les tables sur SQLiteCloud si elles n'existent pas
    for (const table of tables) {
      console.log(`Création du schéma pour ${table}...`);
      
      // Obtenir les informations de structure de la table locale
      const tableSchema = localDb.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      
      if (tableSchema) {
        // Créer la table dans SQLiteCloud avec le même schéma
        try {
          // Supprimer la table d'abord (pour un redémarrage propre)
          await cloudDb.sql(`DROP TABLE IF EXISTS ${table}`);
          // Créer la table
          await cloudDb.sql(tableSchema.sql);
          console.log(`Schéma pour ${table} créé avec succès`);
        } catch (error) {
          console.error(`Erreur lors de la création du schéma pour ${table}:`, error);
        }
      } else {
        console.warn(`Table ${table} non trouvée dans la base de données locale`);
        continue; // Passer à la table suivante
      }
      
      // 2. Migrer les données
      try {
        const rows = localDb.prepare(`SELECT * FROM ${table}`).all();
        console.log(`${rows.length} enregistrements trouvés dans ${table}`);
        
        if (rows.length > 0) {
          // Obtenir les noms de colonnes du premier enregistrement
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(', ');
          
          // Insérer les données par lots
          const batchSize = 100;
          let insertedCount = 0;
          
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            
            for (const row of batch) {
              try {
                const values = columns.map(col => row[col]);
                
                // Construire la requête SQL avec les valeurs directement dans la chaîne
                const valuesList = values.map(val => {
                  if (val === null || val === undefined) return 'NULL';
                  if (typeof val === 'number') return val;
                  if (typeof val === 'boolean') return val ? 1 : 0;
                  // Échapper les apostrophes dans les chaînes de caractères
                  return `'${String(val).replace(/'/g, "''")}'`;
                }).join(', ');
                
                // Utiliser une requête SQL explicite plutôt que des paramètres
                await cloudDb.sql(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${valuesList})`);
                insertedCount++;
              } catch (error) {
                console.error(`Erreur lors de l'insertion dans ${table}:`, error);
              }
            }
            
            console.log(`Progression ${table}: ${insertedCount}/${rows.length} enregistrements`);
          }
          
          console.log(`Données de ${table} migrées avec succès: ${insertedCount} enregistrements`);
        }
      } catch (error) {
        console.error(`Erreur lors de l'extraction des données de ${table}:`, error);
      }
    }
    
    // Fermer les connexions
    localDb.close();
    await cloudDb.close();
    
    console.log('Migration terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de la migration:', error);
  }
}

// Exécuter la migration
migrateDatabase().then(() => {
  console.log('Script de migration terminé');
  process.exit(0);
}).catch((error) => {
  console.error('Erreur critique lors de la migration:', error);
  process.exit(1);
}); 