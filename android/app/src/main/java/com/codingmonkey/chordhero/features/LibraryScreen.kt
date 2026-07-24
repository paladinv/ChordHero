package com.codingmonkey.chordhero.features

import android.Manifest
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.codingmonkey.chordhero.app.AppContainer
import com.codingmonkey.chordhero.data.ChordProgressEntity
import com.codingmonkey.chordhero.data.StudentProfileEntity
import com.codingmonkey.chordhero.designsystem.ChordDiagram
import com.codingmonkey.chordhero.domain.ChordLibraryItem
import com.codingmonkey.chordhero.domain.ContentBundle
import com.codingmonkey.chordhero.domain.PracticeRules
import com.codingmonkey.chordhero.domain.ReviewRating
import com.codingmonkey.chordhero.services.MidiConnectionState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun LibraryScreen(content: ContentBundle, profile: StudentProfileEntity, container: AppContainer) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val progressList by container.progress.progress(profile.id).collectAsState(emptyList())
    val customPacks by container.progress.packs.collectAsState(emptyList())
    val progressByChord = progressList.associateBy { it.chordId }
    var query by remember { mutableStateOf("") }
    var root by remember { mutableStateOf<String?>(null) }
    var quality by remember { mutableStateOf<String?>(null) }
    var favoritesOnly by remember { mutableStateOf(false) }
    var recentsOnly by remember { mutableStateOf(false) }
    var packId by remember { mutableStateOf<String?>(null) }
    var selectedId by remember { mutableStateOf(content.chords.chordLibrary.first().id) }
    var compareIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var tuning by remember { mutableStateOf(content.settings.tunings.first()) }
    var capo by remember { mutableFloatStateOf(0f) }
    var voice by remember { mutableStateOf("steel") }
    var arpeggio by remember { mutableStateOf(false) }
    val selected = content.chords.chordLibrary.first { it.id == selectedId }
    var note by remember(selectedId, progressByChord[selectedId]?.note) {
        mutableStateOf(progressByChord[selectedId]?.note ?: "")
    }
    var practicing by remember { mutableStateOf(false) }
    var sessionSeconds by remember(selectedId) { mutableIntStateOf(0) }
    var earTarget by remember { mutableStateOf(content.chords.chordLibrary.first()) }
    var earFeedback by remember { mutableStateOf("Choose the target root by touch or MIDI.") }
    val midiState by container.midi.state.collectAsState()
    val bluetoothPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) container.midi.start()
        else earFeedback = "Bluetooth MIDI permission was not granted. USB MIDI and touch answers remain available."
    }
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) practicing = false
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val filtered = content.chords.chordLibrary.filter { chord ->
        val packChordIds = packId?.let { id ->
            content.chords.progressionPacks.firstOrNull { it.id == id }?.chordIds
                ?: customPacks.firstOrNull { it.id == id }?.chordIds
        }
        val haystack = listOf(
            chord.chord.name,
            chord.summary,
            chord.practiceFocus,
            chord.qualityLabel,
            chord.position,
        ).joinToString(" ").lowercase()
        (query.isBlank() || query.lowercase() in haystack) &&
            (root == null || chord.root == root) &&
            (quality == null || chord.quality == quality) &&
            (packChordIds == null || chord.id in packChordIds) &&
            (!favoritesOnly || progressByChord[chord.id]?.favorite == true) &&
            (!recentsOnly || progressByChord[chord.id]?.lastViewedAt != null)
    }.sortedWith(
        if (recentsOnly) compareByDescending { progressByChord[it.id]?.lastViewedAt ?: 0L }
        else compareBy { it.chord.name },
    ).let { if (recentsOnly) it.take(8) else it }

    LaunchedEffect(selectedId) {
        val current = container.progress.progress(profile.id, selectedId)
        container.progress.save(current.copy(lastViewedAt = System.currentTimeMillis()))
    }
    LaunchedEffect(practicing) {
        while (practicing) {
            delay(1_000)
            sessionSeconds += 1
        }
    }
    LaunchedEffect(Unit) {
        container.midi.notes.collect { noteNumber ->
            val matches = PracticeRules.midiMatchesRoot(noteNumber, earTarget.root)
            earFeedback = if (matches) "Correct — ${earTarget.root}." else "That pitch class does not match ${earTarget.root}. Try again."
        }
    }

    FeatureList("Chord Library", "346 voicings · ${profile.name}") {
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search chords and guidance") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(favoritesOnly, { favoritesOnly = !favoritesOnly }, { Text("Favorites") })
                FilterChip(recentsOnly, { recentsOnly = !recentsOnly }, { Text("Recent") })
                OutlinedButton(onClick = { query = ""; root = null; quality = null; packId = null; favoritesOnly = false; recentsOnly = false }) {
                    Text("Clear")
                }
            }
        }
        item {
            Text("Progression pack", style = MaterialTheme.typography.labelLarge)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                FilterChip(packId == null, { packId = null }, { Text("Any") })
                content.chords.progressionPacks.forEach { pack ->
                    FilterChip(packId == pack.id, { packId = pack.id }, { Text(pack.title) })
                }
                customPacks.forEach { pack ->
                    FilterChip(packId == pack.id, { packId = pack.id }, { Text(pack.title) })
                }
            }
        }
        item {
            Text("Root", style = MaterialTheme.typography.labelLarge)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf("C", "D", "E", "F", "G", "A", "B").forEach { value ->
                    FilterChip(root == value, { root = if (root == value) null else value }, { Text(value) })
                }
            }
        }
        item {
            Text("Quality", style = MaterialTheme.typography.labelLarge)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                content.chords.chordLibrary.map { it.quality }.distinct().take(5).forEach { value ->
                    FilterChip(quality == value, { quality = if (quality == value) null else value }, { Text(value) })
                }
            }
        }
        if (filtered.isEmpty()) {
            item { Text("No voicings match these filters. Clear a filter or try another search.") }
        } else {
            item { Text("${filtered.size} results", style = MaterialTheme.typography.titleMedium) }
            items(filtered, key = { it.id }) { chord ->
                OutlinedButton(onClick = { selectedId = chord.id }, modifier = Modifier.fillMaxWidth()) {
                    Text("${chord.chord.name} · ${chord.position} · ${chord.qualityLabel}")
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(PracticeRules.transpose(selected.chord.name, capo.toInt()), style = MaterialTheme.typography.headlineMedium)
                    ChordDiagram(selected.chord)
                    Text(selected.summary)
                    Text("Practice: ${selected.practiceFocus}")
                    Text("Alternate fingering: ${selected.alternateFingerings.joinToString().ifBlank { "Use the displayed fingering." }}")
                    Text("Muting: ${(selected.mutingNotes + selected.avoidStrings).joinToString().ifBlank { "No special muting guidance." }}")
                    Text("Contexts: ${selected.functionContexts.joinToString { "${it.key}: ${it.label}" }.ifBlank { "Explore by sound and voice leading." }}")
                    Text("Tuning: ${tuning.strings.joinToString(" ")}")
                    selected.nearbyAlternatives.forEach { alternative ->
                        alternative.targetId?.let { target ->
                            OutlinedButton(onClick = {
                                root = null; quality = null; packId = null; favoritesOnly = false; recentsOnly = false; selectedId = target
                            }) { Text("${alternative.label}: ${alternative.description}") }
                        }
                    }
                }
            }
        }
        item {
            val current = progressByChord[selectedId] ?: ChordProgressEntity(profile.id, selectedId)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { scope.launch { container.progress.save(current.copy(favorite = !current.favorite)) } }) {
                    Text(if (current.favorite) "Unfavorite" else "Favorite")
                }
                OutlinedButton(onClick = { container.audio.preview(selected.chord, arpeggio, voice) }) { Text("Preview") }
                Row {
                    Checkbox(arpeggio, { arpeggio = it })
                    Text("Arpeggio", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                content.settings.sampleVoices.forEach { value ->
                    FilterChip(voice == value, { voice = value }, { Text(value) })
                }
            }
        }
        item {
            Text("Capo ${capo.toInt()} · ${PracticeRules.transpose(selected.chord.name, capo.toInt())}")
            Slider(capo, { capo = it }, valueRange = 0f..7f, steps = 6)
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                content.settings.tunings.forEach { value ->
                    FilterChip(tuning.id == value.id, { tuning = value }, { Text(value.label) })
                }
            }
        }
        item {
            val current = progressByChord[selectedId] ?: ChordProgressEntity(profile.id, selectedId)
            Text("Practice & review", style = MaterialTheme.typography.titleMedium)
            Text("${current.seconds + sessionSeconds}s · ${current.repetitions} reps · strength ${current.strength} · ${current.misses} misses")
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Button(onClick = {
                    if (practicing) {
                        scope.launch {
                            container.progress.save(current.copy(seconds = current.seconds + sessionSeconds))
                            sessionSeconds = 0
                        }
                    }
                    practicing = !practicing
                }) { Text(if (practicing) "Stop timer" else "Start timer") }
                OutlinedButton(onClick = { scope.launch { container.progress.save(current.copy(repetitions = current.repetitions + 1)) } }) {
                    Text("+ repetition")
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                ReviewRating.entries.forEach { rating ->
                    OutlinedButton(onClick = {
                        scope.launch {
                            container.progress.save(
                                current.copy(
                                    repetitions = current.repetitions + 1,
                                    misses = current.misses + if (rating == ReviewRating.Again) 1 else 0,
                                    strength = PracticeRules.nextStrength(current.strength, rating),
                                    nextReviewAt = PracticeRules.nextReviewMillis(System.currentTimeMillis(), rating),
                                ),
                            )
                        }
                    }) { Text(rating.name) }
                }
            }
            val due = progressList.count { (it.nextReviewAt ?: Long.MAX_VALUE) <= System.currentTimeMillis() }
            val recommendation = content.chords.chordLibrary
                .minByOrNull { progressByChord[it.id]?.strength ?: 0 }?.chord?.name
            Text("$due reviews due · Recommended next: ${recommendation ?: selected.chord.name}")
        }
        item {
            OutlinedTextField(note, { note = it }, label = { Text("Personal note") }, modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                scope.launch {
                    val current = container.progress.progress(profile.id, selectedId)
                    container.progress.save(current.copy(note = note))
                }
            }) { Text("Save note") }
        }
        item {
            Text("Compare voicings", style = MaterialTheme.typography.titleMedium)
            Text("Choose up to three. Shared fretted notes are blue; notes unique to the selected chord are gold.")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                compareIds.forEach { id ->
                    FilterChip(true, { compareIds = compareIds - id }, { Text(content.chords.chordLibrary.first { it.id == id }.chord.name) })
                }
                if (selectedId !in compareIds && compareIds.size < 3) {
                    OutlinedButton(onClick = { compareIds = compareIds + selectedId }) { Text("Add current") }
                }
            }
            compareIds.forEach { id ->
                val chord = content.chords.chordLibrary.first { it.id == id }
                val shared = sharedHighlights(chord, compareIds.map { comparison -> content.chords.chordLibrary.first { it.id == comparison } })
                ChordDiagram(chord.chord, highlights = shared)
            }
            if (compareIds.size >= 2) {
                val compared = compareIds.map { id -> content.chords.chordLibrary.first { it.id == id } }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        val intent = container.documents.createShareIntent("Chord Comparison", compared)
                        context.startActivity(Intent.createChooser(intent, "Share chord comparison"))
                    }) { Text("Share comparison PDF") }
                    OutlinedButton(onClick = { container.documents.print("Chord Hero Chord Comparison", compared) }) {
                        Text("Print")
                    }
                }
            }
        }
        item {
            Text("Ear training", style = MaterialTheme.typography.titleMedium)
            Text("Target: ${earTarget.chord.name} (${earTarget.functionContexts.firstOrNull()?.label ?: "chord name"})")
            Text(earFeedback)
            Text(
                when (val state = midiState) {
                    MidiConnectionState.Unavailable -> "MIDI unavailable — touch answers remain active."
                    MidiConnectionState.Disconnected -> "No MIDI device — connect USB/Bluetooth MIDI or use touch."
                    is MidiConnectionState.Connected -> "MIDI connected: ${state.name}"
                },
            )
            if (midiState == MidiConnectionState.Disconnected) {
                OutlinedButton(onClick = { bluetoothPermission.launch(Manifest.permission.BLUETOOTH_CONNECT) }) {
                    Text("Enable Bluetooth MIDI")
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf("C", "D", "E", "F", "G", "A", "B").forEach { answer ->
                    OutlinedButton(onClick = {
                        earFeedback = if (PracticeRules.pitchClass(answer) == PracticeRules.pitchClass(earTarget.root)) {
                            "Correct — ${earTarget.root}."
                        } else "The answer is ${earTarget.root}."
                    }) { Text(answer) }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { container.audio.preview(earTarget.chord, false, voice) }) { Text("Replay") }
                Button(onClick = {
                    earTarget = content.chords.chordLibrary.random()
                    earFeedback = "Listen, then identify the target root."
                    container.audio.preview(earTarget.chord, false, voice)
                }) { Text("Next question") }
            }
        }
    }
}

private fun sharedHighlights(
    primary: ChordLibraryItem,
    comparisons: List<ChordLibraryItem>,
): Map<Pair<Int, Int>, Color> {
    val counts = comparisons.flatMap { item ->
        item.chord.frets.mapIndexedNotNull { string, fret -> if (fret > 0) string to fret else null }
    }.groupingBy { it }.eachCount()
    return primary.chord.frets.mapIndexedNotNull { string, fret ->
        if (fret <= 0) null else (string to fret) to if ((counts[string to fret] ?: 0) > 1) Color(0xFF3D8CC9) else Color(0xFFF5C451)
    }.toMap()
}
