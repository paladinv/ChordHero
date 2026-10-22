"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { analyzePracticeRecording, type PitchScoringMode, type RecordingAnalysis } from "../lib/songRecordingAnalysis";
import { useRightHandCapture } from "../lib/rightHandCapture";
import { reviewRightHandTake, useRightHandTakeLibrary } from "../lib/rightHandTakeLibrary";
import RightHandRecordingResults from "./RightHandRecordingResults";
import RightHandTapCalibration from "./RightHandTapCalibration";
import type { ChordCalibrationProfile } from "./RightHandChordCalibration";
import { DEFAULT_TIMING_PROFILE, timingProfile } from "../lib/rightHandTimingReview";
import type { ReferenceVoice } from "../lib/rightHandReferenceAudio";

const ChordCalibrationWizard = dynamic(() => import("./RightHandChordCalibration"), { ssr: false, loading: () => <p>Loading calibration…</p> });
const StorageManager = dynamic(() => import("./RightHandStorageManager"), { ssr: false });
const AudioEvaluation = dynamic(() => import("./RightHandAudioEvaluation"), { ssr: false });
const TimingProfile = dynamic(() => import("./RightHandTimingProfile"), { ssr: false });
type InstrumentProfile = "acoustic" | "electric";
type Calibration = { noiseFloor: number; profile: InstrumentProfile; calibratedAt: string; timingOffsetMs?: number };
type PrivacyMode = "device" | "manual" | "teacher";

type Props = {
  bpm: number;
  subdivisionsPerBeat: number;
  expectedSteps: number;
  exerciseId: string;
  expectedChordProgression: string[];
  onAnalysis: (analysis: RecordingAnalysis) => void;
  onLoopTrouble: (start: number, end?: number) => void;
  onBeforeRecord?: () => void | Promise<void>;
  expectedPattern?: string[];
  expectedAccents?: number[];
  onRetryRange?: (start: number, end: number) => void;
  targetTechnique?: ReferenceVoice["technique"];
  targetSound?: ReferenceVoice["sound"];
};

const CALIBRATION_KEY = "chord-hero:right-hand:microphone-calibration:v1";
const SETTINGS_KEY = "chord-hero:right-hand:recording-settings:v1";
const readJSON = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } };
const download = (blob: Blob, filename: string) => { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); };

export default function RightHandRecordingCoach({ bpm, subdivisionsPerBeat, expectedSteps, exerciseId, expectedChordProgression, onAnalysis, onLoopTrouble, onBeforeRecord, expectedPattern, expectedAccents, onRetryRange, targetTechnique, targetSound }: Props) {
  const [status, setStatus] = useState<"idle" | "requesting" | "recording" | "analysing" | "ready" | "calibrating" | "error">("idle");
  const [analysis, setAnalysis] = useState<RecordingAnalysis | null>(null);
  const [profile, setProfile] = useState<InstrumentProfile>("acoustic");
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [chordProfile, setChordProfile] = useState<ChordCalibrationProfile | null>(null);
  const [showChordCalibration, setShowChordCalibration] = useState(false);
  const [timingBusy, setTimingBusy] = useState(false);
  const [chordBusy, setChordBusy] = useState(false);
  const [scoringMode, setScoringMode] = useState<PitchScoringMode>("quality");
  const [privacy, setPrivacy] = useState<PrivacyMode>("device");
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [personalTiming, setPersonalTiming] = useState(DEFAULT_TIMING_PROFILE);
  const [message, setMessage] = useState("Calibrate, then record a take.");
  const capture = useRightHandCapture(exerciseId);
  const { takes, audioURLs, retain, updateTake } = useRightHandTakeLibrary(exerciseId, setMessage);
  const recordingStartedAtRef = useRef(0);
  const playCueAtRef = useRef(0);

  useEffect(() => {
    setCalibration(readJSON<Calibration | null>(CALIBRATION_KEY, null));
    const settings = readJSON<{ scoringMode?: PitchScoringMode; privacy?: PrivacyMode }>(SETTINGS_KEY, {});
    if (["timing", "root", "quality"].includes(settings.scoringMode ?? "")) setScoringMode(settings.scoringMode!);
    if (["device", "manual", "teacher"].includes(settings.privacy ?? "")) setPrivacy(settings.privacy!);
    setAnalysis(null); setCurrentBlob(null); setChordProfile(null); setStatus("idle");
    setMessage("Calibrate, then record a take.");
  }, [exerciseId]);

  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ scoringMode, privacy })); }, [privacy, scoringMode]);
  const stop = () => { if (capture.recorder.current?.state === "recording") capture.recorder.current.stop(); };
  const handleChordProfile = useCallback((next: ChordCalibrationProfile | null) => setChordProfile(next), []);

  const calibrateRoom = async () => {
    if (timingBusy || chordBusy) return;
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("error"); setMessage("Microphone calibration is not supported in this browser."); return; }
    const token = capture.begin(); if (token === null) return;
    try {
      await onBeforeRecord?.(); if (!capture.valid(token)) return;
      setStatus("calibrating"); setMessage("Stay quiet for two seconds while Chord Hero measures the room.");
      const stream = await capture.microphone(token); if (!stream) return;
      const context = new AudioContext(); capture.context.current = context; const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 2048; source.connect(analyser);
      const samples: number[] = []; const data = new Float32Array(analyser.fftSize);
      await new Promise<void>((resolve) => { const sample = () => { if (!capture.valid(token)) { resolve(); return; } analyser.getFloatTimeDomainData(data); samples.push(Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length)); if (samples.length >= 30) resolve(); else capture.later(token, sample, 50); }; sample(); });
      if (!capture.valid(token)) return;
      capture.cleanup(); samples.sort((a, b) => a - b);
      const next = { noiseFloor: Math.round((samples[Math.floor(samples.length * .8)] ?? 0) * 10000) / 10000, profile, calibratedAt: new Date().toISOString(), timingOffsetMs: calibration?.timingOffsetMs };
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify(next)); setCalibration(next); setStatus("idle");
      setMessage(next.noiseFloor > .035 ? "Room profile saved, but background noise is high. Move closer to the guitar." : "Room profile saved locally. Play at normal practice volume.");
    } catch { if (capture.valid(token)) { capture.cleanup(); setStatus("error"); setMessage("Microphone permission was not granted. Practice remains available."); } }
  };

  const saveTimingOffset = (timingOffsetMs?: number) => {
    const next = { noiseFloor: calibration?.noiseFloor ?? 0, profile, calibratedAt: new Date().toISOString(), timingOffsetMs };
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(next)); setCalibration(next);
  };

  const start = async () => {
    if (timingBusy || chordBusy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setStatus("error"); setMessage("Microphone recording is not supported in this browser."); return; }
    const token = capture.begin(); if (token === null) return;
    const practiceContext = { bpm, pattern: [...(expectedPattern ?? [])], chordProgression: [...expectedChordProgression] };
    const personalSnapshot = timingProfile(personalTiming);
    try {
      setStatus("requesting");
      await onBeforeRecord?.(); if (!capture.valid(token)) return;
      const stream = await capture.microphone(token); if (!stream) return;
      const chunks: Blob[] = []; const recorder = new MediaRecorder(stream); capture.recorder.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        if (!capture.valid(token)) return;
        stream.getTracks().forEach((track) => track.stop()); setStatus("analysing");
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const room = calibration?.profile === profile ? calibration : null;
          const expectedFirstOnsetMs = Math.max(0, playCueAtRef.current - recordingStartedAtRef.current);
          const next = await analyzePracticeRecording(blob, { referenceBpm: bpm, subdivisionsPerBeat, expectedSteps, expectedPattern: practiceContext.pattern, expectedAccents, expectedChordProgression: practiceContext.chordProgression, calibrationNoiseFloor: room?.noiseFloor, instrumentProfile: profile, pitchScoringMode: scoringMode, targetSignatures: chordProfile?.signatures, inputLatencyMs: room?.timingOffsetMs, expectedFirstOnsetMs, timingProfile: personalSnapshot });
          next.practiceContext = practiceContext;
          next.referenceVoice = { technique: targetTechnique, sound: targetSound };
          next.recordingId = `right-hand:${exerciseId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`; next.reviewAccepted = true;
          next.retained = privacy === "device";
          if (!capture.valid(token)) return;
          if (privacy === "device") await retain(blob, next);
          if (!capture.valid(token)) return;
          setCurrentBlob(blob); setAnalysis(next); onAnalysis(next); window.dispatchEvent(new CustomEvent("chord-hero:right-hand-analysis", { detail: { exerciseId, analysis: next } })); setStatus("ready");
          setMessage(privacy === "device" ? "Take scored and retained on this device." : privacy === "manual" ? "Take scored in memory only. Export it now if you want to keep it." : "Take scored in memory only. Teacher-share metadata is ready; audio is not uploaded.");
          capture.cleanup();
        } catch { if (capture.valid(token)) { capture.cleanup(); setStatus("error"); setMessage("This take could not be decoded. Try again in a quieter room."); } }
      };
      recorder.onstart = () => {
        recordingStartedAtRef.current = performance.now(); playCueAtRef.current = recordingStartedAtRef.current + 1200;
        setStatus("recording"); setMessage("Get ready… start at PLAY. Practice audio is paused.");
        capture.later(token, () => setMessage("PLAY · selected tempo. Wear headphones for external reference."), 1200);
        capture.later(token, stop, 9200);
      };
      recorder.start();
    } catch { if (capture.valid(token)) { capture.cleanup(); setStatus("error"); setMessage("Microphone permission was not granted. You can keep practising without recording."); } }
  };

  const exportMetadata = () => { if (!analysis) return; download(new Blob([JSON.stringify({ exerciseId, bpm, createdAt: new Date().toISOString(), scoringMode, privacy: "teacher-share-ready", audioIncluded: false, analysis }, null, 2)], { type: "application/json" }), `chord-hero-${exerciseId}-feedback.json`); };
  const current = analysis ?? takes[0]?.analysis ?? null;
  const review = (recordingId: string, reviewAccepted: boolean) => {
    reviewRightHandTake(recordingId, reviewAccepted);
    setAnalysis((previous) => previous?.recordingId === recordingId ? { ...previous, reviewAccepted } : previous);
    window.dispatchEvent(new CustomEvent("chord-hero:right-hand-review", { detail: { exerciseId, recordingId, reviewAccepted } }));
  };
  const captureBusy = ["requesting", "recording", "analysing", "calibrating"].includes(status);
  const busy = captureBusy || timingBusy || chordBusy;
  return <section className="recording-coach" aria-labelledby="recording-coach-title">
    <div className="recording-coach-intro"><span className="label">Listen back</span><h3 id="recording-coach-title">Timing, pitch & chord evidence</h3><p>{message}</p></div>
    <div className="recording-calibration">
      <label>Guitar<select value={profile} disabled={busy} onChange={(event) => setProfile(event.target.value as InstrumentProfile)}><option value="acoustic">Acoustic</option><option value="electric">Electric / amplified</option></select></label>
      <button type="button" onClick={() => void calibrateRoom()} disabled={busy}>{status === "calibrating" ? "Calibrating…" : calibration?.profile === profile ? "Recalibrate room" : "Calibrate room"}</button>
      <RightHandTapCalibration key={exerciseId} disabled={captureBusy || chordBusy} offset={calibration?.timingOffsetMs} onChange={saveTimingOffset} onActiveChange={setTimingBusy} onBeforeStart={() => onBeforeRecord?.()} />
      <button type="button" onClick={() => setShowChordCalibration((value) => !value)} aria-expanded={showChordCalibration} disabled={busy || !expectedChordProgression.length}>{showChordCalibration ? "Close chord setup" : "Calibrate target chords"}</button>
      <small>{calibration?.profile === profile ? `Noise floor ${calibration.noiseFloor.toFixed(3)} · timing compensation ${calibration.timingOffsetMs ?? 0} ms · saved locally` : "Room calibration improves onset thresholds; timing calibration estimates click-to-tap delay. No calibration audio is retained."}</small>
    </div>
    {showChordCalibration ? <ChordCalibrationWizard key={exerciseId} chords={expectedChordProgression} instrument={profile} onChange={handleChordProfile} onBeforeRecord={onBeforeRecord} onBusyChange={setChordBusy} /> : null}
    <div className="recording-mode-grid">
      <label>Scoring<select value={scoringMode} onChange={(event) => setScoringMode(event.target.value as PitchScoringMode)}><option value="timing">Timing only</option><option value="root">Chord root evidence</option><option value="quality">Root + quality evidence</option></select></label>
      <label>Recording privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value as PrivacyMode)}><option value="device">Keep last two on device</option><option value="manual">Export manually; do not retain</option><option value="teacher">Teacher-share-ready metadata</option></select></label>
    </div>
    <TimingProfile value={personalTiming} onChange={setPersonalTiming} disabled={busy} />
    <p className="recording-privacy-note">{privacy === "device" ? "Audio stays only in this browser’s IndexedDB until you delete it or clear site data. Two recent takes are kept; up to four references can be pinned across drills." : privacy === "manual" ? "New audio remains in memory only for this open session. Nothing is uploaded." : "Only a JSON score summary can be prepared. Audio is never attached or uploaded automatically."} Wear headphones if another device supplies a reference; Chord Hero pauses its practice audio before recording.</p>
    <div className="recording-actions"><button type="button" onClick={status === "recording" ? stop : () => void start()} disabled={busy && status !== "recording"}>{status === "recording" ? "Stop & score" : status === "analysing" ? "Analysing…" : status === "requesting" ? "Requesting microphone…" : current ? "Record another take" : "Record 8-sec take"}</button>{currentBlob && privacy !== "device" ? <button type="button" onClick={() => download(currentBlob, `chord-hero-${exerciseId}-take.webm`)}>Export audio manually</button> : null}{analysis && privacy === "teacher" ? <button type="button" onClick={exportMetadata}>Export teacher summary</button> : null}</div>
    {current ? <RightHandRecordingResults current={current} takes={takes} audioURLs={audioURLs} expectedSteps={expectedSteps} onLoopRange={(start, end) => onLoopTrouble(start, end)} onRetryRange={onRetryRange} disabled={busy} currentBlob={currentBlob} targetPattern={expectedPattern} voice={{ technique: targetTechnique, sound: targetSound }} onBeforePlay={onBeforeRecord} onPin={(id) => void updateTake(id, "pin")} onDelete={(id) => void updateTake(id, "delete")} onReview={review} /> : null}
    <StorageManager />
    <AudioEvaluation />
  </section>;
}
