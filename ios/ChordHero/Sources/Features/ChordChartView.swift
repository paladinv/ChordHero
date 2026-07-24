import SwiftUI

struct ChordChartView: View {
    let content: AppContent
    @State private var grouping = "Levels"
    private var chartItems: [ChordLibraryItem] { content.chords }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    StudioSectionHeader(title: "Shape reference", subtitle: "A clean overview of every bundled voicing", icon: "rectangle.grid.3x2")
                        .padding(.horizontal)
                    Picker("Grouping", selection: $grouping) { Text("Trainer levels").tag("Levels"); Text("Root").tag("Roots") }.pickerStyle(.segmented).padding(.horizontal)
                    if grouping == "Levels" {
                        ForEach(content.levels) { level in chartSection(level.name, subtitle: level.description, items: level.chordIds.compactMap { content.chordByID[$0] }) }
                    } else {
                        ForEach(Set(content.chords.map(\.root)).sorted(), id: \.self) { root in chartSection("\(root) library", subtitle: "All bundled \(root) voicings", items: content.chords.filter { $0.root == root }) }
                    }
                }.padding(.vertical)
            }
            .studioScreenBackground()
            .navigationTitle("Chord Chart")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { if let url = PDFService.make(title: "Chord Hero Chord Chart", items: chartItems) { ShareLink(item: url) { Label("Share PDF", systemImage: "square.and.arrow.up") } } }
        }
    }

    private func chartSection(_ title: String, subtitle: String, items: [ChordLibraryItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            StudioSectionHeader(title: title, subtitle: subtitle)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                ForEach(items) { item in
                    VStack(spacing: 3) { Text(item.chord.name).font(.headline); Text(item.position).font(.caption).foregroundStyle(.secondary); ChordDiagramView(chord: item.chord, compact: true) }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.primary.opacity(0.07)) }
                }
            }
        }.padding(.horizontal)
    }
}
