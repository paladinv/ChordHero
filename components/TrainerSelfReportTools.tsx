"use client";

import { useEffect, useMemo, useState } from "react";
import type { Chord } from "./ChordDiagram";
import type { EvidenceRound } from "../lib/trainerEvidence";

export type MissTag = "late" | "muted" | "fingerMovement" | "tensionFatigue";
export function BenchmarkResult({ latest, previous }: { latest: number; previous?: number }) {
  const delta = latest - (previous ?? latest);
  return <strong className="trainer-benchmark-result">Latest result: {latest} clean changes in 60 seconds{previous === undefined ? " · first comparable run" : ` · ${delta >= 0 ? "+" : ""}${delta} vs previous comparable run (${previous})`}</strong>;
}
export function RetentionResult({ value }: { value: { interval: number; source: number | null; current: number | null; sourcePace: number | "manual"; currentPace: number | "manual" } | null }) {
  return value ? <p className="trainer-retention-result">{value.interval}-day retention: {value.source === null || value.current === null ? "not enough rated changes to compare" : `${Math.round(value.source * 100)}% → ${Math.round(value.current * 100)}% clean`} · pace {value.sourcePace}s → {value.currentPace}s. Self-rated round results; no sound detection.</p> : null;
}
const TAGS: Array<[MissTag, string]> = [["late", "Late change"], ["muted", "Muted string"], ["fingerMovement", "Finger movement"], ["tensionFatigue", "Tension / fatigue"]];

export function MissTagPicker({ value, onChange, rounds }: { value: MissTag[]; onChange: (next: MissTag[]) => void; rounds: Array<EvidenceRound & { missTags?: Record<number, MissTag[]> }> }) {
  const recurring = useMemo(() => {
    const counts = new Map<MissTag, number>();
    rounds.slice(0, 100).forEach((round) => Object.values(round.missTags ?? {}).flat().forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
  }, [rounds]);
  return <div className="trainer-self-report-tags"><small>Optional self-report — what made this change difficult?</small>{TAGS.map(([tag, label]) => <button type="button" key={tag} aria-pressed={value.includes(tag)} onClick={() => onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag].slice(0, 4))}>{label}</button>)}{recurring.length > 0 && <small>Recurring self-reports: {recurring.map(([tag, count]) => `${TAGS.find(([id]) => id === tag)?.[1]} (${count})`).join(" · ")}. These are not automatically detected.</small>}</div>;
}

type Probe = { from: string; to: string; baseline: number | null; after: number | null; step: "baseline" | "drill" | "retest" | "result"; updated: number };
const KEY = "chordHero.trainer.transitionProbe.v1";
export function TransitionProbe({ pairs, resolve, onStart }: { pairs: string[]; resolve: (name: string) => Chord | undefined; onStart: (route: Chord[], label: string) => void }) {
  const [probe, setProbe] = useState<Probe | null>(null);
  const [choice, setChoice] = useState("");
  useEffect(() => { try { const raw = localStorage.getItem(KEY); const value = raw ? JSON.parse(raw) as Probe : null; if (value && ["baseline", "drill", "retest", "result"].includes(value.step)) setProbe(value); } catch {} }, []);
  const persist = (next: Probe | null) => { setProbe(next); try { if (next) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY); } catch {} };
  const selected = probe ? `${probe.from} → ${probe.to}` : choice;
  const start = (stage: "drill" | "retest") => {
    const [from, to] = selected.split(" → "); const a = resolve(from); const b = resolve(to);
    if (!a || !b || !from || !to) return;
    const next = probe ?? { from, to, baseline: null, after: null, step: "baseline" as const, updated: Date.now() };
    persist({ ...next, step: stage, updated: Date.now() });
    onStart([a, b, a, b, a, b], `${stage === "drill" ? "Focused drill" : "Same-transition retest"} · ${from} → ${to}`);
  };
  const rate = (value: number) => {
    if (!probe) return;
    persist(probe.step === "baseline" ? { ...probe, baseline: value, step: "baseline", updated: Date.now() } : { ...probe, after: value, step: "result", updated: Date.now() });
  };
  return <article className="trainer-transition-probe"><h3>Before / after transition check</h3><p>Self-rate confidence from 1–5, practice the exact direction, then repeat and compare. The drill timer starts only when you choose to start it.</p>
    {!probe && <label>Directed transition <select value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">Choose a tracked transition</option>{pairs.map((pair) => <option key={pair}>{pair}</option>)}</select></label>}
    {probe?.step === "result" ? <><strong>{probe.from} → {probe.to}: {probe.baseline}/5 before, {probe.after}/5 after ({(probe.after ?? 0) - (probe.baseline ?? 0) >= 0 ? "+" : ""}{(probe.after ?? 0) - (probe.baseline ?? 0)})</strong><button type="button" onClick={() => persist(null)}>Clear check</button></> : null}
    {(probe?.step === "baseline" || !probe) && <div>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => { if (!probe) { const [from, to] = selected.split(" → "); if (from && to) persist({ from, to, baseline: value, after: null, step: "baseline", updated: Date.now() }); } else rate(value); }}>{value}</button>)}<small>Baseline confidence</small></div>}
    {probe?.step === "baseline" && probe.baseline !== null && <button type="button" onClick={() => start("drill")}>Start focused drill</button>}
    {probe?.step === "drill" && <p>Focused route loaded. Complete it, then return here and start the same-direction retest.</p>}
    {probe?.step === "drill" && <button type="button" onClick={() => start("retest")}>Start same-transition retest</button>}
    {probe?.step === "retest" && <><p>Retest loaded. Complete it, then self-rate your confidence afterward.</p>{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => rate(value)}>{value}</button>)}</>}
  </article>;
}
