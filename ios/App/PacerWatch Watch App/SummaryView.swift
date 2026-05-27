import SwiftUI

struct SummaryView: View {
    let run: CompletedRun
    @EnvironmentObject var runManager:     RunManager
    @EnvironmentObject var phoneConnector: PhoneConnector
    @State private var synced = false

    private let accent = Color(red: 0.784, green: 0.941, blue: 0)

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {

                // ── Header ────────────────────────────────────────
                Text("RUN SAVED")
                    .font(.system(size: 12, weight: .black))
                    .foregroundColor(accent)
                    .tracking(2)

                // ── Stats card ────────────────────────────────────
                VStack(spacing: 8) {
                    statRow("DISTANCE", value: String(format: "%.2f mi", run.distance / 1609.344))
                    statRow("TIME",     value: formattedDuration(run.duration))
                    if run.distance > 0 && run.duration > 0 {
                        let pacePerMile = (run.duration / 60_000) / (run.distance / 1609.344)
                        let min = Int(pacePerMile)
                        let sec = Int((pacePerMile - Double(min)) * 60)
                        statRow("PACE", value: String(format: "%d:%02d /mi", min, sec))
                    }
                }
                .padding(10)
                .background(Color.white.opacity(0.08))
                .cornerRadius(12)

                // ── Sync status ───────────────────────────────────
                if synced {
                    Label("Synced to iPhone", systemImage: "checkmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                } else {
                    Text("Syncing to iPhone…")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                }

                // ── Done button ───────────────────────────────────
                Button("Done") { runManager.reset() }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(accent)
                    .cornerRadius(20)
                    .buttonStyle(.plain)
            }
            .padding()
        }
        .onAppear {
            phoneConnector.sendRun(run)
            // Show synced indicator after a brief delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                synced = true
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private func statRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.gray)
                .tracking(1)
            Spacer()
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
        }
    }

    private func formattedDuration(_ ms: Double) -> String {
        let s = Int(ms / 1000)
        let h = s / 3600
        let m = (s % 3600) / 60
        let sec = s % 60
        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, sec)
            : String(format: "%02d:%02d", m, sec)
    }
}
