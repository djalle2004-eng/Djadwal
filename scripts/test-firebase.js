import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSy_YOUR_API_KEY_HERE",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "suivie-fsegc.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "suivie-fsegc",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "suivie-fsegc.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "978479469224",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:978479469224:web:a6bd71ceac4b8807ce289d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFirebase() {
  try {
    const testData = {
      first_name: "Test",
      last_name: "Professor",
      academic_title: "Prof.",
      specialization: "Testing",
      weekly_hours: 40,
      email: "test@example.com",
      created_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'professors'), testData);
    console.log('Test document written with ID: ', docRef.id);
  } catch (error) {
    console.error('Error adding test document: ', error);
  }
}

testFirebase();
