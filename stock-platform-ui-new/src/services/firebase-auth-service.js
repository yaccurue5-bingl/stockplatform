// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBCZBEF0f1UH7Z5Pugh-O7ZNh7Ql-BLcYk",
  authDomain: "stockplatform-fe563.firebaseapp.com",
  projectId: "stockplatform-fe563",
  storageBucket: "stockplatform-fe563.firebasestorage.app",
  messagingSenderId: "214435441234",
  appId: "1:214435441234:web:890b265ba78c45c71e4d8b",
  measurementId: "G-7Q2EXW4X3Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);