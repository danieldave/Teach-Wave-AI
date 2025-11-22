// firebase.js — compatibility build (keeps usage simple across the app)

// Replace the config object with your values (already set from earlier)
const firebaseConfig = {
  apiKey: "AIzaSyAxABor93rgmjMYeBSzdYMrfu_2C440bwg",
  authDomain: "lessonly-ai.firebaseapp.com",
  projectId: "lessonly-ai",
  storageBucket: "lessonly-ai.firebasestorage.app",
  messagingSenderId: "934996355950",
  appId: "1:934996355950:web:532faaf9442b1bbae4af7f",
  measurementId: "G-WDX901Y2ZL"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage ? firebase.storage() : null; // optional storage

// sign in anonymously so we have a uid for saving
auth.signInAnonymously()
  .then(() => console.log("Firebase: signed in anonymously"))
  .catch(e => console.warn("Firebase auth error:", e));

// expose as TW global for convenience
window.TW = { firebase, auth, db, storage };
