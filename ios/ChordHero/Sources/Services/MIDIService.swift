import CoreMIDI
import Foundation

@MainActor
final class MIDIService: ObservableObject {
    @Published private(set) var status = "MIDI not connected"
    @Published private(set) var lastPitchClass: Int?
    private var client = MIDIClientRef()
    private var inputPort = MIDIPortRef()

    func connect() {
        disconnect()
        let clientStatus = MIDIClientCreateWithBlock("Chord Hero" as CFString, &client) { _ in }
        guard clientStatus == noErr else { status = "MIDI client unavailable"; return }
        let portStatus = MIDIInputPortCreateWithBlock(client, "Chord Hero Input" as CFString, &inputPort) { [weak self] packetList, _ in
            var packet = packetList.pointee.packet
            for _ in 0..<packetList.pointee.numPackets {
                let bytes = Mirror(reflecting: packet.data).children.compactMap { $0.value as? UInt8 }
                if packet.length >= 3, bytes.count >= 3, bytes[0] & 0xF0 == 0x90, bytes[2] > 0 {
                    let pitch = Int(bytes[1] % 12)
                    Task { @MainActor in self?.lastPitchClass = pitch; self?.status = "Last MIDI note: \(Self.noteName(pitch))" }
                }
                packet = withUnsafePointer(to: &packet) { MIDIPacketNext($0).pointee }
            }
        }
        guard portStatus == noErr else { status = "MIDI input unavailable"; return }
        let count = MIDIGetNumberOfSources()
        for index in 0..<count { MIDIPortConnectSource(inputPort, MIDIGetSource(index), nil) }
        status = "\(count) MIDI input\(count == 1 ? "" : "s") connected"
    }

    func disconnect() {
        if inputPort != 0 { MIDIPortDispose(inputPort); inputPort = 0 }
        if client != 0 { MIDIClientDispose(client); client = 0 }
        status = "MIDI not connected"
    }

    nonisolated static func noteName(_ pitch: Int) -> String {
        ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][(pitch % 12 + 12) % 12]
    }

    deinit {
        if inputPort != 0 { MIDIPortDispose(inputPort) }
        if client != 0 { MIDIClientDispose(client) }
    }
}
