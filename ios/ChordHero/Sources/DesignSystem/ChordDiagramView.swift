import SwiftUI

enum ChordHeroStyle {
    static let accent = Color(red: 0.96, green: 0.55, blue: 0.18)
    static let accentSoft = Color(red: 1.00, green: 0.75, blue: 0.32)
    static let indigo = Color(red: 0.36, green: 0.40, blue: 0.82)
    static let cornerRadius: CGFloat = 22
    static let pagePadding: CGFloat = 18
}

struct StudioBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
            LinearGradient(
                colors: colorScheme == .dark
                    ? [Color(red: 0.08, green: 0.09, blue: 0.13), Color(red: 0.05, green: 0.06, blue: 0.09)]
                    : [Color(red: 0.98, green: 0.96, blue: 0.92), Color(red: 0.94, green: 0.95, blue: 0.98)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [ChordHeroStyle.accent.opacity(colorScheme == .dark ? 0.13 : 0.09), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 420
            )
        }
        .ignoresSafeArea()
    }
}

struct ChordDiagramView: View {
    let chord: ChordDefinition
    var compact = false

    var body: some View {
        Canvas { context, size in
            let insetX = size.width * 0.14
            let top = size.height * 0.17
            let bottom = size.height * 0.9
            let width = size.width - insetX * 2
            let stringGap = width / 5
            let fretGap = (bottom - top) / 4
            let base = PracticeRules.baseFret(for: chord)
            for string in 0..<6 {
                var path = Path()
                let x = insetX + CGFloat(string) * stringGap
                path.move(to: CGPoint(x: x, y: top)); path.addLine(to: CGPoint(x: x, y: bottom))
                context.stroke(path, with: .color(.secondary), lineWidth: 1)
            }
            for fret in 0..<5 {
                var path = Path()
                let y = top + CGFloat(fret) * fretGap
                path.move(to: CGPoint(x: insetX, y: y)); path.addLine(to: CGPoint(x: insetX + width, y: y))
                context.stroke(path, with: .color(.primary), lineWidth: fret == 0 && base == 1 ? 4 : 1)
            }
            if let barre = chord.barre {
                let y = top + CGFloat(barre.fret - base + 1) * fretGap - fretGap / 2
                let rect = CGRect(x: insetX + CGFloat(barre.from) * stringGap - 7, y: y - 7, width: CGFloat(barre.to - barre.from) * stringGap + 14, height: 14)
                context.fill(Path(roundedRect: rect, cornerRadius: 7), with: .color(.accentColor))
            }
            for (index, fret) in chord.frets.enumerated() {
                let x = insetX + CGFloat(index) * stringGap
                if fret <= 0 {
                    let marker = Text(fret == 0 ? "○" : "×").font(.caption.bold()).foregroundStyle(fret == 0 ? Color.green : Color.secondary)
                    context.draw(context.resolve(marker), at: CGPoint(x: x, y: top - 15))
                } else {
                    let position = fret - base + 1
                    let y = top + CGFloat(position) * fretGap - fretGap / 2
                    context.fill(Path(ellipseIn: CGRect(x: x - 10, y: y - 10, width: 20, height: 20)), with: .color(.accentColor))
                    if index < chord.fingers.count, let finger = chord.fingers[index] {
                        context.draw(context.resolve(Text("\(finger)").font(.caption.bold()).foregroundStyle(.white)), at: CGPoint(x: x, y: y))
                    }
                }
            }
            if base > 1 { context.draw(context.resolve(Text("\(base)fr").font(.caption2)), at: CGPoint(x: size.width - 18, y: top + fretGap / 2)) }
        }
        .frame(width: compact ? 130 : 210, height: compact ? 150 : 240)
        .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Chord diagram for \(chord.name)")
    }
}

struct StudioCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            content
        }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: ChordHeroStyle.cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: ChordHeroStyle.cornerRadius, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.07), radius: 18, y: 8)
    }
}

struct StudioSectionHeader: View {
    let title: String
    var subtitle: String? = nil
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            if let icon {
                Image(systemName: icon)
                    .font(.headline)
                    .foregroundStyle(ChordHeroStyle.accent)
                    .frame(width: 36, height: 36)
                    .background(ChordHeroStyle.accent.opacity(0.13), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.title3.weight(.bold))
                if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) }
            }
            Spacer(minLength: 0)
        }
    }
}

struct StudioEyebrow: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.bold))
            .tracking(1.4)
            .foregroundStyle(ChordHeroStyle.accent)
    }
}

extension View {
    func studioScreenBackground() -> some View {
        scrollContentBackground(.hidden)
            .background { StudioBackground() }
    }

    func studioTitle(_ title: String, subtitle: String) -> some View {
        safeAreaInset(edge: .top) {
            VStack(alignment: .leading, spacing: 4) { Text(title).font(.largeTitle.bold()); Text(subtitle).foregroundStyle(.secondary) }
                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal).padding(.vertical, 10).background(.bar)
        }
    }
}
