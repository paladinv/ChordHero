"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram, { Chord } from "../../components/ChordDiagram";
import { CHORD_LIBRARY, CHORD_LOOKUP, LEVELS } from "../../lib/chords";
import { playRecordedClick } from "../../lib/recordedAudio";
import { readSongLibraryState, songChords } from "../../lib/songLibrary";

type TrainerStatus = "idle" | "preview" | "countIn" | "running" | "paused" | "complete";
type FeedbackRating = "clean" | "missed" | "needsWork";
type DrillMode = "random" | "barre" | "pair" | "progression" | "song" | "family" | "keepFingers" | "genre" | "surprise" | "rhythmOnly";
type Pace = number | "manual";
type Subdivision = "change" | "quarter" | "eighth";
type Handedness = "right" | "left";
type ChallengeMode = "standard" | "nameOnly" | "diagramOnly" | "recall";
type ProgressionId = "oneFiveSixFour" | "blues" | "folk" | "pop" | "jazz";
type ChordFamily = "majorMinor" | "seventh" | "suspended" | "power";
type StrummingPrompt = "none" | "down" | "downUp" | "island" | "shuffle";
type TransitionBand = "strong" | "improving" | "weak";
type MistakePattern = "late" | "muted" | "barreFatigue" | "tension";
type GenrePackId = "acousticPop" | "blues" | "rock" | "jazz" | "worship";
type CaptureKind = "audio" | "video";
type SessionIntent = "rehearsal" | "song" | "barre";
type TuningId = "standard" | "dropD" | "dadgad" | "openG" | "custom";
type MilestoneId = "firstCleanBarre" | "sevenDayStreak" | "songReady";
type ChecklistKey = "tuning" | "capo" | "warmUp" | "songOrder" | "difficultTransition";
type RehearsalSection = "verse" | "chorus" | "bridge" | "turnaround";
type RecoveryMethod = "rest" | "slowerPace" | "focusedDrill";
type VoicingLock = "any" | "open" | "closed";

type TransitionRecord = {
  clean: number;
  missed: number;
  needsWork: number;
  score: number;
  previousScore: number;
};

type TrainerStats = {
  cleanStreak: number;
  bestCleanStreak: number;
  bestCleanRound: number;
  bestPaceSeconds: number | null;
  recoveries: number;
};

type ChordRecord = { clean: number; missed: number; needsWork: number };
type PracticeDay = { date: string; rounds: number; seconds: number; clean: number };
type RoundNote = { id: string; date: string; drill: string; note: string };
type WeeklyRotation = Partial<Record<number, { label: string; drill: DrillMode }>>;
type Reflection = { date: string; answer: string };
type RealWorldGoal = { label: string; target: number; progress: number };
type SongReadiness = { label: string; checks: Record<"chords" | "transitions" | "rhythm" | "runThrough", boolean> };
type SessionSummary = { id: string; date: string; accuracy: number; pace: number | null; confidence: number; tension: string };
type SpeedLadder = { unlockedIndex: number; cleanRoundsAtRung: number };
type RecorderTake = { id: string; kind: CaptureKind; url: string; createdAt: number; durationSeconds: number; bytes: number };
type Milestone = { id: MilestoneId; date: string };
type RehearsalNote = { id: string; date: string; section: RehearsalSection; transition: string; note: string };
type RecoveryEntry = { id: string; date: string; method: RecoveryMethod; outcome: string; pace: number | null };
type AchievementSettings = { enabled: boolean; cleanRound: boolean; mastery: boolean; streak: boolean };
type TransitionMastery = { key: string; streak: number; mastered: boolean };

type TrainerPersistence = {
  version: 5;
  transitions: Record<string, TransitionRecord>;
  chords: Record<string, ChordRecord>;
  stats: TrainerStats;
  history: PracticeDay[];
  notes: RoundNote[];
  rotation: WeeklyRotation;
  reflections: Reflection[];
  realWorldGoal: RealWorldGoal;
  mistakePatterns: Record<MistakePattern, number>;
  readiness: SongReadiness;
  sessions: SessionSummary[];
  speedLadder: SpeedLadder;
  milestones: Milestone[];
  performanceChecklist: Record<ChecklistKey, boolean>;
  rehearsalNotes: RehearsalNote[];
  recoveryHistory: RecoveryEntry[];
  achievementSettings: AchievementSettings;
  mastery: TransitionMastery;
};

type RoundConfig = {
  length: number;
  pace: Pace;
  drillLabel: string;
  pacePlan: number[];
};

type SongSet = { id: string; title: string; chords: Chord[] };

const STORAGE_KEY = "chord-hero.trainer.v1";
const DEFAULT_STATS: TrainerStats = {
  cleanStreak: 0,
  bestCleanStreak: 0,
  bestCleanRound: 0,
  bestPaceSeconds: null,
  recoveries: 0
};
const DEFAULT_PERSISTENCE: TrainerPersistence = {
  version: 5,
  transitions: {},
  chords: {},
  stats: DEFAULT_STATS,
  history: [],
  notes: [],
  rotation: {},
  reflections: [],
  realWorldGoal: { label: "Ready to play a three-song set", target: 3, progress: 0 },
  mistakePatterns: { late: 0, muted: 0, barreFatigue: 0, tension: 0 },
  readiness: { label: "Current song", checks: { chords: false, transitions: false, rhythm: false, runThrough: false } },
  sessions: [],
  speedLadder: { unlockedIndex: 0, cleanRoundsAtRung: 0 },
  milestones: [],
  performanceChecklist: { tuning: false, capo: false, warmUp: false, songOrder: false, difficultTransition: false },
  rehearsalNotes: [],
  recoveryHistory: [],
  achievementSettings: { enabled: true, cleanRound: true, mastery: true, streak: true },
  mastery: { key: "", streak: 0, mastered: false }
};
const INTENSITY_PRESETS = {
  1: { label: "Gentle", pace: 8, length: 5, feedback: "Pause and notice one comfortable movement." },
  2: { label: "Steady", pace: 6, length: 5, feedback: "Rate each change when you are ready." },
  3: { label: "Focused", pace: 4, length: 10, feedback: "Rate every change to sharpen the next round." },
  4: { label: "Challenging", pace: 3, length: 20, feedback: "Use quick, honest ratings without overcorrecting." },
  5: { label: "Performance", pace: 2, length: 20, feedback: "Keep moving; recover after the phrase, not inside it." }
} as const;
const CHECKLIST_LABELS: Record<ChecklistKey, string> = {
  tuning: "Tuning checked",
  capo: "Capo position confirmed",
  warmUp: "Warm-up completed",
  songOrder: "Song order reviewed",
  difficultTransition: "Difficult transition rehearsed"
};
const RECOVERY_LABELS: Record<RecoveryMethod, string> = {
  rest: "Rest break",
  slowerPace: "Slower pace",
  focusedDrill: "Focused drill"
};
const TUNINGS: Record<Exclude<TuningId, "custom">, { label: string; notes: string[] }> = {
  standard: { label: "Standard · E A D G B E", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] },
  dropD: { label: "Drop D · D A D G B E", notes: ["D2", "A2", "D3", "G3", "B3", "E4"] },
  dadgad: { label: "DADGAD · D A D G A D", notes: ["D2", "A2", "D3", "G3", "A3", "D4"] },
  openG: { label: "Open G · D G D G B D", notes: ["D2", "G2", "D3", "G3", "B3", "D4"] }
};
const SESSION_INTENT_RECOMMENDATIONS: Record<SessionIntent, string> = {
  rehearsal: "Use rehearsal count-in, stage mode, and a familiar song set before adding speed.",
  song: "Import the song, isolate its weakest transition, then finish with one full progression.",
  barre: "Start with the relaxation motion, keep the thumb light, and stop before fatigue changes your form."
};
const MILESTONE_LABELS: Record<MilestoneId, { title: string; detail: string }> = {
  firstCleanBarre: { title: "First clean barre round", detail: "A fully clean round containing a barre shape." },
  sevenDayStreak: { title: "Seven-day practice streak", detail: "Seven consecutive local practice dates." },
  songReady: { title: "First song ready", detail: "Every item on the song-readiness checklist completed." }
};
const REFERENCE_WAVEFORM = [28, 52, 36, 74, 46, 88, 42, 66, 34, 82, 48, 92, 44, 70, 30, 62, 38, 78, 50, 86, 40, 68, 32, 76];
const SPEED_LADDER = [8, 6, 5, 4, 3, 2] as const;
const CAPTURE_DURATION_MS = 45_000;
const CAPTURE_SIZE_LIMIT = 8_000_000;
const MISTAKE_LABELS: Record<MistakePattern, string> = {
  late: "Late changes",
  muted: "Unintended muted strings",
  barreFatigue: "Barre-hand fatigue",
  tension: "Hand or shoulder tension"
};
const GENRE_PACKS: Record<GenrePackId, { label: string; names: string[]; strum: StrummingPrompt }> = {
  acousticPop: { label: "Acoustic pop", names: ["G", "D", "Em", "C"], strum: "island" },
  blues: { label: "Blues rhythm", names: ["A7", "D7", "E7", "A", "D", "E"], strum: "shuffle" },
  rock: { label: "Rock power chords", names: ["E5", "G5", "A5", "C5", "D5"], strum: "down" },
  jazz: { label: "Jazz comping", names: ["Dm7", "G7", "Cmaj7", "Am7", "D", "G", "C"], strum: "downUp" },
  worship: { label: "Worship", names: ["G", "D", "Em", "C", "A", "E", "F#m"], strum: "island" }
};
const RATING_SCORE: Record<FeedbackRating, number> = { clean: 1, needsWork: 0.45, missed: 0 };
const RATING_LABEL: Record<FeedbackRating, string> = {
  clean: "Clean",
  missed: "Missed",
  needsWork: "Needs work"
};
const TICK_MS = 120;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FAMILY_LABELS: Record<ChordFamily, string> = {
  majorMinor: "Major / minor pairs",
  seventh: "Seventh chords",
  suspended: "Suspended chords",
  power: "Power chords"
};
const STRUMMING_PROMPTS: Record<StrummingPrompt, string> = {
  none: "No strumming prompt",
  down: "↓  ↓  ↓  ↓",
  downUp: "↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑",
  island: "↓  ↓↑  ↑↓↑",
  shuffle: "↓ · ↑  ↓ · ↑"
};
const PROGRESSIONS: Record<ProgressionId, { label: string; roles: number[] }> = {
  oneFiveSixFour: { label: "I–V–vi–IV", roles: [0, 1, 4, 2] },
  blues: { label: "12-bar blues", roles: [0, 0, 0, 0, 2, 2, 0, 0, 1, 2, 0, 1] },
  folk: { label: "Folk · I–IV–V–I", roles: [0, 2, 1, 0] },
  pop: { label: "Pop · vi–IV–I–V", roles: [4, 2, 0, 1] },
  jazz: { label: "Jazz · ii–V–I", roles: [3, 1, 0] }
};

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function parsePersistence(raw: string | null): TrainerPersistence {
  if (!raw || raw.length > 200_000) return DEFAULT_PERSISTENCE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PERSISTENCE;
    const source = parsed as Partial<TrainerPersistence> & { version?: number };
    const statsSource = source.stats && typeof source.stats === "object" ? source.stats : DEFAULT_STATS;
    const stats: TrainerStats = {
      cleanStreak: clampNumber(statsSource.cleanStreak, 0, 100_000, 0),
      bestCleanStreak: clampNumber(statsSource.bestCleanStreak, 0, 100_000, 0),
      bestCleanRound: clampNumber(statsSource.bestCleanRound, 0, 100, 0),
      bestPaceSeconds:
        statsSource.bestPaceSeconds === null
          ? null
          : clampNumber(statsSource.bestPaceSeconds, 2, 8, 3),
      recoveries: clampNumber(statsSource.recoveries, 0, 100_000, 0)
    };
    const transitions: Record<string, TransitionRecord> = {};
    if (source.transitions && typeof source.transitions === "object") {
      Object.entries(source.transitions)
        .slice(0, 500)
        .forEach(([key, value]) => {
          if (!value || typeof value !== "object" || key.length > 80) return;
          const record = value as Partial<TransitionRecord>;
          transitions[key] = {
            clean: clampNumber(record.clean, 0, 100_000, 0),
            missed: clampNumber(record.missed, 0, 100_000, 0),
            needsWork: clampNumber(record.needsWork, 0, 100_000, 0),
            score: clampNumber(record.score, 0, 1, 0.5),
            previousScore: clampNumber(record.previousScore, 0, 1, 0.5)
          };
        });
    }
    const chords: Record<string, ChordRecord> = {};
    if (source.chords && typeof source.chords === "object") {
      Object.entries(source.chords).slice(0, 250).forEach(([key, value]) => {
        if (!value || typeof value !== "object" || key.length > 60) return;
        const record = value as Partial<ChordRecord>;
        chords[key] = {
          clean: clampNumber(record.clean, 0, 100_000, 0),
          missed: clampNumber(record.missed, 0, 100_000, 0),
          needsWork: clampNumber(record.needsWork, 0, 100_000, 0)
        };
      });
    }
    const history = Array.isArray(source.history)
      ? source.history.slice(0, 60).flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const item = entry as Partial<PracticeDay>;
          if (typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return [];
          return [{ date: item.date, rounds: clampNumber(item.rounds, 0, 10_000, 0), seconds: clampNumber(item.seconds, 0, 10_000_000, 0), clean: clampNumber(item.clean, 0, 1_000_000, 0) }];
        })
      : [];
    const notes = Array.isArray(source.notes)
      ? source.notes.slice(0, 50).flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const item = entry as Partial<RoundNote>;
          if (typeof item.id !== "string" || typeof item.date !== "string" || typeof item.drill !== "string" || typeof item.note !== "string") return [];
          return [{ id: item.id.slice(0, 80), date: item.date.slice(0, 10), drill: item.drill.slice(0, 80), note: item.note.slice(0, 500) }];
        })
      : [];
    const rotation: WeeklyRotation = {};
    if (source.rotation && typeof source.rotation === "object") {
      Object.entries(source.rotation).slice(0, 7).forEach(([day, value]) => {
        const dayNumber = Number(day);
        if (!Number.isInteger(dayNumber) || dayNumber < 0 || dayNumber > 6 || !value || typeof value !== "object") return;
        const item = value as { label?: unknown; drill?: unknown };
        const allowedDrills: DrillMode[] = ["random", "barre", "pair", "progression", "song", "family", "keepFingers", "genre", "surprise", "rhythmOnly"];
        if (typeof item.label === "string" && typeof item.drill === "string" && allowedDrills.includes(item.drill as DrillMode)) {
          rotation[dayNumber] = { label: item.label.trim().slice(0, 60), drill: item.drill as DrillMode };
        }
      });
    }
    const reflections = Array.isArray(source.reflections)
      ? source.reflections.slice(0, 30).flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const item = entry as Partial<Reflection>;
          if (typeof item.date !== "string" || typeof item.answer !== "string") return [];
          return [{ date: item.date.slice(0, 10), answer: item.answer.slice(0, 120) }];
        })
      : [];
    const goalSource = source.realWorldGoal && typeof source.realWorldGoal === "object" ? source.realWorldGoal : DEFAULT_PERSISTENCE.realWorldGoal;
    const realWorldGoal: RealWorldGoal = {
      label: typeof goalSource.label === "string" ? goalSource.label.trim().slice(0, 80) || DEFAULT_PERSISTENCE.realWorldGoal.label : DEFAULT_PERSISTENCE.realWorldGoal.label,
      target: clampNumber(goalSource.target, 1, 100, 3),
      progress: clampNumber(goalSource.progress, 0, 100, 0)
    };
    realWorldGoal.progress = Math.min(realWorldGoal.target, realWorldGoal.progress);
    const patternSource = source.mistakePatterns && typeof source.mistakePatterns === "object" ? source.mistakePatterns : DEFAULT_PERSISTENCE.mistakePatterns;
    const mistakePatterns: Record<MistakePattern, number> = {
      late: clampNumber(patternSource.late, 0, 100_000, 0),
      muted: clampNumber(patternSource.muted, 0, 100_000, 0),
      barreFatigue: clampNumber(patternSource.barreFatigue, 0, 100_000, 0),
      tension: clampNumber(patternSource.tension, 0, 100_000, 0)
    };
    const readinessSource = source.readiness && typeof source.readiness === "object" ? source.readiness : DEFAULT_PERSISTENCE.readiness;
    const checksSource = readinessSource.checks && typeof readinessSource.checks === "object" ? readinessSource.checks : DEFAULT_PERSISTENCE.readiness.checks;
    const readiness: SongReadiness = {
      label: typeof readinessSource.label === "string" ? readinessSource.label.trim().slice(0, 80) || "Current song" : "Current song",
      checks: {
        chords: checksSource.chords === true,
        transitions: checksSource.transitions === true,
        rhythm: checksSource.rhythm === true,
        runThrough: checksSource.runThrough === true
      }
    };
    const sessions = Array.isArray(source.sessions) ? source.sessions.slice(0, 30).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<SessionSummary>;
      if (typeof item.id !== "string" || typeof item.date !== "string" || typeof item.tension !== "string") return [];
      return [{
        id: item.id.slice(0, 80),
        date: item.date.slice(0, 10),
        accuracy: clampNumber(item.accuracy, 0, 100, 0),
        pace: item.pace === null ? null : clampNumber(item.pace, 2, 8, 3),
        confidence: clampNumber(item.confidence, 1, 5, 3),
        tension: item.tension.slice(0, 120)
      }];
    }) : [];
    const ladderSource = source.speedLadder && typeof source.speedLadder === "object" ? source.speedLadder : DEFAULT_PERSISTENCE.speedLadder;
    const speedLadder: SpeedLadder = {
      unlockedIndex: clampNumber(ladderSource.unlockedIndex, 0, SPEED_LADDER.length - 1, 0),
      cleanRoundsAtRung: clampNumber(ladderSource.cleanRoundsAtRung, 0, 2, 0)
    };
    const milestoneIds: MilestoneId[] = ["firstCleanBarre", "sevenDayStreak", "songReady"];
    const milestones = Array.isArray(source.milestones) ? source.milestones.slice(0, 3).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<Milestone>;
      if (!milestoneIds.includes(item.id as MilestoneId) || typeof item.date !== "string") return [];
      return [{ id: item.id as MilestoneId, date: item.date.slice(0, 10) }];
    }).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index) : [];
    const checklistSource = source.performanceChecklist && typeof source.performanceChecklist === "object" ? source.performanceChecklist : DEFAULT_PERSISTENCE.performanceChecklist;
    const performanceChecklist: Record<ChecklistKey, boolean> = {
      tuning: checklistSource.tuning === true,
      capo: checklistSource.capo === true,
      warmUp: checklistSource.warmUp === true,
      songOrder: checklistSource.songOrder === true,
      difficultTransition: checklistSource.difficultTransition === true
    };
    const sectionIds: RehearsalSection[] = ["verse", "chorus", "bridge", "turnaround"];
    const rehearsalNotes = Array.isArray(source.rehearsalNotes) ? source.rehearsalNotes.slice(0, 40).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<RehearsalNote>;
      if (typeof item.id !== "string" || typeof item.date !== "string" || !sectionIds.includes(item.section as RehearsalSection) || typeof item.transition !== "string" || typeof item.note !== "string") return [];
      return [{ id: item.id.slice(0, 80), date: item.date.slice(0, 10), section: item.section as RehearsalSection, transition: item.transition.trim().slice(0, 60), note: item.note.trim().slice(0, 300) }];
    }) : [];
    const recoveryMethods: RecoveryMethod[] = ["rest", "slowerPace", "focusedDrill"];
    const recoveryHistory = Array.isArray(source.recoveryHistory) ? source.recoveryHistory.slice(0, 30).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<RecoveryEntry>;
      if (typeof item.id !== "string" || typeof item.date !== "string" || !recoveryMethods.includes(item.method as RecoveryMethod) || typeof item.outcome !== "string") return [];
      return [{ id: item.id.slice(0, 80), date: item.date.slice(0, 10), method: item.method as RecoveryMethod, outcome: item.outcome.trim().slice(0, 160), pace: item.pace === null ? null : clampNumber(item.pace, 2, 8, 3) }];
    }) : [];
    const achievementSource = source.achievementSettings && typeof source.achievementSettings === "object" ? source.achievementSettings : DEFAULT_PERSISTENCE.achievementSettings;
    const achievementSettings: AchievementSettings = {
      enabled: achievementSource.enabled !== false,
      cleanRound: achievementSource.cleanRound !== false,
      mastery: achievementSource.mastery !== false,
      streak: achievementSource.streak !== false
    };
    const masterySource = source.mastery && typeof source.mastery === "object" ? source.mastery : DEFAULT_PERSISTENCE.mastery;
    const mastery: TransitionMastery = {
      key: typeof masterySource.key === "string" ? masterySource.key.trim().slice(0, 60) : "",
      streak: clampNumber(masterySource.streak, 0, 3, 0),
      mastered: masterySource.mastered === true
    };
    return { version: 5, transitions, chords, stats, history, notes, rotation, reflections, realWorldGoal, mistakePatterns, readiness, sessions, speedLadder, milestones, performanceChecklist, rehearsalNotes, recoveryHistory, achievementSettings, mastery };
  } catch {
    return DEFAULT_PERSISTENCE;
  }
}

function chordFamilyMatches(chord: Chord, family: ChordFamily) {
  const item = CHORD_LIBRARY.find((candidate) => candidate.chord.name === chord.name);
  const quality = item?.quality.toLowerCase() ?? chord.name.toLowerCase();
  if (family === "seventh") return /7/.test(quality);
  if (family === "suspended") return /sus/.test(quality);
  if (family === "power") return /power|5$/.test(quality) || /5$/.test(chord.name);
  return quality === "major" || quality === "minor" || (!/[0-9]|sus|add|dim|aug/i.test(chord.name) && /m?$/.test(chord.name));
}

function sharedFrettedPositions(left: Chord, right: Chord) {
  return left.frets.flatMap((fret, stringIndex) => fret > 0 && right.frets[stringIndex] === fret ? [{ stringIndex, fret }] : []);
}

function libraryItemForChord(chord: Chord) {
  return CHORD_LIBRARY.find((item) => item.chord.name === chord.name && item.chord.frets.every((fret, index) => fret === chord.frets[index]))
    ?? CHORD_LIBRARY.find((item) => item.chord.name === chord.name);
}

function transitionBreakdown(from: Chord, to: Chord) {
  const shared = sharedFrettedPositions(from, to);
  return [
    `Set ${from.name}, then release only the pressure you do not need.`,
    shared.length
      ? `Keep ${shared.length} shared fretted position${shared.length === 1 ? "" : "s"} planted while the other fingers travel.`
      : "Lift fingertips only as far as needed and hover them over their next strings.",
    `Land ${to.name} close behind the frets, then test the bass-to-treble path once.`
  ];
}

function transitionBand(record: TransitionRecord): TransitionBand {
  const attempts = record.clean + record.missed + record.needsWork;
  if (attempts < 2 || record.score < 0.55) return "weak";
  if (record.score - record.previousScore >= 0.04 || record.score < 0.8) return "improving";
  return "strong";
}

function transposeProgression(chords: Chord[], id: ProgressionId, length: number) {
  const roots = ["C", "D", "E", "F", "G", "A", "B"];
  const shuffled = roots.slice().sort(() => Math.random() - 0.5);
  const packs = id === "jazz"
    ? shuffled.map((root) => root === "C" ? ["Dm", "G", "C"] : root === "G" ? ["Am", "D", "G"] : root === "D" ? ["Em", "A", "D"] : [])
    : shuffled.map((root) => root === "C" ? ["C", "G", "Am", "F"] : root === "G" ? ["G", "D", "Em", "C"] : root === "D" ? ["D", "A", "Bm", "G"] : root === "A" ? ["A", "E", "F#m", "D"] : []);
  const available = new Map(chords.map((chord) => [chord.name, chord]));
  const eligible = packs.find((pack) => pack.length && pack.every((name) => available.has(name)));
  if (!eligible) return { sequence: buildProgression(chords, id, length), keyLabel: "Current level fallback" };
  const pack = eligible.map((name) => available.get(name)!);
  const base = id === "jazz" ? pack : id === "blues"
    ? [pack[0], pack[0], pack[0], pack[0], pack[3], pack[3], pack[0], pack[0], pack[1], pack[3], pack[0], pack[1]]
    : id === "folk" ? [pack[0], pack[3], pack[1], pack[0]]
      : id === "pop" ? [pack[2], pack[3], pack[0], pack[1]] : [pack[0], pack[1], pack[2], pack[3]];
  return { sequence: Array.from({ length }, (_, index) => base[index % base.length]), keyLabel: `${eligible[0]} key family` };
}

function buzzingDiagnostic(chord: Chord) {
  const muted = chord.frets.flatMap((fret, index) => fret < 0 ? [index + 1] : []);
  if (chord.barre) return `Roll the barre finger slightly, place it close behind fret ${chord.barre.fret}, then test strings ${chord.barre.from + 1}–${chord.barre.to + 1} one at a time.`;
  if (muted.length) return `Check that muted string${muted.length === 1 ? "" : "s"} ${muted.join(", ")} are intentionally quiet, then arch each fretting finger so it does not touch its neighbor.`;
  return "Play each string separately. Move any buzzing fingertip closer to the fret wire and reduce pressure once the note rings cleanly.";
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hasConsecutivePracticeDays(history: PracticeDay[], count: number) {
  const dates = new Set(history.slice(0, 60).filter((day) => day.rounds > 0).map((day) => day.date));
  const cursor = new Date();
  for (let offset = 0; offset < count; offset += 1) {
    cursor.setDate(offset === 0 ? cursor.getDate() : cursor.getDate() - 1);
    if (!dates.has(localDateKey(cursor))) return false;
  }
  return true;
}

function mergeMilestones(current: Milestone[], ids: MilestoneId[]) {
  const existing = new Set(current.map((item) => item.id));
  return [...ids.filter((id) => !existing.has(id)).map((id) => ({ id, date: localDateKey() })), ...current].slice(0, 3);
}

function buildPacePlan(length: number, pace: Pace, warmUp: boolean) {
  if (pace === "manual") return [];
  return Array.from({ length }, (_, index) => {
    if (!warmUp) return pace;
    const warmupProgress = Math.min(1, index / Math.max(1, Math.min(5, length - 1)));
    return Math.min(8, Math.round((pace + (1 - warmupProgress) * Math.min(3, pace * 0.6)) * 2) / 2);
  });
}

function buildProgression(chords: Chord[], id: ProgressionId, length: number) {
  if (!chords.length) return [];
  const qualityMatch = (chord: Chord, expected: string) => {
    if (chord.name === expected) return true;
    const expectedRoot = expected.match(/^[A-G](?:#|b)?/)?.[0];
    const actualRoot = chord.name.match(/^[A-G](?:#|b)?/)?.[0];
    const expectedMinor = expected.slice(expectedRoot?.length ?? 0).startsWith("m");
    const actualMinor = chord.name.slice(actualRoot?.length ?? 0).startsWith("m");
    return expectedRoot === actualRoot && expectedMinor === actualMinor;
  };
  const packs = id === "jazz"
    ? [["Am", "D", "G"], ["Dm", "G", "C"], ["Em", "A", "D"], ["Bm", "E", "A"]]
    : [["G", "D", "Em", "C"], ["C", "G", "Am", "F"], ["D", "A", "Bm", "G"], ["A", "E", "F#m", "D"]];
  const eligibleNames = packs.map((pack) => pack.map((name) => chords.find((chord) => qualityMatch(chord, name)))).find((pack) => pack.every(Boolean));
  const eligiblePack = eligibleNames?.filter((chord): chord is Chord => Boolean(chord));
  let pattern: Chord[];
  if (eligiblePack && id === "jazz") pattern = eligiblePack;
  else if (eligiblePack) {
    const [one, five, six, four] = eligiblePack;
    pattern = id === "blues"
      ? [one, one, one, one, four, four, one, one, five, four, one, five]
      : id === "folk"
        ? [one, four, five, one]
        : id === "pop"
          ? [six, four, one, five]
          : [one, five, six, four];
  } else pattern = PROGRESSIONS[id].roles.map((index) => chords[index % chords.length]);
  return Array.from({ length }, (_, index) => pattern[index % pattern.length]);
}

function techniqueFor(chord: Chord, nextChord: Chord | null) {
  const libraryItem = CHORD_LIBRARY.find((item) => item.chord.name === chord.name);
  const muted = chord.frets.filter((fret) => fret < 0).length;
  const sharedFrets = nextChord
    ? chord.frets.filter((fret, index) => fret > 0 && fret === nextChord.frets[index]).length
    : 0;
  const shapeTip = chord.barre
    ? `Keep the fret-${chord.barre.fret} barre light and roll the index slightly toward its thumb side.`
    : muted
      ? `Aim the strum carefully: ${muted} ${muted === 1 ? "string is" : "strings are"} muted in this shape.`
      : "Land close behind each fret and release any avoidable hand tension.";
  const pivotTip = sharedFrets > 0 ? `${sharedFrets} fretted ${sharedFrets === 1 ? "note stays" : "notes stay"} in place for the next shape—use that as an anchor.` : "Hover the fingers close to the strings before the next change.";
  return {
    shapeTip,
    pivotTip,
    focus: libraryItem?.practiceFocus ?? "Check each string for a clear, relaxed sound.",
    alternative: libraryItem?.nearbyAlternatives?.[0] ?? null
  };
}

function transitionKey(previous: Chord | null, current: Chord) {
  return `${previous?.name ?? "Start"} → ${current.name}`;
}

function weightedChoice(chords: Chord[], previous: Chord, records: Record<string, TransitionRecord>) {
  const candidates = chords.filter((chord) => chord.name !== previous.name);
  const pool = candidates.length ? candidates : chords;
  const weighted = pool.map((chord) => {
    const record = records[transitionKey(previous, chord)];
    if (!record) return { chord, weight: 1.5 };
    const attempts = record.clean + record.missed + record.needsWork;
    const difficulty = attempts ? (record.missed * 1.25 + record.needsWork * 0.7) / attempts : 0.5;
    return { chord, weight: Math.max(0.35, 0.55 + difficulty * 4 + (1 - record.score)) };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let target = Math.random() * total;
  for (const item of weighted) {
    target -= item.weight;
    if (target <= 0) return item.chord;
  }
  return weighted[weighted.length - 1].chord;
}

function buildSequence(
  chords: Chord[],
  length: number,
  records: Record<string, TransitionRecord>,
  pair: [Chord, Chord] | null
) {
  if (pair) return Array.from({ length }, (_, index) => pair[index % 2]);
  if (!chords.length) return [];
  const sequence = [chords[Math.floor(Math.random() * chords.length)]];
  while (sequence.length < length) {
    sequence.push(weightedChoice(chords, sequence[sequence.length - 1], records));
  }
  return sequence;
}

function summarizeFeedback(feedback: Record<number, FeedbackRating>) {
  return Object.values(feedback).reduce(
    (summary, rating) => ({ ...summary, [rating]: summary[rating] + 1 }),
    { clean: 0, missed: 0, needsWork: 0 }
  );
}

function buildNamedSequence(chords: Chord[], names: string[], length: number) {
  const available = new Map(chords.map((chord) => [chord.name, chord]));
  const pack = names.flatMap((name) => available.get(name) ? [available.get(name)!] : []);
  const usable = Array.from(new Map(pack.map((chord) => [chord.name, chord])).values());
  if (usable.length < 2) return null;
  return Array.from({ length }, (_, index) => usable[index % usable.length]);
}

function buildSurpriseSequence(chords: Chord[], length: number, records: Record<string, TransitionRecord>) {
  if (!chords.length) return [];
  const ranked = Object.entries(records)
    .filter(([key]) => !key.startsWith("Start "))
    .sort(([, left], [, right]) => left.score - right.score);
  const weakNames = ranked.slice(0, 4).flatMap(([key]) => key.split(" → "));
  const familiarNames = ranked.slice(-4).flatMap(([key]) => key.split(" → "));
  const selected = [...familiarNames, ...weakNames]
    .flatMap((name) => chords.find((chord) => chord.name === name) ?? [])
    .filter((chord, index, list) => list.findIndex((item) => item.name === chord.name) === index);
  const pool = selected.length >= 2 ? selected : chords;
  return buildSequence(pool, length, records, null);
}

function shareVisualBits(value: string) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index += 1) seed = Math.imul(seed ^ value.charCodeAt(index), 16777619) >>> 0;
  return Array.from({ length: 21 }, (_, row) => Array.from({ length: 21 }, (_, column) => {
    const inFinder = (row < 7 && column < 7) || (row < 7 && column > 13) || (row > 13 && column < 7);
    if (inFinder) {
      const localRow = row < 7 ? row : row - 14;
      const localColumn = column < 7 ? column : column - 14;
      return localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6 || (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4);
    }
    seed = Math.imul(seed ^ (row * 31 + column), 2246822519) >>> 0;
    return (seed & 3) === 0;
  }));
}

function FingerPlacementGuide({ chord, orientation }: { chord: Chord; orientation: Handedness }) {
  const positive = chord.frets.filter((fret) => fret > 0);
  const baseFret = positive.length && Math.max(...positive) > 4 ? chord.barre?.fret ?? Math.min(...positive) : 1;
  const placements = chord.frets.flatMap((fret, stringIndex) => {
    if (fret <= 0) return [];
    const visualString = orientation === "left" ? 5 - stringIndex : stringIndex;
    const left = ((22 + visualString * 31.2) / 200) * 100;
    const top = ((32 + (fret - baseFret + 1) * 41.5 - 20.75) / 230) * 100;
    return [{ stringIndex, fret, finger: chord.fingers?.[stringIndex] ?? null, left, top }];
  }).slice(0, 6);
  return <div className="trainer-finger-guide" aria-label={`Animated finger-placement guide for ${chord.name}`}>
    <ChordDiagram chord={chord} orientation={orientation} />
    <div className="trainer-finger-overlay" aria-hidden="true">
      {placements.map((placement, index) => <span key={`${placement.stringIndex}-${placement.fret}`} style={{ left: `${placement.left}%`, top: `${placement.top}%`, animationDelay: `${index * 0.55}s` }}>{placement.finger ?? index + 1}</span>)}
    </div>
    <ol>{placements.map((placement, index) => <li key={`${placement.stringIndex}-${placement.fret}`}>Step {index + 1}: finger {placement.finger ?? "choice"} to string {placement.stringIndex + 1}, fret {placement.fret}.</li>)}</ol>
  </div>;
}

export default function TrainerPage() {
  const [status, setStatus] = useState<TrainerStatus>("idle");
  const [levelIndex, setLevelIndex] = useState(0);
  const [roundLength, setRoundLength] = useState(10);
  const [pace, setPace] = useState<Pace>(3);
  const [drillMode, setDrillMode] = useState<DrillMode>("random");
  const [pairFrom, setPairFrom] = useState("");
  const [pairTo, setPairTo] = useState("");
  const [progressionId, setProgressionId] = useState<ProgressionId>("oneFiveSixFour");
  const [chordFamily, setChordFamily] = useState<ChordFamily>("majorMinor");
  const [randomKey, setRandomKey] = useState(false);
  const [keepFrom, setKeepFrom] = useState("");
  const [keepTo, setKeepTo] = useState("");
  const [songSets, setSongSets] = useState<SongSet[]>([]);
  const [songSetId, setSongSetId] = useState("");
  const [songImportMessage, setSongImportMessage] = useState("Import saved local songs when you need them.");
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewAudioCue, setPreviewAudioCue] = useState(false);
  const [adaptivePacing, setAdaptivePacing] = useState(false);
  const [warmUp, setWarmUp] = useState(false);
  const [largeDiagrams, setLargeDiagrams] = useState(false);
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [challengeMode, setChallengeMode] = useState<ChallengeMode>("standard");
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [transitionGoalOn, setTransitionGoalOn] = useState(false);
  const [transitionGoalFrom, setTransitionGoalFrom] = useState("");
  const [transitionGoalTo, setTransitionGoalTo] = useState("");
  const [transitionGoalTarget, setTransitionGoalTarget] = useState(5);
  const [transitionGoalProgress, setTransitionGoalProgress] = useState(0);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(5);
  const [rhythmAware, setRhythmAware] = useState(false);
  const [rhythmBpm, setRhythmBpm] = useState(60);
  const [changeBeat, setChangeBeat] = useState(1);
  const [strummingPrompt, setStrummingPrompt] = useState<StrummingPrompt>("none");
  const [backingGroove, setBackingGroove] = useState(false);
  const [preConfidence, setPreConfidence] = useState(3);
  const [postConfidence, setPostConfidence] = useState(3);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [inAppReminder, setInAppReminder] = useState(true);
  const [rotationDay, setRotationDay] = useState(new Date().getDay());
  const [rotationLabel, setRotationLabel] = useState("");
  const [rotationDrill, setRotationDrill] = useState<DrillMode>("random");
  const [shareMessage, setShareMessage] = useState("Teacher challenges stay on this device unless you export a file.");
  const [replayKey, setReplayKey] = useState("");
  const [replayStep, setReplayStep] = useState(0);
  const [diagnosticChordName, setDiagnosticChordName] = useState("");
  const [reflection, setReflection] = useState("");
  const [roundNote, setRoundNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [roundRecoveries, setRoundRecoveries] = useState(0);
  const [restPrompt, setRestPrompt] = useState("");
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [subdivision, setSubdivision] = useState<Subdivision>("change");
  const [volume, setVolume] = useState(0.25);
  const [sequence, setSequence] = useState<Chord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [countInBeat, setCountInBeat] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, FeedbackRating>>({});
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [persistence, setPersistence] = useState<TrainerPersistence>(DEFAULT_PERSISTENCE);
  const [roundConfig, setRoundConfig] = useState<RoundConfig>({ length: 10, pace: 3, drillLabel: "Random level", pacePlan: Array(10).fill(3) });
  const [pausedFrom, setPausedFrom] = useState<"countIn" | "running">("running");
  const [recoveryNonce, setRecoveryNonce] = useState(0);
  const [genrePack, setGenrePack] = useState<GenrePackId>("acousticPop");
  const [silentPractice, setSilentPractice] = useState(false);
  const [coachNotes, setCoachNotes] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [mistakeReport, setMistakeReport] = useState<Record<MistakePattern, boolean>>({ late: false, muted: false, barreFatigue: false, tension: false });
  const [discomfort, setDiscomfort] = useState<"none" | "mild" | "moderate" | "strong">("none");
  const [sessionTension, setSessionTension] = useState("");
  const [sessionSaved, setSessionSaved] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [captureKind, setCaptureKind] = useState<CaptureKind>("audio");
  const [recording, setRecording] = useState(false);
  const [captureMessage, setCaptureMessage] = useState("Nothing is recorded until you choose Start recording and approve browser permission.");
  const [takes, setTakes] = useState<RecorderTake[]>([]);
  const [tuningId, setTuningId] = useState<TuningId>("standard");
  const [customTuningLabel, setCustomTuningLabel] = useState("My tuning");
  const [stringChecks, setStringChecks] = useState<boolean[]>(Array(6).fill(false));
  const [voicingChecks, setVoicingChecks] = useState<boolean[]>(Array(6).fill(false));
  const [sessionIntent, setSessionIntent] = useState<SessionIntent>("rehearsal");
  const [capoFret, setCapoFret] = useState(0);
  const [duetMode, setDuetMode] = useState(false);
  const [duetNames, setDuetNames] = useState<[string, string]>(["Player 1", "Player 2"]);
  const [stageMode, setStageMode] = useState(false);
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [stretchVisible, setStretchVisible] = useState(false);
  const [microGoalOn, setMicroGoalOn] = useState(false);
  const [microGoalProgress, setMicroGoalProgress] = useState(0);
  const [benchmarkActive, setBenchmarkActive] = useState(false);
  const [benchmarkSecondsLeft, setBenchmarkSecondsLeft] = useState(60);
  const [benchmarkClean, setBenchmarkClean] = useState(0);
  const [benchmarkResult, setBenchmarkResult] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<keyof typeof INTENSITY_PRESETS>(3);
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [masteryFrom, setMasteryFrom] = useState("");
  const [masteryTo, setMasteryTo] = useState("");
  const [rhythmChordName, setRhythmChordName] = useState("");
  const [listenFirst, setListenFirst] = useState(false);
  const [listenFirstRevealed, setListenFirstRevealed] = useState(false);
  const [keyLock, setKeyLock] = useState("any");
  const [voicingLock, setVoicingLock] = useState<VoicingLock>("any");
  const [sectionDrillOn, setSectionDrillOn] = useState(false);
  const [rehearsalSection, setRehearsalSection] = useState<RehearsalSection>("verse");
  const [achievementNotice, setAchievementNotice] = useState("");
  const [rehearsalTransition, setRehearsalTransition] = useState("");
  const [rehearsalNote, setRehearsalNote] = useState("");
  const [setlistMessage, setSetlistMessage] = useState("Import a local setlist JSON to build a warm-up from its supported chords.");
  const [handPhotoUrl, setHandPhotoUrl] = useState("");
  const [handPhotoName, setHandPhotoName] = useState("");
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod>("rest");
  const [recoveryOutcome, setRecoveryOutcome] = useState("");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef(0);
  const resumeRemainingRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const persistenceRef = useRef(DEFAULT_PERSISTENCE);
  const persistenceLoadedRef = useRef(false);
  const feedbackRef = useRef<Record<number, FeedbackRating>>({});
  const ratedIndicesRef = useRef(new Set<number>());
  const roundFinishedRef = useRef(false);
  const roundPersistedRef = useRef(false);
  const runtimePaceRef = useRef(3);
  const cleanRecoveryRef = useRef(0);
  const consecutiveMissesRef = useRef(0);
  const roundStartedAtRef = useRef(0);
  const sessionStartedAtRef = useRef(0);
  const roundIdRef = useRef("");
  const metronomeRef = useRef({ on: true, subdivision: "change" as Subdivision, volume: 0.25 });
  const rhythmRef = useRef({ aware: false, bpm: 60, changeBeat: 1, groove: false });
  const challengeFileRef = useRef<HTMLInputElement | null>(null);
  const offlinePackFileRef = useRef<HTMLInputElement | null>(null);
  const setlistFileRef = useRef<HTMLInputElement | null>(null);
  const handPhotoFileRef = useRef<HTMLInputElement | null>(null);
  const handPhotoUrlRef = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const captureBytesRef = useRef(0);
  const captureOverflowRef = useRef(false);
  const captureStartedRef = useRef(0);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takesRef = useRef<RecorderTake[]>([]);
  const silentPracticeRef = useRef(false);
  const benchmarkCleanRef = useRef(0);
  const benchmarkDeadlineRef = useRef(0);

  const activeLevel = LEVELS[levelIndex];
  const chordNames = useMemo(() => activeLevel.chords.map((chord) => chord.name), [activeLevel.chords]);
  const effectivePairFrom = chordNames.includes(pairFrom) ? pairFrom : chordNames[0] ?? "";
  const effectivePairTo =
    chordNames.includes(pairTo) && pairTo !== effectivePairFrom
      ? pairTo
      : chordNames.find((name) => name !== effectivePairFrom) ?? effectivePairFrom;
  const effectiveGoalFrom = chordNames.includes(transitionGoalFrom) ? transitionGoalFrom : chordNames[0] ?? "";
  const effectiveGoalTo = chordNames.includes(transitionGoalTo) && transitionGoalTo !== effectiveGoalFrom
    ? transitionGoalTo
    : chordNames.find((name) => name !== effectiveGoalFrom) ?? effectiveGoalFrom;
  const effectiveKeepFrom = chordNames.includes(keepFrom) ? keepFrom : chordNames[0] ?? "";
  const effectiveKeepTo = chordNames.includes(keepTo) && keepTo !== effectiveKeepFrom
    ? keepTo
    : chordNames.find((name) => name !== effectiveKeepFrom) ?? effectiveKeepFrom;
  const currentChord = currentIndex >= 0 ? sequence[currentIndex] ?? null : null;
  const previousChord = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const nextChord = currentIndex >= 0 ? sequence[currentIndex + 1] ?? null : sequence[0] ?? null;
  const history = currentIndex >= 0 ? sequence.slice(0, currentIndex + 1) : [];
  const selectedChord = selectedHistoryIndex === null ? null : sequence[selectedHistoryIndex] ?? null;
  const settingsLocked = status !== "idle";
  const selectedSongSet = songSets.find((set) => set.id === songSetId) ?? songSets[0] ?? null;
  const technique = useMemo(() => currentChord ? techniqueFor(currentChord, nextChord) : null, [currentChord, nextChord]);
  const chordRecord = currentChord ? persistence.chords[currentChord.name] : null;
  const chordAttempts = chordRecord ? chordRecord.clean + chordRecord.missed + chordRecord.needsWork : 0;
  const today = localDateKey();
  const todayPractice = persistence.history.find((day) => day.date === today) ?? { date: today, rounds: 0, seconds: 0, clean: 0 };
  const todayRotation = persistence.rotation[new Date().getDay()];
  const eligibleFamilyChords = useMemo(() => activeLevel.chords.filter((chord) => chordFamilyMatches(chord, chordFamily)), [activeLevel.chords, chordFamily]);
  const keepPair = useMemo(() => {
    const left = activeLevel.chords.find((chord) => chord.name === effectiveKeepFrom);
    const right = activeLevel.chords.find((chord) => chord.name === effectiveKeepTo);
    return left && right ? { left, right, shared: sharedFrettedPositions(left, right) } : null;
  }, [activeLevel.chords, effectiveKeepFrom, effectiveKeepTo]);
  const transitionMap = useMemo(() => {
    const grouped: Record<TransitionBand, Array<[string, TransitionRecord]>> = { strong: [], improving: [], weak: [] };
    Object.entries(persistence.transitions).filter(([key]) => !key.startsWith("Start ")).slice(-120).forEach((entry) => grouped[transitionBand(entry[1])].push(entry));
    (Object.keys(grouped) as TransitionBand[]).forEach((band) => grouped[band].sort(([, left], [, right]) => right.score - left.score).splice(12));
    return grouped;
  }, [persistence.transitions]);
  const replayTransition = useMemo(() => {
    const [fromName, toName] = replayKey.split(" → ");
    const from = CHORD_LOOKUP.get(fromName);
    const to = CHORD_LOOKUP.get(toName);
    return from && to ? { from, to, shared: sharedFrettedPositions(from, to) } : null;
  }, [replayKey]);
  const diagnosticChord = CHORD_LOOKUP.get(diagnosticChordName) ?? currentChord ?? activeLevel.chords[0] ?? null;
  const capoAlternative = currentChord
    ? CHORD_LIBRARY.find((item) => item.chord.name === currentChord.name)?.nearbyAlternatives.find((item) => item.type === "capo") ?? null
    : null;
  const replayKeys = Object.entries(persistence.transitions)
    .filter(([key, record]) => !key.startsWith("Start ") && transitionBand(record) !== "strong")
    .sort(([, left], [, right]) => left.score - right.score)
    .slice(0, 30)
    .map(([key]) => key);
  const previousSession = persistence.sessions[0] ?? null;
  const readinessDone = Object.values(persistence.readiness.checks).filter(Boolean).length;
  const ladderPace = SPEED_LADDER[persistence.speedLadder.unlockedIndex];
  const mistakeRanking = (Object.entries(persistence.mistakePatterns) as Array<[MistakePattern, number]>).sort(([, left], [, right]) => right - left);
  const weakTransitionCount = transitionMap.weak.length;
  const skillTree = [
    { label: "Chord shapes", ready: Object.keys(persistence.chords).length >= 4 },
    { label: "Clean transitions", ready: transitionMap.strong.length >= 3 },
    { label: "Steady rhythm", ready: persistence.stats.bestCleanRound >= 5 },
    { label: "Song readiness", ready: readinessDone === 4 },
    { label: "Performance", ready: persistence.realWorldGoal.progress >= persistence.realWorldGoal.target }
  ];
  const practiceSheetChords = useMemo(
    () => Array.from(new Map((sequence.length ? sequence : activeLevel.chords).map((chord) => [chord.name, chord])).values()).slice(0, 8),
    [activeLevel.chords, sequence]
  );
  const shareBits = useMemo(() => shareCode ? shareVisualBits(shareCode) : [], [shareCode]);
  const discomfortGuidance = discomfort === "none" ? "No discomfort marked. Keep pressure light and take normal breaks."
    : discomfort === "mild" ? "Pause briefly, relax your grip, and resume at a slower tempo only if it feels comfortable."
      : discomfort === "moderate" ? "Stop this round, rest the hand, and switch to a shorter or non-fretting activity when comfortable."
        : "Stop playing now and rest. If discomfort persists or concerns you, consider guidance from a qualified health professional.";
  const tuningLabel = tuningId === "custom" ? customTuningLabel.trim().slice(0, 60) || "Custom tuning" : TUNINGS[tuningId].label;
  const tuningNotes = tuningId === "custom" ? TUNINGS.standard.notes : TUNINGS[tuningId].notes;
  const duetRole = duetNames[Math.max(0, currentIndex) % 2].trim().slice(0, 24) || `Player ${Math.max(0, currentIndex) % 2 + 1}`;
  const whatNext = useMemo(() => {
    const evidence = transitionMap.weak[0]?.[0]
      ? `Your weakest tracked change is ${transitionMap.weak[0][0]}.`
      : todayRotation ? `Today’s rotation is ${todayRotation.label}.` : "Rate a short round to establish a personal weak transition.";
    return `${SESSION_INTENT_RECOMMENDATIONS[sessionIntent]} ${evidence}`;
  }, [sessionIntent, todayRotation, transitionMap.weak]);
  const adaptiveRestAdvisory = useMemo(() => {
    const recentDays = persistence.history.slice(0, 7).filter((day) => day.rounds > 0).length;
    const recentTensionNotes = persistence.sessions.slice(0, 7).filter((session) => /tens|sore|tight|fatigue|pain/i.test(session.tension)).length;
    if (recentTensionNotes >= 2 || (recentDays >= 6 && persistence.mistakePatterns.tension > 0)) {
      return "A recovery day is worth considering: recent practice density and tension notes are both elevated. Keep today light or rest completely.";
    }
    if (recentDays >= 5) return "You have practiced on at least five recent logged days. A lighter technique-only session can protect consistency without adding fatigue.";
    return "No rest-day signal yet. This advisory uses only the capped local practice history and tension notes.";
  }, [persistence.history, persistence.mistakePatterns.tension, persistence.sessions]);
  const latestTakeBars = useMemo(() => {
    const take = takes[0];
    if (!take) return [];
    let seed = take.bytes + take.durationSeconds * 97;
    return REFERENCE_WAVEFORM.map((_, index) => {
      seed = Math.imul(seed ^ (index + 17), 2654435761) >>> 0;
      return 22 + (seed % 72);
    });
  }, [takes]);

  useEffect(() => {
    metronomeRef.current = { on: metronomeOn, subdivision, volume };
  }, [metronomeOn, subdivision, volume]);

  useEffect(() => { silentPracticeRef.current = silentPractice; }, [silentPractice]);

  useEffect(() => {
    rhythmRef.current = { aware: rhythmAware, bpm: rhythmBpm, changeBeat, groove: backingGroove };
  }, [backingGroove, changeBeat, rhythmAware, rhythmBpm]);

  const ensurePersistenceLoaded = useCallback(() => {
    if (persistenceLoadedRef.current) return persistenceRef.current;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Privacy modes can expose localStorage while rejecting reads.
    }
    const loaded = parsePersistence(stored);
    persistenceLoadedRef.current = true;
    persistenceRef.current = loaded;
    setPersistence(loaded);
    return loaded;
  }, []);

  const savePersistence = useCallback((next: TrainerPersistence) => {
    const bounded: TrainerPersistence = {
      ...next,
      version: 5,
      transitions: Object.fromEntries(Object.entries(next.transitions).slice(-500)),
      chords: Object.fromEntries(Object.entries(next.chords).slice(-250)),
      history: next.history.slice(0, 60),
      notes: next.notes.slice(0, 50),
      rotation: Object.fromEntries(Object.entries(next.rotation).slice(0, 7)),
      reflections: next.reflections.slice(0, 30),
      sessions: next.sessions.slice(0, 30),
      milestones: next.milestones.slice(0, 3).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index),
      rehearsalNotes: next.rehearsalNotes.slice(0, 40),
      recoveryHistory: next.recoveryHistory.slice(0, 30),
      performanceChecklist: {
        tuning: next.performanceChecklist.tuning === true,
        capo: next.performanceChecklist.capo === true,
        warmUp: next.performanceChecklist.warmUp === true,
        songOrder: next.performanceChecklist.songOrder === true,
        difficultTransition: next.performanceChecklist.difficultTransition === true
      },
      achievementSettings: {
        enabled: next.achievementSettings.enabled === true,
        cleanRound: next.achievementSettings.cleanRound === true,
        mastery: next.achievementSettings.mastery === true,
        streak: next.achievementSettings.streak === true
      },
      mastery: {
        key: next.mastery.key.trim().slice(0, 60),
        streak: clampNumber(next.mastery.streak, 0, 3, 0),
        mastered: next.mastery.mastered === true
      },
      mistakePatterns: {
        late: clampNumber(next.mistakePatterns.late, 0, 100_000, 0),
        muted: clampNumber(next.mistakePatterns.muted, 0, 100_000, 0),
        barreFatigue: clampNumber(next.mistakePatterns.barreFatigue, 0, 100_000, 0),
        tension: clampNumber(next.mistakePatterns.tension, 0, 100_000, 0)
      },
      readiness: {
        label: next.readiness.label.trim().slice(0, 80) || "Current song",
        checks: next.readiness.checks
      },
      speedLadder: {
        unlockedIndex: clampNumber(next.speedLadder.unlockedIndex, 0, SPEED_LADDER.length - 1, 0),
        cleanRoundsAtRung: clampNumber(next.speedLadder.cleanRoundsAtRung, 0, 2, 0)
      },
      realWorldGoal: {
        label: next.realWorldGoal.label.trim().slice(0, 80) || DEFAULT_PERSISTENCE.realWorldGoal.label,
        target: clampNumber(next.realWorldGoal.target, 1, 100, 3),
        progress: Math.min(clampNumber(next.realWorldGoal.target, 1, 100, 3), clampNumber(next.realWorldGoal.progress, 0, 100, 0))
      }
    };
    persistenceRef.current = bounded;
    setPersistence(bounded);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    } catch {
      // Training remains fully usable when storage is unavailable or full.
    }
  }, []);

  useEffect(() => {
    ensurePersistenceLoaded();
  }, [ensurePersistenceLoaded]);

  const importSongCoachSets = useCallback(() => {
    const available = readSongLibraryState().songs.slice(0, 100).flatMap((song) => {
      const chords = songChords(song).slice(0, 64).flatMap((name) => {
        const exact = CHORD_LOOKUP.get(name);
        if (exact) return [exact];
        const normalized = name.replace(/\([^)]*\)|\/.*$/g, "");
        const fallback = CHORD_LOOKUP.get(normalized);
        return fallback ? [fallback] : [];
      });
      const unique = Array.from(new Map(chords.map((chord) => [chord.name, chord])).values());
      return unique.length >= 2 ? [{ id: song.id, title: `${song.title} · ${song.artist}`, chords: unique }] : [];
    });
    setSongSets(available);
    setSongSetId((current) => available.some((set) => set.id === current) ? current : available[0]?.id ?? "");
    setSongImportMessage(available.length ? `${available.length} saved Song Coach ${available.length === 1 ? "set" : "sets"} ready.` : "No saved Song Coach song has two supported chord shapes yet.");
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
    return audioContextRef.current;
  }, []);

  const playClick = useCallback(
    async (accent = false) => {
      if (silentPracticeRef.current) return;
      const settings = metronomeRef.current;
      if (!settings.on) return;
      try {
        const context = await ensureAudioContext();
        const played = await playRecordedClick(context, { accent, volume: settings.volume });
        if (played) return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = accent ? 1200 : 900;
        gain.gain.value = 0.0001;
        oscillator.connect(gain);
        gain.connect(context.destination);
        const now = context.currentTime;
        gain.gain.exponentialRampToValueAtTime(Math.max(0.02, settings.volume), now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        oscillator.start(now);
        oscillator.stop(now + 0.09);
      } catch {
        // Audio is optional; browser policy must not stop a practice round.
      }
    },
    [ensureAudioContext]
  );

  const playGroove = useCallback(async (accent = false) => {
    if (silentPracticeRef.current) return;
    if (!rhythmRef.current.groove) return;
    try {
      const context = await ensureAudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = accent ? 110 : 82;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const now = context.currentTime;
      gain.gain.exponentialRampToValueAtTime(Math.max(0.018, metronomeRef.current.volume * 0.45), now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    } catch {
      // The local groove is optional and never blocks the timer.
    }
  }, [ensureAudioContext]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishRound = useCallback(() => {
    if (roundFinishedRef.current) return;
    roundFinishedRef.current = true;
    clearTimer();
    setSecondsLeft(0);
    setStatus("complete");
  }, [clearTimer]);

  useEffect(() => {
    if (status !== "complete" || roundPersistedRef.current) return;
    roundPersistedRef.current = true;
    const summary = summarizeFeedback(feedbackRef.current);
    const current = persistenceRef.current;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - roundStartedAtRef.current) / 1000));
    const day = localDateKey();
    const priorDay = current.history.find((item) => item.date === day);
    const nextDay: PracticeDay = {
      date: day,
      rounds: (priorDay?.rounds ?? 0) + 1,
      seconds: (priorDay?.seconds ?? 0) + elapsedSeconds,
      clean: (priorDay?.clean ?? 0) + summary.clean
    };
    const successful = summary.missed === 0 && summary.clean >= Math.ceil(roundConfig.length * 0.8);
    const perfect = summary.clean === roundConfig.length;
    const ladderEligible = perfect && typeof roundConfig.pace === "number" && roundConfig.pace <= SPEED_LADDER[current.speedLadder.unlockedIndex];
    const ladderCleanRounds = ladderEligible ? current.speedLadder.cleanRoundsAtRung + 1 : current.speedLadder.cleanRoundsAtRung;
    const unlockNext = ladderCleanRounds >= 2 && current.speedLadder.unlockedIndex < SPEED_LADDER.length - 1;
    const bestPaceSeconds =
      successful && typeof roundConfig.pace === "number"
        ? current.stats.bestPaceSeconds === null
          ? roundConfig.pace
          : Math.min(current.stats.bestPaceSeconds, roundConfig.pace)
        : current.stats.bestPaceSeconds;
    const nextHistory = [nextDay, ...current.history.filter((item) => item.date !== day)].slice(0, 60);
    const milestoneCandidates: MilestoneId[] = [];
    if (perfect && sequence.some((chord) => Boolean(chord.barre))) milestoneCandidates.push("firstCleanBarre");
    if (hasConsecutivePracticeDays(nextHistory, 7)) milestoneCandidates.push("sevenDayStreak");
    savePersistence({
      ...current,
      stats: {
        ...current.stats,
        bestCleanRound: Math.max(current.stats.bestCleanRound, summary.clean),
        bestPaceSeconds
      },
      speedLadder: {
        unlockedIndex: unlockNext ? current.speedLadder.unlockedIndex + 1 : current.speedLadder.unlockedIndex,
        cleanRoundsAtRung: unlockNext ? 0 : Math.min(2, ladderCleanRounds)
      },
      history: nextHistory,
      milestones: mergeMilestones(current.milestones, milestoneCandidates)
    });
    if (Date.now() - sessionStartedAtRef.current >= 20 * 60 * 1000) setRestPrompt("You have practiced for about 20 minutes. Take two minutes to loosen your hands and shoulders.");
  }, [roundConfig.length, roundConfig.pace, savePersistence, sequence, status]);

  useEffect(() => {
    clearTimer();
    if (status === "countIn") {
      const duration = resumeRemainingRef.current ?? 1000;
      resumeRemainingRef.current = null;
      deadlineRef.current = Date.now() + duration;
      void playClick(countInBeat === 3);
      const tick = () => {
        const remaining = deadlineRef.current - Date.now();
        if (remaining <= 0) {
          if (countInBeat > 1) setCountInBeat((beat) => beat - 1);
          else {
            setCurrentIndex(0);
            setStatus("running");
          }
          return;
        }
        timerRef.current = setTimeout(tick, Math.min(TICK_MS, remaining));
      };
      timerRef.current = setTimeout(tick, Math.min(TICK_MS, duration));
      return clearTimer;
    }

    if (status !== "running" || currentIndex < 0) return;
    if (benchmarkActive) {
      if (!benchmarkDeadlineRef.current) {
        benchmarkDeadlineRef.current = Date.now() + (resumeRemainingRef.current ?? 60_000);
        resumeRemainingRef.current = null;
      }
      deadlineRef.current = benchmarkDeadlineRef.current;
      const tickBenchmark = () => {
        const remaining = Math.max(0, benchmarkDeadlineRef.current - Date.now());
        setBenchmarkSecondsLeft(Math.ceil(remaining / 1000));
        if (remaining <= 0) {
          const result = benchmarkCleanRef.current;
          setBenchmarkResult(result);
          setBenchmarkActive(false);
          benchmarkDeadlineRef.current = 0;
          finishRound();
          return;
        }
        timerRef.current = setTimeout(tickBenchmark, Math.min(TICK_MS, remaining));
      };
      tickBenchmark();
      return clearTimer;
    }
    if (roundConfig.pace === "manual") {
      setSecondsLeft(0);
      void playClick(true);
      return;
    }

    const plannedPace = roundConfig.pacePlan[currentIndex] ?? runtimePaceRef.current;
    const rhythmSettings = rhythmRef.current;
    const musicalBeatDuration = 60_000 / rhythmSettings.bpm;
    const duration = resumeRemainingRef.current ?? (rhythmSettings.aware ? musicalBeatDuration * 4 : Math.max(runtimePaceRef.current, plannedPace) * 1000);
    resumeRemainingRef.current = null;
    const startedAt = Date.now();
    deadlineRef.current = startedAt + duration;
    let lastDisplayedSecond = Math.ceil(duration / 1000);
    let lastSubdivisionBeat = 0;
    setSecondsLeft(lastDisplayedSecond);
    void playClick(!rhythmSettings.aware || rhythmSettings.changeBeat === 1);
    void playGroove(true);

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, deadlineRef.current - now);
      const displayedSecond = Math.ceil(remaining / 1000);
      if (displayedSecond !== lastDisplayedSecond) {
        lastDisplayedSecond = displayedSecond;
        setSecondsLeft(displayedSecond);
      }

      const division = metronomeRef.current.subdivision;
      const beatDuration = rhythmSettings.aware ? musicalBeatDuration : division === "eighth" ? 500 : division === "quarter" ? 1000 : 0;
      if (beatDuration) {
        const beat = Math.floor((now - startedAt) / beatDuration);
        if (beat > lastSubdivisionBeat) {
          lastSubdivisionBeat = beat;
          const beatInBar = beat % 4 + 1;
          void playClick(rhythmSettings.aware && beatInBar === rhythmSettings.changeBeat);
          void playGroove(beatInBar === 1);
        }
      }

      if (remaining <= 0) {
        if (currentIndex + 1 < sequence.length) setCurrentIndex((index) => index + 1);
        else finishRound();
        return;
      }
      timerRef.current = setTimeout(tick, Math.min(TICK_MS, remaining));
    };
    timerRef.current = setTimeout(tick, Math.min(TICK_MS, duration));
    return clearTimer;
  }, [benchmarkActive, clearTimer, countInBeat, currentIndex, finishRound, playClick, playGroove, recoveryNonce, roundConfig.pace, roundConfig.pacePlan, sequence.length, status]);

  useEffect(() => () => {
    clearTimer();
    void audioContextRef.current?.close();
  }, [clearTimer]);

  const beginCountIn = useCallback(() => {
    resumeRemainingRef.current = null;
    setCountInBeat(rehearsalMode ? 4 : 3);
    setStatus("countIn");
  }, [rehearsalMode]);

  const startRound = useCallback(async () => {
    const saved = ensurePersistenceLoaded();
    if (!silentPractice && (metronomeOn || backingGroove)) await ensureAudioContext();
    const barreChords = activeLevel.chords.filter((chord) => Boolean(chord.barre));
    const familyChords = activeLevel.chords.filter((chord) => chordFamilyMatches(chord, chordFamily));
    const drillChords = drillMode === "barre" && barreChords.length
      ? barreChords
      : drillMode === "family" && familyChords.length ? familyChords : activeLevel.chords;
    const fromChord = activeLevel.chords.find((chord) => chord.name === effectivePairFrom);
    const toChord = activeLevel.chords.find((chord) => chord.name === effectivePairTo);
    const pair = drillMode === "pair" && fromChord && toChord ? ([fromChord, toChord] as [Chord, Chord]) : null;
    const keepLeft = activeLevel.chords.find((chord) => chord.name === effectiveKeepFrom);
    const keepRight = activeLevel.chords.find((chord) => chord.name === effectiveKeepTo);
    const keepDrillPair = drillMode === "keepFingers" && keepLeft && keepRight && sharedFrettedPositions(keepLeft, keepRight).length
      ? ([keepLeft, keepRight] as [Chord, Chord]) : null;
    const goalFromChord = activeLevel.chords.find((chord) => chord.name === effectiveGoalFrom);
    const goalToChord = activeLevel.chords.find((chord) => chord.name === effectiveGoalTo);
    const goalPair = transitionGoalOn && drillMode === "random" && goalFromChord && goalToChord ? ([goalFromChord, goalToChord] as [Chord, Chord]) : null;
    const transposed = drillMode === "progression" && randomKey ? transposeProgression(activeLevel.chords, progressionId, roundLength) : null;
    const genreSequence = drillMode === "genre" ? buildNamedSequence(activeLevel.chords, GENRE_PACKS[genrePack].names, roundLength) : null;
    const nextSequence = drillMode === "progression"
      ? transposed?.sequence ?? buildProgression(activeLevel.chords, progressionId, roundLength)
      : drillMode === "genre"
        ? genreSequence ?? buildSequence(activeLevel.chords, roundLength, saved.transitions, null)
      : drillMode === "surprise"
        ? buildSurpriseSequence(activeLevel.chords, roundLength, saved.transitions)
      : drillMode === "song" && selectedSongSet
        ? buildSequence(selectedSongSet.chords, roundLength, saved.transitions, null)
        : buildSequence(drillChords, roundLength, saved.transitions, pair ?? keepDrillPair ?? goalPair);
    const drillLabel =
      drillMode === "pair"
        ? `${effectivePairFrom} → ${effectivePairTo}`
        : drillMode === "barre"
          ? barreChords.length
            ? "Barre chords"
            : "Random level (no barre chords in this level)"
          : drillMode === "progression"
            ? `${PROGRESSIONS[progressionId].label}${transposed ? ` · ${transposed.keyLabel}` : ""}`
            : drillMode === "song"
              ? selectedSongSet?.title ?? "Saved Song Coach set unavailable"
              : drillMode === "family"
                ? familyChords.length ? FAMILY_LABELS[chordFamily] : `${FAMILY_LABELS[chordFamily]} unavailable · level fallback`
                : drillMode === "keepFingers"
                  ? keepDrillPair ? `${effectiveKeepFrom} ↔ ${effectiveKeepTo} · keep fingers down` : "Keep-fingers drill unavailable · level fallback"
                  : drillMode === "genre"
                    ? `${GENRE_PACKS[genrePack].label}${genreSequence ? "" : " · level fallback"}`
                    : drillMode === "surprise"
                      ? "Surprise me · familiar + targeted challenge"
              : "Adaptive random level";
    if (!nextSequence.length) return;
    const nextConfig = { length: roundLength, pace, drillLabel, pacePlan: buildPacePlan(roundLength, pace, warmUp) };
    setRoundConfig(nextConfig);
    setSequence(nextSequence);
    setBenchmarkActive(false);
    benchmarkDeadlineRef.current = 0;
    setCurrentIndex(-1);
    setFeedback({});
    feedbackRef.current = {};
    ratedIndicesRef.current = new Set();
    roundFinishedRef.current = false;
    roundPersistedRef.current = false;
    runtimePaceRef.current = typeof pace === "number" ? pace : 3;
    cleanRecoveryRef.current = 0;
    consecutiveMissesRef.current = 0;
    roundStartedAtRef.current = Date.now();
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = Date.now();
    roundIdRef.current = `round-${Date.now()}`;
    setRoundNote("");
    setNoteSaved(false);
    setRoundRecoveries(0);
    setMicroGoalProgress(0);
    setPostConfidence(3);
    setRecallRevealed(false);
    setGuideVisible(false);
    setSessionSaved(false);
    setSelectedHistoryIndex(null);
    setSecondsLeft(0);
    if (previewEnabled) setStatus("preview");
    else beginCountIn();
  }, [activeLevel.chords, backingGroove, beginCountIn, chordFamily, drillMode, effectiveGoalFrom, effectiveGoalTo, effectiveKeepFrom, effectiveKeepTo, effectivePairFrom, effectivePairTo, ensureAudioContext, ensurePersistenceLoaded, genrePack, metronomeOn, pace, previewEnabled, progressionId, randomKey, roundLength, selectedSongSet, silentPractice, transitionGoalOn, warmUp]);

  const applyEmergencyWarmUp = useCallback(() => {
    if (settingsLocked) return;
    setRoundLength(20);
    setPace(3);
    setWarmUp(true);
    setDrillMode("random");
    setPreviewEnabled(false);
    setAdaptivePacing(true);
    setShareMessage("One-minute warm-up loaded: 20 quick shapes with a gentle pace ramp.");
  }, [settingsLocked]);

  const startBenchmark = useCallback(() => {
    if (settingsLocked || !activeLevel.chords.length) return;
    const saved = ensurePersistenceLoaded();
    const nextSequence = buildSequence(activeLevel.chords, 60, saved.transitions, null);
    setSequence(nextSequence);
    setDuetMode(false);
    setRoundConfig({ length: 60, pace: "manual", drillLabel: "One-minute chord-change benchmark", pacePlan: [] });
    setCurrentIndex(-1);
    setFeedback({});
    feedbackRef.current = {};
    ratedIndicesRef.current = new Set();
    roundFinishedRef.current = false;
    roundPersistedRef.current = false;
    roundStartedAtRef.current = Date.now();
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = Date.now();
    roundIdRef.current = `benchmark-${Date.now()}`;
    benchmarkCleanRef.current = 0;
    benchmarkDeadlineRef.current = 0;
    setBenchmarkClean(0);
    setBenchmarkResult(null);
    setBenchmarkSecondsLeft(60);
    setBenchmarkActive(true);
    setMicroGoalProgress(0);
    resumeRemainingRef.current = null;
    setCountInBeat(3);
    setStatus("countIn");
  }, [activeLevel.chords, ensurePersistenceLoaded, settingsLocked]);

  const togglePerformanceMode = useCallback(async () => {
    if (!performanceMode) {
      try { await document.documentElement.requestFullscreen?.(); } catch { /* Minimal layout still works when fullscreen is unavailable. */ }
      setPerformanceMode(true);
    } else {
      try { if (document.fullscreenElement) await document.exitFullscreen?.(); } catch { /* Browser may own fullscreen state. */ }
      setPerformanceMode(false);
    }
  }, [performanceMode]);

  const resetRound = useCallback(() => {
    clearTimer();
    resumeRemainingRef.current = null;
    benchmarkDeadlineRef.current = 0;
    roundFinishedRef.current = false;
    roundPersistedRef.current = false;
    setStatus("idle");
    setSequence([]);
    setCurrentIndex(-1);
    setSecondsLeft(0);
    setFeedback({});
    feedbackRef.current = {};
    ratedIndicesRef.current = new Set();
    setSelectedHistoryIndex(null);
    setRecallRevealed(false);
    setBenchmarkActive(false);
    setBenchmarkSecondsLeft(60);
  }, [clearTimer]);

  const pauseRound = useCallback(() => {
    if (status !== "running" && status !== "countIn") return;
    resumeRemainingRef.current = Math.max(1, deadlineRef.current - Date.now());
    if (benchmarkActive) benchmarkDeadlineRef.current = 0;
    setPausedFrom(status);
    setStatus("paused");
  }, [benchmarkActive, status]);

  const resumeRound = useCallback(() => setStatus(pausedFrom), [pausedFrom]);

  const advanceChord = useCallback(() => {
    if (status !== "running") return;
    setRecallRevealed(false);
    if (currentIndex + 1 < sequence.length) setCurrentIndex((index) => index + 1);
    else finishRound();
  }, [currentIndex, finishRound, sequence.length, status]);

  const inspectPreviousChord = useCallback(() => {
    if (currentIndex <= 0) return;
    setSelectedHistoryIndex((selected) => Math.max(0, selected === null ? currentIndex - 1 : selected - 1));
  }, [currentIndex]);

  const recoverCurrent = useCallback(() => {
    if (status !== "running" || currentIndex < 0) return;
    const existingRating = feedbackRef.current[currentIndex];
    if (existingRating) {
      const nextFeedback = { ...feedbackRef.current };
      delete nextFeedback[currentIndex];
      feedbackRef.current = nextFeedback;
      setFeedback(nextFeedback);
      ratedIndicesRef.current.delete(currentIndex);
    }
    resumeRemainingRef.current = null;
    setRoundRecoveries((count) => count + 1);
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, stats: { ...loaded.stats, recoveries: loaded.stats.recoveries + 1 } });
    setRecallRevealed(false);
    setRecoveryNonce((nonce) => nonce + 1);
  }, [currentIndex, ensurePersistenceLoaded, savePersistence, status]);

  const rateCurrentChord = (rating: FeedbackRating) => {
    if (!currentChord || currentIndex < 0 || ratedIndicesRef.current.has(currentIndex)) return;
    ratedIndicesRef.current.add(currentIndex);
    const loaded = ensurePersistenceLoaded();
    const key = transitionKey(previousChord, currentChord);
    const oldRecord = loaded.transitions[key] ?? {
      clean: 0,
      missed: 0,
      needsWork: 0,
      score: 0.5,
      previousScore: 0.5
    };
    const nextRecord: TransitionRecord = {
      ...oldRecord,
      clean: oldRecord.clean + (rating === "clean" ? 1 : 0),
      missed: oldRecord.missed + (rating === "missed" ? 1 : 0),
      needsWork: oldRecord.needsWork + (rating === "needsWork" ? 1 : 0),
      previousScore: oldRecord.score,
      score: oldRecord.score * 0.75 + RATING_SCORE[rating] * 0.25
    };
    const nextStreak = rating === "clean" ? loaded.stats.cleanStreak + 1 : 0;
    const oldChordRecord = loaded.chords[currentChord.name] ?? { clean: 0, missed: 0, needsWork: 0 };
    const nextChordRecord: ChordRecord = {
      clean: oldChordRecord.clean + (rating === "clean" ? 1 : 0),
      missed: oldChordRecord.missed + (rating === "missed" ? 1 : 0),
      needsWork: oldChordRecord.needsWork + (rating === "needsWork" ? 1 : 0)
    };
    const nextPersistence: TrainerPersistence = {
      ...loaded,
      version: 5,
      transitions: { ...loaded.transitions, [key]: nextRecord },
      chords: { ...loaded.chords, [currentChord.name]: nextChordRecord },
      stats: {
        ...loaded.stats,
        cleanStreak: nextStreak,
        bestCleanStreak: Math.max(loaded.stats.bestCleanStreak, nextStreak)
      }
    };
    const nextFeedback = { ...feedbackRef.current, [currentIndex]: rating };
    feedbackRef.current = nextFeedback;
    setFeedback(nextFeedback);
    savePersistence(nextPersistence);

    if (benchmarkActive && rating === "clean") {
      benchmarkCleanRef.current += 1;
      setBenchmarkClean(benchmarkCleanRef.current);
    }
    if (microGoalOn && rating === "clean" && previousChord && sharedFrettedPositions(previousChord, currentChord).length > 0) {
      setMicroGoalProgress((progress) => Math.min(3, progress + 1));
    }

    if (transitionGoalOn && rating === "clean" && previousChord?.name === effectiveGoalFrom && currentChord.name === effectiveGoalTo) {
      setTransitionGoalProgress((progress) => Math.min(transitionGoalTarget, progress + 1));
    }
    if (rating === "missed") {
      consecutiveMissesRef.current += 1;
      if (consecutiveMissesRef.current >= 3) setRestPrompt("Three misses in a row usually mean tension or fatigue. Shake out your hand, breathe, and restart more slowly.");
    } else {
      consecutiveMissesRef.current = 0;
    }

    if (adaptivePacing && typeof roundConfig.pace === "number") {
      if (rating === "missed") {
        runtimePaceRef.current = Math.min(8, runtimePaceRef.current + 1);
        cleanRecoveryRef.current = 0;
      } else if (rating === "needsWork") {
        runtimePaceRef.current = Math.min(8, runtimePaceRef.current + 0.5);
        cleanRecoveryRef.current = 0;
      } else {
        cleanRecoveryRef.current += 1;
        if (cleanRecoveryRef.current >= 3) {
          runtimePaceRef.current = Math.max(roundConfig.pace, runtimePaceRef.current - 0.5);
          cleanRecoveryRef.current = 0;
        }
      }
    }
  };

  const rateAndAdvance = (rating: FeedbackRating) => {
    if (status !== "running" || feedbackRef.current[currentIndex]) return;
    rateCurrentChord(rating);
    setRecallRevealed(false);
    if (currentIndex + 1 < sequence.length) setCurrentIndex((index) => index + 1);
    else if (!benchmarkActive) finishRound();
  };

  const saveRoundNote = useCallback(() => {
    const note = roundNote.trim().slice(0, 500);
    if (!note) return;
    const loaded = ensurePersistenceLoaded();
    const entry: RoundNote = { id: roundIdRef.current, date: localDateKey(), drill: roundConfig.drillLabel, note };
    savePersistence({ ...loaded, notes: [entry, ...loaded.notes.filter((item) => item.id !== entry.id)].slice(0, 50) });
    setNoteSaved(true);
  }, [ensurePersistenceLoaded, roundConfig.drillLabel, roundNote, savePersistence]);

  const exportTrainerData = useCallback(() => {
    const loaded = ensurePersistenceLoaded();
    const blob = new Blob([JSON.stringify(loaded, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chord-hero-trainer-${localDateKey()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [ensurePersistenceLoaded]);

  const resetTrainerData = useCallback(() => {
    if (!window.confirm("Reset all Trainer ratings, records, history, and notes on this device?")) return;
    savePersistence(DEFAULT_PERSISTENCE);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
    setTransitionGoalProgress(0);
    setRestPrompt("");
  }, [savePersistence]);

  const saveRotation = useCallback(() => {
    const loaded = ensurePersistenceLoaded();
    const label = rotationLabel.trim().slice(0, 60) || `${DAY_LABELS[rotationDay]} practice`;
    savePersistence({ ...loaded, rotation: { ...loaded.rotation, [rotationDay]: { label, drill: rotationDrill } } });
    setRotationLabel("");
  }, [ensurePersistenceLoaded, rotationDay, rotationDrill, rotationLabel, savePersistence]);

  const useTodayRotation = useCallback(() => {
    if (!todayRotation || settingsLocked) return;
    setDrillMode(todayRotation.drill);
    setShareMessage(`Loaded today’s rotation: ${todayRotation.label}.`);
  }, [settingsLocked, todayRotation]);

  const saveRealWorldGoal = useCallback((goal: RealWorldGoal) => {
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, realWorldGoal: goal });
  }, [ensurePersistenceLoaded, savePersistence]);

  const saveReflection = useCallback(() => {
    const answer = reflection.trim().slice(0, 120);
    if (!answer) return;
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, reflections: [{ date: localDateKey(), answer }, ...loaded.reflections].slice(0, 30) });
    setReflection("");
    setRestPrompt("");
  }, [ensurePersistenceLoaded, reflection, savePersistence]);

  const exportTeacherChallenge = useCallback(() => {
    const payload = {
      kind: "chord-hero-teacher-challenge",
      version: 2,
      label: roundConfig.drillLabel.slice(0, 80),
      chordNames: (sequence.length ? sequence : activeLevel.chords).slice(0, 40).map((chord) => chord.name),
      roundLength,
      pace,
      challengeMode,
      strummingPrompt,
      tuningLabel,
      capoFret,
      coachNotes: coachNotes.trim().slice(0, 1000)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chord-hero-challenge-${localDateKey()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setShareMessage("Challenge exported as a local JSON file.");
  }, [activeLevel.chords, capoFret, challengeMode, coachNotes, pace, roundConfig.drillLabel, roundLength, sequence, strummingPrompt, tuningLabel]);

  const importTeacherChallenge = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 100_000) {
      setShareMessage("Challenge rejected: files must be 100 KB or smaller.");
      return;
    }
    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("invalid");
      const item = parsed as { kind?: unknown; version?: unknown; label?: unknown; chordNames?: unknown; roundLength?: unknown; pace?: unknown; challengeMode?: unknown; strummingPrompt?: unknown; coachNotes?: unknown; tuningLabel?: unknown; capoFret?: unknown };
      if (item.kind !== "chord-hero-teacher-challenge" || ![1, 2].includes(Number(item.version)) || !Array.isArray(item.chordNames)) throw new Error("invalid");
      const names = item.chordNames.slice(0, 40).filter((name): name is string => typeof name === "string" && name.length <= 24);
      const chords = names.flatMap((name) => {
        const chord = CHORD_LOOKUP.get(name);
        return chord ? [chord] : [];
      });
      if (chords.length < 2) throw new Error("unsupported");
      const imported: SongSet = { id: `teacher-${Date.now()}`, title: typeof item.label === "string" ? item.label.slice(0, 80) : "Teacher challenge", chords };
      setSongSets((current) => [imported, ...current].slice(0, 100));
      setSongSetId(imported.id);
      setDrillMode("song");
      setRoundLength([5, 10, 20].includes(Number(item.roundLength)) ? Number(item.roundLength) : 10);
      setPace(item.pace === "manual" || [2, 3, 4, 5, 6, 7, 8].includes(Number(item.pace)) ? item.pace as Pace : 3);
      if (["standard", "nameOnly", "diagramOnly", "recall"].includes(String(item.challengeMode))) setChallengeMode(item.challengeMode as ChallengeMode);
      if (Object.prototype.hasOwnProperty.call(STRUMMING_PROMPTS, String(item.strummingPrompt))) setStrummingPrompt(item.strummingPrompt as StrummingPrompt);
      setCoachNotes(typeof item.coachNotes === "string" ? item.coachNotes.slice(0, 1000) : "");
      if (typeof item.tuningLabel === "string") { setTuningId("custom"); setCustomTuningLabel(item.tuningLabel.slice(0, 60)); }
      setCapoFret(clampNumber(item.capoFret, 0, 12, 0));
      setShareMessage(`Imported “${imported.title}” with ${chords.length} supported chord cues.`);
    } catch {
      setShareMessage("Challenge rejected: the file is invalid or has fewer than two supported local chords.");
    } finally {
      if (challengeFileRef.current) challengeFileRef.current.value = "";
    }
  }, []);

  const prepareShareCode = useCallback(() => {
    const compact = JSON.stringify({ v: 2, l: roundConfig.drillLabel.slice(0, 50), c: (sequence.length ? sequence : activeLevel.chords).slice(0, 20).map((chord) => chord.name), t: tuningLabel, capo: capoFret, n: coachNotes.trim().slice(0, 300) });
    try {
      setShareCode(`CH2:${btoa(unescape(encodeURIComponent(compact)))}`);
      setShareMessage("Local challenge code prepared. Copy its text payload to share; the visual is not advertised as camera-scannable.");
    } catch {
      setShareMessage("This challenge could not be encoded locally.");
    }
  }, [activeLevel.chords, capoFret, coachNotes, roundConfig.drillLabel, sequence, tuningLabel]);

  const saveMistakeReport = useCallback(() => {
    const selected = (Object.keys(mistakeReport) as MistakePattern[]).filter((key) => mistakeReport[key]);
    if (!selected.length) return;
    const loaded = ensurePersistenceLoaded();
    const next = { ...loaded.mistakePatterns };
    selected.forEach((key) => { next[key] += 1; });
    savePersistence({ ...loaded, mistakePatterns: next });
    setMistakeReport({ late: false, muted: false, barreFatigue: false, tension: false });
  }, [ensurePersistenceLoaded, mistakeReport, savePersistence]);

  const updateReadiness = useCallback((key: keyof SongReadiness["checks"], checked: boolean) => {
    const loaded = ensurePersistenceLoaded();
    const checks = { ...loaded.readiness.checks, [key]: checked };
    savePersistence({
      ...loaded,
      readiness: { ...loaded.readiness, checks },
      milestones: Object.values(checks).every(Boolean) ? mergeMilestones(loaded.milestones, ["songReady"]) : loaded.milestones
    });
  }, [ensurePersistenceLoaded, savePersistence]);

  const updateReadinessLabel = useCallback((label: string) => {
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, readiness: { ...loaded.readiness, label: label.trim().slice(0, 80) || "Current song" } });
  }, [ensurePersistenceLoaded, savePersistence]);

  const saveSessionComparison = useCallback(() => {
    if (sessionSaved) return;
    const loaded = ensurePersistenceLoaded();
    const rated = Object.keys(feedback).length;
    const clean = summarizeFeedback(feedback).clean;
    const item: SessionSummary = {
      id: roundIdRef.current,
      date: localDateKey(),
      accuracy: rated ? Math.round((clean / rated) * 100) : 0,
      pace: typeof roundConfig.pace === "number" ? roundConfig.pace : null,
      confidence: postConfidence,
      tension: sessionTension.trim().slice(0, 120)
    };
    savePersistence({ ...loaded, sessions: [item, ...loaded.sessions.filter((session) => session.id !== item.id)].slice(0, 30) });
    setSessionSaved(true);
  }, [ensurePersistenceLoaded, feedback, postConfidence, roundConfig.pace, savePersistence, sessionSaved, sessionTension]);

  const downloadOfflinePack = useCallback(() => {
    const payload = { kind: "chord-hero-offline-pack", version: 1, label: roundConfig.drillLabel.slice(0, 80), chordNames: (sequence.length ? sequence : activeLevel.chords).slice(0, 40).map((chord) => chord.name), strummingPrompt, tuningLabel, capoFret, coachNotes: coachNotes.trim().slice(0, 1000) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chord-hero-offline-pack-${localDateKey()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setShareMessage("Offline practice pack downloaded as a bounded local JSON file.");
  }, [activeLevel.chords, capoFret, coachNotes, roundConfig.drillLabel, sequence, strummingPrompt, tuningLabel]);

  const importOfflinePack = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("large");
      const parsed = JSON.parse(await file.text()) as { kind?: unknown; version?: unknown; label?: unknown; chordNames?: unknown; strummingPrompt?: unknown; coachNotes?: unknown; tuningLabel?: unknown; capoFret?: unknown };
      if (parsed.kind !== "chord-hero-offline-pack" || parsed.version !== 1 || !Array.isArray(parsed.chordNames)) throw new Error("invalid");
      const chords = parsed.chordNames.slice(0, 40).flatMap((name) => typeof name === "string" && name.length <= 24 && CHORD_LOOKUP.get(name) ? [CHORD_LOOKUP.get(name)!] : []);
      if (chords.length < 2) throw new Error("unsupported");
      const imported = { id: `offline-${Date.now()}`, title: typeof parsed.label === "string" ? parsed.label.slice(0, 80) : "Offline practice pack", chords };
      setSongSets((current) => [imported, ...current].slice(0, 100));
      setSongSetId(imported.id);
      setDrillMode("song");
      if (Object.prototype.hasOwnProperty.call(STRUMMING_PROMPTS, String(parsed.strummingPrompt))) setStrummingPrompt(parsed.strummingPrompt as StrummingPrompt);
      setCoachNotes(typeof parsed.coachNotes === "string" ? parsed.coachNotes.slice(0, 1000) : "");
      if (typeof parsed.tuningLabel === "string") { setTuningId("custom"); setCustomTuningLabel(parsed.tuningLabel.slice(0, 60)); }
      setCapoFret(clampNumber(parsed.capoFret, 0, 12, 0));
      setShareMessage(`Offline pack “${imported.title}” is ready on this device.`);
    } catch {
      setShareMessage("Offline pack rejected: use a valid Trainer pack under 100 KB with at least two supported chords.");
    } finally {
      if (offlinePackFileRef.current) offlinePackFileRef.current.value = "";
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    captureTimeoutRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  const clearTakes = useCallback(() => {
    takesRef.current.forEach((take) => URL.revokeObjectURL(take.url));
    takesRef.current = [];
    setTakes([]);
    setCaptureMessage("Comparison takes cleared from this page’s memory.");
  }, []);

  const startCapture = useCallback(async () => {
    if (recording) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCaptureMessage("This browser does not provide local MediaRecorder capture.");
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: captureKind === "video" });
      const captureStream = stream;
      const recorder = new MediaRecorder(captureStream);
      mediaStreamRef.current = captureStream;
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      captureBytesRef.current = 0;
      captureOverflowRef.current = false;
      captureStartedRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        captureBytesRef.current += event.data.size;
        if (captureBytesRef.current > CAPTURE_SIZE_LIMIT) {
          captureOverflowRef.current = true;
          if (recorder.state === "recording") recorder.stop();
          return;
        }
        mediaChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setCaptureMessage("The browser stopped the local recording unexpectedly.");
        if (recorder.state === "recording") recorder.stop();
      };
      recorder.onstop = () => {
        if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
        captureStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        if (captureOverflowRef.current) {
          mediaChunksRef.current = [];
          setCaptureMessage("Take discarded because it exceeded the 8 MB local safety cap.");
          return;
        }
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || (captureKind === "video" ? "video/webm" : "audio/webm") });
        mediaChunksRef.current = [];
        if (!blob.size) { setCaptureMessage("No media was captured."); return; }
        const take: RecorderTake = { id: `take-${Date.now()}`, kind: captureKind, url: URL.createObjectURL(blob), createdAt: Date.now(), durationSeconds: Math.min(45, Math.max(1, Math.round((Date.now() - captureStartedRef.current) / 1000))), bytes: blob.size };
        const next = [take, ...takesRef.current].slice(0, 2);
        takesRef.current.filter((old) => !next.some((item) => item.id === old.id)).forEach((old) => URL.revokeObjectURL(old.url));
        takesRef.current = next;
        setTakes(next);
        setCaptureMessage("Take kept only in this page’s memory. Record another to compare.");
      };
      recorder.start(250);
      setRecording(true);
      setCaptureMessage("Recording locally… it will stop automatically at 45 seconds or 8 MB.");
      captureTimeoutRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, CAPTURE_DURATION_MS);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      setRecording(false);
      setCaptureMessage("Recording was not started. Check the browser permission and try again if you want to opt in.");
    }
  }, [captureKind, recording]);

  useEffect(() => () => {
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state === "recording") recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    takesRef.current.forEach((take) => URL.revokeObjectURL(take.url));
    takesRef.current = [];
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setPerformanceMode(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!["running", "paused", "countIn"].includes(status)) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (status === "paused") resumeRound();
        else pauseRound();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        advanceChord();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        inspectPreviousChord();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        recoverCurrent();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [advanceChord, inspectPreviousChord, pauseRound, recoverCurrent, resumeRound, status]);

  const feedbackSummary = useMemo(() => summarizeFeedback(feedback), [feedback]);
  const flaggedTransitions = useMemo(
    () =>
      Object.entries(feedback)
        .filter(([, rating]) => rating !== "clean")
        .map(([index, rating]) => {
          const sequenceIndex = Number(index);
          return {
            key: transitionKey(sequence[sequenceIndex - 1] ?? null, sequence[sequenceIndex]),
            rating
          };
        }),
    [feedback, sequence]
  );
  const mostImproved = useMemo(() => {
    const entries = Object.entries(persistence.transitions).filter(([key]) => !key.startsWith("Start "));
    return entries.sort(([, left], [, right]) => right.score - right.previousScore - (left.score - left.previousScore))[0];
  }, [persistence.transitions]);
  const recommendedAction = flaggedTransitions.length
    ? `Repeat ${flaggedTransitions[0].key} as a focused pair at a comfortable pace.`
    : Object.keys(feedback).length < roundConfig.length
      ? "Rate every change next round so adaptive practice can target weak transitions."
      : "No weak changes flagged. Try the next faster pace or a longer round.";

  const statusLabel =
    status === "running"
      ? benchmarkActive ? `Benchmark ${benchmarkSecondsLeft}s`
      : roundConfig.pace === "manual"
        ? "Manual"
        : "Live"
      : status === "countIn"
        ? `Count-in ${countInBeat}`
        : status === "paused"
          ? "Paused"
          : status === "preview"
            ? "Preview"
            : "Ready";

  return (
    <main className={`page focused-page trainer-page ${largeDiagrams ? "trainer-large-diagrams" : ""} ${performanceMode ? "trainer-performance" : ""} ${stageMode ? "trainer-stage-mode" : ""}`}>
      <section className="studio-heading trainer-heading">
        <div>
          <span className="tag">Trainer</span>
          <h1>Practice the transitions that need you most.</h1>
          <p>Build an adaptive round, mark each change honestly, and turn every miss into the next useful drill.</p>
        </div>
        <div className="studio-session-note" aria-label="Trainer format">
          <span className="label">Round format</span>
          <strong>{pace === "manual" ? "Manual pace" : `${pace} seconds`} · {roundLength} chords</strong>
          <span>{tuningLabel}{capoFret ? ` · capo ${capoFret}` : " · no capo"}</span>
          <span>Defaults stay at 3 seconds and 10 chords. Accuracy still comes first.</span>
        </div>
      </section>

      <section className="panel trainer-workspace">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Level {levelIndex + 1}: {activeLevel.name}</p>
            <h2>{activeLevel.description}</h2>
          </div>
          <div className="status" aria-live="polite">
            <span className="badge">{Math.max(0, currentIndex + 1)}/{roundConfig.length}</span>
            <span className={`badge ${status === "running" ? "live" : ""}`}>{statusLabel}</span>
            <span className="badge muted">
              {status === "running" && typeof roundConfig.pace === "number" ? `${secondsLeft}s remaining` : roundConfig.drillLabel}
            </span>
          </div>
        </div>

        <div className="trainer-settings-grid" aria-label="Round setup">
          <label>Level
            <select value={levelIndex} onChange={(event) => setLevelIndex(Number(event.target.value))} disabled={settingsLocked}>
              {LEVELS.map((level, index) => <option key={level.name} value={index}>{level.name}</option>)}
            </select>
          </label>
          <label>Round length
            <select value={roundLength} onChange={(event) => setRoundLength(Number(event.target.value))} disabled={settingsLocked}>
              {[5, 10, 20].map((length) => <option key={length} value={length}>{length} chords</option>)}
            </select>
          </label>
          <label>Pace
            <select value={pace} onChange={(event) => setPace(event.target.value === "manual" ? "manual" : Number(event.target.value))} disabled={settingsLocked}>
              <option value="manual">Manual / non-timed</option>
              {[2, 3, 4, 5, 6, 7, 8].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
            </select>
          </label>
          <label>Drill
            <select value={drillMode} onChange={(event) => setDrillMode(event.target.value as DrillMode)} disabled={settingsLocked}>
              <option value="random">Adaptive random level</option>
              <option value="barre">Barre chords only</option>
              <option value="pair">Focused chord pair</option>
              <option value="progression">Common progression</option>
              <option value="song">Saved Song Coach set</option>
              <option value="family">Chord-family drill</option>
              <option value="keepFingers">Keep fingers down</option>
              <option value="genre">Genre practice pack</option>
              <option value="surprise">Surprise me</option>
            </select>
          </label>
          {drillMode === "pair" && <>
            <label>From
              <select value={effectivePairFrom} onChange={(event) => setPairFrom(event.target.value)} disabled={settingsLocked}>
                {chordNames.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label>To
              <select value={effectivePairTo} onChange={(event) => setPairTo(event.target.value)} disabled={settingsLocked}>
                {chordNames.filter((name) => name !== effectivePairFrom).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </>}
          {drillMode === "progression" && <label>Progression
            <select value={progressionId} onChange={(event) => setProgressionId(event.target.value as ProgressionId)} disabled={settingsLocked}>
              {Object.entries(PROGRESSIONS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
            </select>
          </label>}
          {drillMode === "progression" && <label className="trainer-inline-check"><input type="checkbox" checked={randomKey} onChange={(event) => setRandomKey(event.target.checked)} disabled={settingsLocked} /> Random eligible key</label>}
          {drillMode === "genre" && <label>Genre pack
            <select value={genrePack} onChange={(event) => { const next = event.target.value as GenrePackId; setGenrePack(next); setStrummingPrompt(GENRE_PACKS[next].strum); }} disabled={settingsLocked}>
              {Object.entries(GENRE_PACKS).map(([id, pack]) => <option key={id} value={id}>{pack.label}</option>)}
            </select>
            <small>Uses supported shapes in this level; unavailable packs fall back gracefully.</small>
          </label>}
          {drillMode === "family" && <label>Chord family
            <select value={chordFamily} onChange={(event) => setChordFamily(event.target.value as ChordFamily)} disabled={settingsLocked}>
              {Object.entries(FAMILY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <small>{eligibleFamilyChords.length ? `${eligibleFamilyChords.length} eligible shape${eligibleFamilyChords.length === 1 ? "" : "s"} in this level.` : "No eligible shapes in this level; the round will use the full level."}</small>
          </label>}
          {drillMode === "keepFingers" && <>
            <label>Anchor from<select value={effectiveKeepFrom} onChange={(event) => setKeepFrom(event.target.value)} disabled={settingsLocked}>{chordNames.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label>Anchor to<select value={effectiveKeepTo} onChange={(event) => setKeepTo(event.target.value)} disabled={settingsLocked}>{chordNames.filter((name) => name !== effectiveKeepFrom).map((name) => <option key={name}>{name}</option>)}</select></label>
            <div className="trainer-setting-note">{keepPair?.shared.length ? `Keep ${keepPair.shared.length} fretted position${keepPair.shared.length === 1 ? "" : "s"} planted.` : "These shapes share no fretted positions; choose another pair or use the level fallback."}</div>
          </>}
          {drillMode === "song" && <label>Song set
            <select value={selectedSongSet?.id ?? ""} onChange={(event) => setSongSetId(event.target.value)} disabled={settingsLocked || !songSets.length}>
              {!songSets.length && <option value="">Import saved songs below</option>}
              {songSets.map((set) => <option key={set.id} value={set.id}>{set.title}</option>)}
            </select>
          </label>}
          <label>Challenge
            <select value={challengeMode} onChange={(event) => setChallengeMode(event.target.value as ChallengeMode)} disabled={settingsLocked}>
              <option value="standard">Names + diagrams</option><option value="nameOnly">Chord-name only</option><option value="diagramOnly">Diagram-only identification</option><option value="recall">No-diagram recall</option>
            </select>
          </label>
          <label>Diagram orientation
            <select value={handedness} onChange={(event) => setHandedness(event.target.value as Handedness)}>
              <option value="right">Right-handed</option><option value="left">Left-handed (mirrored)</option>
            </select>
          </label>
          <label>Daily session goal
            <select value={dailyGoalMinutes} onChange={(event) => setDailyGoalMinutes(Number(event.target.value))}>
              {[5, 10, 15, 20].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
          <label>Confidence before round
            <select value={preConfidence} onChange={(event) => setPreConfidence(Number(event.target.value))} disabled={settingsLocked}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select>
          </label>
          <label>Session intent
            <select value={sessionIntent} onChange={(event) => setSessionIntent(event.target.value as SessionIntent)} disabled={settingsLocked}>
              <option value="rehearsal">Prepare for rehearsal</option><option value="song">Learn a song</option><option value="barre">Build barre endurance</option>
            </select>
          </label>
        </div>

        {drillMode === "song" && <div className="trainer-import-row"><button className="btn" type="button" onClick={importSongCoachSets} disabled={settingsLocked}>Import saved Song Coach sets</button><span>{songImportMessage} Only chord names with local diagrams are included.</span></div>}

        {inAppReminder && todayPractice.seconds < dailyGoalMinutes * 60 && <aside className="trainer-reminder" role="status"><span><strong>Today’s practice is unfinished.</strong> {Math.max(1, dailyGoalMinutes - Math.floor(todayPractice.seconds / 60))} minute(s) remain. This reminder appears only inside Trainer.</span><button className="btn ghost" type="button" onClick={() => setInAppReminder(false)}>Dismiss</button></aside>}

        <details className="trainer-lab-section">
          <summary>Weekly rotation and quick presets</summary>
          <div className="trainer-rotation-editor">
            <label>Day<select value={rotationDay} onChange={(event) => setRotationDay(Number(event.target.value))}>{DAY_LABELS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label>Drill<select value={rotationDrill} onChange={(event) => setRotationDrill(event.target.value as DrillMode)}>{["random", "barre", "pair", "progression", "family", "keepFingers"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
            <label>Label<input maxLength={60} value={rotationLabel} onChange={(event) => setRotationLabel(event.target.value)} placeholder="Open chords" /></label>
            <button className="btn" type="button" onClick={saveRotation}>Save rotation</button>
            <button className="btn" type="button" onClick={applyEmergencyWarmUp} disabled={settingsLocked}>Load 1-minute warm-up</button>
          </div>
          <p>{todayRotation ? <>Today: <strong>{todayRotation.label}</strong> ({todayRotation.drill}). <button className="text-button" type="button" onClick={useTodayRotation} disabled={settingsLocked}>Use suggestion</button></> : "No practice rotation is assigned for today."}</p>
        </details>

        <div className="trainer-goal-builder">
          <label><input type="checkbox" checked={transitionGoalOn} onChange={(event) => setTransitionGoalOn(event.target.checked)} disabled={settingsLocked} /> Transition goal</label>
          <select aria-label="Transition goal from chord" value={effectiveGoalFrom} onChange={(event) => { setTransitionGoalFrom(event.target.value); setTransitionGoalProgress(0); }} disabled={!transitionGoalOn || settingsLocked}>{chordNames.map((name) => <option key={name}>{name}</option>)}</select>
          <span aria-hidden="true">→</span>
          <select aria-label="Transition goal to chord" value={effectiveGoalTo} onChange={(event) => { setTransitionGoalTo(event.target.value); setTransitionGoalProgress(0); }} disabled={!transitionGoalOn || settingsLocked}>{chordNames.filter((name) => name !== effectiveGoalFrom).map((name) => <option key={name}>{name}</option>)}</select>
          <select aria-label="Clean repetitions target" value={transitionGoalTarget} onChange={(event) => { setTransitionGoalTarget(Number(event.target.value)); setTransitionGoalProgress(0); }} disabled={!transitionGoalOn || settingsLocked}>{[3, 5, 8, 10].map((count) => <option key={count} value={count}>{count} clean reps</option>)}</select>
        </div>

        <div className="trainer-options">
          <label><input type="checkbox" checked={previewEnabled} onChange={(event) => setPreviewEnabled(event.target.checked)} disabled={settingsLocked} /> Preview sequence first</label>
          <label><input type="checkbox" checked={previewAudioCue} onChange={(event) => setPreviewAudioCue(event.target.checked)} disabled={settingsLocked} /> Preview rhythm cue (click only)</label>
          <label><input type="checkbox" checked={adaptivePacing} onChange={(event) => setAdaptivePacing(event.target.checked)} disabled={settingsLocked || pace === "manual"} /> Slow down after misses</label>
          <label><input type="checkbox" checked={warmUp} onChange={(event) => setWarmUp(event.target.checked)} disabled={settingsLocked || pace === "manual"} /> Warm-up pace ramp</label>
          <label><input type="checkbox" checked={largeDiagrams} onChange={(event) => setLargeDiagrams(event.target.checked)} /> Large diagrams</label>
          <label><input type="checkbox" checked={silentPractice} onChange={(event) => setSilentPractice(event.target.checked)} /> Silent fretting-hand practice</label>
          <label><input type="checkbox" checked={duetMode} onChange={(event) => setDuetMode(event.target.checked)} disabled={settingsLocked} /> Same-device duet</label>
          <label><input type="checkbox" checked={stageMode} onChange={(event) => setStageMode(event.target.checked)} /> Low-light stage mode</label>
          <label><input type="checkbox" checked={rehearsalMode} onChange={(event) => setRehearsalMode(event.target.checked)} disabled={settingsLocked} /> Rehearsal 4-beat stage intro</label>
          <label><input type="checkbox" checked={microGoalOn} onChange={(event) => { setMicroGoalOn(event.target.checked); setMicroGoalProgress(0); }} disabled={settingsLocked} /> Micro-goal: keep a shared finger down 3 times</label>
        </div>

        {duetMode && <div className="trainer-duet-names"><label>First role<input maxLength={24} value={duetNames[0]} onChange={(event) => setDuetNames([event.target.value, duetNames[1]])} disabled={settingsLocked} /></label><label>Second role<input maxLength={24} value={duetNames[1]} onChange={(event) => setDuetNames([duetNames[0], event.target.value])} disabled={settingsLocked} /></label></div>}

        <div className="trainer-speed-ladder" aria-label="Speed ladder">
          <div><span className="label">Speed ladder</span><strong>{ladderPace}s rung</strong><small>Two fully rated clean rounds unlock the next rung.</small></div>
          <div>{SPEED_LADDER.map((seconds, index) => <button key={seconds} type="button" className={index === persistence.speedLadder.unlockedIndex ? "active" : ""} disabled={index > persistence.speedLadder.unlockedIndex || settingsLocked} onClick={() => setPace(seconds)}>{seconds}s {index > persistence.speedLadder.unlockedIndex ? "locked" : "ready"}</button>)}</div>
          <progress max={2} value={persistence.speedLadder.cleanRoundsAtRung} />
        </div>

        <div className="trainer-rhythm-settings">
          <label><input type="checkbox" checked={rhythmAware} onChange={(event) => setRhythmAware(event.target.checked)} disabled={settingsLocked || pace === "manual"} /> Rhythm-aware four-beat bars</label>
          <label>BPM<input type="number" min="40" max="120" value={rhythmBpm} onChange={(event) => setRhythmBpm(clampNumber(Number(event.target.value), 40, 120, 60))} disabled={!rhythmAware || settingsLocked} /></label>
          <label>Land change on beat<select value={changeBeat} onChange={(event) => setChangeBeat(Number(event.target.value))} disabled={!rhythmAware || settingsLocked}>{[1, 2, 3, 4].map((beat) => <option key={beat} value={beat}>Beat {beat}</option>)}</select></label>
          <label>Strumming cue<select value={strummingPrompt} onChange={(event) => setStrummingPrompt(event.target.value as StrummingPrompt)}>{Object.entries(STRUMMING_PROMPTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label><input type="checkbox" checked={backingGroove} onChange={(event) => setBackingGroove(event.target.checked)} /> Simple local backing groove</label>
        </div>

        {transitionGoalOn && <div className="trainer-goal-progress" aria-live="polite"><span><strong>{effectiveGoalFrom} → {effectiveGoalTo}</strong> clean goal</span><progress max={transitionGoalTarget} value={transitionGoalProgress} /><strong>{transitionGoalProgress}/{transitionGoalTarget}</strong></div>}
        {microGoalOn && <div className="trainer-goal-progress" aria-live="polite"><span><strong>Shared-finger micro-goal</strong> · clean transitions with a planted fretted position</span><progress max={3} value={microGoalProgress} /><strong>{microGoalProgress}/3</strong></div>}

        {restPrompt && <aside className="trainer-rest-prompt" role="status"><div><strong>Smart rest prompt</strong><p>{restPrompt}</p><label>After resting, did your hand tension reduce?<input maxLength={120} value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Yes—my wrist feels looser" /></label></div><div><button className="btn" type="button" onClick={saveReflection} disabled={!reflection.trim()}>Save reflection</button><button className="btn ghost" type="button" onClick={() => setRestPrompt("")}>Dismiss</button></div></aside>}

        {status === "preview" ? (
          <div className="trainer-preview" aria-label="Round preview">
            <div><span className="label">Sequence preview</span><h3>Review the route before the count-in.</h3></div>
            <ol>{sequence.map((chord, index) => <li key={`${chord.name}-${index}`}><span>{index + 1}</span>{chord.name}{previewAudioCue && <button type="button" aria-label={`Play rhythm cue for ${chord.name}`} onClick={() => void playClick(index === 0)}>♪</button>}</li>)}</ol>
            <button className="btn primary" onClick={beginCountIn}>Begin {rehearsalMode ? "4-beat stage intro" : "3-beat count-in"}</button>
          </div>
        ) : status === "countIn" ? (
          <div className="trainer-count-in" role="timer" aria-live="assertive">
            <span>{rehearsalMode ? "Stage intro" : "Get ready"}</span><strong>{countInBeat}</strong><p>First chord: {sequence[0]?.name}</p>
          </div>
        ) : (
            <div className="trainer-transition-stage" key={currentIndex}>
            {performanceMode && <button className="btn trainer-performance-exit" type="button" onClick={() => void togglePerformanceMode()}>Exit performance mode</button>}
            <div className="trainer-previous-chord">
              <span className="label">Previous</span>
              <h3>{challengeMode === "diagramOnly" && previousChord ? "Identify it" : previousChord?.name ?? (currentChord ? "Start" : "—")}</h3>
              {previousChord && challengeMode === "standard" ? <ChordDiagram chord={previousChord} largeChart={largeDiagrams} orientation={handedness} /> : <div className="diagram-empty" />}
            </div>
            <span className="trainer-transition-arrow" aria-hidden="true">→</span>
            <div className="trainer-current-chord">
              <span className="label">{duetMode && currentChord ? `${duetRole} · ` : ""}Current chord</span>
              <h3>{currentChord ? challengeMode === "diagramOnly" ? "Name this shape" : currentChord.name : "Press start"}</h3>
              {currentChord && (challengeMode === "standard" || challengeMode === "diagramOnly" || (challengeMode === "recall" && recallRevealed)) ? <ChordDiagram chord={currentChord} largeChart={largeDiagrams} orientation={handedness} /> : <div className="diagram-empty trainer-recall-empty"><span>{challengeMode === "recall" && currentChord ? `Build ${currentChord.name} from memory` : challengeMode === "nameOnly" ? "Diagram hidden" : ""}</span></div>}
              {currentChord && challengeMode === "recall" && <button className="text-button" type="button" onClick={() => setRecallRevealed((shown) => !shown)}>{recallRevealed ? "Hide diagram" : "Reveal diagram"}</button>}
            </div>
            <aside className="trainer-up-next" aria-live="polite"><span className="label">Up next</span><strong>{nextChord?.name ?? "Round recap"}</strong>{nextChord && challengeMode !== "nameOnly" && challengeMode !== "recall" ? <ChordDiagram chord={nextChord} orientation={handedness} /> : <span>Prepare the next shape</span>}</aside>
            {strummingPrompt !== "none" && <div className="trainer-strumming-cue"><span className="label">Strum</span><strong>{STRUMMING_PROMPTS[strummingPrompt]}</strong>{rhythmAware && <small>Change on beat {changeBeat} · {rhythmBpm} BPM</small>}</div>}
            <div className="trainer-stage-meta"><strong>{tuningLabel}</strong><span>{capoFret ? `Capo ${capoFret}` : "No capo"}</span>{rehearsalMode && <span>Rehearsal mode</span>}</div>
          </div>
        )}

        {currentChord && technique && status === "running" && <div className="trainer-technique-strip">
          <div><span className="label">Shape cue</span><p>{technique.shapeTip}</p></div>
          <div><span className="label">Transition cue</span><p>{technique.pivotTip}</p></div>
          <div><span className="label">Technique focus</span><p>{technique.focus}</p>{technique.alternative && <small>Compare: {technique.alternative.label} — {technique.alternative.description}</small>}</div>
          <div><span className="label">Finger-placement animation</span><p>Use the short overlay only when the shape needs a closer look.</p><button className="btn" type="button" onClick={() => setGuideVisible((visible) => !visible)}>{guideVisible ? "Hide guide" : "Show animated guide"}</button></div>
        </div>}
        {currentChord && guideVisible && status === "running" && <FingerPlacementGuide chord={currentChord} orientation={handedness} />}

        {currentChord && status !== "preview" && status !== "countIn" && (
          <div className="trainer-feedback" role="group" aria-label={`Rate ${currentChord.name}`}>
            <span className="label">How was this change?</span>
            {(["clean", "needsWork", "missed"] as FeedbackRating[]).map((rating) => (
              <button key={rating} className={`btn trainer-rating rating-${rating} ${feedback[currentIndex] === rating ? "selected" : ""}`} onClick={() => rateCurrentChord(rating)} disabled={Boolean(feedback[currentIndex]) || status === "paused"} aria-pressed={feedback[currentIndex] === rating}>{RATING_LABEL[rating]}</button>
            ))}
            {feedback[currentIndex] && <span className="trainer-feedback-saved" aria-live="polite">Saved once for this change.</span>}
            <button className="btn trainer-recover" type="button" onClick={recoverCurrent} disabled={status !== "running"}>Recover / repeat</button>
          </div>
        )}

        <div className="controls trainer-controls">
          <button className="btn primary" onClick={() => void startRound()} disabled={status !== "idle"}>Start round</button>
          <button className="btn" onClick={pauseRound} disabled={status !== "running" && status !== "countIn"}>Pause</button>
          <button className="btn" onClick={resumeRound} disabled={status !== "paused"}>Resume</button>
          <button className="btn trainer-handsfree-control" onClick={inspectPreviousChord} disabled={status !== "running" || currentIndex <= 0}>← Previous review</button>
          {status === "running" && <button className="btn primary trainer-handsfree-control" onClick={advanceChord}>Next chord →</button>}
          {status === "running" && <button className="btn trainer-handsfree-control" onClick={recoverCurrent}>↓ Recover</button>}
          <button className="btn ghost" onClick={resetRound}>Reset</button>
          <button className="btn" type="button" onClick={() => void togglePerformanceMode()}>{performanceMode ? "Exit performance mode" : "Performance mode"}</button>
        </div>
        {duetMode && currentChord && status === "running" && <div className="trainer-duet-controls" role="group" aria-label={`${duetRole} turn controls`}><strong>{duetRole}&apos;s turn</strong><button type="button" onClick={() => rateAndAdvance("clean")} disabled={Boolean(feedback[currentIndex])}>Clean + pass</button><button type="button" onClick={() => rateAndAdvance("needsWork")} disabled={Boolean(feedback[currentIndex])}>Needs work + pass</button><button type="button" onClick={() => rateAndAdvance("missed")} disabled={Boolean(feedback[currentIndex])}>Missed + pass</button></div>}
        {benchmarkActive && <div className="trainer-benchmark-live" role="timer"><strong>{benchmarkSecondsLeft}s</strong><span>{benchmarkClean} clean changes</span><button className="btn primary" type="button" onClick={() => rateAndAdvance("clean")} disabled={Boolean(feedback[currentIndex])}>Clean + next</button><button className="btn" type="button" onClick={() => rateAndAdvance("needsWork")} disabled={Boolean(feedback[currentIndex])}>Not clean + next</button></div>}

        <p className="trainer-shortcuts"><strong>Hands-free keyboard:</strong> Space pauses/resumes · ← reviews previous · → advances · ↓ repeats the current chord.</p>

        <div className="trainer-metronome">
          <label><input type="checkbox" checked={metronomeOn} onChange={(event) => setMetronomeOn(event.target.checked)} /> Metronome sound</label>
          <label>Subdivision
            <select value={subdivision} onChange={(event) => setSubdivision(event.target.value as Subdivision)} disabled={!metronomeOn}>
              <option value="change">Chord changes only</option><option value="quarter">Every second</option><option value="eighth">Eighth-note pulse</option>
            </select>
          </label>
          <label>Volume <input type="range" min="0" max="0.6" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={!metronomeOn} aria-label="Metronome volume" /></label>
          {silentPractice && <strong className="trainer-silent-note">Silent mode is active: clicks, preview cues, and backing groove are suppressed.</strong>}
        </div>
      </section>

      <section className="trainer-stats" aria-label="Trainer progress">
        <div><span>Clean streak</span><strong>{persistence.stats.cleanStreak}</strong></div>
        <div><span>Best streak</span><strong>{persistence.stats.bestCleanStreak}</strong></div>
        <div><span>Best clean round</span><strong>{persistence.stats.bestCleanRound}</strong></div>
        <div><span>Fastest successful pace</span><strong>{persistence.stats.bestPaceSeconds ? `${persistence.stats.bestPaceSeconds}s` : "—"}</strong></div>
        <div><span>Most improved</span><strong>{mostImproved && mostImproved[1].score > mostImproved[1].previousScore ? mostImproved[0] : "Keep rating"}</strong></div>
        <div><span>Recoveries used</span><strong>{persistence.stats.recoveries}</strong></div>
      </section>

      <section className="trainer-insights panel" aria-label="Practice insights and data">
        <div className="trainer-daily-goal">
          <span className="label">Today&apos;s guided session</span><strong>{Math.min(dailyGoalMinutes, Math.floor(todayPractice.seconds / 60))}/{dailyGoalMinutes} min</strong>
          <progress max={dailyGoalMinutes * 60} value={Math.min(dailyGoalMinutes * 60, todayPractice.seconds)} />
          <small>{todayPractice.rounds} {todayPractice.rounds === 1 ? "round" : "rounds"} · {todayPractice.clean} clean changes</small>
        </div>
        <div className="trainer-chord-success">
          <span className="label">Current chord success (separate from transitions)</span>
          <strong>{currentChord?.name ?? "Select a chord"} · {chordAttempts ? `${Math.round((chordRecord!.clean / chordAttempts) * 100)}% clean` : "No ratings yet"}</strong>
          {chordRecord && <small>{chordRecord.clean} clean · {chordRecord.needsWork} needs work · {chordRecord.missed} missed</small>}
        </div>
        <div className="trainer-calendar" aria-label="Recent practice days">
          <span className="label">Practice calendar</span>
          <div>{Array.from({ length: 7 }, (_, offset) => {
            const date = new Date(); date.setDate(date.getDate() - (6 - offset));
            const key = localDateKey(date); const day = persistence.history.find((item) => item.date === key);
            return <span key={key} className={day ? "active" : ""} title={`${key}: ${day?.rounds ?? 0} rounds`}><small>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</small><strong>{day?.rounds ?? "·"}</strong></span>;
          })}</div>
        </div>
        <div className="trainer-data-actions"><button className="btn" type="button" onClick={exportTrainerData}>Export Trainer data</button><button className="btn ghost" type="button" onClick={resetTrainerData}>Reset Trainer data</button><small>Backups include capped local ratings, history, records, and notes.</small></div>
      </section>

      <section className="panel trainer-readiness" aria-label="Session readiness">
        <div className="panel-header"><div><p className="eyebrow">Session readiness</p><h2>Set up the guitar, the goal, and the room.</h2></div></div>
        <div className="trainer-readiness-grid">
          <article>
            <span className="label">Manual tuning self-check</span>
            <label>Tuning<select value={tuningId} onChange={(event) => { setTuningId(event.target.value as TuningId); setStringChecks(Array(6).fill(false)); }}><option value="standard">Standard</option><option value="dropD">Drop D</option><option value="dadgad">DADGAD</option><option value="openG">Open G</option><option value="custom">Custom label</option></select></label>
            {tuningId === "custom" && <label>Custom tuning label<input maxLength={60} value={customTuningLabel} onChange={(event) => setCustomTuningLabel(event.target.value)} placeholder="Open C variant" /></label>}
            <p><strong>{tuningLabel}</strong></p>
            <p className="trainer-not-detection">This is a listening checklist, not pitch detection. Compare each string with your own tuner or reference and mark it manually.</p>
            <div className="trainer-string-checks">{tuningNotes.map((note, index) => <label key={`${note}-${index}`}><input type="checkbox" checked={stringChecks[index]} onChange={(event) => setStringChecks((checks) => checks.map((checked, checkIndex) => checkIndex === index ? event.target.checked : checked))} /> String {index + 1}: {note}</label>)}</div>
            <progress max={6} value={stringChecks.filter(Boolean).length} /><small>{stringChecks.filter(Boolean).length}/6 manually checked</small>
          </article>
          <article className="trainer-next-card">
            <span className="label">What to practice next</span><h3>{sessionIntent === "rehearsal" ? "Rehearsal-ready route" : sessionIntent === "song" ? "Song-learning route" : "Barre-endurance route"}</h3><p>{whatNext}</p>
            <label>Capo reminder<select value={capoFret} onChange={(event) => setCapoFret(Number(event.target.value))}>{Array.from({ length: 13 }, (_, fret) => <option key={fret} value={fret}>{fret ? `Capo fret ${fret}` : "No capo"}</option>)}</select></label>
            <small>{drillMode === "song" && selectedSongSet ? `${selectedSongSet.title} · ${tuningLabel}${capoFret ? ` · capo ${capoFret}` : ""}` : `Current practice · ${tuningLabel}${capoFret ? ` · capo ${capoFret}` : ""}`}</small>
          </article>
          <article>
            <span className="label">One-minute benchmark</span><p>Start a real 60-second run inside the Trainer timer. Mark each clean shape and move on; only Clean ratings count.</p>
            <button className="btn primary" type="button" onClick={startBenchmark} disabled={settingsLocked}>Start 60-second benchmark</button>
            {benchmarkResult !== null && <strong className="trainer-benchmark-result">Latest result: {benchmarkResult} clean changes in 60 seconds</strong>}
          </article>
          <article>
            <span className="label">Barre relaxation</span><p>Use this short visual cue before a barre-heavy round: open the hand, soften the thumb, then settle lightly.</p><button className="btn" type="button" onClick={() => setStretchVisible((visible) => !visible)}>{stretchVisible ? "Hide stretch" : "Show stretch cue"}</button>
            {stretchVisible && <div className="trainer-stretch" role="img" aria-label="Gentle hand opening and relaxing animation"><span /><span /><span /><strong>Open · breathe · release</strong></div>}
          </article>
          <article className="trainer-waveform-card">
            <span className="label">Latest take vs rhythm reference</span><p>These bars are a visual timing prompt only. The recording is not analyzed.</p>
            <div className="trainer-wave-compare"><div><small>Static reference</small><div>{REFERENCE_WAVEFORM.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><div><small>Latest take placeholder</small><div>{latestTakeBars.length ? latestTakeBars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />) : <span>Record a take to show a non-analytical visual fingerprint.</span>}</div></div></div>
          </article>
          <article><span className="label">Adaptive rest-day advisory</span><p>{adaptiveRestAdvisory}</p><small>Based on at most 60 local practice days and 30 session notes.</small></article>
        </div>
        <div className="trainer-milestones"><span className="label">Personal milestones</span>{(Object.keys(MILESTONE_LABELS) as MilestoneId[]).map((id) => { const earned = persistence.milestones.find((item) => item.id === id); const copy = MILESTONE_LABELS[id]; return <article key={id} className={earned ? "earned" : "locked"}><strong>{copy.title}</strong><p>{copy.detail}</p><small>{earned ? `Earned ${earned.date}` : "Not earned yet"}</small></article>; })}</div>
      </section>

      <section className="panel trainer-practice-lab" aria-label="Practice lab">
        <div className="panel-header"><div><p className="eyebrow">Practice lab</p><h2>See the pattern, then solve the movement.</h2></div></div>
        <div className="trainer-transition-map">
          {(Object.keys(transitionMap) as TransitionBand[]).map((band) => <div key={band} className={`band-${band}`}><h3>{band}</h3>{transitionMap[band].length ? transitionMap[band].map(([key, record]) => <button type="button" key={key} onClick={() => { setReplayKey(key); setReplayStep(0); }}>{key}<small>{Math.round(record.score * 100)}%</small></button>) : <p>No tracked transitions yet.</p>}</div>)}
        </div>
        <div className="trainer-lab-grid">
          <article>
            <span className="label">Slow-motion replay</span>
            <label>Transition<select value={replayKey} onChange={(event) => { setReplayKey(event.target.value); setReplayStep(0); }}><option value="">Choose a weak transition</option>{replayKeys.map((key) => <option key={key}>{key}</option>)}</select></label>
            {replayTransition ? <><div className="trainer-replay-diagrams"><ChordDiagram chord={replayStep === 0 ? replayTransition.from : replayTransition.to} orientation={handedness} /></div><p>{replayStep === 0 ? `Set ${replayTransition.from.name} and release excess pressure.` : replayStep === 1 ? `${replayTransition.shared.length ? `Keep ${replayTransition.shared.length} shared fretted position(s) down.` : "Lift only as far as needed and keep fingertips over their destination."}` : `Land ${replayTransition.to.name} close behind each fret, then test every string.`}</p><div><button className="btn" type="button" onClick={() => setReplayStep((step) => Math.max(0, step - 1))} disabled={replayStep === 0}>Previous step</button><button className="btn" type="button" onClick={() => setReplayStep((step) => Math.min(2, step + 1))} disabled={replayStep === 2}>Next step</button></div></> : <p>Rate a few transitions to unlock a replay.</p>}
          </article>
          <article>
            <span className="label">Buzzing diagnostic</span>
            <label>Chord<select value={diagnosticChord?.name ?? ""} onChange={(event) => setDiagnosticChordName(event.target.value)}>{activeLevel.chords.map((chord) => <option key={chord.name}>{chord.name}</option>)}</select></label>
            <p>{diagnosticChord ? buzzingDiagnostic(diagnosticChord) : "Choose a supported chord."}</p>
            {capoAlternative ? <p><strong>Capo-aware option:</strong> {capoAlternative.label} — {capoAlternative.description}</p> : <p>No nearby capo alternative is documented for the current chord.</p>}
          </article>
          <article>
            <span className="label">Real-world outcome</span>
            <label>Goal<input maxLength={80} value={persistence.realWorldGoal.label} onChange={(event) => saveRealWorldGoal({ ...persistence.realWorldGoal, label: event.target.value })} /></label>
            <label>Target<select value={persistence.realWorldGoal.target} onChange={(event) => saveRealWorldGoal({ ...persistence.realWorldGoal, target: Number(event.target.value), progress: Math.min(persistence.realWorldGoal.progress, Number(event.target.value)) })}>{[1, 3, 5, 10].map((value) => <option key={value}>{value}</option>)}</select></label>
            <progress max={persistence.realWorldGoal.target} value={persistence.realWorldGoal.progress} />
            <div><button className="btn" type="button" onClick={() => saveRealWorldGoal({ ...persistence.realWorldGoal, progress: Math.max(0, persistence.realWorldGoal.progress - 1) })}>−</button><strong>{persistence.realWorldGoal.progress}/{persistence.realWorldGoal.target}</strong><button className="btn" type="button" onClick={() => saveRealWorldGoal({ ...persistence.realWorldGoal, progress: Math.min(persistence.realWorldGoal.target, persistence.realWorldGoal.progress + 1) })}>+</button></div>
          </article>
          <article>
            <span className="label">Teacher-share challenge</span>
            <p>Export or import a defensive, size-capped JSON file. No account, upload, or remote collaboration is used.</p>
            <div><button className="btn" type="button" onClick={exportTeacherChallenge}>Export challenge</button><button className="btn" type="button" onClick={() => challengeFileRef.current?.click()} disabled={settingsLocked}>Import challenge</button></div>
            <input ref={challengeFileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importTeacherChallenge(event.target.files?.[0])} />
            <small aria-live="polite">{shareMessage}</small>
          </article>
        </div>
      </section>

      <section className="panel trainer-companion" aria-label="Practice companion">
        <div className="panel-header">
          <div><p className="eyebrow">Practice companion</p><h2>Capture the attempt, spot the pattern, and leave with a plan.</h2></div>
          <button className="btn" type="button" onClick={() => window.print()}>Print practice sheet</button>
        </div>
        <div className="trainer-companion-grid">
          <article className="trainer-capture-card">
            <span className="label">Private two-take comparison</span>
            <p>Record up to 45 seconds or 8 MB. Takes stay only in this tab and are never uploaded.</p>
            <div className="trainer-inline-actions">
              <label>Capture<select value={captureKind} onChange={(event) => setCaptureKind(event.target.value as CaptureKind)} disabled={recording}><option value="audio">Audio</option><option value="video">Video + audio</option></select></label>
              <button className="btn primary" type="button" onClick={() => void startCapture()} disabled={recording}>{recording ? "Recording…" : "Start recording"}</button>
              <button className="btn" type="button" onClick={stopCapture} disabled={!recording}>Stop</button>
              <button className="btn ghost" type="button" onClick={clearTakes} disabled={!takes.length || recording}>Clear takes</button>
            </div>
            <small className="trainer-status-message" aria-live="polite">{captureMessage}</small>
            <div className="trainer-take-grid">
              {takes.length ? takes.map((take, index) => <div key={take.id}>
                <strong>Take {takes.length - index}</strong><small>{take.durationSeconds}s · {(take.bytes / 1_000_000).toFixed(1)} MB</small>
                {take.kind === "video" ? <video controls playsInline preload="metadata" src={take.url} /> : <audio controls preload="metadata" src={take.url} />}
              </div>) : <p>No local takes yet. Record twice to compare timing, clarity, and tension.</p>}
            </div>
          </article>

          <article>
            <span className="label">Mistake patterns</span>
            <p>Log what happened so recurring causes remain separate from chord accuracy.</p>
            <div className="trainer-check-list">{(Object.keys(MISTAKE_LABELS) as MistakePattern[]).map((key) => <label key={key}><input type="checkbox" checked={mistakeReport[key]} onChange={(event) => setMistakeReport((current) => ({ ...current, [key]: event.target.checked }))} /> {MISTAKE_LABELS[key]}</label>)}</div>
            <button className="btn" type="button" onClick={saveMistakeReport} disabled={!Object.values(mistakeReport).some(Boolean)}>Log selected patterns</button>
            <p className="trainer-pattern-summary"><strong>Most frequent:</strong> {mistakeRanking[0]?.[1] ? `${MISTAKE_LABELS[mistakeRanking[0][0]]} (${mistakeRanking[0][1]})` : "No patterns logged yet."}</p>
          </article>

          <article>
            <span className="label">Song readiness checklist</span>
            <label>Song or set<input key={persistence.readiness.label} defaultValue={persistence.readiness.label} maxLength={80} onBlur={(event) => updateReadinessLabel(event.target.value)} /></label>
            <div className="trainer-check-list">{([
              ["chords", "Chord shapes learned"], ["transitions", "Transitions clean"], ["rhythm", "Rhythm stable"], ["runThrough", "Full run-through complete"]
            ] as Array<[keyof SongReadiness["checks"], string]>).map(([key, label]) => <label key={key}><input type="checkbox" checked={persistence.readiness.checks[key]} onChange={(event) => updateReadiness(key, event.target.checked)} /> {label}</label>)}</div>
            <progress max={4} value={readinessDone} /><strong>{readinessDone}/4 ready</strong>
          </article>

          <article>
            <span className="label">Comfort check</span>
            <label>How does your playing hand feel?<select value={discomfort} onChange={(event) => {
              const next = event.target.value as typeof discomfort;
              setDiscomfort(next);
              if (next === "moderate" || next === "strong") {
                setRestPrompt("Discomfort marked. Stop, release the instrument, and rest before deciding whether to continue.");
                if (status === "running" || status === "countIn") pauseRound();
              }
            }}><option value="none">Comfortable</option><option value="mild">Mild discomfort</option><option value="moderate">Moderate discomfort</option><option value="strong">Strong discomfort</option></select></label>
            <p className={`trainer-comfort-guidance comfort-${discomfort}`}>{discomfortGuidance}</p>
            {discomfort !== "none" && <button className="btn" type="button" disabled={settingsLocked} onClick={() => { setPace(8); setRoundLength(5); setSilentPractice(true); setShareMessage("Loaded a five-change, silent, eight-second alternative."); }}>Load gentler alternative</button>}
          </article>

          <article>
            <span className="label">Teacher / coach notes</span>
            <textarea maxLength={1000} value={coachNotes} onChange={(event) => setCoachNotes(event.target.value)} placeholder="Focus cue, target tempo, or feedback for the next attempt…" />
            <div className="trainer-inline-actions"><button className="btn" type="button" onClick={exportTeacherChallenge}>Export challenge</button><button className="btn" type="button" onClick={prepareShareCode}>Prepare share visual</button></div>
            {shareCode && <div className="trainer-share-code">
              <svg viewBox="0 0 84 84" role="img" aria-label="Visual companion for the local challenge code"><title>Local challenge share visual</title><rect width="84" height="84" fill="white" />{shareBits.flatMap((row, rowIndex) => row.map((filled, columnIndex) => filled ? <rect key={`${rowIndex}-${columnIndex}`} x={columnIndex * 4} y={rowIndex * 4} width="4" height="4" fill="currentColor" /> : null))}</svg>
              <label>Text payload<textarea readOnly value={shareCode} onFocus={(event) => event.currentTarget.select()} /></label>
              <small>Share the text with the visual. Import continues to use the bounded challenge file.</small>
            </div>}
          </article>

          <article>
            <span className="label">Offline practice pack</span>
            <p>Download the current chord route, strumming cue, coach notes, tuning label ({tuningLabel}), and capo reminder for another offline session.</p>
            <div className="trainer-inline-actions"><button className="btn" type="button" onClick={downloadOfflinePack}>Download pack</button><button className="btn" type="button" onClick={() => offlinePackFileRef.current?.click()} disabled={settingsLocked}>Import pack</button></div>
            <input ref={offlinePackFileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importOfflinePack(event.target.files?.[0])} />
            <small>{shareMessage}</small>
          </article>

          <article className="trainer-skill-tree-card">
            <span className="label">Skill tree</span>
            <ol className="trainer-skill-tree">{skillTree.map((skill, index) => <li key={skill.label} className={skill.ready ? "ready" : "next"}><span>{index + 1}</span><strong>{skill.label}</strong><small>{skill.ready ? "Ready" : index === skillTree.findIndex((item) => !item.ready) ? "Next focus" : "Building"}</small></li>)}</ol>
            <p>{weakTransitionCount ? `${weakTransitionCount} weak transition${weakTransitionCount === 1 ? "" : "s"} currently feed adaptive rounds.` : "Rate transitions to make the pathway more personal."}</p>
          </article>

          <article>
            <span className="label">Session comparison</span>
            {previousSession ? <div className="trainer-session-compare"><span><small>Previous accuracy</small><strong>{previousSession.accuracy}%</strong></span><span><small>Pace</small><strong>{previousSession.pace ? `${previousSession.pace}s` : "Manual"}</strong></span><span><small>Confidence</small><strong>{previousSession.confidence}/5</strong></span><p>{previousSession.tension || "No tension note saved."}</p></div> : <p>Complete and save a round to create the first comparison.</p>}
            <label>Today&apos;s tension note<input maxLength={120} value={sessionTension} onChange={(event) => setSessionTension(event.target.value)} placeholder="Relaxed after the second transition" /></label>
            <button className="btn" type="button" onClick={saveSessionComparison} disabled={status !== "complete" || sessionSaved}>{sessionSaved ? "Session saved" : "Save completed session"}</button>
          </article>
        </div>
      </section>

      <section className="trainer-print-sheet" aria-label="Printable practice sheet">
        <header><p>Chord Hero · Practice sheet</p><h1>{roundConfig.drillLabel}</h1><span>{roundConfig.length} changes · {roundConfig.pace === "manual" ? "manual pace" : `${roundConfig.pace}s pace`} · {STRUMMING_PROMPTS[strummingPrompt]} · {tuningLabel}{capoFret ? ` · capo ${capoFret}` : " · no capo"}</span></header>
        <div className="trainer-print-chords">{practiceSheetChords.map((chord) => <article key={chord.name}><h2>{chord.name}</h2><ChordDiagram chord={chord} orientation={handedness} /></article>)}</div>
        <div className="trainer-print-goals"><h2>Goals</h2><p>☐ Clear shapes &nbsp; ☐ Clean transitions &nbsp; ☐ Steady rhythm &nbsp; ☐ Full run-through</p><h2>Coach notes</h2><p>{coachNotes || "________________________________________________________________________________"}</p><h2>Practice notes</h2><p>________________________________________________________________________________</p><p>________________________________________________________________________________</p></div>
      </section>

      <section className="trainer-review-grid">
        <div className="history">
          <div><h2>Chord history</h2><p>Ratings stay attached to the exact sequence item you played.</p></div>
          <div className="history-grid">
            {!history.length ? <div className="history-empty">No chords yet. Start a round to begin.</div> : history.map((chord, index) => (
              <button key={`${chord.name}-${index}`} className={`history-item ${selectedHistoryIndex === index ? "active" : ""}`} type="button" onClick={() => setSelectedHistoryIndex(index)} aria-label={`Inspect chord ${index + 1}, ${chord.name}${feedback[index] ? `, rated ${RATING_LABEL[feedback[index]]}` : ""}`}>
                <span className="history-count">{String(index + 1).padStart(2, "0")}</span><span className="history-name">{chord.name}</span>{feedback[index] && <span className={`history-rating rating-${feedback[index]}`}>{RATING_LABEL[feedback[index]]}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="selected">
          <div><h2>Selected chord</h2><p>Review any completed change without interrupting the round.</p></div>
          <div className="selected-card"><div className="selected-info"><span className="label">Selected</span><h3>{selectedChord?.name ?? "None yet"}</h3></div><div className="diagram-wrap">{selectedChord ? <ChordDiagram chord={selectedChord} largeChart={largeDiagrams} orientation={handedness} /> : <div className="diagram-empty" />}</div></div>
        </div>
      </section>

      {status === "complete" && (
        <div className="modal trainer-recap-modal" role="dialog" aria-modal="true" aria-labelledby="trainer-recap-title">
          <div className="modal-card">
            <span className="modal-badge">Round recap</span><h2 id="trainer-recap-title">Practice complete</h2>
            <div className="trainer-recap-counts"><span><strong>{feedbackSummary.clean}</strong> Clean</span><span><strong>{feedbackSummary.needsWork}</strong> Needs work</span><span><strong>{feedbackSummary.missed}</strong> Missed</span></div>
            <p><strong>{roundConfig.drillLabel}</strong> · {roundConfig.pace === "manual" ? "Manual pace" : `${roundConfig.pace}s base pace`} · {roundConfig.length} chords</p>
            <div className="trainer-confidence-recap"><span>Before: <strong>{preConfidence}/5</strong></span><label>After<select value={postConfidence} onChange={(event) => setPostConfidence(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label><span>Change: <strong>{postConfidence - preConfidence > 0 ? "+" : ""}{postConfidence - preConfidence}</strong></span></div>
            {flaggedTransitions.length > 0 && <div className="trainer-flagged"><span className="label">Flagged transitions</span><ul>{flaggedTransitions.map((item, index) => <li key={`${item.key}-${index}`}>{item.key} — {RATING_LABEL[item.rating]}</li>)}</ul></div>}
            <p className="trainer-recommendation"><strong>Recommended next:</strong> {recommendedAction}</p>
            <p><strong>Recoveries:</strong> {roundRecoveries}{transitionGoalOn ? ` · ${effectiveGoalFrom} → ${effectiveGoalTo}: ${transitionGoalProgress}/${transitionGoalTarget} clean reps` : ""}</p>
            <label className="trainer-round-note">Post-round note<textarea value={roundNote} maxLength={500} onChange={(event) => { setRoundNote(event.target.value); setNoteSaved(false); }} placeholder="What felt tense? What changed cleanly?" /></label>
            <button className="btn" type="button" onClick={saveRoundNote} disabled={!roundNote.trim() || noteSaved}>{noteSaved ? "Note saved" : "Save note locally"}</button>
            <div className="modal-actions"><button className="btn primary" onClick={resetRound}>Adjust and practice again</button><button className="btn ghost" onClick={resetRound}>Close recap</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
