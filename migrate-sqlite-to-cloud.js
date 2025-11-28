// Script autonome pour lancer la migration vers SQLiteCloud
// Usage: node migrate-sqlite-to-cloud.js

// Importation des modules nécessaires
const fs = require('fs');
const path = require('path');

// Pour s'assurer que le script peut trouver les modules electron
try {
  require('electron');
} catch (error) {
  console.error('Erreur: Electron est requis pour ce script.');
  console.error('Installer electron en utilisant: npm install -g electron');
  process.exit(1);
}

// Lancer la migration
console.log('Démarrage de la migration vers SQLiteCloud...');
console.log('----------------------------------------------');

// Appeler le script de migration
require('./electron/migrate-to-cloud.js');

// Instructions pour après la migration
console.log('\nAprès la migration:');
console.log('1. Renommez les fichiers (backup):');
console.log('   mv electron/database.js electron/database-sqlite.js');
console.log('   mv electron/database-cloud.js electron/database.js');
console.log('2. Testez l\'application avec la nouvelle base de données:');
console.log('   npm run electron:dev');
console.log('3. Si tout fonctionne, vous pouvez supprimer l\'ancien fichier:');
console.log('   rm electron/database-sqlite.js'); 