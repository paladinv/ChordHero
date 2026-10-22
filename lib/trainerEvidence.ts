export type EvidenceRound = {
  id: string;
  sequence: string[];
  shapeIds?: string[];
  pace: number | "manual";
  ratings: { clean: number; missed: number; needsWork: number };
  transitionResults?: Array<{ key: string; rating: "clean" | "missed" | "needsWork" }>;
  ratedCoverage?: number;
  clarity?: { tuning?: string; capo?: number; challenge?: string; rhythm?: boolean; bpm?: number | null; instrumentProfile?: string; position?: string; setupKnown?: boolean };
};

export function wilsonInterval(successes: number, attempts: number, z = 1.96) {
  const n = Math.max(0, Math.floor(attempts));
  if (!n) return null;
  const p = Math.min(1, Math.max(0, successes / n));
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export function transitionEvidence(rounds: EvidenceRound[], key: string) {
  const ratings = rounds.flatMap((round) => round.transitionResults?.filter((item) => item.key === key) ?? []);
  const clean = ratings.filter((item) => item.rating === "clean").length;
  const n = ratings.length;
  return { attempts: n, clean, rate: n ? clean / n : null, interval: wilsonInterval(clean, n), provisional: n < 5 };
}

function exactRoute(round: EvidenceRound) {
  return round.shapeIds?.length === round.sequence.length && round.sequence.length > 1
    ? round.shapeIds.join("|")
    : "";
}

function comparableContext(round: EvidenceRound) {
  const c = round.clarity;
  if (!c || c.setupKnown !== true || !c.tuning || typeof c.capo !== "number" || !c.challenge || typeof c.rhythm !== "boolean" || c.instrumentProfile === undefined || c.position === undefined) return null;
  return [c.tuning, c.capo, c.challenge, c.rhythm, c.rhythm ? c.bpm : "off", c.instrumentProfile, c.position].join("|");
}

export function stableTempoRange(rounds: EvidenceRound[], routeKey?: string) {
  const eligible = rounds.filter((round) => {
    const rated = round.ratings.clean + round.ratings.missed + round.ratings.needsWork;
    return typeof round.pace === "number" && exactRoute(round) && (!routeKey || exactRoute(round) === routeKey) && comparableContext(round) &&
      (round.ratedCoverage ?? 0) >= 80 && rated >= Math.ceil(round.sequence.length * 0.8) && round.ratings.clean / Math.max(1, rated) >= 0.8;
  });
  const anchor = eligible[0];
  if (!anchor) return { paces: null as [number, number] | null, count: 0 };
  const same = eligible.filter((round) => exactRoute(round) === exactRoute(anchor) && comparableContext(round) === comparableContext(anchor));
  const paces = Array.from(new Set(same.map((round) => round.pace as number))).sort((a, b) => a - b);
  return { paces: same.length >= 3 ? [paces[0], paces.at(-1)!] as [number, number] : null, count: same.length };
}

export function reverseTransition(key: string) {
  const [from, to] = key.split(" → ");
  return from && to ? `${to} → ${from}` : "";
}

export function previousComparableBenchmark<T extends { drill: string; shapeIds?: string[]; ratings: { clean: number }; clarity?: { tuning?: string; capo?: number; challenge?: string; rhythm?: boolean; bpm?: number | null; instrumentProfile?: string; position?: string } }>(rounds: T[], route: string[] | undefined, setup: { tuning: string; capo: number; challenge: string; rhythm: boolean; bpm: number | null; instrumentProfile: string; position: string }) {
  const key = route?.slice(0, 40).join("|");
  return key ? rounds.find((round) => round.drill === "One-minute chord-change benchmark" && round.shapeIds?.slice(0, 40).join("|") === key && round.clarity?.tuning === setup.tuning && round.clarity?.capo === setup.capo && round.clarity?.challenge === setup.challenge && round.clarity?.rhythm === setup.rhythm && round.clarity?.bpm === setup.bpm && round.clarity?.instrumentProfile === setup.instrumentProfile && round.clarity?.position === setup.position) : undefined;
}

export function retentionComparison<T extends { id: string; retentionSourceId?: string; retentionIntervalDays?: 1 | 7; ratings: { clean: number; missed: number; needsWork: number }; pace: number | "manual" }>(rounds: T[]) {
  const retest = rounds.find((round) => round.retentionSourceId && round.retentionIntervalDays);
  const source = retest ? rounds.find((round) => round.id === retest.retentionSourceId) : undefined;
  if (!retest || !source) return null;
  const rate = (round: T) => { const n = round.ratings.clean + round.ratings.missed + round.ratings.needsWork; return n ? round.ratings.clean / n : null; };
  return { interval: retest.retentionIntervalDays!, source: rate(source), current: rate(retest), sourcePace: source.pace, currentPace: retest.pace };
}

export function setupContexts(rounds: EvidenceRound[], routeKey: string) {
  return rounds.filter((round) => exactRoute(round) === routeKey).flatMap((round) => {
    const c = round.clarity;
    if (!c) return [];
    if (c.setupKnown !== true) return [{ id: round.id, tuning: "Unknown", capo: null, challenge: "Unknown", profile: "Unknown", position: "Unknown", accuracy: round.ratings.clean / Math.max(1, round.ratings.clean + round.ratings.missed + round.ratings.needsWork), pace: round.pace }];
    return [{ id: round.id, tuning: c.tuning ?? "Unknown", capo: typeof c.capo === "number" ? c.capo : null, challenge: c.challenge ?? "Unknown", profile: c.instrumentProfile ?? "Unknown", position: c.position ?? "Unknown", accuracy: round.ratings.clean / Math.max(1, round.ratings.clean + round.ratings.missed + round.ratings.needsWork), pace: round.pace }];
  }).slice(0, 100);
}
