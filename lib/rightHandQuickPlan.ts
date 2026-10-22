import { RIGHT_HAND_EXERCISES, type RightHandExercise } from "./rightHandExercises";
import type { PracticeResult } from "./practicePlatform";

export const QUICK_SESSION_CONTROL = "chord-hero:right-hand-quick-control";
export const QUICK_SESSION_STATE = "chord-hero:right-hand-quick-state";
export const QUICK_PLAYER_START = "chord-hero:right-hand-start";
export type QuickStage = { kind: "warmup" | "focus" | "music"; exerciseId: string; bpm: number; progressionId: string };
export type QuickSession = { stages: QuickStage[]; index: number; phase: "preparing" | "running" | "rest" | "paused" | "complete"; restRemaining: number; pausedFrom?: "rest" | "stage" };
export type QuickControl = { action: "start"; stages: QuickStage[] } | { action: "pause" | "resume" | "cancel" | "status" };
export type QuickPlayerState = { exerciseId: string; bpm: number; progressionId: string; seconds: number; status: string; startRequested?: boolean };
export type QuickPlanEvidence = { technique: RightHandExercise["technique"]; evidenceCount: number; comparableTakeCount: number; reason: string };

const MIN_RELIABLE_TAKES = 2;
const MIN_TIMING_EVIDENCE = 4;

function reliableComparableTake(event: PracticeResult) {
  if (event.area !== "rightHand" || !event.recordingId || event.reviewAccepted !== true || event.scoreReliability !== "reliable") return false;
  if (!event.rightHandContext?.retained || !Array.isArray(event.rightHandContext.pattern) || event.rightHandContext.pattern.length < 2) return false;
  const evidence = event.timingEvidenceCount ?? 0;
  const expected = event.expectedTimingCount ?? 0;
  return Number.isFinite(event.score) && evidence >= MIN_TIMING_EVIDENCE && expected >= MIN_TIMING_EVIDENCE && evidence / expected >= 0.5;
}

export function quickPracticePlanEvidence(exercise: RightHandExercise, events: readonly PracticeResult[]): QuickPlanEvidence {
  const latestByRecording = new Map<string, { event: PracticeResult; index: number }>();
  events.filter(reliableComparableTake).forEach((event, index) => {
    const existing = latestByRecording.get(event.recordingId!);
    const eventTime = Date.parse(event.practisedAt);
    const existingTime = existing ? Date.parse(existing.event.practisedAt) : Number.NEGATIVE_INFINITY;
    if (!existing || eventTime > existingTime || (eventTime === existingTime && index > existing.index)) latestByRecording.set(event.recordingId!, { event, index });
  });
  const recent = [...latestByRecording.values()].sort((left, right) => {
    const timeDelta = Date.parse(left.event.practisedAt) - Date.parse(right.event.practisedAt);
    return timeDelta || left.index - right.index;
  }).slice(-90).map(({ event }) => event);
  const candidates = (["strumming", "plectrum", "fingerpicking"] as const).map((technique) => {
    const ids = new Set(RIGHT_HAND_EXERCISES.filter((item) => item.technique === technique).map((item) => item.id));
    const takes = recent.filter((event) => ids.has(event.itemId));
    return takes.length >= MIN_RELIABLE_TAKES
      ? { technique, takes, average: takes.reduce((sum, event) => sum + (event.score ?? 0), 0) / takes.length }
      : null;
  }).filter((entry): entry is { technique: RightHandExercise["technique"]; takes: PracticeResult[]; average: number } => Boolean(entry)).sort((a, b) => a.average - b.average);
  const weakest = candidates[0];
  if (!weakest) return { technique: exercise.technique, evidenceCount: 0, comparableTakeCount: 0, reason: `Fallback to ${exercise.technique}: keep at least ${MIN_RELIABLE_TAKES} retained full takes with reliable timing evidence before adapting.` };
  return { technique: weakest.technique, evidenceCount: weakest.takes.reduce((sum, event) => sum + (event.timingEvidenceCount ?? 0), 0), comparableTakeCount: weakest.takes.length, reason: `${weakest.technique} is the lowest mean reliable timing score across retained full takes.` };
}

/** Reconcile all transport entry points with the same session lifecycle. */
export function syncQuickSessionWithPlayer(session: QuickSession | null, player: QuickPlayerState): QuickSession | null {
  if (!session) return null;
  const stage = session.stages[session.index];
  const playing = player.status === "countin" || player.status === "running";
  const matches = player.exerciseId === stage.exerciseId && player.bpm === stage.bpm && player.progressionId === stage.progressionId && player.seconds === 60;
  if (["running", "rest", "paused"].includes(session.phase) && !matches) return null;
  const betweenStages = session.phase === "rest" || (session.phase === "paused" && session.pausedFrom === "rest");
  if (betweenStages && (player.startRequested || playing)) return null;
  if (matches && playing && (session.phase === "preparing" || (session.phase === "paused" && session.pausedFrom !== "rest"))) return { ...session, phase: "running", pausedFrom: undefined };
  if (session.phase === "running" && player.status === "complete") return { ...session, phase: session.index === 2 ? "complete" : "rest", restRemaining: 5 };
  if (session.phase === "running" && player.status === "paused") return { ...session, phase: "paused", pausedFrom: "stage" };
  if (session.phase === "running" && player.status === "idle") return null;
  return session;
}

export function quickPracticePlan(exercise: RightHandExercise, bpm: number, progressionId: string, events: readonly PracticeResult[]): QuickStage[] {
  const weak = quickPracticePlanEvidence(exercise, events).technique;
  const warmup = RIGHT_HAND_EXERCISES.find((item) => item.technique === weak && item.difficulty === "beginner") ?? exercise;
  const tempo = Number.isFinite(bpm) ? Math.max(40, Math.min(180, Math.round(bpm))) : exercise.bpm;
  return [
    { kind: "warmup", exerciseId: warmup.id, bpm: Math.min(60, tempo), progressionId: "off" },
    { kind: "focus", exerciseId: exercise.id, bpm: tempo, progressionId: "off" },
    { kind: "music", exerciseId: exercise.id, bpm: tempo, progressionId: progressionId === "off" ? "gcd" : progressionId }
  ];
}

export function validQuickStages(value: unknown): QuickStage[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const kinds = ["warmup", "focus", "music"];
  return value.every((stage, index) => stage && stage.kind === kinds[index] && RIGHT_HAND_EXERCISES.some((exercise) => exercise.id === stage.exerciseId) && Number.isFinite(stage.bpm) && stage.bpm >= 40 && stage.bpm <= 180 && ["off", "gcd", "pop-g", "pop-c", "blues-a", "custom"].includes(stage.progressionId))
    ? value.map((stage) => ({ kind: stage.kind, exerciseId: stage.exerciseId, bpm: Math.round(stage.bpm), progressionId: stage.progressionId })) : null;
}
