import type { Chord } from "../components/ChordDiagram";
import type { ChordLibraryItem } from "./chords";

export type GrowthRating = "clean" | "needsWork" | "missed";
export type GrowthRound = {
  id: string; date: string; pace: number | "manual"; sequence: string[]; shapeIds?: string[];
  ratings: { clean: number; missed: number; needsWork: number }; ratedCoverage?: number;
  clarity?: { shapeSignature?: string; tuning?: string; capo?: number; challenge?: string };
  predictedCleanRate?: number | null;
  criteria?: GrowthCriteria[];
  criteriaChecks?: Record<number, GrowthCheck>;
  transitionResults?: Array<{ key: string; rating: GrowthRating }>;
};
export type GrowthCriteria = "buzzFree" | "stringsClear" | "onBeat";
export type GrowthCheck = Partial<Record<GrowthCriteria, boolean>>;
export type GrowthSetRevision = { id: string; title: string; savedAt: string; items: Array<{ name: string; shapeId: string }> };

export function namedSectionChunk(route: Chord[], section: "verse" | "chorus" | "bridge" | "turnaround", chunkSize: 4 | 8) {
  if (!route.length) return [];
  const start = Math.floor((["verse", "chorus", "bridge", "turnaround"].indexOf(section) * route.length) / 4);
  const end = Math.floor(((["verse", "chorus", "bridge", "turnaround"].indexOf(section) + 1) * route.length) / 4);
  return route.slice(start, end).slice(0, chunkSize);
}

export function sharedFrettedPositions(left: Chord, right: Chord) {
  return left.frets.flatMap((fret, index) => fret > 0 && right.frets[index] === fret && (!left.fingers?.[index] || !right.fingers?.[index] || left.fingers[index] === right.fingers[index]) ? [{ stringIndex: index, fret }] : []);
}

export function transitionBreakdown(from: Chord, to: Chord) {
  const shared = sharedFrettedPositions(from, to);
  return [`Anchor — ${shared.length ? `keep the ${shared.length} matching string/fret position${shared.length === 1 ? "" : "s"} planted.` : "No shared finger/string/fret anchor is available; prepare the hand as one unit."}`, `Release — ${shared.length ? "release non-anchor fingers without squeezing the neck." : "release together only as far as needed."}`, shared.length ? "Move — travel remaining fingers together toward their destinations." : "Move — lift fingertips only as far as needed and hover over the destination strings.", `Land — place ${to.name} close behind the frets, then test the bass-to-treble path once.`];
}

export function shapeFitsPosition(item: { chord: Chord }, lock: "off" | "open" | "low" | "mid" | "high" | "custom", customMin: number, customMax: number) {
  if (lock === "off") return true;
  if (lock !== "custom") return neckBandForChord(item.chord, lock);
  const frets = item.chord.frets.filter((fret) => fret > 0);
  const min = frets.length ? Math.min(...frets) : 0;
  const max = frets.length ? Math.max(...frets) : 0;
  return min >= customMin && max <= customMax;
}

export const GROWTH_CRITERIA: Array<{ id: GrowthCriteria; label: string }> = [
  { id: "buzzFree", label: "No buzz" },
  { id: "stringsClear", label: "Intended strings clear" },
  { id: "onBeat", label: "Landed on beat" }
];

export function neckBandForChord(chord: Chord, band: "open" | "low" | "mid" | "high") {
  const frets = chord.frets.filter((fret) => fret > 0);
  const min = frets.length ? Math.min(...frets) : 0;
  const max = frets.length ? Math.max(...frets) : 0;
  const hasOpenString = chord.frets.some((fret) => fret === 0);
  if (band === "open") return hasOpenString && max <= 4;
  if (band === "low") return !hasOpenString && min >= 1 && max <= 5;
  if (band === "mid") return !hasOpenString && min >= 6 && max <= 9;
  return !hasOpenString && min >= 10 && max <= 12;
}

export function buildNeckLadder(progression: Chord[], library: ChordLibraryItem[], sameHarmony: (left: Chord, right: Chord) => boolean) {
  const bands = ["open", "low", "mid", "high"] as const;
  const steps = bands.flatMap((band) => {
    const route = progression.map((chord) => library.find((item) => sameHarmony(item.chord, chord) && neckBandForChord(item.chord, band))?.chord ?? null);
    return route.length >= 2 && route.every(Boolean) ? [{ band, route: route as Chord[] }] : [];
  });
  return steps;
}

export function growthRouteKey(round: GrowthRound) {
  return round.shapeIds?.length === round.sequence.length && round.shapeIds.every(Boolean)
    ? round.shapeIds.join("|")
    : "";
}

export function compareTransitionRatings(current: GrowthRound, previous: GrowthRound | undefined) {
  if (!previous || !current.transitionResults?.length || !previous.transitionResults?.length) return null;
  const prior = new Map(previous.transitionResults.map((item) => [item.key, item.rating]));
  const score = (rating: GrowthRating) => rating === "clean" ? 1 : rating === "needsWork" ? 0.5 : 0;
  const deltas = current.transitionResults.flatMap((item) => {
    const old = prior.get(item.key);
    return old ? [{ key: item.key, from: old, to: item.rating, delta: score(item.rating) - score(old) }] : [];
  }).sort((left, right) => right.delta - left.delta);
  const currentRated = current.ratings.clean + current.ratings.needsWork + current.ratings.missed;
  const priorRated = previous.ratings.clean + previous.ratings.needsWork + previous.ratings.missed;
  return {
    previous,
    currentRate: currentRated ? current.ratings.clean / currentRated : null,
    previousRate: priorRated ? previous.ratings.clean / priorRated : null,
    transition: deltas[0]?.delta > 0 ? deltas[0] : null
  };
}

export function evaluateCriteria(criteria: GrowthCriteria[], checks: Record<number, GrowthCheck>) {
  return criteria.map((criterion) => {
    const values = Object.values(checks).flatMap((item) => typeof item[criterion] === "boolean" ? [item[criterion] as boolean] : []);
    return { criterion, passed: values.filter(Boolean).length, checked: values.length };
  });
}

export function routeRevisionDiff(previous: GrowthSetRevision | undefined, current: GrowthSetRevision) {
  if (!previous) return null;
  const withOccurrences = (items: GrowthSetRevision["items"]) => {
    const counts = new Map<string, number>();
    return items.map((item) => {
      const occurrence = counts.get(item.name) ?? 0;
      counts.set(item.name, occurrence + 1);
      return { ...item, key: `${item.name}\u0000${occurrence}` };
    });
  };
  const oldItems = withOccurrences(previous.items);
  const newItems = withOccurrences(current.items);
  const oldByOccurrence = new Map(oldItems.map((item) => [item.key, item.shapeId]));
  const newByOccurrence = new Map(newItems.map((item) => [item.key, item.shapeId]));
  const added = newItems.filter((item) => !oldByOccurrence.has(item.key)).map((item) => item.name);
  const removed = oldItems.filter((item) => !newByOccurrence.has(item.key)).map((item) => item.name);
  const shapesChanged = newItems.filter((item) => oldByOccurrence.has(item.key) && oldByOccurrence.get(item.key) !== item.shapeId).map((item) => item.name);
  const oldOrder = oldItems.map((item) => item.key).filter((key) => newByOccurrence.has(key));
  const newOrder = newItems.map((item) => item.key).filter((key) => oldByOccurrence.has(key));
  const reordered = oldOrder.join("|") !== newOrder.join("|");
  return { added, removed, shapesChanged, reordered };
}

export function confidenceCalibration(rounds: GrowthRound[]) {
  const eligible = rounds.filter((round) => typeof round.predictedCleanRate === "number" && (round.ratedCoverage ?? 0) >= 50 && round.sequence.length > 0);
  const sample = eligible.slice(0, 20);
  if (sample.length < 3) return { count: sample.length, prediction: null as number | null, actual: null as number | null, delta: null as number | null };
  const prediction = sample.reduce((sum, round) => sum + (round.predictedCleanRate ?? 0), 0) / sample.length;
  const actual = sample.reduce((sum, round) => sum + (round.ratings.clean / Math.max(1, round.ratings.clean + round.ratings.needsWork + round.ratings.missed)) * 100, 0) / sample.length;
  return { count: sample.length, prediction, actual, delta: actual - prediction };
}

export function crossDayConsistency(rounds: GrowthRound[]) {
  const eligible = rounds.filter((round) => round.shapeIds?.length === round.sequence.length && round.sequence.length > 0 && typeof round.pace === "number" && (round.ratedCoverage ?? 0) >= 80 && round.ratings.clean / Math.max(1, round.ratings.clean + round.ratings.needsWork + round.ratings.missed) >= 0.8 && round.clarity?.tuning !== undefined && round.clarity?.capo !== undefined && round.clarity?.challenge !== undefined);
  for (const anchor of eligible) {
    const same = eligible.filter((round) => growthRouteKey(round) === growthRouteKey(anchor) && round.clarity?.tuning === anchor.clarity?.tuning && round.clarity?.capo === anchor.clarity?.capo && round.clarity?.challenge === anchor.clarity?.challenge);
    const dates = new Set(same.map((round) => round.date));
    const tempos = new Set(same.map((round) => round.pace));
    if (same.length >= 3 && dates.size >= 2 && tempos.size >= 2) return { state: "Consistent across days and tempos", detail: `${same.length} matching rated rounds across ${dates.size} dates and ${tempos.size} tempos; each independently met 80% coverage and clean accuracy.` };
  }
  return { state: "Provisional", detail: "Need 3 matching rounds across at least 2 dates and 2 numeric tempos; every round must independently meet 80% coverage and clean accuracy." };
}
