import SwiftUI
import UIKit

enum PDFService {
    static func make(title: String, items: [ChordLibraryItem]) -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(title.replacingOccurrences(of: " ", with: "-"))-ChordHero.pdf")
        let bounds = CGRect(x: 0, y: 0, width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: bounds)
        do {
            try renderer.writePDF(to: url) { context in
                let pageItems = items.chunked(into: 9)
                for (page, entries) in pageItems.enumerated() {
                    context.beginPage()
                    NSString(string: page == 0 ? title : "\(title) — continued").draw(at: CGPoint(x: 36, y: 28), withAttributes: [.font: UIFont.boldSystemFont(ofSize: 22)])
                    for (index, entry) in entries.enumerated() {
                        let column = index % 3, row = index / 3
                        let frame = CGRect(x: 36 + CGFloat(column) * 180, y: 80 + CGFloat(row) * 220, width: 160, height: 195)
                        NSString(string: entry.chord.name).draw(at: frame.origin, withAttributes: [.font: UIFont.boldSystemFont(ofSize: 18)])
                        draw(chord: entry.chord, in: CGRect(x: frame.minX + 12, y: frame.minY + 28, width: 118, height: 112), context: context.cgContext)
                        NSString(string: "\(entry.position)\n\(entry.practiceFocus)").draw(in: CGRect(x: frame.minX, y: frame.minY + 145, width: frame.width, height: 48), withAttributes: [.font: UIFont.systemFont(ofSize: 9)])
                    }
                }
            }
            return url
        } catch { return nil }
    }

    private static func draw(chord: ChordDefinition, in frame: CGRect, context: CGContext) {
        let left = frame.minX + 10, right = frame.maxX - 10, top = frame.minY + 16, bottom = frame.maxY - 4
        let stringGap = (right - left) / 5, fretGap = (bottom - top) / 4
        context.setStrokeColor(UIColor.darkGray.cgColor)
        context.setLineWidth(0.8)
        for string in 0..<6 { let x = left + CGFloat(string) * stringGap; context.move(to: CGPoint(x: x, y: top)); context.addLine(to: CGPoint(x: x, y: bottom)); context.strokePath() }
        for fret in 0..<5 { let y = top + CGFloat(fret) * fretGap; context.setLineWidth(fret == 0 && PracticeRules.baseFret(for: chord) == 1 ? 3 : 0.8); context.move(to: CGPoint(x: left, y: y)); context.addLine(to: CGPoint(x: right, y: y)); context.strokePath() }
        let base = PracticeRules.baseFret(for: chord)
        if let barre = chord.barre {
            let y = top + CGFloat(barre.fret - base + 1) * fretGap - fretGap / 2
            let rect = CGRect(x: left + CGFloat(barre.from) * stringGap - 4, y: y - 4, width: CGFloat(barre.to - barre.from) * stringGap + 8, height: 8)
            context.setFillColor(UIColor.systemOrange.cgColor); context.fillEllipse(in: rect)
        }
        for (index, fret) in chord.frets.enumerated() {
            let x = left + CGFloat(index) * stringGap
            if fret <= 0 {
                NSString(string: fret == 0 ? "O" : "X").draw(at: CGPoint(x: x - 4, y: top - 15), withAttributes: [.font: UIFont.boldSystemFont(ofSize: 8)])
            } else {
                let y = top + CGFloat(fret - base + 1) * fretGap - fretGap / 2
                context.setFillColor(UIColor.systemOrange.cgColor); context.fillEllipse(in: CGRect(x: x - 5, y: y - 5, width: 10, height: 10))
            }
        }
    }
}

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [] }
        return stride(from: 0, to: count, by: size).map { Array(self[$0..<Swift.min($0 + size, count)]) }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
