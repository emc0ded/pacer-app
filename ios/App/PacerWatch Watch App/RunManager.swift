import Foundation
import Combine
import CoreLocation
import HealthKit

// ── Completed run data passed to SummaryView and sent to iPhone ──
struct CompletedRun {
    let date:        String    // ISO 8601
    let distance:    Double    // metres
    let duration:    Double    // milliseconds
    let coordinates: [[Double]] // [[lng, lat], ...]
}

// ── Run state machine ─────────────────────────────────────────────
enum RunState {
    case idle
    case running
    case completed(CompletedRun)
}

@MainActor
class RunManager: NSObject, ObservableObject {

    @Published var state:          RunState = .idle
    @Published var isPaused:       Bool     = false
    @Published var elapsedSeconds: Int      = 0
    @Published var distanceMeters: Double   = 0
    @Published var paceMinPerMile: Double?  = nil

    private let healthStore      = HKHealthStore()
    private let locationManager  = CLLocationManager()
    private var workoutSession:  HKWorkoutSession?
    private var workoutBuilder:  HKLiveWorkoutBuilder?
    private var timer:           Timer?
    private var startDate:       Date?
    private var coordinates:     [[Double]] = []
    private var lastLocation:    CLLocation?

    override init() {
        super.init()
        locationManager.delegate        = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter  = 5  // update every 5 m
    }

    // ── Permissions ───────────────────────────────────────────────
    func requestPermissions() {
        locationManager.requestWhenInUseAuthorization()

        let share: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.activeEnergyBurned),
        ]
        healthStore.requestAuthorization(toShare: share, read: nil) { _, _ in }
    }

    // ── Start ─────────────────────────────────────────────────────
    func startRun() {
        let config              = HKWorkoutConfiguration()
        config.activityType     = .running
        config.locationType     = .outdoor

        do {
            workoutSession  = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            workoutBuilder  = workoutSession?.associatedWorkoutBuilder()
            workoutBuilder?.dataSource = HKLiveWorkoutDataSource(
                healthStore:           healthStore,
                workoutConfiguration:  config
            )
            let now = Date()
            startDate = now
            workoutSession?.startActivity(with: now)
            workoutBuilder?.beginCollection(withStart: now) { _, _ in }
        } catch {
            print("[RunManager] Failed to start workout session: \(error)")
            startDate = Date()
        }

        elapsedSeconds  = 0
        distanceMeters  = 0
        paceMinPerMile  = nil
        coordinates     = []
        lastLocation    = nil
        isPaused        = false
        state           = .running

        locationManager.startUpdatingLocation()

        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.elapsedSeconds += 1
            }
        }
    }

    // ── Pause / Resume ────────────────────────────────────────────
    func pauseRun() {
        guard case .running = state, !isPaused else { return }
        isPaused = true
        timer?.invalidate()
        timer = nil
        locationManager.stopUpdatingLocation()
        lastLocation = nil  // don't connect gap when resuming
        workoutSession?.pause()
    }

    func resumeRun() {
        guard case .running = state, isPaused else { return }
        isPaused = false
        locationManager.startUpdatingLocation()
        workoutSession?.resume()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.elapsedSeconds += 1
            }
        }
    }

    // ── Stop ──────────────────────────────────────────────────────
    func stopRun() {
        timer?.invalidate()
        timer = nil
        locationManager.stopUpdatingLocation()

        let endDate = Date()
        let run = CompletedRun(
            date:        ISO8601DateFormatter().string(from: endDate),
            distance:    distanceMeters,
            duration:    Double(elapsedSeconds) * 1000,
            coordinates: coordinates
        )

        // Finish the HealthKit workout (non-blocking)
        workoutBuilder?.endCollection(withEnd: endDate) { [weak self] _, _ in
            self?.workoutBuilder?.finishWorkout { _, _ in }
        }
        workoutSession?.end()

        state = .completed(run)
    }

    // ── Reset to idle ─────────────────────────────────────────────
    func reset() {
        state = .idle
    }

    // ── Pace helper ───────────────────────────────────────────────
    private func updatePace() {
        guard distanceMeters > 100, elapsedSeconds > 0 else {
            paceMinPerMile = nil
            return
        }
        let pacePerKm   = (Double(elapsedSeconds) / 60.0) / (distanceMeters / 1000.0)
        paceMinPerMile  = pacePerKm * 1.60934
    }
}

// ── CLLocationManagerDelegate ────────────────────────────────────
extension RunManager: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager,
                                     didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            guard case .running = self.state else { return }
            for loc in locations {
                guard loc.horizontalAccuracy > 0,
                      loc.horizontalAccuracy < 25 else { continue }
                if let last = self.lastLocation {
                    self.distanceMeters += loc.distance(from: last)
                    self.updatePace()
                }
                self.lastLocation = loc
                self.coordinates.append([loc.coordinate.longitude, loc.coordinate.latitude])
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {}
}
