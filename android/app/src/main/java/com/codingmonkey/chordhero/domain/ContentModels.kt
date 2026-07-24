package com.codingmonkey.chordhero.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
data class ChordDocument(
    val schemaVersion: Int,
    val chordLibrary: List<ChordLibraryItem>,
    val levels: List<LevelDefinition>,
    val progressionPacks: List<ProgressionPack>,
)

@Serializable
data class ChordDefinition(
    val name: String,
    val frets: List<Int>,
    val barre: BarreDefinition? = null,
    val fingers: List<Int?>,
)

@Serializable
data class BarreDefinition(val fret: Int, val from: Int, val to: Int)

@Serializable
data class ChordLibraryItem(
    val id: String,
    val root: String,
    val quality: String,
    val qualityLabel: String,
    val inversion: String,
    val position: String,
    val chord: ChordDefinition,
    val difficultyTags: List<String>,
    val summary: String,
    val recommendedVariant: String,
    val alternateFingerings: List<String>,
    val functionContexts: List<FunctionContext>,
    val mutingNotes: List<String>,
    val avoidStrings: List<String>,
    val nearbyAlternatives: List<NearbyAlternative>,
    val practiceFocus: String,
)

@Serializable
data class FunctionContext(val key: String, val roles: List<String>, val label: String)

@Serializable
data class NearbyAlternative(
    val label: String,
    val type: String,
    val description: String,
    val targetId: String? = null,
)

@Serializable
data class LevelDefinition(
    val name: String,
    val description: String,
    val chordIds: List<String>,
) {
    val id: String get() = name
}

@Serializable
data class ProgressionPack(
    val id: String,
    val title: String,
    val description: String,
    val keyCenter: String,
    val focus: String,
    val chordIds: List<String>,
    val progression: List<String>,
    val rightHandPattern: String,
)

@Serializable
data class RightHandDocument(
    val schemaVersion: Int,
    val techniques: Map<String, TechniqueDetail>,
    val difficulties: Map<String, DifficultyDetail>,
    val exercises: List<RightHandExercise>,
)

@Serializable
data class TechniqueDetail(
    val label: String,
    val shortLabel: String,
    val description: String,
    val symbol: String,
)

@Serializable
data class DifficultyDetail(val label: String, val description: String)

@Serializable
data class RightHandExercise(
    val id: String,
    val technique: String,
    val difficulty: String,
    val title: String,
    val focus: String,
    val coaching: String,
    val bpm: Int,
    val subdivision: String,
    val pattern: List<String>,
) {
    val subdivisionsPerBeat: Int
        get() = when (subdivision) {
            "Eighth notes" -> 2
            "Triplets" -> 3
            "Sixteenth notes" -> 4
            else -> 1
        }
}

@Serializable
data class SongDocument(
    val schemaVersion: Int,
    val songs: List<SongDefinition>,
    val chordTips: Map<String, ChordTip>,
)

@Serializable
data class SongDefinition(
    val id: String,
    val title: String,
    val artist: String,
    val source: String,
    val license: String,
    val difficulty: String,
    val bpm: Int,
    val key: String,
    val timeSignature: String,
    val tags: List<String>,
    val sections: List<SongSection>,
    val variations: List<SongVariation>,
) {
    val chords: List<String> get() = sections.flatMap { section -> section.blocks.filter { it.type == SongBlockType.CHORDS }.flatMap { it.chords.orEmpty() } }
    val strumPattern: String get() = variations.firstOrNull()?.pattern ?: "D - D -"
    val strumFeel: String get() = variations.firstOrNull()?.feel ?: "Practice the changes slowly."
}

@Serializable
data class SongSection(val id: String, val title: String, val blocks: List<SongBlock>)

@Serializable
data class SongBlock(
    val type: SongBlockType,
    val text: String? = null,
    val chords: List<String>? = null,
    val lines: List<String>? = null,
)

@Serializable
enum class SongBlockType {
    @SerialName("lyrics") LYRICS,
    @SerialName("chords") CHORDS,
    @SerialName("tab") TAB,
    @SerialName("annotation") ANNOTATION,
}

@Serializable
data class SongVariation(
    val id: String,
    val name: String,
    val technique: String,
    val key: String,
    val timeSignature: String,
    val bpm: Int,
    val tuningId: String,
    val capo: Int,
    val pattern: String,
    val feel: String,
)

@Serializable
data class ChordTip(
    val fingering: String,
    val transition: String,
    val commonMistake: String,
)

@Serializable
data class SettingsDocument(
    val schemaVersion: Int,
    val tunings: List<TuningDefinition>,
    val sampleVoices: List<String>,
    val rightHandPatterns: List<String>,
)

@Serializable
data class TuningDefinition(
    val id: String,
    val label: String,
    val strings: List<String>,
    val semitoneOffsets: List<Int>,
)

data class ContentBundle(
    val chords: ChordDocument,
    val rightHand: RightHandDocument,
    val songs: SongDocument,
    val settings: SettingsDocument,
)

sealed interface ContentLoadResult {
    data class Ready(val content: ContentBundle) : ContentLoadResult
    data class Failed(val message: String, val cause: Throwable? = null) : ContentLoadResult
}
