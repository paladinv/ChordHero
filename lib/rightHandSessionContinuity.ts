import type { RightHandExercise } from "./rightHandExercises";
import { useEffect } from "react";

export const RIGHT_HAND_SESSION_KEY = "chord-hero:right-hand:session:v1";
export type RightHandSession = { version: 1; exerciseId: string; bpm: number; loop: { start: number; end: number } | null; lessonStep: number };
const bounded = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
export function validateRightHandSession(value: unknown, exercises: readonly RightHandExercise[]): RightHandSession | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<RightHandSession>;
  const exercise = exercises.find((item) => item.id === input.exerciseId);
  if (input.version !== 1 || !exercise) return null;
  const max = exercise.pattern.length - 1;
  const start = bounded(input.loop?.start, max);
  return { version: 1, exerciseId: exercise.id, bpm: typeof input.bpm === "number" && Number.isFinite(input.bpm) ? Math.max(40, Math.min(180, Math.round(input.bpm))) : exercise.bpm, loop: input.loop && typeof input.loop === "object" ? { start, end: Math.max(start, bounded(input.loop.end, max)) } : null, lessonStep: bounded(input.lessonStep, max) };
}
export function readRightHandSession(exercises: readonly RightHandExercise[]) {
  try { return validateRightHandSession(JSON.parse(localStorage.getItem(RIGHT_HAND_SESSION_KEY) ?? "null"), exercises); } catch { return null; }
}
export function writeRightHandSession(session: RightHandSession) {
  try { if (!sessionStorage.getItem("chord-hero:right-hand:restore-pending")) localStorage.setItem(RIGHT_HAND_SESSION_KEY, JSON.stringify(session)); } catch { /* Optional local continuity. */ }
}
let pendingLesson: { cancel: () => void } | null = null;
export function saveRightHandLessonStep(exercises: readonly RightHandExercise[], exerciseId: string, step: number) {
  pendingLesson?.cancel();
  const flush = () => {
    const current = readRightHandSession(exercises);
    if (current?.exerciseId === exerciseId) {
      const exercise = exercises.find((item) => item.id === exerciseId)!;
      writeRightHandSession({ ...current, lessonStep: bounded(step, exercise.pattern.length - 1) });
    }
    cancel();
  };
  const hidden = () => { if (document.visibilityState === "hidden") flush(); };
  const timer = window.setTimeout(flush, 180);
  const cancel = () => { clearTimeout(timer); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", hidden); pendingLesson = null; };
  pendingLesson = { cancel };
  window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", hidden);
}
export function useRightHandSessionContinuity(exercise: RightHandExercise, bpm: number, loop: RightHandSession["loop"], hydrated: boolean) {
  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      const saved = readRightHandSession([exercise]);
      writeRightHandSession({ version: 1, exerciseId: exercise.id, bpm, loop, lessonStep: saved?.lessonStep ?? 0 });
    };
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    const timer = window.setTimeout(flush, 180);
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", hidden);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", hidden); };
  }, [exercise, bpm, loop, hydrated]);
}
