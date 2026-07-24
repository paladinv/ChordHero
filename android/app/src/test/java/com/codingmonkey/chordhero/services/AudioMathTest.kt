package com.codingmonkey.chordhero.services

import org.junit.Assert.assertEquals
import org.junit.Test

class AudioMathTest {
    @Test
    fun midiNotesMapToConcertPitchFrequencies() {
        assertEquals(440.0, AudioMath.midiToFrequency(69), 0.0001)
        assertEquals(261.6256, AudioMath.midiToFrequency(60), 0.001)
        assertEquals(880.0, AudioMath.midiToFrequency(81), 0.0001)
    }
}
