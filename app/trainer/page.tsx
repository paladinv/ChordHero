"use client";

import LocalizedCopy from "../../components/LocalizedCopy";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../../lib/localeClient";
import ChordDiagram, { Chord } from "../../components/ChordDiagram";
import { CHORD_ITEM_LOOKUP, CHORD_LIBRARY, CHORD_LOOKUP, LEVELS } from "../../lib/chords";
import { playRecordedClick } from "../../lib/recordedAudio";
import { assistanceStage, compareRoundContexts, evidenceLabel, shapeSignature } from "../../lib/trainerClarity";
import { buildNeckLadder, compareTransitionRatings, crossDayConsistency, GrowthCriteria, GrowthRound, namedSectionChunk, shapeFitsPosition, sharedFrettedPositions, transitionBreakdown } from "../../lib/trainerGrowth";
import { previousComparableBenchmark, retentionComparison as compareRetention } from "../../lib/trainerEvidence";
import { adaptTrainerPace } from "../../lib/trainerAdaptive";
const DeferredDetails = dynamic(() => import("../../components/DeferredDetails"), { ssr: false });
const LazyTrainerEvidence = dynamic(() => import("../../components/TrainerEvidenceComparisons"), { ssr: false });
const LazyMissTags = dynamic(() => import("../../components/TrainerSelfReportTools").then((m) => m.MissTagPicker), { ssr: false });
const LazyTransitionProbe = dynamic(() => import("../../components/TrainerSelfReportTools").then((m) => m.TransitionProbe), { ssr: false });
const LazyBenchmarkResult = dynamic(() => import("../../components/TrainerSelfReportTools").then((m) => m.BenchmarkResult), { ssr: false });
const LazyRetentionResult = dynamic(() => import("../../components/TrainerSelfReportTools").then((m) => m.RetentionResult), { ssr: false });
const LazyTrainerCompanionPanel = dynamic(() => import("../../components/TrainerCompanionPanel"), { ssr: false });
const LazyTrainerDelayedRecall = dynamic(() => import("../../components/TrainerDelayedRecall"), { ssr: false });

type TrainerStatus = "idle" | "preview" | "countIn" | "running" | "paused" | "complete";
type FeedbackRating = "clean" | "missed" | "needsWork";
type DrillMode = "random" | "barre" | "pair" | "progression" | "song" | "family" | "keepFingers" | "genre" | "surprise" | "rhythmOnly" | "neckLadder";
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
type TransitionTension = "relaxed" | "tense";
type MissTag = "late" | "muted" | "fingerMovement" | "tensionFatigue";
type RecoveryMethod = "rest" | "slowerPace" | "focusedDrill";
type VoicingLock = "any" | "open" | "closed";
type InstrumentProfile = "acoustic" | "electric" | "classical" | "reducedString";
type CurriculumId = "firstChords" | "rhythmBuilder" | "barreReady" | "performanceReady";
type VocabularyPrompt = "name" | "diagram" | "function" | "sound";
type CameraAngle = "fretting" | "strumming" | "neck";
type RescueScenario = "lostPlace" | "badChange" | "brokenRhythm" | "restart";
type EffortRating = "comfortable" | "working" | "exhausting";
type NeckPositionLock = "off" | "open" | "low" | "mid" | "high" | "custom";
type TimelineEventKind = "practice" | "pause" | "resume" | "recover" | "finish";
type ShapeExclusion = { key: string; libraryId: string; harmony: string; label: string; date: string; replacementId?: string };
type FavoriteSetup = { id: string; name: string; setup: TrainerSetup };
type RoundEvidence = { id: string; sessionId: string; date: string; rated: number; accuracy: number; pace: Pace; effort: EffortRating | null; fresh: number | null; repeat: number | null; freshClean?: number | null; repeatClean?: number | null };
type TimelineEvent = { id: string; kind: TimelineEventKind; at: number; durationSeconds?: number; detail?: string; sessionId?: string };

type TransitionRecipe = {
  id: string;
  name: string;
  from: string;
  to: string;
  pace: Pace;
  tuning: string;
  capo: number;
  strum: StrummingPrompt;
  notes: string;
};

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
type PerformanceReflection = { id: string; date: string; wentWell: string; lostTime: string; revisitTransition: string };
type DatedPracticeGoal = { date: string; label: string } | null;
type ProgressSnapshot = { id: string; date: string; period: "week" | "month"; accuracy: number; clean: number; pace: number | null; confidence: number; readiness: number };
type SpeedLadder = { unlockedIndex: number; cleanRoundsAtRung: number };
type RecorderTake = { id: string; kind: CaptureKind; url: string; createdAt: number; durationSeconds: number; bytes: number };
type Milestone = { id: MilestoneId; date: string };
type RehearsalNote = { id: string; date: string; section: RehearsalSection; transition: string; note: string };
type RecoveryEntry = { id: string; date: string; method: RecoveryMethod; outcome: string; pace: number | null };
type AchievementSettings = { enabled: boolean; cleanRound: boolean; mastery: boolean; streak: boolean };
type TransitionMastery = { key: string; streak: number; mastered: boolean };
type TrainerSetup = {
  level: number;
  drill: DrillMode;
  pairFrom: string;
  pairTo: string;
  keepFrom: string;
  keepTo: string;
  progression: ProgressionId;
  family: ChordFamily;
  songId: string;
  pace: Pace;
  length: number;
  rhythm: boolean;
  bpm: number;
  strum: StrummingPrompt;
  genre: GenrePackId;
  randomKey: boolean;
  warmUp: boolean;
  tuning: TuningId;
  customTuning: string;
  capo: number;
  orientation: Handedness;
  neckLock: NeckPositionLock;
  customNeckMin: number;
  customNeckMax: number;
  landingCheckpoint: boolean;
};
type RoundClarityContext = { version: 1; shapeSignature: string; assistance: "off" | "stage1" | "stage2" | "legacy"; assistanceTrail: string; challenge: ChallengeMode; diagram: "full" | "light"; diagramVisibility: "visible" | "minimal"; preview: boolean; landing: boolean; warmUp: boolean; adaptive: boolean; adaptivePace: string; rhythm: boolean; bpm: number | null; tuning: string; capo: number; instrumentProfile?: string; position?: string; setupKnown?: boolean };
type CompletedRound = GrowthRound & { id: string; date: string; drill: string; song: string; pace: Pace; note: string; sequence: string[]; ratings: { clean: number; missed: number; needsWork: number }; sessionId?: string; effort?: EffortRating | null; freshCount?: number | null; repeatCount?: number | null; freshClean?: number | null; repeatClean?: number | null; ratedCoverage?: number; tensionChecks?: Record<number, TransitionTension>; missTags?: Record<number, MissTag[]>; retentionSourceId?: string; retentionIntervalDays?: 1 | 7; clarity?: RoundClarityContext };
type RetentionEntry = { id: string; due: string; label: string; setup: TrainerSetup; sourceId?: string; intervalDays?: 1 | 7; sequence?: string[]; shapeIds?: string[]; pace?: number };
type InterruptedRound = { sequence: string[]; shapeIds?: string[]; currentIndex: number; feedback: Record<number, FeedbackRating>; secondsLeft: number; remainingMs: number; elapsedSeconds: number; config: RoundConfig; setup: TrainerSetup; roundId: string; savedAt: number; pausedFrom: "countIn" | "running"; countInBeat: number; exposureTransitions?: string[]; exposureRecovered?: number[]; exposureKinds?: Record<number, "fresh" | "repeat">; freshCount?: number; repeatCount?: number; freshClean?: number; repeatClean?: number; effort?: EffortRating | null; placementConfirmed?: boolean };
type UndoSnapshot = {
  persistence: TrainerPersistence;
  feedback: Record<number, FeedbackRating>;
  index: number;
  rated: Set<number>;
  runtimePace: number;
  status: TrainerStatus;
  completed: boolean;
  key: string;
  chordName: string;
  transitionBefore: TransitionRecord | null;
  chordBefore: ChordRecord | null;
  statsBefore: TrainerStats;
  historyBefore: PracticeDay[];
  snapshotsBefore: ProgressSnapshot[];
  speedLadderBefore: SpeedLadder;
  milestonesBefore: Milestone[];
  completedRoundsBefore: CompletedRound[];
  interruptedBefore: InterruptedRound | null;
  cleanRecovery: number;
  consecutiveMisses: number;
  roundRecoveries: number;
  microGoalProgress: number;
  transitionGoalProgress: number;
  restPrompt: string;
  rebuildPrompt: { index: number; beat: number; rejoin: "current" | "next" };
  resumeRemaining: number | null;
  remainingMs: number;
  benchmarkClean: number;
  freshBefore: number;
  repeatBefore: number;
  effortBefore: EffortRating | null;
  exposuresBefore: string[];
  recoveredBefore: number[];
  freshCleanBefore: number;
  repeatCleanBefore: number;
  exposureKindsBefore: Record<number, "fresh" | "repeat">;
  roundEvidenceBefore: RoundEvidence[];
  timelineBefore: TimelineEvent[];
};

type TrainerPersistence = {
  version: 10;
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
  performanceReflections: PerformanceReflection[];
  datedPracticeGoal: DatedPracticeGoal;
  snapshots: ProgressSnapshot[];
  speedLadder: SpeedLadder;
  milestones: Milestone[];
  performanceChecklist: Record<ChecklistKey, boolean>;
  rehearsalNotes: RehearsalNote[];
  recoveryHistory: RecoveryEntry[];
  achievementSettings: AchievementSettings;
  mastery: TransitionMastery;
  recipes: TransitionRecipe[];
  instrumentProfile: InstrumentProfile;
  cloudBackupConsent: boolean;
  lastSetup: TrainerSetup | null;
  interruptedRound: InterruptedRound | null;
  completedRounds: CompletedRound[];
  retentionQueue: RetentionEntry[];
  onboardingComplete: boolean;
  favorites: FavoriteSetup[];
  shapeExclusions: ShapeExclusion[];
  roundEvidence: RoundEvidence[];
  timeline: TimelineEvent[];
  trainerSessionId: string;
  preferredShapes: Record<string, string>;
  benchmarkRoute?: string[];
};

type RoundConfig = {
  length: number;
  pace: Pace;
  drillLabel: string;
  pacePlan: number[];
};

type SongSet = { id: string; title: string; chords: Chord[]; route?: Chord[] };

const SECTION_PACE_STORAGE_KEY = "chord-hero.trainer.section-paces.v1";
const DEFAULT_SECTION_PACES: Record<RehearsalSection, number> = { verse: 5, chorus: 4, bridge: 6, turnaround: 6 };

const STORAGE_KEY = "chord-hero.trainer.v1";
const DEFAULT_STATS: TrainerStats = {
  cleanStreak: 0,
  bestCleanStreak: 0,
  bestCleanRound: 0,
  bestPaceSeconds: null,
  recoveries: 0
};
const DEFAULT_PERSISTENCE: TrainerPersistence = {
  version: 10,
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
  performanceReflections: [],
  datedPracticeGoal: null,
  snapshots: [],
  speedLadder: { unlockedIndex: 0, cleanRoundsAtRung: 0 },
  milestones: [],
  performanceChecklist: { tuning: false, capo: false, warmUp: false, songOrder: false, difficultTransition: false },
  rehearsalNotes: [],
  recoveryHistory: [],
  achievementSettings: { enabled: true, cleanRound: true, mastery: true, streak: true },
  mastery: { key: "", streak: 0, mastered: false },
  recipes: [],
  instrumentProfile: "acoustic",
  cloudBackupConsent: false,
  lastSetup: null,
  interruptedRound: null,
  completedRounds: [],
  retentionQueue: [],
  onboardingComplete: false,
  favorites: [],
  shapeExclusions: [],
  roundEvidence: [],
  timeline: [],
  trainerSessionId: "",
  preferredShapes: {}, benchmarkRoute: undefined
};

const LazyGuitarTechnique3D=dynamic(()=>import("../../components/GuitarTechnique3D"),{
  ssr: false,
  loading: () => <div className="trainer-3d-loading" role="status">Loading the local 3D hand engine…</div>
});
const LazySectionDrillControls=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.SectionDrillControls),{ssr:false})
const LazyPositionQuizCard=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.PositionQuizCard),{ssr:false})
const LazyHistoryPanel=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.HistoryPanel),{ssr:false})
const LazyTransitionTensionCheck=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.TransitionTensionCheck),{ssr:false})
const LazySectionCheckpoint=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.SectionCheckpoint),{ssr:false})
const LazyVoicePromptToggle=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.VoicePromptToggle),{ssr:false})
const LazyTensionSummary=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.TensionSummary),{ssr:false})
const LazySectionPreviewCheckpoint=dynamic(()=>import("../../components/TrainerOptionalTools").then(m=>m.SectionPreviewCheckpoint),{ssr:false})
const LazyConfidenceControl=dynamic(()=>import("../../components/TrainerGrowthTools").then(m=>m.ConfidenceControl),{ssr:false})
const LazyTransitionCriteria=dynamic(()=>import("../../components/TrainerGrowthTools").then(m=>m.TransitionCriteria),{ssr:false})
const LazySetRevisionControl=dynamic(()=>import("../../components/TrainerGrowthTools").then(m=>m.SetRevisionControl),{ssr:false})
const LazyIssueFocus=dynamic(()=>import("../../components/TrainerGrowthTools").then(m=>m.IssueFocus),{ssr:false})
const LazyFingerPlacementGuide=dynamic(()=>import("../../components/TrainerGrowthTools").then(m=>m.FingerPlacementGuide),{ssr:false})
const LazyRoundGrowthRecap=dynamic(()=>import("../../components/TrainerGrowthTools").then(m=>m.RoundGrowthRecap),{ssr:false})
const LazyRecommendationEvidence=dynamic(()=>import("../../components/TrainerSummaryCards").then(m=>m.RecommendationEvidence),{ssr:false})
const LazyStartHereCard=dynamic(()=>import("../../components/TrainerSummaryCards").then(m=>m.StartHereCard),{ssr:false})
const LazyPracticeEvidenceStrip=dynamic(()=>import("../../components/TrainerSummaryCards").then(m=>m.PracticeEvidenceStrip),{ssr:false})

const INSTRUMENT_PROFILES: Record<InstrumentProfile, { label: string; detail: string; strings: number }> = {
  acoustic: { label: "Acoustic guitar", detail: "Balanced open-chord movement and medium string spacing.", strings: 6 },
  electric: { label: "Electric guitar", detail: "Lighter pressure cues and compact closed-position shapes.", strings: 6 },
  classical: { label: "Classical guitar", detail: "Wider-neck spacing with thumb and wrist alignment reminders.", strings: 6 },
  reducedString: { label: "Reduced-string guitar", detail: "Focuses prompts on the first four available strings.", strings: 4 }
};

const CURRICULA: Record<CurriculumId, { label: string; steps: string[]; preset: { drill: DrillMode; pace: Pace; length: number } }> = {
  firstChords: { label: "First open chords", steps: ["Clear single shapes", "Two-chord changes", "Steady four-beat loop"], preset: { drill: "pair", pace: 8, length: 5 } },
  rhythmBuilder: { label: "Rhythm builder", steps: ["Down-strum pulse", "Down-up control", "Progression without stopping"], preset: { drill: "rhythmOnly", pace: 4, length: 10 } },
  barreReady: { label: "Barre foundation", steps: ["Relaxed index placement", "Partial barre", "Barre transitions"], preset: { drill: "barre", pace: 6, length: 5 } },
  performanceReady: { label: "Performance ready", steps: ["Targeted weak changes", "Song-section run", "No-prompt graduation"], preset: { drill: "song", pace: 3, length: 20 } }
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

function sanitizeTrainerSetup(raw: unknown, fallback: TrainerSetup): TrainerSetup | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<TrainerSetup>;
  const drills: DrillMode[] = ["random", "barre", "pair", "progression", "song", "family", "keepFingers", "genre", "surprise", "rhythmOnly", "neckLadder"];
  if (!drills.includes(value.drill as DrillMode)) return null;
  return {
    level: Math.round(clampNumber(value.level, 0, Math.max(0, LEVELS.length - 1), fallback.level)), drill: value.drill as DrillMode,
    pairFrom: typeof value.pairFrom === "string" ? value.pairFrom.slice(0, 24) : fallback.pairFrom,
    pairTo: typeof value.pairTo === "string" ? value.pairTo.slice(0, 24) : fallback.pairTo,
    keepFrom: typeof value.keepFrom === "string" ? value.keepFrom.slice(0, 24) : fallback.keepFrom,
    keepTo: typeof value.keepTo === "string" ? value.keepTo.slice(0, 24) : fallback.keepTo,
    progression: ["oneFiveSixFour", "blues", "folk", "pop", "jazz"].includes(String(value.progression)) ? value.progression as ProgressionId : fallback.progression,
    family: ["majorMinor", "seventh", "suspended", "power"].includes(String(value.family)) ? value.family as ChordFamily : fallback.family,
    songId: typeof value.songId === "string" ? value.songId.slice(0, 100) : fallback.songId,
    pace: value.pace === "manual" ? "manual" : clampNumber(value.pace, 2, 8, typeof fallback.pace === "number" ? fallback.pace : 3),
    length: [5, 10, 20].includes(Number(value.length)) ? Number(value.length) : fallback.length,
    rhythm: value.rhythm === true, bpm: clampNumber(value.bpm, 40, 120, fallback.bpm),
    strum: Object.prototype.hasOwnProperty.call(STRUMMING_PROMPTS, String(value.strum)) ? value.strum as StrummingPrompt : fallback.strum,
    genre: ["acousticPop", "blues", "rock", "jazz", "worship"].includes(String(value.genre)) ? value.genre as GenrePackId : fallback.genre,
    randomKey: value.randomKey === true,
    warmUp: value.warmUp === true,
    tuning: ["standard", "dropD", "dadgad", "openG", "custom"].includes(String(value.tuning)) ? value.tuning as TuningId : fallback.tuning,
    customTuning: typeof value.customTuning === "string" ? value.customTuning.slice(0, 60) : fallback.customTuning,
    capo: clampNumber(value.capo, 0, 12, fallback.capo), orientation: value.orientation === "left" ? "left" : value.orientation === "right" ? "right" : fallback.orientation,
    neckLock: ["off", "open", "low", "mid", "high", "custom"].includes(String(value.neckLock)) ? value.neckLock as NeckPositionLock : fallback.neckLock,
    customNeckMin: Math.round(clampNumber(value.customNeckMin, 0, 20, fallback.customNeckMin)),
    customNeckMax: Math.round(clampNumber(value.customNeckMax, 0, 20, fallback.customNeckMax)),
    landingCheckpoint: value.landingCheckpoint === true
  };
}

function parsePersistence(raw: string | null): TrainerPersistence {
  if (!raw || raw.length > 1_000_000) return DEFAULT_PERSISTENCE;
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
        const allowedDrills: DrillMode[] = ["random", "barre", "pair", "progression", "song", "family", "keepFingers", "genre", "surprise", "rhythmOnly", "neckLadder"];
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
    const performanceReflections = Array.isArray(source.performanceReflections) ? source.performanceReflections.slice(0, 30).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<PerformanceReflection>;
      if (typeof item.id !== "string" || typeof item.date !== "string" || typeof item.wentWell !== "string" || typeof item.lostTime !== "string" || typeof item.revisitTransition !== "string") return [];
      return [{ id: item.id.slice(0, 80), date: item.date.slice(0, 10), wentWell: item.wentWell.slice(0, 300), lostTime: item.lostTime.slice(0, 300), revisitTransition: item.revisitTransition.slice(0, 80) }];
    }) : [];
    const datedGoalSource = source.datedPracticeGoal && typeof source.datedPracticeGoal === "object" ? source.datedPracticeGoal : null;
    const datedPracticeGoal: DatedPracticeGoal = datedGoalSource && typeof datedGoalSource.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datedGoalSource.date) && typeof datedGoalSource.label === "string"
      ? { date: datedGoalSource.date, label: datedGoalSource.label.trim().slice(0, 120) }
      : null;
    const snapshots = Array.isArray(source.snapshots) ? source.snapshots.slice(0, 48).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<ProgressSnapshot>;
      if (typeof item.id !== "string" || typeof item.date !== "string" || (item.period !== "week" && item.period !== "month")) return [];
      return [{ id: item.id.slice(0, 80), date: item.date.slice(0, 10), period: item.period, accuracy: clampNumber(item.accuracy, 0, 100, 0), clean: clampNumber(item.clean, 0, 1_000_000, 0), pace: item.pace === null ? null : clampNumber(item.pace, 2, 8, 3), confidence: clampNumber(item.confidence, 0, 100, 0), readiness: clampNumber(item.readiness, 0, 5, 0) }];
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
    const recipes = Array.isArray(source.recipes) ? source.recipes.slice(0, 20).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<TransitionRecipe>;
      if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.from !== "string" || typeof item.to !== "string" || typeof item.tuning !== "string" || typeof item.notes !== "string") return [];
      const recipePace: Pace = item.pace === "manual" ? "manual" : clampNumber(item.pace, 2, 8, 3);
      const recipeStrum = Object.prototype.hasOwnProperty.call(STRUMMING_PROMPTS, String(item.strum)) ? item.strum as StrummingPrompt : "none";
      return [{ id: item.id.slice(0, 80), name: item.name.trim().slice(0, 60), from: item.from.slice(0, 24), to: item.to.slice(0, 24), pace: recipePace, tuning: item.tuning.slice(0, 60), capo: clampNumber(item.capo, 0, 12, 0), strum: recipeStrum, notes: item.notes.slice(0, 300) }];
    }) : [];
    const instrumentIds: InstrumentProfile[] = ["acoustic", "electric", "classical", "reducedString"];
    const instrumentProfile = instrumentIds.includes(source.instrumentProfile as InstrumentProfile) ? source.instrumentProfile as InstrumentProfile : "acoustic";
    const cloudBackupConsent = source.cloudBackupConsent === true;
    const setupSource = source.lastSetup && typeof source.lastSetup === "object" ? source.lastSetup as Partial<TrainerSetup> : null;
    const validDrills: DrillMode[] = ["random", "barre", "pair", "progression", "song", "family", "keepFingers", "genre", "surprise", "rhythmOnly", "neckLadder"];
    const setup: TrainerSetup | null = setupSource && validDrills.includes(setupSource.drill as DrillMode)
      ? {
          level: Math.round(clampNumber(setupSource.level, 0, Math.max(0, LEVELS.length - 1), 0)),
          drill: setupSource.drill as DrillMode,
          pairFrom: typeof setupSource.pairFrom === "string" ? setupSource.pairFrom.slice(0, 24) : "",
          pairTo: typeof setupSource.pairTo === "string" ? setupSource.pairTo.slice(0, 24) : "",
          keepFrom: typeof setupSource.keepFrom === "string" ? setupSource.keepFrom.slice(0, 24) : "",
          keepTo: typeof setupSource.keepTo === "string" ? setupSource.keepTo.slice(0, 24) : "",
          progression: ["oneFiveSixFour", "blues", "folk", "pop", "jazz"].includes(String(setupSource.progression)) ? setupSource.progression as ProgressionId : "oneFiveSixFour",
          family: ["majorMinor", "seventh", "suspended", "power"].includes(String(setupSource.family)) ? setupSource.family as ChordFamily : "majorMinor",
          songId: typeof setupSource.songId === "string" ? setupSource.songId.slice(0, 100) : "",
          pace: setupSource.pace === "manual" ? "manual" : clampNumber(setupSource.pace, 2, 8, 3),
          length: [5, 10, 20].includes(Number(setupSource.length)) ? Number(setupSource.length) : 10,
          rhythm: setupSource.rhythm === true,
          bpm: clampNumber(setupSource.bpm, 40, 120, 60),
          strum: Object.prototype.hasOwnProperty.call(STRUMMING_PROMPTS, String(setupSource.strum)) ? setupSource.strum as StrummingPrompt : "none",
          genre: ["acousticPop", "blues", "rock", "jazz", "worship"].includes(String(setupSource.genre)) ? setupSource.genre as GenrePackId : "acousticPop",
          randomKey: setupSource.randomKey === true,
          warmUp: setupSource.warmUp === true,
          tuning: ["standard", "dropD", "dadgad", "openG", "custom"].includes(String(setupSource.tuning)) ? setupSource.tuning as TuningId : "standard",
          customTuning: typeof setupSource.customTuning === "string" ? setupSource.customTuning.slice(0, 60) : "My tuning",
          capo: clampNumber(setupSource.capo, 0, 12, 0),
          orientation: setupSource.orientation === "left" ? "left" : "right",
          neckLock: ["off", "open", "low", "mid", "high", "custom"].includes(String(setupSource.neckLock)) ? setupSource.neckLock as NeckPositionLock : "off",
          customNeckMin: Math.round(clampNumber(setupSource.customNeckMin, 0, 20, 0)),
          customNeckMax: Math.round(clampNumber(setupSource.customNeckMax, 0, 20, 12)),
          landingCheckpoint: setupSource.landingCheckpoint === true
        }
      : null;
    const completedRounds: CompletedRound[] = Array.isArray(source.completedRounds) ? source.completedRounds.slice(0, 100).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<CompletedRound>;
      if (typeof item.id !== "string" || typeof item.date !== "string" || typeof item.drill !== "string" || !Array.isArray(item.sequence)) return [];
      const ratings = item.ratings && typeof item.ratings === "object" ? item.ratings as Partial<CompletedRound["ratings"]> : {};
      const nullableCount = (value: unknown) => value === null || value === undefined ? null : clampNumber(value, 0, 100, 0);
      const effort = ["comfortable", "working", "exhausting"].includes(String(item.effort)) ? item.effort as EffortRating : null;
      const rawClarity = item.clarity && typeof item.clarity === "object" ? item.clarity as Partial<RoundClarityContext> : null;
      const clarity: RoundClarityContext | undefined = rawClarity && typeof rawClarity.shapeSignature === "string" ? {
        version: 1,
          shapeSignature: rawClarity.shapeSignature.slice(0, 8192),
        assistance: rawClarity.assistance === "stage1" || rawClarity.assistance === "stage2" || rawClarity.assistance === "off" ? rawClarity.assistance : "legacy",
        assistanceTrail: typeof rawClarity.assistanceTrail === "string" ? rawClarity.assistanceTrail.slice(0, 2400) : "",
        challenge: rawClarity.challenge ?? "standard",
        diagram: rawClarity.diagram === "light" ? "light" : "full",
        diagramVisibility: rawClarity.diagramVisibility === "minimal" ? "minimal" : "visible",
        preview: rawClarity.preview === true,
        landing: rawClarity.landing === true,
        warmUp: rawClarity.warmUp === true,
          adaptive: rawClarity.adaptive === true,
          adaptivePace: typeof rawClarity.adaptivePace === "string" ? rawClarity.adaptivePace.slice(0, 160) : "",
        rhythm: rawClarity.rhythm === true,
        bpm: typeof rawClarity.bpm === "number" ? clampNumber(rawClarity.bpm, 40, 120, 60) : null,
        tuning: typeof rawClarity.tuning === "string" ? rawClarity.tuning.slice(0, 40) : "standard",
        capo: clampNumber(rawClarity.capo, 0, 12, 0),
        instrumentProfile: typeof rawClarity.instrumentProfile === "string" ? rawClarity.instrumentProfile.slice(0, 32) : undefined,
        position: typeof rawClarity.position === "string" ? rawClarity.position.slice(0, 32) : undefined,
        setupKnown: typeof rawClarity.tuning === "string" && typeof rawClarity.capo === "number" && typeof rawClarity.challenge === "string" && typeof rawClarity.instrumentProfile === "string" && typeof rawClarity.position === "string"
      } : undefined;
      return [{
        id: item.id.slice(0, 80),
        date: item.date.slice(0, 10),
        drill: item.drill.slice(0, 80),
        song: typeof item.song === "string" ? item.song.slice(0, 100) : "",
        pace: item.pace === "manual" ? "manual" : clampNumber(item.pace, 2, 8, 3),
        note: typeof item.note === "string" ? item.note.slice(0, 120) : "",
        sequence: item.sequence.slice(0, 40).filter((name): name is string => typeof name === "string").map((name) => name.slice(0, 24)),
        ratings: { clean: clampNumber(ratings.clean, 0, 100, 0), missed: clampNumber(ratings.missed, 0, 100, 0), needsWork: clampNumber(ratings.needsWork, 0, 100, 0) },
        sessionId: typeof item.sessionId === "string" ? item.sessionId.slice(0, 80) : undefined,
        effort,
        freshCount: nullableCount(item.freshCount),
        repeatCount: nullableCount(item.repeatCount),
        freshClean: nullableCount(item.freshClean),
        repeatClean: nullableCount(item.repeatClean),
        ratedCoverage: clampNumber(item.ratedCoverage, 0, 100, 0),
        shapeIds: Array.isArray(item.shapeIds) ? item.shapeIds.slice(0, 40).filter((id): id is string => typeof id === "string").map((id) => id.slice(0, 100)) : undefined,
        missTags: item.missTags && typeof item.missTags === "object" ? Object.fromEntries(Object.entries(item.missTags).slice(0, 40).flatMap(([index, values]) => { const i = Number(index); if (!Number.isInteger(i) || i < 0 || i > 39 || !Array.isArray(values)) return []; const tags = [...new Set(values.filter((tag): tag is MissTag => ["late", "muted", "fingerMovement", "tensionFatigue"].includes(String(tag))))].slice(0, 4); return tags.length ? [[i, tags]] : []; })) as Record<number, MissTag[]> : undefined,
        retentionSourceId: typeof item.retentionSourceId === "string" ? item.retentionSourceId.slice(0, 80) : undefined,
        retentionIntervalDays: item.retentionIntervalDays === 1 || item.retentionIntervalDays === 7 ? item.retentionIntervalDays : undefined,
        tensionChecks: item.tensionChecks && typeof item.tensionChecks === "object"
          ? Object.fromEntries(Object.entries(item.tensionChecks).slice(0, 40).flatMap(([key, value]) => value === "relaxed" || value === "tense" ? [[key, value]] : [])) as Record<number, TransitionTension>
          : undefined,
        clarity,
        predictedCleanRate: typeof item.predictedCleanRate === "number" ? Math.round(clampNumber(item.predictedCleanRate, 0, 100, 0) / 10) * 10 : null,
        criteria: Array.isArray(item.criteria) ? item.criteria.slice(0, 3).filter((value): value is GrowthCriteria => ["buzzFree", "stringsClear", "onBeat"].includes(String(value))) : undefined,
        criteriaChecks: item.criteriaChecks && typeof item.criteriaChecks === "object" ? Object.fromEntries(Object.entries(item.criteriaChecks).slice(0, 40).flatMap(([index, value]) => { const n = Number(index); if (!Number.isInteger(n) || n < 0 || n > 39 || !value || typeof value !== "object") return []; const checks = Object.fromEntries(Object.entries(value).filter(([key, flag]) => ["buzzFree", "stringsClear", "onBeat"].includes(key) && typeof flag === "boolean")); return Object.keys(checks).length ? [[n, checks]] : []; })) : undefined,
        transitionResults: Array.isArray(item.transitionResults) ? item.transitionResults.slice(0, 40).flatMap((result) => result && typeof result.key === "string" && ["clean", "needsWork", "missed"].includes(String(result.rating)) ? [{ key: result.key.slice(0, 120), rating: result.rating }] : []) : undefined
      }];
    }) : [];
    const fallbackSetup: TrainerSetup = setup ?? { level: 0, drill: "random", pairFrom: "", pairTo: "", keepFrom: "", keepTo: "", progression: "oneFiveSixFour", family: "majorMinor", songId: "", pace: 3, length: 10, rhythm: false, bpm: 60, strum: "none", genre: "acousticPop", randomKey: false, warmUp: false, tuning: "standard", customTuning: "My tuning", capo: 0, orientation: "right", neckLock: "off", customNeckMin: 0, customNeckMax: 12, landingCheckpoint: false };
    const draftSource = source.interruptedRound && typeof source.interruptedRound === "object" ? source.interruptedRound as Partial<InterruptedRound> : null;
    const draftNames = draftSource && Array.isArray(draftSource.sequence) ? draftSource.sequence.slice(0, 40) : [];
    const draftShapeIds = draftSource && Array.isArray(draftSource.shapeIds) ? draftSource.shapeIds.slice(0, 40).filter((id): id is string => typeof id === "string") : [];
    const draftSequence = draftNames.length >= 2 && draftNames.every((name) => typeof name === "string" && Boolean(CHORD_LOOKUP.get(name))) ? draftNames.map((name) => CHORD_LOOKUP.get(name as string)!.name) : [];
    const draftFeedback: Record<number, FeedbackRating> = {};
    if (draftSource?.feedback && typeof draftSource.feedback === "object") Object.entries(draftSource.feedback).slice(0, 40).forEach(([key, value]) => { const index = Number(key); if (Number.isInteger(index) && index >= 0 && index < draftSequence.length && ["clean", "missed", "needsWork"].includes(String(value))) draftFeedback[index] = value as FeedbackRating; });
    const draftSetup = sanitizeTrainerSetup(draftSource?.setup, fallbackSetup) ?? fallbackSetup;
    const interruptedRound: InterruptedRound | null = draftSource && draftSequence.length >= 2 && draftSource.config && typeof draftSource.config === "object"
      ? { sequence: draftSequence, shapeIds: draftShapeIds, currentIndex: Math.floor(clampNumber(draftSource.currentIndex, -1, draftSequence.length - 1, 0)), feedback: draftFeedback, secondsLeft: clampNumber(draftSource.secondsLeft, 0, 3600, 0), remainingMs: clampNumber(draftSource.remainingMs, 0, 3_600_000, 0), elapsedSeconds: clampNumber(draftSource.elapsedSeconds, 0, 86_400, 0), config: { length: draftSequence.length, pace: (draftSource.config as RoundConfig).pace === "manual" ? "manual" : clampNumber((draftSource.config as RoundConfig).pace, 2, 8, 3), drillLabel: typeof (draftSource.config as RoundConfig).drillLabel === "string" ? (draftSource.config as RoundConfig).drillLabel.slice(0, 80) : "Saved round", pacePlan: Array.isArray((draftSource.config as RoundConfig).pacePlan) ? (draftSource.config as RoundConfig).pacePlan.slice(0, 40).map((value) => clampNumber(value, 2, 8, 3)) : [] }, setup: draftSetup, roundId: typeof draftSource.roundId === "string" ? draftSource.roundId.slice(0, 80) : "saved-round", savedAt: clampNumber(draftSource.savedAt, 0, Date.now(), Date.now()), pausedFrom: draftSource.pausedFrom === "countIn" ? "countIn" : "running", countInBeat: Math.floor(clampNumber(draftSource.countInBeat, 1, 4, 3)), exposureTransitions: Array.isArray(draftSource.exposureTransitions) ? draftSource.exposureTransitions.slice(0, 100).filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 100)) : undefined, exposureRecovered: Array.isArray(draftSource.exposureRecovered) ? draftSource.exposureRecovered.slice(0, 40).map((value) => Math.floor(clampNumber(value, 0, 39, 0))) : undefined, exposureKinds: draftSource.exposureKinds && typeof draftSource.exposureKinds === "object" ? Object.fromEntries(Object.entries(draftSource.exposureKinds).slice(0, 40).flatMap(([key, value]) => [value === "fresh" || value === "repeat" ? [key, value] : []])) as Record<number, "fresh" | "repeat"> : undefined, freshCount: clampNumber(draftSource.freshCount, 0, 100, 0), repeatCount: clampNumber(draftSource.repeatCount, 0, 100, 0), freshClean: clampNumber(draftSource.freshClean, 0, 100, 0), repeatClean: clampNumber(draftSource.repeatClean, 0, 100, 0), effort: draftSource.effort === "comfortable" || draftSource.effort === "working" || draftSource.effort === "exhausting" ? draftSource.effort : null, placementConfirmed: draftSource.placementConfirmed === true }
      : null;
    const retentionQueue: RetentionEntry[] = Array.isArray(source.retentionQueue) ? source.retentionQueue.slice(0, 20).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<RetentionEntry>;
      if (typeof item.id !== "string" || typeof item.due !== "string" || typeof item.label !== "string" || !item.setup || typeof item.setup !== "object") return [];
      const setupItem = item.setup as Partial<TrainerSetup>;
      const safeSetup = sanitizeTrainerSetup(setupItem, fallbackSetup);
      if (!safeSetup) return [];
      const names = Array.isArray(item.sequence) ? item.sequence.slice(0, 40).filter((name): name is string => typeof name === "string").map((name) => name.slice(0, 24)) : undefined;
      const shapes = Array.isArray(item.shapeIds) ? item.shapeIds.slice(0, 40).filter((id): id is string => typeof id === "string").map((id) => id.slice(0, 100)) : undefined;
      return [{ id: item.id.slice(0, 80), due: item.due.slice(0, 10), label: item.label.slice(0, 120), setup: safeSetup, sourceId: typeof item.sourceId === "string" ? item.sourceId.slice(0, 80) : undefined, intervalDays: item.intervalDays === 1 || item.intervalDays === 7 ? item.intervalDays : undefined, sequence: names, shapeIds: shapes, pace: typeof item.pace === "number" ? clampNumber(item.pace, 2, 8, 3) : undefined }];
    }) : [];
    const effortValues: EffortRating[] = ["comfortable", "working", "exhausting"];
    const shapeExclusions: ShapeExclusion[] = Array.isArray((source as { shapeExclusions?: unknown }).shapeExclusions)
      ? ((source as { shapeExclusions: unknown[] }).shapeExclusions).slice(0, 50).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Partial<ShapeExclusion>;
        if (typeof item.key !== "string" || typeof item.libraryId !== "string" || typeof item.harmony !== "string" || typeof item.label !== "string") return [];
        return [{ key: item.key.slice(0, 140), libraryId: item.libraryId.slice(0, 100), harmony: item.harmony.slice(0, 50), label: item.label.slice(0, 80), date: typeof item.date === "string" ? item.date.slice(0, 10) : localDateKey(), replacementId: typeof item.replacementId === "string" ? item.replacementId.slice(0, 100) : undefined }];
      }) : [];
    const favorites: FavoriteSetup[] = Array.isArray((source as { favorites?: unknown }).favorites)
      ? ((source as { favorites: unknown[] }).favorites).slice(0, 2).flatMap((entry, index) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as { id?: unknown; name?: unknown; setup?: unknown };
        const safeSetup = sanitizeTrainerSetup(item.setup, fallbackSetup);
        if (!safeSetup) return [];
        return [{ id: typeof item.id === "string" ? item.id.slice(0, 80) : `favorite-${index}`, name: typeof item.name === "string" ? item.name.trim().slice(0, 60) || `Favorite ${index + 1}` : `Favorite ${index + 1}`, setup: safeSetup }];
      }) : [];
    const roundEvidence: RoundEvidence[] = Array.isArray((source as { roundEvidence?: unknown }).roundEvidence)
      ? ((source as { roundEvidence: unknown[] }).roundEvidence).slice(0, 100).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Partial<RoundEvidence>;
        if (typeof item.id !== "string" || typeof item.sessionId !== "string" || typeof item.date !== "string") return [];
        return [{ id: item.id.slice(0, 80), sessionId: item.sessionId.slice(0, 80), date: item.date.slice(0, 10), rated: clampNumber(item.rated, 0, 100, 0), accuracy: clampNumber(item.accuracy, 0, 100, 0), pace: item.pace === "manual" ? "manual" : clampNumber(item.pace, 2, 8, 3), effort: effortValues.includes(item.effort as EffortRating) ? item.effort as EffortRating : null, fresh: item.fresh === null ? null : clampNumber(item.fresh, 0, 100, 0), repeat: item.repeat === null ? null : clampNumber(item.repeat, 0, 100, 0), freshClean: item.freshClean === null ? null : clampNumber(item.freshClean, 0, 100, 0), repeatClean: item.repeatClean === null ? null : clampNumber(item.repeatClean, 0, 100, 0) }];
      }) : [];
    const timeline: TimelineEvent[] = Array.isArray((source as { timeline?: unknown }).timeline)
      ? ((source as { timeline: unknown[] }).timeline).slice(0, 100).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Partial<TimelineEvent>;
        if (typeof item.id !== "string" || !["practice", "pause", "resume", "recover", "finish"].includes(String(item.kind))) return [];
        return [{ id: item.id.slice(0, 80), kind: item.kind as TimelineEventKind, at: clampNumber(item.at, 0, Date.now() + 86_400_000, Date.now()), durationSeconds: item.durationSeconds === undefined ? undefined : clampNumber(item.durationSeconds, 0, 86_400, 0), detail: typeof item.detail === "string" ? item.detail.slice(0, 120) : undefined, sessionId: typeof item.sessionId === "string" ? item.sessionId.slice(0, 80) : undefined }];
      }) : [];
    const preferredShapes: Record<string, string> = {};
    const preferredSource = (source as { preferredShapes?: unknown }).preferredShapes;
    if (preferredSource && typeof preferredSource === "object") Object.entries(preferredSource).slice(0, 50).forEach(([key, value]) => { if (typeof value === "string" && key.length <= 80 && CHORD_ITEM_LOOKUP.has(value)) preferredShapes[key.slice(0, 80)] = value.slice(0, 100); });
    const benchmarkRoute = Array.isArray((source as { benchmarkRoute?: unknown }).benchmarkRoute) ? ((source as { benchmarkRoute: unknown[] }).benchmarkRoute).slice(0, 60).filter((id): id is string => typeof id === "string").map((id) => id.slice(0, 100)) : undefined;
    return { version: 10, transitions, chords, stats, history, notes, rotation, reflections, realWorldGoal, mistakePatterns, readiness, sessions, performanceReflections, datedPracticeGoal, snapshots, speedLadder, milestones, performanceChecklist, rehearsalNotes, recoveryHistory, achievementSettings, mastery, recipes, instrumentProfile, cloudBackupConsent, lastSetup: setup, interruptedRound, completedRounds, retentionQueue, onboardingComplete: source.onboardingComplete === true, favorites, shapeExclusions, roundEvidence, timeline, trainerSessionId: typeof (source as { trainerSessionId?: unknown }).trainerSessionId === "string" ? (source as { trainerSessionId: string }).trainerSessionId.slice(0, 80) : "", preferredShapes, benchmarkRoute: benchmarkRoute?.length === 60 ? benchmarkRoute : undefined };
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

function libraryItemForChord(chord: Chord) {
  return CHORD_LIBRARY.find((item) => item.chord.name === chord.name && item.chord.frets.every((fret, index) => fret === chord.frets[index]))
    ?? CHORD_LIBRARY.find((item) => item.chord.name === chord.name);
}

function shapeCatalogKey(item: { id: string; chord: Chord }) {
  return `${item.id}:${item.chord.frets.join(",")}:${(item.chord.fingers ?? []).join(",")}`;
}

function sameHarmony(left: Chord, right: Chord) {
  const leftItem = libraryItemForChord(left);
  const rightItem = libraryItemForChord(right);
  return leftItem?.root === rightItem?.root && leftItem?.quality === rightItem?.quality;
}

function constrainedLevelChords(levelChords: Chord[], exclusions: Set<string>, preferredShapes: Record<string, string>, lock: NeckPositionLock, customMin: number, customMax: number) {
  return levelChords.flatMap((chord) => {
    const canonical = libraryItemForChord(chord);
    const candidates = CHORD_LIBRARY.filter((item) => sameHarmony(item.chord, chord) && shapeFitsPosition(item, lock, customMin, customMax) && !exclusions.has(shapeCatalogKey(item)));
    const harmony = canonical ? `${canonical.root}|${canonical.quality}` : `${chordRoot(chord.name)}|${chord.name}`;
    const preferred = preferredShapes[harmony] ? CHORD_ITEM_LOOKUP.get(preferredShapes[harmony]) : null;
    if (preferred && sameHarmony(preferred.chord, chord) && shapeFitsPosition(preferred, lock, customMin, customMax) && !exclusions.has(shapeCatalogKey(preferred))) return [preferred.chord];
    if (canonical && shapeFitsPosition(canonical, lock, customMin, customMax) && !exclusions.has(shapeCatalogKey(canonical))) return [canonical.chord];
    return candidates.slice(0, 1).map((item) => item.chord);
  });
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

function chordRoot(name: string) {
  return name.match(/^[A-G](?:#|b)?/)?.[0] ?? name;
}

function scaleFragmentForChord(chord: Chord | null) {
  if (!chord) return null;
  const root = chordRoot(chord.name);
  const majorRoots: Record<string, string> = {
    C: "C · D · E · G · A",
    D: "D · E · F# · A · B",
    E: "E · F# · G# · B · C#",
    F: "F · G · A · C · D",
    G: "G · A · B · D · E",
    A: "A · B · C# · E · F#",
    B: "B · C# · D# · F# · G#"
  };
  return { label: `${root} pentatonic fragment`, notes: majorRoots[root.replace(/[#b]$/, "")] ?? `${root} · 2 · 3 · 5 · 6` };
}

function snapshotWeekKey(date = new Date()) {
  const cursor = new Date(date);
  const day = cursor.getDay() || 7;
  cursor.setDate(cursor.getDate() - day + 1);
  return localDateKey(cursor);
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

function roundComparisonDetail(round: CompletedRound) {
  const effort = round.effort ? `effort ${round.effort}` : "effort not reported";
  if (round.freshCount === null || round.freshCount === undefined || round.repeatCount === null || round.repeatCount === undefined) return `${effort} · fresh/repeat unknown`;
  return `${effort} · fresh ${round.freshClean ?? "unknown"}/${round.freshCount} clean · repeat ${round.repeatClean ?? "unknown"}/${round.repeatCount} clean`;
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

export default function TrainerPage() {
  const { formatDate, formatPercent, formatNumber, t } = useLocale();
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
  const [voicePrompts, setVoicePrompts] = useState(false);
  const [voicePromptSupportKnown, setVoicePromptSupportKnown] = useState(false);
  const [voicePromptSupported, setVoicePromptSupported] = useState(false);
  const [adaptivePacing, setAdaptivePacing] = useState(false);
  const [adaptivePreference, setAdaptivePreference] = useState<"comfort" | "challenge">("comfort");
  useEffect(() => { try { const preference = window.localStorage.getItem("chord-hero.trainer.adaptive-preference.v1"); if (preference === "comfort" || preference === "challenge") setAdaptivePreference(preference); } catch {} }, []);
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
  const [predictedCleanRate, setPredictedCleanRate] = useState<number | null>(null);
  const [cleanCriteria, setCleanCriteria] = useState<GrowthCriteria[]>([]);
  const [criteriaChecks, setCriteriaChecks] = useState<Record<number, Partial<Record<GrowthCriteria, boolean>>>>({});
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
  const [missTags, setMissTags] = useState<Record<number, MissTag[]>>({});
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
  const [threeDHandVisible, setThreeDHandVisible] = useState(false);
  const [captureKind, setCaptureKind] = useState<CaptureKind>("audio");
  const [recording, setRecording] = useState(false);
  const [captureStarting, setCaptureStarting] = useState(false);
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
  const [sectionChunkSize, setSectionChunkSize] = useState<4 | 8>(4);
  const [sectionPaces, setSectionPaces] = useState<Record<RehearsalSection, number>>(DEFAULT_SECTION_PACES);
  const [sectionNeedsPractice, setSectionNeedsPractice] = useState<Partial<Record<RehearsalSection, boolean>>>({});
  const [sectionPacesHydrated, setSectionPacesHydrated] = useState(false);
  const [achievementNotice, setAchievementNotice] = useState("");
  const [rehearsalTransition, setRehearsalTransition] = useState("");
  const [rehearsalNote, setRehearsalNote] = useState("");
  const [setlistMessage, setSetlistMessage] = useState("Import a local setlist JSON to build a warm-up from its supported chords.");
  const [handPhotoUrl, setHandPhotoUrl] = useState("");
  const [handPhotoName, setHandPhotoName] = useState("");
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod>("rest");
  const [recoveryOutcome, setRecoveryOutcome] = useState("");
  const [threeDPreviewChordName, setThreeDPreviewChordName] = useState("");
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>("fretting");
  const [rehearsalDate, setRehearsalDate] = useState("");
  const [relaxationBefore, setRelaxationBefore] = useState(3);
  const [relaxationAfter, setRelaxationAfter] = useState(3);
  const [memoryAnswer, setMemoryAnswer] = useState("");
  const [memoryResult, setMemoryResult] = useState("");
  const [fingeringScores, setFingeringScores] = useState({ standard: 0, alternate: 0 });
  const [rescueScenario, setRescueScenario] = useState<RescueScenario>("lostPlace");
  const [personalVocabulary, setPersonalVocabulary] = useState<string[]>([]);
  const [vocabularyOnly, setVocabularyOnly] = useState(false);
  const [coachPointer, setCoachPointer] = useState<"text" | "audio" | "visual">("text");
  const [coachAttachment, setCoachAttachment] = useState<{ name: string; type: string; bytes: number } | null>(null);
  const [mistakeReplayIndex, setMistakeReplayIndex] = useState(0);
  const [footswitchMode, setFootswitchMode] = useState(false);
  const [rebuildPrompt, setRebuildPrompt] = useState<{ index: number; beat: number; rejoin: "current" | "next" }>({ index: -1, beat: 1, rejoin: "current" });
  const [performanceWentWell, setPerformanceWentWell] = useState("");
  const [performanceLostTime, setPerformanceLostTime] = useState("");
  const [performanceRevisit, setPerformanceRevisit] = useState("");
  const [warmUpTemplate, setWarmUpTemplate] = useState<InstrumentProfile>("acoustic");
  const [displayPreference, setDisplayPreference] = useState<"full" | "light">("full");
  const [displayHandedness, setDisplayHandedness] = useState<Handedness>("right");
  const [textScale, setTextScale] = useState<"normal" | "large">("normal");
  const [diagramVisibility, setDiagramVisibility] = useState<"visible" | "minimal">("visible");
  const [setupHydrationReady, setSetupHydrationReady] = useState(false);
  const [simpleWorkspace, setSimpleWorkspace] = useState(true);
  const [assistanceEnabled, setAssistanceEnabled] = useState(false);
  const [assistanceRevealed, setAssistanceRevealed] = useState(false);
  const [reviewMode, setReviewMode] = useState<"closed" | "setup" | "paused">("closed");
  const [finishEarly, setFinishEarly] = useState(false);
  const [comparisonMessage, setComparisonMessage] = useState("");
  const [nextPracticeSaved, setNextPracticeSaved] = useState(false);
  const [displayPrefsHydrated, setDisplayPrefsHydrated] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDrillFilter, setHistoryDrillFilter] = useState("all");
  const [historyResultFilter, setHistoryResultFilter] = useState<"all" | "clean" | "flagged">("all");
  const [transferPair, setTransferPair] = useState<[string, string] | null>(null);
  const [effortRating, setEffortRating] = useState<EffortRating | null>(null);
  const [neckLock, setNeckLock] = useState<NeckPositionLock>("off");
  const [customNeckMin, setCustomNeckMin] = useState(0);
  const [customNeckMax, setCustomNeckMax] = useState(12);
  const [landingCheckpoint, setLandingCheckpoint] = useState(false);
  const [placementConfirmed, setPlacementConfirmed] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [recallDrill, setRecallDrill] = useState<{ first: string; second: string; distractors: [string, string]; answer: string; phase: "preview" | "distract1" | "distract2" | "quiz" | "done" } | null>(null);
  const [recallChoice, setRecallChoice] = useState("");
  const [recallMessage, setRecallMessage] = useState("");
  const [exploreChordName, setExploreChordName] = useState("");
  const [exploreVoicingId, setExploreVoicingId] = useState("");
  const [storageReview, setStorageReview] = useState<"closed" | "review" | "armed">("closed");
  const [storageEstimate, setStorageEstimate] = useState<{ localBytes: number; quota: number | null }>({ localBytes: 0, quota: null });
  const [freshCount, setFreshCount] = useState(0);
  const [repeatCount, setRepeatCount] = useState(0);
  const [selectedContact, setSelectedContact] = useState<{ string: number; fret: number } | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<number | null>(null);
  const [tensionChecks, setTensionChecks] = useState<Record<number, TransitionTension>>({});
  const [positionQuiz, setPositionQuiz] = useState<{ targetId: string; choice: string; committed: boolean } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);
  const resumeRemainingRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const persistenceRef = useRef(DEFAULT_PERSISTENCE);
  const persistenceLoadedRef = useRef(false);
  const feedbackRef = useRef<Record<number, FeedbackRating>>({});
  const retentionSourceRef = useRef<{ id: string; days: 1 | 7 } | null>(null);
  const ratedIndicesRef = useRef(new Set<number>());
  const roundFinishedRef = useRef(false);
  const roundPersistedRef = useRef(false);
  const runtimePaceRef = useRef(3);
  const cleanRecoveryRef = useRef(0);
  const adaptivePaceHistoryRef = useRef<number[]>([]);
  const consecutiveMissesRef = useRef(0);
  const roundStartedAtRef = useRef(0);
  const sessionStartedAtRef = useRef(0);
  const sessionIdRef = useRef("");
  const timelineRef = useRef<TimelineEvent[]>([]);
  const exposureRef = useRef<{ transitions: Set<string>; recovered: Set<number>; kinds: Record<number, "fresh" | "repeat">; fresh: number; repeat: number; freshClean: number; repeatClean: number }>({ transitions: new Set(), recovered: new Set(), kinds: {}, fresh: 0, repeat: 0, freshClean: 0, repeatClean: 0 });
  const effortRef = useRef<EffortRating | null>(null);
  const roundIdRef = useRef("");
  const metronomeRef = useRef({ on: true, subdivision: "change" as Subdivision, volume: 0.25 });
  const rhythmRef = useRef({ aware: false, bpm: 60, changeBeat: 1, groove: false });
  const challengeFileRef = useRef<HTMLInputElement | null>(null);
  const offlinePackFileRef = useRef<HTMLInputElement | null>(null);
  const setlistFileRef = useRef<HTMLInputElement | null>(null);
  const handPhotoFileRef = useRef<HTMLInputElement | null>(null);
  const coachPointerFileRef = useRef<HTMLInputElement | null>(null);
  const handPhotoUrlRef = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const captureStartingRef = useRef(false);
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
  const rateAndAdvanceRef = useRef<(rating: FeedbackRating) => void>(() => undefined);
  const undoSnapshotRef = useRef<UndoSnapshot | null>(null);
  const setupSignatureRef = useRef("");
  const setupHydratedRef = useRef(false);
  const saveInterruptedRoundRef = useRef<() => void>(() => undefined);
  const displayPrefsRef = useRef(false);
  const assistanceTrailRef = useRef<string[]>([]);
  const voicePromptRef = useRef<SpeechSynthesis | null>(null);
  const cancelTransitionPreview = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setTransitionPhase(null);
  }, []);

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
  const excludedShapeKeys = useMemo(() => new Set(persistence.shapeExclusions.map((item) => item.key)), [persistence.shapeExclusions]);
  const availableLevelChords = useMemo(() => constrainedLevelChords(activeLevel.chords, excludedShapeKeys, persistence.preferredShapes, neckLock, customNeckMin, customNeckMax), [activeLevel.chords, customNeckMax, customNeckMin, excludedShapeKeys, neckLock, persistence.preferredShapes]);
  const currentSetup = useMemo<TrainerSetup>(() => ({
    level: levelIndex, drill: drillMode, pairFrom: effectivePairFrom, pairTo: effectivePairTo, keepFrom: effectiveKeepFrom, keepTo: effectiveKeepTo, progression: progressionId,
    family: chordFamily, songId: songSetId, pace, length: roundLength, rhythm: rhythmAware, bpm: rhythmBpm,
    strum: strummingPrompt, genre: genrePack, randomKey, warmUp, tuning: tuningId, customTuning: customTuningLabel, capo: capoFret, orientation: handedness,
    neckLock, customNeckMin, customNeckMax, landingCheckpoint
  }), [capoFret, chordFamily, customNeckMax, customNeckMin, customTuningLabel, drillMode, effectiveKeepFrom, effectiveKeepTo, effectivePairFrom, effectivePairTo, genrePack, handedness, landingCheckpoint, levelIndex, neckLock, pace, progressionId, randomKey, rhythmAware, rhythmBpm, roundLength, songSetId, strummingPrompt, tuningId, warmUp]);
  const currentClarityContext = useMemo<RoundClarityContext>(() => ({
    version: 1,
    shapeSignature: shapeSignature(sequence, sequence.map((chord) => libraryItemForChord(chord)?.id ?? "")),
    assistance: assistanceEnabled ? (assistanceStage(Object.values(feedback).filter((rating) => rating === "clean").length, Object.values(feedback).filter((rating) => rating === "missed").length, true) === 2 ? "stage2" : assistanceStage(Object.values(feedback).filter((rating) => rating === "clean").length, Object.values(feedback).filter((rating) => rating === "missed").length, true) === 1 ? "stage1" : "off") : "off",
    assistanceTrail: assistanceTrailRef.current.join("|"),
    challenge: challengeMode,
    diagram: displayPreference,
    diagramVisibility,
    preview: previewEnabled,
    landing: landingCheckpoint,
    warmUp,
    adaptive: adaptivePacing,
    adaptivePace: adaptivePacing ? adaptivePaceHistoryRef.current.slice(0, 40).join(",") : "",
    rhythm: rhythmAware,
    bpm: rhythmAware ? rhythmBpm : null,
    tuning: tuningId === "custom" ? customTuningLabel : tuningId,
    capo: capoFret
  }), [adaptivePacing, assistanceEnabled, challengeMode, capoFret, customTuningLabel, diagramVisibility, displayPreference, feedback, landingCheckpoint, previewEnabled, rhythmAware, rhythmBpm, sequence, tuningId, warmUp]);
  const cleanRatedChanges = useMemo(() => Object.values(feedback).filter((rating) => rating === "clean").length, [feedback]);
  const missedRatedChanges = useMemo(() => Object.values(feedback).filter((rating) => rating === "missed").length, [feedback]);
  const assistanceCleanStreak = useMemo(() => Object.entries(feedback).sort(([left], [right]) => Number(left) - Number(right)).reduce((streak, [, rating]) => rating === "clean" ? streak + 1 : 0, 0), [feedback]);
  const assistanceLevel = assistanceStage(assistanceCleanStreak, 0, assistanceEnabled && !assistanceRevealed);
  const targetGuideVisible = !(challengeMode === "recall" && !recallRevealed);
  useEffect(() => {
    if (!["countIn", "running", "paused"].includes(status)) return;
    const token = `${currentIndex}:${assistanceEnabled ? "on" : "off"}:${assistanceRevealed ? "revealed" : "auto"}:${assistanceLevel}:${displayPreference}:${diagramVisibility}`;
    if (assistanceTrailRef.current.at(-1) === token) return;
    assistanceTrailRef.current = [...assistanceTrailRef.current, token].slice(-80);
  }, [assistanceEnabled, assistanceLevel, assistanceRevealed, currentIndex, diagramVisibility, displayPreference, status]);
  const showUpcomingDiagram = assistanceLevel < 1;
  const showCurrentDiagram = assistanceLevel < 2;
  const completedHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return persistence.completedRounds.filter((round) => {
      const result = round.ratings.missed > 0 || round.ratings.needsWork > 0 ? "flagged" : "clean";
      const matchesQuery = !query || [round.drill, round.song, round.note, round.pace === "manual" ? "manual" : `${round.pace}s`, ...round.sequence, ...round.sequence.slice(0, -1).map((name, index) => `${name} → ${round.sequence[index + 1]}`)].some((field) => field.toLowerCase().includes(query));
      return matchesQuery && (historyDrillFilter === "all" || round.drill === historyDrillFilter) && (historyResultFilter === "all" || result === historyResultFilter);
    });
  }, [historyDrillFilter, historyResultFilter, historySearch, persistence.completedRounds]);
  const historyDrillOptions = useMemo(() => Array.from(new Set(persistence.completedRounds.map((round) => round.drill))).slice(0, 20), [persistence.completedRounds]);
  const dueRetention = useMemo(() => persistence.retentionQueue.filter((item) => item.due <= localDateKey()), [persistence.retentionQueue]);
  const retentionResult = useMemo(() => compareRetention(persistence.completedRounds), [persistence.completedRounds]);
  const selectedSongSet = songSets.find((set) => set.id === songSetId) ?? songSets[0] ?? null;
  const displayLadderSteps = useMemo(() => buildNeckLadder(buildProgression(CHORD_LIBRARY.map((item) => item.chord), progressionId, 4), CHORD_LIBRARY, sameHarmony), [progressionId]);
  const threeDGuideChord = currentChord
    ?? activeLevel.chords.find((chord) => chord.name === threeDPreviewChordName)
    ?? activeLevel.chords[0]
    ?? null;
  const idlePreviewFrom = status === "idle" && threeDGuideChord
    ? availableLevelChords.find((chord) => chord.name !== threeDGuideChord.name) ?? null
    : null;
  const transitionFromForPreview = previousChord ?? idlePreviewFrom;
  const transitionTargetForPreview = currentChord ?? (status === "idle" ? threeDGuideChord : null);
  const contactOptions = useMemo(() => {
    const chord = currentChord ?? threeDGuideChord;
    return chord ? chord.frets.flatMap((fret, string) => fret > 0 && chord.fingers?.[string] ? [{ string, fret, finger: chord.fingers[string] as number }] : []) : [];
  }, [currentChord, threeDGuideChord]);
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
  const levelWeakPair = useMemo<[string, string] | null>(() => {
    const pair = transitionMap.weak.map(([key]) => key.split(" → ")).find(([from, to]) => Boolean(from && to && activeLevel.chords.some((chord) => chord.name === from) && activeLevel.chords.some((chord) => chord.name === to)));
    return pair?.length === 2 ? [pair[0], pair[1]] : null;
  }, [activeLevel.chords, transitionMap.weak]);
  const recommendedNextPractice = useMemo(() => {
    const weakPair = levelWeakPair && levelWeakPair.every((name) => availableLevelChords.some((chord) => chord.name === name)) ? levelWeakPair : null;
    if (weakPair) {
      return { setup: { ...currentSetup, drill: "pair" as DrillMode, pairFrom: weakPair[0], pairTo: weakPair[1], length: 5, pace: 6 as Pace }, label: `${weakPair[0]} → ${weakPair[1]} · five changes at 6s` };
    }
    const slowerPace: Pace = typeof currentSetup.pace !== "number" ? 6 : Math.min(8, Math.max(6, currentSetup.pace + 1));
    return { setup: { ...currentSetup, length: 5, pace: slowerPace }, label: `Five changes at ${typeof slowerPace === "number" ? `${slowerPace}s` : "manual"} · current drill` };
  }, [availableLevelChords, currentSetup, levelWeakPair]);
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
  const personalVocabularyChords = useMemo(
    () => activeLevel.chords.filter((chord) => personalVocabulary.includes(chord.name)),
    [activeLevel.chords, personalVocabulary]
  );
  const practicePath = useMemo(() => {
    const weak = transitionMap.weak[0]?.[0] ?? `${effectivePairFrom} → ${effectivePairTo}`;
    const fatigue = persistence.sessions.slice(0, 7).some((session) => /tens|sore|tight|fatigue|pain/i.test(session.tension));
    const songGoal = persistence.readiness.label || "your current song";
    return [
      { day: "Day 1", focus: fatigue ? "Recovery reset · silent shapes" : "Baseline · relaxed chord shapes" },
      { day: "Day 2", focus: `Target ${weak} at a comfortable pace` },
      { day: "Day 3", focus: `Rhythm displacement · changes on beat ${changeBeat}` },
      { day: "Day 4", focus: fatigue ? "Rest or five-minute technique check" : "Alternate-fingering A/B round" },
      { day: "Day 5", focus: `Apply the transition inside ${songGoal}` },
      { day: "Day 6", focus: "Performance-rescue rehearsal" },
      { day: "Day 7", focus: "Short review, reflection, and next-week reset" }
    ];
  }, [changeBeat, effectivePairFrom, effectivePairTo, persistence.readiness.label, persistence.sessions, transitionMap.weak]);
  const rehearsalDaysLeft = useMemo(() => {
    if (!rehearsalDate) return null;
    const target = new Date(`${rehearsalDate}T12:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
  }, [rehearsalDate]);
  const mistakeReplayItems = useMemo(() => Object.entries(feedback)
    .filter(([, rating]) => rating !== "clean")
    .map(([rawIndex, rating]) => {
      const index = Number(rawIndex);
      const start = Math.max(0, index - 1);
      const end = Math.min(sequence.length, index + 2);
      return {
        index,
        rating,
        window: sequence.slice(start, end),
        plannedSeconds: roundConfig.pacePlan[index] ?? (typeof roundConfig.pace === "number" ? roundConfig.pace : null)
      };
    }), [feedback, roundConfig.pace, roundConfig.pacePlan, sequence]);
  const activeMistakeReplay = mistakeReplayItems[mistakeReplayIndex] ?? mistakeReplayItems[0] ?? null;
  const activeLibraryItem = threeDGuideChord ? libraryItemForChord(threeDGuideChord) : null;
  const alternateFingering = activeLibraryItem?.alternateFingerings?.[0] ?? "Try the same shape with the closest comfortable finger assignment, without changing its notes.";
  const barrePressureCue = currentChord?.barre
    ? `Use the minimum pressure that keeps ${currentChord.name} clear. Place the index close behind fret ${currentChord.barre.fret}, test once, then soften until the note nearly buzzes and add only a little pressure back.`
    : "No barre in the current shape. Keep the thumb light and use only enough fingertip pressure for a clear note.";
  const liveFeedbackSummary = useMemo(() => summarizeFeedback(feedback), [feedback]);
  const performanceConfidence = useMemo(() => {
    const rated = liveFeedbackSummary.clean + liveFeedbackSummary.needsWork + liveFeedbackSummary.missed;
    const transition = rated ? (liveFeedbackSummary.clean / rated) * 100 : 0;
    const rhythmSession = persistence.sessions.find((session) => session.id.startsWith("rhythm-") || /rhythm|strum/i.test(session.tension));
    const rhythm = rhythmAware || strummingPrompt !== "none" ? (rated ? ((liveFeedbackSummary.clean + liveFeedbackSummary.needsWork * 0.45) / rated) * 100 : 0) : rhythmSession?.accuracy ?? 0;
    const tensionPenalty = discomfort === "strong" ? 80 : discomfort === "moderate" ? 55 : discomfort === "mild" ? 25 : persistence.mistakePatterns.tension ? Math.min(60, persistence.mistakePatterns.tension * 8) : 0;
    const tensionEvidence = discomfort !== "none" || persistence.mistakePatterns.tension > 0;
    const tension = tensionEvidence ? Math.max(0, 100 - tensionPenalty) : 0;
    const checklist = (Object.values(persistence.performanceChecklist).filter(Boolean).length / 5) * 100;
    const hasEvidence = rated > 0 || Boolean(rhythmSession) || tensionEvidence || checklist > 0;
    const score = hasEvidence ? Math.round(transition * 0.35 + rhythm * 0.25 + tension * 0.15 + checklist * 0.25) : 0;
    return { score, hasEvidence, transition: Math.round(transition), rhythm: Math.round(rhythm), tension: Math.round(tension), checklist: Math.round(checklist) };
  }, [discomfort, liveFeedbackSummary, persistence.mistakePatterns.tension, persistence.performanceChecklist, persistence.sessions, rhythmAware, strummingPrompt]);
  const voicingMapEntries = useMemo(() => {
    const target = currentChord ?? threeDGuideChord ?? activeLevel.chords[0];
    if (!target) return [];
    const libraryTarget = libraryItemForChord(target);
    if (!libraryTarget) return [];
    return CHORD_LIBRARY.filter((item) => item.root === libraryTarget.root && item.quality === libraryTarget.quality).slice(0, 6);
  }, [activeLevel.chords, currentChord, threeDGuideChord]);
  const bandContext = useMemo(() => {
    const chord = currentChord ?? threeDGuideChord;
    if (!chord) return null;
    const item = libraryItemForChord(chord);
    const role = item?.functionContexts[0]?.label ?? "Use the root as the band anchor and keep the rhythm pocket steady.";
    return { root: chordRoot(chord.name), role };
  }, [currentChord, threeDGuideChord]);
  const explainChange = useMemo(() => {
    const from = previousChord ?? activeLevel.chords[0];
    const to = currentChord ?? nextChord;
    if (!from || !to) return null;
    const shared = sharedFrettedPositions(from, to).length;
    const movement = chordRoot(from.name) === chordRoot(to.name) ? "same-root color change" : `${chordRoot(from.name)} resolves toward ${chordRoot(to.name)}`;
    return { from: from.name, to: to.name, movement, pivot: shared ? `Keep ${shared} shared fretted position${shared === 1 ? "" : "s"} planted as a pivot.` : "No shared fretted position is obvious; hover fingers close and move together." };
  }, [activeLevel.chords, currentChord, nextChord, previousChord]);
  const scaleFragment = useMemo(() => scaleFragmentForChord(currentChord ?? nextChord), [currentChord, nextChord]);
  const sectionSpacing = useMemo(() => {
    const weak = transitionMap.weak.length;
    return weak >= 2 ? "Repeat the difficult chorus twice for every comfortable verse." : weak === 1 ? "Give the chorus one extra pass, then keep the verse at normal spacing." : "Keep verse and chorus spacing even until more transition evidence is available.";
  }, [transitionMap.weak.length]);
  const latestSnapshot = persistence.snapshots[0] ?? null;
  const previousSnapshot = persistence.snapshots.find((snapshot) => snapshot.id !== latestSnapshot?.id) ?? null;
  const explorationTarget = useMemo(() => {
    const target = CHORD_LIBRARY.find((item) => item.id === exploreVoicingId) ?? CHORD_LIBRARY.find((item) => item.chord.name === exploreChordName) ?? CHORD_LIBRARY[0];
    return target ?? null;
  }, [exploreChordName, exploreVoicingId]);
  const explorationVariants = useMemo(() => explorationTarget ? CHORD_LIBRARY.filter((item) => item.root === explorationTarget.root && item.quality === explorationTarget.quality).slice(0, 6) : [], [explorationTarget]);
  const sessionRounds = useMemo(() => persistence.completedRounds.filter((round) => round.sessionId && round.sessionId === (sessionIdRef.current || persistence.trainerSessionId)).slice().reverse(), [persistence.completedRounds, persistence.trainerSessionId]);
  const comparableSessionPair = useMemo(() => {
    const candidates = sessionRounds.filter((round) => round.clarity && (round.ratedCoverage ?? 0) >= 80);
    for (let index = 0; index < candidates.length; index += 1) {
      for (let prior = candidates.length - 1; prior > index; prior -= 1) {
        if (compareRoundContexts(candidates[index], candidates[prior])) return { first: candidates[index], last: candidates[prior], excluded: sessionRounds.length - 2 };
      }
    }
    return { first: null, last: null, excluded: sessionRounds.length };
  }, [sessionRounds]);
  const masteryEvidence = useMemo(() => {
    return crossDayConsistency(persistence.completedRounds);
  }, [persistence.completedRounds]);
  const sameDrillComparison = useMemo(() => {
    const current = persistence.completedRounds.find((round) => round.id === roundIdRef.current);
    if (!current) return null;
    const previous = persistence.completedRounds.find((round) => round.id !== current.id && round.shapeIds?.join("|") === current.shapeIds?.join("|") && round.clarity?.tuning === current.clarity?.tuning && round.clarity?.capo === current.clarity?.capo && round.clarity?.challenge === current.clarity?.challenge);
    return compareTransitionRatings(current, previous);
  }, [persistence.completedRounds]);

  useEffect(() => {
    metronomeRef.current = { on: metronomeOn, subdivision, volume };
  }, [metronomeOn, subdivision, volume]);

  useEffect(() => {
    setVoicePromptSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    setVoicePromptSupportKnown(true);
  }, []);
  const speakVoicePrompt = useCallback((text: string) => {
    if (!voicePrompts || !voicePromptSupported) return;
    try {
      const speech = voicePromptRef.current ?? window.speechSynthesis;
      voicePromptRef.current = speech;
      speech.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      speech.speak(utterance);
    } catch {}
  }, [voicePromptSupported, voicePrompts]);

  useEffect(() => {
    if (!voicePrompts || !voicePromptSupported) return;
    if (status === "countIn") speakVoicePrompt(countInBeat === 1 ? "Go" : String(countInBeat));
    else if (status === "running" && currentChord) speakVoicePrompt(currentChord.name);
  }, [countInBeat, currentChord, speakVoicePrompt, status, voicePromptSupported, voicePrompts]);

  useEffect(() => {
    if (status !== "paused" && status !== "complete") return;
    voicePromptRef.current?.cancel();
  }, [status]);

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
    }
    const loaded = parsePersistence(stored);
    persistenceLoadedRef.current = true;
    persistenceRef.current = loaded;
    setPersistence(loaded);
    if (!setupHydratedRef.current && loaded.lastSetup) {
      const storedSetup = loaded.lastSetup;
      setupHydratedRef.current = true;
      setLevelIndex(storedSetup.level); setDrillMode(storedSetup.drill); setPairFrom(storedSetup.pairFrom); setPairTo(storedSetup.pairTo); setKeepFrom(storedSetup.keepFrom); setKeepTo(storedSetup.keepTo);
      setProgressionId(storedSetup.progression); setChordFamily(storedSetup.family); setSongSetId(storedSetup.songId); setPace(storedSetup.pace); setRoundLength(storedSetup.length);
      setRhythmAware(storedSetup.rhythm); setRhythmBpm(storedSetup.bpm); setStrummingPrompt(storedSetup.strum); setGenrePack(storedSetup.genre); setRandomKey(storedSetup.randomKey); setWarmUp(storedSetup.warmUp); setTuningId(storedSetup.tuning); setCustomTuningLabel(storedSetup.customTuning); setCapoFret(storedSetup.capo); setHandedness(storedSetup.orientation);
      setNeckLock(storedSetup.neckLock); setCustomNeckMin(storedSetup.customNeckMin); setCustomNeckMax(storedSetup.customNeckMax); setLandingCheckpoint(storedSetup.landingCheckpoint);
      setupSignatureRef.current = JSON.stringify(storedSetup);
    } else setupHydratedRef.current = true;
      sessionIdRef.current = loaded.interruptedRound ? (loaded.trainerSessionId || `session-${Date.now()}`) : `session-${Date.now()}`;
      timelineRef.current = loaded.timeline;
      setSetupHydrationReady(true);
    return loaded;
  }, []);

  const savePersistence = useCallback((next: TrainerPersistence) => {
    const bounded: TrainerPersistence = {
      ...next,
      version: 10,
      transitions: Object.fromEntries(Object.entries(next.transitions).slice(-500)),
      chords: Object.fromEntries(Object.entries(next.chords).slice(-250)),
      history: next.history.slice(0, 60),
      notes: next.notes.slice(0, 50),
      rotation: Object.fromEntries(Object.entries(next.rotation).slice(0, 7)),
      reflections: next.reflections.slice(0, 30),
      sessions: next.sessions.slice(0, 30),
      performanceReflections: next.performanceReflections.slice(0, 30).map((item) => ({
        id: item.id.slice(0, 80),
        date: item.date.slice(0, 10),
        wentWell: item.wentWell.trim().slice(0, 300),
        lostTime: item.lostTime.trim().slice(0, 300),
        revisitTransition: item.revisitTransition.trim().slice(0, 80)
      })),
      datedPracticeGoal: next.datedPracticeGoal && /^\d{4}-\d{2}-\d{2}$/.test(next.datedPracticeGoal.date)
        ? { date: next.datedPracticeGoal.date, label: next.datedPracticeGoal.label.trim().slice(0, 120) }
        : null,
      snapshots: next.snapshots.slice(0, 48),
      milestones: next.milestones.slice(0, 3).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index),
      rehearsalNotes: next.rehearsalNotes.slice(0, 40),
      recoveryHistory: next.recoveryHistory.slice(0, 30),
      recipes: next.recipes.slice(0, 20).map((recipe) => ({
        ...recipe,
        id: recipe.id.slice(0, 80),
        name: recipe.name.trim().slice(0, 60),
        from: recipe.from.slice(0, 24),
        to: recipe.to.slice(0, 24),
        tuning: recipe.tuning.slice(0, 60),
        capo: clampNumber(recipe.capo, 0, 12, 0),
        notes: recipe.notes.slice(0, 300)
      })),
      instrumentProfile: Object.prototype.hasOwnProperty.call(INSTRUMENT_PROFILES, next.instrumentProfile) ? next.instrumentProfile : "acoustic",
      cloudBackupConsent: next.cloudBackupConsent === true,
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
      },
      lastSetup: next.lastSetup,
      interruptedRound: next.interruptedRound ? {
        ...next.interruptedRound,
        sequence: next.interruptedRound.sequence.slice(0, 40),
        feedback: Object.fromEntries(Object.entries(next.interruptedRound.feedback).slice(0, 40)),
        exposureTransitions: next.interruptedRound.exposureTransitions?.slice(0, 100),
        exposureRecovered: next.interruptedRound.exposureRecovered?.slice(0, 40),
        exposureKinds: next.interruptedRound.exposureKinds ? Object.fromEntries(Object.entries(next.interruptedRound.exposureKinds).slice(0, 40)) : undefined,
        freshCount: clampNumber(next.interruptedRound.freshCount, 0, 100, 0),
        repeatCount: clampNumber(next.interruptedRound.repeatCount, 0, 100, 0),
        freshClean: clampNumber(next.interruptedRound.freshClean, 0, 100, 0),
        repeatClean: clampNumber(next.interruptedRound.repeatClean, 0, 100, 0),
        effort: next.interruptedRound.effort === "comfortable" || next.interruptedRound.effort === "working" || next.interruptedRound.effort === "exhausting" ? next.interruptedRound.effort : null,
        placementConfirmed: next.interruptedRound.placementConfirmed === true,
        savedAt: Date.now()
      } : null,
      completedRounds: next.completedRounds.slice(0, 100).map((round) => ({
        ...round,
        sequence: round.sequence.slice(0, 40),
        shapeIds: round.shapeIds?.slice(0, 40),
        effort: round.effort === "comfortable" || round.effort === "working" || round.effort === "exhausting" ? round.effort : null,
        freshCount: round.freshCount === null || round.freshCount === undefined ? null : clampNumber(round.freshCount, 0, 100, 0),
        repeatCount: round.repeatCount === null || round.repeatCount === undefined ? null : clampNumber(round.repeatCount, 0, 100, 0),
        freshClean: round.freshClean === null || round.freshClean === undefined ? null : clampNumber(round.freshClean, 0, 100, 0),
        repeatClean: round.repeatClean === null || round.repeatClean === undefined ? null : clampNumber(round.repeatClean, 0, 100, 0),
        ratedCoverage: clampNumber(round.ratedCoverage, 0, 100, 0),
        tensionChecks: round.tensionChecks ? Object.fromEntries(Object.entries(round.tensionChecks).slice(0, 40).flatMap(([key, value]) => value === "relaxed" || value === "tense" ? [[key, value]] : [])) as Record<number, TransitionTension> : undefined,
        clarity: round.clarity ? {
          ...round.clarity,
          version: 1,
          shapeSignature: round.clarity.shapeSignature.slice(0, 8192),
          assistanceTrail: round.clarity.assistanceTrail.slice(0, 2400),
          adaptivePace: round.clarity.adaptivePace.slice(0, 160),
          tuning: round.clarity.tuning.slice(0, 40),
          capo: clampNumber(round.clarity.capo, 0, 12, 0),
          bpm: round.clarity.bpm === null ? null : clampNumber(round.clarity.bpm, 40, 120, 60)
        } : undefined
      })),
      retentionQueue: next.retentionQueue.slice(0, 20),
      onboardingComplete: next.onboardingComplete === true,
      favorites: next.favorites.slice(0, 2).map((favorite, index) => ({ id: favorite.id.slice(0, 80) || `favorite-${index}`, name: favorite.name.trim().slice(0, 60) || `Favorite ${index + 1}`, setup: favorite.setup })),
      shapeExclusions: next.shapeExclusions.slice(0, 50).map((item) => ({ key: item.key.slice(0, 140), libraryId: item.libraryId.slice(0, 100), harmony: item.harmony.slice(0, 50), label: item.label.slice(0, 80), date: item.date.slice(0, 10), replacementId: item.replacementId?.slice(0, 100) })),
      roundEvidence: next.roundEvidence.slice(0, 100),
      timeline: next.timeline.slice(0, 100),
      trainerSessionId: next.trainerSessionId.slice(0, 80),
      preferredShapes: Object.fromEntries(Object.entries(next.preferredShapes).slice(0, 50).map(([key, value]) => [key.slice(0, 80), value.slice(0, 100)]))
    };
    persistenceRef.current = bounded;
    setPersistence(bounded);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    } catch {
    }
  }, []);

  useEffect(() => {
    ensurePersistenceLoaded();
  }, [ensurePersistenceLoaded]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SECTION_PACE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<RehearsalSection, unknown>> & { paces?: Partial<Record<RehearsalSection, unknown>>; needs?: Partial<Record<RehearsalSection, unknown>> };
        const source = parsed.paces && typeof parsed.paces === "object" ? parsed.paces : parsed;
        setSectionPaces((current) => ({ ...current, ...Object.fromEntries((Object.keys(DEFAULT_SECTION_PACES) as RehearsalSection[]).flatMap((section) => typeof source[section] === "number" ? [[section, clampNumber(source[section], 2, 8, DEFAULT_SECTION_PACES[section])]] : [])) }));
        if (parsed.needs && typeof parsed.needs === "object") setSectionNeedsPractice(Object.fromEntries((Object.keys(DEFAULT_SECTION_PACES) as RehearsalSection[]).flatMap((section) => parsed.needs?.[section] === true ? [[section, true]] : [])));
      }
    } catch {}
    setSectionPacesHydrated(true);
  }, []);

  useEffect(() => {
    if (!sectionPacesHydrated) return;
    try { window.localStorage.setItem(SECTION_PACE_STORAGE_KEY, JSON.stringify({ paces: sectionPaces, needs: sectionNeedsPractice })); } catch {}
  }, [sectionNeedsPractice, sectionPaces, sectionPacesHydrated]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("chord-hero.trainer.display.v1");
      if (stored) {
        const prefs = JSON.parse(stored) as { density?: unknown; diagrams?: unknown; simple?: unknown; handedness?: unknown; textScale?: unknown; diagramVisibility?: unknown };
        if (prefs.density === "light" || prefs.density === "full") setDisplayPreference(prefs.density);
        if (prefs.diagrams === "large" || prefs.diagrams === "normal") setLargeDiagrams(prefs.diagrams === "large");
        if (prefs.simple === false || prefs.simple === true) setSimpleWorkspace(prefs.simple);
        if (prefs.handedness === "left" || prefs.handedness === "right") setDisplayHandedness(prefs.handedness);
        if (prefs.textScale === "large" || prefs.textScale === "normal") setTextScale(prefs.textScale);
        if (prefs.diagramVisibility === "minimal" || prefs.diagramVisibility === "visible") setDiagramVisibility(prefs.diagramVisibility);
      } else {
        const legacy = window.localStorage.getItem("chord-hero.trainer.display");
        if (legacy === "light" || legacy === "full") setDisplayPreference(legacy);
      }
    } catch {}
    displayPrefsRef.current = true;
    setDisplayPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!displayPrefsHydrated || !displayPrefsRef.current) return;
    try {
      window.localStorage.setItem("chord-hero.trainer.display.v1", JSON.stringify({ density: displayPreference, diagrams: largeDiagrams ? "large" : "normal", simple: simpleWorkspace, handedness: displayHandedness, textScale, diagramVisibility }));
    } catch {}
  }, [diagramVisibility, displayHandedness, displayPreference, displayPrefsHydrated, largeDiagrams, simpleWorkspace, textScale]);

  const persistSetup = useCallback((setup: TrainerSetup) => {
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, lastSetup: setup });
  }, [ensurePersistenceLoaded, savePersistence]);

  const recordTimelineEvent = useCallback((kind: TimelineEventKind, detail?: string, durationSeconds?: number) => {
    const event: TimelineEvent = { id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, at: Date.now(), detail: detail?.slice(0, 120), durationSeconds, sessionId: sessionIdRef.current };
    timelineRef.current = [event, ...timelineRef.current].slice(0, 100);
    if (!persistenceLoadedRef.current) return;
    const loaded = persistenceRef.current;
    savePersistence({ ...loaded, timeline: timelineRef.current, trainerSessionId: sessionIdRef.current });
  }, [savePersistence]);

  useEffect(() => {
    if (!persistenceLoadedRef.current || !setupHydrationReady || settingsLocked) return;
    const signature = JSON.stringify(currentSetup);
    if (setupSignatureRef.current === signature) return;
    setupSignatureRef.current = signature;
    persistSetup(currentSetup);
  }, [currentSetup, persistSetup, settingsLocked, setupHydrationReady]);

  useEffect(() => {
    setSelectedContact(null);
    cancelTransitionPreview();
  }, [cancelTransitionPreview, currentChord?.name, threeDGuideChord?.name]);
  useEffect(() => {
    if (!targetGuideVisible || assistanceLevel > 0 || displayPreference !== "full" || !threeDHandVisible) cancelTransitionPreview();
  }, [assistanceLevel, cancelTransitionPreview, displayPreference, targetGuideVisible, threeDHandVisible]);

  const restoreSetup = useCallback((setup: TrainerSetup | null = persistence.lastSetup) => {
    if (!setup || settingsLocked) return;
    setLevelIndex(Math.round(clampNumber(setup.level, 0, LEVELS.length - 1, 0)));
    setDrillMode(setup.drill);
    setPairFrom(setup.pairFrom);
    setPairTo(setup.pairTo);
    setKeepFrom(setup.keepFrom);
    setKeepTo(setup.keepTo);
    setProgressionId(setup.progression);
    setChordFamily(setup.family);
    setSongSetId(setup.songId);
    setPace(setup.pace);
    setRoundLength(setup.length);
    setRhythmAware(setup.rhythm);
    setRhythmBpm(setup.bpm);
    setStrummingPrompt(setup.strum);
    setGenrePack(setup.genre);
    setRandomKey(setup.randomKey);
    setWarmUp(setup.warmUp);
    setTuningId(setup.tuning);
    setCustomTuningLabel(setup.customTuning);
    setCapoFret(setup.capo);
    setHandedness(setup.orientation);
    setNeckLock(setup.neckLock);
    setCustomNeckMin(setup.customNeckMin);
    setCustomNeckMax(setup.customNeckMax);
    setLandingCheckpoint(setup.landingCheckpoint);
    setShareMessage("Last drill settings restored. Press Start when you are ready.");
  }, [persistence.lastSetup, settingsLocked]);

  const saveInterruptedRound = useCallback(() => {
    if (benchmarkActive || sequence.length < 2 || (status !== "running" && status !== "paused" && status !== "countIn")) return;
    const loaded = ensurePersistenceLoaded();
    const remaining = status === "running" || status === "countIn" ? Math.max(0, deadlineRef.current - Date.now()) : Math.max(0, resumeRemainingRef.current ?? secondsLeft * 1000);
    const savedPhase: "countIn" | "running" = status === "countIn" ? "countIn" : status === "running" ? "running" : pausedFrom;
    savePersistence({ ...loaded, interruptedRound: { sequence: sequence.map((chord) => chord.name), shapeIds: sequence.map((chord) => libraryItemForChord(chord)?.id ?? "").slice(0, 40), currentIndex, feedback: feedbackRef.current, secondsLeft, remainingMs: remaining, elapsedSeconds: roundStartedAtRef.current ? Math.max(0, Math.round((Date.now() - roundStartedAtRef.current) / 1000)) : 0, config: roundConfig, setup: currentSetup, roundId: roundIdRef.current, savedAt: Date.now(), pausedFrom: savedPhase, countInBeat, exposureTransitions: Array.from(exposureRef.current.transitions).slice(0, 100), exposureRecovered: Array.from(exposureRef.current.recovered).slice(0, 40), exposureKinds: exposureRef.current.kinds, freshCount: exposureRef.current.fresh, repeatCount: exposureRef.current.repeat, freshClean: exposureRef.current.freshClean, repeatClean: exposureRef.current.repeatClean, effort: effortRef.current, placementConfirmed }, lastSetup: currentSetup });
  }, [benchmarkActive, countInBeat, currentIndex, currentSetup, ensurePersistenceLoaded, pausedFrom, placementConfirmed, roundConfig, savePersistence, secondsLeft, sequence, status]);

  saveInterruptedRoundRef.current = saveInterruptedRound;
  useEffect(() => {
    if (sequence.length < 2 || !["running", "paused", "countIn"].includes(status)) return;
    saveInterruptedRoundRef.current();
  }, [currentIndex, feedback, roundConfig, sequence, status]);
  useEffect(() => {
    const handlePageHide = () => saveInterruptedRoundRef.current();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  const importSongCoachSets = useCallback(async () => {
    const { readSongLibraryState, songChords } = await import("../../lib/songLibrary");
    const available = readSongLibraryState().songs.slice(0, 100).flatMap((song) => {
      const chords = songChords(song).slice(0, 64).flatMap((name) => {
        const exact = CHORD_LOOKUP.get(name);
        if (exact) return [exact];
        const normalized = name.replace(/\([^)]*\)|\/.*$/g, "");
        const fallback = CHORD_LOOKUP.get(normalized);
        return fallback ? [fallback] : [];
      });
      const unique = Array.from(new Map(chords.map((chord) => [chord.name, chord])).values());
      return unique.length >= 2 ? [{ id: song.id, title: `${song.title} · ${song.artist}`, chords: unique, route: chords }] : [];
    });
    setSongSets(available);
    setSongSetId((current) => available.some((set) => set.id === current) ? current : available[0]?.id ?? "");
    setSongImportMessage(available.length ? `${available.length} saved Song Coach ${available.length === 1 ? "set" : "sets"} ready.` : "No saved Song Coach song has two supported chord shapes yet.");
  }, []);

  useEffect(() => {
    if (drillMode === "song") void importSongCoachSets();
  }, [drillMode, importSongCoachSets]);

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
      } catch {}
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
    } catch {}
  }, [ensureAudioContext]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const classifyExposure = useCallback((index: number, forceRepeat = false) => {
    if (index <= 0 || !sequence[index] || !sequence[index - 1]) return;
    const key = transitionKey(sequence[index - 1], sequence[index]);
    const existing = exposureRef.current.kinds[index];
    if (forceRepeat && existing === "fresh") {
      exposureRef.current.fresh = Math.max(0, exposureRef.current.fresh - 1);
      exposureRef.current.repeat += 1;
      exposureRef.current.kinds[index] = "repeat";
      exposureRef.current.recovered.add(index);
      setFreshCount(exposureRef.current.fresh);
      setRepeatCount(exposureRef.current.repeat);
      return;
    }
    if (existing) return;
    const kind = exposureRef.current.transitions.has(key) || forceRepeat ? "repeat" : "fresh";
    exposureRef.current.transitions.add(key);
    exposureRef.current.kinds[index] = kind;
    if (kind === "fresh") exposureRef.current.fresh += 1;
    else { exposureRef.current.repeat += 1; if (forceRepeat) exposureRef.current.recovered.add(index); }
    setFreshCount(exposureRef.current.fresh);
    setRepeatCount(exposureRef.current.repeat);
  }, [sequence]);

  const finishRound = useCallback(() => {
    if (roundFinishedRef.current) return;
    roundFinishedRef.current = true;
    clearTimer();
    setSecondsLeft(0);
    setStatus("complete");
  }, [clearTimer]);

  const finishEarlyRound = useCallback(() => {
    if (status !== "running" && status !== "paused" && status !== "countIn") return;
    setFinishEarly(true);
    finishRound();
  }, [finishRound, status]);

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
    const snapshotAccuracy = Object.keys(feedbackRef.current).length ? Math.round((summary.clean / Object.keys(feedbackRef.current).length) * 100) : 0;
    const snapshotConfidence = Math.round(snapshotAccuracy * 0.55 + (rhythmRef.current.aware || strummingPrompt !== "none" ? snapshotAccuracy : 50) * 0.2 + (Object.values(current.performanceChecklist).filter(Boolean).length / 5) * 25);
    const weekId = `week:${snapshotWeekKey()}`;
    const monthId = `month:${day.slice(0, 7)}`;
    const snapshotBase = { date: day, accuracy: snapshotAccuracy, clean: summary.clean, pace: typeof roundConfig.pace === "number" ? roundConfig.pace : null, confidence: snapshotConfidence, readiness: Object.values(current.readiness.checks).filter(Boolean).length };
    const nextSnapshots = [
      ...(!current.snapshots.some((snapshot) => snapshot.id === weekId) ? [{ id: weekId, period: "week" as const, ...snapshotBase }] : []),
      ...(!current.snapshots.some((snapshot) => snapshot.id === monthId) ? [{ id: monthId, period: "month" as const, ...snapshotBase }] : []),
      ...current.snapshots
    ].slice(0, 48);
    const milestoneCandidates: MilestoneId[] = [];
    if (perfect && sequence.some((chord) => Boolean(chord.barre))) milestoneCandidates.push("firstCleanBarre");
    if (hasConsecutivePracticeDays(nextHistory, 7)) milestoneCandidates.push("sevenDayStreak");
    const completedRound: CompletedRound = {
      id: roundIdRef.current,
      date: day,
      drill: roundConfig.drillLabel,
      song: selectedSongSet?.title ?? "",
      pace: roundConfig.pace,
      note: "",
      sequence: sequence.slice(0, 40).map((chord) => chord.name),
      ratings: summary,
      predictedCleanRate,
      criteria: cleanCriteria.slice(0, 3),
      criteriaChecks: Object.fromEntries(Object.entries(criteriaChecks).slice(0, 40)),
      transitionResults: Object.entries(feedbackRef.current).slice(0, 40).flatMap(([rawIndex, rating]) => { const index = Number(rawIndex); const chord = sequence[index]; return chord ? [{ key: transitionKey(sequence[index - 1] ?? null, chord), rating }] : []; }),
      missTags: Object.fromEntries(Object.entries(missTags).slice(0, 40).map(([index, tags]) => [index, tags.slice(0, 4)])),
      retentionSourceId: retentionSourceRef.current?.id,
      retentionIntervalDays: retentionSourceRef.current?.days,
      sessionId: sessionIdRef.current || `session-${Date.now()}`,
      effort: effortRef.current,
      freshCount: Object.keys(feedbackRef.current).length ? exposureRef.current.fresh : null,
      repeatCount: Object.keys(feedbackRef.current).length ? exposureRef.current.repeat : null,
      freshClean: Object.keys(feedbackRef.current).length ? exposureRef.current.freshClean : null,
      repeatClean: Object.keys(feedbackRef.current).length ? exposureRef.current.repeatClean : null,
      ratedCoverage: roundConfig.length ? Math.round((Object.keys(feedbackRef.current).length / roundConfig.length) * 100) : 0,
      shapeIds: sequence.slice(0, 40).map((chord) => libraryItemForChord(chord)?.id ?? ""),
      tensionChecks: Object.fromEntries(Object.entries(tensionChecks).slice(0, 40)),
      clarity: {
        ...currentClarityContext,
        assistanceTrail: assistanceTrailRef.current.join("|"),
        shapeSignature: shapeSignature(sequence, sequence.map((chord) => libraryItemForChord(chord)?.id ?? "")),
        assistance: assistanceEnabled ? (assistanceStage(summary.clean, summary.missed, true) === 2 ? "stage2" : assistanceStage(summary.clean, summary.missed, true) === 1 ? "stage1" : "off") : "off"
        ,instrumentProfile: current.instrumentProfile,
        position: current.lastSetup?.neckLock ?? "off",
        setupKnown: true
      }
    };
    retentionSourceRef.current = null;
    const evidence: RoundEvidence = {
      id: completedRound.id,
      sessionId: completedRound.sessionId ?? sessionIdRef.current,
      date: day,
      rated: Object.keys(feedbackRef.current).length,
      accuracy: snapshotAccuracy,
      pace: roundConfig.pace,
      effort: effortRef.current,
      fresh: Object.keys(feedbackRef.current).length ? exposureRef.current.fresh : null,
      repeat: Object.keys(feedbackRef.current).length ? exposureRef.current.repeat : null
      ,freshClean: Object.keys(feedbackRef.current).length ? exposureRef.current.freshClean : null,
      repeatClean: Object.keys(feedbackRef.current).length ? exposureRef.current.repeatClean : null
    };
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
      snapshots: nextSnapshots,
      milestones: mergeMilestones(current.milestones, milestoneCandidates),
      completedRounds: [completedRound, ...current.completedRounds.filter((round) => round.id !== completedRound.id)].slice(0, 100),
      roundEvidence: [evidence, ...current.roundEvidence.filter((item) => item.id !== evidence.id)].slice(0, 100),
      timeline: [{ id: `event-${Date.now()}`, kind: "finish" as const, at: Date.now(), durationSeconds: elapsedSeconds, detail: roundConfig.drillLabel, sessionId: sessionIdRef.current }, ...current.timeline].slice(0, 100),
      trainerSessionId: sessionIdRef.current || current.trainerSessionId || `session-${Date.now()}`,
      interruptedRound: null
    });
    setPredictedCleanRate(null);
    if (Date.now() - sessionStartedAtRef.current >= 20 * 60 * 1000) setRestPrompt("You have practiced for about 20 minutes. Take two minutes to loosen your hands and shoulders.");
  }, [assistanceEnabled, cleanCriteria, criteriaChecks, currentClarityContext, missTags, predictedCleanRate, roundConfig.drillLabel, roundConfig.length, roundConfig.pace, savePersistence, selectedSongSet, sequence, status, strummingPrompt, tensionChecks]);

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
            setPlacementConfirmed(!landingCheckpoint);
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
    if (landingCheckpoint && !placementConfirmed) {
      setSecondsLeft(0);
      return;
    }
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
        if (currentIndex + 1 < sequence.length) { classifyExposure(currentIndex + 1); setCurrentIndex((index) => index + 1); setPlacementConfirmed(!landingCheckpoint); }
        else finishRound();
        return;
      }
      timerRef.current = setTimeout(tick, Math.min(TICK_MS, remaining));
    };
    timerRef.current = setTimeout(tick, Math.min(TICK_MS, duration));
    return clearTimer;
  }, [benchmarkActive, classifyExposure, clearTimer, countInBeat, currentIndex, finishRound, landingCheckpoint, placementConfirmed, playClick, playGroove, recoveryNonce, roundConfig.pace, roundConfig.pacePlan, sequence.length, status]);

  useEffect(() => () => {
    clearTimer();
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    voicePromptRef.current?.cancel();
    void audioContextRef.current?.close();
  }, [clearTimer]);

  const beginCountIn = useCallback(() => {
    resumeRemainingRef.current = null;
    setCountInBeat(rehearsalMode ? 4 : 3);
    setStatus("countIn");
  }, [rehearsalMode]);

  const startRound = useCallback(async (explicitSetup?: Partial<TrainerSetup>, reviewOnly = false, sectionOverride?: { section: RehearsalSection; chunkSize: 4 | 8 }, exactRoute?: Chord[]) => {
    const setup = { ...currentSetup, ...explicitSetup };
    if (explicitSetup) {
      setLevelIndex(setup.level); setDrillMode(setup.drill); setPairFrom(setup.pairFrom); setPairTo(setup.pairTo); setKeepFrom(setup.keepFrom); setKeepTo(setup.keepTo);
      setProgressionId(setup.progression); setChordFamily(setup.family); setSongSetId(setup.songId); setPace(setup.pace); setRoundLength(setup.length);
      setRhythmAware(setup.rhythm); setRhythmBpm(setup.bpm); setStrummingPrompt(setup.strum); setGenrePack(setup.genre); setRandomKey(setup.randomKey); setWarmUp(setup.warmUp); setTuningId(setup.tuning); setCustomTuningLabel(setup.customTuning); setCapoFret(setup.capo); setHandedness(setup.orientation);
      setNeckLock(setup.neckLock); setCustomNeckMin(setup.customNeckMin); setCustomNeckMax(setup.customNeckMax); setLandingCheckpoint(setup.landingCheckpoint);
    }
    persistSetup(setup);
    const saved = ensurePersistenceLoaded();
    const setupLevel = LEVELS[setup.level] ?? activeLevel;
    const lockedChords = constrainedLevelChords(setupLevel.chords, new Set(saved.shapeExclusions.map((item) => item.key)), saved.preferredShapes, setup.neckLock, setup.customNeckMin, setup.customNeckMax);
    if (lockedChords.length < 2) {
      setShareMessage(`No round started: ${setup.neckLock === "off" ? "the current level" : `the ${setup.neckLock} neck position lock`} has fewer than two available chord shapes after exclusions.`);
      return;
    }
    if (!silentPractice && (metronomeOn || backingGroove)) {
      try { await ensureAudioContext(); } catch {}
    }
    const barreChords = lockedChords.filter((chord) => Boolean(chord.barre));
    const familyChords = lockedChords.filter((chord) => chordFamilyMatches(chord, setup.family));
    const vocabularyChords = lockedChords.filter((chord) => personalVocabulary.includes(chord.name));
    const vocabularyRound = vocabularyOnly && vocabularyChords.length >= 2;
    const drillChords = vocabularyRound
      ? vocabularyChords
      : setup.drill === "barre" && barreChords.length
      ? barreChords
      : setup.drill === "family" && familyChords.length ? familyChords : lockedChords;
    const fromChord = lockedChords.find((chord) => chord.name === setup.pairFrom);
    const toChord = lockedChords.find((chord) => chord.name === setup.pairTo);
    const pair = setup.drill === "pair" && fromChord && toChord ? ([fromChord, toChord] as [Chord, Chord]) : null;
    const keepLeft = lockedChords.find((chord) => chord.name === setup.keepFrom);
    const keepRight = lockedChords.find((chord) => chord.name === setup.keepTo);
    const keepDrillPair = setup.drill === "keepFingers" && keepLeft && keepRight && sharedFrettedPositions(keepLeft, keepRight).length
      ? ([keepLeft, keepRight] as [Chord, Chord]) : null;
    const goalFromChord = lockedChords.find((chord) => chord.name === effectiveGoalFrom);
    const goalToChord = lockedChords.find((chord) => chord.name === effectiveGoalTo);
    const goalPair = transitionGoalOn && setup.drill === "random" && goalFromChord && goalToChord ? ([goalFromChord, goalToChord] as [Chord, Chord]) : null;
    const transposed = setup.drill === "progression" && setup.randomKey ? transposeProgression(lockedChords, setup.progression, setup.length) : null;
    const ladderBase = setup.drill === "neckLadder" ? buildProgression(CHORD_LIBRARY.map((item) => item.chord), setup.progression, 4) : [];
    const ladderSteps = setup.drill === "neckLadder" ? buildNeckLadder(ladderBase, CHORD_LIBRARY, sameHarmony) : [];
    const ladderSequence = ladderSteps.flatMap((step) => step.route);
    const genreSequence = setup.drill === "genre" ? buildNamedSequence(lockedChords, GENRE_PACKS[setup.genre].names, setup.length) : null;
    const transferChords = transferPair && setup.drill === "progression" ? transferPair.flatMap((name) => lockedChords.find((chord) => chord.name === name) ? [lockedChords.find((chord) => chord.name === name)!] : []) : [];
    const transferAlternatives = lockedChords.filter((chord) => !transferPair?.includes(chord.name)).slice(0, 2);
    const transferredSequence = transferChords.length === 2 && transferAlternatives.length ? Array.from({ length: setup.length }, (_, index) => [transferChords[0], transferChords[1], ...transferAlternatives][index % (2 + transferAlternatives.length)]) : null;
    const setupSongSet = songSets.find((set) => set.id === setup.songId) ?? selectedSongSet;
    const songPool = setupSongSet ? setupSongSet.chords.flatMap((chord) => lockedChords.find((candidate) => sameHarmony(candidate, chord)) ? [lockedChords.find((candidate) => sameHarmony(candidate, chord))!] : []) : [];
    const selectedSection = setup.drill === "song" ? (sectionOverride ?? (sectionDrillOn && setupSongSet ? { section: rehearsalSection, chunkSize: sectionChunkSize } : null)) : null;
    const sectionPool = selectedSection && setupSongSet
      ? namedSectionChunk(songPool, selectedSection.section, selectedSection.chunkSize)
      : [];
    const nextSequence = exactRoute ?? transferredSequence ?? (setup.drill === "neckLadder"
      ? ladderSequence
      : vocabularyRound
      ? buildSequence(vocabularyChords, setup.length, saved.transitions, null)
      : setup.drill === "progression"
      ? transposed?.sequence ?? buildProgression(lockedChords, setup.progression, setup.length)
      : setup.drill === "genre"
        ? genreSequence ?? buildSequence(lockedChords, setup.length, saved.transitions, null)
      : setup.drill === "surprise"
        ? buildSurpriseSequence(lockedChords, setup.length, saved.transitions)
      : setup.drill === "song" && setupSongSet
        ? selectedSection ? sectionPool.slice(0, selectedSection.chunkSize) : buildSequence(songPool, setup.length, saved.transitions, null)
      : buildSequence(drillChords, setup.length, saved.transitions, pair ?? keepDrillPair ?? goalPair));
    if (setup.drill === "pair" && !pair) { setShareMessage("This pair is unavailable under the current neck lock or shape exclusions; choose another pair."); return; }
    if (setup.drill === "keepFingers" && !keepDrillPair) { setShareMessage("Keep-fingers drill unavailable: the selected physical shapes do not share a fretted anchor under this lock."); return; }
    if (setup.drill === "family" && familyChords.length < 2) { setShareMessage("This chord family has fewer than two available shapes under the current lock."); return; }
    if (setup.drill === "genre" && !genreSequence) { setShareMessage("This genre pack has fewer than two available catalog shapes under the current lock."); return; }
    if (setup.drill === "neckLadder" && !ladderSteps.length) { setShareMessage("Neck ladder unavailable: the catalog does not contain the complete selected progression in multiple fret-position bands."); return; }
    if (setup.drill === "song" && songPool.length < 2) { setShareMessage("This song has fewer than two available shapes under the current lock or exclusions."); return; }
    if (selectedSection && sectionPool.length < 2) { setShareMessage("That named section chunk has fewer than two supported imported chord shapes; choose another chunk."); return; }
    const drillLabel = selectedSection && setupSongSet
      ? `${setupSongSet.title} · ${selectedSection.section[0].toUpperCase()}${selectedSection.section.slice(1)} chunk (up to ${selectedSection.chunkSize}; ${sectionPool.length} available)`
      : transferChords.length === 2 && transferAlternatives.length
      ? `Mastered pair in ${PROGRESSIONS[setup.progression].label}`
      : vocabularyRound
      ? `Personal vocabulary · ${vocabularyChords.map((chord) => chord.name).join(", ")}`
      : setup.drill === "pair"
        ? `${setup.pairFrom} → ${setup.pairTo}`
        : setup.drill === "barre"
          ? barreChords.length
            ? "Barre chords"
            : "Random level (no barre chords in this level)"
          : setup.drill === "neckLadder"
            ? `Neck ladder · ${PROGRESSIONS[setup.progression].label} · ${ladderSteps.map((step) => step.band).join(" → ")}`
          : setup.drill === "progression"
            ? `${PROGRESSIONS[setup.progression].label}${transposed ? ` · ${transposed.keyLabel}` : ""}`
            : setup.drill === "song"
              ? setupSongSet?.title ?? "Saved Song Coach set unavailable"
              : setup.drill === "family"
                ? familyChords.length ? FAMILY_LABELS[setup.family] : `${FAMILY_LABELS[setup.family]} unavailable · level fallback`
                : setup.drill === "keepFingers"
                  ? keepDrillPair ? `${setup.keepFrom} ↔ ${setup.keepTo} · keep fingers down` : "Keep-fingers drill unavailable"
                  : setup.drill === "genre"
                    ? `${GENRE_PACKS[setup.genre].label}${genreSequence ? "" : " · unavailable"}`
                    : setup.drill === "surprise"
                      ? "Surprise me · familiar + targeted challenge"
              : "Adaptive random level";
    if (!nextSequence.length) return;
    const effectiveLength = nextSequence.length;
    if (selectedSection) setRoundLength(effectiveLength);
    const nextConfig = { length: effectiveLength, pace: setup.pace, drillLabel, pacePlan: buildPacePlan(effectiveLength, setup.pace, setup.warmUp) };
    setRoundConfig(nextConfig);
    setSequence(nextSequence);
    assistanceTrailRef.current = [];
    setBenchmarkActive(false);
    benchmarkDeadlineRef.current = 0;
    setCurrentIndex(-1);
    setFeedback({});
    feedbackRef.current = {};
    setMissTags({});
    ratedIndicesRef.current = new Set();
    roundFinishedRef.current = false;
    roundPersistedRef.current = false;
    undoSnapshotRef.current = null;
    runtimePaceRef.current = typeof setup.pace === "number" ? setup.pace : 3;
    adaptivePaceHistoryRef.current = [runtimePaceRef.current];
    cleanRecoveryRef.current = 0;
    consecutiveMissesRef.current = 0;
    roundStartedAtRef.current = Date.now();
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = Date.now();
    roundIdRef.current = `round-${Date.now()}`;
    if (!sessionIdRef.current) sessionIdRef.current = `session-${Date.now()}`;
    effortRef.current = null; setEffortRating(null);
    setPlacementConfirmed(!setup.landingCheckpoint);
    const practiceEvent: TimelineEvent = { id: `event-${Date.now()}`, kind: "practice", at: Date.now(), detail: setup.drill, sessionId: sessionIdRef.current };
    timelineRef.current = [practiceEvent, ...timelineRef.current].slice(0, 100);
    setRoundNote("");
    setNoteSaved(false);
    setRoundRecoveries(0);
    setAssistanceRevealed(false);
    setFinishEarly(false);
    setReviewMode("closed");
    setComparisonMessage("");
    setNextPracticeSaved(false);
    setMicroGoalProgress(0);
    setPostConfidence(3);
    setTensionChecks({});
    setCriteriaChecks({});
    setRecallRevealed(false);
    setGuideVisible(false);
    setSessionSaved(false);
    setSelectedHistoryIndex(null);
    setSecondsLeft(0);
    if (reviewOnly || previewEnabled) setStatus("preview");
    else beginCountIn();
  }, [activeLevel, backingGroove, beginCountIn, currentSetup, effectiveGoalFrom, effectiveGoalTo, ensureAudioContext, ensurePersistenceLoaded, metronomeOn, persistSetup, personalVocabulary, previewEnabled, rehearsalSection, sectionChunkSize, sectionDrillOn, selectedSongSet, silentPractice, songSets, transferPair, transitionGoalOn, vocabularyOnly]);

  const startSectionDrill = useCallback(() => {
    if (!selectedSongSet || settingsLocked) return;
    setSectionDrillOn(true);
    void startRound({ ...currentSetup, drill: "song", songId: selectedSongSet.id, length: sectionChunkSize, pace: sectionPaces[rehearsalSection] }, false, { section: rehearsalSection, chunkSize: sectionChunkSize });
  }, [currentSetup, rehearsalSection, sectionChunkSize, sectionPaces, selectedSongSet, settingsLocked, startRound]);

  const markSectionNeedsPractice = useCallback(() => {
    if (!selectedSongSet) return;
    setSectionNeedsPractice((current) => ({ ...current, [rehearsalSection]: true }));
    setShareMessage(`${rehearsalSection[0].toUpperCase()}${rehearsalSection.slice(1)} marked as needs practice locally.`);
  }, [rehearsalSection, selectedSongSet]);

  const startPositionQuiz = useCallback(() => {
    const choices = voicingMapEntries.slice(0, 6);
    const target = choices[Math.floor(Math.random() * choices.length)] ?? null;
    if (!target) return;
    setPositionQuiz({ targetId: target.id, choice: "", committed: false });
  }, [voicingMapEntries]);

  const applyEmergencyWarmUp = useCallback(() => {
    if (status !== "idle" && status !== "complete") return;
    setRoundLength(20);
    setPace(3);
    setWarmUp(true);
    setDrillMode("random");
    setPreviewEnabled(false);
    setAdaptivePacing(true);
    setShareMessage("One-minute warm-up loaded: 20 quick shapes with a gentle pace ramp.");
  }, [status]);

  const startRecommended = useCallback(() => {
    if (status !== "idle" && status !== "complete") return;
    const [from = "", to = ""] = levelWeakPair ?? [];
    const canUseWeakPair = Boolean(levelWeakPair);
    const canUsePair = canUseWeakPair || availableLevelChords.length >= 2;
    const setup: Partial<TrainerSetup> = { drill: canUsePair ? "pair" : "random", pairFrom: canUseWeakPair ? from : effectivePairFrom, pairTo: canUseWeakPair ? to : effectivePairTo, length: 5, pace: 6 };
    void startRound(setup);
  }, [availableLevelChords, effectivePairFrom, effectivePairTo, levelWeakPair, startRound, status]);

  const saveFavoriteSetup = useCallback(() => {
    const name = favoriteName.trim().slice(0, 60);
    if (!name || settingsLocked) return;
    const loaded = ensurePersistenceLoaded();
    const favorite: FavoriteSetup = { id: `favorite-${Date.now()}`, name, setup: currentSetup };
    savePersistence({ ...loaded, favorites: [favorite, ...loaded.favorites].slice(0, 2) });
    setFavoriteName("");
    setShareMessage(`Saved “${name}” as a pinned Trainer setup.`);
  }, [currentSetup, ensurePersistenceLoaded, favoriteName, savePersistence, settingsLocked]);

  const removeFavoriteSetup = useCallback((id: string) => {
    if (settingsLocked) return;
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, favorites: loaded.favorites.filter((favorite) => favorite.id !== id) });
  }, [ensurePersistenceLoaded, savePersistence, settingsLocked]);

  const excludeShape = useCallback((chord: Chord | null) => {
    if (!chord || settingsLocked) return;
    const item = libraryItemForChord(chord);
    if (!item) return;
    const key = shapeCatalogKey(item);
    const loaded = ensurePersistenceLoaded();
    if (loaded.shapeExclusions.some((entry) => entry.key === key)) return;
    const harmony = `${item.root} ${item.quality}`;
    savePersistence({ ...loaded, shapeExclusions: [{ key, libraryId: item.id, harmony, label: `${item.chord.name} · ${item.position}`, date: localDateKey() }, ...loaded.shapeExclusions].slice(0, 50) });
    setShareMessage(`${item.chord.name} · ${item.position} excluded from future rounds; harmony remains available if another shape exists.`);
  }, [ensurePersistenceLoaded, savePersistence, settingsLocked]);

  const preferShape = useCallback((item: { id: string; chord: Chord; root: string; quality: string }) => {
    if (settingsLocked) return;
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, preferredShapes: { ...loaded.preferredShapes, [`${item.root}|${item.quality}`]: item.id } });
    setShareMessage(`${item.id} will be preferred for future rounds when its harmony is selected.`);
  }, [ensurePersistenceLoaded, savePersistence, settingsLocked]);

  const restoreShape = useCallback((key: string) => {
    if (settingsLocked) return;
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, shapeExclusions: loaded.shapeExclusions.filter((entry) => entry.key !== key) });
  }, [ensurePersistenceLoaded, savePersistence, settingsLocked]);

  const reviewTrainerStorage = useCallback(async () => {
    let localBytes = 0;
    try { localBytes = new Blob([JSON.stringify(ensurePersistenceLoaded())]).size; } catch { localBytes = 0; }
    let quota: number | null = null;
    try { quota = (await navigator.storage?.estimate?.()).quota ?? null; } catch { quota = null; }
    setStorageEstimate({ localBytes, quota });
    setStorageReview("review");
  }, [ensurePersistenceLoaded]);

  const deleteTrainerProgress = useCallback(() => {
    if (status !== "idle" && status !== "complete") return;
    if (recording || captureStartingRef.current || mediaRecorderRef.current?.state === "recording") {
      setShareMessage("Finish or stop the active recording before deleting Trainer progress.");
      return;
    }
    if (storageReview !== "armed") { setStorageReview("armed"); return; }
    const loaded = ensurePersistenceLoaded();
    takesRef.current.forEach((take) => URL.revokeObjectURL(take.url));
    takesRef.current = [];
    setTakes([]);
    savePersistence({ ...DEFAULT_PERSISTENCE, trainerSessionId: loaded.trainerSessionId || `session-${Date.now()}` });
    setStorageReview("closed");
    setShareMessage("Trainer progress and Trainer-owned takes were removed. Downloaded offline files remain outside browser storage.");
  }, [ensurePersistenceLoaded, recording, savePersistence, status, storageReview]);

  const applyLast10Minutes = useCallback(() => {
    if (settingsLocked) return;
    const weakKey = transitionMap.weak[0]?.[0] ?? "";
    const [from, to] = weakKey.split(" → ");
    const canUsePair = from && to && activeLevel.chords.some((chord) => chord.name === from) && activeLevel.chords.some((chord) => chord.name === to);
    setRoundLength(5);
    setPace(performanceConfidence.score < 55 ? 6 : 4);
    setWarmUp(true);
    setAdaptivePacing(true);
    if (canUsePair) { setPairFrom(from); setPairTo(to); setDrillMode("pair"); }
    else if (selectedSongSet && sessionIntent !== "barre") setDrillMode("song");
    else setDrillMode(sessionIntent === "barre" ? "barre" : "random");
    setShareMessage(`Last 10 minutes loaded: ${canUsePair ? `${from} → ${to}` : selectedSongSet ? selectedSongSet.title : "a gentle adaptive warm-up"}.`);
  }, [activeLevel.chords, performanceConfidence.score, selectedSongSet, sessionIntent, settingsLocked, transitionMap.weak]);

  const queueForTomorrow = useCallback(() => {
    if (status !== "complete") return;
    const loaded = ensurePersistenceLoaded();
    const entry: RetentionEntry = { id: `tomorrow-${roundIdRef.current}`, due: localDateKey(new Date(Date.now() + 86_400_000)), label: recommendedNextPractice.label, setup: recommendedNextPractice.setup };
    savePersistence({ ...loaded, retentionQueue: [entry, ...loaded.retentionQueue.filter((item) => item.id !== entry.id)].slice(0, 20) });
    setNextPracticeSaved(true);
    setShareMessage(`Next practice saved: ${recommendedNextPractice.label}. Load it from the in-app retention queue when you return.`);
  }, [ensurePersistenceLoaded, recommendedNextPractice, savePersistence, status]);

  const scheduleRetentionChecks = useCallback(() => {
    if (status !== "complete") return;
    const loaded = ensurePersistenceLoaded();
    const source = loaded.completedRounds.find((round) => round.id === roundIdRef.current);
    if (!source || source.sequence.length < 2 || !source.shapeIds || source.shapeIds.length !== source.sequence.length || source.shapeIds.some((id) => !id || !CHORD_ITEM_LOOKUP.has(id))) {
      setShareMessage("Retention checks need a completed round with a fully identified physical-shape route; this legacy or unsupported route was not randomized."); return;
    }
    if (typeof source.pace !== "number") { setShareMessage("Retention checks need a saved numeric pace; this manual round was not assigned an invented tempo."); return; }
    const exactPace = source.pace;
    const entries: RetentionEntry[] = ([1, 7] as const).map((days) => ({ id: `retention-${source.id}-${days}`, sourceId: source.id, intervalDays: days, due: localDateKey(new Date(Date.now() + days * 86_400_000)), label: `${days}-day exact-route check · ${source.sequence.slice(0, 3).join(" → ")}`, setup: currentSetup, sequence: source.sequence, shapeIds: source.shapeIds, pace: exactPace }));
    savePersistence({ ...loaded, retentionQueue: [...entries, ...loaded.retentionQueue.filter((item) => !entries.some((entry) => entry.id === item.id))].slice(0, 20) });
    setShareMessage("Exact-route retention checks saved locally for 1 and 7 days later.");
  }, [currentSetup, ensurePersistenceLoaded, savePersistence, status]);

  const loadCompletedRoundReplay = useCallback((round: CompletedRound) => {
    if (status !== "idle" && status !== "complete") return;
    const exact = round.shapeIds?.length === round.sequence.length
      ? round.shapeIds.map((id) => CHORD_ITEM_LOOKUP.get(id)?.chord ?? null)
      : [];
    const restored = exact.length === round.sequence.length && exact.every(Boolean)
      ? exact as Chord[]
      : round.sequence.flatMap((name) => CHORD_LOOKUP.get(name) ? [CHORD_LOOKUP.get(name)!] : []);
    if (restored.length < 2) { setShareMessage("This legacy round cannot be replayed: its chord catalog entries are no longer available."); return; }
    clearTimer();
    roundFinishedRef.current = false;
    roundPersistedRef.current = false;
    roundIdRef.current = `replay-${Date.now()}`;
    roundStartedAtRef.current = Date.now();
    benchmarkDeadlineRef.current = 0;
    setBenchmarkActive(false);
    exposureRef.current = { transitions: new Set(), recovered: new Set(), kinds: {}, fresh: 0, repeat: 0, freshClean: 0, repeatClean: 0 };
    setFreshCount(0); setRepeatCount(0); effortRef.current = null; setEffortRating(null);
    setSequence(restored);
    setRoundConfig({ length: restored.length, pace: round.pace, drillLabel: `Replay · ${round.drill}`, pacePlan: buildPacePlan(restored.length, round.pace, false) });
    setPace(round.pace);
    setCurrentIndex(-1); setFeedback({}); setMissTags({}); feedbackRef.current = {}; ratedIndicesRef.current = new Set();
    setTensionChecks({});
    const clarity = round.clarity;
    if (clarity) {
      setCapoFret(clarity.capo);
      const knownTuning = "standard dropD dadgad openG custom".split(" ");
      if (knownTuning.includes(clarity.tuning as TuningId)) setTuningId(clarity.tuning as TuningId);
      else { setTuningId("custom"); setCustomTuningLabel(clarity.tuning); }
      setChallengeMode(clarity.challenge); setDisplayPreference(clarity.diagram === "light" ? "light" : "full"); setDiagramVisibility(clarity.diagramVisibility === "minimal" ? "minimal" : "visible");
      setPreviewEnabled(clarity.preview === true); setLandingCheckpoint(clarity.landing === true); setWarmUp(clarity.warmUp === true); setAdaptivePacing(clarity.adaptive === true);
      adaptivePaceHistoryRef.current = clarity.adaptivePace ? clarity.adaptivePace.split(",").map(Number).filter(Number.isFinite).slice(0, 40).map((value) => clampNumber(value, 2, 8, 3)) : [];
      setRhythmAware(clarity.rhythm === true); if (clarity.bpm) setRhythmBpm(clarity.bpm);
    }
    runtimePaceRef.current = typeof round.pace === "number" ? round.pace : 3;
    setStatus("preview");
    setShareMessage(exact.length === round.sequence.length && exact.every(Boolean) ? "Exact shape replay loaded; review before starting." : "Legacy replay loaded by names; exact shapes unavailable. Review before starting.");
  }, [clearTimer, status]);

  const loadRetention = useCallback((entry: RetentionEntry) => {
    if (entry.sequence || entry.shapeIds) {
      if (!entry.sequence || !entry.shapeIds || entry.sequence.length < 2 || entry.shapeIds.length !== entry.sequence.length) { setShareMessage("This retention route is incomplete or legacy and cannot be replayed exactly; no random route was substituted."); return; }
      const exact = entry.shapeIds.map((id) => CHORD_ITEM_LOOKUP.get(id)?.chord ?? null);
      if (exact.some((chord) => !chord) || exact.some((chord, index) => chord?.name !== entry.sequence?.[index])) { setShareMessage("A saved physical shape is no longer available. The retention check was not randomized."); return; }
      const setup = { ...entry.setup, pace: entry.pace ?? entry.setup.pace, length: entry.sequence.length };
      retentionSourceRef.current = entry.sourceId && entry.intervalDays ? { id: entry.sourceId, days: entry.intervalDays } : null;
      void startRound(setup, false, undefined, exact as Chord[]);
      setShareMessage(`${entry.label} loaded with the original physical shapes and ${entry.pace}s pace. Start when ready.`);
      return;
    }
    restoreSetup(entry.setup);
    setShareMessage(`${entry.label} is a legacy setup-only reminder. It may generate a new route when started.`);
  }, [restoreSetup, startRound]);

  const transferMasteredPair = useCallback(() => {
    const strongest = Object.entries(persistence.transitions)
      .filter(([key, record]) => !key.startsWith("Start ") && transitionBand(record) === "strong")
      .sort(([, a], [, b]) => b.score - a.score)[0];
    if (!strongest) { setShareMessage("No mastered pair is available yet. Rate the same change twice cleanly first."); return; }
    const [from, to] = strongest[0].split(" → ");
    const available = activeLevel.chords.filter((chord) => chord.name !== from && chord.name !== to).slice(0, 2);
    if (!activeLevel.chords.some((chord) => chord.name === from) || !activeLevel.chords.some((chord) => chord.name === to) || !available.length) {
      setShareMessage("This mastered pair is not available with two additional chords in the current level."); return;
    }
    setTransferPair([from, to]); setDrillMode("progression"); setRoundLength(10); setShareMessage(`Transfer loaded: ${from} → ${to} stays adjacent inside a ${Math.min(4, available.length + 2)}-chord progression.`);
  }, [activeLevel.chords, persistence.transitions]);

  const applyWarmUpTemplate = useCallback((profile: InstrumentProfile) => {
    if (settingsLocked) return;
    setWarmUpTemplate(profile);
    setRoundLength(5);
    setWarmUp(true);
    setPace(profile === "classical" ? 8 : profile === "electric" ? 5 : profile === "reducedString" ? 7 : 6);
    setDrillMode(profile === "electric" ? "barre" : "random");
    setShareMessage(`${INSTRUMENT_PROFILES[profile].label} warm-up loaded for ${tuningLabel}.`);
  }, [settingsLocked, tuningLabel]);

  const startBenchmark = useCallback(() => {
    if (settingsLocked || !availableLevelChords.length) return;
    const saved = ensurePersistenceLoaded();
    const benchmarkChords = constrainedLevelChords(LEVELS[levelIndex].chords, new Set(saved.shapeExclusions.map((item) => item.key)), saved.preferredShapes, neckLock, customNeckMin, customNeckMax);
    if (benchmarkChords.length < 2) { setShareMessage("Benchmark unavailable: the current neck lock and shape exclusions leave fewer than two shapes."); return; }
    const savedRoute = saved.benchmarkRoute?.map((id) => CHORD_ITEM_LOOKUP.get(id)?.chord ?? null);
    if (saved.benchmarkRoute && (!savedRoute || savedRoute.length !== 60 || savedRoute.some((chord) => !chord))) { setShareMessage("The saved benchmark route is no longer fully available in this chord catalog. It was not randomized; reset the benchmark route to choose a new one."); return; }
    const nextSequence = savedRoute ? savedRoute as Chord[] : buildSequence(benchmarkChords, 60, saved.transitions, null);
    if (!saved.benchmarkRoute) {
      const routeIds = nextSequence.map((chord) => libraryItemForChord(chord)?.id ?? "");
      if (!routeIds.every(Boolean)) { setShareMessage("A repeatable benchmark route could not be identified in the physical-shape catalog; no unrepeatable benchmark was started."); return; }
      savePersistence({ ...saved, benchmarkRoute: routeIds });
    }
    setSequence(nextSequence);
    setDuetMode(false);
    setRoundConfig({ length: 60, pace: "manual", drillLabel: "One-minute chord-change benchmark", pacePlan: [] });
    setCurrentIndex(-1);
    setFeedback({});
    feedbackRef.current = {};
    setMissTags({});
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
  }, [availableLevelChords.length, customNeckMax, customNeckMin, ensurePersistenceLoaded, levelIndex, neckLock, savePersistence, settingsLocked]);

  const togglePerformanceMode = useCallback(async () => {
    if (!performanceMode) {
      try { await document.documentElement.requestFullscreen?.(); } catch {}
      setPerformanceMode(true);
    } else {
      try { if (document.fullscreenElement) await document.exitFullscreen?.(); } catch {}
      setPerformanceMode(false);
    }
  }, [performanceMode]);

  const previewTransitionSteps = useCallback(() => {
    if (!transitionFromForPreview || !transitionTargetForPreview || transitionFromForPreview.name === transitionTargetForPreview.name) return;
    cancelTransitionPreview();
    setTransitionPhase(0);
    transitionTimerRef.current = window.setTimeout(() => {
      setTransitionPhase(0.5);
      transitionTimerRef.current = window.setTimeout(() => {
        setTransitionPhase(1);
        transitionTimerRef.current = window.setTimeout(() => { transitionTimerRef.current = null; setTransitionPhase(null); }, 500);
      }, 450);
    }, 450);
  }, [cancelTransitionPreview, transitionFromForPreview, transitionTargetForPreview]);
  const holdTransitionPhase = useCallback((phase: number) => {
    cancelTransitionPreview();
    setTransitionPhase(phase);
  }, [cancelTransitionPreview]);

  const resetRound = useCallback(() => {
    clearTimer();
    resumeRemainingRef.current = null;
    benchmarkDeadlineRef.current = 0;
    roundFinishedRef.current = false;
    roundPersistedRef.current = false;
    assistanceTrailRef.current = [];
    cancelTransitionPreview();
    setStatus("idle");
    setSequence([]);
    setCurrentIndex(-1);
    setSecondsLeft(0);
    setFeedback({});
    feedbackRef.current = {};
    setMissTags({});
    ratedIndicesRef.current = new Set();
    setSelectedHistoryIndex(null);
    setRecallRevealed(false);
    setBenchmarkActive(false);
    setBenchmarkSecondsLeft(60);
    undoSnapshotRef.current = null;
    const loaded = persistenceRef.current;
    if (persistenceLoadedRef.current && loaded.interruptedRound) savePersistence({ ...loaded, interruptedRound: null });
  }, [cancelTransitionPreview, clearTimer, savePersistence]);

  const restoreInterruptedRound = useCallback(() => {
    const draft = persistence.interruptedRound;
    if (!draft || settingsLocked) return;
    restoreSetup(draft.setup);
    const restored = draft.sequence.flatMap((name, index) => draft.shapeIds?.[index] && CHORD_ITEM_LOOKUP.get(draft.shapeIds[index]) ? [CHORD_ITEM_LOOKUP.get(draft.shapeIds[index])!.chord] : CHORD_LOOKUP.get(name) ? [CHORD_LOOKUP.get(name)!] : []);
    if (restored.length < 2) return;
    setSequence(restored);
    assistanceTrailRef.current = ["legacy:resumed-draft"];
    setRoundConfig(draft.config);
    setCurrentIndex(draft.currentIndex);
    setPausedFrom(draft.pausedFrom);
    setCountInBeat(draft.countInBeat);
    setFeedback(draft.feedback);
    feedbackRef.current = draft.feedback;
    ratedIndicesRef.current = new Set(Object.keys(draft.feedback).map(Number));
    roundIdRef.current = draft.roundId;
    roundStartedAtRef.current = Date.now() - draft.elapsedSeconds * 1000;
    sessionStartedAtRef.current = roundStartedAtRef.current;
    roundFinishedRef.current = false;
    roundPersistedRef.current = false;
    resumeRemainingRef.current = draft.remainingMs;
    setSecondsLeft(draft.secondsLeft);
    setStatus("paused");
    const restoredExposure = {
      transitions: new Set<string>(draft.exposureTransitions ?? []),
      recovered: new Set<number>(draft.exposureRecovered ?? []),
      kinds: { ...(draft.exposureKinds ?? {}) } as Record<number, "fresh" | "repeat">,
      fresh: draft.freshCount ?? 0,
      repeat: draft.repeatCount ?? 0,
      freshClean: draft.freshClean ?? 0,
      repeatClean: draft.repeatClean ?? 0
    };
    if (!draft.exposureKinds && draft.currentIndex > 0) {
      for (let index = 1; index <= Math.min(draft.currentIndex, restored.length - 1); index += 1) {
        const key = transitionKey(restored[index - 1], restored[index]);
        const kind = restoredExposure.transitions.has(key) ? "repeat" : "fresh";
        restoredExposure.transitions.add(key);
        restoredExposure.kinds[index] = kind;
        if (kind === "fresh") restoredExposure.fresh += 1;
        else restoredExposure.repeat += 1;
      }
    }
    exposureRef.current = restoredExposure;
    setFreshCount(restoredExposure.fresh);
    setRepeatCount(restoredExposure.repeat);
    effortRef.current = draft.effort ?? null;
    setEffortRating(effortRef.current);
    setPlacementConfirmed(draft.placementConfirmed === true || !draft.setup.landingCheckpoint);
    setShareMessage("Saved round restored. Press Resume to restart its timer.");
  }, [persistence.interruptedRound, restoreSetup, settingsLocked]);

  const reviewInterruptedSetup = useCallback(() => {
    const draft = persistence.interruptedRound;
    if (!draft || settingsLocked) return;
    restoreSetup(draft.setup);
    setReviewMode("setup");
    setShareMessage("Setup review only: no timer has started. Choose Resume when you are ready.");
  }, [persistence.interruptedRound, restoreSetup, settingsLocked]);

  const discardInterruptedDraft = useCallback(() => {
    if (!persistence.interruptedRound || settingsLocked) return;
    savePersistence({ ...persistenceRef.current, interruptedRound: null });
    setReviewMode("closed");
    setShareMessage("Draft discarded. Completed history and current setup were kept.");
  }, [persistence.interruptedRound, savePersistence, settingsLocked]);

  const pauseRound = useCallback(() => {
    if (status !== "running" && status !== "countIn") return;
    resumeRemainingRef.current = Math.max(1, deadlineRef.current - Date.now());
    if (benchmarkActive) benchmarkDeadlineRef.current = 0;
    window.setTimeout(() => saveInterruptedRoundRef.current(), 0);
    recordTimelineEvent("pause", status);
    setPausedFrom(status);
    setStatus("paused");
  }, [benchmarkActive, recordTimelineEvent, status]);

  const resumeRound = useCallback(() => { recordTimelineEvent("resume", pausedFrom); setStatus(pausedFrom); }, [pausedFrom, recordTimelineEvent]);

  const advanceChord = useCallback(() => {
    if (status !== "running" || (landingCheckpoint && !placementConfirmed)) return;
    setRecallRevealed(false);
    if (currentIndex + 1 < sequence.length) { classifyExposure(currentIndex + 1); setCurrentIndex((index) => index + 1); setPlacementConfirmed(!landingCheckpoint); }
    else finishRound();
  }, [classifyExposure, currentIndex, finishRound, landingCheckpoint, placementConfirmed, sequence.length, status]);

  const inspectPreviousChord = useCallback(() => {
    if (currentIndex <= 0) return;
    setSelectedHistoryIndex((selected) => Math.max(0, selected === null ? currentIndex - 1 : selected - 1));
  }, [currentIndex]);

  const recoverCurrent = useCallback(() => {
    if (status !== "running" || currentIndex < 0) return;
    resumeRemainingRef.current = null;
    setRoundRecoveries((count) => count + 1);
    if (!ratedIndicesRef.current.has(currentIndex) && previousChord && currentChord) classifyExposure(currentIndex, true);
    recordTimelineEvent("recover", currentChord ? `item ${currentIndex + 1}: ${currentChord.name}` : "current item");
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, stats: { ...loaded.stats, recoveries: loaded.stats.recoveries + 1 } });
    setRecallRevealed(false);
    setRecoveryNonce((nonce) => nonce + 1);
  }, [classifyExposure, currentChord, currentIndex, ensurePersistenceLoaded, previousChord, recordTimelineEvent, savePersistence, status]);

  const slowDownRound = useCallback(() => {
    if ((status !== "running" && status !== "paused") || roundConfig.pace === "manual") return;
    if (rhythmAware && rhythmRef.current.aware) {
      const currentBpm = rhythmRef.current.bpm;
      const nextBpm = Math.max(40, currentBpm - 10);
      rhythmRef.current = { ...rhythmRef.current, bpm: nextBpm };
      setRhythmBpm(nextBpm);
      resumeRemainingRef.current = (60_000 / nextBpm) * 4;
      setRecoveryNonce((nonce) => nonce + 1);
      setShareMessage(nextBpm < currentBpm ? `Slowed the current four-beat bar to ${nextBpm} BPM.` : `Rhythm pace is already at the 40 BPM floor; finish early or keep the current bar.`);
      return;
    }
    const nextPace = Math.min(8, Math.max(2, Math.ceil(runtimePaceRef.current + 1)));
    runtimePaceRef.current = nextPace;
    resumeRemainingRef.current = nextPace * 1000;
    setRecoveryNonce((nonce) => nonce + 1);
    setShareMessage(`Slowed the ${currentChord?.name ?? "next"} change to ${nextPace}s for this round. Manual clear: pace returns to setup on the next round.`);
  }, [currentChord?.name, rhythmAware, roundConfig.pace, status]);

  const rateCurrentChord = (rating: FeedbackRating) => {
    if (!currentChord || currentIndex < 0 || ratedIndicesRef.current.has(currentIndex) || (landingCheckpoint && !placementConfirmed)) return;
    const loaded = ensurePersistenceLoaded();
    const key = transitionKey(previousChord, currentChord);
    const exposureKindBefore = exposureRef.current.kinds[currentIndex];
    const freshBefore = exposureRef.current.fresh;
    const repeatBefore = exposureRef.current.repeat;
    const freshCleanBefore = exposureRef.current.freshClean;
    const repeatCleanBefore = exposureRef.current.repeatClean;
    const exposuresBefore = Array.from(exposureRef.current.transitions);
    const recoveredBefore = Array.from(exposureRef.current.recovered);
    undoSnapshotRef.current = {
      persistence: loaded,
      feedback: { ...feedbackRef.current },
      index: currentIndex,
      rated: new Set(ratedIndicesRef.current),
      runtimePace: runtimePaceRef.current,
      status,
      completed: roundPersistedRef.current,
      key,
      chordName: currentChord.name,
      transitionBefore: loaded.transitions[key] ? { ...loaded.transitions[key] } : null,
      chordBefore: loaded.chords[currentChord.name] ? { ...loaded.chords[currentChord.name] } : null,
      statsBefore: { ...loaded.stats },
      historyBefore: loaded.history,
      snapshotsBefore: loaded.snapshots,
      speedLadderBefore: loaded.speedLadder,
      milestonesBefore: loaded.milestones,
      completedRoundsBefore: loaded.completedRounds,
      interruptedBefore: loaded.interruptedRound,
      cleanRecovery: cleanRecoveryRef.current,
      consecutiveMisses: consecutiveMissesRef.current,
      roundRecoveries,
      microGoalProgress,
      transitionGoalProgress,
      restPrompt,
      rebuildPrompt,
      resumeRemaining: resumeRemainingRef.current,
      remainingMs: Math.max(0, deadlineRef.current - Date.now()),
      benchmarkClean: benchmarkCleanRef.current
      ,freshBefore, repeatBefore, effortBefore: effortRef.current, exposuresBefore, recoveredBefore, freshCleanBefore, repeatCleanBefore, exposureKindsBefore: { ...exposureRef.current.kinds }
      ,roundEvidenceBefore: loaded.roundEvidence, timelineBefore: loaded.timeline
    };
    classifyExposure(currentIndex);
    const exposureKind = exposureRef.current.kinds[currentIndex] ?? exposureKindBefore;
    if (previousChord) {
      if (exposureKind === "repeat") exposureRef.current.repeatClean += rating === "clean" ? 1 : 0;
      else if (exposureKind === "fresh") exposureRef.current.freshClean += rating === "clean" ? 1 : 0;
    }
    ratedIndicesRef.current.add(currentIndex);
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
      version: 10,
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
      const next = adaptTrainerPace(runtimePaceRef.current, cleanRecoveryRef.current, rating, adaptivePreference, roundConfig.pace);
      runtimePaceRef.current = next.pace;
      cleanRecoveryRef.current = next.recovery;
      adaptivePaceHistoryRef.current = [...adaptivePaceHistoryRef.current, runtimePaceRef.current].slice(-40);
    }
  };

  const undoLatestRating = useCallback(() => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot) return;
    const current = ensurePersistenceLoaded();
    const transitions = { ...current.transitions };
    if (snapshot.transitionBefore) transitions[snapshot.key] = snapshot.transitionBefore;
    else delete transitions[snapshot.key];
    const chords = { ...current.chords };
    if (snapshot.chordBefore) chords[snapshot.chordName] = snapshot.chordBefore;
    else delete chords[snapshot.chordName];
    savePersistence({
      ...current,
      transitions,
      chords,
      stats: { ...current.stats, cleanStreak: snapshot.statsBefore.cleanStreak, bestCleanStreak: snapshot.statsBefore.bestCleanStreak, bestCleanRound: snapshot.statsBefore.bestCleanRound, bestPaceSeconds: snapshot.statsBefore.bestPaceSeconds },
      history: snapshot.historyBefore,
      snapshots: snapshot.snapshotsBefore,
      speedLadder: snapshot.speedLadderBefore,
      milestones: snapshot.milestonesBefore,
      completedRounds: snapshot.completedRoundsBefore,
      roundEvidence: snapshot.roundEvidenceBefore,
      timeline: snapshot.timelineBefore,
      interruptedRound: snapshot.interruptedBefore
    });
    feedbackRef.current = { ...snapshot.feedback };
    ratedIndicesRef.current = new Set(snapshot.rated);
    runtimePaceRef.current = snapshot.runtimePace;
    cleanRecoveryRef.current = snapshot.cleanRecovery;
    consecutiveMissesRef.current = snapshot.consecutiveMisses;
    benchmarkCleanRef.current = snapshot.benchmarkClean;
    exposureRef.current.fresh = snapshot.freshBefore;
    exposureRef.current.repeat = snapshot.repeatBefore;
    exposureRef.current.transitions = new Set(snapshot.exposuresBefore);
    exposureRef.current.recovered = new Set(snapshot.recoveredBefore);
    exposureRef.current.kinds = { ...snapshot.exposureKindsBefore };
    exposureRef.current.freshClean = snapshot.freshCleanBefore;
    exposureRef.current.repeatClean = snapshot.repeatCleanBefore;
    setFreshCount(snapshot.freshBefore);
    setRepeatCount(snapshot.repeatBefore);
    effortRef.current = snapshot.effortBefore;
    setEffortRating(snapshot.effortBefore);
    setBenchmarkClean(snapshot.benchmarkClean);
    resumeRemainingRef.current = snapshot.resumeRemaining;
    if (snapshot.remainingMs > 0) resumeRemainingRef.current = snapshot.remainingMs;
    setRoundRecoveries(snapshot.roundRecoveries);
    setMicroGoalProgress(snapshot.microGoalProgress);
    setTransitionGoalProgress(snapshot.transitionGoalProgress);
    setRestPrompt(snapshot.restPrompt);
    setRebuildPrompt(snapshot.rebuildPrompt);
    roundPersistedRef.current = snapshot.completed;
    roundFinishedRef.current = false;
    setFeedback({ ...snapshot.feedback });
    setCurrentIndex(snapshot.index);
    setStatus(snapshot.status === "complete" ? "running" : snapshot.status);
    if (roundConfig.pace === "manual") resumeRemainingRef.current = null;
    setRecoveryNonce((nonce) => nonce + 1);
    undoSnapshotRef.current = null;
    setShareMessage("Latest rating undone; transition and chord counts were restored.");
  }, [ensurePersistenceLoaded, roundConfig.pace, savePersistence]);

  const rateAndAdvance = (rating: FeedbackRating) => {
    if (status !== "running" || feedbackRef.current[currentIndex] || (landingCheckpoint && !placementConfirmed)) return;
    rateCurrentChord(rating);
    window.setTimeout(() => saveInterruptedRoundRef.current(), 0);
    setRecallRevealed(false);
    if (rating === "missed") {
      resumeRemainingRef.current = Math.max(1, deadlineRef.current - Date.now());
      setPausedFrom("running");
      setRebuildPrompt({ index: currentIndex, beat: changeBeat, rejoin: "current" });
      setStatus("paused");
      return;
    }
    if (currentIndex + 1 < sequence.length) { classifyExposure(currentIndex + 1); setCurrentIndex((index) => index + 1); setPlacementConfirmed(!landingCheckpoint); }
    else if (!benchmarkActive) finishRound();
  };
  rateAndAdvanceRef.current = rateAndAdvance;

  const saveRoundNote = useCallback(() => {
    const note = roundNote.trim().slice(0, 500);
    if (!note) return;
    const loaded = ensurePersistenceLoaded();
    const entry: RoundNote = { id: roundIdRef.current, date: localDateKey(), drill: roundConfig.drillLabel, note };
    savePersistence({ ...loaded, notes: [entry, ...loaded.notes.filter((item) => item.id !== entry.id)].slice(0, 50), completedRounds: loaded.completedRounds.map((round) => round.id === entry.id ? { ...round, note } : round) });
    setNoteSaved(true);
  }, [ensurePersistenceLoaded, roundConfig.drillLabel, roundNote, savePersistence]);

  const saveRoundEffort = useCallback((effort: EffortRating) => {
    effortRef.current = effort;
    setEffortRating(effort);
    if (status !== "complete") return;
    const loaded = ensurePersistenceLoaded();
    savePersistence({ ...loaded, completedRounds: loaded.completedRounds.map((round) => round.id === roundIdRef.current ? { ...round, effort } : round), roundEvidence: loaded.roundEvidence.map((item) => item.id === roundIdRef.current ? { ...item, effort } : item) });
  }, [ensurePersistenceLoaded, savePersistence, status]);

  const startDelayedRecall = useCallback(() => {
    const pool = Array.from(new Map(availableLevelChords.map((chord) => [chord.name, chord])).values());
    if (pool.length < 4) { setRecallMessage("Delayed recall needs at least four available chord shapes in this level and neck lock."); return; }
    const first = pool[0];
    const second = pool[1];
    const distractors: [string, string] = [pool[2].name, pool[3].name];
    setRecallDrill({ first: first.name, second: second.name, distractors, answer: second.name, phase: "preview" });
    setRecallChoice("");
    setRecallMessage("Play two unrelated shapes, then choose the destination before revealing it.");
  }, [availableLevelChords]);

  const submitDelayedRecall = useCallback(() => {
    if (!recallDrill || recallDrill.phase !== "quiz" || !recallChoice) return;
    setRecallMessage(recallChoice === recallDrill.answer ? `Correct destination: ${recallDrill.answer}.` : `You chose ${recallChoice}. The destination was ${recallDrill.answer}. No rating was added.`);
    setRecallDrill((current) => current ? { ...current, phase: "done" } : current);
  }, [recallChoice, recallDrill]);

  const advanceDelayedRecall = useCallback(() => {
    setRecallDrill((current) => {
      if (!current) return current;
      if (current.phase === "preview") return { ...current, phase: "distract1" };
      if (current.phase === "distract1") return { ...current, phase: "distract2" };
      if (current.phase === "distract2") return { ...current, phase: "quiz" };
      return current;
    });
  }, []);

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
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
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

  const savePerformanceReflection = useCallback(() => {
    const wentWell = performanceWentWell.trim().slice(0, 300);
    const lostTime = performanceLostTime.trim().slice(0, 300);
    const revisitTransition = performanceRevisit.trim().slice(0, 80);
    if (!wentWell && !lostTime && !revisitTransition) return;
    const loaded = ensurePersistenceLoaded();
    const entry: PerformanceReflection = { id: roundIdRef.current || `reflection-${Date.now()}`, date: localDateKey(), wentWell, lostTime, revisitTransition };
    savePersistence({ ...loaded, performanceReflections: [entry, ...loaded.performanceReflections.filter((item) => item.id !== entry.id)].slice(0, 30) });
    setPerformanceWentWell("");
    setPerformanceLostTime("");
    setPerformanceRevisit("");
    setShareMessage("Performance reflection saved locally for your next rehearsal plan.");
  }, [ensurePersistenceLoaded, performanceLostTime, performanceRevisit, performanceWentWell, savePersistence]);

  const saveDatedPracticeGoal = useCallback((date: string, label: string) => {
    const loaded = ensurePersistenceLoaded();
    const next = date && label.trim() ? { date, label: label.trim().slice(0, 120) } : null;
    savePersistence({ ...loaded, datedPracticeGoal: next });
  }, [ensurePersistenceLoaded, savePersistence]);

  const applyRebuildChoice = useCallback(() => {
    if (rebuildPrompt.index < 0) return;
    const targetIndex = rebuildPrompt.rejoin === "next" ? Math.min(sequence.length - 1, rebuildPrompt.index + 1) : rebuildPrompt.index;
    setCurrentIndex(targetIndex);
    setRebuildPrompt({ index: -1, beat: 1, rejoin: "current" });
    setStatus("running");
    resumeRemainingRef.current = null;
    setRecoveryNonce((nonce) => nonce + 1);
  }, [rebuildPrompt, sequence.length]);

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
      const imported = { id: `offline-${Date.now()}`, title: typeof parsed.label === "string" ? parsed.label.slice(0, 80) : "Offline practice pack", chords, route: chords };
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
    if (recording || captureStartingRef.current) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCaptureMessage("This browser does not provide local MediaRecorder capture.");
      return;
    }
    captureStartingRef.current = true;
    setCaptureStarting(true);
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
        captureStartingRef.current = false;
        setCaptureStarting(false);
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
      captureStartingRef.current = false;
      setCaptureStarting(false);
      setCaptureMessage("Recording locally… it will stop automatically at 45 seconds or 8 MB.");
      captureTimeoutRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, CAPTURE_DURATION_MS);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      setRecording(false);
      captureStartingRef.current = false;
      setCaptureStarting(false);
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

  const applySongBridge = useCallback(() => {
    if (settingsLocked) return;
    if (selectedSongSet) {
      setDrillMode("song");
      setSongSetId(selectedSongSet.id);
      setShareMessage(`Loaded ${selectedSongSet.title} so the mastered movement can be tested in context.`);
    } else {
      setDrillMode("progression");
      setProgressionId("oneFiveSixFour");
      setShareMessage("No local song set is available, so a common progression was loaded as the context bridge.");
    }
    setRoundLength(10);
  }, [selectedSongSet, settingsLocked]);

  const commitMemoryAnswer = useCallback(() => {
    if (!nextChord) {
      setMemoryResult("Start or preview a round to create a next-chord memory prompt.");
      return;
    }
    const answer = memoryAnswer.trim();
    if (!answer) return;
    setMemoryResult(answer.localeCompare(nextChord.name, undefined, { sensitivity: "base" }) === 0
      ? `Correct — ${nextChord.name} is next.`
      : `You committed to ${answer}. The route calls for ${nextChord.name}; rebuild the progression once, then try again.`);
  }, [memoryAnswer, nextChord]);

  const loadRescueDrill = useCallback(() => {
    if (settingsLocked) return;
    setRoundLength(5);
    setPace(rescueScenario === "brokenRhythm" ? 4 : "manual");
    setPreviewEnabled(false);
    setRehearsalMode(true);
    setRhythmAware(rescueScenario === "brokenRhythm");
    if (rescueScenario === "badChange") setDrillMode("pair");
    else if (rescueScenario === "restart") setDrillMode("progression");
    else setDrillMode(selectedSongSet ? "song" : "progression");
    setShareMessage({
      lostPlace: "Rescue loaded: pause, find the next downbeat, and re-enter on a familiar chord.",
      badChange: "Rescue loaded: keep the pulse moving through one imperfect change.",
      brokenRhythm: "Rescue loaded: four-beat bars rebuild the groove before adding speed.",
      restart: "Rescue loaded: count in and restart from a different point in the progression."
    }[rescueScenario]);
  }, [rescueScenario, selectedSongSet, settingsLocked]);

  const selectCoachAttachment = useCallback((file: File | undefined) => {
    if (!file) return;
    const allowed = file.type.startsWith("audio/") || file.type.startsWith("video/") || file.type.startsWith("image/");
    if (!allowed || file.size > CAPTURE_SIZE_LIMIT) {
      setShareMessage("Coach pointer rejected: choose an image, audio, or video file no larger than 8 MB.");
    } else {
      setCoachAttachment({ name: file.name.slice(0, 100), type: file.type.slice(0, 80), bytes: file.size });
      setShareMessage("Only the attachment name, type, and size are held for this tab. The file is not uploaded or persisted.");
    }
    if (coachPointerFileRef.current) coachPointerFileRef.current.value = "";
  }, []);

  const exportRehearsalSummary = useCallback(() => {
    const payload = {
      kind: "chord-hero-rehearsal-summary",
      version: 1,
      createdAt: new Date().toISOString(),
      drill: roundConfig.drillLabel.slice(0, 80),
      tuning: tuningLabel,
      capo: capoFret,
      sequence: (sequence.length ? sequence : activeLevel.chords).slice(0, 40).map((chord) => chord.name),
      ratings: summarizeFeedback(feedback),
      confidence: { before: preConfidence, after: postConfidence },
      relaxation: { before: relaxationBefore, after: relaxationAfter },
      coachNote: coachNotes.trim().slice(0, 1000),
      readiness: persistence.readiness,
      rehearsalDate: rehearsalDate || null,
      recordingsIncluded: false
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chord-hero-rehearsal-summary-${localDateKey()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setShareMessage("Rehearsal summary exported without audio, video, object URLs, or recording metadata.");
  }, [activeLevel.chords, capoFret, coachNotes, feedback, persistence.readiness, postConfidence, preConfidence, rehearsalDate, relaxationAfter, relaxationBefore, roundConfig.drillLabel, sequence, tuningLabel]);

  useEffect(() => {
    if (!["running", "paused", "countIn"].includes(status)) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element && (target.closest("button, a, summary, input, textarea, select, [contenteditable='true']") || target.getAttribute("contenteditable") === "true")) return;
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
      } else if (footswitchMode && event.key.toLowerCase() === "n") {
        event.preventDefault();
        advanceChord();
      } else if (footswitchMode && event.key.toLowerCase() === "r") {
        event.preventDefault();
        recoverCurrent();
      } else if (footswitchMode && event.key.toLowerCase() === "c") {
        event.preventDefault();
        rateAndAdvanceRef.current("clean");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [advanceChord, footswitchMode, inspectPreviousChord, pauseRound, recoverCurrent, resumeRound, status]);

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
  const actionableFlaggedTransitions = useMemo(() => flaggedTransitions.filter((item) => {
    const [from, to] = item.key.split(" → ");
    return Boolean(from && to && activeLevel.chords.some((chord) => chord.name === from) && activeLevel.chords.some((chord) => chord.name === to));
  }), [activeLevel.chords, flaggedTransitions]);
  const mostImproved = useMemo(() => {
    const entries = Object.entries(persistence.transitions).filter(([key]) => !key.startsWith("Start "));
    return entries.sort(([, left], [, right]) => right.score - right.previousScore - (left.score - left.previousScore))[0];
  }, [persistence.transitions]);
  const recommendedAction = actionableFlaggedTransitions.length
    ? `Repeat ${actionableFlaggedTransitions[0].key} as a focused pair at a comfortable pace.`
    : Object.keys(feedback).length < roundConfig.length
      ? "Rate every change next round so adaptive practice can target weak transitions."
      : "No weak changes flagged. Try the next faster pace or a longer round.";
  const startTakeaway = useCallback(() => {
    if (status !== "complete") return;
    if (actionableFlaggedTransitions.length) {
      const [from, to] = actionableFlaggedTransitions[0].key.split(" → ");
      if (activeLevel.chords.some((chord) => chord.name === from) && activeLevel.chords.some((chord) => chord.name === to)) {
        void startRound({ drill: "pair", pairFrom: from, pairTo: to, length: 5, pace: 6 });
        return;
      }
    }
    if (Object.keys(feedback).length < roundConfig.length) {
      void startRound({ drill: currentSetup.drill, length: 5, pace: currentSetup.pace === "manual" ? "manual" : Math.max(6, currentSetup.pace) });
      return;
    }
    const faster = typeof roundConfig.pace === "number" && roundConfig.pace > 2;
    const fasterPace: Pace = typeof roundConfig.pace === "number" ? Math.max(2, roundConfig.pace - 1) : currentSetup.pace;
    void startRound({ drill: currentSetup.drill, length: faster ? currentSetup.length : Math.min(20, currentSetup.length + 5), pace: faster ? fasterPace : currentSetup.pace });
  }, [actionableFlaggedTransitions, activeLevel.chords, currentSetup, feedback, roundConfig.length, roundConfig.pace, startRound, status]);

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
            : t("ready");
  const onboardingStep = status === "idle" ? { label: "Setup", copy: "Choose a level, short length, and comfortable pace.", action: "Use the Start here card below." } : status === "complete" ? { label: "Review", copy: "Rate the route, then choose one takeaway for tomorrow.", action: "Use the recap action." } : { label: "Play", copy: "Follow the current shape and rate the change when ready.", action: "Keep the pulse; the browser does not measure sound." };

  return (
    <main className={`page focused-page trainer-page ${largeDiagrams ? "trainer-large-diagrams" : ""} ${textScale === "large" ? "trainer-text-large" : ""} ${diagramVisibility === "minimal" ? "trainer-diagrams-minimal" : ""} ${displayPreference === "light" ? "trainer-light" : ""} ${performanceMode ? "trainer-performance" : ""} ${stageMode ? "trainer-stage-mode" : ""}`}>
      <section className="studio-heading trainer-heading">
        <div>
          <span className="tag">Trainer</span>
          <h1><LocalizedCopy id="trainerTitle" /></h1>
          <p><LocalizedCopy id="trainerIntro" /></p>
        </div>
        <div className="studio-session-note" aria-label="Trainer format">
          <span className="label">Round format</span>
          <strong>{pace === "manual" ? "Manual pace" : `${pace} seconds`} · {roundLength} chords</strong>
          <span>{tuningLabel}{capoFret ? ` · capo ${capoFret}` : " · no capo"}</span>
          <span>Defaults stay at 3 seconds and 10 chords. Accuracy still comes first.</span>
        </div>
      </section>

      {!persistence.onboardingComplete && <section className="panel trainer-onboarding" aria-label="First session guide">
        <div><p className="eyebrow">First session · 3 steps · now: {onboardingStep.label}</p><h2>Setup → play → review</h2><p>{onboardingStep.copy} {onboardingStep.action}</p></div>
        <ol><li className={onboardingStep.label === "Setup" ? "active" : ""}><strong>Setup:</strong> pick a level and pace below.</li><li className={onboardingStep.label === "Play" ? "active" : ""}><strong>Play:</strong> use the visible chord route and keep the pulse.</li><li className={onboardingStep.label === "Review" ? "active" : ""}><strong>Review:</strong> rate each change to shape the next suggestion.</li></ol>
        <button className="btn ghost" type="button" onClick={() => { const loaded = ensurePersistenceLoaded(); savePersistence({ ...loaded, onboardingComplete: true }); }}>Dismiss guide</button>
      </section>}

      <LazyStartHereCard pair={levelWeakPair ?? undefined} fallback={[effectivePairFrom, effectivePairTo]} onStart={startRecommended} onApply={() => { const weak = levelWeakPair; if (weak?.length === 2) { setPairFrom(weak[0]); setPairTo(weak[1]); } setDrillMode("pair"); setRoundLength(5); setPace(6); setShareMessage("Start-here drill applied. Press Start when ready."); }} onAlternate={applyLast10Minutes} onRestore={persistence.lastSetup ? () => restoreSetup() : undefined} />

      <LazyRecommendationEvidence from={levelWeakPair?.[0]} to={levelWeakPair?.[1]} sample={levelWeakPair ? (persistence.transitions[`${levelWeakPair[0]} → ${levelWeakPair[1]}`]?.clean ?? 0) + (persistence.transitions[`${levelWeakPair[0]} → ${levelWeakPair[1]}`]?.missed ?? 0) + (persistence.transitions[`${levelWeakPair[0]} → ${levelWeakPair[1]}`]?.needsWork ?? 0) : 0} score={levelWeakPair ? Math.round((persistence.transitions[`${levelWeakPair[0]} → ${levelWeakPair[1]}`]?.score ?? 0) * 100) : undefined} />

      {dueRetention.length > 0 && <aside className="trainer-retention-card" role="status"><strong>Retention check due</strong><span>{dueRetention[0].label}</span>{dueRetention[0].sourceId && (() => { const source = persistence.completedRounds.find((round) => round.id === dueRetention[0].sourceId); return source ? <small>Source round: {source.ratings.clean}/{Math.max(1, source.ratings.clean + source.ratings.missed + source.ratings.needsWork)} clean · {source.pace}s per change. Repeat the exact route to compare.</small> : <small>Source round is unavailable; the saved route remains local.</small>; })()}<button className="btn" type="button" onClick={() => loadRetention(dueRetention[0])} disabled={settingsLocked}>Load drill</button></aside>}

      <details className="trainer-advanced-tools trainer-saved-setups"><summary>Saved setups <span>Pinned Trainer favorites; loading never starts a timer</span></summary><section className="panel trainer-favorites" aria-label="Pinned Trainer setups">
        <div><span className="label">Pinned setups · max 2</span><p>Name a complete setup to restore every selected Trainer parameter.</p></div>
        <div className="trainer-inline-actions"><input aria-label="Favorite setup name" maxLength={60} value={favoriteName} onChange={(event) => setFavoriteName(event.target.value)} placeholder="e.g. Gentle C → G" disabled={settingsLocked || persistence.favorites.length >= 2} /><button className="btn" type="button" onClick={saveFavoriteSetup} disabled={settingsLocked || !favoriteName.trim() || persistence.favorites.length >= 2}>Pin current</button></div>
        {persistence.favorites.length > 0 && <div className="trainer-favorite-list">{persistence.favorites.map((favorite) => <article key={favorite.id}><strong>{favorite.name}</strong><button className="btn" type="button" onClick={() => restoreSetup(favorite.setup)} disabled={settingsLocked}>Load</button><button className="btn ghost" type="button" onClick={() => removeFavoriteSetup(favorite.id)} disabled={settingsLocked}>Remove</button></article>)}</div>}
      </section></details>

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

        <div className="trainer-simple-setup" aria-label="Simple round setup">
          <div><span className="label">Simple practice</span><strong>{effectivePairFrom} → {effectivePairTo}</strong><small>Current recommendation · {roundLength} changes · {pace === "manual" ? "manual pace" : `${pace}s planned pace`} · {tuningLabel}{capoFret ? ` · capo ${capoFret}` : " · no capo"}</small><small>Available shapes under this setup: {availableLevelChords.slice(0, Math.min(roundLength, 8)).map((chord) => chord.name).join(" → ") || "No constrained shapes available"}{roundLength > 8 ? " …" : ""}. Use Review route first to see the actual generated sequence.</small></div>
          <label>Level<select value={levelIndex} onChange={(event) => setLevelIndex(Number(event.target.value))} disabled={settingsLocked}>{LEVELS.map((level, index) => <option key={level.name} value={index}>{level.name}</option>)}</select></label>
          <label>Round length<select value={roundLength} onChange={(event) => setRoundLength(Number(event.target.value))} disabled={settingsLocked}>{[5, 10, 20].map((length) => <option key={length} value={length}>{length} changes</option>)}</select></label>
          <label>Comfortable pace<select value={pace} onChange={(event) => setPace(event.target.value === "manual" ? "manual" : Number(event.target.value))} disabled={settingsLocked}><option value="manual">Manual / untimed</option>{[2, 3, 4, 5, 6, 7, 8].map((seconds) => <option key={seconds} value={seconds}>{seconds}s planned pace</option>)}</select></label>
          <button className="btn primary" type="button" onClick={() => void startRound()} disabled={status !== "idle"}>Start recommended round</button>
          <button className="btn" type="button" onClick={() => void startRound(undefined, true)} disabled={status !== "idle"}>Review route first</button>
          <button className="btn ghost" type="button" onClick={() => setSimpleWorkspace((simple) => !simple)} aria-expanded={!simpleWorkspace}>{simpleWorkspace ? "Open specialist setup" : "Close specialist setup"}</button>
        </div>
        {!simpleWorkspace && <details className="trainer-specialist-setup" open>
          <summary>Specialist setup <span>Saved sets, challenge, pace, tuning, and display options</span></summary>
        <div className="trainer-settings-grid" aria-label="Specialist round setup">
          <label><LocalizedCopy id="levelLabel" />
            <select value={levelIndex} onChange={(event) => setLevelIndex(Number(event.target.value))} disabled={settingsLocked}>
              {LEVELS.map((level, index) => <option key={level.name} value={index}>{level.name}</option>)}
            </select>
          </label>
          <label><LocalizedCopy id="roundLengthLabel" />
            <select value={roundLength} onChange={(event) => setRoundLength(Number(event.target.value))} disabled={settingsLocked}>
              {[5, 10, 20].map((length) => <option key={length} value={length}>{length} chords</option>)}
            </select>
          </label>
          <label><LocalizedCopy id="paceLabel" />
            <select value={pace} onChange={(event) => setPace(event.target.value === "manual" ? "manual" : Number(event.target.value))} disabled={settingsLocked}>
              <option value="manual"><LocalizedCopy id="manualNonTimed" /></option>
              {[2, 3, 4, 5, 6, 7, 8].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
            </select>
          </label>
          <label><LocalizedCopy id="drillLabel" />
            <select value={drillMode} onChange={(event) => setDrillMode(event.target.value as DrillMode)} disabled={settingsLocked}>
              <option value="random"><LocalizedCopy id="adaptiveRandomLevel" /></option>
              <option value="barre"><LocalizedCopy id="barreChordsOnly" /></option>
              <option value="pair"><LocalizedCopy id="focusedChordPair" /></option>
              <option value="progression"><LocalizedCopy id="commonProgression" /></option>
              <option value="neckLadder">Progression neck ladder</option>
              <option value="song"><LocalizedCopy id="savedSongCoachSet" /></option>
              <option value="family"><LocalizedCopy id="chordFamilyDrill" /></option>
              <option value="keepFingers"><LocalizedCopy id="keepFingersDown" /></option>
              <option value="genre"><LocalizedCopy id="genrePracticePack" /></option>
              <option value="surprise"><LocalizedCopy id="surpriseMe" /></option>
            </select>
          </label>
          {drillMode === "pair" && <>
            <label><LocalizedCopy id="from" />
              <select value={effectivePairFrom} onChange={(event) => setPairFrom(event.target.value)} disabled={settingsLocked}>
                {chordNames.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label><LocalizedCopy id="to" />
              <select value={effectivePairTo} onChange={(event) => setPairTo(event.target.value)} disabled={settingsLocked}>
                {chordNames.filter((name) => name !== effectivePairFrom).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </>}
          {(drillMode === "progression" || drillMode === "neckLadder") && <label><LocalizedCopy id="progression" />
            <select value={progressionId} onChange={(event) => setProgressionId(event.target.value as ProgressionId)} disabled={settingsLocked}>
              {Object.entries(PROGRESSIONS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
            </select>
          </label>}
          {drillMode === "progression" && <label className="trainer-inline-check"><input type="checkbox" checked={randomKey} onChange={(event) => setRandomKey(event.target.checked)} disabled={settingsLocked} /> <LocalizedCopy id="randomKey" /></label>}
          {drillMode === "genre" && <label><LocalizedCopy id="genrePack" />
            <select value={genrePack} onChange={(event) => { const next = event.target.value as GenrePackId; setGenrePack(next); setStrummingPrompt(GENRE_PACKS[next].strum); }} disabled={settingsLocked}>
              {Object.entries(GENRE_PACKS).map(([id, pack]) => <option key={id} value={id}>{pack.label}</option>)}
            </select>
            <small>Uses supported shapes in this level; unavailable packs fall back gracefully.</small>
          </label>}
          {drillMode === "family" && <label><LocalizedCopy id="chordFamily" />
            <select value={chordFamily} onChange={(event) => setChordFamily(event.target.value as ChordFamily)} disabled={settingsLocked}>
              {Object.entries(FAMILY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <small>{eligibleFamilyChords.length ? `${eligibleFamilyChords.length} eligible shape${eligibleFamilyChords.length === 1 ? "" : "s"} in this level.` : "No eligible shapes in this level; the round will use the full level."}</small>
          </label>}
          {drillMode === "keepFingers" && <>
            <label><LocalizedCopy id="anchorFrom" /><select value={effectiveKeepFrom} onChange={(event) => setKeepFrom(event.target.value)} disabled={settingsLocked}>{chordNames.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label><LocalizedCopy id="anchorTo" /><select value={effectiveKeepTo} onChange={(event) => setKeepTo(event.target.value)} disabled={settingsLocked}>{chordNames.filter((name) => name !== effectiveKeepFrom).map((name) => <option key={name}>{name}</option>)}</select></label>
            <div className="trainer-setting-note">{keepPair?.shared.length ? `Keep ${keepPair.shared.length} fretted position${keepPair.shared.length === 1 ? "" : "s"} planted.` : "These shapes share no fretted positions; choose another pair or use the level fallback."}</div>
          </>}
          {drillMode === "song" && <label><LocalizedCopy id="songSet" />
            <select value={selectedSongSet?.id ?? ""} onChange={(event) => setSongSetId(event.target.value)} disabled={settingsLocked || !songSets.length}>
              {!songSets.length && <option value="">Import saved songs below</option>}
              {songSets.map((set) => <option key={set.id} value={set.id}>{set.title}</option>)}
            </select>
          </label>}
          <LazySectionDrillControls selected={Boolean(selectedSongSet)} enabled={sectionDrillOn} locked={settingsLocked} section={rehearsalSection} chunkSize={sectionChunkSize} pace={sectionPaces[rehearsalSection]} needsPractice={Boolean(sectionNeedsPractice[rehearsalSection])} onToggle={setSectionDrillOn} onSection={(value) => setRehearsalSection(value as RehearsalSection)} onChunk={setSectionChunkSize} onPace={(value) => setSectionPaces((current) => ({ ...current, [rehearsalSection]: clampNumber(value, 2, 8, 5) }))} onStart={startSectionDrill} />
          <label><LocalizedCopy id="challengeLabel" />
            <select value={challengeMode} onChange={(event) => setChallengeMode(event.target.value as ChallengeMode)} disabled={settingsLocked}>
              <option value="standard"><LocalizedCopy id="namesAndDiagrams" /></option><option value="nameOnly"><LocalizedCopy id="chordNameOnly" /></option><option value="diagramOnly"><LocalizedCopy id="diagramOnlyIdentification" /></option><option value="recall"><LocalizedCopy id="noDiagramRecall" /></option>
            </select>
          </label>
          <label><LocalizedCopy id="diagramOrientationLabel" />
            <select value={displayHandedness} onChange={(event) => { const next = event.target.value as Handedness; setDisplayHandedness(next); setHandedness(next); }} disabled={!displayPrefsHydrated}>
              <option value="right"><LocalizedCopy id="rightHanded" /></option><option value="left"><LocalizedCopy id="leftHandedMirrored" /></option>
            </select>
          </label>
          <label><LocalizedCopy id="dailySessionGoalLabel" />
            <select value={dailyGoalMinutes} onChange={(event) => setDailyGoalMinutes(Number(event.target.value))}>
              {[5, 10, 15, 20].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
          <label><LocalizedCopy id="confidenceBeforeRoundLabel" />
            <select value={preConfidence} onChange={(event) => setPreConfidence(Number(event.target.value))} disabled={settingsLocked}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select>
          </label>
          <DeferredDetails className="trainer-advanced-tools" summary={<>Prediction calibration <span>Optional expected clean rate</span></>}><LazyConfidenceControl value={predictedCleanRate} onChange={setPredictedCleanRate} rounds={persistence.completedRounds} /></DeferredDetails>
          <label><LocalizedCopy id="sessionIntentLabel" />
            <select value={sessionIntent} onChange={(event) => setSessionIntent(event.target.value as SessionIntent)} disabled={settingsLocked}>
              <option value="rehearsal"><LocalizedCopy id="prepareForRehearsal" /></option><option value="song"><LocalizedCopy id="learnSong" /></option><option value="barre"><LocalizedCopy id="buildBarreEndurance" /></option>
            </select>
          </label>
          <label>Neck-position lock<select value={neckLock} onChange={(event) => setNeckLock(event.target.value as NeckPositionLock)} disabled={settingsLocked}><option value="off">Off (all catalogued positions)</option><option value="open">Open-string shapes · frets 0–4</option><option value="low">Closed low · frets 1–5</option><option value="mid">Closed mid · frets 6–9</option><option value="high">Closed high · frets 10–12</option><option value="custom">Custom range</option></select></label>
          {neckLock === "custom" && <><label>Custom minimum fret<input type="number" min={0} max={20} value={customNeckMin} onChange={(event) => setCustomNeckMin(Math.round(clampNumber(Number(event.target.value), 0, 20, 0)))} disabled={settingsLocked} /></label><label>Custom maximum fret<input type="number" min={0} max={20} value={customNeckMax} onChange={(event) => setCustomNeckMax(Math.round(clampNumber(Number(event.target.value), 0, 20, 12)))} disabled={settingsLocked} /></label></>}
          <small>Locks use physical fret numbers; capo changes sounding pitch and does not shift these bounds.</small>
          <label className="trainer-inline-check"><input type="checkbox" checked={landingCheckpoint} onChange={(event) => setLandingCheckpoint(event.target.checked)} disabled={settingsLocked} /> Landing checkpoint before pace</label>
        <div className="trainer-display-settings">
          <label>Display density<select value={displayPreference} onChange={(event) => setDisplayPreference(event.target.value as "full" | "light")} disabled={!displayPrefsHydrated}><option value="full">Full guides</option><option value="light">Lightweight diagrams</option></select></label>
          <label>Diagram size<select value={largeDiagrams ? "large" : "normal"} onChange={(event) => setLargeDiagrams(event.target.value === "large")} disabled={!displayPrefsHydrated}><option value="normal">Normal</option><option value="large">Large</option></select></label>
          <label>Text scale<select value={textScale} onChange={(event) => setTextScale(event.target.value as "normal" | "large")} disabled={!displayPrefsHydrated}><option value="normal">Normal text</option><option value="large">Large text</option></select></label>
          <label>Diagram visibility<select value={diagramVisibility} onChange={(event) => setDiagramVisibility(event.target.value as "visible" | "minimal")} disabled={!displayPrefsHydrated}><option value="visible">Show diagrams</option><option value="minimal">Focus on names</option></select></label>
          <small>Display preferences are separate from saved drills and survive progress-only resets. Restoring a drill changes its capo/tuning, not this display choice.</small>
        </div>
        </div>
        </details>}

        {persistence.interruptedRound && status === "idle" && <aside className="trainer-interrupted-card" role="status"><strong>Saved round available</strong><span>{persistence.interruptedRound.config.drillLabel} · item {persistence.interruptedRound.currentIndex + 1} of {persistence.interruptedRound.sequence.length} · saved {formatDate(new Date(persistence.interruptedRound.savedAt))}</span><p>Resume restores the paused route and remaining time. Review setup starts no timer.</p><div className="trainer-inline-actions"><button className="btn primary" type="button" onClick={restoreInterruptedRound}>Resume</button><button className="btn" type="button" onClick={reviewInterruptedSetup}>Review setup</button><button className="btn ghost" type="button" onClick={discardInterruptedDraft}>Discard draft</button></div></aside>}
        {reviewMode === "setup" && persistence.interruptedRound && status === "idle" && <aside className="trainer-review-banner" role="status"><strong>Setup review — timer paused</strong><span>{persistence.interruptedRound.config.drillLabel} · {persistence.interruptedRound.config.length} changes · {persistence.interruptedRound.config.pace === "manual" ? "manual pace" : `${persistence.interruptedRound.config.pace}s planned pace`}</span><div className="trainer-inline-actions"><button className="btn primary" type="button" onClick={restoreInterruptedRound}>Resume saved round</button><button className="btn ghost" type="button" onClick={() => setReviewMode("closed")}>Close review</button></div></aside>}

        {drillMode === "song" && <div className="trainer-import-row"><button className="btn" type="button" onClick={importSongCoachSets} disabled={settingsLocked}><LocalizedCopy id="importSavedSets" /></button><span>{songImportMessage} Only chord names with local diagrams are included.</span></div>}
        {drillMode === "song" && selectedSongSet && <DeferredDetails className="trainer-advanced-tools" summary={<>Song Coach route versions <span>Manual local snapshot comparison</span></>}><LazySetRevisionControl setId={selectedSongSet.id} title={selectedSongSet.title} items={(selectedSongSet.route ?? selectedSongSet.chords).slice(0, 64).map((chord) => ({ name: chord.name, shapeId: libraryItemForChord(chord)?.id ?? "unsupported" }))} /></DeferredDetails>}
        <DeferredDetails className="trainer-advanced-tools" summary={<>Issue focus <span>Load a gentle self-selected drill</span></>}><LazyIssueFocus onLoad={(issue) => { const pair = levelWeakPair ?? [effectivePairFrom, effectivePairTo]; setPairFrom(pair[0]); setPairTo(pair[1]); setDrillMode("pair"); setRoundLength(5); setPace(6); setRhythmAware(issue === "late"); setRoundNote(`Self-selected focus: ${issue}.`); setShareMessage(`Gentle ${issue} focus loaded. Review the pair and press Start when ready.`); }} /></DeferredDetails>

        {inAppReminder && todayPractice.seconds < dailyGoalMinutes * 60 && <aside className="trainer-reminder" role="status"><span><strong>{t("todayPracticeUnfinished")}</strong> {Math.max(1, dailyGoalMinutes - Math.floor(todayPractice.seconds / 60))} minute(s) remain. This reminder appears only inside Trainer.</span><button className="btn ghost" type="button" onClick={() => setInAppReminder(false)}>{t("dismiss")}</button></aside>}

        <details className="trainer-lab-section">
          <summary><LocalizedCopy id="weeklyRotation" /></summary>
          <div className="trainer-rotation-editor">
            <label><LocalizedCopy id="day" /><select value={rotationDay} onChange={(event) => setRotationDay(Number(event.target.value))}>{DAY_LABELS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label>Drill<select value={rotationDrill} onChange={(event) => setRotationDrill(event.target.value as DrillMode)}>{["random", "barre", "pair", "progression", "family", "keepFingers"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
            <label>Label<input maxLength={60} value={rotationLabel} onChange={(event) => setRotationLabel(event.target.value)} placeholder="Open chords" /></label>
            <button className="btn" type="button" onClick={saveRotation}><LocalizedCopy id="saveRotation" /></button>
            <button className="btn" type="button" onClick={applyEmergencyWarmUp} disabled={settingsLocked}><LocalizedCopy id="loadWarmup" /></button>
          </div>
          <p>{todayRotation ? <>Today: <strong>{todayRotation.label}</strong> ({todayRotation.drill}). <button className="text-button" type="button" onClick={useTodayRotation} disabled={settingsLocked}><LocalizedCopy id="useSuggestion" /></button></> : t("noRotationToday")}</p>
        </details>

        <details className="trainer-practice-options">
          <summary>Practice options <span>Goals, rhythm, memory, assistance, and pace controls</span></summary>
        <div className="trainer-goal-builder">
          <label><input type="checkbox" checked={transitionGoalOn} onChange={(event) => setTransitionGoalOn(event.target.checked)} disabled={settingsLocked} /> <LocalizedCopy id="transitionGoal" /></label>
          <select aria-label="Transition goal from chord" value={effectiveGoalFrom} onChange={(event) => { setTransitionGoalFrom(event.target.value); setTransitionGoalProgress(0); }} disabled={!transitionGoalOn || settingsLocked}>{chordNames.map((name) => <option key={name}>{name}</option>)}</select>
          <span aria-hidden="true">→</span>
          <select aria-label="Transition goal to chord" value={effectiveGoalTo} onChange={(event) => { setTransitionGoalTo(event.target.value); setTransitionGoalProgress(0); }} disabled={!transitionGoalOn || settingsLocked}>{chordNames.filter((name) => name !== effectiveGoalFrom).map((name) => <option key={name}>{name}</option>)}</select>
          <select aria-label="Clean repetitions target" value={transitionGoalTarget} onChange={(event) => { setTransitionGoalTarget(Number(event.target.value)); setTransitionGoalProgress(0); }} disabled={!transitionGoalOn || settingsLocked}>{[3, 5, 8, 10].map((count) => <option key={count} value={count}>{count} clean reps</option>)}</select>
        </div>

        <div className="trainer-options">
          <label><input type="checkbox" checked={previewEnabled} onChange={(event) => setPreviewEnabled(event.target.checked)} disabled={settingsLocked} /> <LocalizedCopy id="previewSequence" /></label>
          <label><input type="checkbox" checked={previewAudioCue} onChange={(event) => setPreviewAudioCue(event.target.checked)} disabled={settingsLocked} /> <LocalizedCopy id="previewRhythm" /></label>
          <LazyVoicePromptToggle enabled={voicePrompts} locked={settingsLocked} known={voicePromptSupportKnown} supported={voicePromptSupported} onChange={setVoicePrompts} />
          <label><input type="checkbox" checked={adaptivePacing} onChange={(event) => setAdaptivePacing(event.target.checked)} disabled={settingsLocked || pace === "manual"} /> <LocalizedCopy id="slowAfterMisses" /></label>
          <label><input type="checkbox" checked={assistanceEnabled} onChange={(event) => { setAssistanceEnabled(event.target.checked); setAssistanceRevealed(false); }} disabled={settingsLocked} /> Opt-in assistance fading</label>
          <label><input type="checkbox" checked={warmUp} onChange={(event) => setWarmUp(event.target.checked)} disabled={settingsLocked || pace === "manual"} /> <LocalizedCopy id="warmupPaceRamp" /></label>
          <label><input type="checkbox" checked={largeDiagrams} onChange={(event) => setLargeDiagrams(event.target.checked)} /> <LocalizedCopy id="largeDiagrams" /></label>
          <label><input type="checkbox" checked={silentPractice} onChange={(event) => setSilentPractice(event.target.checked)} /> <LocalizedCopy id="silentFretting" /></label>
          <label><input type="checkbox" checked={duetMode} onChange={(event) => setDuetMode(event.target.checked)} disabled={settingsLocked} /> <LocalizedCopy id="sameDeviceDuet" /></label>
          <label><input type="checkbox" checked={stageMode} onChange={(event) => setStageMode(event.target.checked)} /> <LocalizedCopy id="lowLightStage" /></label>
          <label><input type="checkbox" checked={rehearsalMode} onChange={(event) => setRehearsalMode(event.target.checked)} disabled={settingsLocked} /> <LocalizedCopy id="rehearsalIntro" /></label>
          <label><input type="checkbox" checked={microGoalOn} onChange={(event) => { setMicroGoalOn(event.target.checked); setMicroGoalProgress(0); }} disabled={settingsLocked} /> <LocalizedCopy id="microGoal" /></label>
        </div>

        {duetMode && <div className="trainer-duet-names"><label>First role<input maxLength={24} value={duetNames[0]} onChange={(event) => setDuetNames([event.target.value, duetNames[1]])} disabled={settingsLocked} /></label><label>Second role<input maxLength={24} value={duetNames[1]} onChange={(event) => setDuetNames([duetNames[0], event.target.value])} disabled={settingsLocked} /></label></div>}

        <div className="trainer-speed-ladder" aria-label="Speed ladder">
          <div><span className="label"><LocalizedCopy id="speedLadder" /></span><strong>{ladderPace}s rung</strong><small>Two fully rated clean rounds unlock the next rung.</small></div>
          <div>{SPEED_LADDER.map((seconds, index) => <button key={seconds} type="button" className={index === persistence.speedLadder.unlockedIndex ? "active" : ""} disabled={index > persistence.speedLadder.unlockedIndex || settingsLocked} onClick={() => setPace(seconds)}>{seconds}s {index > persistence.speedLadder.unlockedIndex ? "locked" : "ready"}</button>)}</div>
          <progress max={2} value={persistence.speedLadder.cleanRoundsAtRung} />
        </div>

        <div className="trainer-rhythm-settings">
          <label><input type="checkbox" checked={rhythmAware} onChange={(event) => setRhythmAware(event.target.checked)} disabled={settingsLocked || pace === "manual"} /> Rhythm-aware four-beat bars</label>
          <label>BPM<input type="number" min="40" max="120" value={rhythmBpm} onChange={(event) => setRhythmBpm(clampNumber(Number(event.target.value), 40, 120, 60))} disabled={!rhythmAware || settingsLocked} /></label>
          <label><LocalizedCopy id="beat" /> <select value={changeBeat} onChange={(event) => setChangeBeat(Number(event.target.value))} disabled={!rhythmAware || settingsLocked}>{[1, 2, 3, 4].map((beat) => <option key={beat} value={beat}>Beat {beat}</option>)}</select></label>
          <label><LocalizedCopy id="strummingCue" /><select value={strummingPrompt} onChange={(event) => setStrummingPrompt(event.target.value as StrummingPrompt)}>{Object.entries(STRUMMING_PROMPTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label><input type="checkbox" checked={backingGroove} onChange={(event) => setBackingGroove(event.target.checked)} /> <LocalizedCopy id="backingGroove" /></label>
        </div>
        </details>

        {transitionGoalOn && <div className="trainer-goal-progress" aria-live="polite"><span><strong>{effectiveGoalFrom} → {effectiveGoalTo}</strong> clean goal</span><progress max={transitionGoalTarget} value={transitionGoalProgress} /><strong>{transitionGoalProgress}/{transitionGoalTarget}</strong></div>}
        {microGoalOn && <div className="trainer-goal-progress" aria-live="polite"><span><strong>Shared-finger micro-goal</strong> · clean transitions with a planted fretted position</span><progress max={3} value={microGoalProgress} /><strong>{microGoalProgress}/3</strong></div>}
        {(["running", "paused", "countIn"] as TrainerStatus[]).includes(status) && <div className="trainer-transport" role="region" aria-label="Compact round transport">
          <div><span className="label">Now</span><strong>{challengeMode === "recall" && !recallRevealed ? "Hidden" : currentChord?.name ?? sequence[0]?.name ?? "—"}</strong>{feedback[currentIndex] && <small>{RATING_LABEL[feedback[currentIndex]]}</small>}</div>
          <div><span className="label">Next</span><strong>{challengeMode === "recall" && !recallRevealed || assistanceLevel >= 1 ? "Hidden" : nextChord?.name ?? "Finish"}</strong></div>
          <span className="trainer-transport-time">{landingCheckpoint && !placementConfirmed ? "Placement check" : statusLabel}</span>
          <button className="btn" type="button" onClick={status === "paused" ? resumeRound : pauseRound}>{status === "paused" ? "Resume" : "Pause"}</button>
        </div>}

        {restPrompt && <aside className="trainer-rest-prompt" role="status"><div><strong><LocalizedCopy id="smartRestPrompt" /></strong><p>{restPrompt}</p><label>After resting, did your hand tension reduce?<input maxLength={120} value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Yes—my wrist feels looser" /></label></div><div><button className="btn" type="button" onClick={saveReflection} disabled={!reflection.trim()}><LocalizedCopy id="saveReflection" /></button><button className="btn ghost" type="button" onClick={() => setRestPrompt("")}>{t("dismiss")}</button></div></aside>}

        {assistanceLevel === 0 && targetGuideVisible && <section className="trainer-3d-launcher" aria-labelledby="trainer-3d-title">
          <div className="trainer-3d-launcher-copy">
            <span className="trainer-3d-icon" aria-hidden="true">✋</span>
            <div><span className="label">3D left-hand guide</span><h3 id="trainer-3d-title">See how to fret {threeDGuideChord?.name ?? "the chord"}</h3><p>The existing interactive hand engine is available before, during, and after a round. It is downloaded only when you open it.</p></div>
          </div>
          <div className="trainer-3d-launcher-actions">
            <label>Guide chord<select value={threeDGuideChord?.name ?? ""} onChange={(event) => setThreeDPreviewChordName(event.target.value)} disabled={Boolean(currentChord)}>{activeLevel.chords.map((chord) => <option key={chord.name} value={chord.name}>{chord.name}</option>)}</select></label>
            <button className="btn primary" type="button" aria-controls="trainer-3d-hand-panel" aria-expanded={displayPreference === "full" && threeDHandVisible} onClick={() => { if (displayPreference === "light") { setDisplayPreference("full"); setThreeDHandVisible(false); setShareMessage("Full guides enabled. Press Open 3D hand when you are ready."); } else { if (threeDHandVisible) cancelTransitionPreview(); setThreeDHandVisible((visible) => !visible); } }} disabled={!threeDGuideChord}>{displayPreference === "light" ? "Enable full guides" : threeDHandVisible ? "Close 3D hand" : "Open 3D hand"}</button>
          </div>
          {displayPreference === "full" && threeDHandVisible && threeDGuideChord && <div className="trainer-3d-hand-panel" id="trainer-3d-hand-panel"><div><span className="label">Interactive fretting view · {threeDGuideChord.name}</span><p>{status === "idle" ? `Idle preview pair: ${transitionFromForPreview?.name ?? "—"} → ${transitionTargetForPreview?.name ?? threeDGuideChord.name}. This does not claim a played transition.` : "Click a diagram contact to highlight the same string/fret here. The controlled step demo uses actual transition phases; Play freely remains available when no phase is set."}</p>{contactOptions.length > 0 && <label>Keyboard contact selector<select aria-label="Keyboard contact selector" value={selectedContact ? `${selectedContact.string}:${selectedContact.fret}` : ""} onChange={(event) => { const next = contactOptions.find((item) => `${item.string}:${item.fret}` === event.target.value); if (next) { setSelectedContact(next); cancelTransitionPreview(); } }}><option value="">Choose a fretted contact</option>{contactOptions.map((item) => <option key={`${item.string}:${item.fret}`} value={`${item.string}:${item.fret}`}>Finger {item.finger} · string {item.string + 1} · fret {item.fret}</option>)}</select></label>}{transitionPhase !== null && <small role="status">Step demo: {transitionPhase < 0.34 ? "release" : transitionPhase < 0.85 ? "move" : "land"} · phase {Math.round(transitionPhase * 100)}%</small>}<div className="trainer-inline-actions"><button className="btn" type="button" onClick={() => holdTransitionPhase(0)} disabled={!transitionFromForPreview || !transitionTargetForPreview}>Release</button><button className="btn" type="button" onClick={() => holdTransitionPhase(0.5)} disabled={!transitionFromForPreview || !transitionTargetForPreview}>Move</button><button className="btn" type="button" onClick={() => holdTransitionPhase(1)} disabled={!transitionFromForPreview || !transitionTargetForPreview}>Land</button><button className="btn" type="button" onClick={previewTransitionSteps} disabled={!transitionFromForPreview || !transitionTargetForPreview || transitionPhase !== null}>Preview steps</button><button className="btn ghost" type="button" onClick={cancelTransitionPreview} disabled={transitionPhase === null}>Play freely</button></div></div><LazyGuitarTechnique3D chord={threeDGuideChord} transitionFrom={transitionFromForPreview} handedness={displayHandedness} mode="left-hand" labels={true} selectionOnly selectedContact={selectedContact} transitionPhase={transitionPhase} onTargetChange={(target) => { setSelectedContact(target); cancelTransitionPreview(); }} className="guitar-technique-3d trainer-3d-hand" /></div>}
        </section>}

      <DeferredDetails className="trainer-advanced-tools" summary={<>Delayed recall <span>Untimed memory check</span></>}><LazyTrainerDelayedRecall message={recallMessage} drill={recallDrill} choice={recallChoice} setChoice={setRecallChoice} start={startDelayedRecall} advance={advanceDelayedRecall} submit={submitDelayedRecall} reset={() => setRecallDrill(null)} /></DeferredDetails>

        {status === "preview" ? (
          <div className="trainer-preview" aria-label="Round preview">
            <div><span className="label">Sequence preview</span><h3>Review the route before the count-in.</h3>{sectionDrillOn && selectedSongSet && <LazySectionPreviewCheckpoint section={rehearsalSection} length={sequence.length} pace={sectionPaces[rehearsalSection]} />}</div>
            <ol>{sequence.map((chord, index) => <li key={`${chord.name}-${index}`}><span>{index + 1}</span>{chord.name}{previewAudioCue && <button type="button" aria-label={`Play rhythm cue for ${chord.name}`} onClick={() => void playClick(index === 0)}>♪</button>}</li>)}</ol>
            <button className="btn primary" onClick={beginCountIn}>Begin {rehearsalMode ? "4-beat stage intro" : "3-beat count-in"}</button>
          </div>
        ) : status === "countIn" ? (
          <div className="trainer-count-in" role="timer" aria-live="assertive">
            <span>{rehearsalMode ? "Stage intro" : "Get ready"}</span><strong>{countInBeat}</strong><p>First chord: {challengeMode === "recall" ? "Hidden" : sequence[0]?.name}</p>
          </div>
        ) : (
            <div className="trainer-transition-stage" key={currentIndex}>
            {performanceMode && <button className="btn trainer-performance-exit" type="button" onClick={() => void togglePerformanceMode()}>Exit performance mode</button>}
            <div className="trainer-previous-chord">
              <span className="label"><LocalizedCopy id="previous" /></span>
              <h3>{challengeMode === "recall" && !recallRevealed ? "Hidden" : challengeMode === "diagramOnly" && previousChord ? "Identify it" : previousChord?.name ?? (currentChord ? "Start" : "—")}</h3>
              {previousChord && challengeMode === "standard" && diagramVisibility === "visible" ? <ChordDiagram chord={previousChord} largeChart={largeDiagrams} orientation={displayHandedness} /> : <div className="diagram-empty" />}
            </div>
            <span className="trainer-transition-arrow" aria-hidden="true">→</span>
            <div className="trainer-current-chord">
              <span className="label">{duetMode && currentChord ? `${duetRole} · ` : ""}Current chord</span>
              <h3>{currentChord ? challengeMode === "recall" && !recallRevealed ? "Hidden" : challengeMode === "diagramOnly" ? "Name this shape" : currentChord.name : "Press start"}</h3>
              {currentChord && showCurrentDiagram && diagramVisibility === "visible" && (challengeMode === "standard" || challengeMode === "diagramOnly" || (challengeMode === "recall" && recallRevealed)) ? <ChordDiagram chord={currentChord} largeChart={largeDiagrams} orientation={displayHandedness} selectedContact={selectedContact} onContactSelect={(target) => { setSelectedContact(target); cancelTransitionPreview(); }} /> : <div className="diagram-empty trainer-recall-empty"><span>{challengeMode === "recall" && currentChord ? "Build the current shape from memory" : challengeMode === "nameOnly" || diagramVisibility === "minimal" ? "Diagram hidden" : assistanceLevel === 2 ? "Current diagram hidden — reveal when ready" : ""}</span></div>}
              {currentChord && challengeMode === "recall" && <button className="text-button" type="button" onClick={() => setRecallRevealed((shown) => !shown)}>{recallRevealed ? "Hide diagram" : "Reveal diagram"}</button>}
              {currentChord && assistanceLevel === 0 && targetGuideVisible && <button className="btn ghost trainer-current-3d-button" type="button" onClick={() => { if (displayPreference === "light") { setDisplayPreference("full"); setShareMessage("Full guides enabled. Press Open 3D hand when you are ready."); } else { if (threeDHandVisible) cancelTransitionPreview(); setThreeDHandVisible((visible) => !visible); } }}>{displayPreference === "light" ? "Enable full guides for 3D" : threeDHandVisible ? "Hide 3D hand" : "Show fingering in 3D"}</button>}
            </div>
            <aside className="trainer-up-next" aria-live="polite"><span className="label">Up next</span><strong>{assistanceLevel >= 1 || (challengeMode === "recall" && !recallRevealed) ? "Hidden" : nextChord?.name ?? "Round recap"}</strong>{nextChord && showUpcomingDiagram && diagramVisibility === "visible" && challengeMode !== "nameOnly" && challengeMode !== "recall" ? <ChordDiagram chord={nextChord} orientation={displayHandedness} /> : <span>{assistanceLevel >= 1 || diagramVisibility === "minimal" ? "Upcoming shape hidden" : "Prepare the next shape"}</span>}</aside>
            {strummingPrompt !== "none" && <div className="trainer-strumming-cue"><span className="label">Strum</span><strong>{STRUMMING_PROMPTS[strummingPrompt]}</strong>{rhythmAware && <small>Change on beat {changeBeat} · {rhythmBpm} BPM</small>}</div>}
            <div className="trainer-stage-meta"><strong>{tuningLabel}</strong><span>{capoFret ? `Capo ${capoFret}` : "No capo"}</span>{drillMode === "neckLadder" && <span>Neck ladder {displayLadderSteps.map((step) => step.band).join(" → ")} · step {Math.min(displayLadderSteps.length, Math.floor(Math.max(0, currentIndex) / 4) + 1)}: {displayLadderSteps[Math.min(displayLadderSteps.length - 1, Math.floor(Math.max(0, currentIndex) / 4))]?.band ?? "—"}</span>}{rehearsalMode && <span>Rehearsal mode</span>}</div>
          </div>
        )}

        {currentChord && technique && targetGuideVisible && status === "running" && <div className="trainer-technique-strip">
          <div><span className="label">Shape cue</span><p>{technique.shapeTip}</p></div>
          <div><span className="label">Transition cue</span><p>{technique.pivotTip}</p></div>
          <div><span className="label">Technique focus</span><p>{technique.focus}</p>{technique.alternative && <small>Compare: {technique.alternative.label} — {technique.alternative.description}</small>}</div>
          <div><span className="label">Finger-placement animation</span><p>Open either guide only when the shape needs a closer look.</p><div className="trainer-inline-actions"><button className="btn" type="button" onClick={() => setGuideVisible((visible) => !visible)}>{guideVisible ? "Hide guide" : "Show animated guide"}</button><button className="btn" type="button" aria-expanded={threeDHandVisible} onClick={() => setThreeDHandVisible((visible) => !visible)}>{threeDHandVisible ? "Hide 3D hand" : "Show 3D hand"}</button></div></div>
        </div>}
        {assistanceEnabled && (status === "running" || status === "paused") && <aside className="trainer-assistance-status" aria-live="polite"><strong>Assistance fading: {assistanceRevealed ? "full help" : assistanceLevel === 2 ? "current diagram hidden" : assistanceLevel === 1 ? "upcoming diagram hidden" : "full help"}</strong><span>{assistanceRevealed ? "Reveal is held for this round." : `${assistanceCleanStreak}/3 clean changes toward the first fade; a miss or needs-work restores help.`}</span><div className="trainer-inline-actions"><button className="btn" type="button" onClick={() => setAssistanceRevealed(true)} disabled={assistanceRevealed}>Reveal help</button><button className="btn ghost" type="button" onClick={() => setAssistanceRevealed(false)} disabled={!assistanceRevealed}>Reset fade</button></div></aside>}
        {previousChord && currentChord && status === "running" && assistanceLevel < 2 && <div className="trainer-movement-checklist" aria-label="Movement checklist">
          <button className="btn ghost" type="button" aria-expanded={breakdownVisible} onClick={() => setBreakdownVisible((visible) => !visible)}>{breakdownVisible ? "Hide movement checklist" : "Show movement checklist"}</button>
          {breakdownVisible && <ol>{transitionBreakdown(previousChord, currentChord).map((step) => <li key={step}>{step}</li>)}</ol>}
        </div>}
        {displayPreference === "full" && diagramVisibility === "visible" && targetGuideVisible && currentChord && guideVisible && status === "running" && assistanceLevel < 2 && <LazyFingerPlacementGuide chord={currentChord} orientation={displayHandedness} />}
        {landingCheckpoint && currentChord && status === "running" && !placementConfirmed && <div className="trainer-placement-check" role="status"><strong>Place {currentChord.name} before the timer starts.</strong><p>Silent fret → check placement → strum or begin the pace.</p><button className="btn primary" type="button" onClick={() => { setPlacementConfirmed(true); setRecoveryNonce((nonce) => nonce + 1); }}>Placement confirmed · start pace</button></div>}

        {currentChord && status !== "preview" && status !== "countIn" && (
          <div className="trainer-feedback" role="group" aria-label={`Rate ${currentChord.name}`}>
            <span className="label">How was this change?</span>
            {(["clean", "needsWork", "missed"] as FeedbackRating[]).map((rating) => (
              <button key={rating} className={`btn trainer-rating rating-${rating} ${feedback[currentIndex] === rating ? "selected" : ""}`} onClick={() => rateCurrentChord(rating)} disabled={Boolean(feedback[currentIndex]) || status === "paused"} aria-pressed={feedback[currentIndex] === rating}>{RATING_LABEL[rating]}</button>
            ))}
            {feedback[currentIndex] && <span className="trainer-feedback-saved" aria-live="polite">Saved once for this change.</span>}
            {(feedback[currentIndex] === "missed" || feedback[currentIndex] === "needsWork") && <LazyMissTags value={missTags[currentIndex] ?? []} rounds={persistence.completedRounds} onChange={(value) => setMissTags((current) => ({ ...current, [currentIndex]: value }))} />}
            <LazyTransitionTensionCheck value={tensionChecks[currentIndex]} onChange={(value) => setTensionChecks((current) => ({ ...current, [currentIndex]: value }))} />
            <LazyTransitionCriteria criteria={cleanCriteria} onCriteria={setCleanCriteria} checks={criteriaChecks} onCheck={(index, criterion, pass) => setCriteriaChecks((current) => ({ ...current, [index]: { ...current[index], [criterion]: pass } }))} index={currentIndex} enabled={status === "running" && !feedback[currentIndex]} />
            {undoSnapshotRef.current && <button className="btn ghost" type="button" onClick={undoLatestRating}>Undo latest rating</button>}
            <div className="trainer-feedback-actions" aria-label="Next action">
              <button className="btn trainer-recover" type="button" onClick={recoverCurrent} disabled={status !== "running"}>Repeat</button>
              <button className="btn" type="button" onClick={slowDownRound} disabled={status !== "running" && status !== "paused" || roundConfig.pace === "manual"}>Slow down</button>
              <button className="btn ghost" type="button" onClick={finishEarlyRound} disabled={status !== "running" && status !== "paused"}>Finish early</button>
            </div>
          </div>
        )}

        <div className="controls trainer-controls">
          <button className="btn primary" onClick={() => void startRound()} disabled={status !== "idle"}><LocalizedCopy id="startRound" /></button>
          <button className="btn" onClick={pauseRound} disabled={status !== "running" && status !== "countIn"}><LocalizedCopy id="pause" /></button>
          <button className="btn" onClick={resumeRound} disabled={status !== "paused"}><LocalizedCopy id="resume" /></button>
          <button className="btn trainer-handsfree-control" onClick={inspectPreviousChord} disabled={status !== "running" || currentIndex <= 0}>← Previous review</button>
          {status === "running" && <button className="btn primary trainer-handsfree-control" onClick={advanceChord}>Next chord →</button>}
          {status === "running" && <button className="btn trainer-handsfree-control" onClick={recoverCurrent}>↓ Recover</button>}
          <button className="btn ghost" onClick={resetRound}><LocalizedCopy id="reset" /></button>
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

      <details className="trainer-advanced-tools">
        <summary>Technique <span>Guides, transitions, and hand movement</span></summary>
      <section className="panel trainer-guided-path" aria-label="Adaptive practice path and rehearsal tools">
        <div className="panel-header"><div><p className="eyebrow">Adaptive practice path</p><h2>Carry today&apos;s evidence into the next rehearsal.</h2><p>These suggestions are calculated from capped local ratings, fatigue notes, and the current song goal.</p></div><button className="btn" type="button" onClick={exportRehearsalSummary}>Share summary · no recordings</button></div>
        <div className="trainer-path-week">{practicePath.map((item) => <article key={item.day}><span>{item.day}</span><strong>{item.focus}</strong></article>)}</div>
        <div className="trainer-guided-grid">
          <article>
            <span className="label">Chord-transition camera guides</span><h3>{cameraAngle === "fretting" ? "Fretting-hand view" : cameraAngle === "strumming" ? "Strumming-hand view" : "Neck-side view"}</h3>
            <div className={`trainer-camera-placeholder angle-${cameraAngle}`} role="img" aria-label={`${cameraAngle} camera-angle teaching placeholder for ${threeDGuideChord?.name ?? "the current chord"}`}><span>{cameraAngle === "fretting" ? "Watch fingertip order and thumb release" : cameraAngle === "strumming" ? "Keep the pulse while the left hand moves" : "Check fingertip arch and fret-wire distance"}</span></div>
            <div className="trainer-segmented" role="group" aria-label="Camera angle">{(["fretting", "strumming", "neck"] as CameraAngle[]).map((angle) => <button type="button" key={angle} className={cameraAngle === angle ? "active" : ""} aria-pressed={cameraAngle === angle} onClick={() => setCameraAngle(angle)}>{angle === "neck" ? "Neck-side" : `${angle[0].toUpperCase()}${angle.slice(1)} hand`}</button>)}</div>
            <small>No unlicensed video is bundled. These angle-specific storyboards provide safe shot/cue placeholders for locally supplied coaching media.</small>
          </article>
          <article className={currentChord?.barre ? "trainer-pressure-live" : ""}><span className="label">Live finger-pressure reminder</span><p>{barrePressureCue}</p><small>Technique cue only; the browser does not measure physical pressure.</small></article>
          <article>
            <span className="label">Round-to-song bridge</span><p>Move a clean transition into a song section or a common progression while its hand motion is fresh.</p><button className="btn" type="button" onClick={applySongBridge} disabled={settingsLocked}>Load context round</button><small>{selectedSongSet ? `Song context: ${selectedSongSet.title}` : "No imported song set; a common progression will be used."}</small>
          </article>
          <article>
            <span className="label">Rehearsal countdown plan</span><label>Rehearsal date<input type="date" min={localDateKey()} value={rehearsalDate} onChange={(event) => setRehearsalDate(event.target.value)} /></label>
            {rehearsalDaysLeft === null ? <p>Choose a date to turn the weekly path into a deadline-aware plan.</p> : rehearsalDaysLeft < 0 ? <p>The selected rehearsal date has passed. Choose a new date.</p> : <p><strong>{rehearsalDaysLeft === 0 ? "Rehearsal day" : `${rehearsalDaysLeft} day${rehearsalDaysLeft === 1 ? "" : "s"} remaining`}.</strong> {rehearsalDaysLeft <= 2 ? "Use short confidence rounds; avoid new speed targets." : rehearsalDaysLeft <= 7 ? "Alternate targeted transitions with one full run-through." : "Build accuracy first, then add two performance simulations in the final week."}</p>}
          </article>
          <article>
            <span className="label">Mistake replay</span><p>Reconstructs the local sequence around each flagged change using its planned pace; it does not claim to replay recorded audio.</p>
            {activeMistakeReplay ? <><div className="trainer-mistake-window">{activeMistakeReplay.window.map((chord, index) => <span key={`${chord.name}-${index}`}>{chord.name}</span>)}</div><p><strong>{RATING_LABEL[activeMistakeReplay.rating]}</strong> at item {activeMistakeReplay.index + 1}{activeMistakeReplay.plannedSeconds ? ` · planned ${activeMistakeReplay.plannedSeconds}s` : " · manual pace"}</p><div className="trainer-inline-actions"><button className="btn" type="button" onClick={() => setMistakeReplayIndex((index) => Math.max(0, index - 1))} disabled={mistakeReplayIndex <= 0}>Previous miss</button><button className="btn" type="button" onClick={() => setMistakeReplayIndex((index) => Math.min(mistakeReplayItems.length - 1, index + 1))} disabled={mistakeReplayIndex >= mistakeReplayItems.length - 1}>Next miss</button></div></> : <p>Mark a change “Needs work” or “Missed” to build a replay window.</p>}
          </article>
          <article>
            <span className="label">Limited coach mode</span><div className="trainer-segmented" role="group" aria-label="Coach pointer type">{(["text", "audio", "visual"] as const).map((kind) => <button type="button" key={kind} className={coachPointer === kind ? "active" : ""} onClick={() => setCoachPointer(kind)}>{kind}</button>)}</div>
            <textarea maxLength={1000} value={coachNotes} onChange={(event) => setCoachNotes(event.target.value)} placeholder="One transition cue, such as: keep finger 3 planted through G → Cadd9." />
            {coachPointer !== "text" && <><button className="btn" type="button" onClick={() => coachPointerFileRef.current?.click()}>Choose local {coachPointer} pointer</button><input ref={coachPointerFileRef} className="visually-hidden" type="file" accept={coachPointer === "audio" ? "audio/*" : "image/*,video/*"} onChange={(event) => selectCoachAttachment(event.target.files?.[0])} />{coachAttachment && <small>{coachAttachment.name} · {(coachAttachment.bytes / 1_000_000).toFixed(1)} MB · metadata only in this tab</small>}</>}
            {coachPointer === "audio" && takes[0] && <small>The latest in-memory Trainer take can also serve as the session reference; it is never attached to exports.</small>}
          </article>
          <article>
            <span className="label">Rhythmic displacement</span><p>Practice the same change on a different beat without rebuilding the round.</p><div className="trainer-beat-buttons">{[1, 2, 3, 4].map((beat) => <button key={beat} type="button" className={rhythmAware && changeBeat === beat ? "active" : ""} onClick={() => { setRhythmAware(true); setChangeBeat(beat); }} disabled={settingsLocked}>Beat {beat}</button>)}</div>
          </article>
          <article>
            <span className="label">Hand-relaxation score</span><div className="trainer-score-pair"><label>Before<select value={relaxationBefore} onChange={(event) => setRelaxationBefore(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}/5 relaxed</option>)}</select></label><label>After<select value={relaxationAfter} onChange={(event) => setRelaxationAfter(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}/5 relaxed</option>)}</select></label></div><p>{relaxationAfter > relaxationBefore ? `Relaxation improved by ${relaxationAfter - relaxationBefore}.` : relaxationAfter < relaxationBefore ? "Tension increased; shorten the next round or rest." : "Relaxation is unchanged; keep the next goal small."}</p>
          </article>
          <article>
            <span className="label">Progression memory commit</span><p>Say or enter the next chord before revealing the route.</p><label>Your committed answer<input maxLength={24} value={memoryAnswer} onChange={(event) => { setMemoryAnswer(event.target.value); setMemoryResult(""); }} placeholder="Next chord" /></label><button className="btn" type="button" onClick={commitMemoryAnswer} disabled={!memoryAnswer.trim()}>Commit and reveal</button>{memoryResult && <p role="status">{memoryResult}</p>}
          </article>
          <article>
            <span className="label">Alternate-fingering A/B</span><p><strong>A · standard:</strong> {threeDGuideChord ? `Use the diagrammed fingering for ${threeDGuideChord.name}.` : "Choose a guide chord."}</p><p><strong>B · alternate:</strong> {alternateFingering}</p><div className="trainer-ab-scores"><button type="button" onClick={() => setFingeringScores((scores) => ({ ...scores, standard: scores.standard + 1 }))}>A clean · {fingeringScores.standard}</button><button type="button" onClick={() => setFingeringScores((scores) => ({ ...scores, alternate: scores.alternate + 1 }))}>B clean · {fingeringScores.alternate}</button></div><small>Counts last only for this open Trainer session.</small>
          </article>
          <article>
            <span className="label">Performance rescue</span><label>Scenario<select value={rescueScenario} onChange={(event) => setRescueScenario(event.target.value as RescueScenario)} disabled={settingsLocked}><option value="lostPlace">Lost your place</option><option value="badChange">Bad chord change</option><option value="brokenRhythm">Broken rhythm</option><option value="restart">Restart under pressure</option></select></label><button className="btn" type="button" onClick={loadRescueDrill} disabled={settingsLocked}>Load five-change rescue drill</button>
          </article>
          <article className="trainer-vocabulary-card">
            <span className="label">Personal chord vocabulary</span><div className="trainer-vocabulary-list">{activeLevel.chords.map((chord) => <label key={chord.name}><input type="checkbox" checked={personalVocabulary.includes(chord.name)} onChange={(event) => setPersonalVocabulary((names) => event.target.checked ? [...names.filter((name) => name !== chord.name), chord.name].slice(-24) : names.filter((name) => name !== chord.name))} disabled={settingsLocked} /> {chord.name}</label>)}</div><label><input type="checkbox" checked={vocabularyOnly} onChange={(event) => setVocabularyOnly(event.target.checked)} disabled={settingsLocked || personalVocabularyChords.length < 2} /> Limit new adaptive rounds to this vocabulary</label><small>{personalVocabularyChords.length}/24 supported shapes selected; choose at least two.</small>
          </article>
        </div>
      </section>

      </details>
      <details className="trainer-advanced-tools">
        <summary>Progress <span>Confidence, goals, and readiness</span></summary>
      <section className="panel trainer-rehearsal-tools" aria-label="Rehearsal readiness tools">
        <div className="panel-header">
          <div><p className="eyebrow">Rehearsal readiness</p><h2>Turn practice evidence into a usable plan.</h2><p>All of these controls stay local and are calculated only when this screen renders.</p></div>
          <button className="btn primary" type="button" onClick={applyLast10Minutes} disabled={settingsLocked}>Load last 10 minutes</button>
        </div>
        <div className="trainer-rehearsal-grid">
          <article className="trainer-confidence-card">
            <span className="label">Performance confidence</span>
            <strong className="trainer-confidence-score">{performanceConfidence.hasEvidence ? `${performanceConfidence.score}/100` : "Not enough ratings"}</strong>
            <progress max={100} value={performanceConfidence.score} />
            <div className="trainer-confidence-breakdown"><span>Transitions <b>{formatPercent(performanceConfidence.transition / 100)}</b></span><span>Rhythm <b>{formatPercent(performanceConfidence.rhythm / 100)}</b></span><span>Relaxation <b>{formatPercent(performanceConfidence.tension / 100)}</b></span><span>Readiness <b>{formatPercent(performanceConfidence.checklist / 100)}</b></span></div>
            <small>Weights: transitions 35%, rhythm 25%, relaxation 15%, readiness 25%. “Rhythm” and “relaxation” are self-reported proxies; this browser does not measure audio, timing, or physical tension. Rated attempts: {Object.keys(feedback).length} in this round.</small>
            {!performanceConfidence.hasEvidence && <button className="btn" type="button" onClick={() => { setRoundLength(5); setPace(6); setDrillMode("pair"); setShareMessage("Load a short starter to create your first self-rated evidence."); }} disabled={settingsLocked}>Load starter drill</button>}
          </article>
          <article>
            <span className="label">Dated practice goal</span>
            <form className="trainer-dated-goal" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); saveDatedPracticeGoal(String(values.get("goalDate") || ""), String(values.get("goalLabel") || "")); }}>
              <label>Date<input name="goalDate" type="date" min={localDateKey()} defaultValue={persistence.datedPracticeGoal?.date ?? ""} /></label>
              <label>Goal<input name="goalLabel" maxLength={120} defaultValue={persistence.datedPracticeGoal?.label ?? ""} placeholder="Ready for Friday rehearsal" /></label>
              <div className="trainer-inline-actions"><button className="btn" type="submit">Save goal</button><button className="btn ghost" type="button" onClick={() => saveDatedPracticeGoal("", "")}><LocalizedCopy id="clear" /></button></div>
            </form>
            <small>No notifications are scheduled. The date is only used to shape the local practice path.</small>
          </article>
          <article>
            <span className="label">Progress snapshot</span>
            {latestSnapshot ? <><div className="trainer-snapshot-values"><span><small>Latest</small><strong>{formatPercent(latestSnapshot.accuracy / 100)}</strong></span><span><small>Prior</small><strong>{previousSnapshot ? formatPercent(previousSnapshot.accuracy / 100) : "—"}</strong></span><span><small>Confidence</small><strong>{formatPercent(latestSnapshot.confidence / 100)}</strong></span></div><p>{previousSnapshot ? `${formatNumber(latestSnapshot.accuracy - previousSnapshot.accuracy)} points versus the prior ${previousSnapshot.period}.` : "A prior week or month will appear after another completed period."}</p></> : <p>Complete a round to create this week&apos;s and month&apos;s local baseline.</p>}
          </article>
          <article>
            <span className="label">Voicing map · {threeDGuideChord?.name ?? "current chord"}</span>
            {voicingMapEntries.length ? <div className="trainer-voicing-map">{voicingMapEntries.map((item) => <div key={item.id}><strong>{item.position}</strong><span>{item.chord.name}</span><small>{item.qualityLabel}</small></div>)}</div> : <p>No alternate local voicings are catalogued for this shape yet.</p>}
            <small>Compare open, barre, and higher-neck options when the library has them.</small>
          </article>
          <LazyPositionQuizCard entries={voicingMapEntries.slice(0, 6).map((item) => ({ id: item.id, position: item.position, chordName: item.chord.name }))} quiz={positionQuiz} onStart={startPositionQuiz} onChoice={(choice) => setPositionQuiz((current) => current ? { ...current, choice } : current)} onCommit={() => setPositionQuiz((current) => current ? { ...current, committed: true } : current)} onReset={() => setPositionQuiz(null)} />
          <article>
            <span className="label">Band context</span>
            {bandContext ? <><strong>{bandContext.root} · bass anchor</strong><p>{bandContext.role}</p><small>Keep the root clear for the bass player, then choose the suggested rhythm role.</small></> : <p>Select a chord to see its root and band role.</p>}
          </article>
          <article>
            <span className="label">Explain this change</span>
            {explainChange ? <><strong>{explainChange.from} → {explainChange.to}</strong><p>{explainChange.movement}.</p><small>{explainChange.pivot}</small></> : <p>Start a round to see harmonic movement and likely finger pivots.</p>}
          </article>
          <article>
            <span className="label">Adaptive song-section spacing</span>
            <p>{sectionSpacing}</p>
            <small>Weak transitions currently detected: {weakTransitionCount}. This affects guidance only; your saved song order is unchanged.</small>
          </article>
          <article>
            <span className="label">Instrument + tuning warm-up</span>
            <label>Profile<select value={warmUpTemplate} onChange={(event) => setWarmUpTemplate(event.target.value as InstrumentProfile)}><option value="acoustic">Acoustic</option><option value="electric">Electric</option><option value="classical">Classical</option><option value="reducedString">Reduced-string</option></select></label>
            <p>{INSTRUMENT_PROFILES[warmUpTemplate].detail} · {tuningLabel}</p>
            <button className="btn" type="button" onClick={() => applyWarmUpTemplate(warmUpTemplate)} disabled={settingsLocked}>Load profile warm-up</button>
          </article>
          <article>
            <span className="label">Transition → scale fragment</span>
            {scaleFragment ? <><strong>After {currentChord?.name ?? nextChord?.name}</strong><p>{scaleFragment.label}</p><div className="trainer-scale-notes">{scaleFragment.notes.split(" · ").map((note) => <span key={note}>{note}</span>)}</div><small>Use this short fragment after the change to connect chord memory to the neck.</small></> : <p>Select a current chord to reveal a compatible fragment.</p>}
          </article>
          <article className="trainer-rebuild-card">
            <span className="label">Rebuild after error</span>
            {rebuildPrompt.index >= 0 ? <><strong>Find beat {rebuildPrompt.beat}, then rejoin.</strong><p>The miss is paused at item {rebuildPrompt.index + 1}. Breathe, locate the pulse, and re-enter without restarting the whole progression.</p><div className="trainer-inline-actions"><select value={rebuildPrompt.rejoin} onChange={(event) => setRebuildPrompt((prompt) => ({ ...prompt, rejoin: event.target.value as "current" | "next" }))}><option value="current">Rejoin current chord</option><option value="next">Rejoin next chord</option></select><button className="btn primary" type="button" onClick={applyRebuildChoice}>Rejoin progression</button></div></> : <p>A Missed rating pauses the round here so you can rebuild the beat and choose where to rejoin.</p>}
          </article>
          <article className="trainer-footswitch-card">
            <span className="label">Footswitch-friendly controls</span>
            <label><input type="checkbox" checked={footswitchMode} onChange={(event) => setFootswitchMode(event.target.checked)} /> Enable N / R / C shortcuts</label>
            <div className="trainer-footswitch-actions"><button type="button" onClick={advanceChord} disabled={!footswitchMode || status !== "running"}><LocalizedCopy id="next" /></button><button type="button" onClick={recoverCurrent} disabled={!footswitchMode || status !== "running"}>{t("repeat")}</button><button type="button" onClick={() => rateAndAdvance("clean")} disabled={!footswitchMode || status !== "running" || Boolean(feedback[currentIndex])}>{t("markClean")}</button></div>
            <small>N = Next · R = Repeat · C = Mark clean. Buttons remain available for a keyboard or MIDI foot-switch mapping.</small>
          </article>
        </div>
        <article className="trainer-reflection-card">
          <span className="label">Post-performance reflection</span>
          <div className="trainer-reflection-grid"><label>What went well?<textarea maxLength={300} value={performanceWentWell} onChange={(event) => setPerformanceWentWell(event.target.value)} placeholder="The chorus stayed in time…" /></label><label>Where did you lose time?<textarea maxLength={300} value={performanceLostTime} onChange={(event) => setPerformanceLostTime(event.target.value)} placeholder="The F change in the bridge…" /></label><label>Transition to revisit<input maxLength={80} value={performanceRevisit} onChange={(event) => setPerformanceRevisit(event.target.value)} placeholder="G → C" /></label></div>
          <button className="btn" type="button" onClick={savePerformanceReflection} disabled={!performanceWentWell.trim() && !performanceLostTime.trim() && !performanceRevisit.trim()}>Save reflection locally</button>
        </article>
      </section>

      <section className="trainer-insights panel" aria-label="Practice insights and data">
        <LazyPracticeEvidenceStrip today={todayPractice} goal={dailyGoalMinutes} chord={{ name: currentChord?.name ?? "Select a chord", attempts: chordAttempts, clean: chordRecord?.clean ?? 0, needsWork: chordRecord?.needsWork ?? 0, missed: chordRecord?.missed ?? 0 }} mastery={masteryEvidence} sessions={sessionRounds.map((round) => ({ accuracy: Math.round((round.ratings.clean / Math.max(1, round.ratings.clean + round.ratings.missed + round.ratings.needsWork)) * 100), pace: round.pace, detail: roundComparisonDetail(round) }))} days={Array.from({ length: 7 }, (_, offset) => { const date = new Date(); date.setDate(date.getDate() - (6 - offset)); const key = localDateKey(date); return { key, label: formatDate(date, { weekday: "narrow" }), rounds: persistence.history.find((item) => item.date === key)?.rounds ?? 0 }; })} formatPercent={formatPercent} />
        <div className="trainer-data-actions"><button className="btn" type="button" onClick={exportTrainerData}>Export Trainer data</button><button className="btn ghost" type="button" onClick={resetTrainerData}>Reset Trainer data</button><small>Backups include capped local ratings, history, records, and notes.</small></div>
        <div className="trainer-session-timeline"><span className="label">Current-session timeline</span>{persistence.timeline.filter((event) => event.sessionId === sessionIdRef.current || (!event.sessionId && sessionStartedAtRef.current && event.at >= sessionStartedAtRef.current)).slice(0, 12).map((event) => <span key={event.id}><strong>{event.kind}</strong> · {new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{event.durationSeconds ? ` · ${event.durationSeconds}s` : ""}</span>)}</div>
        <div className="trainer-storage-manager"><span className="label">Storage manager</span><p>Trainer progress is local browser storage. Recordings are in-memory only; offline packs are downloads and cannot be listed or deleted here.</p><button className="btn" type="button" onClick={() => void reviewTrainerStorage()}>Review Trainer storage</button>{storageReview !== "closed" && <div className="trainer-storage-review" role="dialog" aria-label="Review Trainer storage"><p>Trainer data: {(storageEstimate.localBytes / 1024).toFixed(1)} KB{storageEstimate.quota ? ` of ${(storageEstimate.quota / 1024 / 1024).toFixed(0)} MB browser quota` : ""}. In-memory recordings: {takes.length} ({(takes.reduce((sum, take) => sum + take.bytes, 0) / 1024).toFixed(1)} KB).</p><small>Only the Trainer key and this tab&apos;s takes are in scope. Host files and Song Library keys are untouched.</small>{(recording || captureStarting) && <small role="status">Storage deletion is disabled while a recording or browser permission request is active.</small>}<div className="trainer-inline-actions"><button className="btn ghost" type="button" onClick={() => setStorageReview("closed")}>Cancel</button><button className="btn" type="button" onClick={deleteTrainerProgress} disabled={(status !== "idle" && status !== "complete") || recording || captureStarting || Boolean(mediaRecorderRef.current)}>{storageReview === "armed" ? "Click again to delete Trainer progress" : "Review, then delete Trainer progress"}</button></div></div>}</div>
      </section>

      <section className="panel trainer-exploration" aria-label="Untimed chord exploration">
        <div className="panel-header"><div><p className="eyebrow">Exploration · untimed</p><h2>Compare physical voicings</h2><p>Choose a harmony and voicing without entering a timed round. Variants are distinguished by catalog ID.</p></div></div>
        <div className="trainer-explorer-controls"><label>Harmony<select value={exploreChordName} onChange={(event) => { setExploreChordName(event.target.value); setExploreVoicingId(""); }}><option value="">Choose a catalog harmony</option>{Array.from(new Map(CHORD_LIBRARY.map((item) => [`${item.root} ${item.quality}`, item])).values()).slice(0, 80).map((item) => <option key={`${item.root}-${item.quality}`} value={item.chord.name}>{item.root} {item.qualityLabel}</option>)}</select></label><label>Voicing<select value={exploreVoicingId} onChange={(event) => setExploreVoicingId(event.target.value)} disabled={!explorationVariants.length}><option value="">Choose a voicing</option>{explorationVariants.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.position}</option>)}</select></label>{explorationTarget && <button className="btn" type="button" onClick={() => excludeShape(explorationTarget.chord)}>Exclude this physical shape</button>}</div>
        {explorationTarget ? <div className="trainer-explorer-result"><article><span className="label">{explorationTarget.id}</span><h3>{explorationTarget.chord.name} · {explorationTarget.position}</h3><ChordDiagram chord={explorationTarget.chord} orientation={displayHandedness} /><p>{explorationTarget.summary}</p></article><article><span className="label">Compare variants</span><div className="trainer-explorer-variants">{explorationVariants.map((item) => <button type="button" key={item.id} onClick={() => setExploreVoicingId(item.id)}><strong>{item.id}</strong><small>{item.position}</small></button>)}</div><p>{explorationTarget.recommendedVariant}</p><div className="trainer-inline-actions"><button className="btn" type="button" onClick={() => preferShape(explorationTarget)}>Use this physical shape in future rounds</button><button className="btn" type="button" onClick={() => { setThreeDPreviewChordName(explorationTarget.chord.name); setThreeDHandVisible(true); }}>Open optional 3D view</button></div></article></div> : <p>Pick a harmony to see static diagrams.</p>}
        {persistence.shapeExclusions.length > 0 && <details><summary>Excluded physical shapes ({persistence.shapeExclusions.length})</summary>{persistence.shapeExclusions.map((item) => <div className="trainer-exclusion-row" key={item.key}><span>{item.label} · {item.harmony}</span><button className="btn ghost" type="button" onClick={() => restoreShape(item.key)}>Restore</button></div>)}</details>}
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
{benchmarkResult !== null && <LazyBenchmarkResult latest={benchmarkResult} previous={previousComparableBenchmark(persistence.completedRounds, persistence.benchmarkRoute, { tuning: tuningId === "custom" ? customTuningLabel : tuningId, capo: capoFret, challenge: challengeMode, rhythm: rhythmAware, bpm: rhythmAware ? rhythmBpm : null, instrumentProfile: persistence.instrumentProfile, position: neckLock })?.ratings.clean} />}
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

      </details>
      <details className="trainer-advanced-tools">
        <summary>Songs <span>Transitions, progression transfer, and rehearsal lab</span></summary>
      <section className="panel trainer-practice-lab" aria-label="Practice lab">
        <div className="panel-header"><div><p className="eyebrow">Practice lab</p><h2>See the pattern, then solve the movement.</h2></div></div>
        <div className="trainer-transfer-card"><strong>Transfer a mastered pair</strong><p>Keep the strongest available adjacent pair together while adding up to two existing chords from this level.</p><button className="btn" type="button" onClick={transferMasteredPair} disabled={settingsLocked}>Load pair inside progression</button></div>
        <div className="trainer-transition-map">
          {(Object.keys(transitionMap) as TransitionBand[]).map((band) => <div key={band} className={`band-${band}`}><h3>{band}</h3>{transitionMap[band].length ? transitionMap[band].map(([key, record]) => <button type="button" key={key} onClick={() => { setReplayKey(key); setReplayStep(0); }}>{key}<small>{Math.round(record.score * 100)}%</small></button>) : <p>No tracked transitions yet.</p>}</div>)}
        </div>
        <LazyTrainerEvidence rounds={persistence.completedRounds} transitions={persistence.transitions} />
        <LazyTransitionProbe pairs={Object.keys(persistence.transitions).filter((key) => !key.startsWith("Start "))} resolve={(name) => CHORD_LOOKUP.get(name)} onStart={(route) => { const [from, to] = route; void startRound({ ...currentSetup, drill: "pair", pairFrom: from.name, pairTo: to.name, length: route.length }, false, undefined, route); }} />
        <div className="trainer-lab-grid">
          <article>
            <span className="label">Slow-motion replay</span>
            <label>Transition<select value={replayKey} onChange={(event) => { setReplayKey(event.target.value); setReplayStep(0); }}><option value="">Choose a weak transition</option>{replayKeys.map((key) => <option key={key}>{key}</option>)}</select></label>
            {replayTransition ? <><div className="trainer-replay-diagrams"><ChordDiagram chord={replayStep === 0 ? replayTransition.from : replayTransition.to} orientation={displayHandedness} /></div><p>{replayStep === 0 ? `Set ${replayTransition.from.name} and release excess pressure.` : replayStep === 1 ? `${replayTransition.shared.length ? `Keep ${replayTransition.shared.length} shared fretted position(s) down.` : "Lift only as far as needed and keep fingertips over their destination."}` : `Land ${replayTransition.to.name} close behind each fret, then test every string.`}</p><div><button className="btn" type="button" onClick={() => setReplayStep((step) => Math.max(0, step - 1))} disabled={replayStep === 0}>Previous step</button><button className="btn" type="button" onClick={() => setReplayStep((step) => Math.min(2, step + 1))} disabled={replayStep === 2}>Next step</button></div></> : <p>Rate a few transitions to unlock a replay.</p>}
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

      </details>
      <DeferredDetails className="trainer-advanced-tools" summary={<>Rhythm <span>Captures, cues, and practice companion</span></>}><LazyTrainerCompanionPanel state={{ captureKind, recording, takes, captureMessage, mistakeReport, mistakeLabels: MISTAKE_LABELS, mistakeRanking, readiness: persistence.readiness, readinessDone, discomfort, discomfortGuidance, settingsLocked, coachNotes, shareCode, shareBits, tuningLabel, shareMessage, skillTree, weakTransitionCount, comparison: comparableSessionPair, sessionTension, status, sessionSaved, songId: selectedSongSet?.id ?? "", songTitle: selectedSongSet?.title ?? "", setup: currentSetup, catalogRoute: sequence, adaptivePreference }} actions={{ setCaptureKind, startCapture: () => { void startCapture(); }, stopCapture, clearTakes, setMistakeReport: (value) => setMistakeReport(value), saveMistakeReport, updateReadinessLabel, updateReadiness, setDiscomfort, setRestPrompt, pauseRound, setPace: (value) => setPace(value), setRoundLength, setSilentPractice, setShareMessage, setCoachNotes, exportTeacherChallenge, prepareShareCode, downloadOfflinePack, importOfflinePack: (file) => { void importOfflinePack(file); }, saveSessionComparison, setSessionTension, setAdaptivePreference, applySetup: (value) => { if (settingsLocked) return false; restoreSetup({ ...currentSetup, ...value } as TrainerSetup); return true; }, offlinePackFileRef }} /></DeferredDetails>
      <details className="trainer-advanced-tools trainer-reports"><summary>Reports <span>Completed rounds and honest local evidence</span></summary><LazyHistoryPanel rounds={completedHistory} search={historySearch} drill={historyDrillFilter} result={historyResultFilter} drills={historyDrillOptions} locked={settingsLocked} canReplay={status === "idle" || status === "complete"} onSearch={setHistorySearch} onDrill={setHistoryDrillFilter} onResult={setHistoryResultFilter} onReplay={(round) => { const full = persistence.completedRounds.find((item) => item.id === round.id); if (full) loadCompletedRoundReplay(full); }} onStarter={() => { setRoundLength(5); setPace(6); setDrillMode("pair"); setShareMessage("A five-change starter is loaded. Review the setup, then press Start."); }} /></details>

      <section className="trainer-print-sheet" aria-label="Printable practice sheet">
        <header><p>Chord Hero · Practice sheet</p><h1>{roundConfig.drillLabel}</h1><span>{roundConfig.length} changes · {roundConfig.pace === "manual" ? "manual pace" : `${roundConfig.pace}s pace`} · {STRUMMING_PROMPTS[strummingPrompt]} · {tuningLabel}{capoFret ? ` · capo ${capoFret}` : " · no capo"}</span></header>
        <div className="trainer-print-chords">{practiceSheetChords.map((chord) => <article key={chord.name}><h2>{chord.name}</h2><ChordDiagram chord={chord} orientation={displayHandedness} /></article>)}</div>
        <div className="trainer-print-goals"><h2>Goals</h2><p>☐ Clear shapes &nbsp; ☐ Clean transitions &nbsp; ☐ Steady rhythm &nbsp; ☐ Full run-through</p><h2>Coach notes</h2><p>{coachNotes || "________________________________________________________________________________"}</p><h2>Practice notes</h2><p>________________________________________________________________________________</p><p>________________________________________________________________________________</p><h2>Rehearsal handoff</h2><p><strong>Song order:</strong> {selectedSongSet?.title ?? roundConfig.drillLabel}</p><p><strong>Setup:</strong> {tuningLabel} · {capoFret ? `capo ${capoFret}` : "no capo"} · {roundConfig.pace === "manual" ? "manual pace" : `${roundConfig.pace}s change pace`}</p><p><strong>Difficult transitions:</strong> {replayKeys.slice(0, 5).join(", ") || "None flagged yet"}</p><p><strong>Emergency restart points:</strong> {rebuildPrompt.index >= 0 ? `Item ${rebuildPrompt.index + 1}, beat ${rebuildPrompt.beat}` : "Find the current beat, rejoin the current chord, then continue."}</p></div>
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
          <div className="selected-card"><div className="selected-info"><span className="label">Selected</span><h3>{selectedChord?.name ?? "None yet"}</h3></div><div className="diagram-wrap">{selectedChord ? <ChordDiagram chord={selectedChord} largeChart={largeDiagrams} orientation={displayHandedness} /> : <div className="diagram-empty" />}</div></div>
        </div>
      </section>

      {status === "complete" && (
        <div className="modal trainer-recap-modal" role="dialog" aria-modal="true" aria-labelledby="trainer-recap-title">
          <div className="modal-card">
            <span className="modal-badge">Round recap</span><h2 id="trainer-recap-title">Practice complete</h2>
            <div className="trainer-recap-counts"><span><strong>{feedbackSummary.clean}</strong> <LocalizedCopy id="clean" /></span><span><strong>{feedbackSummary.needsWork}</strong> {t("needsWork")}</span><span><strong>{feedbackSummary.missed}</strong> {t("missed")}</span></div>
            <p><strong>{roundConfig.drillLabel}</strong> · {roundConfig.pace === "manual" ? "Manual pace" : `${roundConfig.pace}s base pace`} · {roundConfig.length} chords</p>
            <LazyRetentionResult value={retentionResult} />
            <div className="trainer-effort-rating"><span className="label">Optional effort self-report</span><div role="group" aria-label="Effort rating"><button className={`btn ${effortRating === "comfortable" ? "selected" : ""}`} type="button" onClick={() => saveRoundEffort("comfortable")}>Comfortable</button><button className={`btn ${effortRating === "working" ? "selected" : ""}`} type="button" onClick={() => saveRoundEffort("working")}>Working</button><button className={`btn ${effortRating === "exhausting" ? "selected" : ""}`} type="button" onClick={() => saveRoundEffort("exhausting")}>Exhausting</button></div><small>This is separate from accuracy; leaving it blank is valid.</small></div>
            <div className="trainer-exposure-summary"><span>Fresh transitions: <strong>{freshCount}</strong></span><span>Repeated / recovery exposures: <strong>{repeatCount}</strong></span></div>
            {sectionDrillOn && selectedSongSet && <LazySectionCheckpoint section={rehearsalSection} length={sequence.length} pace={sectionPaces[rehearsalSection]} marked={Boolean(sectionNeedsPractice[rehearsalSection])} onMark={markSectionNeedsPractice} />}
            <LazyTensionSummary checks={tensionChecks} />
            <p className="trainer-evidence-note">{evidenceLabel(Object.keys(feedback).length, roundConfig.length, feedbackSummary.clean, roundConfig.pace)}</p>
            <div className="trainer-confidence-recap"><span>Before: <strong>{preConfidence}/5</strong></span><label>After<select value={postConfidence} onChange={(event) => setPostConfidence(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label><span>Change: <strong>{postConfidence - preConfidence > 0 ? "+" : ""}{postConfidence - preConfidence}</strong></span></div>
            {status === "complete" && <LazyRoundGrowthRecap criteria={cleanCriteria} checks={criteriaChecks} length={sequence.length} comparison={sameDrillComparison ? { currentRate: sameDrillComparison.currentRate, previousRate: sameDrillComparison.previousRate, previousPace: sameDrillComparison.previous?.pace, pace: roundConfig.pace, transition: sameDrillComparison.transition } : null} />}
            {flaggedTransitions.length > 0 && <div className="trainer-flagged"><span className="label">Flagged transitions</span><ul>{flaggedTransitions.map((item, index) => <li key={`${item.key}-${index}`}>{item.key} — {RATING_LABEL[item.rating]}</li>)}</ul></div>}
            <p className="trainer-recommendation"><strong>Recommended next:</strong> {recommendedAction}</p>
            <button className="btn primary" type="button" onClick={startTakeaway}>Start this takeaway</button>
            <p><strong>Recoveries:</strong> {roundRecoveries}{transitionGoalOn ? ` · ${effectiveGoalFrom} → ${effectiveGoalTo}: ${transitionGoalProgress}/${transitionGoalTarget} clean reps` : ""}</p>
            <label className="trainer-round-note">Post-round note<textarea value={roundNote} maxLength={500} onChange={(event) => { setRoundNote(event.target.value); setNoteSaved(false); }} placeholder="What felt tense? What changed cleanly?" /></label>
            <button className="btn" type="button" onClick={saveRoundNote} disabled={!roundNote.trim() || noteSaved}>{noteSaved ? "Note saved" : "Save note locally"}</button>
            <div className="modal-actions"><button className="btn" type="button" onClick={undoLatestRating}>Undo latest rating</button><button className="btn" type="button" onClick={queueForTomorrow}>{nextPracticeSaved ? "Next practice saved" : "Save next practice"}</button><button className="btn" type="button" onClick={scheduleRetentionChecks}>Schedule exact-route checks · 1/7 days</button><button className="btn primary" onClick={resetRound}>Adjust and practice again</button><button className="btn ghost" onClick={resetRound}>Close recap</button></div>
            {nextPracticeSaved && <small className="trainer-save-confirmation" role="status">Saved locally: {roundConfig.drillLabel} · {roundConfig.pace === "manual" ? "manual pace" : `${roundConfig.pace}s pace`} · available on your next Trainer visit.</small>}
          </div>
        </div>
      )}
    </main>
  );
}
