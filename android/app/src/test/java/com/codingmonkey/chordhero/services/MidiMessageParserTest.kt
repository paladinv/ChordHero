package com.codingmonkey.chordhero.services

import org.junit.Assert.assertEquals
import org.junit.Test

class MidiMessageParserTest {
    @Test
    fun acceptsNoteOnAcrossChannelsAndRejectsNoteOffAndZeroVelocity() {
        val messages = byteArrayOf(
            0x90.toByte(), 60, 100,
            0x92.toByte(), 64, 1,
            0x80.toByte(), 60, 100,
            0x9F.toByte(), 67, 0,
        )
        assertEquals(listOf(60, 64), MidiMessageParser.noteOns(messages))
    }

    @Test
    fun honorsOffsetAndCountWithoutReadingPastPacket() {
        val packet = byteArrayOf(1, 2, 0x91.toByte(), 73, 80, 0x91.toByte(), 74, 80)
        assertEquals(listOf(73), MidiMessageParser.noteOns(packet, offset = 2, count = 3))
    }
}
