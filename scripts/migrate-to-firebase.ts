import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateProfessors() {
  try {
    // Fetch data from Supabase
    const { data: professors, error } = await supabase
      .from('professors')
      .select('*');

    if (error) throw error;
    if (!professors) {
      console.log('No professors found in Supabase');
      return;
    }

    console.log(`Found ${professors.length} professors to migrate`);

    // Migrate each professor to Firebase
    const migratedCount = await Promise.all(
      professors.map(async (professor) => {
        try {
          const { id, ...professorData } = professor;
          await addDoc(collection(db, 'professors'), {
            ...professorData,
            migrated_at: new Date().toISOString(),
          });
          console.log(`Migrated professor: ${professor.first_name} ${professor.last_name}`);
          return true;
        } catch (error) {
          console.error(`Failed to migrate professor ${professor.id}:`, error);
          return false;
        }
      })
    );

    const successCount = migratedCount.filter(Boolean).length;
    console.log(`Successfully migrated ${successCount} of ${professors.length} professors`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateProfessors()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  });
