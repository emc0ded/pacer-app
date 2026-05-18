/**
 * stores/route.js — Planned route state + Firestore persistence
 *
 * Mirrors the run store pattern. Call subscribeToRoutes(uid) on sign-in
 * and unsubscribeRoutes() on sign-out (done in App.vue).
 *
 * selectedRoute holds a route the user wants to run — RunView reads it
 * to draw a ghost line, then calls clearSelectedRoute() when done.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'

export const useRouteStore = defineStore('route', () => {
  // ── State ────────────────────────────────────────────────────
  /** Routes synced from Firestore */
  const routes = ref([])

  /** Route selected to run — read by RunView for the ghost line */
  const selectedRoute = ref(null)

  // Firestore unsubscribe handle
  let _unsubscribe = null

  // ── Firestore subscription ───────────────────────────────────
  function subscribeToRoutes(uid) {
    if (_unsubscribe) return

    const ref_ = collection(db, 'users', uid, 'routes')
    const q    = query(ref_, orderBy('createdAt', 'desc'))

    _unsubscribe = onSnapshot(q, (snapshot) => {
      routes.value = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    }, (err) => {
      console.error('[routes] Firestore snapshot error:', err)
    })
  }

  function unsubscribeRoutes() {
    if (_unsubscribe) {
      _unsubscribe()
      _unsubscribe = null
    }
    routes.value = []
  }

  // ── Actions ──────────────────────────────────────────────────
  async function addRoute(uid, route) {
    if (!uid) return
    const col = collection(db, 'users', uid, 'routes')
    await addDoc(col, {
      ...route,
      createdAt: serverTimestamp(),
    })
  }

  async function removeRoute(uid, routeId) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'routes', routeId))
  }

  function selectRoute(route) {
    selectedRoute.value = route
  }

  function clearSelectedRoute() {
    selectedRoute.value = null
  }

  return {
    routes,
    selectedRoute,
    subscribeToRoutes,
    unsubscribeRoutes,
    addRoute,
    removeRoute,
    selectRoute,
    clearSelectedRoute,
  }
})
