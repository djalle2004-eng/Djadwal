import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB6PFYzwGkb3pCWaU8-hj62orFr-ddxPJc",
  authDomain: "suivie-fsegc.firebaseapp.com",
  projectId: "suivie-fsegc",
  storageBucket: "suivie-fsegc.firebasestorage.app",
  messagingSenderId: "978479469224",
  appId: "1:978479469224:web:a6bd71ceac4b8807ce289d"
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
