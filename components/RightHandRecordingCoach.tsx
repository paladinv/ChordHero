"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { analyzePracticeRecording, type PitchScoringMode, type RecordingAnalysis } from "../lib/songRecordingAnalysis";
import { deleteRecording, loadRecording, saveRecording } from "../lib/songRecording";
import RightHandRecordingResults, { type SavedRightHandTake } from "./RightHandRecordingResults";
import type { ChordCalibrationProfile } from "./RightHandChordCalibration";

const ChordCalibrationWizard = dynamic(() => import("./RightHandChordCalibration"), { ssr: false, loading: () => <p>Loading private calibration…</p> });
type InstrumentProfile = "acoustic" | "electric";
type Calibration = { noiseFloor: number; profile: InstrumentProfile; calibratedAt: string };
type PrivacyMode = "device" | "manual" | "teacher";

type Props = {
  bpm: number;
  subdivisionsPerBeat: number;
  expectedSteps: number;
  exerciseId: string;
  expectedChordProgression: string[];
  onAnalysis: (analysis: RecordingAnalysis) => void;
  onLoopTrouble: (start: number, end?: number) => void;
};

const HISTORY_KEY = "chord-hero:right-hand:recording-history:v2";
const CALIBRATION_KEY = "chord-hero:right-hand:microphone-calibration:v1";
const SETTINGS_KEY = "chord-hero:right-hand:recording-settings:v1";
const readJSON = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } };
const download = (blob: Blob, filename: string) => { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); };

export default function RightHandRecordingCoach({ bpm, subdivisionsPerBeat, expectedSteps, exerciseId, expectedChordProgression, onAnalysis, onLoopTrouble }: Props) {
  const [status, setStatus] = useState<"idle" | "recording" | "analysing" | "ready" | "calibrating" | "error">("idle");
  const [analysis, setAnalysis] = useState<RecordingAnalysis | null>(null);
  const [takes, setTakes] = useState<SavedRightHandTake[]>([]);
  const [audioURLs, setAudioURLs] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<InstrumentProfile>("acoustic");
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [chordProfile, setChordProfile] = useState<ChordCalibrationProfile | null>(null);
  const [showChordCalibration, setShowChordCalibration] = useState(false);
  const [scoringMode, setScoringMode] = useState<PitchScoringMode>("quality");
  const [privacy, setPrivacy] = useState<PrivacyMode>("device");
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState("Calibrate once, then record an 8-second take.");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setCalibration(readJSON<Calibration | null>(CALIBRATION_KEY, null));
    const settings = readJSON<{ scoringMode?: PitchScoringMode; privacy?: PrivacyMode }>(SETTINGS_KEY, {});
    if (["timing", "root", "quality"].includes(settings.scoringMode ?? "")) setScoringMode(settings.scoringMode!);
    if (["device", "manual", "teacher"].includes(settings.privacy ?? "")) setPrivacy(settings.privacy!);
    const history = readJSON<Record<string, SavedRightHandTake[]>>(HISTORY_KEY, {})[exerciseId] ?? [];
    setTakes(history.slice(0, 2));
    void Promise.all(history.slice(0, 2).map(async (take) => ({ id: take.id, blob: await loadRecording(take.id) }))).then((items) => setAudioURLs((previous) => {
      Object.values(previous).forEach(URL.revokeObjectURL);
      return Object.fromEntries(items.filter((item) => item.blob).map((item) => [item.id, URL.createObjectURL(item.blob!)]));
    }));
  }, [exerciseId]);

  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ scoringMode, privacy })); }, [privacy, scoringMode]);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => () => Object.values(audioURLs).forEach(URL.revokeObjectURL), [audioURLs]);

  const stop = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
  const handleChordProfile = useCallback((next: ChordCalibrationProfile | null) => setChordProfile(next), []);

  const calibrateRoom = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("error"); setMessage("Microphone calibration is not supported in this browser."); return; }
    try {
      setStatus("calibrating"); setMessage("Stay quiet for two seconds while Chord Hero measures the room.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext(); const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 2048; source.connect(analyser);
      const samples: number[] = []; const data = new Float32Array(analyser.fftSize);
      await new Promise<void>((resolve) => { const sample = () => { analyser.getFloatTimeDomainData(data); samples.push(Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length)); if (samples.length >= 30) resolve(); else timeoutRef.current = window.setTimeout(sample, 50); }; sample(); });
      stream.getTracks().forEach((track) => track.stop()); await context.close(); samples.sort((a, b) => a - b);
      const next = { noiseFloor: Math.round((samples[Math.floor(samples.length * .8)] ?? 0) * 10000) / 10000, profile, calibratedAt: new Date().toISOString() };
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify(next)); setCalibration(next); setStatus("idle");
      setMessage(next.noiseFloor > .035 ? "Room profile saved, but background noise is high. Move closer to the guitar." : "Room profile saved locally. Play at normal practice volume.");
    } catch { setStatus("error"); setMessage("Microphone permission was not granted. Practice remains available."); }
  };

  const retainOnDevice = async (blob: Blob, next: RecordingAnalysis) => {
    const id = `right-hand:${exerciseId}:${Date.now()}`; await saveRecording(id, blob);
    const saved = { id, createdAt: new Date().toISOString(), analysis: next };
    const all = readJSON<Record<string, SavedRightHandTake[]>>(HISTORY_KEY, {}); const previous = all[exerciseId] ?? [];
    const retained = [saved, ...previous].slice(0, 2); all[exerciseId] = retained; localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    await Promise.all(previous.slice(1).map((take) => deleteRecording(take.id)));
    setAudioURLs((urls) => ({ ...urls, [id]: URL.createObjectURL(blob) })); setTakes(retained);
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setStatus("error"); setMessage("Microphone recording is not supported in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); streamRef.current = stream;
      const chunks: Blob[] = []; const recorder = new MediaRecorder(stream); recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); setStatus("analysing");
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" }); setCurrentBlob(blob);
          const room = calibration?.profile === profile ? calibration : null;
          const next = await analyzePracticeRecording(blob, { referenceBpm: bpm, subdivisionsPerBeat, expectedSteps, expectedChordProgression, calibrationNoiseFloor: room?.noiseFloor, instrumentProfile: profile, pitchScoringMode: scoringMode, targetSignatures: chordProfile?.signatures });
          if (privacy === "device") await retainOnDevice(blob, next);
          setAnalysis(next); onAnalysis(next); window.dispatchEvent(new CustomEvent("chord-hero:right-hand-analysis", { detail: { exerciseId, analysis: next } })); setStatus("ready");
          setMessage(privacy === "device" ? "Take scored and retained on this device." : privacy === "manual" ? "Take scored in memory only. Export it now if you want to keep it." : "Take scored in memory only. Teacher-share metadata is ready; audio is not uploaded.");
        } catch { setStatus("error"); setMessage("This take could not be decoded. Try again in a quieter room."); }
      };
      recorder.start(); setStatus("recording"); setMessage("Recording… play the displayed pattern for eight seconds."); timeoutRef.current = window.setTimeout(stop, 8000);
    } catch { setStatus("error"); setMessage("Microphone permission was not granted. You can keep practising without recording."); }
  };

  const exportMetadata = () => { if (!analysis) return; download(new Blob([JSON.stringify({ exerciseId, bpm, createdAt: new Date().toISOString(), scoringMode, privacy: "teacher-share-ready", audioIncluded: false, analysis }, null, 2)], { type: "application/json" }), `chord-hero-${exerciseId}-feedback.json`); };
  const current = analysis ?? takes[0]?.analysis ?? null;
  return <section className="recording-coach" aria-labelledby="recording-coach-title">
    <div className="recording-coach-intro"><span className="label">Listen back</span><h3 id="recording-coach-title">Timing, pitch & chord evidence</h3><p>{message}</p></div>
    <div className="recording-calibration">
      <label>Guitar<select value={profile} onChange={(event) => setProfile(event.target.value as InstrumentProfile)}><option value="acoustic">Acoustic</option><option value="electric">Electric / amplified</option></select></label>
      <button type="button" onClick={() => void calibrateRoom()} disabled={status === "calibrating" || status === "recording"}>{status === "calibrating" ? "Calibrating…" : calibration?.profile === profile ? "Recalibrate room" : "Calibrate room"}</button>
      <button type="button" onClick={() => setShowChordCalibration((value) => !value)} aria-expanded={showChordCalibration} disabled={!expectedChordProgression.length}>{showChordCalibration ? "Close chord setup" : "Calibrate target chords"}</button>
      <small>{calibration?.profile === profile ? `Noise floor ${calibration.noiseFloor.toFixed(3)} · saved locally` : "Room calibration improves onset thresholds; no audio is retained."}</small>
    </div>
    {showChordCalibration ? <ChordCalibrationWizard chords={expectedChordProgression} instrument={profile} onChange={handleChordProfile} /> : null}
    <div className="recording-mode-grid">
      <label>Scoring<select value={scoringMode} onChange={(event) => setScoringMode(event.target.value as PitchScoringMode)}><option value="timing">Timing only</option><option value="root">Chord root evidence</option><option value="quality">Root + quality evidence</option></select></label>
      <label>Recording privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value as PrivacyMode)}><option value="device">Keep last two on device</option><option value="manual">Export manually; do not retain</option><option value="teacher">Teacher-share-ready metadata</option></select></label>
    </div>
    <p className="recording-privacy-note">{privacy === "device" ? "Audio stays in this browser’s private storage until site data is cleared." : privacy === "manual" ? "New audio remains in memory only for this open session. Nothing is uploaded." : "Only a JSON score summary can be prepared. Audio is never attached or uploaded automatically."}</p>
    <div className="recording-actions"><button type="button" onClick={status === "recording" ? stop : () => void start()} disabled={status === "analysing" || status === "calibrating"}>{status === "recording" ? "Stop & score" : status === "analysing" ? "Analysing…" : current ? "Record another take" : "Record 8-sec take"}</button>{currentBlob && privacy !== "device" ? <button type="button" onClick={() => download(currentBlob, `chord-hero-${exerciseId}-take.webm`)}>Export audio manually</button> : null}{analysis && privacy === "teacher" ? <button type="button" onClick={exportMetadata}>Export teacher summary</button> : null}</div>
    {current ? <RightHandRecordingResults current={current} takes={takes} audioURLs={audioURLs} expectedSteps={expectedSteps} subdivisionsPerBeat={subdivisionsPerBeat} onLoopRange={(start, end) => onLoopTrouble(start, end)} /> : null}
  </section>;
}
