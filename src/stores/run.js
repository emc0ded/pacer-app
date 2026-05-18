/**
 * stores/run.js — Run state + Firestore persistence
 *
 * Local run list is kept in sync with Firestore via onSnapshot.
 * Call subscribeToRuns(uid) when the user signs in (done in App.vue).
 * Call unsubscribeRuns() when the user signs out.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'

export const useRunStore = defineStore('run', () => {
  // ── State ───────────────────────────────────────────────────
  /** Whether a run is currently active (hides bottom nav) */
  const isRunning = ref(false)

  /** Runs synced from Firestore (or empty until signed in) */
  const runs = ref([])

  /** True while the first Firestore snapshot is loading */
  const loadingRuns = ref(false)

  // Holds the onSnapshot unsubscribe function
  let _unsubscribe = null

  // ── Firestore subscription ─────────────────────────────────

  /**
   * Start listening to the signed-in user's runs in real time.
   * Called from App.vue whenever authStore.uid becomes non-null.
   */
  function subscribeToRuns(uid) {
    // Don't double-subscribe
    if (_unsubscribe) return

    loadingRuns.value = true

    const runsRef = collection(db, 'users', uid, 'runs')
    const q       = query(runsRef, orderBy('createdAt', 'desc'))

    _unsubscribe = onSnapshot(q, (snapshot) => {
      runs.value = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      loadingRuns.value = false
    }, (err) => {
      console.error('[runs] Firestore snapshot error:', err)
      loadingRuns.value = false
    })
  }

  /** Stop listening and clear the local list. Called on sign-out. */
  function unsubscribeRuns() {
    if (_unsubscribe) {
      _unsubscribe()
      _unsubscribe = null
    }
    runs.value    = []
    loadingRuns.value = false
  }

  // ── Actions ────────────────────────────────────────────────

  function setRunning(value) {
    isRunning.value = value
  }

  /**
   * Save a completed run to Firestore.
   * The onSnapshot listener will add it to runs[] automatically.
   *
   * @param {string} uid - the signed-in user's UID
   * @param {{ name, date, distance, duration, coordinates }} run
   */
  async function addRun(uid, run) {
    if (!uid) {
      // Fallback: save locally only (user not signed in)
      runs.value.unshift({ id: Date.now().toString(), ...run })
      return
    }

    const runsRef = collection(db, 'users', uid, 'runs')
    await addDoc(runsRef, {
      ...run,
      createdAt: serverTimestamp(),
    })
    // No need to manually push to runs[] — onSnapshot handles it
  }

  async function renameRun(uid, runId, newName) {
    if (!uid || !newName.trim()) return
    await updateDoc(doc(db, 'users', uid, 'runs', runId), { name: newName.trim() })
    // onSnapshot updates runs[] automatically
  }

  async function removeRun(uid, runId) {
    if (!uid) {
      runs.value = runs.value.filter((r) => r.id !== runId)
      return
    }
    await deleteDoc(doc(db, 'users', uid, 'runs', runId))
    // onSnapshot removes it from runs[] automatically
  }

  // ── Getters ────────────────────────────────────────────────
  const totalKm = computed(() =>
    runs.value.reduce((acc, r) => acc + (r.distance ?? 0) / 1000, 0),
  )

  const totalRuns = computed(() => runs.value.length)

  // Best pace in min/km across all runs (lower = faster)
  const bestPaceMinPerKm = computed(() => {
    return runs.value.reduce((best, r) => {
      if (!r.distance || !r.duration) return best
      const pace = (r.duration / 60000) / (r.distance / 1000)
      return best === null || pace < best ? pace : best
    }, null)
  })

  // Longest single run in km
  const longestRunKm = computed(() =>
    runs.value.reduce((max, r) => Math.max(max, (r.distance ?? 0) / 1000), 0),
  )

  // Miles logged since the most recent Sunday midnight (current calendar week)
  const weeklyMiles = computed(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // back to Sunday
    startOfWeek.setHours(0, 0, 0, 0)
    return runs.value
      .filter((r) => r.date && new Date(r.date) >= startOfWeek)
      .reduce((sum, r) => sum + (r.distance ?? 0) / 1609.344, 0)
  })

  // ── Achievements ───────────────────────────────────────────
  const ACHIEVEMENT_DEFS = [
    {
      id: 'first_run',
      emoji: '👟',
      name: 'First Steps',
      description: 'Complete your first run',
      check: (r) => r.length >= 1,
    },
    {
      id: 'runs_5',
      emoji: '🔥',
      name: 'On a Roll',
      description: 'Complete 5 runs',
      check: (r) => r.length >= 5,
    },
    {
      id: 'runs_10',
      emoji: '💪',
      name: 'Dedicated',
      description: 'Complete 10 runs',
      check: (r) => r.length >= 10,
    },
    {
      id: 'runs_25',
      emoji: '🏅',
      name: 'Committed',
      description: 'Complete 25 runs',
      check: (r) => r.length >= 25,
    },
    {
      id: '5k',
      emoji: '🎽',
      name: '5K Club',
      description: 'Run 5km or more in one go',
      check: (r) => r.some(x => (x.distance ?? 0) >= 5000),
    },
    {
      id: '10k',
      emoji: '⭐',
      name: '10K Club',
      description: 'Run 10km or more in one go',
      check: (r) => r.some(x => (x.distance ?? 0) >= 10000),
    },
    {
      id: 'half_marathon',
      emoji: '🌟',
      name: 'Half Marathon',
      description: 'Run 21.1km or more in one go',
      check: (r) => r.some(x => (x.distance ?? 0) >= 21097),
    },
    {
      id: 'marathon',
      emoji: '🏆',
      name: 'Marathon',
      description: 'Run a full 42.2km',
      check: (r) => r.some(x => (x.distance ?? 0) >= 42195),
    },
    {
      id: 'sub6_pace',
      emoji: '⚡',
      name: 'Speed Demon',
      description: 'Run a km in under 6:00 pace',
      check: (r) => r.some(x => {
        if (!x.distance || !x.duration) return false
        return (x.duration / 60000) / (x.distance / 1000) < 6
      }),
    },
    {
      id: 'sub5_pace',
      emoji: '🚀',
      name: 'Rocket Legs',
      description: 'Run a km in under 5:00 pace',
      check: (r) => r.some(x => {
        if (!x.distance || !x.duration) return false
        return (x.duration / 60000) / (x.distance / 1000) < 5
      }),
    },
    {
      id: 'early_bird',
      emoji: '🌅',
      name: 'Early Bird',
      description: 'Complete a run before 7am',
      check: (r) => r.some(x => x.date && new Date(x.date).getHours() < 7),
    },
    {
      id: 'night_owl',
      emoji: '🌙',
      name: 'Night Owl',
      description: 'Complete a run after 9pm',
      check: (r) => r.some(x => x.date && new Date(x.date).getHours() >= 21),
    },
  ]

  const achievements = computed(() =>
    ACHIEVEMENT_DEFS.map((def) => ({
      ...def,
      unlocked: def.check(runs.value),
    })),
  )

  const unlockedCount = computed(() =>
    achievements.value.filter((a) => a.unlocked).length,
  )

  return {
    isRunning,
    runs,
    loadingRuns,
    setRunning,
    subscribeToRuns,
    unsubscribeRuns,
    addRun,
    renameRun,
    removeRun,
    totalKm,
    totalRuns,
    bestPaceMinPerKm,
    longestRunKm,
    weeklyMiles,
    achievements,
    unlockedCount,
  }
})
