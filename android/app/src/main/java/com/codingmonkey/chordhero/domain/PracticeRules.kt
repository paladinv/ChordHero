package com.codingmonkey.chordhero.domain

import android.os.SystemClock
import kotlin.math.max
import kotlin.random.Random

interface MonotonicClock {
    fun nowNanos(): Long
}

object AndroidMonotonicClock : MonotonicClock {
    override fun nowNanos(): Long = SystemClock.elapsedRealtimeNanos()
}

interface RandomSource {
    fun nextInt(bound: Int): Int
}

object DefaultRandomSource : RandomSource {
    override fun nextInt(bound: Int): Int = Random.nextInt(bound)
}

enum class ReviewRating(val hours: Long) { Again(4), Good(24), Easy(72) }

object PracticeRules {
    const val TRAINER_CHORD_COUNT = 10
    const val TRAINER_INTERVAL_MILLIS = 3_000L

    fun nextReviewMillis(nowMillis: Long, rating: ReviewRating): Long =
        nowMillis + rating.hours * 3_600_000L

    fun nextStrength(current: Int, rating: ReviewRating): Int =
        max(1, current + when (rating) {
            ReviewRating.Again -> -1
            ReviewRating.Good -> 1
            ReviewRating.Easy -> 2
        })

    fun baseFret(chord: ChordDefinition): Int {
        val positive = chord.frets.filter { it > 0 }
        if ((positive.maxOrNull() ?: 0) <= 4) return 1
        return chord.barre?.fret ?: positive.minOrNull() ?: 1
    }

    fun transpose(name: String, semitones: Int): String {
        val notes = listOf("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")
        val root = Regex("^[A-G](?:#|b)?").find(name)?.value ?: return name
        val index = notes.indexOf(root)
        if (index < 0) return name
        val next = Math.floorMod(index + semitones, notes.size)
        return notes[next] + name.removePrefix(root)
    }

    fun pitchClass(note: String): Int? {
        val normalized = mapOf(
            "C" to 0, "B#" to 0, "C#" to 1, "Db" to 1, "D" to 2,
            "D#" to 3, "Eb" to 3, "E" to 4, "Fb" to 4, "E#" to 5,
            "F" to 5, "F#" to 6, "Gb" to 6, "G" to 7, "G#" to 8,
            "Ab" to 8, "A" to 9, "A#" to 10, "Bb" to 10, "B" to 11,
        )
        val root = Regex("^[A-G](?:#|b)?").find(note)?.value ?: return null
        return normalized[root]
    }

    fun midiMatchesRoot(midiNote: Int, root: String): Boolean =
        pitchClass(root) == Math.floorMod(midiNote, 12)
}

enum class PlaybackStatus { Idle, Running, Paused, Complete }

data class TrainerState(
    val status: PlaybackStatus = PlaybackStatus.Idle,
    val chordIds: List<String> = emptyList(),
    val currentIndex: Int = -1,
    val remainingMillis: Long = PracticeRules.TRAINER_INTERVAL_MILLIS,
)

class TrainerEngine(private val random: RandomSource = DefaultRandomSource) {
    fun start(options: List<String>): TrainerState {
        require(options.isNotEmpty())
        return append(TrainerState(status = PlaybackStatus.Running), options)
    }

    fun advance(state: TrainerState, options: List<String>): TrainerState {
        if (state.status != PlaybackStatus.Running || state.chordIds.size >= PracticeRules.TRAINER_CHORD_COUNT) {
            return state
        }
        return append(state, options)
    }

    private fun append(state: TrainerState, options: List<String>): TrainerState {
        val candidates = if (options.size > 1) options.filterNot { it == state.chordIds.lastOrNull() } else options
        val next = candidates[random.nextInt(candidates.size)]
        val history = state.chordIds + next
        return state.copy(
            status = if (history.size == PracticeRules.TRAINER_CHORD_COUNT) PlaybackStatus.Complete else PlaybackStatus.Running,
            chordIds = history,
            currentIndex = history.lastIndex,
            remainingMillis = PracticeRules.TRAINER_INTERVAL_MILLIS,
        )
    }
}

data class SongPlaybackState(
    val status: PlaybackStatus = PlaybackStatus.Idle,
    val countingIn: Boolean = false,
    val countInRemaining: Int = 4,
    val chordIndex: Int = 0,
    val beat: Int = 0,
) {
    fun start() = copy(status = PlaybackStatus.Running, countingIn = true, countInRemaining = 4)

    fun tick(chordCount: Int, beatsPerChord: Int): SongPlaybackState {
        if (status != PlaybackStatus.Running) return this
        if (countingIn) {
            val remaining = countInRemaining - 1
            return copy(countingIn = remaining > 0, countInRemaining = remaining.coerceAtLeast(0), beat = 0)
        }
        val nextBeat = beat + 1
        if (nextBeat < beatsPerChord) return copy(beat = nextBeat)
        if (chordIndex + 1 >= chordCount) return copy(status = PlaybackStatus.Complete, beat = 0)
        return copy(chordIndex = chordIndex + 1, beat = 0)
    }
}

fun RightHandExercise.stepIntervalMillis(bpm: Int): Long =
    (60_000.0 / bpm.coerceIn(40, 180) / subdivisionsPerBeat).toLong()
