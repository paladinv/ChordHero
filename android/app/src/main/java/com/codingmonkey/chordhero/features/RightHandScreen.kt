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
import com.codingmonkey.chordhero.domain.ContentBundle
import com.codingmonkey.chordhero.domain.stepIntervalMillis
import com.codingmonkey.chordhero.services.AudioService
import kotlinx.coroutines.delay

@Composable
fun RightHandScreen(content: ContentBundle, audio: AudioService) {
    var technique by remember { mutableStateOf("strumming") }
    var difficulty by remember { mutableStateOf("beginner") }
    val exercises = content.rightHand.exercises.filter { it.technique == technique && it.difficulty == difficulty }
    var selectedId by remember { mutableStateOf(exercises.firstOrNull()?.id) }
    val selectedIndex = exercises.indexOfFirst { it.id == selectedId }.coerceAtLeast(0)
    val exercise = exercises.getOrNull(selectedIndex)
    var tempo by remember(exercise?.id) { mutableFloatStateOf((exercise?.bpm ?: 72).toFloat()) }
    var playing by remember { mutableStateOf(false) }
    var sound by remember { mutableStateOf(true) }
    var step by remember(exercise?.id, technique, difficulty) { mutableIntStateOf(0) }
    var roundSeconds by remember { mutableIntStateOf(60) }
    var remaining by remember { mutableIntStateOf(60) }
    var countIn by remember { mutableIntStateOf(0) }
    var loops by remember { mutableIntStateOf(0) }
    var feedback by remember { mutableStateOf(false) }
    var autoRamp by remember { mutableStateOf(true) }
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) playing = false
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(playing, exercise?.id, tempo) {
        if (!playing || exercise == null) return@LaunchedEffect
        feedback = false
        remaining = roundSeconds
        repeat(4) { index ->
            if (!playing) return@LaunchedEffect
            countIn = 4 - index
            if (sound) audio.click(index == 0)
            delay(60_000L / tempo.toInt())
        }
        countIn = 0
        var elapsedMillis = 0L
        while (playing) {
            val token = exercise.pattern[step]
            if (sound && token != "·") audio.click(token.contains("!"))
            val interval = exercise.stepIntervalMillis(tempo.toInt())
            delay(interval)
            elapsedMillis += interval
            step = (step + 1) % exercise.pattern.size
            if (step == 0) loops += 1
            remaining = (roundSeconds - elapsedMillis / 1_000).toInt().coerceAtLeast(0)
            if (elapsedMillis >= roundSeconds * 1_000L) {
                playing = false
                feedback = true
            }
        }
    }

    FeatureList("Right-Hand Studio", "Follow 36 strumming, plectrum, and fingerpicking drills") {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                content.rightHand.techniques.forEach { (id, detail) ->
                    FilterChip(
                        selected = technique == id,
                        onClick = {
                            playing = false; technique = id
                            selectedId = content.rightHand.exercises.firstOrNull { it.technique == id && it.difficulty == difficulty }?.id
                            step = 0
                        },
                        label = { Text(detail.shortLabel) },
                    )
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                content.rightHand.difficulties.forEach { (id, detail) ->
                    FilterChip(
                        selected = difficulty == id,
                        onClick = {
                            playing = false; difficulty = id
                            selectedId = content.rightHand.exercises.firstOrNull { it.technique == technique && it.difficulty == id }?.id
                            step = 0
                        },
                        label = { Text(detail.label) },
                    )
                }
            }
        }
        if (exercise != null) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(exercise.title, style = MaterialTheme.typography.headlineSmall)
                        Text(exercise.focus, style = MaterialTheme.typography.titleMedium)
                        Text(exercise.coaching)
                        Text("${exercise.subdivision} · ${tempo.toInt()} BPM")
                        Text(
                            if (countIn > 0) "GET READY  $countIn" else exercise.pattern.mapIndexed { index, token -> if (index == step) "[$token]" else token }.joinToString("  "),
                            style = MaterialTheme.typography.titleLarge,
                        )
                        Text("Loops $loops · ${remaining / 60}:${(remaining % 60).toString().padStart(2, '0')} remaining")
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(30 to "30 sec", 60 to "1 min", 180 to "3 min").forEach { (seconds, label) ->
                        FilterChip(
                            selected = roundSeconds == seconds,
                            onClick = { playing = false; roundSeconds = seconds; remaining = seconds },
                            label = { Text(label) },
                        )
                    }
                }
                Slider(tempo, { tempo = it }, valueRange = 40f..180f, steps = 139)
                Row {
                    Checkbox(sound, { sound = it })
                    Text("Technique click", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
                }
                Row {
                    Checkbox(autoRamp, { autoRamp = it })
                    Text("Raise tempo after a clean round", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        enabled = selectedIndex > 0,
                        onClick = { playing = false; selectedId = exercises[selectedIndex - 1].id; step = 0 },
                    ) { Text("Previous") }
                    Button(onClick = { playing = !playing }) { Text(if (playing) "Pause" else "Play") }
                    OutlinedButton(
                        enabled = selectedIndex < exercises.lastIndex,
                        onClick = { playing = false; selectedId = exercises[selectedIndex + 1].id; step = 0 },
                    ) { Text("Next") }
                    OutlinedButton(onClick = { tempo = exercise.bpm.toFloat() }) { Text("Default tempo") }
                }
            }
            if (feedback) {
                item {
                    Card(Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("How did it feel?", style = MaterialTheme.typography.titleMedium)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(onClick = {
                                    if (autoRamp) tempo = (tempo + 4).coerceAtMost(180f)
                                    feedback = false; remaining = roundSeconds; step = 0; loops = 0
                                }) { Text("Clean") }
                                OutlinedButton(onClick = { feedback = false; remaining = roundSeconds; step = 0; loops = 0 }) { Text("Mistakes") }
                                OutlinedButton(onClick = {
                                    tempo = (tempo - 6).coerceAtLeast(40f)
                                    feedback = false; remaining = roundSeconds; step = 0; loops = 0
                                }) { Text("Too fast") }
                            }
                        }
                    }
                }
            }
            item {
                Text("Pattern key: ↓/↑ down or up · × mute · — rest · P/i/m/a thumb, index, middle, ring · strings 1–6 high to low.")
            }
            items(exercises) { item ->
                OutlinedButton(
                    onClick = { playing = false; selectedId = item.id; step = 0 },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(item.title) }
            }
        }
    }
}
