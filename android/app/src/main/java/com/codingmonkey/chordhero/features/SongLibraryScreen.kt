package com.codingmonkey.chordhero.features

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
import com.codingmonkey.chordhero.data.ImportedSongEntity
import com.codingmonkey.chordhero.data.SongLibraryEntity
import com.codingmonkey.chordhero.data.StudentProfileEntity
import com.codingmonkey.chordhero.domain.ContentBundle
import com.codingmonkey.chordhero.domain.SongDefinition
import com.codingmonkey.chordhero.domain.SongVariation
import kotlinx.coroutines.launch

@Composable
fun SongLibraryScreen(content: ContentBundle, profile: StudentProfileEntity, container: AppContainer, onOpenSong: (String, String) -> Unit) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val collections by container.progress.songLibraries(profile.id).collectAsState(emptyList())
    val importedSongs by container.progress.importedSongs(profile.id).collectAsState(emptyList())
    var query by remember { mutableStateOf("") }
    var technique by remember { mutableStateOf("All") }
    var selectedID by remember { mutableStateOf(content.songs.songs.firstOrNull()?.id) }
    var variationID by remember { mutableStateOf(content.songs.songs.firstOrNull()?.variations?.firstOrNull()?.id) }
    var sourceUrl by remember { mutableStateOf("") }
    var sourceTitle by remember { mutableStateOf("") }
    var sourceArtist by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var renameID by remember { mutableStateOf<String?>(null) }
    var renameName by remember { mutableStateOf("") }

    val songs = remember(content, query, technique) {
        val term = query.trim().lowercase()
        content.songs.songs.filter { song ->
            (technique == "All" || song.variations.any { it.technique == technique }) &&
                (term.isEmpty() || listOf(song.title, song.artist, song.source, song.key, song.timeSignature, song.tags.joinToString()).joinToString(" ").lowercase().contains(term))
        }
    }
    val selected = content.songs.songs.firstOrNull { it.id == selectedID } ?: songs.firstOrNull()
    val variation = selected?.variations?.firstOrNull { it.id == variationID } ?: selected?.variations?.firstOrNull()

    FeatureList("Song Library", "Search fifty traditional songs, save local collections, and choose a practice arrangement") {
        item {
            OutlinedTextField(query, { query = it }, label = { Text("Search title, artist, or tag") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("All", "strumming", "fingerpicking", "plectrum").forEach { value -> FilterChip(technique == value, { technique = value }, { Text(if (value == "All") "All" else value.replaceFirstChar { it.uppercase() }) }) } }
        }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(onClick = { scope.launch { container.progress.saveSongLibrary(SongLibraryEntity(profileId = profile.id, name = "My Songs ${collections.size + 1}")) } }) { Text("New library") }; Text("${songs.size} results", modifier = Modifier.alignByBaseline()) } }
        if (collections.isNotEmpty()) item { Card(Modifier.fillMaxWidth()) { Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { Text("Your collections", style = MaterialTheme.typography.titleMedium); collections.forEach { collection -> Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { if (renameID == collection.id) { OutlinedTextField(renameName, { renameName = it }, label = { Text("Name") }, modifier = Modifier.weight(1f), singleLine = true); Button(onClick = { scope.launch { container.progress.saveSongLibrary(collection.copy(name = renameName.ifBlank { collection.name }, updatedAt = System.currentTimeMillis())); renameID = null } }) { Text("Save") } } else { Text("${collection.name} · ${collection.songIds.size} songs", modifier = Modifier.weight(1f)); OutlinedButton(onClick = { renameID = collection.id; renameName = collection.name }) { Text("Rename") }; OutlinedButton(onClick = { scope.launch { container.progress.deleteSongLibrary(collection.id) } }) { Text("Delete") } } } } } } }
        if (songs.isEmpty()) item { Text("No songs match these filters. Clear a filter or try another search.") }
        else items(songs, key = { it.id }) { song -> OutlinedButton(onClick = { selectedID = song.id; variationID = song.variations.firstOrNull()?.id }, modifier = Modifier.fillMaxWidth()) { Text("${song.title} · ${song.artist} · ${song.timeSignature}") } }
        selected?.let { song ->
            item {
                Card(Modifier.fillMaxWidth()) { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(song.title, style = MaterialTheme.typography.headlineSmall); Text("${song.artist} · ${song.source}"); Text("${song.key} · ${song.timeSignature} · ${song.difficulty}")
                    song.variations.forEach { item -> FilterChip(variation?.id == item.id, { variationID = item.id }, { Text("${item.name} · ${item.technique}") }) }
                    Text(variation?.pattern ?: song.strumPattern, style = MaterialTheme.typography.titleMedium); Text(variation?.feel ?: song.strumFeel)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { variation?.let { onOpenSong(song.id, it.id) } }) { Text("Open Song Coach") }
                        OutlinedButton(onClick = {
                            scope.launch {
                                val target = collections.firstOrNull() ?: SongLibraryEntity(profileId = profile.id, name = "My Songs").also { created -> container.progress.saveSongLibrary(created) }
                                if (!target.songIds.contains(song.id)) container.progress.saveSongLibrary(target.copy(songIds = target.songIds + song.id, updatedAt = System.currentTimeMillis()))
                                message = "Saved to ${target.name}."
                            }
                        }) { Text("Save to library") }
                    }
                    Text("Collections", style = MaterialTheme.typography.titleMedium); collections.forEach { collection -> FilterChip(collection.songIds.contains(song.id), { scope.launch { val ids = if (collection.songIds.contains(song.id)) collection.songIds - song.id else collection.songIds + song.id; container.progress.saveSongLibrary(collection.copy(songIds = ids, updatedAt = System.currentTimeMillis())) } }, { Text(collection.name) }) }
                    if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.primary)
                } }
            }
        }
        item { Text("Ultimate Guitar source link", style = MaterialTheme.typography.titleLarge); Text("Browse the original site, then save metadata and a link locally. Full offline tab/lyric import requires an authorized provider.", color = MaterialTheme.colorScheme.onSurfaceVariant); OutlinedTextField(sourceUrl, { sourceUrl = it }, label = { Text("Source URL") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(sourceTitle, { sourceTitle = it }, label = { Text("Song title") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(sourceArtist, { sourceArtist = it }, label = { Text("Artist") }, modifier = Modifier.fillMaxWidth()); Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(enabled = sourceUrl.isNotBlank(), onClick = { scope.launch { container.progress.saveImportedSong(ImportedSongEntity(profileId = profile.id, title = sourceTitle.ifBlank { "Imported song" }, artist = sourceArtist.ifBlank { "Unknown artist" }, sourceUrl = sourceUrl)); message = "Source link saved." } }) { Text("Save source link") }; OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.ultimate-guitar.com/search.php?search_type=title&value=${Uri.encode(query)}"))) }) { Text("Browse UG") } } }
        if (importedSongs.isNotEmpty()) item { Text("Saved source links", style = MaterialTheme.typography.titleMedium); importedSongs.forEach { song -> OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(song.sourceUrl))) }, modifier = Modifier.fillMaxWidth()) { Text("${song.title} · ${song.artist}") } } }
    }
}
