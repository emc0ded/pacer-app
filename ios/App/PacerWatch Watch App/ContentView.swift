import SwiftUI

// ── Root router — switches between idle, active run, and summary ──
struct ContentView: View {
    @EnvironmentObject var runManager:     RunManager
    @EnvironmentObject var phoneConnector: PhoneConnector

    var body: some View {
        switch runManager.state {
        case .idle:
            IdleView()
        case .running:
            ActiveRunView()
        case .completed(let run):
            SummaryView(run: run)
        }
    }
}

// ── Idle screen ───────────────────────────────────────────────────
struct IdleView: View {
    @EnvironmentObject var runManager: RunManager

    // Accent yellow-green matching the iOS app
    private let accent = Color(red: 0.784, green: 0.941, blue: 0)

    var body: some View {
        VStack(spacing: 10) {
            Text("PACER")
                .font(.system(size: 13, weight: .black))
                .foregroundColor(accent)
                .tracking(4)

            Spacer()

            Button(action: { runManager.startRun() }) {
                Label("START RUN", systemImage: "play.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(accent)
                    .cornerRadius(22)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .onAppear { runManager.requestPermissions() }
    }
}
