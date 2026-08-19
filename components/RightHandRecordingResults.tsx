"use client";

import type { RecordingAnalysis } from "../lib/songRecordingAnalysis";

export type SavedRightHandTake = { id: string; createdAt: string; analysis: RecordingAnalysis };

type Props = {
  current: RecordingAnalysis;
  takes: SavedRightHandTake[];
  audioURLs: Record<string, string>;
  expectedSteps: number;
  subdivisionsPerBeat: number;
  onLoopRange: (start: number, end: number) => void;
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

export default function RightHandRecordingResults({ current, takes, audioURLs, expectedSteps, subdivisionsPerBeat, onLoopRange }: Props) {
  const confidence = current.recordingSuitability === "good" ? current.calibrationConfidence : Math.min(current.calibrationConfidence, 49);
  const fixes = buildFixDrills(current, expectedSteps);
  const comparison = takes.length >= 2 ? {
    timing: takes[0].analysis.timingScore - takes[1].analysis.timingScore,
    chord: (takes[0].analysis.chordAccuracyScore ?? 0) - (takes[1].analysis.chordAccuracyScore ?? 0)
  } : null;
  return <>
    <section className="recording-confidence" aria-label={`Recording confidence ${confidence} percent`}>
      <div><span className="label">Score confidence</span><strong>{confidence >= 70 ? "Useful signal" : confidence >= 40 ? "Use with caution" : "Insufficient signal"}</strong></div>
      <div className="confidence-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence}><i style={{ width: `${confidence}%` }} /></div>
      <span>{confidence}% · {current.recordingSuitability === "noisy" ? "Background noise is masking the guitar; move closer or recalibrate." : current.recordingSuitability === "quiet" ? "The guitar is too quiet; reduce mic distance or input suppression." : "Signal is clear enough for directional practice feedback."}</span>
    </section>
    <div className="recording-scores">
      <span><strong>{current.timingScore}%</strong> timing</span>
      <span><strong>{current.chordAccuracyScore === null ? "—" : `${current.chordAccuracyScore}%`}</strong> chord evidence</span>
      <span><strong>{current.detectedPitch?.note ?? "—"}</strong> root estimate{current.detectedPitch ? ` · ${current.detectedPitch.confidence}%` : ""}</span>
      <span><strong>{current.calibrationConfidence}%</strong> raw signal</span>
      <p>{current.analysisNote}</p>
    </div>
    {fixes.length ? <section className="fix-it-drills" aria-labelledby="fix-it-title"><header><span className="label">Corrective loops</span><h4 id="fix-it-title">Fix it now</h4></header>{fixes.map((fix, index) => <button key={`${fix.start}-${fix.end}-${index}`} type="button" onClick={() => onLoopRange(fix.start, fix.end)}><strong>Steps {fix.start + 1}{fix.end > fix.start ? `–${fix.end + 1}` : ""}</strong><span>{fix.statuses.join(" + ")}{fix.average === null ? "" : ` · ${fix.average > 0 ? "+" : ""}${fix.average} ms average`}</span><b>Loop →</b></button>)}</section> : <small>No large timing misses detected.</small>}
    <details className="beat-timing-report" open><summary>Beat-by-beat timing · {current.beatTimings.length} steps</summary><div className="beat-timing-chart" aria-hidden="true">{current.beatTimings.map((beat) => <i key={beat.step} className={beat.status} style={{ "--timing-offset": `${Math.max(-45, Math.min(45, (beat.offsetMs ?? 0) / 3))}px` } as React.CSSProperties} />)}</div><div className="timing-table-wrap"><table><thead><tr><th>Step</th><th>Expected</th><th>Observed</th><th>Result</th></tr></thead><tbody>{current.beatTimings.map((beat) => <tr key={beat.step}><th>{beat.step + 1}</th><td>{beat.expectedMs} ms</td><td>{beat.observedMs === null ? "—" : `${beat.observedMs} ms`}</td><td><span className={`timing-status ${beat.status}`}>{beat.status}{beat.offsetMs === null ? "" : ` (${beat.offsetMs > 0 ? "+" : ""}${beat.offsetMs} ms)`}</span></td></tr>)}</tbody></table></div></details>
    {current.harmonicEvidence.length ? <details className="harmonic-evidence"><summary>Chord evidence · confidence estimates</summary><ul>{current.harmonicEvidence.slice(0, 12).map((item, index) => <li key={index}><span>Beat {index + 1}</span><strong>Expected {item.expectedChord}</strong><span>Closest {item.detectedChord}</span><b>{item.confidence}%{item.signatureMatch !== undefined ? ` · ${item.signatureMatch}% personal match` : ""}</b></li>)}</ul></details> : null}
    {takes.length ? <section className="take-comparison" aria-labelledby="take-comparison-title"><div><span className="label">Saved on this device</span><h4 id="take-comparison-title">Last two retained takes</h4></div><div className="take-comparison-grid">{takes.map((take, index) => <article key={take.id}><header><strong>{index === 0 ? "Latest" : "Previous"}</strong><span>{new Date(take.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></header><Waveform peaks={take.analysis.peaks} label={`${index === 0 ? "Latest" : "Previous"} take waveform`} />{audioURLs[take.id] ? <audio controls preload="metadata" src={audioURLs[take.id]} aria-label={`${index === 0 ? "Latest" : "Previous"} recording`} /> : null}<small>{take.analysis.timingScore}% timing · {take.analysis.chordAccuracyScore ?? "—"}% chord evidence</small></article>)}</div>{comparison ? <p>Latest change: <strong>{comparison.timing >= 0 ? "+" : ""}{comparison.timing} timing</strong> · {comparison.chord >= 0 ? "+" : ""}{comparison.chord} chord evidence.</p> : null}</section> : null}
  </>;
}
