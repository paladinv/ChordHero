import SwiftUI

struct PracticeDashboard: View {
    let content: AppContent
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    DashboardHero()
                    HStack {
                        StudioSectionHeader(title: "Choose your session", subtitle: "Focused tools for deliberate practice")
                        Spacer()
                    }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 16)], spacing: 16) {
                        NavigationLink { TrainerView(content: content) } label: { FeatureCard(number: "01", title: "Chord Trainer", subtitle: "Build speed and accuracy through ten focused changes.", icon: "timer", color: ChordHeroStyle.accent) }
                        NavigationLink { RightHandView(content: content) } label: { FeatureCard(number: "02", title: "Rhythm Studio", subtitle: "Develop a steady feel with guided picking and strumming drills.", icon: "waveform.path", color: ChordHeroStyle.indigo) }
                        NavigationLink { SongCoachView(content: content) } label: { FeatureCard(number: "03", title: "Song Coach", subtitle: "Turn chord shapes into music with paced progressions and tips.", icon: "music.note.list", color: .pink) }
                    }.buttonStyle(.plain)
                }
                .padding(ChordHeroStyle.pagePadding)
            }
            .studioScreenBackground()
            .navigationTitle("Practice")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct DashboardHero: View {
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color(red: 0.13, green: 0.14, blue: 0.21), Color(red: 0.26, green: 0.18, blue: 0.16)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Circle()
                .fill(ChordHeroStyle.accent.opacity(0.22))
                .frame(width: 210, height: 210)
                .blur(radius: 2)
                .offset(x: 125, y: -70)
            Image(systemName: "guitars.fill")
                .font(.system(size: 110, weight: .thin))
                .foregroundStyle(.white.opacity(0.08))
                .offset(x: 220, y: -35)
            VStack(alignment: .leading, spacing: 10) {
                StudioEyebrow(text: "Chord Hero")
                Text("Make every\nchange count.")
                    .font(.system(size: 36, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .lineSpacing(-2)
                Text("Short, intentional sessions build confident hands.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(24)
        }
        .frame(maxWidth: .infinity, minHeight: 230)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: ChordHeroStyle.accent.opacity(0.16), radius: 24, y: 12)
        .accessibilityElement(children: .combine)
    }
}

private struct FeatureCard: View {
    let number: String, title: String, subtitle: String, icon: String
    let color: Color
    var body: some View {
        StudioCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Image(systemName: icon)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(color)
                        .frame(width: 48, height: 48)
                        .background(color.opacity(0.13), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    Spacer()
                    Text(number).font(.caption.bold().monospaced()).foregroundStyle(.tertiary)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(title)
                        .font(.title2.bold())
                        .accessibilityIdentifier(number == "01" ? "Trainer" : title)
                    Text(subtitle).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                HStack {
                    Text("Start session").font(.subheadline.weight(.semibold)).foregroundStyle(color)
                    Spacer()
                    Image(systemName: "arrow.up.right").font(.caption.bold()).foregroundStyle(color)
                }
            }.frame(maxWidth: .infinity, minHeight: 176, alignment: .leading)
        }.foregroundStyle(.primary)
    }
}
