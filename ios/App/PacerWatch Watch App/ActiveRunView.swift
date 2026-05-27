import SwiftUI

struct ActiveRunView: View {
    @EnvironmentObject var runManager: RunManager
    @State private var showStopConfirm = false

    private let accent = Color(red: 0.784, green: 0.941, blue: 0)

    var body: some View {
        VStack(spacing: 6) {

            // ── Elapsed time ──────────────────────────────────────
            Text(formattedTime(runManager.elapsedSeconds))
                .font(.system(size: 38, weight: .black, design: .monospaced))
                .foregroundColor(runManager.isPaused ? .gray : .white)
                .minimumScaleFactor(0.5)
                .lineLimit(1)

            // ── Distance ──────────────────────────────────────────
            HStack(alignment: .lastTextBaseline, spacing: 3) {
                Text(String(format: "%.2f", runManager.distanceMeters / 1609.344))
                    .font(.system(size: 26, weight: .bold))
                    .foregroundColor(accent)
                Text("MI")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.gray)
            }

            // ── Pace ──────────────────────────────────────────────
            if let pace = runManager.paceMinPerMile {
                let min = Int(pace)
                let sec = Int((pace - Double(min)) * 60)
                Text(String(format: "%d:%02d /mi", min, sec))
                    .font(.system(size: 13, weight: .medium, design: .monospaced))
                    .foregroundColor(.gray)
            } else {
                Text("—:— /mi")
                    .font(.system(size: 13, weight: .medium, design: .monospaced))
                    .foregroundColor(.gray)
            }

            // ── Paused label ──────────────────────────────────────
            if runManager.isPaused {
                Text("PAUSED")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.orange)
                    .tracking(2)
            }

            Spacer()

            // ── Controls ──────────────────────────────────────────
            HStack(spacing: 16) {

                // Pause / Resume
                Button(action: {
                    if runManager.isPaused {
                        runManager.resumeRun()
                    } else {
                        runManager.pauseRun()
                    }
                }) {
                    Image(systemName: runManager.isPaused ? "play.fill" : "pause.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.black)
                        .frame(width: 44, height: 44)
                        .background(runManager.isPaused ? accent : Color.white.opacity(0.8))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)

                // Stop
                Button(action: { showStopConfirm = true }) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.black)
                        .frame(width: 44, height: 44)
                        .background(Color.red.opacity(0.85))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
        .confirmationDialog("End this run?", isPresented: $showStopConfirm) {
            Button("End Run", role: .destructive) { runManager.stopRun() }
            Button("Cancel",  role: .cancel)      {}
        }
    }

    private func formattedTime(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%02d:%02d", m, s)
    }
}
