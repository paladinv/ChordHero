import Foundation

enum PracticeRules {
    static let trainerChordCount = 10
    static let trainerInterval: TimeInterval = 3

    static func nextReview(after date: Date, rating: ReviewRating) -> Date {
        date.addingTimeInterval(rating.hours * 3_600)
    }

    static func nextStrength(current: Int, rating: ReviewRating) -> Int {
        max(1, current + (rating == .easy ? 2 : rating == .good ? 1 : -1))
    }

    static func baseFret(for chord: ChordDefinition) -> Int {
        let positive = chord.frets.filter { $0 > 0 }
        guard let maximum = positive.max(), maximum > 4 else { return 1 }
        return chord.barre?.fret ?? positive.min() ?? 1
    }

    static func transpose(_ name: String, semitones: Int) -> String {
        let notes = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
        guard let match = name.range(of: #"^[A-G](?:#|b)?"#, options: .regularExpression),
              let index = notes.firstIndex(of: String(name[match])) else { return name }
        let next = (index + semitones % notes.count + notes.count) % notes.count
        return name.replacingCharacters(in: match, with: notes[next])
    }
}

enum ReviewRating: String, CaseIterable, Identifiable {
    case again, good, easy
    var id: String { rawValue }
    var hours: TimeInterval { self == .again ? 4 : self == .good ? 24 : 72 }
    var title: String { rawValue.capitalized }
}

struct TrainerState: Equatable {
    enum Status { case idle, running, paused, complete }
    var status: Status = .idle
    var chordIDs: [String] = []
    var currentIndex = -1
    var secondsRemaining = 0

    mutating func reset() { self = TrainerState() }

    mutating func append(chordID: String) {
        guard chordIDs.count < PracticeRules.trainerChordCount else { return }
        chordIDs.append(chordID)
        currentIndex = chordIDs.count - 1
        secondsRemaining = Int(PracticeRules.trainerInterval)
        if chordIDs.count == PracticeRules.trainerChordCount { status = .complete }
    }
}

struct SongPlaybackState: Equatable {
    enum Status { case idle, countIn, running, paused, complete }
    var status: Status = .idle
    var chordIndex = 0
    var beat = 0
    var countIn = 4

    mutating func tick(chordCount: Int, beatsPerChord: Int) {
        if status == .countIn {
            countIn -= 1
            if countIn <= 0 { status = .running; beat = 0 }
            return
        }
        guard status == .running else { return }
        beat += 1
        if beat >= beatsPerChord {
            beat = 0
            if chordIndex + 1 >= chordCount { status = .complete }
            else { chordIndex += 1 }
        }
    }
}
