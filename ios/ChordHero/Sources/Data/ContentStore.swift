import Foundation

protocol ContentRepository: Sendable {
    func load() throws -> AppContent
}

struct AppContent: Sendable {
    let chords: [ChordLibraryItem]
    let levels: [LevelDefinition]
    let progressionPacks: [ProgressionPack]
    let exercises: [RightHandExercise]
    let techniques: [String: TechniqueDetail]
    let difficulties: [String: DifficultyDetail]
    let songs: [SongDefinition]
    let chordTips: [String: ChordTip]
    let tunings: [TuningDefinition]
    let sampleVoices: [String]
    let rightHandPatterns: [String]

    var chordByID: [String: ChordLibraryItem] { Dictionary(uniqueKeysWithValues: chords.map { ($0.id, $0) }) }
    var chordByName: [String: ChordDefinition] {
        Dictionary(chords.map { ($0.chord.name, $0.chord) }, uniquingKeysWith: { first, _ in first })
    }
}

struct BundleContentRepository: ContentRepository {
    let bundle: Bundle

    init(bundle: Bundle = .main) { self.bundle = bundle }

    func load() throws -> AppContent {
        let chords: ChordDocument = try decode("chords")
        let rightHand: RightHandDocument = try decode("right-hand")
        let songs: SongDocument = try decode("songs")
        let settings: SettingsDocument = try decode("settings")
        for (name, version) in [("chords", chords.schemaVersion), ("right-hand", rightHand.schemaVersion), ("songs", songs.schemaVersion), ("settings", settings.schemaVersion)] where version != (name == "songs" ? 2 : 1) {
            throw SharedContentError.unsupportedSchema(name, version)
        }
        try validate(chords: chords, exercises: rightHand.exercises, songs: songs)
        return AppContent(
            chords: chords.chordLibrary,
            levels: chords.levels,
            progressionPacks: chords.progressionPacks,
            exercises: rightHand.exercises,
            techniques: rightHand.techniques,
            difficulties: rightHand.difficulties,
            songs: songs.songs,
            chordTips: songs.chordTips,
            tunings: settings.tunings,
            sampleVoices: settings.sampleVoices,
            rightHandPatterns: settings.rightHandPatterns
        )
    }

    private func decode<T: Decodable>(_ name: String) throws -> T {
        guard let url = bundle.url(forResource: name, withExtension: "json") else { throw SharedContentError.missingResource(name) }
        return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
    }

    private func validate(chords: ChordDocument, exercises: [RightHandExercise], songs: SongDocument) throws {
        let ids = Set(chords.chordLibrary.map(\.id))
        guard ids.count == chords.chordLibrary.count else { throw SharedContentError.invalidContent("Chord identifiers must be unique.") }
        guard chords.chordLibrary.allSatisfy({ $0.chord.frets.count == 6 && $0.chord.fingers.count == 6 }) else {
            throw SharedContentError.invalidContent("Every chord must describe six strings.")
        }
        let references = chords.levels.flatMap(\.chordIds) + chords.progressionPacks.flatMap(\.chordIds)
        guard references.allSatisfy(ids.contains) else { throw SharedContentError.invalidContent("A level or progression references an unknown chord.") }
        guard Set(exercises.map(\.id)).count == exercises.count else { throw SharedContentError.invalidContent("Exercise identifiers must be unique.") }
        guard Set(songs.songs.map(\.id)).count == songs.songs.count, songs.songs.count == 50 else {
            throw SharedContentError.invalidContent("Song identifiers must be unique and the bundled catalogue must contain 50 songs.")
        }
    }
}

@MainActor
final class ContentStore: ObservableObject {
    @Published private(set) var content: AppContent?
    @Published private(set) var errorMessage: String?

    init(repository: any ContentRepository = BundleContentRepository()) {
        do { content = try repository.load() }
        catch { errorMessage = error.localizedDescription }
    }
}
