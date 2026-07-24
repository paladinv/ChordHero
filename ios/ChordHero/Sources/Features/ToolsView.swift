import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct ToolsView: View {
    let content: AppContent
    @Environment(\.modelContext) private var context
    @Query(sort: \StudentProfile.createdAt) private var profiles: [StudentProfile]
    @Query(sort: \CustomPracticePack.createdAt, order: .reverse) private var packs: [CustomPracticePack]
    @State private var profileName = ""
    @State private var packName = "My practice pack"
    @State private var selectedChordIDs = Set<String>()
    @State private var pattern = ""
    @State private var teacherKey = "G"
    @State private var teacherSkill = "beginner"
    @State private var teacherPackID = "All"
    @State private var importing = false
    @State private var alertMessage: String?
    @State private var exportURL: URL?

    private var teacherItems: [ChordLibraryItem] {
        var source = content.chords.filter { $0.functionContexts.contains { $0.key == teacherKey } }
        if teacherSkill != "All" { source = source.filter { $0.difficultyTags.contains(teacherSkill) } }
        if teacherPackID != "All" {
            let ids: Set<String>
            if let builtIn = content.progressionPacks.first(where: { $0.id == teacherPackID }) { ids = Set(builtIn.chordIds) }
            else if let custom = packs.first(where: { $0.id.uuidString == teacherPackID }) { ids = Set(custom.chordIDs) }
            else { ids = [] }
            source = source.filter { ids.contains($0.id) }
        }
        return Array(source.prefix(9))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    StudioSectionHeader(title: "Practice workspace", subtitle: "Profiles, custom packs, and teacher resources", icon: "slider.horizontal.3")
                        .listRowBackground(Color.clear)
                }
                Section("Student profiles") {
                    ForEach(profiles) { profile in Button { select(profile) } label: { HStack { Text(profile.name); Spacer(); if profile.isSelected { Image(systemName: "checkmark.circle.fill").foregroundStyle(.orange) } } } }
                    HStack { TextField("Student name", text: $profileName); Button("Create") { createProfile() }.disabled(profileName.trimmingCharacters(in: .whitespaces).isEmpty) }
                }
                Section("Progression packs") {
                    ForEach(content.progressionPacks) { pack in VStack(alignment: .leading) { Text(pack.title).bold(); Text("\(pack.keyCenter) · \(pack.progression.joined(separator: " · "))").font(.caption).foregroundStyle(.secondary) } }
                    ForEach(packs) { pack in VStack(alignment: .leading) { Text(pack.title).bold(); Text(pack.chordIDs.compactMap { content.chordByID[$0]?.chord.name }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary) } }
                    DisclosureGroup("Create a custom pack") {
                        TextField("Pack name", text: $packName)
                        Picker("Pattern", selection: $pattern) { ForEach(content.rightHandPatterns, id: \.self) { Text($0).tag($0) } }
                        NavigationLink("Choose chords (\(selectedChordIDs.count)/10)") { PackChordPicker(content: content, selection: $selectedChordIDs) }
                        Button("Save custom pack") { savePack() }.disabled(selectedChordIDs.isEmpty)
                    }
                    HStack {
                        Button("Import packs") { importing = true }
                        if let exportURL { ShareLink(item: exportURL) { Label("Export packs", systemImage: "square.and.arrow.up") } }
                        else { Button("Prepare export") { exportURL = makePackExport() }.disabled(packs.isEmpty) }
                    }
                }
                Section("Teacher sheet") {
                    Picker("Key", selection: $teacherKey) { ForEach(Set(content.chords.flatMap { $0.functionContexts.map(\.key) }).sorted(), id: \.self) { Text($0).tag($0) } }
                    Picker("Skill", selection: $teacherSkill) { Text("All skills").tag("All"); ForEach(Set(content.chords.flatMap(\.difficultyTags)).sorted(), id: \.self) { Text($0.capitalized).tag($0) } }
                    Picker("Pack", selection: $teacherPackID) {
                        Text("No pack filter").tag("All")
                        ForEach(content.progressionPacks) { Text($0.title).tag($0.id) }
                        ForEach(packs) { Text($0.title).tag($0.id.uuidString) }
                    }
                    Text("\(teacherItems.count) chords will be included.").foregroundStyle(.secondary)
                    NavigationLink("Preview teacher sheet") { TeacherSheetPreview(items: teacherItems) }
                    if let url = PDFService.make(title: "Chord Hero Teacher Sheet", items: teacherItems) { ShareLink(item: url) { Label("Print or share PDF", systemImage: "printer") } }
                }
                Section("Project") {
                    NavigationLink("About Chord Hero") { AboutView() }
                }
            }
            .studioScreenBackground()
            .navigationTitle("Tools")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { if pattern.isEmpty { pattern = content.rightHandPatterns.first ?? "Down, down-up, up-down-up" }; exportURL = makePackExport() }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json], allowsMultipleSelection: false) { result in importPacks(result) }
            .alert("Chord Hero", isPresented: Binding(get: { alertMessage != nil }, set: { if !$0 { alertMessage = nil } })) { Button("OK", role: .cancel) {} } message: { Text(alertMessage ?? "") }
        }
    }

    private func select(_ target: StudentProfile) { for profile in profiles { profile.isSelected = profile.id == target.id; profile.updatedAt = .now }; try? context.save() }
    private func createProfile() { let profile = StudentProfile(name: profileName.trimmingCharacters(in: .whitespaces), isSelected: true); for item in profiles { item.isSelected = false }; context.insert(profile); try? context.save(); profileName = "" }
    private func savePack() { context.insert(CustomPracticePack(title: packName.trimmingCharacters(in: .whitespaces).isEmpty ? "Custom practice pack" : packName, description: "A saved practice set made on iOS.", keyCenter: content.chordByID[selectedChordIDs.first ?? ""]?.root ?? "C", focus: "Custom chord practice.", rightHandPattern: pattern, chordIDs: Array(selectedChordIDs))); try? context.save(); selectedChordIDs.removeAll(); exportURL = makePackExport() }

    private func makePackExport() -> URL? {
        let values = packs.map { LegacyPack(id: "custom-\($0.id.uuidString)", title: $0.title, description: $0.packDescription, keyCenter: $0.keyCenter, focus: $0.focus, chordIds: $0.chordIDs, progression: $0.chordIDs.compactMap { content.chordByID[$0]?.chord.name }, rightHandPattern: $0.rightHandPattern, custom: true) }
        guard let data = try? JSONEncoder.pretty.encode(values) else { return nil }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("chord-hero-teacher-packs.json")
        do { try data.write(to: url, options: .atomic); return url } catch { return nil }
    }

    private func importPacks(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            let accessing = url.startAccessingSecurityScopedResource(); defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            let data = try Data(contentsOf: url)
            let decoded: [LegacyPack]
            if let raw = try? JSONDecoder().decode([LegacyPack].self, from: data) { decoded = raw }
            else { decoded = try JSONDecoder().decode(PackEnvelope.self, from: data).packs }
            guard !decoded.isEmpty, decoded.allSatisfy({ !$0.title.isEmpty && !$0.chordIds.isEmpty && $0.chordIds.allSatisfy(content.chordByID.keys.contains) }) else { throw SharedContentError.invalidContent("The file does not contain valid Chord Hero packs.") }
            for pack in decoded { context.insert(CustomPracticePack(title: pack.title, description: pack.description, keyCenter: pack.keyCenter, focus: pack.focus, rightHandPattern: pack.rightHandPattern, chordIDs: pack.chordIds)) }
            try context.save(); alertMessage = "Imported \(decoded.count) pack\(decoded.count == 1 ? "" : "s")."; exportURL = makePackExport()
        } catch { alertMessage = "Import failed: \(error.localizedDescription)" }
    }
}

private struct LegacyPack: Codable {
    let id: String, title: String, description: String, keyCenter: String, focus: String
    let chordIds: [String], progression: [String]
    let rightHandPattern: String
    let custom: Bool?
}
private struct PackEnvelope: Codable { let schemaVersion: Int; let packs: [LegacyPack] }
private extension JSONEncoder { static var pretty: JSONEncoder { let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; return encoder } }

private struct PackChordPicker: View {
    let content: AppContent
    @Binding var selection: Set<String>
    @State private var search = ""
    var body: some View { List { TextField("Search chords", text: $search); ForEach(content.chords.filter { search.isEmpty || $0.chord.name.localizedCaseInsensitiveContains(search) }) { item in Button { if selection.contains(item.id) { selection.remove(item.id) } else if selection.count < 10 { selection.insert(item.id) } } label: { HStack { Text("\(item.chord.name) · \(item.position)"); Spacer(); if selection.contains(item.id) { Image(systemName: "checkmark.circle.fill").foregroundStyle(.orange) } } } } }.navigationTitle("Choose chords") }
}

private struct TeacherSheetPreview: View {
    let items: [ChordLibraryItem]
    var body: some View { ScrollView { LazyVGrid(columns: [GridItem(.adaptive(minimum: 220))]) { ForEach(items) { item in StudioCard { Text(item.chord.name).font(.title.bold()); ChordDiagramView(chord: item.chord, compact: true); Text(item.practiceFocus).font(.caption) } } }.padding() }.navigationTitle("Teacher Sheet") }
}

struct AboutView: View {
    var body: some View { List { Section("Purpose") { Text("Chord Hero is a focused guitar practice toolkit for chord changes, rhythm, songs, ear training, and voicing study.") }; Section("Practice philosophy") { Text("Start slowly, keep the hands relaxed, and raise the tempo only after clean repetitions.") }; Section("License") { Text("GNU General Public License v3.0. You may share and adapt this project under the GPL-3.0 terms.") } }.navigationTitle("About") }
}
