package com.codingmonkey.chordhero.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PracticeRulesTest {
    @Test
    fun reviewIntervalsAreExactlyFourTwentyFourAndSeventyTwoHours() {
        val now = 1_000L
        assertEquals(now + 4 * 3_600_000L, PracticeRules.nextReviewMillis(now, ReviewRating.Again))
        assertEquals(now + 24 * 3_600_000L, PracticeRules.nextReviewMillis(now, ReviewRating.Good))
        assertEquals(now + 72 * 3_600_000L, PracticeRules.nextReviewMillis(now, ReviewRating.Easy))
        assertEquals(1, PracticeRules.nextStrength(1, ReviewRating.Again))
        assertEquals(4, PracticeRules.nextStrength(2, ReviewRating.Easy))
    }

    @Test
    fun transpositionAndPitchClassesNormalizeEnharmonicsAndOctaves() {
        assertEquals("D", PracticeRules.transpose("C", 2))
        assertEquals("Bbmaj7", PracticeRules.transpose("Gmaj7", 3))
        assertEquals(1, PracticeRules.pitchClass("Db"))
        assertTrue(PracticeRules.midiMatchesRoot(61, "C#"))
        assertTrue(PracticeRules.midiMatchesRoot(73, "Db"))
    }

    @Test
    fun baseFretUsesBarreOrLowestPositiveFretForMovableShapes() {
        val open = ChordDefinition("C", listOf(-1, 3, 2, 0, 1, 0), fingers = listOf(null, 3, 2, null, 1, null))
        val barre = ChordDefinition("A", listOf(5, 7, 7, 6, 5, 5), BarreDefinition(5, 0, 5), listOf(1, 3, 4, 2, 1, 1))
        assertEquals(1, PracticeRules.baseFret(open))
        assertEquals(5, PracticeRules.baseFret(barre))
    }
}

class TrainerEngineTest {
    private class CyclingRandom : RandomSource {
        private var value = 0
        override fun nextInt(bound: Int): Int = (value++ % bound)
    }

    @Test
    fun trainerStartsImmediatelyCapsAtTenAndAvoidsAdjacentDuplicates() {
        val engine = TrainerEngine(CyclingRandom())
        var state = engine.start(listOf("c", "g", "d"))
        assertEquals(1, state.chordIds.size)
        repeat(20) { state = engine.advance(state, listOf("c", "g", "d")) }
        assertEquals(10, state.chordIds.size)
        assertEquals(PlaybackStatus.Complete, state.status)
        state.chordIds.zipWithNext().forEach { (first, second) -> assertNotEquals(first, second) }
    }

    @Test
    fun trainerPausePreventsAdvancement() {
        val engine = TrainerEngine(CyclingRandom())
        val running = engine.start(listOf("c", "g"))
        val paused = running.copy(status = PlaybackStatus.Paused, remainingMillis = 1_500)
        assertEquals(paused, engine.advance(paused, listOf("c", "g")))
    }
}

class SongStateTest {
    @Test
    fun countInConsumesFourTicksAndFinalChordDoesNotOverflow() {
        var state = SongPlaybackState().start()
        repeat(4) { state = state.tick(chordCount = 2, beatsPerChord = 2) }
        assertEquals(false, state.countingIn)
        assertEquals(0, state.chordIndex)
        repeat(4) { state = state.tick(chordCount = 2, beatsPerChord = 2) }
        assertEquals(PlaybackStatus.Complete, state.status)
        assertEquals(1, state.chordIndex)
    }

    @Test
    fun subdivisionIntervalsMatchQuarterEighthTripletAndSixteenthMath() {
        fun exercise(subdivision: String) = RightHandExercise(
            "id", "strumming", "beginner", "title", "focus", "coach", 60, subdivision, listOf("D"),
        )
        assertEquals(1_000, exercise("Quarter notes").stepIntervalMillis(60))
        assertEquals(500, exercise("Eighth notes").stepIntervalMillis(60))
        assertEquals(333, exercise("Triplets").stepIntervalMillis(60))
        assertEquals(250, exercise("Sixteenth notes").stepIntervalMillis(60))
    }
}
