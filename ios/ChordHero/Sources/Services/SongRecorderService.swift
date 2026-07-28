import AVFoundation
import Foundation

@MainActor
final class SongRecorderService: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var latestURL: URL?
    @Published private(set) var errorMessage: String?
    private var recorder: AVAudioRecorder?
    private var player: AVAudioPlayer?

    func start(songID: String, sectionID: String? = nil) async {
        let permission = await AVAudioApplication.requestRecordPermission()
        guard permission else { errorMessage = "Microphone permission is required to record."; return }
        do {
            let session = AVAudioSession.sharedInstance(); try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP]); try session.setActive(true)
            let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("SongRecordings", isDirectory: true); try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let suffix = sectionID.map { "-\($0)" } ?? ""; let url = directory.appendingPathComponent("\(songID)\(suffix)-\(UUID().uuidString).m4a")
            let settings: [String: Any] = [AVFormatIDKey: Int(kAudioFormatMPEG4AAC), AVSampleRateKey: 44_100, AVNumberOfChannelsKey: 1, AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue]
            let recorder = try AVAudioRecorder(url: url, settings: settings); recorder.delegate = self; recorder.record(); self.recorder = recorder; latestURL = url; isRecording = true; errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func stop() { recorder?.stop(); isRecording = false; try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    func playLatest() { guard let latestURL else { return }; player = try? AVAudioPlayer(contentsOf: latestURL); player?.play() }
    func deleteLatest() { guard let latestURL else { return }; try? FileManager.default.removeItem(at: latestURL); self.latestURL = nil }
}
