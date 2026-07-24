import SwiftData
import SwiftUI

struct SongLibraryView: View {
    let content: AppContent
    @Environment(\.modelContext) private var context
    @Query private var profiles: [StudentProfile]
    @Query(sort: \SongLibraryCollection.createdAt) private var collections: [SongLibraryCollection]
    @Query(sort: \ImportedSongRecord.importedAt, order: .reverse) private var importedSongs: [ImportedSongRecord]
    @State private var search = ""
    @State private var technique = "All"
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
            let text = [song.title, song.artist, song.source, song.key, song.timeSignature, song.tags.joined(separator: " ")].joined(separator: " ").lowercased()
            return techniqueMatch && (term.isEmpty || text.contains(term))
        }
    }
    private var selectedSong: SongDefinition? { content.songs.first(where: { $0.id == selectedID }) ?? songs.first }
    private var selectedCollection: SongLibraryCollection? { collections.first(where: { $0.profileID == profile?.id }) }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 12) {
                StudioSectionHeader(title: "Song Library", subtitle: "Search, save, and arrange your practice catalogue", icon: "music.note.list").padding(.horizontal)
                HStack { Image(systemName: "magnifyingglass"); TextField("Search songs, artists, tags", text: $search) }.padding(11).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)).padding(.horizontal)
                ScrollView(.horizontal, showsIndicators: false) { HStack { filterChip("All", "All"); filterChip("Strum", "strumming"); filterChip("Fingerpick", "fingerpicking"); filterChip("Plectrum", "plectrum") }.padding(.horizontal) }
                HStack { Text("\(songs.count) songs").font(.caption).foregroundStyle(.secondary); Spacer(); Button("New library") { createCollection() } }
                    .padding(.horizontal)
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
            HStack { NavigationLink { SongCoachView(content: content, initialSongID: song.id, initialVariationID: selectedVariationID) } label: { Label("Open Song Coach", systemImage: "play.fill") }.buttonStyle(.borderedProminent); Button("Add to library") { addToCollection(song.id) }.buttonStyle(.bordered) }
            StudioCard { Text("Collections").font(.headline); if let profile { let own = collections.filter { $0.profileID == profile.id }; if own.isEmpty { Text("Create a collection to save this song.").foregroundStyle(.secondary) } else { ForEach(own) { collection in Toggle(collection.name, isOn: Binding(get: { collection.songIDs.contains(song.id) }, set: { enabled in if enabled { addToCollection(song.id, collection: collection) } else { collection.songIDs.removeAll { $0 == song.id }; collection.updatedAt = .now; try? context.save() } })) } } } }
            StudioCard { Text("Manage collections").font(.headline); if let profile { ForEach(collections.filter { $0.profileID == profile.id }) { collection in HStack { TextField("Collection name", text: Binding(get: { collection.name }, set: { collection.name = $0; collection.updatedAt = .now })); Button(role: .destructive) { context.delete(collection); try? context.save() } label: { Image(systemName: "trash") } } } } }
            ForEach(song.sections) { section in StudioCard { Text(section.title).font(.headline); ForEach(Array(section.blocks.enumerated()), id: \.offset) { _, block in if block.type == .lyrics { Text(block.text ?? "") } else if block.type == .tab { Text((block.lines ?? []).joined(separator: "\n")).font(.caption.monospaced()) } } } }
        }
    }

    private func createCollection() { guard let profile else { return }; context.insert(SongLibraryCollection(profileID: profile.id, name: "My Songs \(collections.count + 1)")); try? context.save() }
    private func addToCollection(_ songID: String, collection: SongLibraryCollection? = nil) {
        guard let profile else { return }
        let target = collection ?? collections.first(where: { $0.profileID == profile.id }) ?? { let created = SongLibraryCollection(profileID: profile.id, name: "My Songs"); context.insert(created); return created }()
        if !target.songIDs.contains(songID) { target.songIDs.append(songID); target.updatedAt = .now; try? context.save(); message = "Saved to \(target.name)." }
    }

    private var sourceForm: some View { NavigationStack { Form { TextField("Song title", text: $sourceTitle); TextField("Artist", text: $sourceArtist); TextField("Ultimate Guitar URL", text: $sourceURL); TextField("Practice notes", text: $sourceNotes, axis: .vertical); Section { Text("This saves metadata and a source link only. Full tab and lyric import requires an authorized provider.").font(.caption).foregroundStyle(.secondary) } }.navigationTitle("Save source link").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingSourceForm = false } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { saveSource() }.disabled(sourceURL.isEmpty) } } } }
    private func saveSource() { guard let profile, !sourceURL.isEmpty else { return }; context.insert(ImportedSongRecord(profileID: profile.id, title: sourceTitle.isEmpty ? "Imported song" : sourceTitle, artist: sourceArtist.isEmpty ? "Unknown artist" : sourceArtist, sourceURL: sourceURL, notes: sourceNotes)); try? context.save(); sourceTitle = ""; sourceArtist = ""; sourceURL = ""; sourceNotes = ""; showingSourceForm = false; message = "Source link saved locally." }
}
