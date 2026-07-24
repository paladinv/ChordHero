package com.codingmonkey.chordhero.features

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.codingmonkey.chordhero.app.AppContainer
import com.codingmonkey.chordhero.designsystem.ChordDiagram
import com.codingmonkey.chordhero.domain.ContentBundle

@Composable
fun ChartScreen(content: ContentBundle, container: AppContainer) {
    val context = LocalContext.current
    var levelName by remember { mutableStateOf(content.chords.levels.first().name) }
    var root by remember { mutableStateOf<String?>(null) }
    val level = content.chords.levels.first { it.name == levelName }
    val levelIds = level.chordIds.toSet()
    val chords = content.chords.chordLibrary.filter {
        it.id in levelIds && (root == null || it.root == root)
    }

    FeatureList("Chord Chart", "Grouped by trainer level and root") {
        item {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                content.chords.levels.forEach {
                    FilterChip(levelName == it.name, { levelName = it.name }, { Text(it.name) })
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                listOf<String?>(null, "C", "D", "E", "F", "G", "A", "B").forEach {
                    FilterChip(root == it, { root = it }, { Text(it ?: "All") })
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = {
                    val intent = container.documents.createShareIntent("Chord Chart", chords)
                    context.startActivity(Intent.createChooser(intent, "Share chord chart"))
                }) { Text("Share PDF") }
                OutlinedButton(onClick = { container.documents.print("Chord Hero Chord Chart", chords) }) { Text("Print") }
            }
        }
        items(chords) { item ->
            Text("${item.chord.name} · ${item.position}", style = MaterialTheme.typography.titleLarge)
            ChordDiagram(item.chord, Modifier.fillMaxWidth())
        }
    }
}
