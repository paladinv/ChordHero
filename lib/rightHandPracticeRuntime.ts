import { RIGHT_HAND_EXERCISES, type RightHandExercise, type RightHandTechnique } from "./rightHandExercises";

export type ExerciseProgress = {
  bestBpm: number; sessions: number; cleanSessions: number; totalSeconds: number; lastPracticed: string;
  cleanStreak?: number; bestTimingScore?: number; recentMisses?: number[]; goalTargetBpm?: number;
  goalRequiredRounds?: number; goalRoundsAtTarget?: number; goalTimingScore?: number; goalPracticeMinutes?: number; ladderStage?: number;
};

const PRACTICE_STORAGE_KEY = "chord-hero:practice-platform:v1";
export const DEFAULT_RIGHT_HAND_MODE_SETTINGS = { targetSound: "clean-electric", demoSpeed: 1, noLook: false, clickMix: 80, guitarMix: 75, contextMix: 45, performanceMode: false } as const;

export function readPracticeAudioPreferences() {
  try {
    const state = JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "null");
    return { audioMuted: Boolean(state?.accessibility?.audioMuted), audioVolume: Number(state?.accessibility?.audioVolume) || 0.8, haptics: Boolean(state?.accessibility?.haptics), reducedMotion: Boolean(state?.accessibility?.reducedMotion) };
  } catch { return { audioMuted: false, audioVolume: 0.8, haptics: false, reducedMotion: false }; }
}

export function saveRightHandPracticeResult(result: { area: "rightHand"; itemId: string; title: string; seconds: number; score?: number; misses?: number; tempo?: number; note?: string }) {
  void import("./practicePlatform").then(({ recordPracticeResult }) => recordPracticeResult(result));
}

export function validCustomProgression(value: string) {
  return value.split(/[\s,–—-]+/).map((chord) => chord.trim()).filter(Boolean).filter((chord) => /^[A-G](?:#|b)?(?:m|maj|min|sus[24]|7|m7|maj7)?$/i.test(chord)).slice(0, 8);
}

export function describeRightHandStep(step: string, technique: RightHandTechnique) {
  const accent = step.endsWith("!"); const clean = step.replace("!", "");
  if (clean === "·") return { main: "—", detail: "rest", accent, rest: true, strings: [] as number[] };
  if (clean === "X") return { main: "×", detail: "mute", accent, rest: false, strings: [1, 2, 3, 4, 5, 6] };
  if (technique === "strumming") return { main: clean === "D" ? "↓" : "↑", detail: clean === "D" ? "down" : "up", accent, rest: false, strings: [1, 2, 3, 4, 5, 6] };
  if (technique === "plectrum") {
    const match = clean.match(/^(\d)(D|U)$/); const stringNumber = Number(match?.[1] ?? 3);
    return { main: match?.[2] === "D" ? "↓" : "↑", detail: `string ${stringNumber}`, accent, rest: false, strings: [stringNumber] };
  }
  const strings = clean.match(/\d/g)?.map(Number) ?? [];
  return { main: clean.replace(/[\d+]/g, "") || clean, detail: strings.length ? `string ${strings.join(" + ")}` : "pinch", accent, rest: false, strings };
}

export function rightHandCountLabel(index: number, subdivision: RightHandExercise["subdivision"]) {
  if (subdivision === "Quarter notes") return String((index % 4) + 1);
  if (subdivision === "Eighth notes") return index % 2 === 0 ? String((index / 2) % 4 + 1) : "&";
  if (subdivision === "Triplets") return [String(Math.floor(index / 3) % 4 + 1), "trip", "let"][index % 3];
  return [String(Math.floor(index / 4) % 4 + 1), "e", "&", "a"][index % 4];
}

export function rightHandSubdivisionsPerBeat(subdivision: RightHandExercise["subdivision"]) {
  return subdivision === "Quarter notes" ? 1 : subdivision === "Eighth notes" ? 2 : subdivision === "Triplets" ? 3 : 4;
}

export function formatPracticeTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`; }
export function rightHandExerciseById(id: string | null) { return RIGHT_HAND_EXERCISES.find((exercise) => exercise.id === id); }
export function rememberedRightHandTempo(exercise: RightHandExercise, progressBpm = 0) {
  if (typeof window === "undefined") return progressBpm || exercise.bpm;
  const stored = Number(localStorage.getItem(`chord-hero:right-hand:tempo:${exercise.id}`));
  return Number.isFinite(stored) && stored >= 40 && stored <= 180 ? stored : progressBpm || exercise.bpm;
}

export function shouldPlayStyleBacking(style: string, beat: number, subdivision: number, perBeat: number) {
  const beatInBar = beat % 4;
  if (style === "reggae") return subdivision === 0 && (beatInBar === 1 || beatInBar === 3);
  if (style === "funk") return perBeat > 1 ? subdivision === perBeat - 1 && (beatInBar === 0 || beatInBar === 2) : beatInBar % 2 === 0;
  if (style === "bossa") return subdivision === 0 && (beatInBar === 0 || beatInBar === 2 || beatInBar === 3);
  if (style === "bluegrass") return subdivision === 0 && beatInBar % 2 === 0;
  if (style === "travis") return subdivision === 0;
  return subdivision === 0;
}
