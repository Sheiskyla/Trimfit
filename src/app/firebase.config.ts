import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB7_3mRZKdf7gr7NxzQNUg8O8udtwY95Kk',
  authDomain: 'trimfit-e52d6.firebaseapp.com',
  projectId: 'trimfit-e52d6',
  storageBucket: 'trimfit-e52d6.firebasestorage.app',
  messagingSenderId: '28453724922',
  appId: '1:28453724922:web:f14d753a36141c10d9df43',
  measurementId: 'G-VXGKSK2N68'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const analytics = getAnalytics(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);