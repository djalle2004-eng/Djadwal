const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://kdqpnjeehzaffypahdbi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcXBuamVlaHphZmZ5cGFoZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzgzMTIsImV4cCI6MjA3MjQxNDMxMn0.EEuXzyM14E03TL70vgbAitYYtfitFPcHEN6UyodpwAo';

// Création du client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function initSupabase() {
  try {
    console.log('🚀 Initialisation de Supabase...');
    
    // Créer des données de test pour les départements
    console.log('\n📚 Création des départements...');
    const departments = [
      { name: 'Informatique', code: 'INFO' },
      { name: 'Mathématiques', code: 'MATH' },
      { name: 'Physique', code: 'PHYS' },
      { name: 'Chimie', code: 'CHIM' },
      { name: 'Biologie', code: 'BIO' }
    ];
    
    for (const dept of departments) {
      try {
        const { data, error } = await supabase
          .from('departments')
          .insert(dept)
          .select()
          .single();
        
        if (error) {
          console.log(`⚠️  Département ${dept.name} déjà existant ou erreur: ${error.message}`);
        } else {
          console.log(`✅ Département créé: ${dept.name} (${data.id})`);
        }
      } catch (err) {
        console.log(`⚠️  Erreur pour ${dept.name}: ${err.message}`);
      }
    }
    
    // Créer des données de test pour les professeurs
    console.log('\n👨‍🏫 Création des professeurs...');
    const professors = [
      {
        academic_title: 'Dr.',
        specialization: 'Informatique',
        weekly_hours: 20,
        email: 'dr.smith@university.edu'
      },
      {
        academic_title: 'Prof.',
        specialization: 'Mathématiques',
        weekly_hours: 18,
        email: 'prof.johnson@university.edu'
      },
      {
        academic_title: 'Dr.',
        specialization: 'Physique',
        weekly_hours: 22,
        email: 'dr.williams@university.edu'
      },
      {
        academic_title: 'Prof.',
        specialization: 'Chimie',
        weekly_hours: 16,
        email: 'prof.brown@university.edu'
      },
      {
        academic_title: 'Dr.',
        specialization: 'Biologie',
        weekly_hours: 24,
        email: 'dr.davis@university.edu'
      }
    ];
    
    for (const prof of professors) {
      try {
        const { data, error } = await supabase
          .from('professors')
          .insert(prof)
          .select()
          .single();
        
        if (error) {
          console.log(`⚠️  Professeur ${prof.email} déjà existant ou erreur: ${error.message}`);
        } else {
          console.log(`✅ Professeur créé: ${prof.academic_title} ${prof.specialization} (${data.id})`);
        }
      } catch (err) {
        console.log(`⚠️  Erreur pour ${prof.email}: ${err.message}`);
      }
    }
    
    // Créer des données de test pour les cours
    console.log('\n📖 Création des cours...');
    const courses = [
      {
        name: 'Programmation Web',
        code: 'WEB101',
        description: 'Introduction au développement web moderne',
        credits: 3
      },
      {
        name: 'Algèbre Linéaire',
        code: 'MATH201',
        description: 'Fondamentaux de l\'algèbre linéaire',
        credits: 4
      },
      {
        name: 'Mécanique Quantique',
        code: 'PHYS301',
        description: 'Principes de la mécanique quantique',
        credits: 5
      },
      {
        name: 'Chimie Organique',
        code: 'CHIM201',
        description: 'Structure et réactivité des composés organiques',
        credits: 4
      },
      {
        name: 'Génétique Moléculaire',
        code: 'BIO301',
        description: 'Mécanismes de l\'hérédité au niveau moléculaire',
        credits: 5
      }
    ];
    
    for (const course of courses) {
      try {
        const { data, error } = await supabase
          .from('courses')
          .insert(course)
          .select()
          .single();
        
        if (error) {
          console.log(`⚠️  Cours ${course.code} déjà existant ou erreur: ${error.message}`);
        } else {
          console.log(`✅ Cours créé: ${course.name} (${course.code}) - ${data.id}`);
        }
      } catch (err) {
        console.log(`⚠️  Erreur pour ${course.code}: ${err.message}`);
      }
    }
    
    // Créer des données de test pour les salles
    console.log('\n🏢 Création des salles...');
    const rooms = [
      {
        name: 'Amphithéâtre A',
        capacity: 150,
        building: 'Bâtiment Principal',
        floor: 1
      },
      {
        name: 'Salle TP 101',
        capacity: 30,
        building: 'Bâtiment Informatique',
        floor: 1
      },
      {
        name: 'Laboratoire 201',
        capacity: 25,
        building: 'Bâtiment Sciences',
        floor: 2
      },
      {
        name: 'Salle de Conférence',
        capacity: 80,
        building: 'Bâtiment Principal',
        floor: 2
      },
      {
        name: 'Salle de Réunion',
        capacity: 20,
        building: 'Bâtiment Administration',
        floor: 1
      }
    ];
    
    for (const room of rooms) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .insert(room)
          .select()
          .single();
        
        if (error) {
          console.log(`⚠️  Salle ${room.name} déjà existante ou erreur: ${error.message}`);
        } else {
          console.log(`✅ Salle créée: ${room.name} (${data.id})`);
        }
      } catch (err) {
        console.log(`⚠️  Erreur pour ${room.name}: ${err.message}`);
      }
    }
    
    // Créer des données de test pour les groupes
    console.log('\n👥 Création des groupes...');
    const groups = [
      {
        name: 'INFO 1A',
        year: 1,
        specialization: 'Informatique'
      },
      {
        name: 'INFO 2A',
        year: 2,
        specialization: 'Informatique'
      },
      {
        name: 'MATH 1A',
        year: 1,
        specialization: 'Mathématiques'
      },
      {
        name: 'PHYS 1A',
        year: 1,
        specialization: 'Physique'
      },
      {
        name: 'CHIM 1A',
        year: 1,
        specialization: 'Chimie'
      }
    ];
    
    for (const group of groups) {
      try {
        const { data, error } = await supabase
          .from('groups')
          .insert(group)
          .select()
          .single();
        
        if (error) {
          console.log(`⚠️  Groupe ${group.name} déjà existant ou erreur: ${error.message}`);
        } else {
          console.log(`✅ Groupe créé: ${group.name} (${data.id})`);
        }
      } catch (err) {
        console.log(`⚠️  Erreur pour ${group.name}: ${err.message}`);
      }
    }
    
    console.log('\n🎉 Initialisation terminée !');
    console.log('\n📊 Vous pouvez maintenant :');
    console.log('1. Tester l\'application avec ces données');
    console.log('2. Créer des sessions de cours');
    console.log('3. Gérer les emplois du temps');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
  }
}

initSupabase();
