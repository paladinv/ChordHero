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
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) playing = false
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(playing, exercise?.id, tempo) {
        while (playing && exercise != null) {
            val token = exercise.pattern[step]
            if (sound && token != "·") audio.click(token.contains("!"))
            delay(exercise.stepIntervalMillis(tempo.toInt()))
            step = (step + 1) % exercise.pattern.size
        }
    }

    FeatureList("Right-Hand Studio", "Follow 30 strumming, plectrum, and fingerpicking drills") {
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
                            exercise.pattern.mapIndexed { index, token -> if (index == step) "[$token]" else token }.joinToString("  "),
                            style = MaterialTheme.typography.titleLarge,
                        )
                    }
                }
            }
            item {
                Slider(tempo, { tempo = it }, valueRange = 40f..180f, steps = 139)
                Row {
                    Checkbox(sound, { sound = it })
                    Text("Generated click", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
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
            items(exercises) { item ->
                OutlinedButton(
                    onClick = { playing = false; selectedId = item.id; step = 0 },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(item.title) }
            }
        }
    }
}
