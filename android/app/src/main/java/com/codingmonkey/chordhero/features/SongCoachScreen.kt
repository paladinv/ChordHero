package com.codingmonkey.chordhero.features

import android.Manifest
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import com.codingmonkey.chordhero.services.SongRecorderService
import com.codingmonkey.chordhero.services.MidiService
import kotlinx.coroutines.delay

private fun com.codingmonkey.chordhero.services.MidiConnectionState.label(): String = when (this) {
    com.codingmonkey.chordhero.services.MidiConnectionState.Unavailable -> "unavailable"
    com.codingmonkey.chordhero.services.MidiConnectionState.Disconnected -> "disconnected"
    is com.codingmonkey.chordhero.services.MidiConnectionState.Connected -> "connected: $name"
}

@Composable
fun SongCoachScreen(content: ContentBundle, audio: AudioService, recorder: SongRecorderService, midi: MidiService, initialSongID: String? = null, initialVariationID: String? = null) {
    var songIndex by remember { mutableIntStateOf(0) }
    var variationID by remember { mutableStateOf(initialVariationID) }
    val song = content.songs.songs[songIndex]
    val variation = song.variations.firstOrNull { it.id == variationID } ?: song.variations.firstOrNull()
    var tempo by remember(song.id, variation?.id) { mutableFloatStateOf((variation?.bpm ?: song.bpm).toFloat()) }
    var beatsPerChord by remember { mutableIntStateOf(4) }
    var metronome by remember { mutableStateOf(true) }
    var handsFree by remember { mutableStateOf(false) }
    var largePrint by remember { mutableStateOf(false) }
    var simplifyMode by remember { mutableStateOf(false) }
    val effectiveTempo = if (simplifyMode) tempo * 0.75f else tempo
    val midiNote by midi.notes.collectAsState(initial = null)
    val midiState by midi.state.collectAsState()
    val requestMicrophone = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted) recorder.start(song.id) }
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

    LaunchedEffect(midiNote) {
        when (midiNote) {
            60 -> state = if (state.status == PlaybackStatus.Running) state.copy(status = PlaybackStatus.Paused) else state.copy(status = PlaybackStatus.Running)
            62 -> state = state.copy(chordIndex = (state.chordIndex + 1).coerceAtMost(song.chords.lastIndex))
            64 -> { state = SongPlaybackState(); audio.stop() }
        }
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
            delay((60_000 / effectiveTempo.toInt()).toLong())
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
                    Text(song.title, style = if (largePrint) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.headlineSmall)
                    Text("${song.artist} · ${song.source} · ${song.difficulty}")
                    Text("${song.key} · ${song.timeSignature}")
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { song.variations.forEach { item -> FilterChip(variation?.id == item.id, { variationID = item.id; tempo = item.bpm.toFloat(); state = SongPlaybackState() }, { Text(item.name) }) } }
                    Text(if (simplifyMode) "D - D -" else variation?.pattern ?: song.strumPattern, style = MaterialTheme.typography.titleMedium)
                    Text(variation?.feel ?: song.strumFeel)
                    ChordDiagram(chord.chord)
                    Text(
                        if (state.countingIn) "Count in: ${state.countInRemaining}" else
                            "Step ${state.chordIndex + 1}/${song.chords.size} · Beat ${state.beat + 1}/$beatsPerChord",
                        style = if (largePrint) MaterialTheme.typography.displaySmall else MaterialTheme.typography.titleLarge,
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
            Text("${effectiveTempo.toInt()} BPM${if (simplifyMode) " · simplified" else ""}")
            Slider(tempo, { tempo = it }, valueRange = 60f..140f, steps = 79)
            Row {
                Checkbox(metronome, { metronome = it })
                Text("Metronome", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
                Checkbox(handsFree, { handsFree = it })
                Text("Hands-free", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
                Checkbox(largePrint, { largePrint = it })
                Text("Large print", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
                Checkbox(simplifyMode, { simplifyMode = it })
                Text("Simplify", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
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
                OutlinedButton(onClick = { midi.start() }) { Text(if (midiState is com.codingmonkey.chordhero.services.MidiConnectionState.Connected) "MIDI ready" else "Connect MIDI") }
            }
        }
        item { Text("MIDI hands-free: C4 play/pause · D4 next chord · E4 reset · ${midiState.label()}", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(onClick = { if (recorder.isRecording) recorder.stop() else requestMicrophone.launch(Manifest.permission.RECORD_AUDIO) }) { Text(if (recorder.isRecording) "Stop recording" else "Record performance") }; OutlinedButton(enabled = recorder.latestFile != null, onClick = { recorder.playLatest() }) { Text("Play recording") } } }
        item { Text("Songs", style = MaterialTheme.typography.titleMedium) }
        items(content.songs.songs.withIndex().toList()) { (index, item) ->
            OutlinedButton(
                onClick = { songIndex = index; variationID = item.variations.firstOrNull()?.id; state = SongPlaybackState(); tempo = item.variations.firstOrNull()?.bpm?.toFloat() ?: item.bpm.toFloat(); audio.stop() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("${item.title} · ${item.difficulty}") }
        }
    }
}
