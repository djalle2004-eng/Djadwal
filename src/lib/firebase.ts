import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'placeholder-api-key',
  authDomain: 'placeholder.firebaseapp.com',
  projectId: 'placeholder-project',
  storageBucket: 'placeholder.firebasestorage.app',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000'
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
