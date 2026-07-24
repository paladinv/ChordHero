package com.codingmonkey.chordhero.features

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.codingmonkey.chordhero.app.AppContainer
import com.codingmonkey.chordhero.data.CustomPracticePackEntity
import com.codingmonkey.chordhero.data.PackJson
import com.codingmonkey.chordhero.data.StudentProfileEntity
import com.codingmonkey.chordhero.domain.ContentBundle
import com.codingmonkey.chordhero.domain.ProgressionPack
import kotlinx.coroutines.launch

@Composable
fun ToolsScreen(
    content: ContentBundle,
    currentProfile: StudentProfileEntity,
    container: AppContainer,
    onProfile: (StudentProfileEntity) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val profiles by container.progress.profiles.collectAsState(emptyList())
    val customPacks by container.progress.packs.collectAsState(emptyList())
    var profileName by remember { mutableStateOf("") }
    var packName by remember { mutableStateOf("") }
    var selectedChordIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var pattern by remember { mutableStateOf(content.settings.rightHandPatterns.first()) }
    var message by remember { mutableStateOf("") }
    var teacherKey by remember { mutableStateOf("C") }
    var teacherSkill by remember { mutableStateOf("beginner") }
    var teacherPackId by remember { mutableStateOf<String?>(null) }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        runCatching {
            val packs = customPacks.map { it.toProgressionPack(content) }
            context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { it.write(PackJson.exportLegacy(packs)) }
        }.onSuccess { message = "Practice packs exported." }
            .onFailure { message = it.message ?: "Export failed." }
    }

    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            runCatching {
                val text = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                    ?: error("The selected document could not be read.")
                val packs = PackJson.import(text, content.chords.chordLibrary.map { it.id }.toSet())
                container.progress.addPacksAtomically(
                    packs.map { pack ->
                        CustomPracticePackEntity(
                            id = pack.id,
                            title = pack.title,
                            description = pack.description,
                            keyCenter = pack.keyCenter,
                            focus = pack.focus,
                            rightHandPattern = pack.rightHandPattern,
                            chordIds = pack.chordIds,
                        )
                    },
                )
                packs.size
            }.onSuccess { message = "Imported $it practice pack(s)." }
                .onFailure { message = it.message ?: "Import failed; no data was changed." }
        }
    }

    val teacherChords = remember(content, teacherKey, teacherSkill, teacherPackId, customPacks) {
        val allowed = teacherPackId?.let { id ->
            content.chords.progressionPacks.firstOrNull { it.id == id }?.chordIds
                ?: customPacks.firstOrNull { it.id == id }?.chordIds
        }?.toSet()
        content.chords.chordLibrary.filter {
            it.root == teacherKey && teacherSkill in it.difficultyTags && (allowed == null || it.id in allowed)
        }.take(9)
    }

    FeatureList("Profiles & Teacher Tools", "Local profiles, web-compatible packs, and printable practice sheets") {
        item { Text("Profiles", style = MaterialTheme.typography.titleLarge) }
        items(profiles) { profile ->
            FilterChip(
                selected = profile.id == currentProfile.id,
                onClick = {
                    scope.launch {
                        container.progress.selectProfile(profile.id)
                        onProfile(profile.copy(isSelected = true))
                    }
                },
                label = { Text(profile.name) },
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(profileName, { profileName = it }, label = { Text("Student name") })
                Button(onClick = {
                    scope.launch {
                        val profile = container.progress.createProfile(profileName)
                        container.progress.selectProfile(profile.id)
                        onProfile(profile.copy(isSelected = true))
                        profileName = ""
                    }
                }) { Text("Create") }
            }
        }
        item { Text("Built-in progression packs", style = MaterialTheme.typography.titleLarge) }
        items(content.chords.progressionPacks) { pack ->
            Card(Modifier.fillMaxWidth()) {
                Text("${pack.title} · ${pack.keyCenter}\n${pack.description}\n${pack.progression.joinToString(" – ")}")
            }
        }
        item {
            Text("Custom pack (${selectedChordIds.size}/10)", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(packName, { packName = it }, label = { Text("Pack name") }, modifier = Modifier.fillMaxWidth())
            Text("Choose up to ten voicings from this practical starter set.")
        }
        items(content.chords.chordLibrary.take(30)) { chord ->
            Row {
                Checkbox(
                    checked = chord.id in selectedChordIds,
                    onCheckedChange = { checked ->
                        selectedChordIds = if (checked && selectedChordIds.size < 10) selectedChordIds + chord.id
                        else if (!checked) selectedChordIds - chord.id else selectedChordIds
                    },
                )
                Text("${chord.chord.name} · ${chord.position}", modifier = Modifier.align(androidx.compose.ui.Alignment.CenterVertically))
            }
        }
        item {
            Text("Right-hand pattern")
            content.settings.rightHandPatterns.forEach { value ->
                FilterChip(pattern == value, { pattern = value }, { Text(value) })
            }
            Button(
                enabled = packName.isNotBlank() && selectedChordIds.isNotEmpty(),
                onClick = {
                    scope.launch {
                        container.progress.addPack(
                            CustomPracticePackEntity(
                                title = packName,
                                description = "Custom Android practice pack",
                                keyCenter = "Custom",
                                focus = "Selected voicings",
                                rightHandPattern = pattern,
                                chordIds = selectedChordIds,
                            ),
                        )
                        packName = ""; selectedChordIds = emptyList(); message = "Custom pack created."
                    }
                },
            ) { Text("Create pack") }
        }
        if (customPacks.isNotEmpty()) {
            item { Text("Saved custom packs", style = MaterialTheme.typography.titleMedium) }
            items(customPacks) { pack ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${pack.title} · ${pack.chordIds.size} chords", modifier = Modifier.weight(1f))
                    OutlinedButton(onClick = { scope.launch { container.progress.deletePack(pack.id) } }) { Text("Delete") }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { importLauncher.launch(arrayOf("application/json", "text/json", "text/plain")) }) {
                    Text("Import JSON")
                }
                OutlinedButton(onClick = { exportLauncher.launch("chord-hero-packs.json") }) { Text("Export JSON") }
            }
            if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.primary)
        }
        item {
            Text("Teacher sheet", style = MaterialTheme.typography.titleLarge)
            Text("Key")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf("C", "D", "E", "F", "G", "A", "B").forEach {
                    FilterChip(teacherKey == it, { teacherKey = it }, { Text(it) })
                }
            }
            Text("Skill")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf("beginner", "barre", "color tone").forEach {
                    FilterChip(teacherSkill == it, { teacherSkill = it }, { Text(it) })
                }
            }
            Text("Optional pack")
            FilterChip(teacherPackId == null, { teacherPackId = null }, { Text("Any") })
            (content.chords.progressionPacks.map { it.id to it.title } + customPacks.map { it.id to it.title }).forEach { (id, title) ->
                FilterChip(teacherPackId == id, { teacherPackId = id }, { Text(title) })
            }
            Text("${teacherChords.size} cards (maximum 9)")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    enabled = teacherChords.isNotEmpty(),
                    onClick = {
                        val intent = container.documents.createShareIntent("Teacher Sheet", teacherChords)
                        context.startActivity(Intent.createChooser(intent, "Share teacher sheet"))
                    },
                ) { Text("Share PDF") }
                OutlinedButton(
                    enabled = teacherChords.isNotEmpty(),
                    onClick = { container.documents.print("Chord Hero Teacher Sheet", teacherChords) },
                ) { Text("Print") }
            }
        }
    }
}

private fun CustomPracticePackEntity.toProgressionPack(content: ContentBundle) = ProgressionPack(
    id = id,
    title = title,
    description = description,
    keyCenter = keyCenter,
    focus = focus,
    chordIds = chordIds,
    progression = chordIds.mapNotNull { id -> content.chords.chordLibrary.firstOrNull { it.id == id }?.chord?.name },
    rightHandPattern = rightHandPattern,
)
