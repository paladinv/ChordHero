import { RIGHT_HAND_EXERCISES, type RightHandTechnique } from "./rightHandExercises";

export type PracticeArea = "chords" | "songs" | "rightHand";

export type PracticeResult = {
  id: string;
  area: PracticeArea;
  itemId: string;
  title: string;
  practisedAt: string;
  seconds: number;
  score?: number;
  misses?: number;
  tempo?: number;
  note?: string;
};

export type DailyPracticeTask = {
  id: string;
  area: PracticeArea;
  title: string;
  reason: string;
  href: string;
  minutes: number;
  completedAt?: string;
};

export type DailyPracticePlan = {
  date: string;
  tasks: DailyPracticeTask[];
};

export type PracticeAssignment = {
  id: string;
  studentName: string;
  title: string;
  instructions: string;
  area: PracticeArea;
  itemId?: string;
  targetMinutes: number;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type CustomRightHandRoutine = {
  id: string;
  title: string;
  pattern: string[];
  technique: RightHandTechnique;
  bpm: number;
  createdAt: string;
};

export type AccessibilityPreferences = {
  reducedMotion: boolean;
  highContrast: boolean;
  diagramScale: number;
  audioVolume: number;
  audioMuted: boolean;
  haptics: boolean;
  handedness: "right" | "left";
};

export type PracticePlatformState = {
  schemaVersion: 1;
  updatedAt: string;
  events: PracticeResult[];
  plans: DailyPracticePlan[];
  assignments: PracticeAssignment[];
  customRoutines: CustomRightHandRoutine[];
  accessibility: AccessibilityPreferences;
};

export const PRACTICE_STORAGE_KEY = "chord-hero:practice-platform:v1";
export const PRACTICE_STATE_EVENT = "chord-hero:practice-state";

export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  reducedMotion: false,
  highContrast: false,
  diagramScale: 1,
  audioVolume: 0.8,
  audioMuted: false,
  haptics: true,
  handedness: "right"
};

export function emptyPracticePlatformState(): PracticePlatformState {
  return {
    schemaVersion: 1,
    updatedAt: new Date(0).toISOString(),
    events: [],
    plans: [],
    assignments: [],
    customRoutines: [],
    accessibility: { ...DEFAULT_ACCESSIBILITY }
  };
}

export function normalizePracticePlatformState(value: unknown): PracticePlatformState {
  const fallback = emptyPracticePlatformState();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<PracticePlatformState>;
  return {
    schemaVersion: 1,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : fallback.updatedAt,
    events: Array.isArray(source.events) ? source.events.slice(-500) : [],
    plans: Array.isArray(source.plans) ? source.plans.slice(-31) : [],
    assignments: Array.isArray(source.assignments) ? source.assignments : [],
    customRoutines: Array.isArray(source.customRoutines) ? source.customRoutines : [],
    accessibility: { ...DEFAULT_ACCESSIBILITY, ...(source.accessibility ?? {}) }
  };
}

export function readPracticePlatformState(): PracticePlatformState {
  if (typeof window === "undefined") return emptyPracticePlatformState();
  try {
    return normalizePracticePlatformState(JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "null"));
  } catch {
    return emptyPracticePlatformState();
  }
}

export function writePracticePlatformState(state: PracticePlatformState) {
  if (typeof window === "undefined") return;
  const next = normalizePracticePlatformState({ ...state, updatedAt: new Date().toISOString() });
  window.localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PRACTICE_STATE_EVENT, { detail: next }));
}

export function updatePracticePlatformState(update: (state: PracticePlatformState) => PracticePlatformState) {
  const next = update(readPracticePlatformState());
  writePracticePlatformState(next);
  return next;
}

export function recordPracticeResult(result: Omit<PracticeResult, "id" | "practisedAt">) {
  return updatePracticePlatformState((state) => ({
    ...state,
    events: [...state.events, {
      ...result,
      id: globalThis.crypto?.randomUUID?.() ?? `practice-${Date.now()}`,
      practisedAt: new Date().toISOString()
    }].slice(-500)
  }));
}

const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);

function weakestRightHandExercise(state: PracticePlatformState) {
  const scoreByItem = new Map<string, { total: number; count: number; misses: number }>();
  state.events.filter((event) => event.area === "rightHand").forEach((event) => {
    const current = scoreByItem.get(event.itemId) ?? { total: 0, count: 0, misses: 0 };
    current.total += event.score ?? 70;
    current.count += 1;
    current.misses += event.misses ?? 0;
    scoreByItem.set(event.itemId, current);
  });
  return RIGHT_HAND_EXERCISES.reduce((weakest, exercise) => {
    const result = scoreByItem.get(exercise.id);
    const priority = result ? (100 - result.total / result.count) + result.misses * 4 : 42;
    return priority > weakest.priority ? { exercise, priority } : weakest;
  }, { exercise: RIGHT_HAND_EXERCISES[0], priority: -1 });
}

export function buildDailyPracticePlan(state: PracticePlatformState, today = dateKey()): DailyPracticePlan {
  const existing = state.plans.find((plan) => plan.date === today);
  if (existing) return existing;
  const weakest = weakestRightHandExercise(state).exercise;
  const recentAreas = new Set(state.events.slice(-8).map((event) => event.area));
  return {
    date: today,
    tasks: [
      {
        id: `${today}:chords`, area: "chords", title: "Clean chord changes",
        reason: recentAreas.has("chords") ? "Keep yesterday’s chord work moving." : "Chord changes have had the least recent attention.",
        href: "/trainer", minutes: 5
      },
      {
        id: `${today}:right-hand`, area: "rightHand", title: weakest.title,
        reason: `Recommended ${weakest.technique} drill from recent accuracy and practice history.`,
        href: `/right-hand?exercise=${encodeURIComponent(weakest.id)}`, minutes: 8
      },
      {
        id: `${today}:songs`, area: "songs", title: "Put it into a song",
        reason: recentAreas.has("songs") ? "Revisit a familiar progression in musical context." : "Apply today’s changes and rhythm to a full progression.",
        href: "/songs", minutes: 10
      }
    ]
  };
}

export function ensureDailyPracticePlan() {
  const state = readPracticePlatformState();
  const plan = buildDailyPracticePlan(state);
  if (!state.plans.some((item) => item.date === plan.date)) {
    writePracticePlatformState({ ...state, plans: [...state.plans, plan].slice(-31) });
  }
  return plan;
}

export function mergePracticePlatformStates(local: PracticePlatformState, remote: PracticePlatformState): PracticePlatformState {
  const mergeById = <T extends { id: string }>(left: T[], right: T[]) => [...new Map([...left, ...right].map((item) => [item.id, item])).values()];
  const newer = remote.updatedAt >= local.updatedAt ? remote : local;
  return normalizePracticePlatformState({
    ...newer,
    events: mergeById(local.events, remote.events).slice(-500),
    plans: [...new Map([...local.plans, ...remote.plans].map((plan) => [plan.date, plan])).values()].slice(-31),
    assignments: mergeById(local.assignments, remote.assignments),
    customRoutines: mergeById(local.customRoutines, remote.customRoutines),
    accessibility: newer.accessibility
  });
}

export function practiceReportText(state: PracticePlatformState, studentName = "Student") {
  const totalSeconds = state.events.reduce((sum, event) => sum + event.seconds, 0);
  const averageScoreEvents = state.events.filter((event) => typeof event.score === "number");
  const averageScore = averageScoreEvents.length
    ? Math.round(averageScoreEvents.reduce((sum, event) => sum + (event.score ?? 0), 0) / averageScoreEvents.length)
    : 0;
  const areaTotals = (["chords", "songs", "rightHand"] as PracticeArea[]).map((area) => {
    const events = state.events.filter((event) => event.area === area);
    return `${area}: ${events.length} sessions, ${Math.round(events.reduce((sum, event) => sum + event.seconds, 0) / 60)} minutes`;
  });
  return [
    "Chord Hero practice report",
    `Student: ${studentName}`,
    `Generated: ${new Date().toLocaleDateString()}`,
    `Total practice: ${Math.round(totalSeconds / 60)} minutes`,
    `Average timing score: ${averageScore || "Not yet scored"}`,
    ...areaTotals,
    "",
    "Recent work:",
    ...state.events.slice(-10).reverse().map((event) => `• ${event.title} — ${Math.round(event.seconds / 60)} min${event.score ? ` — ${event.score}%` : ""}`)
  ].join("\n");
}
