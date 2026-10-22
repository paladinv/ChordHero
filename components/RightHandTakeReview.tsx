"use client";
import { useEffect, useRef, useState } from "react";
import { analyzePracticeRecording, type RecordingAnalysis } from "../lib/songRecordingAnalysis";
import { audioLevel, matchedAudioGains } from "../lib/rightHandTimingReview";
import { PRACTICE_STATE_EVENT, readPracticePlatformState } from "../lib/practicePlatform";
import type { ReferenceVoice } from "../lib/rightHandReferenceAudio";

type Props = { analysis: RecordingAnalysis; blob: Blob; pattern: string[]; disabled: boolean; voice: ReferenceVoice; onBeforePlay?: () => void | Promise<void> };
export default function RightHandTakeReview({ analysis, blob, pattern, disabled, voice, onBeforePlay }: Props) {
  const [start, setStart] = useState(analysis.scoringWindow?.startMs ?? 0); const [end, setEnd] = useState(analysis.durationMs);
  const [revised, setRevised] = useState<RecordingAnalysis | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("Original take and score are preserved. Nothing plays automatically.");
  const contextRef = useRef<AudioContext | null>(null); const generation = useRef(0);
  const isolating = useRef(false);
  const stop = () => { generation.current++; const context = contextRef.current; contextRef.current = null; if (context && context.state !== "closed") void context.close(); };
  const stopRef = useRef(stop); stopRef.current = stop;
  useEffect(() => { const silence = () => { if (!isolating.current) { stopRef.current(); setBusy(false); setMessage("Comparison stopped because recording or audio settings changed."); } }; window.addEventListener("chord-hero:right-hand-capture", silence); window.addEventListener("chord-hero:right-hand-live-mic", silence); window.addEventListener("chord-hero:right-hand-review-playback", silence); window.addEventListener(PRACTICE_STATE_EVENT, silence); return () => { stopRef.current(); window.removeEventListener("chord-hero:right-hand-capture", silence); window.removeEventListener("chord-hero:right-hand-live-mic", silence); window.removeEventListener("chord-hero:right-hand-review-playback", silence); window.removeEventListener(PRACTICE_STATE_EVENT, silence); }; }, []);
  useEffect(() => { if (disabled) { stopRef.current(); setBusy(false); } }, [disabled]);
  const change = (which: "start" | "end", value: number) => { stop(); setBusy(false); setRevised(null); if (which === "start") setStart(value); else setEnd(value); };
  const rescore = async () => {
    window.dispatchEvent(new Event("chord-hero:right-hand-review-playback")); stop(); const token = generation.current; setBusy(true);
    try { const next = await analyzePracticeRecording(blob, { ...analysis.analysisOptions, scoringWindow: { startMs: start, endMs: end, originalRecordingId: analysis.recordingId }, timingProfile: analysis.timingProfile }); if (token !== generation.current) return; setRevised(next); setMessage("Selected samples rescored separately. Original recording and score are unchanged; this review does not update practice progress."); }
    catch (error) { if (token === generation.current) setMessage(error instanceof Error ? error.message : "Could not score this window."); }
    finally { if (token === generation.current) setBusy(false); }
  };
  const play = async (kind: "target" | "take") => {
    window.dispatchEvent(new Event("chord-hero:right-hand-review-playback")); stop(); const token = generation.current; setBusy(true);
    try {
      if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Window boundaries must be finite milliseconds.");
      isolating.current = true;
      try { await onBeforePlay?.(); } finally { isolating.current = false; }
      if (token !== generation.current) return;
      const preferences = readPracticePlatformState().accessibility;
      if (preferences.audioMuted || preferences.audioVolume <= 0) throw new Error("Unmute and raise master volume to compare audio.");
      const context = new AudioContext(); contextRef.current = context; await context.resume();
      if (token !== generation.current) return;
      const bytes = await blob.arrayBuffer(); if (token !== generation.current) return;
      const decoded = await context.decodeAudioData(bytes); if (token !== generation.current) return;
      const windowStart = Math.max(0, Math.min(decoded.duration * 1000, start)); const windowEnd = Math.min(decoded.duration * 1000, end);
      if (windowEnd - windowStart < 200) throw new Error("Select at least 200 ms.");
      const take = context.createBuffer(decoded.numberOfChannels, Math.floor((windowEnd - windowStart) * decoded.sampleRate / 1000), decoded.sampleRate);
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) take.copyToChannel(decoded.getChannelData(channel).slice(Math.floor(windowStart * decoded.sampleRate / 1000), Math.floor(windowEnd * decoded.sampleRate / 1000)), channel);
      const { renderReviewTarget } = await import("../lib/rightHandReferenceAudio");
      const target = await renderReviewTarget(analysis, pattern, decoded.sampleRate, windowStart, windowEnd, voice);
      if (token !== generation.current) return;
      const levels = (buffer: AudioBuffer) => audioLevel(Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index)));
      const gains = matchedAudioGains(levels(target), levels(take));
      if (gains.rms < 1e-7) throw new Error("One side is silent; choose a window containing both intended attacks and played audio.");
      const source = context.createBufferSource(); const gain = context.createGain(); source.buffer = kind === "target" ? target : take;
      gain.gain.value = (kind === "target" ? gains.a : gains.b) * Math.max(0, Math.min(1, preferences.audioVolume)); source.connect(gain); gain.connect(context.destination);
      source.onended = () => { if (token === generation.current) { stop(); setMessage("Playback ended. Choose A or B again to compare."); } }; source.start();
      setMessage(`${kind === "target" ? "A · sampled target" : "B · your take"} playing. Both decoded waveforms are RMS-matched by attenuation, with a 0.9 peak ceiling before master volume. This is a timing/tone reference, not the sound of your exact guitar.`);
    } catch (error) { if (token === generation.current) { stop(); setBusy(false); setMessage(error instanceof Error ? error.message : "Audio unavailable."); } }
    finally { if (token === generation.current) setBusy(false); }
  };
  const current = revised ?? analysis;
  return <details className="beat-timing-report"><summary>A/B listening & scoring window</summary><p>Exclude tuning, false starts or interruptions by selecting a contiguous window. Times are measured from the original file; target pattern phase remains unchanged. Rescoring never edits the original audio.</p><label>Start (ms)<input type="number" min={0} max={analysis.durationMs - 200} step={50} value={start} disabled={disabled || busy} onChange={(event) => change("start", Number(event.target.value))} /></label><label>End (ms)<input type="number" min={start + 200} max={analysis.durationMs} step={50} value={end} disabled={disabled || busy} onChange={(event) => change("end", Number(event.target.value))} /></label><button type="button" disabled={disabled || busy} onClick={() => void rescore()}>Score selected samples separately</button><div className="recording-actions"><button type="button" disabled={disabled || busy} onClick={() => void play("target")}>A · target</button><button type="button" disabled={disabled || busy} onClick={() => void play("take")}>B · your take</button><button type="button" onClick={() => { stop(); setBusy(false); setMessage("Playback stopped."); }}>Stop comparison</button></div><p role="status">{message}</p>{revised ? <p>Window {revised.scoringWindow?.startMs}–{revised.scoringWindow?.endMs} ms · standard {revised.timingScore}% · {revised.timingEvidenceCount}/{revised.expectedTimingCount} attacks matched · {revised.scoreReliability} evidence. Source: {analysis.recordingId ?? "current in-memory recording"}.</p> : null}<p>Personal target: {current.timingProfile?.targetOffsetMs ?? 0} ms, tolerance ±{current.timingProfile?.toleranceMs ?? 35} ms · personal score {current.personalizedTiming?.score ?? current.timingScore}% (not comparable to the standard score).</p><table><caption>Personal timing chart{revised ? " · selected window" : " · original take"}</caption><thead><tr><th>Step</th><th>Personal result</th><th>Offset from personal target</th></tr></thead><tbody>{(current.personalizedTiming?.beatTimings ?? current.beatTimings).map((beat) => <tr key={beat.step}><td>{beat.step + 1}</td><td>{beat.status}</td><td>{beat.offsetMs ?? "—"} ms</td></tr>)}</tbody></table></details>;
}
