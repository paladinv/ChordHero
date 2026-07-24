package com.codingmonkey.chordhero.features

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text

@androidx.compose.runtime.Composable
fun AboutScreen() {
    FeatureList("About Chord Hero", "A native, offline practice companion") {
        item {
            Text("Purpose", style = MaterialTheme.typography.titleLarge)
            Text("Chord Hero helps guitar learners connect clean chord shapes, reliable rhythm, musical context, and deliberate repetition.")
        }
        item {
            Text("Practice philosophy", style = MaterialTheme.typography.titleLarge)
            Text("Short, focused sessions beat rushed repetitions. Relax the hands, listen carefully, and make every transition musical.")
        }
        item {
            Text("Privacy", style = MaterialTheme.typography.titleLarge)
            Text("Profiles, notes, favorites, packs, and progress remain on this device. The app contains no accounts, analytics, advertising, or network service.")
        }
        item {
            Text("License", style = MaterialTheme.typography.titleLarge)
            Text("Chord Hero is free software distributed under the GNU General Public License, version 3. Bundled traditional and public-domain song references retain their stated attribution.")
        }
    }
}
