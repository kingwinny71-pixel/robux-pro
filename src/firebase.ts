import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  projectId: "project-7e949da5-55af-4848-ad8",
  appId: "1:97287456338:web:239f3635d51af50c27c18b",
  apiKey: "AIzaSyAMN3_s_urLcwi0_DPG-VpSXWLE7hnVy9g",
  authDomain: "project-7e949da5-55af-4848-ad8.firebaseapp.com",
  storageBucket: "project-7e949da5-55af-4848-ad8.firebasestorage.app",
  messagingSenderId: "97287456338"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific databaseId provisioned by AI Studio
export const db = getFirestore(app, "ai-studio-3e05bd9b-be4f-46ff-8a4e-3f2965e1872c");
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
