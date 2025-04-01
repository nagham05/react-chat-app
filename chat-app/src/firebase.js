import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBqXPMeLtoDJG81YmuaDTyv3d7LLK2LodM",
  authDomain: "chat-app-58a2d.firebaseapp.com",
  projectId: "chat-app-58a2d",
  storageBucket: "chat-app-58a2d.firebasestorage.app",
  messagingSenderId: "631616904163",
  appId: "1:631616904163:web:8f017eee8c4934fa8a5ed6",
  measurementId: "G-L6KTT877JV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
