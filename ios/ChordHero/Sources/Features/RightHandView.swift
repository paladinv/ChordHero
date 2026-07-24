import SwiftUI

struct RightHandView: View {
    let content: AppContent
    @EnvironmentObject private var audio: SynthAudioService
    @State private var technique = "strumming"
    @State private var difficulty = "beginner"
    @State private var selectedID = "strum-quarter-downs"
    @State private var bpm = 72
    @State private var playing = false
    @State private var activeStep = 0
    @State private var sound = true
    @State private var playbackTask: Task<Void, Never>?

    private var exercises: [RightHandExercise] { content.exercises.filter { $0.technique == technique && $0.difficulty == difficulty } }
    private var exercise: RightHandExercise? { exercises.first(where: { $0.id == selectedID }) ?? exercises.first }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                StudioSectionHeader(title: "Build your groove", subtitle: "Choose a technique, then lock in with the pulse", icon: "waveform.path")
                Picker("Technique", selection: $technique) {
                    ForEach(["strumming", "plectrum", "fingerpicking"], id: \.self) { key in Text(content.techniques[key]?.label ?? key.capitalized).tag(key) }
                }.pickerStyle(.segmented)
                Picker("Difficulty", selection: $difficulty) {
                    ForEach(["beginner", "intermediate", "expert"], id: \.self) { key in Text(content.difficulties[key]?.label ?? key.capitalized).tag(key) }
                }.pickerStyle(.segmented)
                if let exercise {
                    StudioCard {
                        HStack { VStack(alignment: .leading) { StudioEyebrow(text: content.difficulties[difficulty]?.label ?? difficulty); Text(exercise.title).font(.title.bold()); Text(exercise.focus).foregroundStyle(.secondary) }; Spacer(); Text("\(max(0, exercises.firstIndex(of: exercise) ?? 0) + 1) / \(exercises.count)").font(.subheadline.bold().monospacedDigit()).padding(.horizontal, 10).padding(.vertical, 6).background(.quaternary, in: Capsule()) }
                        VStack(spacing: 14) {
                            Text(stepDescription(exercise.pattern[activeStep]).main).font(.system(size: 72, weight: .black)).foregroundStyle(stepDescription(exercise.pattern[activeStep]).accent ? .orange : .primary)
                            Text(stepDescription(exercise.pattern[activeStep]).detail).foregroundStyle(.secondary)
                            ScrollView(.horizontal) {
                                HStack { ForEach(Array(exercise.pattern.enumerated()), id: \.offset) { index, step in VStack { Text(countLabel(index, exercise: exercise)).font(.caption.monospaced()); Text(stepDescription(step).main).font(.title2.bold()) }.frame(width: 55, height: 60).background(index == activeStep ? Color.orange.opacity(0.25) : Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10)) } }
                            }
                        }.frame(maxWidth: .infinity)
                        HStack { Button(playing ? "Pause" : "Start demo") { playing ? pause() : play(exercise) }.buttonStyle(.borderedProminent); Toggle("Sound", isOn: $sound).toggleStyle(.button) }
                        VStack { HStack { Text("Tempo"); Spacer(); Text("\(bpm) BPM").bold().monospacedDigit() }; Slider(value: Binding(get: { Double(bpm) }, set: { bpm = Int($0); if playing { play(exercise) } }), in: 40...180, step: 2); Button("Reset to \(exercise.bpm)") { bpm = exercise.bpm; if playing { play(exercise) } }.font(.caption) }
                        Label(exercise.coaching, systemImage: "info.circle").font(.callout).foregroundStyle(.secondary)
                        HStack { Button("Previous") { move(-1) }.disabled((exercises.firstIndex(of: exercise) ?? 0) == 0); Spacer(); Button("Next exercise") { move(1) }.disabled((exercises.firstIndex(of: exercise) ?? 0) >= exercises.count - 1) }
                    }
                    StudioCard {
                        StudioSectionHeader(title: "Exercise library", subtitle: "\(exercises.count) drills in this collection", icon: "list.bullet")
                        ForEach(exercises) { item in Button { select(item) } label: { HStack { VStack(alignment: .leading) { Text(item.title).bold(); Text(item.focus).font(.caption).foregroundStyle(.secondary) }; Spacer(); if item.id == exercise.id { Image(systemName: "checkmark.circle.fill").foregroundStyle(.orange) } } }.buttonStyle(.plain).padding(.vertical, 5); Divider() }
                    }
                }
            }.padding(ChordHeroStyle.pagePadding)
        }
        .studioScreenBackground()
        .navigationTitle("Right-Hand Studio")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: technique) { _, _ in resetFilter() }
        .onChange(of: difficulty) { _, _ in resetFilter() }
        .onDisappear { pause() }
    }

    private func select(_ item: RightHandExercise) { pause(); selectedID = item.id; bpm = item.bpm; activeStep = 0 }
    private func resetFilter() { if let first = exercises.first { select(first) } }
    private func move(_ delta: Int) { guard let exercise, let index = exercises.firstIndex(of: exercise) else { return }; let next = index + delta; if exercises.indices.contains(next) { select(exercises[next]) } }
    private func pause() { playing = false; playbackTask?.cancel(); audio.stop() }
    private func play(_ exercise: RightHandExercise) {
        playbackTask?.cancel(); playing = true
        playbackTask = Task { @MainActor in
            while !Task.isCancelled && playing {
                let step = stepDescription(exercise.pattern[activeStep]); if sound && !step.rest { audio.playClick(accent: step.accent) }
                let interval = 60.0 / Double(bpm) / Double(exercise.subdivisionsPerBeat)
                try? await Task.sleep(for: .seconds(interval))
                guard !Task.isCancelled else { return }
                activeStep = (activeStep + 1) % exercise.pattern.count
            }
        }
    }

    private func stepDescription(_ raw: String) -> (main: String, detail: String, accent: Bool, rest: Bool) {
        let accent = raw.hasSuffix("!"); let clean = raw.replacingOccurrences(of: "!", with: "")
        if clean == "·" { return ("—", "rest", accent, true) }
        if clean == "X" { return ("×", "mute", accent, false) }
        if technique == "strumming" { return (clean == "D" ? "↓" : "↑", clean == "D" ? "down" : "up", accent, false) }
        if technique == "plectrum", let string = clean.first { return (clean.hasSuffix("D") ? "↓" : "↑", "string \(string)", accent, false) }
        let strings = clean.filter(\.isNumber).map(String.init).joined(separator: " + ")
        return (String(clean.filter { !$0.isNumber && $0 != "+" }), strings.isEmpty ? "pinch" : "string \(strings)", accent, false)
    }

    private func countLabel(_ index: Int, exercise: RightHandExercise) -> String {
        switch exercise.subdivisionsPerBeat {
        case 2: index.isMultiple(of: 2) ? "\(index / 2 % 4 + 1)" : "&"
        case 3: ["\(index / 3 % 4 + 1)", "trip", "let"][index % 3]
        case 4: ["\(index / 4 % 4 + 1)", "e", "&", "a"][index % 4]
        default: "\(index % 4 + 1)"
        }
    }
}
