import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin {

    private let healthStore = HKHealthStore()

    // ── isAvailable ────────────────────────────────────────────
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["value": HKHealthStore.isHealthDataAvailable()])
    }

    // ── requestAuthorization ───────────────────────────────────
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }

        let writeTypes: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
        ]

        healthStore.requestAuthorization(toShare: writeTypes, read: nil) { granted, error in
            if let error = error {
                call.reject("Authorization failed: \(error.localizedDescription)")
                return
            }
            call.resolve(["granted": granted])
        }
    }

    // ── saveWorkout ────────────────────────────────────────────
    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available on this device")
            return
        }

        guard
            let startStr = call.getString("startDate"),
            let endStr   = call.getString("endDate")
        else {
            call.reject("Missing startDate or endDate")
            return
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // Try with fractional seconds first, fall back to plain
        var startDate = formatter.date(from: startStr)
        var endDate   = formatter.date(from: endStr)
        if startDate == nil {
            formatter.formatOptions = [.withInternetDateTime]
            startDate = formatter.date(from: startStr)
            endDate   = formatter.date(from: endStr)
        }

        guard let start = startDate, let end = endDate else {
            call.reject("Could not parse dates: \(startStr) / \(endStr)")
            return
        }

        let distanceMeters   = call.getDouble("distance")      ?? 0
        let energyBurnedKcal = call.getDouble("energyBurned")  ?? 0
        let durationSeconds  = end.timeIntervalSince(start)

        let distanceQuantity = HKQuantity(unit: .meter(),     doubleValue: distanceMeters)
        let energyQuantity   = HKQuantity(unit: .kilocalorie(), doubleValue: energyBurnedKcal)

        let workout = HKWorkout(
            activityType:       .running,
            start:              start,
            end:                end,
            duration:           durationSeconds,
            totalEnergyBurned:  energyBurnedKcal > 0 ? energyQuantity   : nil,
            totalDistance:      distanceMeters   > 0 ? distanceQuantity : nil,
            metadata:           nil
        )

        healthStore.save(workout) { success, error in
            if success {
                call.resolve()
            } else {
                call.reject("Failed to save workout: \(error?.localizedDescription ?? "unknown error")")
            }
        }
    }
}
