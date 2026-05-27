import Foundation
import Combine
import WatchConnectivity

/// Sends completed run data from the Watch to the iPhone.
/// Uses sendMessage when the phone is reachable; falls back to
/// transferUserInfo for guaranteed delivery when it isn't.
class PhoneConnector: NSObject, ObservableObject, WCSessionDelegate {

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // ── Send a run to the iPhone ──────────────────────────────────
    func sendRun(_ run: CompletedRun) {
        guard WCSession.default.activationState == .activated else { return }

        let payload: [String: Any] = [
            "type":        "completedRun",
            "date":        run.date,
            "distance":    run.distance,
            "duration":    run.duration,
            "coordinates": run.coordinates,
        ]

        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil) { [weak self] _ in
                // Phone wasn't reachable despite isReachable — fall back
                self?.transfer(payload)
            }
        } else {
            transfer(payload)
        }
    }

    private func transfer(_ payload: [String: Any]) {
        WCSession.default.transferUserInfo(payload)
    }

    // ── WCSessionDelegate (required stubs) ────────────────────────
    func session(_ session: WCSession,
                 activationDidCompleteWith state: WCSessionActivationState,
                 error: Error?) {}
}
