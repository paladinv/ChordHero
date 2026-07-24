import SwiftData
import SwiftUI

struct LibraryView: View {
    let content: AppContent
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var audio: SynthAudioService
    @EnvironmentObject private var midi: MIDIService
    @Query private var profiles: [StudentProfile]
    @Query private var allProgress: [ChordProgress]
    @Query private var customPacks: [CustomPracticePack]
    @State private var selectedID: String?
    @State private var search = ""
    @State private var root = "All"
    @State private var quality = "All"
    @State private var tag = "All"
    @State private var functionKey = "All"
    @State private var functionRole = "All"
    @State private var packID = "All"
    @State private var collection = "All"
    @State private var workspace = "Browse"
    @State private var compareIDs: [String] = []
    @State private var capo = 0
    @State private var tuningID = "standard"
    @State private var voice = "clean"
    @State private var timerTask: Task<Void, Never>?
    @State private var earTargetID: String?
    @State private var earPrompt = "chord"
    @State private var earOptions: [String] = []
    @State private var earResult = ""

    private var profile: StudentProfile? { profiles.first(where: \.isSelected) ?? profiles.first }
    private var progress: [ChordProgress] { guard let profile else { return [] }; return allProgress.filter { $0.profileID == profile.id } }
    private var roots: [String] { ["All"] + Set(content.chords.map(\.root)).sorted() }
    private var qualities: [String] { ["All"] + Set(content.chords.map(\.quality)).sorted() }
    private var tags: [String] { ["All"] + Set(content.chords.flatMap(\.difficultyTags)).sorted() }
    private var functionKeys: [String] { ["All"] + Set(content.chords.flatMap { $0.functionContexts.map(\.key) }).sorted() }
    private var functionRoles: [String] { ["All", "I", "ii", "iii", "IV", "V", "vi"] }
    private var allPacks: [(id: String, title: String, chordIDs: [String])] {
        content.progressionPacks.map { ($0.id, $0.title, $0.chordIds) } + customPacks.map { ($0.id.uuidString, $0.title, $0.chordIDs) }
    }
    private var filtered: [ChordLibraryItem] {
        var result = content.chords
        if root != "All" { result = result.filter { $0.root == root } }
        if quality != "All" { result = result.filter { $0.quality == quality } }
        if tag != "All" { result = result.filter { $0.difficultyTags.contains(tag) } }
        if functionKey != "All" { result = result.filter { $0.functionContexts.contains { $0.key == functionKey } } }
        if functionRole != "All" { result = result.filter { $0.functionContexts.contains { $0.roles.contains(functionRole) } } }
        if packID != "All", let pack = allPacks.first(where: { $0.id == packID }) { let ids = Set(pack.chordIDs); result = result.filter { ids.contains($0.id) } }
        if collection == "Favorites" { let ids = Set(progress.filter(\.isFavorite).map(\.chordID)); result = result.filter { ids.contains($0.id) } }
        if collection == "Recent" { let dates = Dictionary(uniqueKeysWithValues: progress.compactMap { item in item.lastViewedAt.map { (item.chordID, $0) } }); result = result.filter { dates[$0.id] != nil }.sorted { dates[$0.id]! > dates[$1.id]! }.prefix(8).map { $0 } }
        let term = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !term.isEmpty { result = result.filter { [$0.chord.name, $0.position, $0.summary, $0.qualityLabel, $0.practiceFocus].joined(separator: " ").lowercased().contains(term) } }
        return result
    }
    private var selected: ChordLibraryItem? { content.chordByID[selectedID ?? ""] ?? filtered.first }
    private var tuning: TuningDefinition { content.tunings.first(where: { $0.id == tuningID }) ?? content.tunings[0] }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 12) {
                StudioSectionHeader(title: "Find your shape", subtitle: "Search, filter, and save voicings", icon: "books.vertical")
                    .padding(.horizontal)
                Text("Interactive chord reference")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("ChordLibraryScreen")
                Picker("Workspace", selection: $workspace) { ForEach(["Browse", "Practice", "Compare"], id: \.self) { Text($0).tag($0) } }.pickerStyle(.segmented).padding(.horizontal)
                filterControls
                if filtered.isEmpty { ContentUnavailableView.search(text: search) }
                else { List(filtered, selection: $selectedID) { item in LibraryRow(item: item, favorite: progress.first(where: { $0.chordID == item.id })?.isFavorite == true).tag(item.id).listRowBackground(Color.clear) }.listStyle(.plain).scrollContentBackground(.hidden) }
            }
            .background { StudioBackground() }
            .navigationTitle("Chord Library")
            .navigationBarTitleDisplayMode(.inline)
        } detail: {
            if let selected {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("INTERACTIVE CHORD REFERENCE")
                            .font(.caption2.weight(.bold))
                            .tracking(1.4)
                            .foregroundStyle(ChordHeroStyle.accent)
                            .accessibilityIdentifier("ChordLibraryScreen")
                        Group { if workspace == "Practice" { practiceDetail(selected) } else if workspace == "Compare" { compareDetail(selected) } else { browseDetail(selected) } }
                    }
                    .padding(ChordHeroStyle.pagePadding)
                }
                    .studioScreenBackground()
                    .navigationTitle(selected.chord.name)
                    .navigationBarTitleDisplayMode(.inline)
                    .onAppear { markViewed(selected.id) }
                    .onChange(of: selected.id) { _, id in timerTask?.cancel(); markViewed(id) }
            } else { ContentUnavailableView("Choose a chord", systemImage: "guitars") }
        }
        .onAppear { if selectedID == nil { selectedID = filtered.first?.id } }
        .onDisappear { timerTask?.cancel(); audio.stop(); midi.disconnect() }
        .onChange(of: midi.lastPitchClass) { _, pitch in
            guard let pitch, let target = content.chordByID[earTargetID ?? ""] else { return }
            let notes = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
            let correct = notes.firstIndex(of: target.root) == pitch
            earResult = correct ? "Correct MIDI root" : "Try again; the root is \(target.root)"
        }
    }

    private var filterControls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search shapes and guidance", text: $search)
                if !search.isEmpty { Button { search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) } }
            }
            .padding(.horizontal, 13).frame(height: 42)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(Color.primary.opacity(0.08)) }
            .padding(.horizontal)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    menuPicker("Collection", value: $collection, values: ["All", "Favorites", "Recent"])
                    menuPicker("Root", value: $root, values: roots)
                    menuPicker("Quality", value: $quality, values: qualities)
                    menuPicker("Difficulty", value: $tag, values: tags)
                    menuPicker("Key", value: $functionKey, values: functionKeys)
                    menuPicker("Function", value: $functionRole, values: functionRoles)
                    menuPicker("Pack", value: $packID, values: ["All"] + allPacks.map(\.id), labels: Dictionary(uniqueKeysWithValues: allPacks.map { ($0.id, $0.title) }))
                }.padding(.horizontal)
            }
        }
    }

    private func menuPicker(_ title: String, value: Binding<String>, values: [String], labels: [String: String] = [:]) -> some View {
        Menu { Picker(title, selection: value) { ForEach(values, id: \.self) { Text(labels[$0] ?? $0).tag($0) } } } label: {
            Label(labels[value.wrappedValue] ?? value.wrappedValue, systemImage: value.wrappedValue == "All" ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                .font(.caption.weight(.semibold)).padding(.horizontal, 11).padding(.vertical, 8)
                .foregroundStyle(value.wrappedValue == "All" ? Color.secondary : ChordHeroStyle.accent)
                .background(value.wrappedValue == "All" ? Color.primary.opacity(0.06) : ChordHeroStyle.accent.opacity(0.12), in: Capsule())
        }
    }

    private func browseDetail(_ item: ChordLibraryItem) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            StudioCard {
                StudioEyebrow(text: item.difficultyTags.joined(separator: " · "))
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 20) { ChordDiagramView(chord: item.chord); chordSummary(item) }
                    VStack(alignment: .leading, spacing: 16) { ChordDiagramView(chord: item.chord); chordSummary(item) }
                }
                HStack { Button { preview(item.chord, .strum) } label: { Label("Play chord", systemImage: "play.fill") }; Button { preview(item.chord, .arpeggio) } label: { Label("Arpeggio", systemImage: "waveform") } }.buttonStyle(.bordered)
            }
            detailSection("Recommended fingering", lines: [item.recommendedVariant] + item.alternateFingerings)
            detailSection("Muting and common mistakes", lines: item.mutingNotes + item.avoidStrings)
            detailSection("Theory and function", lines: item.functionContexts.map { "\($0.key): \($0.roles.joined(separator: ", ")) — \($0.label)" })
            detailSection("Practice focus", lines: [item.practiceFocus])
            if !item.nearbyAlternatives.isEmpty {
                StudioCard { Text("Nearby alternatives").font(.headline); ForEach(item.nearbyAlternatives, id: \.label) { alternative in Button { if let id = alternative.targetId { clearFilters(); selectedID = id } } label: { VStack(alignment: .leading) { Text(alternative.label).bold(); Text(alternative.description).font(.caption).foregroundStyle(.secondary) } }.buttonStyle(.plain).disabled(alternative.targetId == nil); Divider() } }
            }
            instrumentControls(item)
        }
    }

    private func chordSummary(_ item: ChordLibraryItem) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(item.position).font(.title2.bold())
            Text(item.summary).foregroundStyle(.secondary)
            Button { toggleFavorite(item.id) } label: {
                Label(progress.first(where: { $0.chordID == item.id })?.isFavorite == true ? "Saved" : "Save chord", systemImage: progress.first(where: { $0.chordID == item.id })?.isFavorite == true ? "star.fill" : "star")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private func practiceDetail(_ item: ChordLibraryItem) -> some View {
        let current = progress.first(where: { $0.chordID == item.id })
        return VStack(alignment: .leading, spacing: 16) {
            HStack { ChordDiagramView(chord: item.chord); VStack(alignment: .leading) { Text(item.chord.name).font(.largeTitle.bold()); Text("\(current?.seconds ?? 0)s practiced"); Text("\(current?.repetitions ?? 0) repetitions · \(current?.misses ?? 0) misses"); Text("Strength \(current?.strength ?? 1)") } }
            StudioCard {
                HStack { Button(timerTask == nil ? "Start timer" : "Stop timer") { toggleTimer(item.id) }.buttonStyle(.borderedProminent); Button("Add repetition") { mutateProgress(item.id) { $0.repetitions += 1 } } }
                HStack { ForEach(ReviewRating.allCases) { rating in Button(rating.title) { review(item.id, rating) }.buttonStyle(.bordered) } }
                if let date = current?.nextReviewAt { Text("Next review: \(date.formatted(date: .abbreviated, time: .shortened))").font(.caption).foregroundStyle(.secondary) }
                TextField("Personal note", text: Binding(get: { current?.note ?? "" }, set: { value in mutateProgress(item.id) { $0.note = value } }), axis: .vertical).textFieldStyle(.roundedBorder)
                if let recommendation = recommendedChord(excluding: item.id) { Button("Recommended next: \(recommendation.chord.name)") { selectedID = recommendation.id }.font(.callout.bold()) }
            }
            StudioCard {
                Text("Ear training").font(.headline)
                HStack { Button("Name the chord") { startEarTraining(prompt: "chord") }; Button("Name the function") { startEarTraining(prompt: "function") }; Button("Replay") { if let target = content.chordByID[earTargetID ?? ""] { preview(target.chord, .strum) } } }.buttonStyle(.bordered)
                if earTargetID != nil { ForEach(earOptions, id: \.self) { option in Button(option) { answerEar(option) }.buttonStyle(.borderedProminent) }; if !earResult.isEmpty { Text(earResult).bold() } }
                Button("Connect MIDI") { midi.connect() }; Text(midi.status).font(.caption).foregroundStyle(.secondary)
            }
            dueReviews
        }
    }

    private func compareDetail(_ item: ChordLibraryItem) -> some View {
        let others = compareIDs.compactMap { content.chordByID[$0] }.filter { $0.id != item.id }.prefix(2)
        return VStack(alignment: .leading, spacing: 16) {
            Text("Compare up to three voicings").font(.title2.bold())
            ForEach(0..<2, id: \.self) { slot in Picker("Comparison \(slot + 1)", selection: Binding(get: { compareIDs.indices.contains(slot) ? compareIDs[slot] : "" }, set: { value in while compareIDs.count <= slot { compareIDs.append("") }; compareIDs[slot] = value })) { Text("None").tag(""); ForEach(content.chords.filter { $0.id != item.id }) { Text("\($0.chord.name) · \($0.position)").tag($0.id) } } }
            ScrollView(.horizontal) { HStack(alignment: .top) { ForEach([item] + others) { entry in VStack { Text(entry.chord.name).font(.title.bold()); Text(entry.position).font(.caption); ChordDiagramView(chord: entry.chord, compact: true); Text(entry.recommendedVariant).font(.caption).frame(width: 180) } } } }
            heatmap(primary: item, comparisons: Array(others))
            if let url = PDFService.make(title: "Chord comparison", items: [item] + others) { ShareLink(item: url) { Label("Share comparison PDF", systemImage: "square.and.arrow.up") }.buttonStyle(.borderedProminent) }
        }
    }

    private func instrumentControls(_ item: ChordLibraryItem) -> some View {
        StudioCard {
            Text("Sound and setup").font(.headline)
            Picker("Tuning", selection: $tuningID) { ForEach(content.tunings) { Text($0.label).tag($0.id) } }
            Picker("Voice", selection: $voice) { ForEach(content.sampleVoices, id: \.self) { Text($0.capitalized).tag($0) } }.pickerStyle(.segmented)
            HStack { Text("Capo \(capo)"); Slider(value: Binding(get: { Double(capo) }, set: { capo = Int($0) }), in: 0...7, step: 1) }
            Text("\(item.chord.name) sounds as \(PracticeRules.transpose(item.chord.name, semitones: capo)).").font(.caption).foregroundStyle(.secondary)
        }
    }

    private var dueReviews: some View {
        StudioCard { Text("Due reviews").font(.headline); let due = progress.filter { ($0.nextReviewAt ?? .distantFuture) <= .now }.prefix(6); if due.isEmpty { Text("Nothing due right now.").foregroundStyle(.secondary) } else { ForEach(Array(due), id: \.compoundID) { item in Button(content.chordByID[item.chordID]?.chord.name ?? item.chordID) { selectedID = item.chordID } } } }
    }

    private func detailSection(_ title: String, lines: [String]) -> some View { StudioCard { Text(title).font(.headline); ForEach(lines, id: \.self) { Label($0, systemImage: "checkmark.circle").font(.callout) } } }

    private func recommendedChord(excluding id: String) -> ChordLibraryItem? {
        if let due = progress.first(where: { ($0.nextReviewAt ?? .distantFuture) <= .now && $0.chordID != id }) { return content.chordByID[due.chordID] }
        let practiced = Set(progress.filter { $0.seconds >= 120 || $0.repetitions >= 8 }.map(\.chordID))
        return content.chords.first { $0.id != id && !practiced.contains($0.id) }
    }

    private func heatmap(primary: ChordLibraryItem, comparisons: [ChordLibraryItem]) -> some View {
        let primaryNotes = Set(noteNames(primary.chord)); let comparisonNotes = Set(comparisons.flatMap { noteNames($0.chord) })
        return StudioCard { Text("Shared-note heatmap · \(tuning.label)").font(.headline); LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 13), spacing: 3) { ForEach(0..<78, id: \.self) { cell in let string = cell / 13, fret = cell % 13, note = noteAt(open: tuning.strings[string], fret: fret); let shared = primaryNotes.contains(note) && comparisonNotes.contains(note); Text(fret == 0 ? tuning.strings[string] : note).font(.system(size: 8)).frame(maxWidth: .infinity, minHeight: 22).background(shared ? Color.green : primaryNotes.contains(note) ? Color.orange : comparisonNotes.contains(note) ? Color.blue : Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 3)).accessibilityLabel("\(tuning.strings[string]) string fret \(fret): \(note)") } } }
    }

    private func noteNames(_ chord: ChordDefinition) -> [String] { chord.frets.enumerated().compactMap { index, fret in fret < 0 ? nil : noteAt(open: tuning.strings[index], fret: fret) } }
    private func noteAt(open: String, fret: Int) -> String { let notes = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]; let index = notes.firstIndex(of: open) ?? 0; return notes[(index + fret) % 12] }
    private func preview(_ chord: ChordDefinition, _ mode: PreviewMode) { audio.play(chord: chord, mode: mode, voice: voice, capo: capo, tuningOffsets: tuning.semitoneOffsets) }

    private func mutateProgress(_ chordID: String, action: (ChordProgress) -> Void) { guard let profile else { return }; if let item = try? PersistenceCoordinator.progress(profileID: profile.id, chordID: chordID, in: context) { action(item); try? context.save() } }
    private func markViewed(_ id: String) { mutateProgress(id) { $0.lastViewedAt = .now } }
    private func toggleFavorite(_ id: String) { mutateProgress(id) { $0.isFavorite.toggle() } }
    private func review(_ id: String, _ rating: ReviewRating) { mutateProgress(id) { item in item.repetitions += 1; if rating == .again { item.misses += 1 }; item.strength = PracticeRules.nextStrength(current: item.strength, rating: rating); item.nextReviewAt = PracticeRules.nextReview(after: .now, rating: rating) } }
    private func toggleTimer(_ id: String) { if timerTask != nil { timerTask?.cancel(); timerTask = nil; return }; timerTask = Task { @MainActor in while !Task.isCancelled { try? await Task.sleep(for: .seconds(1)); guard !Task.isCancelled else { return }; mutateProgress(id) { $0.seconds += 1 } } } }
    private func clearFilters() { root = "All"; quality = "All"; tag = "All"; functionKey = "All"; functionRole = "All"; packID = "All"; collection = "All"; search = "" }

    private func startEarTraining(prompt: String) {
        guard let target = filtered.randomElement() ?? content.chords.randomElement() else { return }
        earTargetID = target.id; earPrompt = prompt
        let correct = prompt == "chord" ? target.chord.name : target.functionContexts.first?.roles.first ?? "I"
        let pool = prompt == "chord" ? content.chords.map { $0.chord.name } : functionRoles.filter { $0 != "All" }
        earOptions = Array(([correct] + pool.filter { $0 != correct }.shuffled().prefix(3)).uniqued()).shuffled(); earResult = ""; preview(target.chord, .strum)
    }
    private func answerEar(_ answer: String) { guard let target = content.chordByID[earTargetID ?? ""] else { return }; let correct = earPrompt == "chord" ? target.chord.name : target.functionContexts.first?.roles.first ?? "I"; earResult = answer == correct ? "Correct" : "Listen again: \(correct)" }
}

private struct LibraryRow: View {
    let item: ChordLibraryItem, favorite: Bool
    var body: some View {
        HStack(spacing: 12) {
            Text(item.chord.name.prefix(2)).font(.subheadline.bold()).foregroundStyle(ChordHeroStyle.accent)
                .frame(width: 40, height: 40).background(ChordHeroStyle.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 2) { Text(item.chord.name).font(.headline); Text(item.position).font(.caption).foregroundStyle(.secondary) }
            Spacer(); if favorite { Image(systemName: "star.fill").foregroundStyle(ChordHeroStyle.accent) }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
