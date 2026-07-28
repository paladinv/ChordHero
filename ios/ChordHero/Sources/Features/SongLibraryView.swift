import SwiftData
import SwiftUI

struct SongLibraryView: View {
    let content: AppContent
    @Environment(\.modelContext) private var context
    @Query private var profiles: [StudentProfile]
    @Query(sort: \SongLibraryCollection.createdAt) private var collections: [SongLibraryCollection]
    @Query(sort: \ImportedSongRecord.importedAt, order: .reverse) private var importedSongs: [ImportedSongRecord]
    @Query private var practiceRecords: [SongPracticeRecord]
    @Query(sort: \WeeklyPracticeGoal.weekStart, order: .reverse) private var weeklyGoals: [WeeklyPracticeGoal]
    @Query(sort: \SongQueueHistory.completedAt, order: .reverse) private var queueHistory: [SongQueueHistory]
    @State private var search = ""
    @State private var technique = "All"
    @State private var favoritesOnly = false
    @State private var selectedID: String?
    @State private var selectedVariationID: String?
    @State private var showingSourceForm = false
    @State private var sourceTitle = ""
    @State private var sourceArtist = ""
    @State private var sourceURL = ""
    @State private var sourceNotes = ""
    @State private var message = ""

    private var profile: StudentProfile? { profiles.first(where: \.isSelected) ?? profiles.first }
    private var songs: [SongDefinition] {
        let term = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return content.songs.filter { song in
            let techniqueMatch = technique == "All" || song.variations.contains { $0.technique == technique }
            let favoriteMatch = !favoritesOnly || practiceRecords.contains { $0.profileID == profile?.id && $0.songID == song.id && $0.isFavorite }
            let text = [song.title, song.artist, song.source, song.key, song.timeSignature, song.tags.joined(separator: " ")].joined(separator: " ").lowercased()
            return techniqueMatch && favoriteMatch && (term.isEmpty || text.contains(term))
        }.sorted { $0.title < $1.title }
    }
    private var selectedSong: SongDefinition? { content.songs.first(where: { $0.id == selectedID }) ?? songs.first }
    private var selectedCollection: SongLibraryCollection? { collections.first(where: { $0.profileID == profile?.id }) }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 12) {
                StudioSectionHeader(title: "Song Library", subtitle: "Search, save, and arrange your practice catalogue", icon: "music.note.list").padding(.horizontal)
                HStack { Image(systemName: "magnifyingglass"); TextField("Search songs, artists, tags", text: $search) }.padding(11).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)).padding(.horizontal)
                ScrollView(.horizontal, showsIndicators: false) { HStack { filterChip("All", "All"); filterChip("Strum", "strumming"); filterChip("Fingerpick", "fingerpicking"); filterChip("Plectrum", "plectrum"); Button(favoritesOnly ? "★ Favorites" : "☆ Favorites") { favoritesOnly.toggle() }.buttonStyle(.bordered).tint(favoritesOnly ? ChordHeroStyle.accent : .gray) }.padding(.horizontal) }
                HStack { Text("\(songs.count) songs").font(.caption).foregroundStyle(.secondary); Spacer(); Button("New library") { createCollection() } }
                    .padding(.horizontal)
                if let goal = weeklyGoals.first(where: { $0.profileID == profile?.id }) { StudioCard { Text("Weekly goal: \(goal.completedSessions)/\(goal.targetSessions) sessions"); ProgressView(value: Double(goal.completedSessions), total: Double(max(1, goal.targetSessions))) } .padding(.horizontal) }
                if !importedSongs.isEmpty { Text("Saved source links").font(.caption.weight(.semibold)).foregroundStyle(.secondary).padding(.horizontal); ForEach(importedSongs) { imported in if let url = URL(string: imported.sourceURL) { Link(destination: url) { Label("\(imported.title) · \(imported.artist)", systemImage: "link") }.padding(.horizontal) } } }
                List(songs, selection: $selectedID) { song in
                    VStack(alignment: .leading, spacing: 3) { Text(song.title).font(.headline); Text("\(song.artist) · \(song.difficulty) · \(song.timeSignature)").font(.caption).foregroundStyle(.secondary) }.tag(song.id).listRowBackground(Color.clear)
                }.listStyle(.plain).scrollContentBackground(.hidden)
            }.background { StudioBackground() }.navigationTitle("Song Library").navigationBarTitleDisplayMode(.inline)
        } detail: {
            if let song = selectedSong {
                ScrollView { detail(song).padding(ChordHeroStyle.pagePadding) }.studioScreenBackground().navigationTitle(song.title).navigationBarTitleDisplayMode(.inline)
            } else { ContentUnavailableView("No songs found", systemImage: "music.note.list", description: Text("Try a different search.")) }
        }
        .sheet(isPresented: $showingSourceForm) { sourceForm }
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Save source link") { showingSourceForm = true } } }
        .alert("Song Library", isPresented: Binding(get: { !message.isEmpty }, set: { if !$0 { message = "" } })) { Button("OK", role: .cancel) { message = "" } } message: { Text(message) }
    }

    private func filterChip(_ title: String, _ value: String) -> some View { Button(title) { technique = value }.buttonStyle(.borderedProminent).tint(technique == value ? ChordHeroStyle.accent : .gray) }

    @ViewBuilder private func detail(_ song: SongDefinition) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            StudioSectionHeader(title: song.title, subtitle: "\(song.artist) · \(song.source)", icon: "music.note")
            HStack { Label(song.key, systemImage: "music.quarternote.3"); Label(song.timeSignature, systemImage: "metronome"); Label(song.difficulty.capitalized, systemImage: "chart.bar") }.font(.caption).foregroundStyle(.secondary)
            StudioCard { Text("Practice variations").font(.headline); ForEach(song.variations) { variation in Button { selectedVariationID = variation.id } label: { HStack { VStack(alignment: .leading) { Text(variation.name).bold(); Text("\(variation.technique.capitalized) · \(variation.key) · \(variation.timeSignature) · \(variation.bpm) BPM").font(.caption).foregroundStyle(.secondary); Text(variation.pattern).font(.caption.monospaced()) }; Spacer(); if selectedVariationID == variation.id { Image(systemName: "checkmark.circle.fill").foregroundStyle(ChordHeroStyle.accent) } } }.buttonStyle(.plain); Divider() } }
            HStack { NavigationLink { SongCoachView(content: content, initialSongID: song.id, initialVariationID: selectedVariationID) } label: { Label("Open Song Coach", systemImage: "play.fill") }.buttonStyle(.borderedProminent); Button("Add to library") { addToCollection(song.id) }.buttonStyle(.bordered); Button(isFavorite(song.id) ? "★ Favorite" : "☆ Favorite") { toggleFavorite(song.id) }.buttonStyle(.bordered) }
            if let record = practiceRecords.first(where: { $0.profileID == profile?.id && $0.songID == song.id }), record.practiceCount > 0 { Text("Practiced \(record.practiceCount) time(s)").font(.caption).foregroundStyle(.secondary) }
            StudioCard { Text("Collections").font(.headline); if let profile { let own = collections.filter { $0.profileID == profile.id }; if own.isEmpty { Text("Create a collection to save this song.").foregroundStyle(.secondary) } else { ForEach(own) { collection in Toggle(collection.name, isOn: Binding(get: { collection.songIDs.contains(song.id) }, set: { enabled in if enabled { addToCollection(song.id, collection: collection) } else { collection.songIDs.removeAll { $0 == song.id }; collection.updatedAt = .now; try? context.save() } })) } } } }
            StudioCard { Text("Manage collections").font(.headline); if let profile { ForEach(collections.filter { $0.profileID == profile.id }) { collection in HStack { TextField("Collection name", text: Binding(get: { collection.name }, set: { collection.name = $0; collection.updatedAt = .now })); Button(role: .destructive) { context.delete(collection); try? context.save() } label: { Image(systemName: "trash") } } } } }
            ForEach(song.sections) { section in StudioCard { let value = mastery(song.id, section.id); Text("\(section.title) · \(value)% mastered").font(.headline); Slider(value: Binding(get: { Double(value) }, set: { setMastery(song.id, sectionID: section.id, value: Int($0)) }), in: 0...100, step: 10); ForEach(Array(section.blocks.enumerated()), id: \.offset) { _, block in if block.type == .lyrics { Text(block.text ?? "") } else if block.type == .tab { Text((block.lines ?? []).joined(separator: "\n")).font(.caption.monospaced()) } } } }
            if !queueHistory.isEmpty { Text("Last queue completed \(queueHistory[0].completedAt.formatted(date: .abbreviated, time: .omitted))").font(.caption).foregroundStyle(.secondary) }
        }
    }

    private func createCollection() { guard let profile else { return }; context.insert(SongLibraryCollection(profileID: profile.id, name: "My Songs \(collections.count + 1)")); try? context.save() }
    private func mastery(_ songID: String, _ sectionID: String) -> Int { guard let record = practiceRecords.first(where: { $0.profileID == profile?.id && $0.songID == songID }), let data = record.sectionMasteryJSON.data(using: .utf8), let values = try? JSONSerialization.jsonObject(with: data) as? [String: Int] else { return 0 }; return values[sectionID] ?? 0 }
    private func setMastery(_ songID: String, sectionID: String, value: Int) { guard let profile else { return }; let record = practiceRecords.first(where: { $0.profileID == profile.id && $0.songID == songID }) ?? { let created = SongPracticeRecord(profileID: profile.id, songID: songID); context.insert(created); return created }(); var values = (try? JSONSerialization.jsonObject(with: Data(record.sectionMasteryJSON.utf8)) as? [String: Int]) ?? [:]; values[sectionID] = value; if let data = try? JSONSerialization.data(withJSONObject: values), let json = String(data: data, encoding: .utf8) { record.sectionMasteryJSON = json; try? context.save() } }
    private func isFavorite(_ songID: String) -> Bool { practiceRecords.first(where: { $0.profileID == profile?.id && $0.songID == songID })?.isFavorite ?? false }
    private func toggleFavorite(_ songID: String) {
        guard let profile else { return }
        let record = practiceRecords.first(where: { $0.profileID == profile.id && $0.songID == songID }) ?? { let created = SongPracticeRecord(profileID: profile.id, songID: songID); context.insert(created); return created }()
        record.isFavorite.toggle(); try? context.save()
    }
    private func addToCollection(_ songID: String, collection: SongLibraryCollection? = nil) {
        guard let profile else { return }
        let target = collection ?? collections.first(where: { $0.profileID == profile.id }) ?? { let created = SongLibraryCollection(profileID: profile.id, name: "My Songs"); context.insert(created); return created }()
        if !target.songIDs.contains(songID) { target.songIDs.append(songID); target.updatedAt = .now; try? context.save(); message = "Saved to \(target.name)." }
    }

    private var sourceForm: some View { NavigationStack { Form { TextField("Song title", text: $sourceTitle); TextField("Artist", text: $sourceArtist); TextField("Ultimate Guitar URL", text: $sourceURL); TextField("Practice notes", text: $sourceNotes, axis: .vertical); Section { Text("This saves metadata and a source link only. Full tab and lyric import requires an authorized provider.").font(.caption).foregroundStyle(.secondary) } }.navigationTitle("Save source link").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingSourceForm = false } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { saveSource() }.disabled(sourceURL.isEmpty) } } } }
    private func saveSource() {
        guard let profile, !sourceURL.isEmpty else { return }
        let title = sourceTitle.isEmpty ? "Imported song" : sourceTitle
        let artist = sourceArtist.isEmpty ? "Unknown artist" : sourceArtist
        let normalize: (String) -> String = { value in value.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) }
        let duplicate = importedSongs.contains { imported in
            normalize(imported.sourceURL) == normalize(sourceURL) || (normalize(imported.title) == normalize(title) && normalize(imported.artist) == normalize(artist))
        }
        if duplicate { message = "That source or song is already saved."; return }
        context.insert(ImportedSongRecord(profileID: profile.id, title: title, artist: artist, sourceURL: sourceURL, notes: sourceNotes))
        try? context.save(); sourceTitle = ""; sourceArtist = ""; sourceURL = ""; sourceNotes = ""; showingSourceForm = false; message = "Source link saved locally."
    }
}
