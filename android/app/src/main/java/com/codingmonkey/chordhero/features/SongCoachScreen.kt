package com.codingmonkey.chordhero.features

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.codingmonkey.chordhero.designsystem.ChordDiagram
import com.codingmonkey.chordhero.domain.ContentBundle
import com.codingmonkey.chordhero.domain.PlaybackStatus
import com.codingmonkey.chordhero.domain.SongPlaybackState
import com.codingmonkey.chordhero.services.AudioService
import kotlinx.coroutines.delay

@Composable
fun SongCoachScreen(content: ContentBundle, audio: AudioService, initialSongID: String? = null, initialVariationID: String? = null) {
    var songIndex by remember { mutableIntStateOf(0) }
    var variationID by remember { mutableStateOf(initialVariationID) }
    val song = content.songs.songs[songIndex]
    val variation = song.variations.firstOrNull { it.id == variationID } ?: song.variations.firstOrNull()
    var tempo by remember(song.id, variation?.id) { mutableFloatStateOf((variation?.bpm ?: song.bpm).toFloat()) }
    var beatsPerChord by remember { mutableIntStateOf(4) }
    var metronome by remember { mutableStateOf(true) }
    var state by remember(song.id) { mutableStateOf(SongPlaybackState()) }
    val chord = content.chords.chordLibrary.firstOrNull { it.chord.name == song.chords[state.chordIndex] }
        ?: content.chords.chordLibrary.first()
    val tip = content.songs.chordTips[song.chords[state.chordIndex]]
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(initialSongID, initialVariationID) {
        val index = content.songs.songs.indexOfFirst { it.id == initialSongID }
        if (index >= 0) songIndex = index
        variationID = initialVariationID ?: content.songs.songs.getOrNull(if (index >= 0) index else 0)?.variations?.firstOrNull()?.id
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP && state.status == PlaybackStatus.Running) {
                state = state.copy(status = PlaybackStatus.Paused)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(state.status, state.chordIndex, state.beat, state.countInRemaining, tempo) {
        if (state.status == PlaybackStatus.Running) {
            delay((60_000 / tempo.toInt()).toLong())
            if (metronome) audio.click(state.beat == 0 || state.countingIn)
            state = state.tick(song.chords.size, beatsPerChord)
        }
    }

    FeatureList("Song Coach", "Count in, follow the progression, and focus on each transition") {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(2, 4, 6).forEach { beats ->
                    FilterChip(beatsPerChord == beats, { beatsPerChord = beats; state = SongPlaybackState() }, { Text("$beats beats") })
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column {
                    Text(song.title, style = MaterialTheme.typography.headlineSmall)
                    Text("${song.artist} · ${song.source} · ${song.difficulty}")
                    Text("${song.key} · ${song.timeSignature}")
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { song.variations.forEach { item -> FilterChip(variation?.id == item.id, { variationID = item.id; tempo = item.bpm.toFloat(); state = SongPlaybackState() }, { Text(item.name) }) } }
                    Text(variation?.pattern ?: song.strumPattern, style = MaterialTheme.typography.titleMedium)
                    Text(variation?.feel ?: song.strumFeel)
                    ChordDiagram(chord.chord)
                    Text(
                        if (state.countingIn) "Count in: ${state.countInRemaining}" else
                            "Step ${state.chordIndex + 1}/${song.chords.size} · Beat ${state.beat + 1}/$beatsPerChord",
                        style = MaterialTheme.typography.titleLarge,
                    )
                    tip?.let {
                        Text("Fingering: ${it.fingering}")
                        Text("Transition: ${it.transition}")
                        Text("Watch for: ${it.commonMistake}")
                    }
                }
            }
        }
        item {
            Text("${tempo.toInt()} BPM")
            Slider(tempo, { tempo = it }, valueRange = 60f..140f, steps = 79)
            Row {
                Checkbox(metronome, { metronome = it })
                Text("Metronome", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    state = when (state.status) {
                        PlaybackStatus.Idle, PlaybackStatus.Complete -> SongPlaybackState().start()
                        PlaybackStatus.Running -> state.copy(status = PlaybackStatus.Paused)
                        PlaybackStatus.Paused -> state.copy(status = PlaybackStatus.Running)
                    }
                }) { Text(if (state.status == PlaybackStatus.Running) "Pause" else if (state.status == PlaybackStatus.Paused) "Resume" else "Start") }
                OutlinedButton(onClick = { state = SongPlaybackState(); audio.stop() }) { Text("Reset") }
            }
        }
        item { Text("Songs", style = MaterialTheme.typography.titleMedium) }
        items(content.songs.songs.withIndex().toList()) { (index, item) ->
            OutlinedButton(
                onClick = { songIndex = index; variationID = item.variations.firstOrNull()?.id; state = SongPlaybackState(); tempo = item.variations.firstOrNull()?.bpm?.toFloat() ?: item.bpm.toFloat(); audio.stop() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("${item.title} · ${item.difficulty}") }
        }
    }
}
