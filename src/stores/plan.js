/**
 * stores/plan.js — AI Training Plan state
 *
 * Plan is stored in Firestore at users/{uid}/plan/current.
 * Call init(uid) after sign-in; call clear() on sign-out.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { generateTrainingPlan, adaptTrainingPlan } from '@/services/coaching'

export const usePlanStore = defineStore('plan', () => {
  // ── State ───────────────────────────────────────────────────
  const plan      = ref(null)   // full plan object or null
  const loading   = ref(false)
  const saving    = ref(false)
  const error     = ref(null)

  // ── Helpers ─────────────────────────────────────────────────

  /** Monday of the week containing a given date */
  function mondayOf(date = new Date()) {
    const d = new Date(date)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    d.setHours(0, 0, 0, 0)
    return d
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10)
  }

  // ── Firestore ───────────────────────────────────────────────

  async function loadPlan(uid) {
    if (!uid) return
    loading.value = true
    error.value   = null
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'plan', 'current'))
      plan.value  = snap.exists() ? snap.data() : null
    } catch (e) {
      console.error('[plan] load error', e)
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function savePlan(uid, planData) {
    if (!uid) return
    saving.value = true
    try {
      await setDoc(doc(db, 'users', uid, 'plan', 'current'), planData)
      plan.value = planData
    } finally {
      saving.value = false
    }
  }

  async function deletePlan(uid) {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'plan', 'current'))
    plan.value = null
  }

  // ── Actions ─────────────────────────────────────────────────

  /**
   * Generate a brand-new training plan.
   * @param {string} uid
   * @param {{ goalType, goalDate }} goal - user's race goal
   * @param {Array}  recentRuns          - from runStore.runs (last ~8)
   */
  async function generate(uid, { goalType, goalDate }, recentRuns = []) {
    loading.value = true
    error.value   = null
    try {
      const raceDate     = new Date(goalDate)
      const today        = new Date()
      const msPerWeek    = 7 * 24 * 60 * 60 * 1000
      const weeksUntilRace = Math.max(4, Math.round((raceDate - today) / msPerWeek))

      // Shape recent runs for the cloud function
      const runPayload = recentRuns.slice(0, 8).map((r) => ({
        date:        r.date ? r.date.slice(0, 10) : isoDate(new Date()),
        distanceMi:  parseFloat((r.distance / 1609.344).toFixed(2)),
        durationMin: Math.round((r.duration || 0) / 60000),
      }))

      const { weeks, totalWeeks } = await generateTrainingPlan({
        goalType,
        goalDate,
        recentRuns: runPayload,
        weeksUntilRace,
      })

      const newPlan = {
        goalType,
        goalDate,
        totalWeeks,
        createdAt:     isoDate(new Date()),
        lastAdaptedAt: isoDate(new Date()),
        weeks,
      }

      await savePlan(uid, newPlan)
    } catch (e) {
      console.error('[plan] generate error', e)
      error.value = 'Could not generate plan. Please try again.'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Weekly Monday check-in: adapt remaining weeks based on actual runs.
   * Only runs if today is Monday and plan hasn't been adapted this week.
   */
  async function maybeAdapt(uid, recentRuns = []) {
    if (!plan.value || !uid) return
    const today      = isoDate(new Date())
    const dayOfWeek  = new Date().getDay() // 1 = Monday
    if (dayOfWeek !== 1) return             // only run on Mondays
    if (plan.value.lastAdaptedAt === today) return // already ran today

    const currentWeekStart = isoDate(mondayOf())
    const lastWeekStart    = isoDate(new Date(mondayOf() - 7 * 24 * 60 * 60 * 1000))

    // Find the completed week in the plan
    const completedWeek = plan.value.weeks.find(
      (w) => w.startDate === lastWeekStart,
    )
    if (!completedWeek) return

    // Runs that fell in the past week
    const lastWeekEnd = isoDate(new Date(mondayOf() - 1))
    const weekRuns = recentRuns
      .filter((r) => r.date >= lastWeekStart && r.date <= lastWeekEnd)
      .map((r) => ({
        date:        r.date.slice(0, 10),
        distanceMi:  parseFloat((r.distance / 1609.344).toFixed(2)),
        durationMin: Math.round((r.duration || 0) / 60000),
      }))

    // Remaining weeks (this week onward)
    const remaining = plan.value.weeks.filter((w) => w.startDate >= currentWeekStart)
    if (remaining.length === 0) return

    try {
      const { updatedWeeks } = await adaptTrainingPlan({
        goalType:       plan.value.goalType,
        goalDate:       plan.value.goalDate,
        completedWeek,
        actualRuns:     weekRuns,
        remainingWeeks: remaining,
      })

      // Merge updated weeks back into the plan
      const pastWeeks = plan.value.weeks.filter((w) => w.startDate < currentWeekStart)
      const updatedPlan = {
        ...plan.value,
        weeks:         [...pastWeeks, ...updatedWeeks],
        lastAdaptedAt: today,
      }
      await savePlan(uid, updatedPlan)
    } catch (e) {
      console.error('[plan] adapt error', e)
      // Non-fatal — keep existing plan
    }
  }

  function clear() {
    plan.value    = null
    loading.value = false
    error.value   = null
  }

  // ── Computed helpers ─────────────────────────────────────────

  /** The week object whose startDate is this week's Monday */
  const currentWeek = computed(() => {
    if (!plan.value) return null
    const thisMonday = isoDate(mondayOf())
    return plan.value.weeks.find((w) => w.startDate === thisMonday) ?? null
  })

  /** Today's scheduled workout (or null if rest day) */
  const todayWorkout = computed(() => {
    if (!currentWeek.value) return null
    const today = isoDate(new Date())
    return currentWeek.value.workouts.find((w) => w.date === today) ?? null
  })

  /** Week number for the current week */
  const currentWeekNumber = computed(() => currentWeek.value?.weekNumber ?? null)

  /** How many days until the race */
  const daysToRace = computed(() => {
    if (!plan.value?.goalDate) return null
    const diff = new Date(plan.value.goalDate) - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })

  /** Workout type → emoji map */
  const typeEmoji = {
    'Easy Run':   '🟢',
    'Tempo':      '🟡',
    'Long Run':   '🔵',
    'Intervals':  '🔴',
    'Strides':    '⚡',
  }

  return {
    plan,
    loading,
    saving,
    error,
    currentWeek,
    currentWeekNumber,
    todayWorkout,
    daysToRace,
    typeEmoji,
    loadPlan,
    generate,
    maybeAdapt,
    deletePlan,
    clear,
  }
})
