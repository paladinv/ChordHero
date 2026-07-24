import SwiftData
import SwiftUI

@main
struct ChordHeroApp: App {
    @StateObject private var contentStore = ContentStore()
    @StateObject private var audio = SynthAudioService()
    @StateObject private var midi = MIDIService()
    private let container: ModelContainer

    init() {
        do {
            let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                .appendingPathComponent("ChordHero", isDirectory: true)
            try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
            let configuration = ModelConfiguration(url: support.appendingPathComponent("ChordHero.store"))
            container = try ModelContainer(for: StudentProfile.self, ChordProgress.self, CustomPracticePack.self, SongLibraryCollection.self, ImportedSongRecord.self, configurations: configuration)
        } catch {
            let fallback = ModelConfiguration(isStoredInMemoryOnly: true)
            container = try! ModelContainer(for: StudentProfile.self, ChordProgress.self, CustomPracticePack.self, SongLibraryCollection.self, ImportedSongRecord.self, configurations: fallback)
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(contentStore)
                .environmentObject(audio)
                .environmentObject(midi)
        }
        .modelContainer(container)
    }
}

private enum AppSection: Hashable { case practice, songLibrary, library, chart, tools }

struct RootView: View {
    @EnvironmentObject private var store: ContentStore
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var audio: SynthAudioService
    @State private var selection: AppSection = .practice

    var body: some View {
        Group {
            if let content = store.content {
                TabView(selection: $selection) {
                    PracticeDashboard(content: content).tabItem { Label("Practice", systemImage: "guitars") }.tag(AppSection.practice)
                    SongLibraryView(content: content).tabItem { Label("Song Library", systemImage: "music.note.list") }.tag(AppSection.songLibrary)
                    LibraryView(content: content).tabItem { Label("Library", systemImage: "books.vertical") }.tag(AppSection.library)
                    ChordChartView(content: content).tabItem { Label("Chart", systemImage: "rectangle.grid.3x2") }.tag(AppSection.chart)
                    ToolsView(content: content).tabItem { Label("Tools", systemImage: "wrench.and.screwdriver") }.tag(AppSection.tools)
                }
                .tint(ChordHeroStyle.accent)
                .toolbarBackground(.ultraThinMaterial, for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
                .task { _ = try? PersistenceCoordinator.selectedProfile(in: context) }
            } else if let message = store.errorMessage {
                ContentUnavailableView("Content unavailable", systemImage: "exclamationmark.triangle", description: Text(message))
            } else { ProgressView("Loading Chord Hero…") }
        }
        .fontDesign(.rounded)
        .onChange(of: scenePhase) { _, phase in if phase != .active { audio.stop() } }
    }
}
