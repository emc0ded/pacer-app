/**
 * firebase.js — Pacer Firebase initialization
 *
 * All config values are read from .env (prefixed VITE_).
 * Copy .env.example → .env and fill in your real values.
 *
 * Usage:
 *   import { auth, db, googleProvider } from '@/firebase'
 */

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { Capacitor } from '@capacitor/core'

// ── Config ─────────────────────────────────────────────────────
// Values come from Vite's import.meta.env — only VITE_ prefixed vars
// are exposed to the client bundle.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// ── Init ───────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig)

// ── Services ───────────────────────────────────────────────────
/**
 * Firebase Authentication instance.
 * On native Capacitor (iOS/Android) we must use initializeAuth with
 * indexedDBLocalPersistence — getAuth() uses browser sessionStorage which
 * doesn't work inside a native WebView and causes signInWithCredential
 * to hang indefinitely.
 */
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app)

/** Firestore database instance */
export const db = getFirestore(app)

/** Firebase Storage instance */
export const storage = getStorage(app)

export default app
