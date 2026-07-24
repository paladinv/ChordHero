package com.codingmonkey.chordhero.features

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.codingmonkey.chordhero.app.Destination

@Composable
fun DashboardScreen(onNavigate: (Destination) -> Unit) {
    val destinations = Destination.entries.filterNot { it == Destination.Dashboard }
    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Chord Hero", style = MaterialTheme.typography.displaySmall)
        Text("Practice chord changes, right-hand control, songs, and musical understanding—all offline.")
        LazyVerticalGrid(
            columns = GridCells.Adaptive(180.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(destinations) { destination ->
                Card(Modifier.fillMaxWidth().clickable { onNavigate(destination) }) {
                    Row(Modifier.padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(destination.symbol, style = MaterialTheme.typography.headlineMedium)
                        Column {
                            Text(destination.label, style = MaterialTheme.typography.titleMedium)
                            Text(description(destination), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

private fun description(destination: Destination): String = when (destination) {
    Destination.Trainer -> "Timed chord-change rounds"
    Destination.RightHand -> "30 technique exercises"
    Destination.Songs -> "50 guided traditional songs"
    Destination.Library -> "346 chord voicings and study tools"
    Destination.Chart -> "Browse levels and roots"
    Destination.Tools -> "Profiles, packs, and teacher sheets"
    Destination.About -> "Purpose, philosophy, and license"
    Destination.Dashboard -> ""
}
