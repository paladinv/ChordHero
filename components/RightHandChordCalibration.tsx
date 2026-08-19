"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeChordCalibration, type ChordCalibrationSignature } from "../lib/songRecordingAnalysis";

export type ChordCalibrationProfile = {
  instrument: "acoustic" | "electric";
  tuning: string;
  updatedAt: string;
  signatures: Record<string, ChordCalibrationSignature>;
};

type Props = {
  chords: string[];
  instrument: "acoustic" | "electric";
  onChange: (profile: ChordCalibrationProfile | null) => void;
};

const STORAGE_KEY = "chord-hero:right-hand:chord-calibration:v1";
const normalizeChord = (value: string) => value.trim().toUpperCase();

function readProfiles(): Record<string, ChordCalibrationProfile> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}

export default function RightHandChordCalibration({ chords, instrument, onChange }: Props) {
  const [tuning, setTuning] = useState("E A D G B E");
  const [profile, setProfile] = useState<ChordCalibrationProfile | null>(null);
  const [recordingChord, setRecordingChord] = useState<string | null>(null);
  const [message, setMessage] = useState("Play each target chord once. Only its compact frequency signature is kept.");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const uniqueChords = useMemo(() => [...new Set(chords.map(normalizeChord).filter(Boolean))].slice(0, 8), [chords]);
  const profileKey = `${instrument}:${tuning.trim().toUpperCase()}`;

  useEffect(() => {
    const next = readProfiles()[profileKey] ?? null;
    setProfile(next); onChange(next);
  }, [onChange, profileKey]);

  const persist = (next: ChordCalibrationProfile | null) => {
    const profiles = readProfiles();
    if (next) profiles[profileKey] = next; else delete profiles[profileKey];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    setProfile(next); onChange(next);
  };

  const recordChord = async (chord: string) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMessage("Chord calibration is unavailable in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream); recorderRef.current = recorder; setRecordingChord(chord);
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setMessage(`Analysing ${chord}…`);
        try {
          const signature = await analyzeChordCalibration(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), chord);
          if (signature.signalConfidence < 20) { setMessage(`${chord} was too quiet to learn reliably. Move closer and play it again.`); setRecordingChord(null); return; }
          const next: ChordCalibrationProfile = { instrument, tuning: tuning.trim(), updatedAt: new Date().toISOString(), signatures: { ...(profile?.signatures ?? {}), [normalizeChord(chord)]: signature } };
          persist(next); setMessage(`${chord} learned locally at ${signature.signalConfidence}% signal confidence.`);
        } catch { setMessage(`${chord} could not be decoded. Try one clean, sustained chord.`); }
        setRecordingChord(null);
      };
      recorder.start(); setMessage(`Recording ${chord}… play once and let it ring.`);
      window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 2200);
    } catch { setMessage("Microphone permission was not granted. Existing signatures remain available."); setRecordingChord(null); }
  };

  if (!uniqueChords.length) return <p className="calibration-empty">Choose a chord progression to calibrate chord recognition.</p>;
  const completed = uniqueChords.filter((chord) => profile?.signatures[normalizeChord(chord)]).length;
  return (
    <section className="chord-calibration-wizard" aria-labelledby="chord-calibration-title">
      <header><div><span className="label">Private chord calibration</span><h4 id="chord-calibration-title">Teach this guitar&apos;s target chords</h4></div><strong>{completed} / {uniqueChords.length}</strong></header>
      <label>Tuning<input value={tuning} onChange={(event) => setTuning(event.target.value.slice(0, 24))} aria-label="Guitar tuning for chord calibration" /></label>
      <div className="chord-calibration-steps">{uniqueChords.map((chord) => {
        const saved = profile?.signatures[normalizeChord(chord)];
        return <button key={chord} type="button" className={saved ? "complete" : ""} disabled={Boolean(recordingChord)} onClick={() => void recordChord(chord)} aria-label={`${saved ? "Redo" : "Record"} ${chord} calibration`}><strong>{chord}</strong><span>{recordingChord === chord ? "Listening…" : saved ? `Redo · ${saved.signalConfidence}%` : "Record once"}</span></button>;
      })}</div>
      <p role="status">{message}</p>
      {profile ? <button type="button" className="ghost" disabled={Boolean(recordingChord)} onClick={() => { persist(null); setMessage("Chord signatures cleared from this device."); }}>Clear this guitar&apos;s signatures</button> : null}
      <small>No calibration audio is saved or uploaded. Chord signatures are approximate 12-note energy profiles, not recordings.</small>
    </section>
  );
}
