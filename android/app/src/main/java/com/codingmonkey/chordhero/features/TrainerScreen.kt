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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
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
import com.codingmonkey.chordhero.domain.PracticeRules
import com.codingmonkey.chordhero.domain.TrainerEngine
import com.codingmonkey.chordhero.domain.TrainerState
import com.codingmonkey.chordhero.services.AudioService
import kotlinx.coroutines.delay

@Composable
fun TrainerScreen(content: ContentBundle, audio: AudioService) {
    var levelIndex by remember { mutableIntStateOf(0) }
    var automatic by remember { mutableStateOf(true) }
    var metronome by remember { mutableStateOf(true) }
    var state by remember { mutableStateOf(TrainerState()) }
    val engine = remember { TrainerEngine() }
    val level = content.chords.levels[levelIndex]
    val chords = remember(content) { content.chords.chordLibrary.associateBy { it.id } }
    val current = state.chordIds.getOrNull(state.currentIndex)?.let(chords::get)
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP && state.status == PlaybackStatus.Running) {
                state = state.copy(status = PlaybackStatus.Paused)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(state.status, state.chordIds.size, levelIndex) {
        if (state.status == PlaybackStatus.Running && state.chordIds.size < PracticeRules.TRAINER_CHORD_COUNT) {
            val deadline = android.os.SystemClock.elapsedRealtime() + state.remainingMillis
            var priorSecond = state.remainingMillis / 1_000
            while (state.status == PlaybackStatus.Running) {
                val remaining = (deadline - android.os.SystemClock.elapsedRealtime()).coerceAtLeast(0)
                state = state.copy(remainingMillis = remaining)
                val second = remaining / 1_000
                if (metronome && second < priorSecond) audio.click(second == 0L)
                priorSecond = second
                if (remaining == 0L) break
                delay(50)
            }
            if (state.status == PlaybackStatus.Running) {
                state = engine.advance(state, level.chordIds)
                if (state.status == PlaybackStatus.Complete && automatic) {
                    levelIndex = (levelIndex + 1).coerceAtMost(content.chords.levels.lastIndex)
                }
            }
        }
    }

    FeatureList("Timed Chord Trainer", "Ten chords, three seconds per change") {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                content.chords.levels.forEachIndexed { index, item ->
                    FilterChip(
                        selected = index == levelIndex,
                        onClick = { levelIndex = index; state = TrainerState(); audio.stop() },
                        label = { Text(item.name) },
                    )
                }
            }
        }
        item {
            Row {
                Checkbox(automatic, { automatic = it })
                Text("Advance automatically", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
                Checkbox(metronome, { metronome = it })
                Text("Clicks", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
            }
        }
        if (current != null) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column {
                        ChordDiagram(current.chord, Modifier.fillMaxWidth())
                        Text(
                            "${state.chordIds.size}/10 · ${(state.remainingMillis / 1_000).coerceAtLeast(0)}",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        LinearProgressIndicator(
                            progress = { state.chordIds.size / 10f },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    state = when (state.status) {
                        PlaybackStatus.Idle, PlaybackStatus.Complete -> engine.start(level.chordIds)
                        PlaybackStatus.Running -> state.copy(status = PlaybackStatus.Paused)
                        PlaybackStatus.Paused -> state.copy(status = PlaybackStatus.Running)
                    }
                }) {
                    Text(
                        when (state.status) {
                            PlaybackStatus.Running -> "Pause"
                            PlaybackStatus.Paused -> "Resume"
                            else -> "Start round"
                        },
                    )
                }
                OutlinedButton(onClick = { state = TrainerState(); audio.stop() }) { Text("Reset") }
            }
        }
        if (state.chordIds.isNotEmpty()) {
            item { Text("Round history", style = MaterialTheme.typography.titleMedium) }
            items(state.chordIds.withIndex().toList()) { (index, id) ->
                OutlinedButton(onClick = { state = state.copy(currentIndex = index) }) {
                    Text("${index + 1}. ${chords[id]?.chord?.name ?: id}")
                }
            }
        }
    }
}
