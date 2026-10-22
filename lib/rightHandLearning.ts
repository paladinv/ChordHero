import { RIGHT_HAND_EXERCISES, type RightHandExercise } from "./rightHandExercises";
import type { PracticeResult } from "./practicePlatform";

export function rightHandReviewQueue(events: PracticeResult[], now = Date.now()) {
  return RIGHT_HAND_EXERCISES.flatMap((exercise) => {
    const evidence = events.filter((event) => event.area === "rightHand" && event.itemId === exercise.id && event.recordingId && event.reviewAccepted !== false && Number.isFinite(event.score) && Number.isFinite(Date.parse(event.practisedAt))).sort((a, b) => Date.parse(a.practisedAt) - Date.parse(b.practisedAt));
    const latest = evidence.at(-1);
    if (!latest) return [];
    const successfulDays = new Set(evidence.filter((event) => (event.score ?? 0) >= 80).map((event) => event.practisedAt.slice(0, 10))).size;
    const intervalDays = (latest.score ?? 0) < 80 ? 1 : [1, 3, 7, 14][Math.min(3, Math.max(0, successfulDays - 1))];
    const dueAt = Date.parse(latest.practisedAt) + intervalDays * 86400000;
    return [{ exercise, latest, intervalDays, dueAt, due: dueAt <= now }];
  }).sort((a, b) => a.dueAt - b.dueAt);
}

export const RIGHT_HAND_AUDIO_BUNDLE = [
  { path: "/audio/percussion/hi-hat-close.wav", bytes: 19684 },
  { path: "/samples/guitar/muted.mp3", bytes: 5060 },
  ...[40, 42, 45, 48, 54, 60, 63].map((midi) => ({ path: `/samples/guitar/clean/${midi}.mp3`, bytes: 36720 }))
];
export const RIGHT_HAND_BUNDLE_CACHE = "right-hand-bundle-v1";
export const RIGHT_HAND_LIBRARY_PATH = "/offline/right-hand-exercises-v1.json";
export const rightHandLibraryJson = () => JSON.stringify({ schema: 1, exercises: RIGHT_HAND_EXERCISES });

export function memoryCallPattern(exercise: RightHandExercise) {
  const perBeat = exercise.subdivision === "Quarter notes" ? 1 : exercise.subdivision === "Eighth notes" ? 2 : exercise.subdivision === "Triplets" ? 3 : 4;
  return Array.from({ length: perBeat * 4 }, (_, index) => exercise.pattern[index % exercise.pattern.length]);
}

export function phrasingBars(length: 4 | 8, progression: readonly string[] = []) {
  const selected = progression.filter((chord) => typeof chord === "string" && /^[A-G](?:#|b)?(?:m|maj|min|sus[24]|7|m7|maj7)?$/i.test(chord)).slice(0, 8);
  const chords = selected.length ? selected : ["G", "C", "Em", "D"];
  return Array.from({ length }, (_, index) => ({
    chord: chords[index % chords.length],
    tokens: index === length - 1 ? ["D!", "·", "·", "·", "·", "·", "·", "·"] : index % 2 ? ["D!", "·", "D", "U", "·", "·", "·", "·"] : ["D!", "·", "D", "U", "·", "U", "D", "·"]
  }));
}
