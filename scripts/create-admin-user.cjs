import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import dotenv from 'dotenv';

// Récupération des variables d'environnement
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Erreur: Variables d\'environnement VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  console.error('La clé de service (service role key) est nécessaire pour créer un utilisateur administrateur');
  process.exit(1);
}

// Création du client Supabase avec la clé de service
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Interface pour lire les entrées utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Fonction pour poser une question et obtenir une réponse
 */
function question(query) {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

/**
 * Fonction pour demander un mot de passe (sans écho)
 */
async function askPassword(query) {
  console.log(query);
  // Note: Dans un terminal réel, on utiliserait un module comme 'readline-sync' pour masquer le mot de passe
  // Mais pour la simplicité, on utilise readline standard
  return question('Mot de passe: ');
}

/**
 * Fonction principale pour créer un administrateur
 */
async function createAdminUser() {
  console.log('=== Création d\'un utilisateur administrateur Supabase ===\n');
  
  try {
    // Demander les informations de l'administrateur
    const email = await question('Email de l\'administrateur: ');
    const username = await question('Nom d\'utilisateur: ');
    const password = await askPassword('Définir un mot de passe (min. 6 caractères):');
    
    if (!email || !password || !username) {
      console.error('Erreur: Email, mot de passe et nom d\'utilisateur sont requis');
      process.exit(1);
    }
    
    if (password.length < 6) {
      console.error('Erreur: Le mot de passe doit contenir au moins 6 caractères');
      process.exit(1);
    }
    
    console.log('\nCréation de l\'utilisateur...');
    
    // Créer l'utilisateur dans Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username }
    });
    
    if (error) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      process.exit(1);
    }
    
    console.log('Utilisateur créé avec succès:', data.user.id);
    
    // Créer l'entrée du profil avec le rôle d'administrateur
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        username,
        role: 'admin',
        updated_at: new Date().toISOString()
      });
    
    if (profileError) {
      console.error('Erreur lors de la création du profil d\'administrateur:', profileError);
      console.warn('L\'utilisateur a été créé mais sans les privilèges d\'administrateur');
      process.exit(1);
    }
    
    console.log('Profil administrateur créé avec succès');
    console.log('\n=== Utilisateur administrateur créé avec succès ===');
    console.log(`Email: ${email}`);
    console.log(`Nom d'utilisateur: ${username}`);
    console.log(`Rôle: admin`);
    
  } catch (err) {
    console.error('Exception lors de la création de l\'administrateur:', err);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Exécution de la fonction principale
createAdminUser();