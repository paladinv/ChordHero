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
        require(ids.size == 346) { "Expected 346 chord voicings." }
        val idSet = ids.toSet()
        content.chords.chordLibrary.forEach { item ->
            require(item.chord.frets.size == 6 && item.chord.fingers.size == 6) { "${item.id} must define six strings." }
            require(item.chord.frets.all { it >= -1 }) { "${item.id} has an invalid fret." }
            require(item.chord.fingers.all { it == null || it in 1..4 }) { "${item.id} has an invalid finger." }
            item.chord.barre?.let { require(it.from in 0..5 && it.to in 0..5 && it.from <= it.to) }
        }
        require(content.chords.levels.size == 4)
        require(content.chords.progressionPacks.size == 4)
        (content.chords.levels.flatMap { it.chordIds } +
            content.chords.progressionPacks.flatMap { it.chordIds }).forEach {
            require(it in idSet) { "Unknown chord reference: $it" }
        }
        require(content.rightHand.exercises.map { it.id }.toSet().size == 30)
        require(content.songs.songs.size == 50)
        require(content.songs.songs.all { song -> song.id.isNotBlank() && song.variations.size >= 3 && song.sections.isNotEmpty() })
        require(content.settings.tunings.size == 4)
        content.settings.tunings.forEach {
            require(it.strings.size == 6 && it.semitoneOffsets.size == 6)
        }
    }
}
