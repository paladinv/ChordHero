import AVFoundation
import Foundation

@MainActor
protocol AudioService: AnyObject {
    func playClick(accent: Bool)
    func play(chord: ChordDefinition, mode: PreviewMode, voice: String, capo: Int, tuningOffsets: [Int])
    func stop()
}

enum PreviewMode { case strum, arpeggio }

@MainActor
final class SynthAudioService: AudioService, ObservableObject {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let sampleRate = 44_100.0
    private var configured = false

    private func configure() {
        guard !configured else { return }
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, options: [.mixWithOthers])
        try? session.setActive(true)
        engine.attach(player)
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        engine.connect(player, to: engine.mainMixerNode, format: format)
        try? engine.start()
        configured = true
    }

    func playClick(accent: Bool) {
        configure()
        schedule(frequencies: [accent ? 1_120 : 760], offsets: [0], duration: 0.08, amplitude: accent ? 0.28 : 0.16, muted: true)
    }

    func play(chord: ChordDefinition, mode: PreviewMode, voice: String, capo: Int, tuningOffsets: [Int]) {
        configure()
        let open = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]
        let frequencies = chord.frets.enumerated().compactMap { index, fret -> Double? in
            guard fret >= 0 else { return nil }
            let offset = index < tuningOffsets.count ? tuningOffsets[index] : 0
            return open[index] * pow(2, Double(fret + capo + offset) / 12)
        }
        let step = mode == .strum ? 0.035 : voice == "picked" ? 0.18 : 0.14
        let offsets = frequencies.indices.map { Double($0) * step }
        schedule(frequencies: frequencies, offsets: offsets, duration: voice == "muted" ? 0.38 : 1.25, amplitude: 0.18, muted: voice == "muted")
    }

    func stop() { player.stop() }

    private func schedule(frequencies: [Double], offsets: [Double], duration: Double, amplitude: Double, muted: Bool) {
        let total = max(0.1, (offsets.last ?? 0) + duration)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(total * sampleRate)),
              let samples = buffer.floatChannelData?[0] else { return }
        buffer.frameLength = buffer.frameCapacity
        for frame in 0..<Int(buffer.frameLength) {
            let time = Double(frame) / sampleRate
            var value = 0.0
            for (index, frequency) in frequencies.enumerated() {
                let local = time - (index < offsets.count ? offsets[index] : 0)
                guard local >= 0, local <= duration else { continue }
                let attack = min(1, local / 0.012)
                let release = max(0, 1 - local / duration)
                let envelope = attack * (muted ? release * release * release : release)
                value += sin(2 * .pi * frequency * local) * amplitude * envelope / Double(max(1, frequencies.count))
            }
            samples[frame] = Float(value)
        }
        player.stop()
        player.scheduleBuffer(buffer)
        player.play()
    }
}
