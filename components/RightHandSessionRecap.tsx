"use client";
import { useEffect, useState } from "react";
import type { RecordingAnalysis } from "../lib/songRecordingAnalysis";
import { fullAcceptedRightHandTake, nextRightHandAction, previousComparableTake } from "../lib/rightHandSessionSummary";

export default function RightHandSessionRecap({ analysis, patternLength, title, loops, bpm, seconds, onLoop }: { analysis: RecordingAnalysis | null; patternLength: number; title: string; loops: number; bpm: number; seconds: number; onLoop: (start: number, end: number) => void }) {
  const [previous, setPrevious] = useState<ReturnType<typeof previousComparableTake>>(null);
  useEffect(() => {
    const refresh = () => { try { const all = JSON.parse(localStorage.getItem("chord-hero:right-hand:recording-history:v2") ?? "{}"); setPrevious(previousComparableTake(analysis, Object.values(all).flat() as Parameters<typeof previousComparableTake>[1])); } catch { setPrevious(null); } };
    refresh(); window.addEventListener("chord-hero:right-hand-storage", refresh);
    return () => window.removeEventListener("chord-hero:right-hand-storage", refresh);
  }, [analysis]);
  const accepted = fullAcceptedRightHandTake(analysis);
  const next = nextRightHandAction(analysis, patternLength, bpm, title);
  return <div className="right-hand-session-recap" aria-label="Session recap">
    <article><span className="label">Round completed</span><strong>{loops > 0 ? `${loops} complete pattern loop${loops === 1 ? "" : "s"} at ${bpm} BPM` : `Completed a ${seconds}-second round`}</strong><p>This records practice time. Your feel rating is separate from microphone-measured accuracy.</p></article>
    <article><span className="label">Latest microphone evidence</span><strong>{accepted ? `${analysis.timingScore}% accepted full-pattern timing` : "No accepted full-pattern measurement"}</strong><p>{previous && accepted ? `${analysis.timingScore - previous.analysis.timingScore >= 0 ? "+" : ""}${analysis.timingScore - previous.analysis.timingScore} timing points versus the previous accepted full take with the same tempo, written pattern, chords, scoring mode and instrument (${new Date(previous.createdAt).toLocaleDateString()}).` : "A comparison needs two retained, accepted full takes with the same tempo, written pattern, chords, scoring mode and instrument. Trimmed or disputed feedback is excluded."}</p></article>
    <article><span className="label">Timing issue</span><strong>{next.kind === "timing" ? next.evidence : "No timing hotspot has enough reliable evidence yet."}</strong></article>
    <article><span className="label">One next action</span><strong>{next.label}</strong><p>{next.evidence}</p><button type="button" onClick={() => onLoop(next.start, next.end)}>Prepare next drill</button></article>
  </div>;
}
