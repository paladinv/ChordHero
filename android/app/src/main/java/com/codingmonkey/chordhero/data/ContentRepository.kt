package com.codingmonkey.chordhero.data

import android.content.Context
import com.codingmonkey.chordhero.domain.ChordDocument
import com.codingmonkey.chordhero.domain.ContentBundle
import com.codingmonkey.chordhero.domain.ContentLoadResult
import com.codingmonkey.chordhero.domain.RightHandDocument
import com.codingmonkey.chordhero.domain.SettingsDocument
import com.codingmonkey.chordhero.domain.SongDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

interface ContentRepository {
    suspend fun load(): ContentLoadResult
}

class AssetContentRepository(
    context: Context,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : ContentRepository {
    private val assets = context.applicationContext.assets

    override suspend fun load(): ContentLoadResult = withContext(Dispatchers.IO) {
        runCatching {
            val content = ContentBundle(
                chords = decode("chords.json", ChordDocument.serializer()),
                rightHand = decode("right-hand.json", RightHandDocument.serializer()),
                songs = decode("songs.json", SongDocument.serializer()),
                settings = decode("settings.json", SettingsDocument.serializer()),
            )
            ContentValidator.validate(content)
            content
        }.fold(
            onSuccess = { ContentLoadResult.Ready(it) },
            onFailure = { ContentLoadResult.Failed(it.message ?: "Bundled content could not be loaded.", it) },
        )
    }

    private fun <T> decode(name: String, serializer: kotlinx.serialization.KSerializer<T>): T =
        assets.open(name).bufferedReader().use { json.decodeFromString(serializer, it.readText()) }
}

object ContentValidator {
    fun validate(content: ContentBundle) {
        require(content.chords.schemaVersion == 1) { "Unsupported chords schema." }
        require(content.rightHand.schemaVersion == 1) { "Unsupported right-hand schema." }
        require(content.songs.schemaVersion == 2) { "Unsupported songs schema." }
        require(content.settings.schemaVersion == 1) { "Unsupported settings schema." }

        val ids = content.chords.chordLibrary.map { it.id }
        require(ids.size == ids.toSet().size) { "Chord IDs must be unique." }
        require(ids.isNotEmpty()) { "At least one chord voicing is required." }
        val idSet = ids.toSet()
        content.chords.chordLibrary.forEach { item ->
            require(item.chord.frets.size == 6 && item.chord.fingers.size == 6) { "${item.id} must define six strings." }
            require(item.chord.frets.all { it >= -1 }) { "${item.id} has an invalid fret." }
            require(item.chord.fingers.all { it == null || it in 1..4 }) { "${item.id} has an invalid finger." }
            item.chord.barre?.let { require(it.from in 0..5 && it.to in 0..5 && it.from <= it.to) }
        }
        require(content.chords.levels.isNotEmpty()) { "At least one trainer level is required." }
        (content.chords.levels.flatMap { it.chordIds } +
            content.chords.progressionPacks.flatMap { it.chordIds }).forEach {
            require(it in idSet) { "Unknown chord reference: $it" }
        }
        val exerciseIds = content.rightHand.exercises.map { it.id }
        require(exerciseIds.isNotEmpty() && exerciseIds.size == exerciseIds.toSet().size) { "Exercise IDs must be unique." }
        require(content.rightHand.exercises.all { it.pattern.isNotEmpty() && it.bpm in 40..180 }) {
            "Every right-hand exercise must have a pattern and a supported tempo."
        }
        val songIds = content.songs.songs.map { it.id }
        require(songIds.isNotEmpty() && songIds.size == songIds.toSet().size) { "Song IDs must be unique." }
        require(content.songs.songs.all { song -> song.id.isNotBlank() && song.variations.isNotEmpty() && song.sections.isNotEmpty() }) {
            "Every song must have an ID, variation, and section."
        }
        val tuningIds = content.settings.tunings.map { it.id }
        require(tuningIds.isNotEmpty() && tuningIds.size == tuningIds.toSet().size) { "Tuning IDs must be unique." }
        content.settings.tunings.forEach {
            require(it.strings.size in 6..7 && it.strings.size == it.semitoneOffsets.size) {
                "${it.id} must define matching six- or seven-string tuning data."
            }
            if (it.id == "standard-7") require(it.strings.size == 7) { "The standard-7 tuning must define seven strings." }
        }
    }
}
