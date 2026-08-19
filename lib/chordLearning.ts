import {
  CHORD_LIBRARY,
  type ChordLibraryItem
} from "./chords";
import {
  analyzeChordFunction,
  getNextRoles,
  getScale,
  HARMONY_NOTES,
  scoreTransition,
  type HarmonicRole,
  type HarmonyMode,
  type HarmonyNote,
  type TransitionCost
} from "./harmony";
import type { Chord } from "../components/ChordDiagram";
import type { PracticeStats } from "./studentProfile";

export type LearningSkill = "beginner" | "intermediate" | "advanced";

export type HandPreference = {
  handSpanCm: number;
  targetSkill: LearningSkill;
};

export type LearningState = {
  learningKey: HarmonyNote;
  songKey: HarmonyNote;
  songFamily: string;
  handPreference: HandPreference;
  goals: PracticeGoal[];
  composerRoles: HarmonicRole[];
};

export const DEFAULT_HAND_PREFERENCE: HandPreference = {
  handSpanCm: 19,
  targetSkill: "beginner"
};

export const DEFAULT_LEARNING_STATE: LearningState = {
  learningKey: "G",
  songKey: "G",
  songFamily: "",
  handPreference: { ...DEFAULT_HAND_PREFERENCE },
  goals: [],
  composerRoles: []
};

export type KeyCurriculumStep = {
  id: string;
  role: HarmonicRole;
  title: string;
  description: string;
  unlockAfter: string[];
  representativeIds: string[];
  practiceSeconds: number;
};

export type KeyCurriculum = {
  key: HarmonyNote;
  mode: HarmonyMode;
  title: string;
  steps: KeyCurriculumStep[];
};

export type KeyProgress = {
  completedStepIds: string[];
  currentStepId: string;
};

export type SongReference = {
  id: string;
  family: string;
  title: string;
  artist: string;
  progression: string[];
  context: string;
  attribution: string;
  simplified: string[];
};

export type PracticeGoal = {
  id: string;
  title: string;
  description: string;
  role: HarmonicRole;
  keys: HarmonyNote[];
  completedKeys: HarmonyNote[];
  streak: number;
  lastCompletedAt?: string;
  nextReviewAt?: string;
};

export type ChordGlossaryEntry = {
  quality: string;
  label: string;
  intervals: Array<{ degree: string; semitones: number; color: string }>;
  sound: string;
};

export type PersonalizedVoicing = {
  entry: ChordLibraryItem;
  score: number;
  cost: TransitionCost | null;
  reason: string;
};

export type FretboardCell = {
  stringIndex: number;
  fret: number;
  note: HarmonyNote;
  kind: "tonic" | "chord-tone" | "resolution" | "scale" | "idle";
};

const DEFAULT_ROLES: HarmonicRole[] = ["I", "ii", "V", "vi"];
const KEY_STRENGTH_THRESHOLD = 0.65;
const SONG_REFERENCES: SongReference[] = [
  {
    id: "house-of-rising-sun",
    family: "minor arpeggio",
    title: "House of the Rising Sun",
    artist: "Traditional / popularized by The Animals",
    progression: ["i", "bIII", "V", "i"],
    context: "A repeating minor arpeggio reference for hearing tonic, color, and dominant pull.",
    attribution: "Reference only; no lyrics or recording included.",
    simplified: ["i", "III", "V", "i"]
  },
  {
    id: "let-it-be",
    family: "pop cadence",
    title: "Let It Be",
    artist: "The Beatles",
    progression: ["I", "V", "vi", "IV"],
    context: "A familiar loop for practicing tonic, dominant, relative minor, and predominant motion.",
    attribution: "Song title and artist metadata only; no lyrics or recording included.",
    simplified: ["I", "V", "vi", "IV"]
  },
  {
    id: "stand-by-me",
    family: "descending bass",
    title: "Stand by Me",
    artist: "Ben E. King",
    progression: ["I", "vi", "IV", "V"],
    context: "A steady four-chord cycle that makes voice-leading and bass movement easy to hear.",
    attribution: "Song title and artist metadata only; no lyrics or recording included.",
    simplified: ["I", "vi", "IV", "V"]
  },
  {
    id: "autumn-leaves",
    family: "ii-v-i",
    title: "Autumn Leaves",
    artist: "Joseph Kosma",
    progression: ["ii", "V", "I", "vi"],
    context: "A compact ii-V-I reference for hearing predominant to dominant to tonic resolution.",
    attribution: "Composition metadata only; no lyrics or recording included.",
    simplified: ["ii", "V", "I", "vi"]
  }
];

export const CHORD_GLOSSARY: Record<string, ChordGlossaryEntry> = {
  major: { quality: "major", label: "Major", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "3", semitones: 4, color: "bright" }, { degree: "5", semitones: 7, color: "stable" }], sound: "Stable, open, and resolved." },
  minor: { quality: "minor", label: "Minor", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "b3", semitones: 3, color: "dark" }, { degree: "5", semitones: 7, color: "stable" }], sound: "The lowered third gives the chord its darker color." },
  dominant7: { quality: "dominant7", label: "Dominant 7", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "3", semitones: 4, color: "bright" }, { degree: "5", semitones: 7, color: "stable" }, { degree: "b7", semitones: 10, color: "tension" }], sound: "A strong pull toward a tonic or temporary tonic." },
  minor7: { quality: "minor7", label: "Minor 7", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "b3", semitones: 3, color: "dark" }, { degree: "5", semitones: 7, color: "stable" }, { degree: "b7", semitones: 10, color: "air" }], sound: "A softer minor color with space for motion." },
  major7: { quality: "major7", label: "Major 7", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "3", semitones: 4, color: "bright" }, { degree: "5", semitones: 7, color: "stable" }, { degree: "7", semitones: 11, color: "glow" }], sound: "A settled major chord with a close, luminous seventh." },
  sus2: { quality: "sus2", label: "Suspended 2", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "2", semitones: 2, color: "open" }, { degree: "5", semitones: 7, color: "stable" }], sound: "Open and unresolved until the second moves." },
  sus4: { quality: "sus4", label: "Suspended 4", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "4", semitones: 5, color: "tension" }, { degree: "5", semitones: 7, color: "stable" }], sound: "A suspended dominant or tonic color asking for release." },
  add9: { quality: "add9", label: "Add 9", intervals: [{ degree: "1", semitones: 0, color: "tonic" }, { degree: "3", semitones: 4, color: "bright" }, { degree: "5", semitones: 7, color: "stable" }, { degree: "9", semitones: 14, color: "air" }], sound: "A major color with a bright melodic extension." },
  diminished: { quality: "diminished", label: "Diminished", intervals: [{ degree: "1", semitones: 0, color: "tension" }, { degree: "b3", semitones: 3, color: "dark" }, { degree: "b5", semitones: 6, color: "tension" }], sound: "Compact tension that usually resolves by step." }
};

const scoreForEntry = (entry: ChordLibraryItem, preference: HandPreference) => {
  let score = 50;
  if (entry.difficultyTags.includes("beginner")) score += preference.targetSkill === "beginner" ? 22 : 6;
  if (entry.difficultyTags.includes("barre")) score += preference.targetSkill === "advanced" ? 8 : -12;
  if (entry.difficultyTags.includes("stretch")) score += preference.handSpanCm >= 20 ? 5 : -10;
  if (entry.difficultyTags.includes("fast-change friendly")) score += 8;
  if (entry.difficultyTags.includes("partial")) score += preference.targetSkill === "beginner" ? 10 : 2;
  return score;
};

export function getSongReferences(family?: string): SongReference[] {
  return SONG_REFERENCES.filter((reference) => !family || reference.family === family).slice(0, 6);
}

export function transposeProgression(progression: string[], fromKey: HarmonyNote, toKey: HarmonyNote): string[] {
  const keys: HarmonyNote[] = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const amount = (keys.indexOf(toKey) - keys.indexOf(fromKey) + 12) % 12;
  return progression.map((symbol) => symbol.replace(/^([A-G](?:#|b)?)/, (root) => keys[(keys.indexOf(root as HarmonyNote) + amount + 12) % 12] ?? root));
}

export function buildKeyCurriculum(key: HarmonyNote, mode: HarmonyMode, entries: ChordLibraryItem[] = CHORD_LIBRARY): KeyCurriculum {
  const roles = Array.from(new Set([...getFunctionRoles(mode), ...DEFAULT_ROLES])).slice(0, 8);
  const steps = roles.map((role, index) => {
    const representativeIds = entries.filter((entry) => analyzeChordFunction({ key, mode, root: entry.root, quality: entry.quality, requestedRole: role }).some((fn) => fn.available)).sort((left, right) => difficultyRank(left) - difficultyRank(right)).slice(0, 3).map((entry) => entry.id);
    return {
      id: `${key}-${mode}-${role}`,
      role,
      title: `${role} in ${key}`,
      description: index === 0 ? "Find the home chord and make it ring cleanly." : `Hear how ${role} functions before moving to the next suggested role.`,
      unlockAfter: index ? [`${key}-${mode}-${roles[index - 1]}`] : [],
      representativeIds,
      practiceSeconds: index < 2 ? 120 : 180
    };
  });
  return { key, mode, title: `Learn ${key} ${mode}`, steps };
}

function getFunctionRoles(mode: HarmonyMode): HarmonicRole[] {
  return mode === "major" ? ["I", "ii", "V", "vi", "IV", "vii°"] : ["i", "iv", "V", "VI", "VII", "ii°"];
}

function difficultyRank(entry: ChordLibraryItem) {
  if (entry.difficultyTags.includes("beginner")) return 0;
  if (entry.difficultyTags.includes("barre")) return 2;
  return entry.difficultyTags.includes("stretch") ? 3 : 1;
}

export function getKeyProgress(curriculum: KeyCurriculum, stats: PracticeStats): KeyProgress {
  const completedStepIds = curriculum.steps.filter((step) => step.representativeIds.some((id) => {
    const stat = stats[id];
    return Boolean(stat && (stat.seconds >= step.practiceSeconds || (stat.strength ?? 0) >= KEY_STRENGTH_THRESHOLD));
  })).map((step) => step.id);
  const currentStep = curriculum.steps.find((step) => !completedStepIds.includes(step.id)) ?? curriculum.steps.at(-1);
  return { completedStepIds, currentStepId: currentStep?.id ?? "" };
}

export function recommendNextCurriculumTask(curriculum: KeyCurriculum, stats: PracticeStats): KeyCurriculumStep | null {
  const progress = getKeyProgress(curriculum, stats);
  return curriculum.steps.find((step) => step.id === progress.currentStepId) ?? null;
}

export function rankPersonalizedVoicings(entries: ChordLibraryItem[], preference: HandPreference, from?: Chord): PersonalizedVoicing[] {
  return entries.map((entry) => {
    const cost = from ? scoreTransition(from, entry.chord) : null;
    const transitionBonus = cost ? Math.max(0, 20 - cost.score / 5) : 0;
    const score = Math.round(scoreForEntry(entry, preference) + transitionBonus);
    const reason = cost
      ? `${preference.handSpanCm.toFixed(1)} cm span, ${preference.targetSkill} target; ${cost.sharedFingers} shared finger${cost.sharedFingers === 1 ? "" : "s"} and ${cost.fretMovement.toFixed(1)} average fret movement.`
      : `${preference.handSpanCm.toFixed(1)} cm span and ${preference.targetSkill} target favor this ${entry.difficultyTags.join(", ") || "balanced"} shape.`;
    return { entry, score, cost, reason };
  }).sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id)).slice(0, 8);
}

export function createPracticeGoal(role: HarmonicRole, keys: HarmonyNote[], title = `Master ${role} changes`): PracticeGoal {
  return { id: `goal-${role}-${keys.join("")}`, title, description: `Complete a clean ${role} practice review in ${keys.length} keys.`, role, keys: Array.from(new Set(keys)).slice(0, 12), completedKeys: [], streak: 0 };
}

export function completePracticeGoalKey(goal: PracticeGoal, key: HarmonyNote, completedAt = new Date().toISOString()): PracticeGoal {
  if (!goal.keys.includes(key)) return goal;
  const completedKeys = Array.from(new Set([...goal.completedKeys, key]));
  const sameDay = goal.lastCompletedAt?.slice(0, 10) === completedAt.slice(0, 10);
  return { ...goal, completedKeys, streak: sameDay ? goal.streak : goal.streak + 1, lastCompletedAt: completedAt, nextReviewAt: new Date(Date.parse(completedAt) + (completedKeys.length === goal.keys.length ? 7 : 2) * 86400000).toISOString() };
}

export function normalizeHandPreference(value: unknown): HandPreference {
  const source = value && typeof value === "object" ? value as Partial<HandPreference> : {};
  const targetSkill = source.targetSkill === "advanced" || source.targetSkill === "intermediate" ? source.targetSkill : "beginner";
  return {
    handSpanCm: Math.max(14, Math.min(25, Number.isFinite(Number(source.handSpanCm)) ? Number(source.handSpanCm) : DEFAULT_HAND_PREFERENCE.handSpanCm)),
    targetSkill
  };
}

export function normalizePracticeGoals(value: unknown): PracticeGoal[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((goal): goal is Partial<PracticeGoal> & Pick<PracticeGoal, "id" | "role"> => Boolean(goal && typeof goal === "object" && typeof (goal as PracticeGoal).id === "string" && typeof (goal as PracticeGoal).role === "string"))
    .slice(0, 12)
    .map((goal) => ({
      id: goal.id.slice(0, 80),
      title: typeof goal.title === "string" ? goal.title.slice(0, 120) : "Practice goal",
      description: typeof goal.description === "string" ? goal.description.slice(0, 240) : "",
      role: goal.role,
      keys: Array.isArray(goal.keys) ? goal.keys.filter((key): key is HarmonyNote => typeof key === "string" && HARMONY_NOTES.includes(key as HarmonyNote)).slice(0, 12) : [],
      completedKeys: Array.isArray(goal.completedKeys) ? goal.completedKeys.filter((key): key is HarmonyNote => typeof key === "string" && HARMONY_NOTES.includes(key as HarmonyNote)).slice(0, 12) : [],
      streak: Number.isFinite(Number(goal.streak)) ? Math.max(0, Math.floor(Number(goal.streak))) : 0,
      lastCompletedAt: typeof goal.lastCompletedAt === "string" ? goal.lastCompletedAt : undefined,
      nextReviewAt: typeof goal.nextReviewAt === "string" ? goal.nextReviewAt : undefined
    }));
}

const STATIC_COMPOSER_ROLES: HarmonicRole[] = [
  "I", "ii", "iii", "IV", "V", "vi", "vii°", "i", "ii°", "III", "iv", "v", "VI", "VII",
  "bIII", "bVI", "bVII", "ii–V–I", "deceptive cadence"
];

export function normalizeComposerRoles(value: unknown): HarmonicRole[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((role): role is HarmonicRole => typeof role === "string" && (STATIC_COMPOSER_ROLES.includes(role as HarmonicRole) || /^V\/[A-G](?:#|b)?$/.test(role)))
    .slice(0, 12);
}

export function normalizeLearningState(value: unknown): LearningState {
  const source = value && typeof value === "object" ? value as Partial<LearningState> : {};
  const learningKey = HARMONY_NOTES.includes(source.learningKey as HarmonyNote) ? source.learningKey as HarmonyNote : DEFAULT_LEARNING_STATE.learningKey;
  const songKey = HARMONY_NOTES.includes(source.songKey as HarmonyNote) ? source.songKey as HarmonyNote : learningKey;
  return {
    learningKey,
    songKey,
    songFamily: typeof source.songFamily === "string" ? source.songFamily.slice(0, 80) : "",
    handPreference: normalizeHandPreference(source.handPreference),
    goals: normalizePracticeGoals(source.goals),
    composerRoles: normalizeComposerRoles(source.composerRoles)
  };
}

export function getComposerSuggestions(role: HarmonicRole, mode: HarmonyMode): HarmonicRole[] {
  const modeSuggestions: HarmonicRole[] = mode === "major" ? ["V/ii", "V/V"] : ["V", "bVI"];
  return Array.from(new Set<HarmonicRole>([...getNextRoles(role), ...modeSuggestions])).slice(0, 6);
}

export function makeFretboardMap(key: HarmonyNote, mode: HarmonyMode, role: HarmonicRole): FretboardCell[] {
  const scale = new Set(getScale(key, mode));
  const fn = analyzeChordFunction({ key, mode, root: key, quality: mode === "major" ? "major" : "minor", requestedRole: role }).find((candidate) => candidate.available);
  const chordTones = new Set(fn ? [fn.root] : [key]);
  const resolution = new Set([key, ...(fn?.tendencyTones ?? [])]);
  const openStrings = ["E", "A", "D", "G", "B", "E"] as HarmonyNote[];
  return openStrings.flatMap((open, stringIndex) => Array.from({ length: 13 }, (_, fret) => {
    const note = (["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as HarmonyNote[])[((["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as HarmonyNote[]).indexOf(open) + fret) % 12];
    const kind = resolution.has(note) ? "resolution" : chordTones.has(note) ? "chord-tone" : note === key ? "tonic" : scale.has(note) ? "scale" : "idle";
    return { stringIndex, fret, note, kind };
  }));
}

export function isShareableLearningPack(value: unknown): value is { schemaVersion: 1; title: string; key: HarmonyNote; mode: HarmonyMode; roles: HarmonicRole[]; chordIds: string[] } {
  if (!value || typeof value !== "object") return false;
  const pack = value as Record<string, unknown>;
  return pack.schemaVersion === 1 && typeof pack.title === "string" && typeof pack.key === "string" && (pack.mode === "major" || pack.mode === "minor") && Array.isArray(pack.roles) && Array.isArray(pack.chordIds) && pack.roles.length <= 24 && pack.chordIds.length <= 80;
}

export function serializeLearningPack(title: string, key: HarmonyNote, mode: HarmonyMode, roles: HarmonicRole[], chordIds: string[]) {
  return JSON.stringify({ schemaVersion: 1, title: title.trim().slice(0, 80) || "Chord Hero learning pack", key, mode, roles: Array.from(new Set(roles)).slice(0, 24), chordIds: Array.from(new Set(chordIds)).slice(0, 80) }, null, 2);
}
