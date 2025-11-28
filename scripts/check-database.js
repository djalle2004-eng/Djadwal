const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');

async function checkDatabase() {
  try {
    console.log('🔍 Vérification de la base de données SQLite...');
    console.log(`Chemin: ${dbPath}`);
    
    if (!require('fs').existsSync(dbPath)) {
      console.log('❌ Base de données non trouvée');
      return;
    }
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    console.log('✅ Connexion à la base établie');
    
    // Vérifier les tables
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('\n📋 Tables trouvées:');
    
    if (tables.length === 0) {
      console.log('   Aucune table trouvée');
    } else {
      tables.forEach(table => {
        console.log(`   - ${table.name}`);
      });
    }
    
    // Vérifier le schéma de chaque table
    for (const table of tables) {
      console.log(`\n🔍 Structure de la table '${table.name}':`);
      try {
        const schema = await db.all(`PRAGMA table_info(${table.name})`);
        schema.forEach(col => {
          console.log(`   - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        // Compter les lignes
        const count = await db.get(`SELECT COUNT(*) as count FROM ${table.name}`);
        console.log(`   📊 Nombre de lignes: ${count.count}`);
        
      } catch (err) {
        console.log(`   ❌ Erreur lors de la lecture: ${err.message}`);
      }
    }
    
    await db.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkDatabase();
