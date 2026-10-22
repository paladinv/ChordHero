"use client";

import { useEffect, useMemo, useState } from "react";
import { confidenceCalibration, GROWTH_CRITERIA, GrowthCriteria, GrowthRound, GrowthSetRevision, routeRevisionDiff } from "../lib/trainerGrowth";
import ChordDiagram, { Chord } from "./ChordDiagram";

const KEY = "chord-hero-trainer-set-revisions-v1";
type RouteItem = { name: string; shapeId: string };

export function ConfidenceControl({ value, onChange, rounds }: { value: number | null; onChange: (value: number | null) => void; rounds: GrowthRound[] }) {
  const calibration = useMemo(() => confidenceCalibration(rounds), [rounds]);
  return <section className="trainer-growth-box" aria-label="Predicted clean rate">
    <label>Next round prediction · one use <select value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}><option value="">Skip this prediction</option>{Array.from({ length: 11 }, (_, index) => index * 10).map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
    <p>{calibration.count < 3 ? `${calibration.count} eligible predicted round${calibration.count === 1 ? "" : "s"}; comparison appears after 3.` : `Across ${calibration.count} eligible rounds: predicted ${Math.round(calibration.prediction!)}%, self-rated clean ${Math.round(calibration.actual!)}% (${calibration.delta! >= 0 ? "+" : ""}${Math.round(calibration.delta!)} points).`}</p>
    <small>Applies to the next completed round, then clears. Only predictions with at least 50% self-rated coverage count; skipped predictions remain unknown.</small>
  </section>;
}

export function TransitionCriteria({ criteria, onCriteria, checks, onCheck, index, enabled }: { criteria: GrowthCriteria[]; onCriteria: (value: GrowthCriteria[]) => void; checks: Record<number, Partial<Record<GrowthCriteria, boolean>>>; onCheck: (index: number, criterion: GrowthCriteria, pass: boolean) => void; index: number; enabled: boolean }) {
  return <section className="trainer-growth-box" aria-label="Personal clean standard">
    <strong>My clean standard</strong><div>{GROWTH_CRITERIA.map((item) => <label key={item.id}><input type="checkbox" checked={criteria.includes(item.id)} onChange={(event) => onCriteria(event.target.checked ? [...criteria, item.id] : criteria.filter((value) => value !== item.id))} /> {item.label}</label>)}</div>
    {enabled && criteria.length > 0 && <div className="trainer-inline-actions"><span>Self-check this change:</span>{criteria.map((criterion) => <label key={criterion}>{GROWTH_CRITERIA.find((item) => item.id === criterion)?.label}<select value={checks[index]?.[criterion] === true ? "yes" : checks[index]?.[criterion] === false ? "no" : ""} onChange={(event) => { if (event.target.value) onCheck(index, criterion, event.target.value === "yes"); }}><option value="">Not rated</option><option value="yes">Pass</option><option value="no">Not yet</option></select></label>)}</div>}
    <small>Optional self-report only; these criteria do not affect the clean / needs-work / missed buttons.</small>
  </section>;
}

export function SetRevisionControl({ setId, title, items }: { setId: string; title: string; items: RouteItem[] }) {
  const [revisions, setRevisions] = useState<GrowthSetRevision[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { try { const raw = localStorage.getItem(KEY); const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) setRevisions(parsed.slice(0, 20).flatMap((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.savedAt === "string" && Array.isArray(item.items) ? [{ id: item.id.slice(0, 100), title: item.title.slice(0, 100), savedAt: item.savedAt.slice(0, 40), items: item.items.slice(0, 64).flatMap((route: unknown) => route && typeof route === "object" && typeof (route as RouteItem).name === "string" && typeof (route as RouteItem).shapeId === "string" ? [{ name: (route as RouteItem).name.slice(0, 24), shapeId: (route as RouteItem).shapeId.slice(0, 100) }] : []) }] : [])); } catch {} setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(revisions.slice(0, 20))); } catch {} }, [ready, revisions]);
  const prior = revisions.find((revision) => revision.id === setId);
  const snapshot = useMemo(() => ({ id: setId, title: title.slice(0, 100), savedAt: new Date().toISOString(), items: items.slice(0, 64) }), [items, setId, title]);
  const diff = routeRevisionDiff(prior, snapshot);
  if (!setId) return null;
  return <section className="trainer-growth-box" aria-label="Song Coach set comparison"><strong>Song Coach route versions</strong>
    <p>{prior ? `Saved snapshot: ${new Date(prior.savedAt).toLocaleDateString()}. ${diff?.added.length} added, ${diff?.removed.length} removed, ${diff?.shapesChanged.length} shape changes${diff?.reordered ? ", route reordered" : ""}.` : "No Trainer snapshot yet. Save one to compare a later version."}</p>
    {diff && <small>{[...diff.added.map((name) => `Added ${name}`), ...diff.removed.map((name) => `Removed ${name}`), ...diff.shapesChanged.map((name) => `Shape changed: ${name}`), ...(diff.reordered ? ["Supported chord order changed"] : [])].join(" · ") || "No supported route or shape changes."}</small>}
    <div className="trainer-inline-actions"><button className="btn" type="button" onClick={() => setRevisions((current) => [{ ...snapshot, savedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== setId)].slice(0, 20))}>Save / replace snapshot</button>{prior && <button className="btn ghost" type="button" onClick={() => setRevisions((current) => current.filter((item) => item.id !== setId))}>Delete Trainer snapshot</button>}</div>
    <small>Manual, local Trainer copy only; the Song Library is unchanged.</small>
  </section>;
}

export function IssueFocus({ onLoad }: { onLoad: (issue: string) => void }) {
  const [issue, setIssue] = useState("buzzing");
  const cues: Record<string, string> = { buzzing: "Use only enough fretting pressure for a clear note; check fingertip angle and move close to the fret.", muted: "Arch fingers and check each intended string individually before strumming.", late: "Preview the destination shape early, then land just before the beat at a comfortable pace.", movement: "Look for a shared finger or pivot; lift only fingers that must move." };
  return <section className="trainer-growth-box" aria-label="Self-selected practice focus"><strong>Choose an issue to focus</strong><select value={issue} onChange={(event) => setIssue(event.target.value)}><option value="buzzing">Buzzing</option><option value="muted">Muted strings</option><option value="late">Late landing</option><option value="movement">Excess movement</option></select><p>{cues[issue]}</p><button className="btn" type="button" onClick={() => onLoad(issue)}>Load gentle drill</button><small>Chosen by you; Trainer does not detect this issue or start the round.</small></section>;
}

export function RoundGrowthRecap({ criteria, checks, length, comparison }: { criteria: GrowthCriteria[]; checks: Record<number, Partial<Record<GrowthCriteria, boolean>>>; length: number; comparison: { currentRate: number | null; previousRate: number | null; previousPace?: number | "manual"; pace: number | "manual"; transition: { key: string; from: string; to: string } | null } | null }) {
  return <>{criteria.length > 0 && <div className="trainer-growth-box"><strong>Personal clean standard · self-report</strong>{criteria.map((criterion) => { const answers = Object.values(checks).map((row) => row[criterion]).filter((answer): answer is boolean => typeof answer === "boolean"); return <p key={criterion}>{GROWTH_CRITERIA.find((item) => item.id === criterion)?.label}: {answers.filter(Boolean).length}/{answers.length} passes · {answers.length} rated / {length} changes</p>; })}</div>}{comparison && <div className="trainer-growth-box"><strong>Same-drill comparison</strong><p>{comparison.currentRate !== null && comparison.previousRate !== null ? `Clean rate ${Math.round((comparison.currentRate - comparison.previousRate) * 100)} points versus the prior comparable route.` : "Clean-rate comparison unavailable: insufficient rated changes."}{typeof comparison.previousPace === "number" && typeof comparison.pace === "number" ? ` Pace ${comparison.previousPace}s → ${comparison.pace}s.` : " Pace comparison unavailable for a manual or unknown tempo."}</p><p>{comparison.transition ? `Most improved transition: ${comparison.transition.key} (${comparison.transition.from} → ${comparison.transition.to}).` : "No positive per-transition rating change against the latest comparable attempt."}</p><small>Compares self-reported transition ratings on the same physical route and tuning/capo/challenge.</small></div>}</>;
}

export function FingerPlacementGuide({ chord, orientation }: { chord: Chord; orientation: "left" | "right" }) {
  const positive = chord.frets.filter((fret) => fret > 0);
  const baseFret = positive.length && Math.max(...positive) > 4 ? chord.barre?.fret ?? Math.min(...positive) : 1;
  const placements = chord.frets.flatMap((fret, stringIndex) => {
    if (fret <= 0) return [];
    const visualString = orientation === "left" ? 5 - stringIndex : stringIndex;
    return [{ stringIndex, fret, finger: chord.fingers?.[stringIndex] ?? null, left: ((22 + visualString * 31.2) / 200) * 100, top: ((32 + (fret - baseFret + 1) * 41.5 - 20.75) / 230) * 100 }];
  }).slice(0, 6);
  return <div className="trainer-finger-guide" aria-label={`Animated finger-placement guide for ${chord.name}`}><ChordDiagram chord={chord} orientation={orientation} /><div className="trainer-finger-overlay" aria-hidden="true">{placements.map((placement, index) => <span key={`${placement.stringIndex}-${placement.fret}`} style={{ left: `${placement.left}%`, top: `${placement.top}%`, animationDelay: `${index * 0.55}s` }}>{placement.finger ?? index + 1}</span>)}</div><ol>{placements.map((placement, index) => <li key={`${placement.stringIndex}-${placement.fret}`}>Step {index + 1}: finger {placement.finger ?? "choice"} to string {placement.stringIndex + 1}, fret {placement.fret}.</li>)}</ol></div>;
}
