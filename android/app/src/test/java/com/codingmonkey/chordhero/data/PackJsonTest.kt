package com.codingmonkey.chordhero.data

import com.codingmonkey.chordhero.domain.ProgressionPack
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PackJsonTest {
    private val pack = ProgressionPack(
        id = "practice",
        title = "Practice",
        description = "Test",
        keyCenter = "C",
        focus = "Changes",
        chordIds = listOf("c-open", "g-open"),
        progression = listOf("C", "G"),
        rightHandPattern = "Down",
    )

    @Test
    fun legacyRoundTripIsDeterministic() {
        val encoded = PackJson.exportLegacy(listOf(pack))
        assertEquals(listOf(pack), PackJson.import(encoded, setOf("c-open", "g-open")))
        assertEquals(encoded, PackJson.exportLegacy(PackJson.import(encoded, setOf("c-open", "g-open"))))
    }

    @Test
    fun envelopeIsAcceptedAndUnknownReferencesAreRejected() {
        val envelope = """{"schemaVersion":1,"packs":[${PackJson.exportLegacy(listOf(pack)).removeSurrounding("[", "]")}]}"""
        assertEquals(listOf(pack), PackJson.import(envelope, setOf("c-open", "g-open")))
        assertThrows(IllegalArgumentException::class.java) { PackJson.import(envelope, setOf("c-open")) }
    }
}
