import SwiftUI

@main
struct PacerWatchApp: App {
    @StateObject private var runManager     = RunManager()
    @StateObject private var phoneConnector = PhoneConnector()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(runManager)
                .environmentObject(phoneConnector)
        }
    }
}
