import SwiftUI

struct SongCoachView: View {
    let content: AppContent
    let initialSongID: String?
    let initialVariationID: String?
    @EnvironmentObject private var audio: SynthAudioService
    @State private var songIndex = 0
    @State private var state = SongPlaybackState()
    @State private var bpm = 80
    @State private var beatsPerChord = 4
    @State private var metronome = true
    @State private var task: Task<Void, Never>?
    @State private var variationID: String?

    init(content: AppContent, initialSongID: String? = nil, initialVariationID: String? = nil) {
        self.content = content
        self.initialSongID = initialSongID
        self.initialVariationID = initialVariationID
    }

    private var song: SongDefinition { content.songs[songIndex] }
    private var variation: SongVariation? { song.variations.first(where: { $0.id == variationID }) ?? song.variations.first }
    private var chordName: String { song.chords[min(state.chordIndex, song.chords.count - 1)] }
    private var chord: ChordDefinition? { content.chordByName[chordName] }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                StudioSectionHeader(title: "Play real progressions", subtitle: "Follow the changes and keep the rhythm moving", icon: "music.note.list")
                StudioCard {
                    Picker("Song", selection: $songIndex) { ForEach(content.songs.indices, id: \.self) { Text("\(content.songs[$0].title) — \(content.songs[$0].difficulty)").tag($0) } }
                    Text(song.source).font(.caption).foregroundStyle(.secondary)
                    Picker("Arrangement", selection: Binding(get: { variation?.id ?? "" }, set: { value in variationID = value; bpm = song.variations.first(where: { $0.id == value })?.bpm ?? song.bpm })) { ForEach(song.variations) { Text("($0.name) · ($0.technique)").tag($0.id) } }
                    HStack { VStack(alignment: .leading) { Text("Tempo: \(bpm) BPM").bold(); Slider(value: Binding(get: { Double(bpm) }, set: { bpm = Int($0); restartTimerIfNeeded() }), in: 60...140, step: 2) }; Picker("Beats", selection: $beatsPerChord) { Text("2 beats").tag(2); Text("4 beats").tag(4); Text("6 beats").tag(6) }.pickerStyle(.segmented) }
                    HStack { Button("Start lesson") { start() }.buttonStyle(.borderedProminent); Button("Pause") { pause() }.disabled(state.status != .running && state.status != .countIn); Button("Resume") { resume() }.disabled(state.status != .paused); Button("Reset", role: .destructive) { reset() }; Toggle("Metronome", isOn: $metronome).toggleStyle(.button) }.buttonStyle(.bordered)
                    HStack { VStack(alignment: .leading) { Text("Right-hand pattern").font(.caption.bold()); Text(variation?.pattern ?? song.strumPattern).font(.title3.monospaced()); Text(variation?.feel ?? song.strumFeel).foregroundStyle(.secondary) }; Spacer() }
                }
                StudioCard {
                    StudioEyebrow(text: state.status == .running ? "Now playing" : "Current chord")
                    if state.status == .countIn { Text("Starting in \(state.countIn)…").font(.largeTitle.bold()).foregroundStyle(.orange) }
                    Text(chordName).font(.system(size: 52, weight: .black))
                    Text("Step \(state.chordIndex + 1) of \(song.chords.count) · Beat \(state.beat + 1) of \(beatsPerChord)").monospacedDigit().foregroundStyle(.secondary)
                    if let chord { ChordDiagramView(chord: chord) }
                    if let tip = content.chordTips[chordName] {
                        VStack(alignment: .leading, spacing: 7) { Label(tip.fingering, systemImage: "hand.point.up.left"); Label(tip.transition, systemImage: "arrow.left.arrow.right"); Label(tip.commonMistake, systemImage: "exclamationmark.triangle") }.font(.callout)
                    }
                    ScrollView(.horizontal) { HStack { ForEach(Array(song.chords.enumerated()), id: \.offset) { index, name in Text(name).bold().padding(.horizontal, 12).padding(.vertical, 8).background(index == state.chordIndex ? Color.orange : Color.secondary.opacity(0.12), in: Capsule()).foregroundStyle(index == state.chordIndex ? .white : .primary) } } }
                }
            }.padding(ChordHeroStyle.pagePadding)
        }
        .studioScreenBackground()
        .navigationTitle("Song Coach")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let initialSongID, let index = content.songs.firstIndex(where: { $0.id == initialSongID }) { songIndex = index }
            variationID = initialVariationID ?? content.songs[songIndex].variations.first?.id
            bpm = variation?.bpm ?? song.bpm
        }
        .onChange(of: songIndex) { _, _ in reset(); variationID = song.variations.first?.id; bpm = variation?.bpm ?? song.bpm }
        .onDisappear { reset() }
        .alert("Progression complete", isPresented: Binding(get: { state.status == .complete }, set: { if !$0 { state.status = .paused } })) { Button("Play again") { start() }; Button("Done", role: .cancel) { state.status = .paused } }
    }

    private func start() { reset(); bpm = bpm.clamped(to: 60...140); state.status = .countIn; schedule() }
    private func pause() { state.status = .paused; task?.cancel(); audio.stop() }
    private func resume() { state.status = .running; schedule() }
    private func reset() { task?.cancel(); audio.stop(); state = SongPlaybackState() }
    private func restartTimerIfNeeded() { if state.status == .running || state.status == .countIn { schedule() } }
    private func schedule() {
        task?.cancel()
        task = Task { @MainActor in
            while !Task.isCancelled && (state.status == .running || state.status == .countIn) {
                if metronome { audio.playClick(accent: state.beat == 0) }
                try? await Task.sleep(for: .seconds(60.0 / Double(bpm)))
                guard !Task.isCancelled else { return }
                state.tick(chordCount: song.chords.count, beatsPerChord: beatsPerChord)
                if state.status == .complete { return }
            }
        }
    }
}
