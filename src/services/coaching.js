/**
 * services/coaching.js
 *
 * Thin wrappers around Firebase httpsCallable functions.
 * All Anthropic API calls happen server-side in Cloud Functions —
 * the API key never touches the client bundle.
 */

import { getFunctions, httpsCallable } from 'firebase/functions'

const functions = getFunctions()

const _getRunCoaching       = httpsCallable(functions, 'getRunCoaching')
const _generateRouteName    = httpsCallable(functions, 'generateRouteName')
const _generateTrainingPlan = httpsCallable(functions, 'generateTrainingPlan')
const _adaptTrainingPlan    = httpsCallable(functions, 'adaptTrainingPlan')

/**
 * Get a post-run coaching summary from Claude.
 * @param {{ distanceKm: string, duration: string, pace: string, feel?: number }} stats
 * @returns {Promise<string>} coaching text
 */
export async function getRunCoaching({ distanceKm, duration, pace, feel }) {
  const result = await _getRunCoaching({ distanceKm, duration, pace, feel: feel ?? null })
  return result.data.coaching
}

/**
 * Generate a creative name for the completed run.
 * @param {{ distanceKm: string, pace: string }} stats
 * @returns {Promise<string>} route name e.g. "Sunrise Harbor Loop"
 */
export async function generateRouteName({ distanceKm, pace }) {
  const hour      = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const result    = await _generateRouteName({ distanceKm, pace, timeOfDay })
  return result.data.name
}

/**
 * Generate a full AI training plan.
 * @param {{ goalType, goalDate, recentRuns, weeksUntilRace }} params
 * @returns {Promise<{ totalWeeks, weeks }>}
 */
export async function generateTrainingPlan(params) {
  const result = await _generateTrainingPlan(params)
  return result.data.plan
}

/**
 * Adapt remaining plan weeks based on last week's actual runs.
 * @param {{ goalType, goalDate, completedWeek, actualRuns, remainingWeeks }} params
 * @returns {Promise<Array>} updatedWeeks
 */
export async function adaptTrainingPlan(params) {
  const result = await _adaptTrainingPlan(params)
  return { updatedWeeks: result.data.updatedWeeks }
}
