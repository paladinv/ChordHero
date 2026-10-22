"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { estimateSongPitch, songPitchName } from "@/lib/songBuilderPitch";

type FeedbackCounts = { matched: number; missed: number; early: number; onTime: number; late: number };
type PracticeSession = { id: string; sectionId: string; playedAt: string; matched: number; missed: number; early: number; onTime: number; late: number };
type Props = { expectedPitches: number[]; expectedKey: string; expectedSecondsUntil: number | null; active: boolean; sectionId: string; sectionName: string; history: PracticeSession[]; onSaveSession: (sessions: PracticeSession[]) => void; onSetPracticeTempo: (sectionId: string, bpm: number) => void; currentTempo: number };

export default function SongBuilderFeedback({ expectedPitches, expectedKey, expectedSecondsUntil, active, sectionId, sectionName, history, onSaveSession, onSetPracticeTempo, currentTempo }: Props) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Start playback, then enable pitch feedback.");
  const [counts, setCounts] = useState<FeedbackCounts>({ matched: 0, missed: 0, early: 0, onTime: 0, late: 0 });
  const [sectionCounts, setSectionCounts] = useState<Record<string, FeedbackCounts>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const expectedRef = useRef({ pitches: expectedPitches, key: expectedKey, secondsUntil: expectedSecondsUntil, sectionId });
  const outcomeRef = useRef("");
  const lastTargetRef = useRef(expectedKey);
  const stableRef = useRef<{ pitch: number | null; frames: number }>({ pitch: null, frames: 0 });
  const lastPitchRef = useRef<number | null>(null);
  const lastRmsRef = useRef(0);
  const countsRef = useRef<FeedbackCounts>(counts);
  const sessionStartedRef = useRef(false);
  const saveSessionRef = useRef(onSaveSession);
  const sectionCountsRef = useRef(new Map<string, FeedbackCounts>());
  const lastTargetSectionRef = useRef(sectionId);
  saveSessionRef.current = onSaveSession;
  const updateCounts = useCallback((change: (current: FeedbackCounts) => FeedbackCounts) => {
    const next = change(countsRef.current);
    countsRef.current = next;
    setCounts(next);
  }, []);
  const updateSectionCounts = useCallback((targetSection: string, change: (current: FeedbackCounts) => FeedbackCounts) => {
    if (!targetSection) return;
    const current = sectionCountsRef.current.get(targetSection) ?? { matched: 0, missed: 0, early: 0, onTime: 0, late: 0 };
    sectionCountsRef.current.set(targetSection, change(current));
    setSectionCounts(Object.fromEntries(sectionCountsRef.current));
  }, []);
  expectedRef.current = { pitches: expectedPitches, key: expectedKey, secondsUntil: expectedSecondsUntil, sectionId };

  useEffect(() => {
    if (active) return;
    if (listening) stop();
    setStatus("Start playback, then enable pitch feedback.");
  }, [active, listening]);

  useEffect(() => {
    const previous = lastTargetRef.current;
    if (listening && previous && previous !== expectedKey && outcomeRef.current !== previous) {
      updateCounts((current) => ({ ...current, missed: current.missed + 1 }));
      updateSectionCounts(lastTargetSectionRef.current, (current) => ({ ...current, missed: current.missed + 1 }));
    }
    lastTargetRef.current = expectedKey;
    lastTargetSectionRef.current = sectionId;
    outcomeRef.current = "";
  }, [expectedKey, listening, sectionId, updateCounts, updateSectionCounts]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      setStatus("Microphone pitch feedback is unavailable in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      streamRef.current = stream;
      contextRef.current = context;
      stableRef.current = { pitch: null, frames: 0 };
      lastPitchRef.current = null;
      lastRmsRef.current = 0;
      const freshCounts = { matched: 0, missed: 0, early: 0, onTime: 0, late: 0 };
      countsRef.current = freshCounts;
      setCounts(freshCounts);
      sectionCountsRef.current.clear();
      setSectionCounts({});
      lastTargetRef.current = expectedRef.current.key;
      lastTargetSectionRef.current = expectedRef.current.sectionId;
      outcomeRef.current = "";
      sessionStartedRef.current = true;
      timerRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        const rms = Math.sqrt(energy / samples.length);
        const pitch = estimateSongPitch(samples, context.sampleRate);
        const previous = stableRef.current;
        stableRef.current = { pitch, frames: pitch === previous.pitch ? previous.frames + 1 : 1 };
        const onset = pitch !== null && stableRef.current.frames >= 2 && (lastPitchRef.current === null || pitch !== lastPitchRef.current || rms > Math.max(0.012, lastRmsRef.current * 1.55));
        lastRmsRef.current = rms;
        if (pitch === null) lastPitchRef.current = null;
        else if (stableRef.current.frames >= 2) lastPitchRef.current = pitch;
        if (stableRef.current.frames < 2) return;
        const target = expectedRef.current.pitches;
        if (!target.length || !active) return;
        if (pitch === null) { setStatus(`Listening for ${target.map(songPitchName).join(" / ")}…`); return; }
        const key = expectedRef.current.key;
        if (outcomeRef.current !== key) outcomeRef.current = "";
        const nearest = target.reduce((best, item) => Math.abs(item - pitch) < Math.abs(best - pitch) ? item : best, target[0]);
        if (Math.abs(nearest - pitch) <= 1) {
          if (onset && outcomeRef.current !== key) {
            outcomeRef.current = key;
            const secondsUntil = expectedRef.current.secondsUntil;
            const timing = secondsUntil === null ? "onTime" : secondsUntil > 0.22 ? "early" : secondsUntil < -0.22 ? "late" : "onTime";
            updateCounts((current) => ({ ...current, matched: current.matched + 1, [timing]: current[timing] + 1 }));
            updateSectionCounts(expectedRef.current.sectionId, (current) => ({ ...current, matched: current.matched + 1, [timing]: current[timing] + 1 }));
            const timingLabel = timing === "early" ? "early" : timing === "late" ? "late" : "on time";
            const offset = secondsUntil === null ? "" : ` · ${Math.abs(secondsUntil * 1000).toFixed(0)} ms ${secondsUntil > 0 ? "before" : "after"}`;
            setStatus(`On pitch · ${timingLabel}${offset} · ${songPitchName(nearest)}`);
          } else if (outcomeRef.current !== key) {
            setStatus(`Heard ${songPitchName(pitch)} · aim for ${target.map(songPitchName).join(" / ")}`);
          }
        } else {
          setStatus(`Heard ${songPitchName(pitch)} · aim for ${target.map(songPitchName).join(" / ")}`);
        }
      }, 80);
      setListening(true);
      setStatus("Mic active. Play one note at a time; headphones help prevent the backing audio leaking into the mic.");
    } catch {
      setStatus("Microphone access was denied or the input device could not be opened.");
    }
  }

  function finishSession(updateUI = true) {
    if (!sessionStartedRef.current) return;
    sessionStartedRef.current = false;
    if (expectedRef.current.key && outcomeRef.current !== expectedRef.current.key) {
      countsRef.current = { ...countsRef.current, missed: countsRef.current.missed + 1 };
      if (updateUI) setCounts(countsRef.current);
      const sectionID = expectedRef.current.sectionId;
      const sectionCurrent = sectionCountsRef.current.get(sectionID) ?? { matched: 0, missed: 0, early: 0, onTime: 0, late: 0 };
      sectionCountsRef.current.set(sectionID, { ...sectionCurrent, missed: sectionCurrent.missed + 1 });
      if (updateUI) setSectionCounts(Object.fromEntries(sectionCountsRef.current));
    }
    const result = countsRef.current;
    if (result.matched + result.missed === 0) return;
    const playedAt = new Date().toISOString();
    saveSessionRef.current([...sectionCountsRef.current.entries()].filter(([, countsForSection]) => countsForSection.matched + countsForSection.missed > 0).map(([targetSection, countsForSection]) => ({ id: crypto.randomUUID(), sectionId: targetSection, playedAt, ...countsForSection })));
  }

  function stop() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setListening(false);
    finishSession();
    setStatus("Pitch feedback is off.");
  }

  useEffect(() => () => {
    finishSession(false);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
  }, []);

  const expectedLabel = expectedPitches.length ? expectedPitches.map(songPitchName).join(" / ") : "No upcoming note";
  const recentHistory = history.filter((item) => item.sectionId === sectionId).slice(-5).reverse();
  const currentSectionCounts = sectionCounts[sectionId] ?? { matched: 0, missed: 0, early: 0, onTime: 0, late: 0 };
  const totalAttempts = currentSectionCounts.matched + currentSectionCounts.missed;
  const accuracy = totalAttempts ? Math.round(currentSectionCounts.matched / totalAttempts * 100) : null;
  const recommendedTempo = accuracy === null ? null : Math.max(40, Math.min(240, Math.round(currentTempo * (accuracy >= 85 ? 1.05 : accuracy < 65 ? 0.9 : 1))));
  return <section className="song-builder-card card builder-feedback" aria-label="Live pitch feedback">
    <div className="song-builder-card-head"><div><span className="label">Optional microphone feedback</span><h2>Play the next note</h2></div><strong>{counts.matched} on pitch · {counts.missed} missed</strong></div>
    <p>Target: {expectedLabel}. Onset timing is estimated against the score with a 220 ms on-time window. Headphones reduce backing audio bleed.</p>
    <div className="builder-feedback-timing" aria-label="Timing results"><span><strong>{currentSectionCounts.onTime}</strong> on time in {sectionName}</span><span><strong>{currentSectionCounts.early}</strong> early</span><span><strong>{currentSectionCounts.late}</strong> late</span></div>
    <div className="builder-inline-actions"><button className={`btn ${listening ? "primary" : ""}`} type="button" aria-pressed={listening} disabled={!active && !listening} onClick={() => listening ? stop() : void start()}>{listening ? "Turn feedback off" : "Enable pitch feedback"}</button><button className="btn" type="button" onClick={() => { const cleared = { matched: 0, missed: 0, early: 0, onTime: 0, late: 0 }; countsRef.current = cleared; setCounts(cleared); sectionCountsRef.current.clear(); setSectionCounts({}); }}>Reset count</button><span className="song-builder-muted" role="status" aria-live="polite">{status}</span></div>
    {recommendedTempo !== null && accuracy !== null ? <p className="builder-feedback-recommendation">{accuracy}% on pitch in this section. {accuracy >= 85 ? "Try this section slightly faster." : accuracy < 65 ? "Slow this section down and repeat it." : "Keep this tempo until the notes feel steady."} <button className="text-button" type="button" disabled={recommendedTempo === currentTempo} onClick={() => onSetPracticeTempo(sectionId, recommendedTempo)}>Practice {sectionName} at {recommendedTempo} BPM</button></p> : null}
    {recentHistory.length ? <details className="builder-practice-history"><summary>Recent {sectionName} practice</summary><ol>{recentHistory.map((session) => { const attempts = session.matched + session.missed; return <li key={session.id}><time dateTime={session.playedAt}>{new Date(session.playedAt).toLocaleString()}</time><span>{attempts ? Math.round(session.matched / attempts * 100) : 0}% on pitch · {session.matched} matched · {session.missed} missed</span><small>{session.early} early · {session.onTime} on time · {session.late} late</small></li>; })}</ol></details> : null}
  </section>;
}
