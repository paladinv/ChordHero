package com.codingmonkey.chordhero.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.weight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.codingmonkey.chordhero.data.StudentProfileEntity
import com.codingmonkey.chordhero.domain.ContentBundle
import com.codingmonkey.chordhero.domain.ContentLoadResult
import com.codingmonkey.chordhero.features.AboutScreen
import com.codingmonkey.chordhero.features.ChartScreen
import com.codingmonkey.chordhero.features.DashboardScreen
import com.codingmonkey.chordhero.features.LibraryScreen
import com.codingmonkey.chordhero.features.RightHandScreen
import com.codingmonkey.chordhero.features.SongCoachScreen
import com.codingmonkey.chordhero.features.ToolsScreen
import com.codingmonkey.chordhero.features.TrainerScreen
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
enum class Destination(val label: String, val symbol: String) : NavKey {
    Dashboard("Home", "⌂"),
    Trainer("Trainer", "♩"),
    RightHand("Studio", "↕"),
    Songs("Songs", "♫"),
    SongLibrary("Song Library", "♪"),
    Library("Library", "◫"),
    Chart("Chart", "▦"),
    Tools("Tools", "⚙"),
    About("About", "ⓘ"),
}

private val compactDestinations = listOf(
    Destination.Dashboard,
    Destination.Trainer,
    Destination.RightHand,
    Destination.Songs,
    Destination.SongLibrary,
    Destination.Library,
)

@Composable
fun ChordHeroRoot(container: AppContainer) {
    var result by remember { mutableStateOf<ContentLoadResult?>(null) }
    var selectedProfile by remember { mutableStateOf<StudentProfileEntity?>(null) }
    var selectedSongForCoach by remember { mutableStateOf<Pair<String, String>?>(null) }
    val backStack = rememberNavBackStack(Destination.Dashboard)
    val scope = rememberCoroutineScope()
    val destination = backStack.last() as Destination
    val navigate: (Destination) -> Unit = { item ->
        if (backStack.lastOrNull() != item) {
            backStack.add(item)
            scope.launch { container.settings.update { it.copy(destination = item.name) } }
        }
    }
    val expanded = LocalConfiguration.current.screenWidthDp >= 840

    LaunchedEffect(Unit) {
        val savedDestination = container.settings.settings.first().destination
        Destination.entries.firstOrNull { it.name == savedDestination }
            ?.takeIf { it != Destination.Dashboard }
            ?.let { backStack.add(it) }
        result = container.content.load()
        selectedProfile = container.progress.ensureSelectedProfile()
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> runCatching { container.midi.start() }
                Lifecycle.Event.ON_STOP -> {
                    container.audio.stop()
                    container.midi.stop()
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            container.midi.stop()
        }
    }

    when (val state = result) {
        null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        is ContentLoadResult.Failed -> Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Text("Chord Hero could not load its offline content.\n\n${state.message}", color = MaterialTheme.colorScheme.error)
        }
        is ContentLoadResult.Ready -> {
            val profile = selectedProfile
            if (profile == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else {
                if (expanded) {
                    Row(Modifier.fillMaxSize()) {
                        NavigationRail {
                            Destination.entries.forEach { item ->
                                NavigationRailItem(
                                    modifier = Modifier.testTag("nav_${item.name}"),
                                    selected = destination == item,
                                    onClick = { navigate(item) },
                                    icon = { Text(item.symbol) },
                                    label = { Text(item.label) },
                                )
                            }
                        }
                        NavDisplay(
                            backStack = backStack,
                            onBack = { if (backStack.size > 1) backStack.removeLastOrNull() },
                            modifier = Modifier.weight(1f),
                            entryProvider = { key ->
                                val route = key as Destination
                                NavEntry(key) {
                                    Screen(route, state.content, profile, container, onNavigate = navigate, onProfile = { selectedProfile = it }, selectedSongForCoach = selectedSongForCoach, onOpenSong = { songID, variationID -> selectedSongForCoach = songID to variationID; navigate(Destination.Songs) })
                                }
                            },
                        )
                    }
                } else {
                    Scaffold(
                        contentWindowInsets = WindowInsets.safeDrawing,
                        bottomBar = {
                            NavigationBar(windowInsets = WindowInsets.navigationBars) {
                                compactDestinations.forEach { item ->
                                    NavigationBarItem(
                                        modifier = Modifier.testTag("nav_${item.name}"),
                                        selected = destination == item,
                                        onClick = { navigate(item) },
                                        icon = { Text(item.symbol) },
                                        label = { Text(item.label) },
                                    )
                                }
                            }
                        },
                    ) { padding ->
                        NavDisplay(
                            backStack = backStack,
                            onBack = { if (backStack.size > 1) backStack.removeLastOrNull() },
                            modifier = Modifier.padding(padding),
                            entryProvider = { key ->
                                val route = key as Destination
                                NavEntry(key) {
                                    Screen(route, state.content, profile, container, onNavigate = navigate, onProfile = { selectedProfile = it }, selectedSongForCoach = selectedSongForCoach, onOpenSong = { songID, variationID -> selectedSongForCoach = songID to variationID; navigate(Destination.Songs) })
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Screen(
    destination: Destination,
    content: ContentBundle,
    profile: StudentProfileEntity,
    container: AppContainer,
    onNavigate: (Destination) -> Unit,
    onProfile: (StudentProfileEntity) -> Unit,
    selectedSongForCoach: Pair<String, String>?,
    onOpenSong: (String, String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize()) {
        when (destination) {
            Destination.Dashboard -> DashboardScreen(onNavigate)
            Destination.Trainer -> TrainerScreen(content, container.audio)
            Destination.RightHand -> RightHandScreen(content, container.audio)
            Destination.Songs -> SongCoachScreen(content, container.audio, selectedSongForCoach?.first, selectedSongForCoach?.second)
            Destination.SongLibrary -> SongLibraryScreen(content, profile, container, onOpenSong)
            Destination.Library -> LibraryScreen(content, profile, container)
            Destination.Chart -> ChartScreen(content, container)
            Destination.Tools -> ToolsScreen(content, profile, container, onProfile)
            Destination.About -> AboutScreen()
        }
    }
}
