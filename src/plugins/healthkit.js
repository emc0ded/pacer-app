/**
 * HealthKit Capacitor plugin bridge
 *
 * Wraps the native HealthKitPlugin (iOS only).
 * On web / Android, all calls resolve as no-ops so the rest of the
 * app doesn't need platform guards everywhere.
 */
import { registerPlugin, Capacitor } from '@capacitor/core'

// Registers the JS ↔ native bridge by name
const _HealthKit = registerPlugin('HealthKit')

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Returns true if HealthKit is available (iOS only).
 */
export async function hkIsAvailable() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { value } = await _HealthKit.isAvailable()
    return !!value
  } catch {
    return false
  }
}

/**
 * Asks the user for permission to write workouts, distance, and calories.
 * Safe to call multiple times — iOS only shows the prompt once.
 *
 * @returns {Promise<boolean>} true if granted
 */
export async function hkRequestAuthorization() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { granted } = await _HealthKit.requestAuthorization()
    return !!granted
  } catch (e) {
    console.warn('[HealthKit] requestAuthorization failed:', e)
    return false
  }
}

/**
 * Save a completed run as a Running workout in Apple Health.
 *
 * @param {{
 *   startDate: string,   // ISO 8601
 *   endDate:   string,   // ISO 8601
 *   distance:  number,   // metres
 *   energyBurned?: number // kcal (optional)
 * }} workout
 */
export async function hkSaveWorkout(workout) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await _HealthKit.saveWorkout(workout)
  } catch (e) {
    // Non-fatal — the run is already saved in Firestore
    console.warn('[HealthKit] saveWorkout failed:', e)
  }
}
