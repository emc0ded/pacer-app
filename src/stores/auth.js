/**
 * stores/auth.js — Firebase Authentication state
 *
 * Call authStore.init() once in App.vue on mount.
 * Everything else (user, isAuthenticated, signIn, signOut) is reactive
 * and can be imported anywhere with useAuthStore().
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged,
  signInWithCredential,
  OAuthProvider,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  deleteUser,
} from 'firebase/auth'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { doc, getDoc, getDocs, deleteDoc, collection } from 'firebase/firestore'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { auth, db, storage } from '@/firebase'

export const useAuthStore = defineStore('auth', () => {
  // ── State ───────────────────────────────────────────────────
  const user          = ref(null)
  const loading       = ref(true)
  const customPhotoURL= ref(null) // overrides Google photo when set

  // ── Getters ────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!user.value)
  const displayName     = computed(() => user.value?.displayName ?? 'Runner')
  const photoURL        = computed(() => user.value?.photoURL ?? null)
  const email           = computed(() => user.value?.email ?? null)
  const uid             = computed(() => user.value?.uid ?? null)

  // ── Actions ────────────────────────────────────────────────

  function init() {
    return new Promise((resolve) => {
      // Safety net: if Firebase doesn't respond in 5 s (common in Capacitor
      // simulator on first cold start), unblock the UI and treat as signed out.
      const timeout = setTimeout(() => {
        if (loading.value) {
          loading.value = false
          resolve(null)
        }
      }, 5000)

      onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeout)
        user.value    = firebaseUser
        loading.value = false

        // Load custom photo URL from Firestore if user is signed in
        if (firebaseUser) {
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
            if (snap.exists() && snap.data().customPhotoURL) {
              customPhotoURL.value = snap.data().customPhotoURL
            }
          } catch {
            // Non-fatal — fall back to Google photo
          }
        } else {
          customPhotoURL.value = null
        }

        resolve(firebaseUser)
      })
    })
  }

  async function signInWithGoogle() {
    try {
      // skipNativeAuth: true (from config) — plugin returns accessToken only.
      // Firebase Web SDK can verify a Google accessToken directly.
      const result = await FirebaseAuthentication.signInWithGoogle()
      const credential = GoogleAuthProvider.credential(
        null,
        result.credential?.accessToken,
      )
      await signInWithCredential(auth, credential)
    } catch (err) {
      if (err.code === 'ERR_CANCELED') return null
      console.error('[auth] Google sign-in error:', err)
      throw err
    }
  }

  async function signInWithApple() {
    try {
      // skipNativeAuth: true (from config) — native Firebase does NOT sign in,
      // so the nonce is not consumed before we use it here.
      const result = await FirebaseAuthentication.signInWithApple()
      const provider   = new OAuthProvider('apple.com')
      const credential = provider.credential({
        idToken:  result.credential?.idToken,
        rawNonce: result.credential?.nonce,
      })
      await signInWithCredential(auth, credential)
    } catch (err) {
      if (err.code === 'ERR_CANCELED') return null
      console.error('[auth] Apple sign-in error:', err)
      throw err
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
    customPhotoURL.value = null
  }

  /** Called by ProfileView after a successful photo upload */
  function setCustomPhoto(url) {
    customPhotoURL.value = url
  }

  /**
   * Permanently delete the user's account and all associated data.
   * Deletes: all runs (Firestore), user doc (Firestore),
   * profile photo (Storage), and the Firebase Auth account.
   *
   * Throws 'requires-recent-login' if the session is too old —
   * caller should ask the user to sign out and sign back in.
   */
  async function deleteAccount() {
    const currentUser = auth.currentUser
    if (!currentUser) return

    const userId = currentUser.uid

    // 1. Delete all runs
    const runsSnap = await getDocs(collection(db, 'users', userId, 'runs'))
    await Promise.all(runsSnap.docs.map((d) => deleteDoc(d.ref)))

    // 2. Delete profile photo from Storage (non-fatal if missing)
    try {
      await deleteObject(storageRef(storage, `users/${userId}/profile.jpg`))
    } catch { /* no photo — that's fine */ }

    // 3. Delete user Firestore document
    await deleteDoc(doc(db, 'users', userId))

    // 4. Delete the Firebase Auth account (may throw requires-recent-login)
    await deleteUser(currentUser)

    customPhotoURL.value = null
  }

  return {
    user,
    loading,
    customPhotoURL,
    isAuthenticated,
    displayName,
    photoURL,
    email,
    uid,
    init,
    signInWithGoogle,
    signInWithApple,
    signOut,
    setCustomPhoto,
    deleteAccount,
  }
})
