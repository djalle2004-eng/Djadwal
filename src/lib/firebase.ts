import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize services
export const analytics = getAnalytics(app);

// Initialize Firestore with cache settings
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);

// Initialize auth state listener with improved error handling
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('User is signed in with ID:', user.uid);
  } else {
    console.log('No user is signed in, attempting anonymous auth...');
    // Try to sign in anonymously if no user is present
    signInAnonymously(auth).catch((error) => {
      if (error.code === 'auth/configuration-not-found') {
        console.error('Anonymous authentication is not enabled in Firebase Console');
      } else if (error.code === 'auth/network-request-failed') {
        console.error('Network error during authentication. Check your internet connection.');
      } else {
        console.error('Authentication error:', error.code, error.message);
      }
    });
  }
});
