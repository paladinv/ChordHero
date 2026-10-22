"use client";

import { summarizeHarmonicListeningClues, type RecordingAnalysis } from "../lib/songRecordingAnalysis";
import dynamic from "next/dynamic";
import type { ReferenceVoice } from "../lib/rightHandReferenceAudio";
import RightHandTakeAudio from "./RightHandTakeAudio";
const TakeReview = dynamic(() => import("./RightHandTakeReview"), { ssr: false });

export type SavedRightHandTake = { id: string; createdAt: string; analysis: RecordingAnalysis; pinned?: boolean; reviewAccepted?: boolean; byteSize?: number; mediaType?: string };

type Props = {
  current: RecordingAnalysis;
  takes: SavedRightHandTake[];
  audioURLs: Record<string, string>;
  expectedSteps: number;
  onLoopRange: (start: number, end: number) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onReview?: (id: string, accepted: boolean) => void;
  onRetryRange?: (start: number, end: number) => void;
  disabled?: boolean;
  currentBlob?: Blob | null;
  targetPattern?: string[];
  voice?: ReferenceVoice;
  onBeforePlay?: () => void | Promise<void>;
};

function Waveform({ peaks, label }: { peaks: number[]; label: string }) {
  return <svg className="take-waveform" viewBox="0 0 192 42" role="img" aria-label={label} preserveAspectRatio="none">{peaks.map((peak, index) => <rect key={index} x={index * 2} y={21 - peak * 19} width="1.2" height={Math.max(1, peak * 38)} rx=".5" />)}</svg>;
}

function buildFixDrills(analysis: RecordingAnalysis, expectedSteps: number) {
  const trouble = analysis.beatTimings.filter((beat) => beat.status !== "on-time");
  const groups: typeof trouble[] = [];
  trouble.forEach((beat) => {
    const last = groups[groups.length - 1];
    if (last?.length && beat.step <= last[last.length - 1].step + 1) last.push(beat); else groups.push([beat]);
  });
  return groups.slice(0, 4).map((beats) => {
    const start = Math.max(0, Math.min(expectedSteps - 1, beats[0].step % expectedSteps));
    const end = Math.max(start, Math.min(expectedSteps - 1, beats[beats.length - 1].step % expectedSteps));
    const statuses = [...new Set(beats.map((beat) => beat.status))];
    const offsets = beats.flatMap((beat) => beat.offsetMs === null ? [] : [beat.offsetMs]);
    const average = offsets.length ? Math.round(offsets.reduce((sum, value) => sum + value, 0) / offsets.length) : null;
    return { start, end, statuses, average };
  });
}

export default function RightHandRecordingResults({ current, takes, audioURLs, expectedSteps, onLoopRange, onPin, onDelete, onReview, onRetryRange, disabled = false, currentBlob, targetPattern, voice = {}, onBeforePlay }: Props) {
  const confidence = current.scoreReliability === "insufficient" ? Math.min(current.calibrationConfidence, 34) : current.scoreReliability === "limited" ? Math.min(current.calibrationConfidence, 59) : current.recordingSuitability === "good" ? current.calibrationConfidence : Math.min(current.calibrationConfidence, 49);
  const harmonicClues = summarizeHarmonicListeningClues(current.harmonicEvidence, current.practiceContext?.pattern ?? targetPattern ?? []);
  const fixes = current.scoreReliability === "insufficient" || current.reviewAccepted === false ? [] : buildFixDrills(current, expectedSteps);
  const harmonicFallback = !fixes.length && current.scoreReliability === "reliable" && current.reviewAccepted === true && current.timingEvidenceCount !== undefined && current.expectedTimingCount !== undefined && current.timingEvidenceCount === current.expectedTimingCount ? harmonicClues.transitions[0] ?? harmonicClues.mismatches[0] : null;
  const comparison = takes.length >= 2 && takes.slice(0, 2).every((take) => take.analysis.scoreReliability === "reliable" && take.reviewAccepted !== false && take.analysis.reviewAccepted !== false) ? {
    timing: takes[0].analysis.timingScore - takes[1].analysis.timingScore,
    chord: takes[0].analysis.chordAccuracyScore !== null && takes[1].analysis.chordAccuracyScore !== null ? takes[0].analysis.chordAccuracyScore - takes[1].analysis.chordAccuracyScore : null
  } : null;
  return <>
    {currentBlob ? <TakeReview key={current.recordingId ?? "current"} analysis={current} blob={currentBlob} pattern={current.practiceContext?.pattern ?? targetPattern ?? []} voice={current.referenceVoice ?? voice} disabled={disabled} onBeforePlay={onBeforePlay} /> : null}
    {current.recordingId && onReview ? <section className="recording-confidence"><p>{current.reviewAccepted === false ? "Feedback marked wrong. This take is excluded from automatic recommendations; your audio remains available for listening." : "Does this feedback match what you hear? You can exclude a mistaken take from recommendations."}</p><button type="button" onClick={() => onReview(current.recordingId!, current.reviewAccepted === false)}>{current.reviewAccepted === false ? "Restore this feedback" : "This feedback is wrong — exclude it"}</button></section> : null}
    <section className="recording-confidence" aria-label={`Recording confidence ${confidence} percent`}>
      <div><span className="label">Score confidence</span><strong>{confidence >= 70 ? "Useful signal" : confidence >= 40 ? "Use with caution" : "Insufficient signal"}</strong></div>
      <div className="confidence-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence}><i style={{ width: `${confidence}%` }} /></div>
      <span>{confidence}% · {current.signalDiagnostics?.materiallyClipped ? "Possible clipping or strong saturation. Lower input gain or move the microphone farther away, then record again. Reliable scoring is withheld." : current.recordingSuitability === "noisy" ? "Background noise is masking the guitar; move closer or recalibrate." : current.recordingSuitability === "quiet" ? "The guitar is too quiet; reduce mic distance or input suppression." : current.scoreReliability === "limited" ? "Only part of the pattern was matched. Treat the chart as a clue, not a grade." : current.scoreReliability === "insufficient" ? "Too few clear attacks were matched. Recheck setup and record the full pattern." : "Signal is clear enough for directional practice feedback."}</span>
      {current.signalDiagnostics ? <small>Input peak {Math.round(current.signalDiagnostics.peak * 100)}% · near full scale {current.signalDiagnostics.nearFullScalePercent}% of samples. This is a signal check, not validated scoring accuracy.</small> : null}
    </section>
    <div className="recording-scores">
      <span><strong>{current.scoreReliability === "insufficient" ? "—" : `${current.timingScore}%`}</strong> timing{current.scoreReliability === "limited" ? " estimate" : ""}</span>
      <span><strong>{current.chordAccuracyScore === null ? "—" : `${current.chordAccuracyScore}%`}</strong> chord evidence</span>
      <span><strong>{current.detectedPitch?.note ?? "—"}</strong> root estimate{current.detectedPitch ? ` · ${current.detectedPitch.confidence}%` : ""}</span>
      <span><strong>{current.calibrationConfidence}%</strong> raw signal</span>
      <p>{current.analysisNote}</p>
      <p>{current.scoreScope ?? "Timing is based on detected attacks. Chord and string identity remain estimates."}</p>
    </div>
    {current.dynamics ? <section className="recording-scores" aria-label="Dynamics separate from timing"><span><strong>{current.dynamics.consistency === null ? "—" : `${current.dynamics.consistency}%`}</strong> equal-volume consistency</span><span><strong>{current.dynamics.deliberateAccentScore === null ? "Not assessed" : `${current.dynamics.deliberateAccentScore}%`}</strong> deliberate accent match</span><p>{current.dynamics.note} Evidence confidence: {current.dynamics.confidence}%.</p></section> : null}
    <details className="harmonic-evidence"><summary>Attack, ringing & roughness indicators — not diagnoses</summary>{current.audioIndicators?.length ? <ul>{current.audioIndicators.map((indicator) => <li key={indicator.kind}><strong>{indicator.kind.replace(/-/g, " ")} · {indicator.count} attacks · {indicator.confidence}% heuristic confidence</strong><span>{indicator.explanation}</span></li>)}</ul> : <p>No supported indicator, or insufficient signal. Absence of an indicator does not establish clean technique.</p>}<p>Confidence describes signal strength and sample coverage, not validated diagnostic accuracy. Listen back; this cannot identify a buzzing or ringing string.</p></details>
    {fixes.length ? <section className="fix-it-drills" aria-labelledby="fix-it-title"><header><span className="label">Corrective loops</span><h4 id="fix-it-title">Fix it now</h4></header>{fixes.map((fix, index) => <div key={`${fix.start}-${fix.end}-${index}`}><button type="button" disabled={disabled} onClick={() => onLoopRange(fix.start, fix.end)}><strong>Steps {fix.start + 1}{fix.end > fix.start ? `–${fix.end + 1}` : ""}</strong><span>{fix.statuses.join(" + ")}{fix.average === null ? "" : ` · ${fix.average > 0 ? "+" : ""}${fix.average} ms average`}</span><b>Loop →</b></button>{onRetryRange ? <button type="button" disabled={disabled} onClick={() => onRetryRange(fix.start, fix.end)}>Retry this passage with count-in</button> : null}</div>)}</section> : harmonicFallback ? <section className="fix-it-drills" aria-label="Chord listening clue"><header><span className="label">Listening clue</span><h4>Check the chord change</h4></header><p>{harmonicFallback.label} This is a heuristic listening clue, not a finger or pitch diagnosis.</p><button type="button" disabled={disabled} onClick={() => onLoopRange(Math.max(0, harmonicFallback.step - 1), Math.min(expectedSteps - 1, harmonicFallback.step + 1))}>Loop neighboring steps</button></section> : <small>{current.scoreReliability === "insufficient" ? "More reliable signal is needed before suggesting corrective loops." : "No large timing misses detected."}</small>}
    <details className="beat-timing-report" open><summary>Beat-by-beat timing · {current.beatTimings.length} steps</summary><div className="beat-timing-chart" aria-hidden="true">{current.beatTimings.map((beat) => <i key={beat.step} className={beat.status} style={{ "--timing-offset": `${Math.max(-45, Math.min(45, (beat.offsetMs ?? 0) / 3))}px` } as React.CSSProperties} />)}</div><div className="timing-table-wrap"><table><thead><tr><th>Step</th><th>Expected</th><th>Observed</th><th>Result</th></tr></thead><tbody>{current.beatTimings.map((beat) => <tr key={beat.step}><th>{beat.step + 1}</th><td>{beat.expectedMs} ms</td><td>{beat.observedMs === null ? "—" : `${beat.observedMs} ms`}</td><td><span className={`timing-status ${beat.status}`}>{beat.status}{beat.offsetMs === null ? "" : ` (${beat.offsetMs > 0 ? "+" : ""}${beat.offsetMs} ms)`}</span></td></tr>)}</tbody></table></div></details>
    {current.harmonicEvidence.length ? <details className="harmonic-evidence"><summary>Chord evidence · confidence estimates{current.chordEvidenceExcluded ? ` · ${current.chordEvidenceExcluded} uncertain excluded` : ""}</summary><p>Pattern-linked listening clues only: these template matches can point to a transition or mismatch, but they do not diagnose fingers, strings, or pitch truth.</p>{harmonicClues.transitions.length || harmonicClues.mismatches.length ? <><strong>Transitions to listen for</strong><ul>{harmonicClues.transitions.slice(0, 8).map((item) => <li key={`transition-${item.step}`}><span>{item.label}</span></li>)}</ul><strong>Possible mismatches</strong><ul>{harmonicClues.mismatches.slice(0, 8).map((item) => <li key={`mismatch-${item.step}`}><span>{item.label}</span></li>)}</ul></> : <p>No retained transition or mismatch clue passed the evidence threshold.</p>}<details><summary>Inspect retained step evidence</summary><ul>{current.harmonicEvidence.slice(0, 16).map((item, index) => { const step = Number.isFinite(item.step) ? item.step : index; return <li key={step}><span>Step {step + 1}{item.patternToken ? ` · ${item.patternToken}` : ""} · {item.observedMs ?? "—"} ms</span><strong>Expected {item.expectedChord}</strong><span>Closest {item.detectedChord}</span><b>{item.confidence}%{item.signatureMatch !== undefined ? ` · ${item.signatureMatch}% personal match` : ""}</b></li>; })}</ul></details></details> : null}
    {onReview && takes.length ? <details><summary>Review saved feedback</summary>{takes.map((take) => <p key={take.id}>{new Date(take.createdAt).toLocaleString()} · {take.reviewAccepted === false ? "Excluded" : "Accepted"} <button type="button" onClick={() => onReview(take.id, take.reviewAccepted === false)}>{take.reviewAccepted === false ? "Restore feedback" : "Mark feedback wrong"}</button></p>)}</details> : null}
    {takes.length ? <section className="take-comparison" aria-labelledby="take-comparison-title"><div><span className="label">Local audio references</span><h4 id="take-comparison-title">Recent takes and weekly references</h4><small>Pin up to four across drills. Audio never syncs.</small></div><div className="take-comparison-grid">{takes.map((take, index) => <article key={take.id}><header><strong>{take.pinned ? "Pinned reference" : index === 0 ? "Latest" : "Recent"}</strong><span>{new Date(take.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span></header><Waveform peaks={take.analysis.peaks} label={`${take.pinned ? "Pinned reference" : "Recent"} take waveform`} />{audioURLs[take.id] ? <RightHandTakeAudio src={audioURLs[take.id]} label={`${take.pinned ? "Pinned reference" : "Recent"} recording`} disabled={disabled} onBeforePlay={onBeforePlay} /> : <small>Audio is unavailable; it may have been cleared from this browser.</small>}<small>{take.analysis.timingScore}% timing · {take.analysis.chordAccuracyScore ?? "—"}% chord evidence</small><div className="take-reference-actions"><button type="button" onClick={() => onPin(take.id)}>{take.pinned ? "Unpin" : "Pin for weekly comparison"}</button><button type="button" onClick={() => onDelete(take.id)}>Delete</button></div></article>)}</div>{comparison ? <p>Latest change: <strong>{comparison.timing >= 0 ? "+" : ""}{comparison.timing} timing</strong>{comparison.chord === null ? " · Chord comparison needs evidence in both takes." : ` · ${comparison.chord >= 0 ? "+" : ""}${comparison.chord} chord evidence.`} Listen before drawing a conclusion.</p> : null}</section> : null}
  </>;
}
