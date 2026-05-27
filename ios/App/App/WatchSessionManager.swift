import Capacitor
import WatchConnectivity

/**
 * Capacitor plugin that bridges Apple Watch → JavaScript.
 *
 * When the Watch sends a completed run, this plugin fires a
 * "watchRun" event to the JS layer, which saves it to Firestore
 * using the existing runStore.addRun() logic.
 */
@objc(WatchBridgePlugin)
public class WatchBridgePlugin: CAPPlugin, WCSessionDelegate {

    public override func load() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // ── Forward run data to JavaScript ────────────────────────────
    private func forwardRun(_ info: [String: Any]) {
        guard info["type"] as? String == "completedRun" else { return }
        notifyListeners("watchRun", data: [
            "date":        info["date"]        as? String    ?? "",
            "distance":    info["distance"]    as? Double    ?? 0,
            "duration":    info["duration"]    as? Double    ?? 0,
            "coordinates": info["coordinates"] as? [[Double]] ?? [],
        ])
    }

    // ── WCSessionDelegate ─────────────────────────────────────────

    // Immediate delivery (phone was reachable)
    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        forwardRun(message)
    }

    // Guaranteed delivery (phone was not reachable when Watch sent)
    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        forwardRun(userInfo)
    }

    public func session(_ session: WCSession,
                        activationDidCompleteWith state: WCSessionActivationState,
                        error: Error?) {}

    public func sessionDidBecomeInactive(_ session: WCSession) {}

    public func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }
}
