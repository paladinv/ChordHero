import SwiftUI

struct TrainerView: View {
    let content: AppContent
    @EnvironmentObject private var audio: SynthAudioService
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var state = TrainerState()
    @State private var automatic = true
    @State private var levelIndex = 0
    @State private var manualLevelIndex = 0
    @State private var selectedHistoryID: String?
    @State private var metronome = true
    @State private var timerTask: Task<Void, Never>?
    @State private var flash = false

    private var activeLevelIndex: Int { automatic ? levelIndex : manualLevelIndex }
    private var level: LevelDefinition { content.levels[activeLevelIndex.clamped(to: content.levels.indices)] }
    private var current: ChordLibraryItem? { state.currentIndex >= 0 ? content.chordByID[state.chordIDs[state.currentIndex]] : nil }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                StudioCard {
                    StudioSectionHeader(title: "Active round", subtitle: "Stay relaxed and land each shape cleanly", icon: "timer")
                    HStack(alignment: .top) {
                        VStack(alignment: .leading) { StudioEyebrow(text: automatic ? "Level \(levelIndex + 1)" : "Manual"); Text(level.name).font(.headline); Text(level.description).font(.subheadline).foregroundStyle(.secondary) }
                        Spacer(); Text("\(state.chordIDs.count)/\(PracticeRules.trainerChordCount)").font(.headline.monospacedDigit())
                    }
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 22) { currentChord; chordVisual }
                        VStack(spacing: 18) { currentChord.frame(maxWidth: .infinity, alignment: .leading); chordVisual }
                    }
                    .scaleEffect(flash && !reduceMotion ? 1.025 : 1)
                    .animation(.spring(response: 0.25), value: flash)
                    controls
                    Picker("Difficulty mode", selection: $automatic) { Text("Auto-advance").tag(true); Text("Choose level").tag(false) }.pickerStyle(.segmented)
                    if !automatic { Picker("Level", selection: $manualLevelIndex) { ForEach(content.levels.indices, id: \.self) { Text(content.levels[$0].name).tag($0) } } }
                }
                StudioCard {
                    StudioSectionHeader(title: "Chord history", subtitle: "Review every shape from this round", icon: "clock.arrow.circlepath")
                    if state.chordIDs.isEmpty { ContentUnavailableView("No chords yet", systemImage: "clock.arrow.circlepath", description: Text("Start a round to build your review history.")) }
                    else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 88))]) {
                            ForEach(Array(state.chordIDs.enumerated()), id: \.offset) { index, id in
                                Button { selectedHistoryID = id } label: { VStack { Text(String(format: "%02d", index + 1)).font(.caption.monospaced()); Text(content.chordByID[id]?.chord.name ?? "?").font(.headline) }.frame(maxWidth: .infinity).padding(10) }
                                    .buttonStyle(.bordered).tint(selectedHistoryID == id ? ChordHeroStyle.accent : .secondary)
                            }
                        }
                    }
                    if let id = selectedHistoryID, let chord = content.chordByID[id]?.chord { Divider(); HStack { ChordDiagramView(chord: chord, compact: true); VStack(alignment: .leading) { Text(chord.name).font(.title.bold()); Text("Double-check the fingering before the next round.").foregroundStyle(.secondary) } } }
                }
            }.padding(ChordHeroStyle.pagePadding)
        }
        .studioScreenBackground()
        .navigationTitle("Trainer")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { timerTask?.cancel(); audio.stop() }
        .alert("Level complete", isPresented: Binding(get: { state.status == .complete }, set: { if !$0 { state.status = .idle } })) {
            Button("Advance level") { continueRound() }; Button("Stop here", role: .cancel) { reset() }
        } message: { Text("You completed ten chord switches.") }
    }

    private var currentChord: some View {
                        VStack(alignment: .leading) { Text("NOW PLAYING").font(.caption.bold()).foregroundStyle(.secondary); Text(current?.chord.name ?? "Press start").font(.system(size: 48, weight: .black)); Text(state.status == .running ? "Next chord in \(state.secondsRemaining)s" : statusLabel) }
    }

    @ViewBuilder private var chordVisual: some View {
        if let chord = current?.chord { ChordDiagramView(chord: chord) }
        else {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.primary.opacity(0.05))
                .frame(width: 210, height: 240)
                .overlay { Image(systemName: "guitars").font(.largeTitle).foregroundStyle(.tertiary) }
        }
    }

    private var statusLabel: String { state.status == .paused ? "Paused" : state.status == .complete ? "Complete" : "Timer ready" }

    private var controls: some View {
        ViewThatFits {
            HStack { controlButtons }
            VStack { controlButtons }
        }.buttonStyle(.bordered)
    }

    @ViewBuilder private var controlButtons: some View {
        Button("Start") { start() }.buttonStyle(.borderedProminent).disabled(state.status == .running)
        Button("Pause") { pause() }.disabled(state.status != .running)
        Button("Resume") { resume() }.disabled(state.status != .paused)
        Button("Reset", role: .destructive) { reset() }
        Toggle("Metronome", isOn: $metronome).toggleStyle(.button)
    }

    private func start() { reset(); state.status = .running; advance(); schedule() }
    private func pause() { state.status = .paused; timerTask?.cancel(); audio.stop() }
    private func resume() { state.status = .running; schedule() }
    private func reset() { timerTask?.cancel(); audio.stop(); state.reset(); selectedHistoryID = nil; flash = false }

    private func schedule() {
        timerTask?.cancel()
        timerTask = Task { @MainActor in
            while !Task.isCancelled && state.status == .running {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled, state.status == .running else { return }
                state.secondsRemaining -= 1
                if metronome { audio.playClick(accent: state.secondsRemaining <= 1) }
                if state.secondsRemaining <= 0 { advance() }
            }
        }
    }

    private func advance() {
        guard state.chordIDs.count < PracticeRules.trainerChordCount else { return }
        let candidates = level.chordIds.filter { $0 != state.chordIDs.last }
        guard let next = (candidates.isEmpty ? level.chordIds : candidates).randomElement() else { return }
        state.append(chordID: next)
        flash.toggle()
        if metronome { audio.playClick(accent: true) }
        if state.status == .complete { timerTask?.cancel() }
    }

    private func continueRound() {
        if automatic { levelIndex = min(levelIndex + 1, content.levels.count - 1) }
        else { levelIndex = manualLevelIndex }
        start()
    }
}

extension Comparable {
    func clamped(to limits: ClosedRange<Self>) -> Self { Swift.min(Swift.max(self, limits.lowerBound), limits.upperBound) }
}

extension Int {
    func clamped(to range: Range<Int>) -> Int { Swift.min(Swift.max(self, range.lowerBound), Swift.max(range.lowerBound, range.upperBound - 1)) }
}
