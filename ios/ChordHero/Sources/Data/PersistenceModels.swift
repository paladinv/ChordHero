import Foundation
import SwiftData

@Model
final class StudentProfile {
    @Attribute(.unique) var id: UUID
    var name: String
    var isSelected: Bool
    var createdAt: Date
    var updatedAt: Date

    init(id: UUID = UUID(), name: String, isSelected: Bool = false, now: Date = .now) {
        self.id = id
        self.name = name
        self.isSelected = isSelected
        self.createdAt = now
        self.updatedAt = now
    }
}

@Model
final class ChordProgress {
    @Attribute(.unique) var compoundID: String
    var profileID: UUID
    var chordID: String
    var isFavorite: Bool
    var lastViewedAt: Date?
    var note: String
    var seconds: Int
    var repetitions: Int
    var misses: Int
    var strength: Int
    var nextReviewAt: Date?

    init(profileID: UUID, chordID: String) {
        self.compoundID = "\(profileID.uuidString):\(chordID)"
        self.profileID = profileID
        self.chordID = chordID
        self.isFavorite = false
        self.note = ""
        self.seconds = 0
        self.repetitions = 0
        self.misses = 0
        self.strength = 1
    }
}

@Model
final class CustomPracticePack {
    @Attribute(.unique) var id: UUID
    var title: String
    var packDescription: String
    var keyCenter: String
    var focus: String
    var rightHandPattern: String
    var chordIDs: [String]
    var createdAt: Date
    var updatedAt: Date

    init(id: UUID = UUID(), title: String, description: String, keyCenter: String, focus: String, rightHandPattern: String, chordIDs: [String], now: Date = .now) {
        self.id = id
        self.title = title
        self.packDescription = description
        self.keyCenter = keyCenter
        self.focus = focus
        self.rightHandPattern = rightHandPattern
        self.chordIDs = Array(chordIDs.uniqued().prefix(10))
        self.createdAt = now
        self.updatedAt = now
    }
}

@Model
final class SongLibraryCollection {
    @Attribute(.unique) var id: UUID
    var profileID: UUID
    var name: String
    var collectionDescription: String
    var songIDs: [String]
    var createdAt: Date
    var updatedAt: Date
    var isQueue: Bool
    var resumeSongID: String?
    var resumeVariationID: String?

    init(id: UUID = UUID(), profileID: UUID, name: String, description: String = "", songIDs: [String] = [], now: Date = .now) {
        self.id = id
        self.profileID = profileID
        self.name = name
        self.collectionDescription = description
        self.songIDs = Array(songIDs.uniqued())
        self.createdAt = now
        self.updatedAt = now
        self.isQueue = false
    }
}

@Model
final class ImportedSongRecord {
    @Attribute(.unique) var id: UUID
    var profileID: UUID
    var title: String
    var artist: String
    var sourceURL: String
    var notes: String
    var importedAt: Date

    init(id: UUID = UUID(), profileID: UUID, title: String, artist: String, sourceURL: String, notes: String = "", now: Date = .now) {
        self.id = id
        self.profileID = profileID
        self.title = title
        self.artist = artist
        self.sourceURL = sourceURL
        self.notes = notes
        self.importedAt = now
    }
}

@Model
final class SongPracticeRecord {
    @Attribute(.unique) var compoundID: String
    var profileID: UUID
    var songID: String
    var variationID: String
    var isFavorite: Bool
    var practiceCount: Int
    var lastPracticedAt: Date?
    var sectionMasteryJSON: String
    var streakDays: Int

    init(profileID: UUID, songID: String, variationID: String = "") {
        self.compoundID = "\(profileID.uuidString):\(songID)"
        self.profileID = profileID
        self.songID = songID
        self.variationID = variationID
        self.isFavorite = false
        self.practiceCount = 0
        self.sectionMasteryJSON = "{}"
        self.streakDays = 0
    }
}

@Model
final class SongQueueHistory {
    @Attribute(.unique) var id: UUID
    var profileID: UUID
    var queueID: UUID
    var songIDs: [String]
    var completedAt: Date
    var lastSongID: String?

    init(profileID: UUID, queueID: UUID, songIDs: [String], lastSongID: String? = nil, now: Date = .now) {
        self.id = UUID(); self.profileID = profileID; self.queueID = queueID; self.songIDs = songIDs; self.completedAt = now; self.lastSongID = lastSongID
    }
}

@Model
final class WeeklyPracticeGoal {
    @Attribute(.unique) var compoundID: String
    var profileID: UUID
    var weekStart: String
    var targetSessions: Int
    var completedSessions: Int

    init(profileID: UUID, weekStart: String, targetSessions: Int = 3) {
        self.compoundID = "\(profileID.uuidString):\(weekStart)"; self.profileID = profileID; self.weekStart = weekStart; self.targetSessions = targetSessions; self.completedSessions = 0
    }
}

@Model
final class SongRecordingRecord {
    @Attribute(.unique) var id: UUID
    var profileID: UUID
    var songID: String
    var sectionID: String?
    var filePath: String
    var durationSeconds: Double
    var createdAt: Date

    init(profileID: UUID, songID: String, sectionID: String? = nil, filePath: String, durationSeconds: Double, now: Date = .now) {
        self.id = UUID(); self.profileID = profileID; self.songID = songID; self.sectionID = sectionID; self.filePath = filePath; self.durationSeconds = durationSeconds; self.createdAt = now
    }
}

extension Sequence where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

@MainActor
enum PersistenceCoordinator {
    static func selectedProfile(in context: ModelContext) throws -> StudentProfile {
        let profiles = try context.fetch(FetchDescriptor<StudentProfile>(sortBy: [SortDescriptor(\.createdAt)]))
        if let selected = profiles.first(where: \.isSelected) { return selected }
        if let first = profiles.first { first.isSelected = true; try context.save(); return first }
        let profile = StudentProfile(name: "Current device profile", isSelected: true)
        context.insert(profile)
        try context.save()
        return profile
    }

    static func progress(profileID: UUID, chordID: String, in context: ModelContext) throws -> ChordProgress {
        let compoundID = "\(profileID.uuidString):\(chordID)"
        var descriptor = FetchDescriptor<ChordProgress>(predicate: #Predicate { $0.compoundID == compoundID })
        descriptor.fetchLimit = 1
        if let progress = try context.fetch(descriptor).first { return progress }
        let progress = ChordProgress(profileID: profileID, chordID: chordID)
        context.insert(progress)
        return progress
    }
}
