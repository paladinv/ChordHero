import { RIGHT_HAND_EXERCISES, type RightHandTechnique } from "./rightHandExercises";
import type { PracticeResult } from "./practicePlatform";

const DAY = 86_400_000;
const RIGHT_HAND_TAKE_HISTORY_KEY = "chord-hero:right-hand:recording-history:v2";
const techniqueById = new Map(RIGHT_HAND_EXERCISES.map((exercise) => [exercise.id, exercise.technique]));
const exerciseById = new Map(RIGHT_HAND_EXERCISES.map((exercise) => [exercise.id, exercise]));
type RightHandContext = NonNullable<PracticeResult["rightHandContext"]>;

export type RightHandTrendCohort = RightHandContext & {
  key: string;
  exerciseId: string;
  exerciseTitle: string;
  technique: RightHandTechnique;
  count: number;
  latestAt: string;
};

function retainedRecordingIds(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RIGHT_HAND_TAKE_HISTORY_KEY);
    // Strict browser-side trend evidence fails closed when retained-take state is unavailable.
    if (raw === null) return new Set();
    const history = JSON.parse(raw) as unknown;
    if (!history || typeof history !== "object" || Array.isArray(history)) return new Set();
    const ids = new Set<string>();
    for (const takes of Object.values(history as Record<string, unknown>)) {
      if (!Array.isArray(takes)) return new Set();
      for (const take of takes) {
        if (!take || typeof take !== "object") return new Set();
        const entry = take as { id?: unknown; reviewAccepted?: unknown; analysis?: { reviewAccepted?: unknown } };
        if (typeof entry.id === "string" && entry.reviewAccepted !== false && entry.analysis?.reviewAccepted !== false) ids.add(entry.id);
      }
    }
    return ids;
  } catch {
    return new Set();
  }
}

export function rightHandTrendCohortKey(event: Pick<PracticeResult, "itemId" | "rightHandContext">) {
  const context = event.rightHandContext;
  if (!context) return null;
  return [event.itemId, context.tempo, JSON.stringify(context.pattern), JSON.stringify(context.chordProgression), context.scoringMode, context.instrumentProfile].join("|");
}

export function isValidRightHandTrendEvidence(event: PracticeResult): event is PracticeResult & { recordingId: string; score: number; scoreReliability: "reliable"; rightHandContext: RightHandContext } {
  const context = event.rightHandContext;
  if (event.area !== "rightHand" || typeof event.recordingId !== "string" || !event.recordingId.trim() || event.reviewAccepted !== true || event.scoreReliability !== "reliable" || typeof event.score !== "number" || !Number.isFinite(event.score) || event.score < 0 || event.score > 100 || !context || !Number.isFinite(context.tempo) || context.tempo < 20 || context.tempo > 300 || !Array.isArray(context.pattern) || !context.pattern.length || !context.pattern.every((token) => typeof token === "string") || !Array.isArray(context.chordProgression) || !context.chordProgression.every((chord) => typeof chord === "string") || !["timing", "root", "quality"].includes(context.scoringMode) || !["acoustic", "electric"].includes(context.instrumentProfile) || context.retained !== true) return false;
  // Reliable means full-pattern evidence for historical comparison, not merely a partial usable score.
  if (event.timingEvidenceCount === undefined || event.expectedTimingCount === undefined || event.expectedTimingCount < 1 || event.timingEvidenceCount !== event.expectedTimingCount) return false;
  return true;
}

function retainedAcceptedEvents(events: readonly PracticeResult[], now: number) {
  const start = now - 28 * DAY;
  const retainedIds = retainedRecordingIds();
  const unique = new Map<string, PracticeResult>();
  for (const event of events) {
    const timestamp = Date.parse(event.practisedAt);
    if (!isValidRightHandTrendEvidence(event) || (retainedIds !== null && !retainedIds.has(event.recordingId)) || !exerciseById.has(event.itemId) || !Number.isFinite(timestamp) || timestamp < start || timestamp > now) continue;
    const previous = unique.get(event.recordingId);
    if (!previous || timestamp >= Date.parse(previous.practisedAt)) unique.set(event.recordingId, event);
  }
  return [...unique.values()];
}

export function rightHandTrendCohorts(events: readonly PracticeResult[], now = Date.now()): RightHandTrendCohort[] {
  const end = Number.isFinite(now) ? now : Date.now();
  const grouped = new Map<string, RightHandTrendCohort>();
  retainedAcceptedEvents(events, end).forEach((event) => {
    const context = event.rightHandContext;
    const key = rightHandTrendCohortKey(event);
    const exercise = exerciseById.get(event.itemId);
    if (!context || !key || !exercise) return;
    const current = grouped.get(key);
    grouped.set(key, current ? { ...current, count: current.count + 1, latestAt: event.practisedAt > current.latestAt ? event.practisedAt : current.latestAt } : { key, exerciseId: event.itemId, exerciseTitle: exercise.title, technique: exercise.technique, ...context, count: 1, latestAt: event.practisedAt });
  });
  return [...grouped.values()].sort((left, right) => right.count - left.count || right.latestAt.localeCompare(left.latestAt));
}

export function rightHandFourWeekTrend(events: readonly PracticeResult[], now = Date.now(), selectedCohortKey?: string) {
  const end = Number.isFinite(now) ? now : Date.now();
  const start = end - 28 * DAY;
  const cohortKey = selectedCohortKey ?? rightHandTrendCohorts(events, end)[0]?.key;
  const accepted = retainedAcceptedEvents(events, end).filter((event) => !cohortKey || rightHandTrendCohortKey(event) === cohortKey);
  return Array.from({ length: 4 }, (_, index) => {
    const from = start + index * 7 * DAY, to = from + 7 * DAY;
    const selectedTechnique = accepted.length ? techniqueById.get(accepted[0].itemId) ?? null : null;
    const samples = selectedTechnique ? accepted.filter((event) => techniqueById.get(event.itemId) === selectedTechnique && Date.parse(event.practisedAt) >= from && (index === 3 ? Date.parse(event.practisedAt) <= to : Date.parse(event.practisedAt) < to)) : [];
    const techniques = selectedTechnique ? { [selectedTechnique]: { count: samples.length, average: samples.length ? Math.round(samples.reduce((sum, event) => sum + event.score!, 0) / samples.length) : null } } as Partial<Record<RightHandTechnique, { count: number; average: number | null }>> : {};
    return { from, to, selectedTechnique, techniques };
  });
}
