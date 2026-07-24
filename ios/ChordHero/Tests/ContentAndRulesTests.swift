import XCTest
import SwiftData
@testable import ChordHero

final class ContentAndRulesTests: XCTestCase {
    func testBundledContentInventoryAndReferences() throws {
        let bundle = Bundle(for: ContentAndRulesTests.self)
        let repository = BundleContentRepository(bundle: bundle)
        let content = try repository.load()
        XCTAssertEqual(content.chords.count, 346)
        XCTAssertEqual(content.levels.count, 4)
        XCTAssertEqual(content.progressionPacks.count, 4)
        XCTAssertEqual(content.exercises.count, 30)
        XCTAssertEqual(content.songs.count, 50)
        XCTAssertTrue(content.songs.allSatisfy { $0.variations.count >= 3 })
        XCTAssertEqual(content.tunings.count, 4)
        XCTAssertTrue(content.levels.flatMap(\.chordIds).allSatisfy { content.chordByID[$0] != nil })
    }

    func testBaseFretAndTransposition() {
        XCTAssertEqual(PracticeRules.baseFret(for: ChordDefinition(name: "C", frets: [-1, 3, 2, 0, 1, 0], barre: nil, fingers: [nil, 3, 2, nil, 1, nil])), 1)
        XCTAssertEqual(PracticeRules.baseFret(for: ChordDefinition(name: "C", frets: [-1, 3, 5, 5, 5, 3], barre: BarreDefinition(fret: 3, from: 1, to: 5), fingers: [nil, 1, 3, 4, 4, 1])), 3)
        XCTAssertEqual(PracticeRules.transpose("Cadd9", semitones: 2), "Dadd9")
        XCTAssertEqual(PracticeRules.transpose("Bb", semitones: 1), "B")
    }

    func testReviewIntervalsAndStrength() {
        let start = Date(timeIntervalSince1970: 1_000)
        XCTAssertEqual(PracticeRules.nextReview(after: start, rating: .again), start.addingTimeInterval(4 * 3_600))
        XCTAssertEqual(PracticeRules.nextReview(after: start, rating: .good), start.addingTimeInterval(24 * 3_600))
        XCTAssertEqual(PracticeRules.nextReview(after: start, rating: .easy), start.addingTimeInterval(72 * 3_600))
        XCTAssertEqual(PracticeRules.nextStrength(current: 1, rating: .again), 1)
        XCTAssertEqual(PracticeRules.nextStrength(current: 2, rating: .easy), 4)
    }

    func testTrainerCapsAtTen() {
        var state = TrainerState(status: .running)
        for index in 0..<12 { state.append(chordID: "chord-\(index)") }
        XCTAssertEqual(state.chordIDs.count, 10)
        XCTAssertEqual(state.status, .complete)
        state.reset()
        XCTAssertEqual(state, TrainerState())
    }

    func testSongCountInAndCompletion() {
        var state = SongPlaybackState(status: .countIn)
        for _ in 0..<4 { state.tick(chordCount: 2, beatsPerChord: 2) }
        XCTAssertEqual(state.status, .running)
        for _ in 0..<4 { state.tick(chordCount: 2, beatsPerChord: 2) }
        XCTAssertEqual(state.status, .complete)
        XCTAssertEqual(state.chordIndex, 1)
    }

    func testRightHandSubdivisionRates() {
        let make: (String) -> RightHandExercise = { subdivision in RightHandExercise(id: subdivision, technique: "strumming", difficulty: "beginner", title: "Test", focus: "Test", coaching: "Test", bpm: 60, subdivision: subdivision, pattern: ["D"]) }
        XCTAssertEqual(make("Quarter notes").subdivisionsPerBeat, 1)
        XCTAssertEqual(make("Eighth notes").subdivisionsPerBeat, 2)
        XCTAssertEqual(make("Triplets").subdivisionsPerBeat, 3)
        XCTAssertEqual(make("Sixteenth notes").subdivisionsPerBeat, 4)
    }

    @MainActor
    func testProfileIsolationAndPersistence() throws {
        let configuration = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: StudentProfile.self, ChordProgress.self, CustomPracticePack.self, SongLibraryCollection.self, ImportedSongRecord.self, configurations: configuration)
        let context = container.mainContext
        let first = StudentProfile(name: "First", isSelected: true)
        let second = StudentProfile(name: "Second")
        context.insert(first); context.insert(second)
        let firstProgress = try PersistenceCoordinator.progress(profileID: first.id, chordID: "c-major-open", in: context)
        firstProgress.isFavorite = true
        let secondProgress = try PersistenceCoordinator.progress(profileID: second.id, chordID: "c-major-open", in: context)
        XCTAssertFalse(secondProgress.isFavorite)
        XCTAssertNotEqual(firstProgress.compoundID, secondProgress.compoundID)
    }
}
