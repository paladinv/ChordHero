"use client";

import { useMemo, useState } from "react";
import { EvidenceRound, reverseTransition, setupContexts, stableTempoRange, transitionEvidence } from "../lib/trainerEvidence";

export default function TrainerEvidenceComparisons({ rounds, transitions }: { rounds: EvidenceRound[]; transitions: Record<string, { clean: number; missed: number; needsWork: number; score: number }> }) {
  const [key, setKey] = useState("");
  const keys = useMemo(() => Object.keys(transitions).filter((item) => !item.startsWith("Start ")).slice(-80), [transitions]);
  const selected = key || keys[0] || "";
  const current = useMemo(() => selected ? transitionEvidence(rounds, selected) : null, [rounds, selected]);
  const reverseKey = reverseTransition(selected);
  const reverse = useMemo(() => reverseKey ? transitionEvidence(rounds, reverseKey) : null, [rounds, reverseKey]);
  const route = rounds.find((round) => selected && round.sequence.slice(1).some((to, index) => `${round.sequence[index]} → ${to}` === selected));
  const routeKey = route && route.shapeIds?.length === route.sequence.length ? route.shapeIds.join("|") : "";
  const tempo = useMemo(() => stableTempoRange(rounds, routeKey || undefined), [rounds, routeKey]);
  const contexts = useMemo(() => routeKey ? setupContexts(rounds, routeKey) : [], [rounds, routeKey]);
  return <section className="trainer-evidence-comparisons" aria-label="Transition evidence">
    <h3>Transition evidence</h3>
    <label>Directed change <select value={selected} onChange={(event) => setKey(event.target.value)}>{keys.map((item) => <option key={item}>{item}</option>)}</select></label>
    {current ? <div className="trainer-evidence-grid">
      <article><strong>{selected}</strong><p>{current.attempts} self-rated changes · {current.rate === null ? "No round-level sample" : `${Math.round(current.rate * 100)}% clean`}</p><small>{current.provisional ? "Provisional: fewer than 5 self-ratings" : "Self-reported estimate"}{current.interval ? ` · 95% interval ${Math.round(current.interval.low * 100)}–${Math.round(current.interval.high * 100)}%` : ""}</small></article>
      <article><strong>{reverseKey} (reverse)</strong><p>{reverse?.attempts ?? 0} self-rated changes · {reverse?.rate === null || !reverse ? "No round-level sample" : `${Math.round(reverse.rate * 100)}% clean`}</p><small>Directions remain separate; no pooling.</small></article>
    </div> : <p>Rate changes in completed rounds to build a comparison.</p>}
    <p><strong>Stable tempo:</strong> {tempo.paces ? `${tempo.paces[0]}–${tempo.paces[1]} seconds per change across ${tempo.count} qualifying exact-route rounds.` : `Provisional: ${tempo.count}/3 matching, adequately rated rounds. Mixed or unknown setup contexts are excluded.`}</p>
    <details><summary>Same physical route across setups</summary>{contexts.length ? <ul>{contexts.slice(0, 8).map((item) => <li key={item.id}>{item.tuning} · capo {item.capo ?? "unknown"} · {item.profile} · {item.challenge} · position {item.position} — {Math.round(item.accuracy * 100)}% clean, {item.pace === "manual" ? "manual" : `${item.pace}s`}</li>)}</ul> : <p>Exact physical shape route context is not available yet.</p>}</details>
  </section>;
}
