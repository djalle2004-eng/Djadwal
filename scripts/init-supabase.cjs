import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Récupération des variables d'environnement
dotenv.config();

// Configuration des chemins pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; 
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erreur: Variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.warn('Attention: SUPABASE_SERVICE_ROLE_KEY n\'est pas définie. Certaines opérations peuvent nécessiter des privilèges élevés.');
}

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

/**
 * Fonction pour exécuter un script SQL
 */
async function executeSqlScript(filePath) {
  try {
    console.log(`Lecture du fichier SQL: ${filePath}`);
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    console.log('Exécution du script SQL...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sqlContent });
    
    if (error) {
      console.error('Erreur lors de l\'exécution du script SQL:', error);
      return false;
    }
    
    console.log('Script SQL exécuté avec succès');
    return true;
  } catch (err) {
    console.error('Exception lors de l\'exécution du script SQL:', err);
    return false;
  }
}

/**
 * Vérifie la connexion à Supabase
 */
async function testConnection() {
  try {
    console.log('Test de connexion à Supabase...');
    const { data, error } = await supabase.from('departments').select('count(*)', { count: 'exact' });
    
    if (error) {
      // Si l'erreur est due à une table inexistante, ce n'est pas un problème de connexion
      if (error.code === '42P01') {
        console.log('Connexion réussie, mais la table departments n\'existe pas encore.');
        return true;
      }
      
      console.error('Erreur lors du test de connexion:', error);
      return false;
    }
    
    console.log('Connexion réussie. Nombre de départements existants:', data);
    return true;
  } catch (err) {
    console.error('Exception lors du test de connexion:', err);
    return false;
  }
}

/**
 * Fonction principale d'initialisation
 */
async function initializeSupabase() {
  console.log('=== Initialisation de Supabase ===');
  
  // Test de connexion
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('Impossible de se connecter à Supabase. Vérifiez vos identifiants et URL.');
    process.exit(1);
  }
  
  // Chemin vers le script SQL de schéma
  const schemaScriptPath = path.join(__dirname, 'init-supabase-schema.sql');
  
  // Exécution du script de schéma
  const schemaCreated = await executeSqlScript(schemaScriptPath);
  if (!schemaCreated) {
    console.error('Erreur lors de la création du schéma. Veuillez vérifier le script SQL.');
    process.exit(1);
  }
  
  console.log('\n=== Initialisation terminée avec succès ===');
}

// Exécution de la fonction principale
initializeSupabase()
  .catch(err => {
    console.error('Erreur lors de l\'initialisation:', err);
    process.exit(1);
  }); 