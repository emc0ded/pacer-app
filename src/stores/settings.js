import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

export const useSettingsStore = defineStore('settings', () => {
  // Default 20 mi/week; fall back to localStorage for offline / signed-out users
  const weeklyGoalMi = ref(Number(localStorage.getItem('pacer-weekly-goal')) || 20)

  /** Load settings from the user's Firestore profile doc after sign-in. */
  async function loadSettings(uid) {
    if (!uid) return
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists() && snap.data().weeklyGoalMi != null) {
        weeklyGoalMi.value = snap.data().weeklyGoalMi
      }
    } catch (err) {
      console.error('[settings] load error:', err)
    }
  }

  /** Persist a new weekly goal locally and to Firestore. */
  async function saveGoal(uid, miles) {
    const val = Math.max(0, Number(miles) || 0)
    weeklyGoalMi.value = val
    localStorage.setItem('pacer-weekly-goal', val)
    if (uid) {
      await setDoc(doc(db, 'users', uid), { weeklyGoalMi: val }, { merge: true })
    }
  }

  return { weeklyGoalMi, loadSettings, saveGoal }
})
