import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Safely initialize analytics
let analytics = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn("Firebase Analytics failed to initialize:", error);
  }
}

const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  host: 'firestore.googleapis.com',
  ssl: true,
  ignoreUndefinedProperties: true,
}, (firebaseConfig as any).firestoreDatabaseId);

// Test connection to Firestore
export const connectionPromise = (async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      // Wait a bit for the environment to stabilize
      await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)));
      // Attempt to fetch a non-existent document to test connectivity
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("Firestore connection successful");
      return true;
    } catch (error) {
      if (i === retries - 1) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        } else {
          console.error("Firestore connection failed after retries:", error);
        }
        return false;
      } else {
        console.warn(`Firestore connection attempt ${i + 1} failed. Retrying...`);
      }
    }
  }
  return false;
})();

export { app, analytics, auth, db };
