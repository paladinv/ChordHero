import Foundation

struct ChordDocument: Codable, Sendable {
    let schemaVersion: Int
    let chordLibrary: [ChordLibraryItem]
    let levels: [LevelDefinition]
    let progressionPacks: [ProgressionPack]
}

struct ChordDefinition: Codable, Hashable, Sendable {
    let name: String
    let frets: [Int]
    let barre: BarreDefinition?
    let fingers: [Int?]
}

struct BarreDefinition: Codable, Hashable, Sendable {
    let fret: Int
    let from: Int
    let to: Int
}

struct ChordLibraryItem: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let root: String
    let quality: String
    let qualityLabel: String
    let inversion: String
    let position: String
    let chord: ChordDefinition
    let difficultyTags: [String]
    let summary: String
    let recommendedVariant: String
    let alternateFingerings: [String]
    let functionContexts: [FunctionContext]
    let mutingNotes: [String]
    let avoidStrings: [String]
    let nearbyAlternatives: [NearbyAlternative]
    let practiceFocus: String
}

struct FunctionContext: Codable, Hashable, Sendable {
    let key: String
    let roles: [String]
    let label: String
}

struct NearbyAlternative: Codable, Hashable, Sendable {
    let label: String
    let type: String
    let description: String
    let targetId: String?
}

struct LevelDefinition: Codable, Identifiable, Hashable, Sendable {
    var id: String { name }
    let name: String
    let description: String
    let chordIds: [String]
}

struct ProgressionPack: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let description: String
    let keyCenter: String
    let focus: String
    let chordIds: [String]
    let progression: [String]
    let rightHandPattern: String
}

struct RightHandDocument: Codable, Sendable {
    let schemaVersion: Int
    let techniques: [String: TechniqueDetail]
    let difficulties: [String: DifficultyDetail]
    let exercises: [RightHandExercise]
}

struct TechniqueDetail: Codable, Hashable, Sendable {
    let label: String
    let shortLabel: String
    let description: String
    let symbol: String
}

struct DifficultyDetail: Codable, Hashable, Sendable {
    let label: String
    let description: String
}

struct RightHandExercise: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let technique: String
    let difficulty: String
    let title: String
    let focus: String
    let coaching: String
    let bpm: Int
    let subdivision: String
    let pattern: [String]

    var subdivisionsPerBeat: Int {
        switch subdivision {
        case "Eighth notes": 2
        case "Triplets": 3
        case "Sixteenth notes": 4
        default: 1
        }
    }
}

struct SongDocument: Codable, Sendable {
    let schemaVersion: Int
    let songs: [SongDefinition]
    let chordTips: [String: ChordTip]
}

struct SongDefinition: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let artist: String
    let source: String
    let license: String
    let difficulty: String
    let bpm: Int
    let key: String
    let timeSignature: String
    let tags: [String]
    let sections: [SongSection]
    let variations: [SongVariation]

    var chords: [String] {
        sections.flatMap { section in section.blocks.compactMap { block in block.type == .chords ? block.chords : nil }.flatMap { $0 } }
    }

    var strumPattern: String { variations.first?.pattern ?? "D - D -" }
    var strumFeel: String { variations.first?.feel ?? "Practice the changes slowly." }
}

struct SongSection: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let blocks: [SongBlock]
}

struct SongBlock: Codable, Hashable, Sendable {
    enum BlockType: String, Codable, Hashable, Sendable { case lyrics, chords, tab, annotation }
    let type: BlockType
    let text: String?
    let chords: [String]?
    let lines: [String]?
}

struct SongVariation: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let technique: String
    let key: String
    let timeSignature: String
    let bpm: Int
    let tuningId: String
    let capo: Int
    let pattern: String
    let feel: String
}

struct ChordTip: Codable, Hashable, Sendable {
    let fingering: String
    let transition: String
    let commonMistake: String
}

struct SettingsDocument: Codable, Sendable {
    let schemaVersion: Int
    let tunings: [TuningDefinition]
    let sampleVoices: [String]
    let rightHandPatterns: [String]
}

struct TuningDefinition: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let strings: [String]
    let semitoneOffsets: [Int]
}

enum SharedContentError: LocalizedError {
    case missingResource(String)
    case unsupportedSchema(String, Int)
    case invalidContent(String)

    var errorDescription: String? {
        switch self {
        case .missingResource(let name): "Missing bundled content: \(name).json"
        case .unsupportedSchema(let name, let version): "Unsupported \(name) schema version \(version)."
        case .invalidContent(let message): message
        }
    }
}
