import { RIGHT_HAND_EXERCISES, type RightHandExercise, type RightHandTechnique } from "./rightHandExercises";

export type ExerciseProgress = {
  bestBpm: number; sessions: number; cleanSessions: number; totalSeconds: number; lastPracticed: string;
  cleanStreak?: number; bestTimingScore?: number; recentMisses?: number[]; goalTargetBpm?: number;
  goalRequiredRounds?: number; goalRoundsAtTarget?: number; goalTimingScore?: number; goalPracticeMinutes?: number; ladderStage?: number;
};

const PRACTICE_STORAGE_KEY = "chord-hero:practice-platform:v1";
export const DEFAULT_RIGHT_HAND_MODE_SETTINGS = { targetSound: "clean-electric", demoSpeed: 1, noLook: false, clickMix: 80, guitarMix: 75, contextMix: 45, performanceMode: false, focus: "rhythm", dynamics: "even", ghostStrum: false, anticipation: "adaptive" } as const;

export function readPracticeAudioPreferences() {
  try {
    const state = JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "null");
    const volume = state?.accessibility?.audioVolume;
    return { audioMuted: Boolean(state?.accessibility?.audioMuted), audioVolume: typeof volume === "number" && Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.8, haptics: Boolean(state?.accessibility?.haptics), reducedMotion: Boolean(state?.accessibility?.reducedMotion) };
  } catch { return { audioMuted: false, audioVolume: 0.8, haptics: false, reducedMotion: false }; }
}

export function saveRightHandPracticeResult(result: { area: "rightHand"; itemId: string; title: string; seconds: number; score?: number; misses?: number; tempo?: number; note?: string; recordingId?: string; reviewAccepted?: boolean; scoreReliability?: "reliable" | "limited" | "insufficient"; timingEvidenceCount?: number; expectedTimingCount?: number; rightHandContext?: { tempo: number; pattern: string[]; chordProgression: string[]; scoringMode: "timing" | "root" | "quality"; instrumentProfile: "acoustic" | "electric"; retained: boolean } }) {
  void import("./practicePlatform").then(({ recordPracticeResult }) => recordPracticeResult(result));
}

export function validCustomProgression(value: string) {
  return value.split(/[\s,–—-]+/).map((chord) => chord.trim()).filter(Boolean).filter((chord) => /^[A-G](?:#|b)?(?:m|maj|min|sus[24]|7|m7|maj7)?$/i.test(chord)).slice(0, 8);
}

export function describeRightHandStep(step: string, technique: RightHandTechnique) {
  const accent = step.endsWith("!"); const clean = step.replace("!", "");
  if (clean === "·" || clean === "-") return { main: "—", detail: "rest", accent, rest: true, strings: [] as number[] };
  if (clean === "X") return { main: "×", detail: "mute", accent, rest: false, strings: [1, 2, 3, 4, 5, 6] };
  if (technique === "strumming") return { main: clean === "D" ? "↓" : "↑", detail: clean === "D" ? "down" : "up", accent, rest: false, strings: [1, 2, 3, 4, 5, 6] };
  if (technique === "plectrum") {
    const match = clean.match(/^(\d)(D|U)$/); const stringNumber = Number(match?.[1] ?? 3);
    return { main: match?.[2] === "D" ? "↓" : "↑", detail: `string ${stringNumber}`, accent, rest: false, strings: [stringNumber] };
  }
  const strings = clean.match(/\d/g)?.map(Number) ?? [];
  return { main: clean.replace(/[\d+]/g, "") || clean, detail: strings.length ? `string ${strings.join(" + ")}` : "pinch", accent, rest: false, strings };
}

/** The small, intentionally conservative grammar shared by routine editing and backup validation. */
export function validRightHandPatternToken(token: string, technique: RightHandTechnique) {
  if (typeof token !== "string" || token.length > 16) return false;
  if (technique === "strumming") return /^(?:[DUX]|·|-)!?$/.test(token);
  if (technique === "plectrum") return /^(?:[1-6][DUX]|[DUX]|·|-)!?$/.test(token);
  // Fingerpicking accepts a finger group with an optional string and compact
  // pinch notation such as P6+ima or im2+3, matching the authored patterns.
  return /^(?:[Ppima]{1,3}(?:[1-6])?(?:\+(?:[Ppima]{1,3}(?:[1-6])?|[1-6]))*)!?$/.test(token) || token === "·" || token === "-";
}

export function validRightHandPattern(pattern: readonly string[], technique: RightHandTechnique) {
  return pattern.length >= 2 && pattern.length <= 32 && pattern.every((token) => validRightHandPatternToken(token, technique));
}

export type RightHandTimingSlot = { absoluteStep: number; patternIndex: number; expectedAt: number };
export type RightHandTimingDecision = { kind: "onTime" | "early" | "late" | "missed"; expectedStep: number; consumeStep: number };

/** Return the next sounding slot using an absolute step counter; rests are skipped without rewinding time. */
export function rightHandTimingSlot(pattern: readonly string[], technique: RightHandTechnique, startAt: number, stepMs: number, fromAbsoluteStep: number): RightHandTimingSlot | null {
  if (!pattern.length || !Number.isFinite(startAt) || !Number.isFinite(stepMs) || stepMs <= 0) return null;
  let absoluteStep = Math.max(0, Math.floor(fromAbsoluteStep));
  for (let guard = 0; guard < pattern.length * 2; guard += 1) {
    const patternIndex = absoluteStep % pattern.length;
    if (!describeRightHandStep(pattern[patternIndex], technique).rest) return { absoluteStep, patternIndex, expectedAt: startAt + absoluteStep * stepMs };
    absoluteStep += 1;
  }
  return null;
}

/** Leave a grace interval before the next expected slot so a just-late onset is not double-counted. */
export function rightHandTimingMissDeadline(current: RightHandTimingSlot, next: RightHandTimingSlot | null, toleranceMs: number) {
  return next ? next.expectedAt - toleranceMs : current.expectedAt + toleranceMs;
}

export function classifyRightHandOnset(now: number, current: RightHandTimingSlot, next: RightHandTimingSlot | null, stepMs: number, toleranceMs: number): RightHandTimingDecision {
  const signed = now - current.expectedAt;
  if (signed <= toleranceMs) return { kind: Math.abs(signed) <= stepMs * 0.16 ? "onTime" : signed < 0 ? "early" : "late", expectedStep: current.absoluteStep, consumeStep: current.absoluteStep + 1 };
  // A stroke beyond the nominal tolerance but before the next slot's grace
  // boundary still belongs to the current slot as a late stroke.
  if (next && now < next.expectedAt - toleranceMs) return { kind: "late", expectedStep: current.absoluteStep, consumeStep: current.absoluteStep + 1 };
  return { kind: "missed", expectedStep: current.absoluteStep, consumeStep: current.absoluteStep + 1 };
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

export function rightHandDynamicsLevel(profile: "even" | "accent-map" | "backbeat" | "crescendo", step: number, length: number, beat: number, accented: boolean) {
  if (profile === "crescendo") return .4 + .6 * (step % length) / Math.max(1, length - 1);
  if (profile === "backbeat") return beat % 4 % 2 === 1 ? 1 : .5;
  if (profile === "accent-map") return accented ? 1 : .58;
  return 1;
}
