import { CHORD_LIBRARY, type ChordLibraryItem } from "./chords";
import { HARMONY_NOTES, getScale, scoreTransition, type HarmonyNote, type TransitionCost } from "./harmony";
import type { PracticeStats, TeacherAssignment } from "./studentProfile";
import type { Chord } from "../components/ChordDiagram";
import type { RecordingAnalysis } from "./songRecordingAnalysis";

export type VocalRange = {
  lowMidi: number;
  highMidi: number;
};

export type EnharmonicPreference = "sharp" | "flat" | "auto";

export type CapoRecommendation = {
  capo: number;
  shapeKey: HarmonyNote;
  soundingKey: HarmonyNote;
  shapeCount: number;
  beginnerShapeCount: number;
  score: number;
  explanation: string;
};

export type GenrePracticePath = {
  id: "folk" | "pop" | "blues" | "jazz" | "worship";
  label: string;
  focus: string;
  roles: string[];
  bpm: number;
  countIn: number;
  steps: string[];
};

export type FingerMove = {
  finger: number;
  fromString: number | null;
  toString: number | null;
  fromFret: number | null;
  toFret: number | null;
  kind: "shared" | "slide" | "lift" | "place" | "replace";
};

export type FingerTransitionInspection = {
  cost: TransitionCost;
  sharedFingerCount: number;
  fingerMoves: FingerMove[];
  unchangedStrings: number[];
  summary: string;
};

export type LocalRecordingDescriptor = {
  id: string;
  label: string;
  sizeBytes: number;
  durationMs: number;
  analysis: RecordingAnalysis;
};

export type RecordingComparison = {
  timingDelta: number;
  attackDelta: number;
  consistencyDelta: number;
  studentScore: number;
  teacherScore: number;
  summary: string;
};

export type TeacherReferenceComparisonAdapter = {
  saveReference: (reference: LocalRecordingDescriptor) => void;
  getReference: () => LocalRecordingDescriptor | null;
  compare: (student: LocalRecordingDescriptor, reference: LocalRecordingDescriptor) => RecordingComparison;
};

export type SessionPlanItem = {
  id: string;
  kind: "warmup" | "transition" | "target" | "review";
  title: string;
  detail: string;
  chordIds: string[];
  minutes: number;
};

export type SessionPlan = {
  title: string;
  totalMinutes: number;
  items: SessionPlanItem[];
};

export type RhythmRecommendation = {
  recommendedBpm: number;
  nextBpm: number;
  countInBeats: number;
  cleanRepsNeeded: number;
  canAdvance: boolean;
  explanation: string;
};

export type AchievementFamily = "open chords" | "barre chords" | "inversions" | "jazz colors";

export type AchievementMapItem = {
  family: AchievementFamily;
  completed: number;
  total: number;
  percent: number;
  nextChordId: string | null;
  detail: string;
};

export type OfflinePackSelection = {
  keyIds: string[];
  tuningIds: string[];
  sampleVoices: string[];
};

export type OfflineLibraryStatus = {
  selected: OfflinePackSelection;
  availableChordCount: number;
  estimatedAssetCount: number;
  estimatedBytes: number;
  storageLabel: string;
  description: string;
};

export type TeacherAnalytics = {
  assignmentCount: number;
  completedAssignments: number;
  completionPercent: number;
  practiceMinutes: number;
  repetitions: number;
  weakChordIds: string[];
  familyMinutes: Record<string, number>;
  commonMistakeStrings: Array<{ stringIndex: number; count: number }>;
};

export type PracticeToday = {
  dueReview: ChordLibraryItem | null;
  weakTransition: ChordLibraryItem | null;
  song: { title: string; progression: string; detail: string };
  minutes: number;
  summary: string;
};

export type ChordFamilyTimelineItem = {
  family: AchievementFamily;
  label: string;
  description: string;
  unlocked: boolean;
  completed: number;
  total: number;
};

export type FretboardFinderCell = {
  stringIndex: number;
  fret: number;
  note: HarmonyNote;
  degree: "root" | "3rd" | "5th" | "7th" | "scale" | "other";
};

export type SetlistItem = {
  id: string;
  title: string;
  key: HarmonyNote;
  capo: number;
  chordPack: string;
};

export type SetlistPreparation = {
  items: SetlistItem[];
  next: SetlistItem | null;
  summary: string;
};

export type InstrumentPreset = {
  id: "steel-6" | "classical-6" | "twelve-string";
  label: string;
  stringCount: number;
  scaleLengthInches: number;
  tuning: string;
  stringGauge: "light" | "medium" | "nylon" | "custom";
  coaching: string;
};

export type TeacherRubricTemplate = {
  id: string;
  label: string;
  criteria: Array<{ id: string; label: string; prompt: string }>;
};

export type ProgressSnapshot = {
  generatedAt: string;
  practicedChordCount: number;
  strongestFamily: string;
  weakestFamily: string;
  strongestKey: string;
  dueCount: number;
  nextGoal: string;
  summary: string;
};

const SHARP_NOTES = [...HARMONY_NOTES];
const FLAT_NOTES: HarmonyNote[] = ["C", "Db" as HarmonyNote, "D", "Eb", "E", "F", "Gb" as HarmonyNote, "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = new Map(SHARP_NOTES.map((note, index) => [note, index]));
const TONIC_MIDI = new Map<HarmonyNote, number>([
  ["C", 60], ["C#", 61], ["D", 62], ["Eb", 63], ["E", 64], ["F", 65],
  ["F#", 66], ["G", 67], ["Ab", 68], ["A", 69], ["Bb", 70], ["B", 71]
]);

export const GENRE_PRACTICE_PATHS: GenrePracticePath[] = [
  { id: "folk", label: "Folk", focus: "Open-string resonance and steady alternating bass.", roles: ["I", "IV", "V", "vi"], bpm: 78, countIn: 4, steps: ["Ring open shapes cleanly", "Add alternating bass", "Practice I-IV-V without stopping"] },
  { id: "pop", label: "Pop", focus: "Fast, repeatable changes with a consistent backbeat.", roles: ["I", "V", "vi", "IV"], bpm: 96, countIn: 4, steps: ["Lock the downbeat", "Reduce finger travel", "Loop the four-chord cycle"] },
  { id: "blues", label: "Blues", focus: "Dominant color, shuffle pulse, and I-IV-V movement.", roles: ["I", "IV", "V"], bpm: 84, countIn: 4, steps: ["Play dominant seventh shapes", "Add a shuffle accent", "Transpose a 12-bar loop"] },
  { id: "jazz", label: "Jazz", focus: "Compact sevenths, guide tones, and ii-V-I resolution.", roles: ["ii", "V", "I", "vi"], bpm: 66, countIn: 4, steps: ["Voice the guide tones", "Connect ii to V", "Resolve V to I softly"] },
  { id: "worship", label: "Worship", focus: "Wide open voicings, dynamics, and supportive transitions.", roles: ["I", "V", "vi", "IV"], bpm: 72, countIn: 4, steps: ["Choose ringing shapes", "Practice dynamic swells", "Move through the progression without gaps"] }
];

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function normalizeNote(note: string): HarmonyNote {
  const aliases: Record<string, HarmonyNote> = { Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" };
  return aliases[note] ?? (HARMONY_NOTES.includes(note as HarmonyNote) ? note as HarmonyNote : "C");
}

function noteAt(index: number, preference: EnharmonicPreference = "auto"): HarmonyNote {
  const sharp = SHARP_NOTES[((index % 12) + 12) % 12];
  if (preference === "sharp" || preference === "auto") return sharp;
  return (FLAT_NOTES[((index % 12) + 12) % 12] ?? sharp) as HarmonyNote;
}

export function formatPlannerNote(note: string, preference: EnharmonicPreference): string {
  const index = NOTE_INDEX.get(normalizeNote(note)) ?? 0;
  return noteAt(index, preference);
}

export function getGenrePracticePath(id: GenrePracticePath["id"]): GenrePracticePath {
  return GENRE_PRACTICE_PATHS.find((path) => path.id === id) ?? GENRE_PRACTICE_PATHS[0];
}

export function recommendCapoPositions(
  songKey: HarmonyNote,
  vocalRange: VocalRange,
  entries: ChordLibraryItem[] = CHORD_LIBRARY,
  maxResults = 5
): CapoRecommendation[] {
  const normalizedKey = normalizeNote(songKey);
  const soundingMidi = TONIC_MIDI.get(normalizedKey) ?? 60;
  const rangeCenter = (vocalRange.lowMidi + vocalRange.highMidi) / 2;
  return Array.from({ length: 8 }, (_, capo) => {
    const shapeKey = noteAt((NOTE_INDEX.get(normalizedKey) ?? 0) - capo);
    const matching = entries.filter((entry) => entry.root === shapeKey || entry.functionContexts.some((context) => context.key === shapeKey));
    const beginnerShapeCount = matching.filter((entry) => entry.difficultyTags.includes("beginner") || entry.difficultyTags.includes("fast-change friendly")).length;
    const rangeDistance = Math.abs(soundingMidi - rangeCenter);
    const score = clamp(Math.round(beginnerShapeCount * 4 + Math.max(0, 24 - capo * 2) - rangeDistance * 0.8), 0, 100);
    return {
      capo,
      shapeKey,
      soundingKey: normalizedKey,
      shapeCount: matching.length,
      beginnerShapeCount,
      score,
      explanation: capo === 0
        ? `Stay in ${shapeKey} shapes; no capo keeps the selected sounding key unchanged.`
        : `Capo ${capo} keeps ${normalizedKey} sounding while opening up ${shapeKey}-family shapes.`
    };
  }).sort((left, right) => right.score - left.score || left.capo - right.capo).slice(0, maxResults);
}

function fingerPositions(chord: Chord, finger: number) {
  return chord.frets.flatMap((fret, stringIndex) => chord.fingers?.[stringIndex] === finger && fret >= 0 ? [{ stringIndex, fret }] : []);
}

export function inspectFingerTransition(from: ChordLibraryItem | Chord, to: ChordLibraryItem | Chord): FingerTransitionInspection {
  const source = "chord" in from ? from.chord : from;
  const target = "chord" in to ? to.chord : to;
  const cost = scoreTransition(source, target);
  const fingerMoves: FingerMove[] = [];
  const unchangedStrings: number[] = [];
  for (let stringIndex = 0; stringIndex < Math.max(source.frets.length, target.frets.length); stringIndex += 1) {
    const fromFret = source.frets[stringIndex] ?? -1;
    const toFret = target.frets[stringIndex] ?? -1;
    const fromFinger = source.fingers?.[stringIndex] ?? null;
    const toFinger = target.fingers?.[stringIndex] ?? null;
    if (fromFret === toFret && fromFinger === toFinger && fromFret >= 0) unchangedStrings.push(stringIndex + 1);
  }
  for (let finger = 1; finger <= 4; finger += 1) {
    const start = fingerPositions(source, finger)[0] ?? null;
    const end = fingerPositions(target, finger)[0] ?? null;
    if (start && end) {
      const kind = start.stringIndex === end.stringIndex && start.fret === end.fret ? "shared" : start.stringIndex === end.stringIndex ? "slide" : "replace";
      fingerMoves.push({ finger, fromString: start.stringIndex + 1, toString: end.stringIndex + 1, fromFret: start.fret, toFret: end.fret, kind });
    } else if (start) fingerMoves.push({ finger, fromString: start.stringIndex + 1, toString: null, fromFret: start.fret, toFret: null, kind: "lift" });
    else if (end) fingerMoves.push({ finger, fromString: null, toString: end.stringIndex + 1, fromFret: null, toFret: end.fret, kind: "place" });
  }
  const sharedFingerCount = fingerMoves.filter((move) => move.kind === "shared").length;
  const summary = `${sharedFingerCount} shared finger${sharedFingerCount === 1 ? "" : "s"}; ${cost.fretMovement} fret movement; ${cost.stringChanges} string change${cost.stringChanges === 1 ? "" : "s"}. ${cost.explanation}`;
  return { cost, sharedFingerCount, fingerMoves, unchangedStrings, summary };
}

export function compareLocalRecordings(student: LocalRecordingDescriptor, reference: LocalRecordingDescriptor): RecordingComparison {
  const studentScore = Math.round((student.analysis.timingScore + student.analysis.chordAttackScore + (student.analysis.chordAccuracyScore ?? student.analysis.timingConsistencyPercent)) / 3);
  const teacherScore = Math.round((reference.analysis.timingScore + reference.analysis.chordAttackScore + (reference.analysis.chordAccuracyScore ?? reference.analysis.timingConsistencyPercent)) / 3);
  const timingDelta = student.analysis.timingScore - reference.analysis.timingScore;
  const attackDelta = student.analysis.chordAttackScore - reference.analysis.chordAttackScore;
  const consistencyDelta = student.analysis.timingConsistencyPercent - reference.analysis.timingConsistencyPercent;
  const direction = studentScore >= teacherScore ? "at or above" : "below";
  return { timingDelta, attackDelta, consistencyDelta, studentScore, teacherScore, summary: `Your local take scored ${studentScore}, ${direction} the teacher reference at ${teacherScore}. Timing ${timingDelta >= 0 ? "+" : ""}${timingDelta}; attack ${attackDelta >= 0 ? "+" : ""}${attackDelta}.` };
}

export function createLocalTeacherReferenceAdapter(): TeacherReferenceComparisonAdapter {
  let reference: LocalRecordingDescriptor | null = null;
  return { saveReference: (next) => { reference = next; }, getReference: () => reference, compare: (student, teacher) => compareLocalRecordings(student, teacher) };
}

export function buildSessionPlan(
  entries: ChordLibraryItem[],
  practiceStats: PracticeStats,
  assignments: TeacherAssignment[],
  genre: GenrePracticePath["id"],
  targetMinutes = 20
): SessionPlan {
  const path = getGenrePracticePath(genre);
  const weak = entries.filter((entry) => (practiceStats[entry.id]?.strength ?? 0) < 3 || (practiceStats[entry.id]?.misses ?? 0) > 1).sort((left, right) => (practiceStats[left.id]?.strength ?? 0) - (practiceStats[right.id]?.strength ?? 0)).slice(0, 2);
  const assigned = assignments.flatMap((assignment) => assignment.chordIds).map((id) => entries.find((entry) => entry.id === id)).filter((entry): entry is ChordLibraryItem => Boolean(entry)).slice(0, 3);
  const target = assigned[0] ?? entries.find((entry) => entry.difficultyTags.includes("fast-change friendly")) ?? entries[0];
  const items: SessionPlanItem[] = [
    { id: `warmup-${path.id}`, kind: "warmup", title: `${path.label} warmup`, detail: path.steps[0], chordIds: entries.filter((entry) => entry.difficultyTags.includes("beginner")).slice(0, 2).map((entry) => entry.id), minutes: 4 },
    ...weak.map((entry) => ({ id: `transition-${entry.id}`, kind: "transition" as const, title: `Repair ${entry.chord.name}`, detail: entry.practiceFocus, chordIds: [entry.id], minutes: 4 })),
    ...(target ? [{ id: `target-${target.id}`, kind: "target" as const, title: `${path.label} target`, detail: `${path.roles.join(" - ")} at a relaxed ${path.bpm} BPM.`, chordIds: [target.id], minutes: 7 }] : []),
    ...(assigned.length ? [{ id: "assignment-review", kind: "review" as const, title: "Teacher assignment review", detail: `${assigned.length} assigned voicing${assigned.length === 1 ? "" : "s"} ready for a final pass.`, chordIds: assigned.map((entry) => entry.id), minutes: 5 }] : [])
  ];
  const capped = items.slice(0, 6);
  const total = capped.reduce((sum, item) => sum + item.minutes, 0);
  if (total > targetMinutes) capped[capped.length - 1].minutes = Math.max(1, capped[capped.length - 1].minutes - (total - targetMinutes));
  return { title: `${path.label} practice session`, totalMinutes: capped.reduce((sum, item) => sum + item.minutes, 0), items: capped };
}

export function recommendAdaptiveRhythm(bpm: number, cleanReps: number, timingScore: number, path: GenrePracticePath): RhythmRecommendation {
  const safeBpm = clamp(Math.round(bpm), 40, 180);
  const canAdvance = cleanReps >= 3 && timingScore >= 88;
  const nextBpm = canAdvance ? Math.min(180, safeBpm + (timingScore >= 95 ? 8 : 4)) : Math.max(40, safeBpm - (timingScore < 65 ? 4 : 0));
  return { recommendedBpm: safeBpm, nextBpm, countInBeats: path.countIn, cleanRepsNeeded: Math.max(0, 3 - cleanReps), canAdvance, explanation: canAdvance ? `Advance after ${cleanReps} clean repetitions; count in ${path.countIn} beats before the next take.` : `Hold at ${safeBpm} BPM for ${Math.max(0, 3 - cleanReps)} more clean repetition${3 - cleanReps === 1 ? "" : "s"}.` };
}

function familyFor(entry: ChordLibraryItem): AchievementFamily {
  if (entry.inversion === "inverted") return "inversions";
  if (entry.difficultyTags.includes("barre")) return "barre chords";
  if (["major7", "minor7", "dominant7", "sus2", "sus4", "add9"].includes(entry.quality)) return "jazz colors";
  return "open chords";
}

export function buildAchievementMap(entries: ChordLibraryItem[], practiceStats: PracticeStats): AchievementMapItem[] {
  return (["open chords", "barre chords", "inversions", "jazz colors"] as AchievementFamily[]).map((family) => {
    const familyEntries = entries.filter((entry) => familyFor(entry) === family);
    const completed = familyEntries.filter((entry) => (practiceStats[entry.id]?.reps ?? 0) >= 3).length;
    const next = familyEntries.find((entry) => (practiceStats[entry.id]?.reps ?? 0) < 3) ?? null;
    return { family, completed, total: familyEntries.length, percent: familyEntries.length ? Math.round(completed / familyEntries.length * 100) : 0, nextChordId: next?.id ?? null, detail: next ? `Next: ${next.chord.name} · ${next.position}` : "Family complete for this library set." };
  });
}

export function getOfflineLibraryStatus(selection: OfflinePackSelection, entries: ChordLibraryItem[] = CHORD_LIBRARY, bytesPerSample = 850_000): OfflineLibraryStatus {
  const keyIds = Array.from(new Set(selection.keyIds)).slice(0, 12);
  const tuningIds = Array.from(new Set(selection.tuningIds)).slice(0, 8);
  const sampleVoices = Array.from(new Set(selection.sampleVoices)).slice(0, 4);
  const availableChordCount = keyIds.length ? entries.filter((entry) => entry.functionContexts.some((context) => keyIds.includes(context.key))).length : 0;
  const estimatedAssetCount = availableChordCount * Math.max(1, sampleVoices.length) * Math.max(1, tuningIds.length);
  const estimatedBytes = estimatedAssetCount * bytesPerSample;
  const storageLabel = estimatedBytes > 1024 * 1024 ? `${(estimatedBytes / 1024 / 1024).toFixed(1)} MB estimated` : `${Math.round(estimatedBytes / 1024)} KB estimated`;
  return { selected: { keyIds, tuningIds, sampleVoices }, availableChordCount, estimatedAssetCount, estimatedBytes, storageLabel, description: availableChordCount ? `${availableChordCount} playable shapes are eligible for local caching. Audio is selected on demand; no files are uploaded.` : "Choose at least one key to prepare a bounded offline pack." };
}

export function buildTeacherAnalytics(entries: ChordLibraryItem[], stats: PracticeStats, assignments: TeacherAssignment[], mistakes: Record<string, number[]>): TeacherAnalytics {
  const familyMinutes: Record<string, number> = {};
  let practiceMinutes = 0;
  let repetitions = 0;
  Object.entries(stats).forEach(([id, stat]) => {
    const entry = entries.find((candidate) => candidate.id === id);
    const minutes = Math.round((stat.seconds ?? 0) / 60);
    practiceMinutes += minutes;
    repetitions += stat.reps ?? 0;
    if (entry) familyMinutes[familyFor(entry)] = (familyMinutes[familyFor(entry)] ?? 0) + minutes;
  });
  const stringCounts = new Map<number, number>();
  Object.values(mistakes).forEach((strings) => strings.forEach((stringIndex) => stringCounts.set(stringIndex, (stringCounts.get(stringIndex) ?? 0) + 1)));
  const commonMistakeStrings = [...stringCounts.entries()].sort((left, right) => right[1] - left[1]).map(([stringIndex, count]) => ({ stringIndex, count })).slice(0, 6);
  const weakChordIds = entries.filter((entry) => (stats[entry.id]?.strength ?? 0) < 3 || (stats[entry.id]?.misses ?? 0) > 1).sort((left, right) => (stats[left.id]?.strength ?? 0) - (stats[right.id]?.strength ?? 0)).slice(0, 8).map((entry) => entry.id);
  const completedAssignments = assignments.filter((assignment) => Boolean(assignment.completedAt)).length;
  return { assignmentCount: assignments.length, completedAssignments, completionPercent: assignments.length ? Math.round(completedAssignments / assignments.length * 100) : 0, practiceMinutes, repetitions, weakChordIds, familyMinutes, commonMistakeStrings };
}

export function buildPracticeToday(entries: ChordLibraryItem[], stats: PracticeStats, genre: GenrePracticePath["id"]): PracticeToday {
  const now = Date.now();
  const dueReview = entries.find((entry) => {
    const nextReviewAt = stats[entry.id]?.nextReviewAt;
    return Boolean(nextReviewAt && Date.parse(nextReviewAt) <= now);
  }) ?? null;
  const weakTransition = [...entries]
    .filter((entry) => entry.id !== dueReview?.id)
    .sort((left, right) => {
      const leftStat = stats[left.id] ?? { seconds: 0, reps: 0, strength: 0 };
      const rightStat = stats[right.id] ?? { seconds: 0, reps: 0, strength: 0 };
      return (leftStat.strength ?? 0) - (rightStat.strength ?? 0) || (rightStat.misses ?? 0) - (leftStat.misses ?? 0);
    })[0] ?? null;
  const path = getGenrePracticePath(genre);
  const songs = genre === "jazz"
    ? { title: "Autumn Leaves", progression: "ii - V - I - vi", detail: "Hear guide-tone motion in a compact cadence." }
    : genre === "blues"
      ? { title: "12-bar blues", progression: "I - IV - V", detail: "Keep the shuffle steady while the bass moves." }
      : { title: path.label === "Folk" ? "Amazing Grace" : "Four-chord loop", progression: path.roles.slice(0, 4).join(" - "), detail: `${path.label} context at ${path.bpm} BPM.` };
  const pieces = [dueReview ? "due review" : "fresh review", weakTransition ? "weak transition" : "song context", songs.title];
  return {
    dueReview,
    weakTransition,
    song: songs,
    minutes: dueReview && weakTransition ? 12 : 8,
    summary: `Today: ${pieces.join(", ")}.`
  };
}

export function buildChordFamilyTimeline(entries: ChordLibraryItem[], stats: PracticeStats): ChordFamilyTimelineItem[] {
  const stages: Array<{ family: AchievementFamily; label: string; description: string }> = [
    { family: "open chords", label: "Open shapes", description: "Ring cleanly, mute unused strings, and learn the common I-IV-V changes." },
    { family: "barre chords", label: "Barre shapes", description: "Add movable E- and A-shapes after open-position changes feel automatic." },
    { family: "inversions", label: "Inversions", description: "Use bass movement and shared notes to connect the same harmonic identity." },
    { family: "jazz colors", label: "Jazz colors", description: "Add sevenths, suspensions, and extensions once the shell tones are reliable." }
  ];
  let previousComplete = true;
  return stages.map((stage) => {
    const familyEntries = entries.filter((entry) => familyFor(entry) === stage.family);
    const completed = familyEntries.filter((entry) => (stats[entry.id]?.reps ?? 0) >= 3).length;
    const unlocked = previousComplete || completed > 0;
    previousComplete = familyEntries.length > 0 && completed >= Math.max(1, Math.ceil(familyEntries.length * 0.35));
    return { ...stage, unlocked, completed, total: familyEntries.length };
  });
}

const QUALITY_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
  minor7: [0, 3, 7, 10],
  major7: [0, 4, 7, 11],
  diminished: [0, 3, 6]
};

function normalizedPitch(note: string): number {
  const aliases: Record<string, string> = { Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" };
  return NOTE_INDEX.get((aliases[note] ?? note) as HarmonyNote) ?? 0;
}

export function findFretboardNotes(key: HarmonyNote, quality: string, maxFret = 12): FretboardFinderCell[] {
  const safeMaxFret = clamp(Math.floor(maxFret), 0, 24);
  const rootPitch = normalizedPitch(key);
  const intervals = QUALITY_INTERVALS[quality] ?? QUALITY_INTERVALS.major;
  const degreeByInterval = new Map<number, FretboardFinderCell["degree"]>([[intervals[0] ?? 0, "root"], [intervals[1] ?? 4, "3rd"], [intervals[2] ?? 7, "5th"], [intervals[3] ?? 10, "7th"]]);
  const scale = new Set(getScale(key, "major").map(normalizedPitch));
  const openStrings = ["E", "A", "D", "G", "B", "E"];
  return openStrings.flatMap((open, stringIndex) => Array.from({ length: safeMaxFret + 1 }, (_, fret) => {
    const pitch = (normalizedPitch(open) + fret) % 12;
    const interval = (pitch - rootPitch + 12) % 12;
    const degree = degreeByInterval.get(interval) ?? (scale.has(pitch) ? "scale" : "other");
    return { stringIndex, fret, note: noteAt(pitch), degree };
  }));
}

export function buildSetlistPreparation(items: SetlistItem[]): SetlistPreparation {
  const bounded = items.slice(0, 12).map((item) => ({ ...item, capo: clamp(Math.floor(item.capo), 0, 12) }));
  const next = bounded[0] ?? null;
  return {
    items: bounded,
    next,
    summary: next ? `Prepare ${next.title}: ${next.key} with capo ${next.capo}, then load ${next.chordPack}.` : "Add a song to prepare the next key, capo, and chord pack."
  };
}

export function getWhyThisIsHard(entry: ChordLibraryItem | null): string[] {
  if (!entry) return ["Choose a voicing to see targeted hand and muting coaching."];
  const notes: string[] = [];
  const positiveFrets = entry.chord.frets.filter((fret) => fret > 0);
  const span = positiveFrets.length ? Math.max(...positiveFrets) - Math.min(...positiveFrets) : 0;
  if (entry.difficultyTags.includes("barre") || entry.chord.barre) notes.push("Barre load: keep the index finger straight but relaxed, then add pressure only until every target string rings.");
  if (entry.difficultyTags.includes("stretch") || span >= 4) notes.push("Stretch demand: place the lowest finger first, keep the thumb behind the neck, and release between repetitions.");
  if (entry.avoidStrings.length) notes.push(`Muting: ${entry.avoidStrings[0]}`);
  if (entry.mutingNotes.length) notes.push(`Right-hand cleanup: ${entry.mutingNotes[0]}`);
  if (entry.chord.frets.filter((fret) => fret === 0).length >= 2) notes.push("Open-string balance: fret adjacent strings from the tips so the ringing strings stay clear.");
  if (!notes.length) notes.push("Keep the wrist neutral, fret close to the fret wire, and check each string separately before strumming.");
  return notes.slice(0, 4);
}

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  { id: "steel-6", label: "Steel-string 6", stringCount: 6, scaleLengthInches: 25.5, tuning: "standard", stringGauge: "light", coaching: "Balanced baseline for open, barre, and movable voicings." },
  { id: "classical-6", label: "Classical / nylon 6", stringCount: 6, scaleLengthInches: 25.6, tuning: "standard", stringGauge: "nylon", coaching: "Use lighter attack and allow extra settling time for nylon response." },
  { id: "twelve-string", label: "12-string", stringCount: 12, scaleLengthInches: 25.4, tuning: "standard", stringGauge: "medium", coaching: "Favor compact shapes and reduce fretting pressure to avoid sharp doubled courses." }
];

export const TEACHER_RUBRIC_TEMPLATES: TeacherRubricTemplate[] = [
  { id: "clean-change", label: "Clean chord change", criteria: [{ id: "timing", label: "Timing", prompt: "Does the change land on the beat?" }, { id: "clean", label: "Clean fretting", prompt: "Do all intended strings ring without buzz?" }, { id: "transition", label: "Transition", prompt: "Do fingers move efficiently?" }] },
  { id: "musical-loop", label: "Musical progression", criteria: [{ id: "rhythm", label: "Rhythm", prompt: "Is the right-hand pattern consistent?" }, { id: "musicality", label: "Musicality", prompt: "Does the progression have a steady pulse and dynamic shape?" }, { id: "confidence", label: "Confidence", prompt: "Can the student recover without stopping?" }] }
];

export function buildProgressSnapshot(entries: ChordLibraryItem[], stats: PracticeStats, goals: Array<{ title: string; nextReviewAt?: string }>): ProgressSnapshot {
  const familyMinutes: Record<string, number> = {};
  const keyCounts: Record<string, number> = {};
  Object.entries(stats).forEach(([id, stat]) => {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) return;
    const family = familyFor(entry);
    familyMinutes[family] = (familyMinutes[family] ?? 0) + (stat.seconds ?? 0);
    keyCounts[entry.root] = (keyCounts[entry.root] ?? 0) + (stat.seconds ?? 0);
  });
  const familyOrder = Object.entries(familyMinutes).sort((left, right) => right[1] - left[1]);
  const keyOrder = Object.entries(keyCounts).sort((left, right) => right[1] - left[1]);
  const dueCount = Object.values(stats).filter((stat) => Boolean(stat.nextReviewAt && Date.parse(stat.nextReviewAt) <= Date.now())).length;
  const nextGoal = goals.find((goal) => !goal.nextReviewAt || Date.parse(goal.nextReviewAt) <= Date.now())?.title ?? goals[0]?.title ?? "Choose a five-key function goal";
  return {
    generatedAt: new Date().toISOString(),
    practicedChordCount: Object.keys(stats).filter((id) => entries.some((entry) => entry.id === id)).length,
    strongestFamily: familyOrder[0]?.[0] ?? "open chords",
    weakestFamily: familyOrder.at(-1)?.[0] ?? "barre chords",
    strongestKey: keyOrder[0]?.[0] ?? "G",
    dueCount,
    nextGoal,
    summary: `${dueCount} review${dueCount === 1 ? "" : "s"} due; strongest focus is ${familyOrder[0]?.[0] ?? "open chords"} in ${keyOrder[0]?.[0] ?? "G"}.`
  };
}
