import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDJFYeFfVKFkAPx49ylFYP2AoXu8LHDq_o",
  authDomain: "dwtnyl.firebaseapp.com",
  projectId: "dwtnyl",
  storageBucket: "dwtnyl.firebasestorage.app",
  messagingSenderId: "439400939428",
  appId: "1:439400939428:web:49d51a9356cc5597300b31"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
