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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.codingmonkey.chordhero.R
import com.codingmonkey.chordhero.app.Destination

@Composable
fun DashboardScreen(onNavigate: (Destination) -> Unit) {
    val destinations = Destination.entries.filterNot { it == Destination.Dashboard }
    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Chord Hero", style = MaterialTheme.typography.displaySmall)
        Text(stringResource(R.string.home_intro))
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
                            Text(stringResource(descriptionResource(destination)), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

private fun descriptionResource(destination: Destination): Int = when (destination) {
    Destination.Trainer -> R.string.trainer_description
    Destination.RightHand -> R.string.right_hand_description
    Destination.Songs, Destination.SongLibrary -> R.string.song_coach_description
    Destination.Library -> R.string.library_description
    Destination.Chart -> R.string.chord_chart_description
    Destination.Tools -> R.string.home_intro
    Destination.About -> R.string.about_description
    Destination.Dashboard -> R.string.home_intro
}
