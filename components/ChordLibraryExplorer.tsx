"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ChordDiagram, { Chord } from "./ChordDiagram";
import {
  CHORD_DIFFICULTY_TAGS,
  CHORD_FUNCTION_KEYS,
  CHORD_ITEM_LOOKUP,
  CHORD_LIBRARY,
  CHORD_LIBRARY_ROOTS,
  CHORD_QUALITY_OPTIONS,
  HARMONIC_FUNCTION_OPTIONS,
  PROGRESSION_PACKS,
  type ChordLibraryItem,
  type DifficultyTag,
  type HarmonicRole,
  type ProgressionPack
} from "../lib/chords";
import {
  analyzeChordFunction,
  analyzeProgression,
  getCircleOfFifths,
  getConfusableRoles,
  getFunctionOptions,
  getNextRoles,
  scoreTransition,
  type HarmonicEvent,
  type HarmonicFunction,
  type HarmonyMode
} from "../lib/harmony";
import { loadRecordedAudio } from "../lib/recordedAudio";
import { loadGuitarSampleManifest, selectGuitarSamplePaths, type GuitarSampleManifest, type GuitarSampleVoice } from "../lib/guitarSampleManifest";
import { matchesLibrarySearch, resolveSelectedLibraryEntry, searchLibraryEntries } from "../lib/librarySearchSafety";
import { DEFAULT_LEARNING_STATE, normalizeLearningState, type HandPreference, type LearningState, type PracticeGoal } from "../lib/chordLearning";
import { createStudentProfileSyncClient } from "../lib/profileSyncClient";
import {
  DEFAULT_INSTRUMENT_PROFILE,
  DEFAULT_LEARNING_PREFERENCES,
  mergeStudentCloudStates,
  normalizeStudentCloudState,
  normalizeStudentProfile,
  normalizeTeacherAssignment,
  type InstrumentProfile,
  type PracticeStats,
  type StudentCloudState,
  type StudentProfile,
  type TeacherAssignment
} from "../lib/studentProfile";
import sharedSettings from "../shared/content/v1/settings.json";

const ChordPracticePlanner = dynamic(() => import("./ChordPracticePlanner"), {
  ssr: false,
  loading: () => <section className="chord-practice-planner planner-loading" aria-label="Loading practice planner"><span className="label">Practice planner</span><strong>Loading local planning tools...</strong></section>
});
const ChordLearningStudio = dynamic(() => import("./ChordLearningStudio"), {
  ssr: false,
  loading: () => <section className="learning-studio learning-studio-loading" aria-label="Loading learning studio"><span className="label">Optional learning studio</span><strong>Loading guided practice tools...</strong></section>
});
const GuitarTechnique3D = dynamic(() => import("./GuitarTechnique3D"), {
  ssr: false,
  loading: () => <div className="guitar-technique-3d-loading" role="status">Loading 3D fretboard…</div>
});

const RECENTS_STORAGE_KEY = "chord-hero-library-recents";
const FAVORITES_STORAGE_KEY = "chord-hero-library-favorites";
const CUSTOM_PACKS_STORAGE_KEY = "chord-hero-library-custom-packs";
const PRACTICE_STATS_STORAGE_KEY = "chord-hero-library-practice-stats";
const USER_NOTES_STORAGE_KEY = "chord-hero-library-user-notes";
const STRING_MISTAKES_STORAGE_KEY = "chord-hero-library-string-mistakes";
const EAR_MISSES_STORAGE_KEY = "chord-hero-library-ear-misses";
const STUDENT_PROFILES_STORAGE_KEY = "chord-hero-library-student-profiles";
const TEACHER_ASSIGNMENTS_STORAGE_KEY = "chord-hero-library-teacher-assignments";
const DISPLAY_SETTINGS_STORAGE_KEY = "chord-hero-library-display-settings";
const LEARNING_PREFERENCES_STORAGE_KEY = "chord-hero-library-learning-preferences";
const LEARNING_GOALS_STORAGE_KEY = "chord-hero-library-learning-goals";
const LEARNING_COMPOSER_STORAGE_KEY = "chord-hero-library-learning-composer";
const LEARNING_STATE_STORAGE_KEY = "chord-hero-library-learning-state";
const SAMPLE_BASE_PATH = "/samples/guitar";
const RECORDED_GUITAR_ROOTS = [37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 86];
const OPEN_STRING_FREQUENCIES = [82.41, 110, 146.83, 196, 246.94, 329.63];
const STANDARD_STRING_NOTES = ["E", "A", "D", "G", "B", "E"];
const DEFAULT_LIBRARY_ITEM = CHORD_LIBRARY[0] ?? null;
const MAX_VISIBLE_VOICINGS = 80;
const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = new Map(NOTES.map((note, index) => [note, index]));
const LEGACY_RIGHT_HAND_PATTERNS = [
  "Down, down-up, up-down-up",
  "Thumb bass, down-up brush",
  "Bass note, light strum, bass note, strum",
  "Short downstrokes with muted releases",
  "Arpeggio 6-4-3-2-1",
  "Alternating bass with pinch"
];
const LEGACY_SAMPLE_VOICES = ["clean", "warm", "muted", "picked"] as const;
const LEGACY_TUNINGS = [
  {
    id: "standard",
    label: "Standard",
    strings: ["E", "A", "D", "G", "B", "E"],
    semitoneOffsets: [0, 0, 0, 0, 0, 0]
  },
  {
    id: "drop-d",
    label: "Drop D",
    strings: ["D", "A", "D", "G", "B", "E"],
    semitoneOffsets: [-2, 0, 0, 0, 0, 0]
  },
  {
    id: "dadgad",
    label: "DADGAD",
    strings: ["D", "A", "D", "G", "A", "D"],
    semitoneOffsets: [-2, 0, 0, 0, -2, -2]
  },
  {
    id: "half-step-down",
    label: "Half-step down",
    strings: ["Eb", "Ab", "Db", "Gb", "Bb", "Eb"],
    semitoneOffsets: [-1, -1, -1, -1, -1, -1]
  }
] as const;

const RIGHT_HAND_PATTERNS = sharedSettings.rightHandPatterns;
const SAMPLE_VOICES = sharedSettings.sampleVoices as readonly GuitarSampleVoice[];
const TUNINGS = sharedSettings.tunings;
void LEGACY_RIGHT_HAND_PATTERNS;
void LEGACY_SAMPLE_VOICES;
void LEGACY_TUNINGS;
const SONG_EXAMPLES = [
  {
    family: "open-position",
    match: (entry: ChordLibraryItem) => entry.position.toLowerCase().includes("open"),
    title: "Amazing Grace",
    context: "Slow I-IV-V movement for hearing open chord resolution."
  },
  {
    family: "slash chords",
    match: (entry: ChordLibraryItem) => entry.inversion === "inverted",
    title: "Walking bass hymn progression",
    context: "Use slash chords to make the bass line step instead of jump."
  },
  {
    family: "barre family",
    match: (entry: ChordLibraryItem) => entry.difficultyTags.includes("barre"),
    title: "12-bar blues transposition drill",
    context: "Move the same grip through I, IV, and V in a new key."
  },
  {
    family: "color voicings",
    match: (entry: ChordLibraryItem) => entry.difficultyTags.includes("color tone"),
    title: "Scarborough Fair-style folk color",
    context: "Let sevenths, sus notes, and add9 notes ring against open strings."
  }
];

type SampleVoice = (typeof SAMPLE_VOICES)[number];
type TuningId = (typeof TUNINGS)[number]["id"];
type InversionSelection = "all" | string;
type CustomPack = ProgressionPack & { custom: true };
type EarTarget = {
  entry: ChordLibraryItem;
  prompt: "chord" | "function";
  options: string[];
  function: HarmonicFunction | null;
  referenceRoles: string[];
};
type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";
type DisplaySettings = { handedness: "right" | "left"; highContrast: boolean; largeCharts: boolean; simplifiedCharts: boolean };
type HeatmapNote = {
  key: string;
  stringIndex: number;
  fret: number;
  note: string;
  state: "primary" | "comparison" | "shared" | "idle";
};
type LibraryWorkspace = "browse" | "practice" | "compare" | "tools";

const noteAt = (index: number) => NOTES[((index % 12) + 12) % 12];

const transposeChordName = (name: string, semitones: number) =>
  name.replace(/^([A-G](?:#|b)?)/, (match) => {
    const index = NOTE_INDEX.get(match);
    return typeof index === "number" ? noteAt(index + semitones) : match;
  });

const getVoicingFrequencies = (chord: Chord, capoFret: number, tuningOffsets: readonly number[]) =>
  chord.frets.flatMap((fret, index) => {
    if (fret < 0) return [];
    return OPEN_STRING_FREQUENCIES[index] * Math.pow(2, (fret + capoFret + tuningOffsets[index]) / 12);
  });

const getChordNoteNames = (chord: Chord, tuning: (typeof TUNINGS)[number]) =>
  chord.frets.flatMap((fret, index) => {
    if (fret < 0) return [];
    const standardIndex = NOTE_INDEX.get(STANDARD_STRING_NOTES[index]) ?? 0;
    return noteAt(standardIndex + tuning.semitoneOffsets[index] + fret);
  });

const makeHeatmap = (
  primary: ChordLibraryItem,
  comparison: ChordLibraryItem | null,
  tuning: (typeof TUNINGS)[number]
): HeatmapNote[] => {
  const primaryNotes = new Set(getChordNoteNames(primary.chord, tuning));
  const comparisonNotes = new Set(comparison ? getChordNoteNames(comparison.chord, tuning) : []);
  return tuning.strings.flatMap((stringNote, stringIndex) => {
    const openIndex = NOTE_INDEX.get(stringNote) ?? 0;
    return Array.from({ length: 13 }, (_, fret) => {
      const note = noteAt(openIndex + fret);
      const inPrimary = primaryNotes.has(note);
      const inComparison = comparisonNotes.has(note);
      return {
        key: `${stringIndex}-${fret}`,
        stringIndex,
        fret,
        note,
        state: inPrimary && inComparison ? "shared" : inPrimary ? "primary" : inComparison ? "comparison" : "idle"
      };
    });
  });
};

const getDifficultyScore = (entry: ChordLibraryItem) => {
  let score = 1;
  if (entry.difficultyTags.includes("barre")) score += 3;
  if (entry.difficultyTags.includes("stretch")) score += 2;
  if (entry.difficultyTags.includes("partial")) score += 1;
  if (entry.difficultyTags.includes("color tone")) score += 1;
  if (entry.difficultyTags.includes("fast-change friendly")) score -= 1;
  if (entry.difficultyTags.includes("beginner")) score -= 1;
  return Math.max(1, Math.min(8, score));
};

const getTheoryNotes = (entry: ChordLibraryItem) => {
  const degreesByQuality: Record<string, string> = {
    major: "1, 3, 5",
    minor: "1, b3, 5",
    dominant7: "1, 3, 5, b7",
    minor7: "1, b3, 5, b7",
    major7: "1, 3, 5, 7",
    sus2: "1, 2, 5",
    sus4: "1, 4, 5",
    add9: "1, 3, 5, 9"
  };
  const bass = entry.chord.name.includes("/") ? entry.chord.name.split("/")[1] : entry.root;
  const openStrings = entry.chord.frets
    .map((fret, index) => (fret === 0 ? ["E", "A", "D", "G", "B", "E"][index] : null))
    .filter(Boolean)
    .join(", ");

  return {
    degrees: degreesByQuality[entry.quality] ?? "Chord tones from the selected quality",
    bass,
    voiceLeading:
      entry.inversion === "inverted"
        ? `The ${bass} bass note changes the line underneath while the upper chord stays familiar.`
        : "Root-position bass gives the chord a settled center before moving to nearby functions.",
    openStrings: openStrings || "No open strings in this voicing."
  };
};

const getCommonMistakes = (entry: ChordLibraryItem) => {
  const mistakes: string[] = [];
  entry.chord.frets.forEach((fret, index) => {
    if (fret < 0) mistakes.push(`String ${index + 1}: mute it cleanly; accidental contact can add a muddy bass note.`);
  });
  if (entry.difficultyTags.includes("barre")) {
    mistakes.push("Barre: check each string one at a time and relax pressure between checks.");
  }
  if (entry.difficultyTags.includes("stretch")) {
    mistakes.push("Stretch: move the wrist forward instead of squeezing harder with the thumb.");
  }
  if (!mistakes.length) mistakes.push("Buzzing: lift and re-place each finger close behind its fret wire.");
  return mistakes.slice(0, 3);
};

const getVoiceLeadingNotes = (from: ChordLibraryItem, to: ChordLibraryItem) => {
  const changes = from.chord.frets
    .map((fret, index) => {
      const nextFret = to.chord.frets[index];
      if (fret === nextFret) return null;
      if (fret < 0 || nextFret < 0) return `String ${index + 1}: mute/open change`;
      return `String ${index + 1}: ${fret === 0 ? "open" : fret} to ${nextFret === 0 ? "open" : nextFret}`;
    })
    .filter((note): note is string => Boolean(note));
  return changes.length ? changes.slice(0, 4) : ["Keep the same shape and focus on a clean transition."];
};

const snapshotProfile = (
  id: string,
  name: string,
  values: Pick<StudentProfile, "favorites" | "recents" | "practiceStats" | "userNotes" | "stringMistakes" | "instrumentProfile"> & { learningState: LearningState }
): StudentProfile => ({
  ...values,
  id,
  name,
  learningState: values.learningState,
  learningPreferences: values.learningState.handPreference,
  learningGoals: values.learningState.goals,
  learningComposerRoles: values.learningState.composerRoles,
  updatedAt: new Date().toISOString()
});

const getPitchClasses = (chord: Chord, tuning: (typeof TUNINGS)[number]) =>
  new Set(getChordNoteNames(chord, tuning).map((note) => NOTE_INDEX.get(note)).filter((note): note is number => typeof note === "number"));

const loadFirstRecordedSample = async (context: AudioContext, paths: string[]) => {
  for (const path of paths) {
    const buffer = await loadRecordedAudio(context, path);
    if (buffer) return { buffer, path };
  }
  return null;
};

export default function ChordLibraryExplorer() {
  const [workspace, setWorkspace] = useState<LibraryWorkspace>("browse");
  const [libraryRoot, setLibraryRoot] = useState("any");
  const [libraryQuality, setLibraryQuality] = useState("any");
  const [libraryInversion, setLibraryInversion] = useState<InversionSelection>("all");
  const [libraryTag, setLibraryTag] = useState<"all" | DifficultyTag>("all");
  const [libraryFunctionKey, setLibraryFunctionKey] = useState<"any" | string>("G");
  const [libraryMode, setLibraryMode] = useState<HarmonyMode>("major");
  const [libraryHarmonicEvent, setLibraryHarmonicEvent] = useState<HarmonicEvent | "all">("all");
  const [libraryFunctionRole, setLibraryFunctionRole] = useState<"any" | HarmonicRole>("any");
  const [librarySearch, setLibrarySearch] = useState("");
  const [progressionInput, setProgressionInput] = useState("");
  const [progressionAnalysis, setProgressionAnalysis] = useState<ReturnType<typeof analyzeProgression> | null>(null);
  const [earMisses, setEarMisses] = useState<Record<string, number>>({});
  const [activePackId, setActivePackId] = useState<"all" | string>("all");
  const [activeCollection, setActiveCollection] = useState<"all" | "favorites" | "recent">("all");
  const [selectedLibraryId, setSelectedLibraryId] = useState(DEFAULT_LIBRARY_ITEM?.id ?? "");
  const [compareChordId, setCompareChordId] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [customPacks, setCustomPacks] = useState<CustomPack[]>([]);
  const [customPackName, setCustomPackName] = useState("My practice pack");
  const [customPackPattern, setCustomPackPattern] = useState(RIGHT_HAND_PATTERNS[0]);
  const [practiceStats, setPracticeStats] = useState<PracticeStats>({});
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [capoFret, setCapoFret] = useState(0);
  const [sampleVoice, setSampleVoice] = useState<SampleVoice>("steel");
  const [sampleVelocity, setSampleVelocity] = useState(0.72);
  const [tuningId, setTuningId] = useState<TuningId>("standard");
  const [teacherKey, setTeacherKey] = useState("G");
  const [teacherSkill, setTeacherSkill] = useState<"all" | DifficultyTag>("beginner");
  const [teacherPackId, setTeacherPackId] = useState<"all" | string>("all");
  const [sampleStatus, setSampleStatus] = useState("Recorded guitar ready");
  const [earTarget, setEarTarget] = useState<EarTarget | null>(null);
  const [earAnswer, setEarAnswer] = useState("");
  const [earResult, setEarResult] = useState("");
  const [thirdCompareChordId, setThirdCompareChordId] = useState("");
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [activeStudentId, setActiveStudentId] = useState("default-student");
  const [newStudentName, setNewStudentName] = useState("");
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [newAssignmentDueAt, setNewAssignmentDueAt] = useState("");
  const [newAssignmentComment, setNewAssignmentComment] = useState("");
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [instrumentProfile, setInstrumentProfile] = useState<InstrumentProfile>({ ...DEFAULT_INSTRUMENT_PROFILE });
  const [learningState, setLearningState] = useState<LearningState>({ ...DEFAULT_LEARNING_STATE, handPreference: { ...DEFAULT_LEARNING_STATE.handPreference } });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncMessage, setSyncMessage] = useState("Local-only profile storage");
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({ handedness: "right", highContrast: false, largeCharts: false, simplifiedCharts: false });
  const [sightReadingMode, setSightReadingMode] = useState(false);
  const [midiStatus, setMidiStatus] = useState("MIDI not connected");
  const [midiHeldNotes, setMidiHeldNotes] = useState<number[]>([]);
  const [fretFilter, setFretFilter] = useState<"all" | "4" | "8" | "12">("all");
  const [stringFilter, setStringFilter] = useState<"all" | "open" | "partial" | "full">("all");
  const [voicingLimit, setVoicingLimit] = useState(MAX_VISIBLE_VOICINGS);
  const [customFrets, setCustomFrets] = useState<number[]>([-1, -1, -1, -1, -1, -1]);
  const [stringMistakes, setStringMistakes] = useState<Record<string, number[]>>({});

  const deferredLibrarySearch = useDeferredValue(librarySearch.trim().toLowerCase());
  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleManifestRef = useRef<GuitarSampleManifest | null>(null);
  const profileSyncClientRef = useRef<ReturnType<typeof createStudentProfileSyncClient> | null>(null);
  const profileSyncRevisionRef = useRef(0);
  const profileSyncLastSignatureRef = useRef("");
  const profileSyncTimerRef = useRef<number | null>(null);
  const profileSyncReadyRef = useRef(false);
  const syncCloudStateRef = useRef<StudentCloudState | null>(null);
  const syncCloudSignatureRef = useRef("");
  const applyCloudStateRef = useRef<(state: StudentCloudState) => void>(() => undefined);
  const earTargetRef = useRef<EarTarget | null>(null);
  const midiHeldNotesRef = useRef<Set<number>>(new Set());
  const midiCleanupRef = useRef<(() => void) | null>(null);
  const allProgressionPacks = useMemo(
    () => [...PROGRESSION_PACKS, ...customPacks],
    [customPacks]
  );
  const selectedPack = allProgressionPacks.find((pack) => pack.id === activePackId) ?? null;
  const selectedTuning = TUNINGS.find((tuning) => tuning.id === tuningId) ?? TUNINGS[0];
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const profileSyncConfig = useMemo(() => ({
    baseURL: process.env.NEXT_PUBLIC_CHORD_HERO_SYNC_URL ?? "",
    libraryID: process.env.NEXT_PUBLIC_CHORD_HERO_SYNC_LIBRARY_ID ?? "",
    accountID: process.env.NEXT_PUBLIC_CHORD_HERO_SYNC_ACCOUNT_ID ?? ""
  }), []);
  const syncCloudState = useMemo<StudentCloudState>(() => {
    const activeName = studentProfiles.find((profile) => profile.id === activeStudentId)?.name ?? "Current device profile";
    const activeProfile = snapshotProfile(activeStudentId, activeName, { favorites: favoriteIds, recents: recentIds, practiceStats, userNotes, stringMistakes, instrumentProfile, learningState });
    return { profiles: [...studentProfiles.filter((profile) => profile.id !== activeStudentId), activeProfile], assignments: teacherAssignments };
  }, [activeStudentId, favoriteIds, instrumentProfile, learningState, practiceStats, recentIds, stringMistakes, studentProfiles, teacherAssignments, userNotes]);
  const syncCloudSignature = useMemo(() => JSON.stringify(syncCloudState), [syncCloudState]);
  syncCloudStateRef.current = syncCloudState;
  syncCloudSignatureRef.current = syncCloudSignature;

  const collectionEntries = useMemo(() => {
    if (activeCollection === "favorites") {
      return favoriteIds
        .map((id) => CHORD_ITEM_LOOKUP.get(id))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    }
    if (activeCollection === "recent") {
      return recentIds
        .map((id) => CHORD_ITEM_LOOKUP.get(id))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    }
    return CHORD_LIBRARY;
  }, [activeCollection, favoriteIds, recentIds]);

  const libraryPool = useMemo(() => {
    if (!selectedPack) return collectionEntries;
    const packIds = new Set(selectedPack.chordIds);
    return collectionEntries.filter((entry) => packIds.has(entry.id));
  }, [collectionEntries, selectedPack]);

  const availableRoots = useMemo(
    () =>
      ["any", ...Array.from(new Set(libraryPool.map((entry) => entry.root))).sort((left, right) =>
        left.localeCompare(right)
      )],
    [libraryPool]
  );
  const rootPool = useMemo(
    () => libraryRoot === "any" ? libraryPool : libraryPool.filter((entry) => entry.root === libraryRoot),
    [libraryPool, libraryRoot]
  );
  const availableLibraryQualities = useMemo(
    () =>
      [{ value: "any", label: "Any chord identity" }, ...CHORD_QUALITY_OPTIONS.filter((option) => rootPool.some((entry) => entry.quality === option.value))],
    [rootPool]
  );
  const availableInversionOptions = useMemo(() => {
    const entries = rootPool
      .filter((entry) => libraryQuality === "any" || entry.quality === libraryQuality)
      .sort((left, right) => left.id.localeCompare(right.id));
    return [
      { value: "all", label: "All positions" },
      ...entries.map((entry) => ({
        value: entry.id,
        label:
          entry.inversion === "standard"
            ? `Standard • ${entry.position}`
            : `${entry.chord.name} • ${entry.position}`
      }))
    ];
  }, [libraryQuality, rootPool]);

  const filteredLibraryEntries = useMemo(
    () =>
      libraryPool.filter((entry) => {
        if (libraryRoot !== "any" && entry.root !== libraryRoot) return false;
        if (libraryQuality !== "any" && entry.quality !== libraryQuality) return false;
        if (libraryInversion !== "all" && entry.id !== libraryInversion) return false;
        if (libraryTag !== "all" && !entry.difficultyTags.includes(libraryTag)) return false;
        if (fretFilter !== "all" && entry.chord.frets.some((fret) => fret > Number(fretFilter))) return false;
        if (stringFilter === "open" && !entry.chord.frets.some((fret) => fret === 0)) return false;
        if (stringFilter === "partial" && !entry.difficultyTags.includes("partial")) return false;
        if (stringFilter === "full" && entry.chord.frets.filter((fret) => fret >= 0).length < 5) return false;

        if (libraryFunctionRole !== "any" || libraryFunctionKey !== "any" || libraryHarmonicEvent !== "all") {
          const computedFunctions = (libraryFunctionKey === "any" ? CHORD_FUNCTION_KEYS : [libraryFunctionKey]).flatMap((key) => analyzeChordFunction({
              key,
              mode: libraryMode,
              root: entry.root,
              quality: entry.quality,
              requestedRole: libraryFunctionRole,
              event: libraryHarmonicEvent
            }));
          if (libraryFunctionKey !== "any" && !computedFunctions.length) return false;
          if (libraryFunctionRole !== "any" && !computedFunctions.some((fn) => fn.available)) return false;
        }

        if (deferredLibrarySearch.length > 0) {
          if (!matchesLibrarySearch(entry, deferredLibrarySearch)) return false;
        }

        return true;
      }),
    [
      deferredLibrarySearch,
      fretFilter,
      libraryHarmonicEvent,
      libraryFunctionKey,
      libraryFunctionRole,
      libraryInversion,
      libraryPool,
      libraryQuality,
      libraryRoot,
      libraryMode,
      libraryTag,
      stringFilter
    ]
  );

  const searchMatches = useMemo(() => {
    if (!deferredLibrarySearch) return [];
    return searchLibraryEntries(CHORD_LIBRARY, deferredLibrarySearch).slice(0, 8);
  }, [deferredLibrarySearch]);

  const selectedLibraryEntry = resolveSelectedLibraryEntry(filteredLibraryEntries, selectedLibraryId);
  const compareEntry =
    (compareChordId ? CHORD_ITEM_LOOKUP.get(compareChordId) : null) ?? null;
  const thirdCompareEntry =
    (thirdCompareChordId ? CHORD_ITEM_LOOKUP.get(thirdCompareChordId) : null) ?? null;
  const selectedTheory = selectedLibraryEntry ? getTheoryNotes(selectedLibraryEntry) : null;
  const activeHarmonyKey = libraryFunctionKey === "any" ? "G" : libraryFunctionKey;
  const selectedFunctions = useMemo(
    () => selectedLibraryEntry ? analyzeChordFunction({
      key: activeHarmonyKey,
      mode: libraryMode,
      root: selectedLibraryEntry.root,
      quality: selectedLibraryEntry.quality,
      requestedRole: libraryFunctionRole,
      event: libraryHarmonicEvent
    }) : [],
    [activeHarmonyKey, libraryFunctionRole, libraryHarmonicEvent, libraryMode, selectedLibraryEntry]
  );
  const selectedFunction = selectedFunctions.find((fn) => fn.available) ?? selectedFunctions[0] ?? null;
  const availableFunctionOptions = useMemo(
    () => getFunctionOptions(libraryMode, libraryHarmonicEvent),
    [libraryHarmonicEvent, libraryMode]
  );
  const circlePoints = useMemo(
    () => getCircleOfFifths(activeHarmonyKey, libraryMode),
    [activeHarmonyKey, libraryMode]
  );
  const functionalGroups = useMemo(() => {
    const groups = new Map<string, { identity: string; function: HarmonicFunction | null; entries: ChordLibraryItem[] }>();
    filteredLibraryEntries.forEach((entry) => {
      const fn = analyzeChordFunction({ key: activeHarmonyKey, mode: libraryMode, root: entry.root, quality: entry.quality, requestedRole: libraryFunctionRole, event: libraryHarmonicEvent }).find((candidate) => candidate.available) ?? null;
      const identity = `${entry.root}:${entry.quality}`;
      const group = groups.get(identity) ?? { identity, function: fn, entries: [] };
      group.entries.push(entry);
      if (!group.function && fn) group.function = fn;
      groups.set(identity, group);
    });
    return Array.from(groups.values()).map((group) => ({
      ...group,
      entries: group.entries.sort((left, right) => getDifficultyScore(left) - getDifficultyScore(right) || left.id.localeCompare(right.id))
    }));
  }, [activeHarmonyKey, filteredLibraryEntries, libraryFunctionRole, libraryHarmonicEvent, libraryMode]);
  const transitionRecommendations = useMemo(() => {
    if (!selectedLibraryEntry) return [];
    return filteredLibraryEntries
      .filter((entry) => entry.id !== selectedLibraryEntry.id)
      .slice(0, 48)
      .map((entry) => ({ entry, cost: scoreTransition(selectedLibraryEntry.chord, entry.chord) }))
      .sort((left, right) => left.cost.score - right.cost.score)
      .slice(0, 4);
  }, [filteredLibraryEntries, selectedLibraryEntry]);
  const visibleVoicingEntries = useMemo(
    () => filteredLibraryEntries.slice(0, voicingLimit),
    [filteredLibraryEntries, voicingLimit]
  );
  const visibleFunctionalGroups = useMemo(() => {
    let remaining = voicingLimit;
    return functionalGroups.flatMap((group) => {
      if (remaining <= 0) return [];
      const entries = group.entries.slice(0, remaining);
      remaining -= entries.length;
      return entries.length ? [{ ...group, entries }] : [];
    });
  }, [functionalGroups, voicingLimit]);
  const customChord: Chord = {
    name: "Custom voicing",
    frets: customFrets,
    fingers: customFrets.map((fret) => (fret > 0 ? 1 : null)) as Array<1 | 2 | 3 | 4 | null>
  };
  const selectedPracticeStats = selectedLibraryEntry
    ? practiceStats[selectedLibraryEntry.id] ?? { seconds: 0, reps: 0 }
    : { seconds: 0, reps: 0 };
  const selectedUserNote = selectedLibraryEntry ? userNotes[selectedLibraryEntry.id] ?? "" : "";
  const selectedCapoName = selectedLibraryEntry
    ? transposeChordName(selectedLibraryEntry.chord.name, capoFret)
    : "";
  const selectedDifficultyScore = selectedLibraryEntry ? getDifficultyScore(selectedLibraryEntry) : 1;
  const selectedSongExamples = useMemo(
    () => (selectedLibraryEntry ? SONG_EXAMPLES.filter((example) => example.match(selectedLibraryEntry)) : []),
    [selectedLibraryEntry]
  );

  const comparisonCandidates = useMemo(
    () => filteredLibraryEntries.filter((entry) => entry.id !== selectedLibraryEntry?.id),
    [filteredLibraryEntries, selectedLibraryEntry?.id]
  );
  const heatmapNotes = useMemo(
    () => (selectedLibraryEntry ? makeHeatmap(selectedLibraryEntry, compareEntry, selectedTuning) : []),
    [compareEntry, selectedLibraryEntry, selectedTuning]
  );
  const dueReviewEntries = useMemo(() => {
    const now = Date.now();
    return Object.entries(practiceStats)
      .filter(([, stats]) => stats.nextReviewAt && Date.parse(stats.nextReviewAt) <= now)
      .map(([id]) => CHORD_ITEM_LOOKUP.get(id))
      .filter((entry): entry is ChordLibraryItem => Boolean(entry))
      .slice(0, 6);
  }, [practiceStats]);
  const teacherSheetEntries = useMemo(() => {
    const pack = allProgressionPacks.find((item) => item.id === teacherPackId);
    const source = pack
      ? pack.chordIds
          .map((id) => CHORD_ITEM_LOOKUP.get(id))
          .filter((entry): entry is ChordLibraryItem => Boolean(entry))
      : CHORD_LIBRARY.filter((entry) =>
          entry.functionContexts.some((context) => context.key === teacherKey)
        );
    return source
      .filter((entry) => teacherSkill === "all" || entry.difficultyTags.includes(teacherSkill))
      .slice(0, 9);
  }, [allProgressionPacks, teacherKey, teacherPackId, teacherSkill]);

  const recommendation = useMemo(() => {
    const practicedIds = new Set(
      Object.entries(practiceStats)
        .filter(([, stats]) => stats.seconds >= 120 || stats.reps >= 8)
        .map(([id]) => id)
    );
    const currentScore = selectedLibraryEntry ? getDifficultyScore(selectedLibraryEntry) : 1;
    return (
      dueReviewEntries[0] ??
      CHORD_LIBRARY.find(
        (entry) =>
          entry.id !== selectedLibraryEntry?.id &&
          !practicedIds.has(entry.id) &&
          getDifficultyScore(entry) <= currentScore + 1
      ) ??
      CHORD_LIBRARY.find(
        (entry) => entry.id !== selectedLibraryEntry?.id && !practicedIds.has(entry.id)
      ) ??
      null
    );
  }, [dueReviewEntries, practiceStats, selectedLibraryEntry]);

  const recentEntries = useMemo(
    () =>
      recentIds
        .map((id) => CHORD_ITEM_LOOKUP.get(id))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [recentIds]
  );
  const favoriteEntries = useMemo(
    () =>
      favoriteIds
        .map((id) => CHORD_ITEM_LOOKUP.get(id))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [favoriteIds]
  );

  const ensureAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playChordPreview = async (chord: Chord, mode: "strum" | "arpeggio", voicingId = selectedLibraryId) => {
    const ctx = await ensureAudioContext();
    const frequencies = getVoicingFrequencies(chord, capoFret, selectedTuning.semitoneOffsets);
    if (!frequencies.length) return;

    if (!sampleManifestRef.current) sampleManifestRef.current = await loadGuitarSampleManifest();

    const midiNotes = frequencies.map((frequency) => Math.round(69 + 12 * Math.log2(frequency / 440)));
    const recordedRoots = midiNotes.map((midiNote) =>
      RECORDED_GUITAR_ROOTS.reduce((closest, candidate) =>
        Math.abs(candidate - midiNote) < Math.abs(closest - midiNote) ? candidate : closest
      )
    );
    const sampleResults = await Promise.all(midiNotes.map((midiNote, index) => {
      const paths = sampleManifestRef.current
        ? selectGuitarSamplePaths(sampleManifestRef.current, {
            voicingId,
            voice: sampleVoice,
            articulation: mode,
            velocity: Math.min(1, sampleVelocity + index * 0.02),
            midi: recordedRoots[index]
          })
        : [sampleVoice === "muted" ? `${SAMPLE_BASE_PATH}/muted.mp3` : `${SAMPLE_BASE_PATH}/clean/${recordedRoots[index]}.mp3`];
      return loadFirstRecordedSample(ctx, paths);
    }));
    const sampleBuffers = sampleResults.map((result) => result?.buffer ?? null);

    if (sampleBuffers.every((buffer): buffer is AudioBuffer => Boolean(buffer))) {
      const output = ctx.createBiquadFilter();
      output.type = "lowpass";
      output.frequency.value = sampleVoice === "nylon" ? 1900 : sampleVoice === "muted" ? 2600 : 5200;
      output.Q.value = sampleVoice === "nylon" ? 0.65 : 0.35;
      output.connect(ctx.destination);

      const now = ctx.currentTime;
      const step = mode === "strum" ? 0.034 : sampleVoice === "picked" ? 0.19 : 0.145;
      const sustain = sampleVoice === "muted" ? 0.28 : mode === "strum" ? 1.35 : 1.8;

      sampleBuffers.forEach((buffer, index) => {
        const source = ctx.createBufferSource();
        const noteGain = ctx.createGain();
        const startAt = now + index * step;
        source.buffer = buffer;
        source.playbackRate.value = sampleVoice === "muted"
          ? 0.9 + index * 0.025
          : Math.pow(2, (midiNotes[index] - recordedRoots[index]) / 12);
        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(sampleVoice === "muted" ? 0.2 : 0.17, startAt + 0.008);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + sustain);
        source.connect(noteGain);
        noteGain.connect(output);
        source.start(startAt);
        source.stop(startAt + sustain + 0.05);
      });
      const usedFallback = sampleResults.some((result) => result?.path.includes("/clean/") || result?.path.endsWith("/muted.mp3"));
      setSampleStatus(`Recorded ${sampleVoice} ${mode} loaded${usedFallback ? " with bundled fallback" : " from mapped layer"}`);
      return;
    }

    setSampleStatus("Recorded guitar unavailable; using generated fallback");

    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = sampleVoice === "nylon" ? 1250 : sampleVoice === "muted" ? 900 : 2600;
    filter.Q.value = sampleVoice === "nylon" ? 0.7 : 1.15;
    filter.connect(ctx.destination);
    masterGain.connect(filter);
    masterGain.gain.value = 0.0001;

    const now = ctx.currentTime;
    const step = mode === "strum" ? 0.035 : sampleVoice === "picked" ? 0.18 : 0.14;
    const sustain = sampleVoice === "muted" ? 0.38 : mode === "strum" ? 1.15 : 1.75;

    masterGain.gain.exponentialRampToValueAtTime(sampleVoice === "muted" ? 0.18 : 0.25, now + 0.04);
    masterGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + sustain + step * frequencies.length
    );

    frequencies.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const startAt = now + index * step;
      osc.type = sampleVoice === "nylon" ? "sine" : mode === "strum" ? "triangle" : "sawtooth";
      osc.frequency.value = frequency;
      noteGain.gain.value = 0.0001;
      osc.connect(noteGain);
      noteGain.connect(masterGain);
      noteGain.gain.exponentialRampToValueAtTime(0.9, startAt + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + sustain);
      osc.start(startAt);
      osc.stop(startAt + sustain + 0.05);
    });
  };

  const jumpToChord = (id: string) => {
    const nextEntry = CHORD_ITEM_LOOKUP.get(id);
    if (!nextEntry) return;
    setActiveCollection("all");
    setActivePackId("all");
    setLibraryRoot(nextEntry.root);
    setLibraryQuality(nextEntry.quality);
    setLibraryInversion(nextEntry.id);
    setSelectedLibraryId(nextEntry.id);
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((previous) =>
      previous.includes(id) ? previous.filter((currentId) => currentId !== id) : [id, ...previous]
    );
  };

  const saveCurrentCustomPack = () => {
    if (!selectedLibraryEntry) return;
    const sourceIds = selectedPack?.chordIds ?? filteredLibraryEntries.map((entry) => entry.id);
    const chordIds = Array.from(new Set([selectedLibraryEntry.id, ...sourceIds])).slice(0, 10);
    const packName = customPackName.trim() || "Custom practice pack";
    const id = `custom-${Date.now()}`;
    setCustomPacks((previous) => [
      {
        id,
        title: packName,
        description: "A saved practice set made from the current Chord Library view.",
        keyCenter: libraryRoot,
        focus: `Custom work on ${libraryRoot} ${libraryQuality} voicings.`,
        chordIds,
        progression: chordIds
          .map((chordId) => CHORD_ITEM_LOOKUP.get(chordId)?.chord.name)
          .filter((name): name is string => Boolean(name)),
        rightHandPattern: customPackPattern,
        custom: true
      },
      ...previous
    ]);
  };

  const snapshotStudent = (id: string, name: string): StudentProfile => snapshotProfile(id, name, {
    favorites: favoriteIds,
    recents: recentIds,
    practiceStats,
    userNotes,
    stringMistakes,
    instrumentProfile,
    learningState
  });

  const saveStudentProfile = () => {
    const name = newStudentName.trim() || `Student ${studentProfiles.length + 1}`;
    const id = `student-${Date.now()}`;
    const profile = snapshotStudent(id, name);
    setStudentProfiles((previous) => [profile, ...previous]);
    setActiveStudentId(id);
    setNewStudentName("");
  };

  const loadStudentProfile = (id: string) => {
    const current = studentProfiles.find((profile) => profile.id === activeStudentId);
    if (current) {
      setStudentProfiles((previous) => previous.map((profile) => profile.id === activeStudentId ? snapshotStudent(activeStudentId, profile.name) : profile));
    }
    const next = studentProfiles.find((profile) => profile.id === id);
    if (!next) return;
    setActiveStudentId(id);
    setFavoriteIds(next.favorites);
    setRecentIds(next.recents);
    setPracticeStats(next.practiceStats);
    setUserNotes(next.userNotes);
    setStringMistakes(next.stringMistakes ?? {});
    setInstrumentProfile({ ...DEFAULT_INSTRUMENT_PROFILE, ...next.instrumentProfile });
    setTuningId((next.instrumentProfile?.tuningId ?? "standard") as TuningId);
    setLearningState(normalizeLearningState(next.learningState ?? {
      handPreference: next.learningPreferences,
      goals: next.learningGoals,
      composerRoles: next.learningComposerRoles
    }));
  };

  const updateInstrumentProfile = (patch: Partial<InstrumentProfile>) => {
    setInstrumentProfile((previous) => ({ ...previous, ...patch, updatedAt: new Date().toISOString() }));
    if (patch.tuningId) setTuningId(patch.tuningId as TuningId);
  };

  const createAssignment = () => {
    const title = newAssignmentTitle.trim();
    if (!title) return;
    const chordIds = selectedPack?.chordIds ?? teacherSheetEntries.map((entry) => entry.id);
    const now = new Date().toISOString();
    setTeacherAssignments((previous) => [{ id: `assignment-${Date.now()}`, studentId: activeStudentId, title, description: `${chordIds.length} chord voicings from the current library filter.`, chordIds, dueAt: newAssignmentDueAt ? new Date(`${newAssignmentDueAt}T23:59:59`).toISOString() : undefined, teacherComments: newAssignmentComment.trim() || undefined, feedbackHistory: [], updatedAt: now }, ...previous]);
    setNewAssignmentTitle("");
    setNewAssignmentDueAt("");
    setNewAssignmentComment("");
  };

  const toggleAssignment = (assignment: TeacherAssignment) => {
    const now = new Date().toISOString();
    setTeacherAssignments((previous) => previous.map((item) => item.id === assignment.id ? { ...item, completedAt: item.completedAt ? undefined : now, updatedAt: now } : item));
  };

  const deleteAssignment = (id: string) => {
    setTeacherAssignments((previous) => previous.filter((assignment) => assignment.id !== id));
  };

  const updateAssignmentComment = (assignment: TeacherAssignment, teacherComments: string) => {
    const now = new Date().toISOString();
    setTeacherAssignments((previous) => previous.map((item) => item.id === assignment.id ? { ...item, teacherComments: teacherComments.slice(0, 1000), updatedAt: now } : item));
  };

  const addAssignmentFeedback = (assignment: TeacherAssignment) => {
    const body = feedbackDrafts[assignment.id]?.trim();
    if (!body) return;
    const now = new Date().toISOString();
    setTeacherAssignments((previous) => previous.map((item) => item.id === assignment.id ? { ...item, feedbackHistory: [...(item.feedbackHistory ?? []), { id: `feedback-${Date.now()}`, body: body.slice(0, 500), author: "Current teacher", createdAt: now }].slice(-20), updatedAt: now } : item));
    setFeedbackDrafts((previous) => ({ ...previous, [assignment.id]: "" }));
  };

  const exportTeacherPacks = () => {
    const blob = new Blob([JSON.stringify(customPacks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "chord-hero-teacher-packs.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importTeacherPacks = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as CustomPack[];
        if (!Array.isArray(imported)) throw new Error("Invalid pack file");
        const valid = imported.filter((pack) => pack && typeof pack.title === "string" && Array.isArray(pack.chordIds));
        setCustomPacks((previous) => [...valid.map((pack) => ({ ...pack, id: `imported-${Date.now()}-${pack.id}`, custom: true as const })), ...previous]);
      } catch {
        setSampleStatus("Teacher pack import failed: choose a Chord Hero JSON export");
      }
    };
    reader.readAsText(file);
  };

  const evaluateMidiNotes = (notes: Set<number>) => {
    const target = earTargetRef.current;
    if (!target) return;
    const correctFunction = target.function?.role ?? "I";
    if (notes.size === 1) {
      const note = noteAt([...notes][0]);
      const correctRoot = note === target.entry.root;
      setEarAnswer(correctRoot ? (target.prompt === "chord" ? target.entry.chord.name : correctFunction) : note);
      setEarResult(correctRoot ? "Correct root-note fallback" : `Root-note fallback: try ${target.entry.root}`);
      return;
    }
    const expected = getPitchClasses(target.entry.chord, selectedTuning);
    const matches = expected.size === notes.size && [...expected].every((note) => notes.has(note));
    if (matches) {
      setEarAnswer(target.prompt === "chord" ? target.entry.chord.name : correctFunction);
      setEarResult("Correct polyphonic chord");
    } else {
      setEarResult(`MIDI heard ${notes.size} pitch classes; add or release notes to match the voicing.`);
    }
  };

  const connectMidi = async () => {
    const midiNavigator = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!midiNavigator.requestMIDIAccess) {
      setMidiStatus("Web MIDI is not supported in this browser");
      return;
    }
    try {
      midiCleanupRef.current?.();
      const access = await midiNavigator.requestMIDIAccess();
      const handleMessage = (event: MIDIMessageEvent) => {
        if (!event.data) return;
        const [status, note, velocity] = event.data;
        const pitch = note % 12;
        const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;
        const isNoteOff = (status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0);
        if (!Number.isFinite(note) || (!isNoteOn && !isNoteOff)) return;
        if (isNoteOn) midiHeldNotesRef.current.add(pitch);
        if (isNoteOff) midiHeldNotesRef.current.delete(pitch);
        const held = [...midiHeldNotesRef.current].sort((left, right) => left - right);
        setMidiHeldNotes(held);
        setMidiStatus(`Held MIDI notes: ${held.length ? held.map((item) => noteAt(item)).join(", ") : "none"}`);
        if (isNoteOn) evaluateMidiNotes(midiHeldNotesRef.current);
      };
      access.inputs.forEach((input) => { input.onmidimessage = handleMessage; });
      midiCleanupRef.current = () => access.inputs.forEach((input) => { input.onmidimessage = null; });
      setMidiStatus(`${access.inputs.size} MIDI input${access.inputs.size === 1 ? "" : "s"} connected`);
    } catch {
      setMidiStatus("MIDI permission was not granted");
    }
  };

  const clearMidiNotes = () => {
    midiHeldNotesRef.current.clear();
    setMidiHeldNotes([]);
    setMidiStatus("MIDI notes cleared");
  };

  const playEarContext = async (entry: ChordLibraryItem, fn: HarmonicFunction | null) => {
    const tonicEntry = CHORD_LIBRARY.find((candidate) => analyzeChordFunction({ key: activeHarmonyKey, mode: libraryMode, root: candidate.root, quality: candidate.quality, requestedRole: libraryMode === "major" ? "I" : "i" }).some((candidateFunction) => candidateFunction.available));
    if (tonicEntry) await playChordPreview(tonicEntry.chord, "strum", tonicEntry.id);
    window.setTimeout(() => { void playChordPreview(entry.chord, "arpeggio", entry.id); }, fn ? 520 : 180);
  };

  const addPracticeRep = (id: string) => {
    setPracticeStats((previous) => ({
      ...previous,
      [id]: {
        seconds: previous[id]?.seconds ?? 0,
        reps: (previous[id]?.reps ?? 0) + 1,
        misses: previous[id]?.misses ?? 0,
        nextReviewAt: previous[id]?.nextReviewAt,
        strength: previous[id]?.strength ?? 1
      }
    }));
  };

  const scheduleReview = (id: string, rating: "again" | "good" | "easy") => {
    const hours = rating === "again" ? 4 : rating === "good" ? 24 : 72;
    setPracticeStats((previous) => {
      const current = previous[id] ?? { seconds: 0, reps: 0, misses: 0, strength: 1 };
      return {
        ...previous,
        [id]: {
          seconds: current.seconds,
          reps: current.reps + 1,
          misses: (current.misses ?? 0) + (rating === "again" ? 1 : 0),
          strength: Math.max(1, (current.strength ?? 1) + (rating === "easy" ? 2 : rating === "good" ? 1 : -1)),
          nextReviewAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
        }
      };
    });
  };

  const updateUserNote = (id: string, note: string) => {
    setUserNotes((previous) => ({ ...previous, [id]: note }));
  };

  const logStringMistake = (id: string, stringIndex: number) => {
    setStringMistakes((previous) => ({
      ...previous,
      [id]: [...(previous[id] ?? []), stringIndex]
    }));
  };

  const startEarTraining = (prompt: "chord" | "function") => {
    const pool = filteredLibraryEntries.length ? filteredLibraryEntries : CHORD_LIBRARY;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const fn = analyzeChordFunction({ key: activeHarmonyKey, mode: libraryMode, root: entry.root, quality: entry.quality }).find((candidate) => candidate.available) ?? null;
    const correct = prompt === "chord" ? entry.chord.name : fn?.role ?? entry.functionContexts[0]?.roles[0] ?? "I";
    const distractors =
      prompt === "chord"
        ? CHORD_LIBRARY.map((candidate) => candidate.chord.name)
        : getConfusableRoles(fn?.role ?? "I", libraryMode, earMisses);
    const options = Array.from(new Set(distractors))
      .filter((option) => option !== correct)
      .slice(0, 3);
    const shuffled = [correct, ...options].sort(() => Math.random() - 0.5);
    const nextTarget = { entry, prompt, options: shuffled, function: fn, referenceRoles: fn ? [libraryMode === "major" ? "I" : "i", fn.role] : [] };
    earTargetRef.current = nextTarget;
    setEarTarget(nextTarget);
    setEarAnswer("");
    setEarResult("");
    void playEarContext(entry, fn);
  };

  const answerEarTraining = (answer: string) => {
    if (!earTarget) return;
    const correct = earTarget.prompt === "chord" ? earTarget.entry.chord.name : earTarget.function?.role ?? "I";
    setEarAnswer(answer);
    if (answer === correct) setEarResult("Correct");
    else {
      setEarMisses((previous) => ({ ...previous, [correct]: (previous[correct] ?? 0) + 1 }));
      setEarResult(`Listen again: ${correct}`);
    }
  };

  const runProgressionAnalysis = () => {
    setProgressionAnalysis(analyzeProgression(progressionInput, activeHarmonyKey, libraryMode));
  };

  useEffect(() => {
    try {
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const storedRecents = window.localStorage.getItem(RECENTS_STORAGE_KEY);
      const storedCustomPacks = window.localStorage.getItem(CUSTOM_PACKS_STORAGE_KEY);
      const storedPracticeStats = window.localStorage.getItem(PRACTICE_STATS_STORAGE_KEY);
      const storedUserNotes = window.localStorage.getItem(USER_NOTES_STORAGE_KEY);
      const storedStringMistakes = window.localStorage.getItem(STRING_MISTAKES_STORAGE_KEY);
      const storedEarMisses = window.localStorage.getItem(EAR_MISSES_STORAGE_KEY);
      const storedProfiles = window.localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
      const storedAssignments = window.localStorage.getItem(TEACHER_ASSIGNMENTS_STORAGE_KEY);
      const storedDisplaySettings = window.localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
      const storedLearningState = window.localStorage.getItem(LEARNING_STATE_STORAGE_KEY);
      if (storedFavorites) {
        setFavoriteIds(JSON.parse(storedFavorites));
      }
      if (storedRecents) {
        setRecentIds(JSON.parse(storedRecents));
      }
      if (storedCustomPacks) {
        setCustomPacks(JSON.parse(storedCustomPacks));
      }
      if (storedPracticeStats) {
        setPracticeStats(JSON.parse(storedPracticeStats));
      }
      if (storedUserNotes) {
        setUserNotes(JSON.parse(storedUserNotes));
      }
      if (storedStringMistakes) {
        setStringMistakes(JSON.parse(storedStringMistakes));
      }
      if (storedEarMisses) setEarMisses(JSON.parse(storedEarMisses));
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles) as Partial<StudentProfile>[];
        setStudentProfiles(parsed.filter((profile): profile is Partial<StudentProfile> & Pick<StudentProfile, "id"> => Boolean(profile?.id)).map((profile) => normalizeStudentProfile(profile)));
      }
      if (storedAssignments) {
        const parsed = JSON.parse(storedAssignments) as unknown;
        setTeacherAssignments(Array.isArray(parsed) ? parsed.map(normalizeTeacherAssignment).filter((assignment): assignment is TeacherAssignment => Boolean(assignment)) : []);
      }
      if (storedDisplaySettings) {
        setDisplaySettings({ handedness: "right", highContrast: false, largeCharts: false, ...JSON.parse(storedDisplaySettings) });
      }
      if (storedLearningState) setLearningState(normalizeLearningState(JSON.parse(storedLearningState)));
    } catch {
      // Ignore storage failures and keep the UI usable.
    } finally {
      setStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [favoriteIds, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(recentIds));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [recentIds, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(CUSTOM_PACKS_STORAGE_KEY, JSON.stringify(customPacks));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [customPacks, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify(practiceStats));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [practiceStats, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(USER_NOTES_STORAGE_KEY, JSON.stringify(userNotes));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [storageHydrated, userNotes]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(STUDENT_PROFILES_STORAGE_KEY, JSON.stringify(studentProfiles));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [storageHydrated, studentProfiles]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(STRING_MISTAKES_STORAGE_KEY, JSON.stringify(stringMistakes));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [storageHydrated, stringMistakes]);

  useEffect(() => {
    if (!storageHydrated) return;
    try { window.localStorage.setItem(LEARNING_STATE_STORAGE_KEY, JSON.stringify(learningState)); } catch { /* Keep guided practice usable when storage is unavailable. */ }
  }, [learningState, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    try { window.localStorage.setItem(EAR_MISSES_STORAGE_KEY, JSON.stringify(earMisses)); } catch { /* Keep ear training usable when storage is unavailable. */ }
  }, [earMisses, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem(TEACHER_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(teacherAssignments));
      window.localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(displaySettings));
    } catch {
      // Keep the library usable when storage is unavailable.
    }
  }, [displaySettings, storageHydrated, teacherAssignments]);

  useEffect(() => {
    earTargetRef.current = earTarget;
  }, [earTarget]);

  useEffect(() => () => midiCleanupRef.current?.(), []);

  const applyCloudState = (state: StudentCloudState) => {
    const profiles = state.profiles.map((profile) => normalizeStudentProfile(profile));
    setStudentProfiles(profiles);
    setTeacherAssignments(state.assignments);
    const active = profiles.find((profile) => profile.id === activeStudentId);
    if (!active) return;
    setFavoriteIds(active.favorites);
    setRecentIds(active.recents);
    setPracticeStats(active.practiceStats);
    setUserNotes(active.userNotes);
    setStringMistakes(active.stringMistakes);
    setInstrumentProfile(active.instrumentProfile);
    setTuningId(active.instrumentProfile.tuningId as TuningId);
    setLearningState(normalizeLearningState(active.learningState ?? {
      handPreference: active.learningPreferences,
      goals: active.learningGoals,
      composerRoles: active.learningComposerRoles
    }));
  };
  applyCloudStateRef.current = applyCloudState;

  useEffect(() => {
    if (!storageHydrated) return;
    const { baseURL, libraryID, accountID } = profileSyncConfig;
    if (!baseURL || !libraryID || !accountID) {
      setSyncStatus("local");
      setSyncMessage("Local-only profile storage; add sync environment variables to enable cloud sync.");
      profileSyncReadyRef.current = true;
      return;
    }
    const client = createStudentProfileSyncClient(baseURL, libraryID, accountID);
    profileSyncClientRef.current = client;
    setSyncStatus("syncing");
    setSyncMessage("Pulling the latest student profile and assignments...");
    void client.pull().then((envelope) => {
      const merged = mergeStudentCloudStates(syncCloudStateRef.current ?? normalizeStudentCloudState(envelope.state), normalizeStudentCloudState(envelope.state));
      profileSyncRevisionRef.current = envelope.revision;
      profileSyncLastSignatureRef.current = JSON.stringify(merged);
      applyCloudStateRef.current(merged);
      setSyncStatus("synced");
      setSyncMessage(`Synced ${new Date(envelope.updatedAt).toLocaleTimeString()}`);
    }).catch(() => {
      profileSyncLastSignatureRef.current = syncCloudSignatureRef.current;
      setSyncStatus(navigator.onLine ? "error" : "offline");
      setSyncMessage("Cloud sync unavailable; changes remain safely local.");
    }).finally(() => {
      profileSyncReadyRef.current = true;
    });
  }, [profileSyncConfig, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || !profileSyncReadyRef.current || !profileSyncClientRef.current) return;
    if (!navigator.onLine) {
      setSyncStatus("offline");
      setSyncMessage("Offline; changes will sync when the connection returns.");
      return;
    }
    if (profileSyncLastSignatureRef.current === syncCloudSignature) return;
    if (profileSyncTimerRef.current) window.clearTimeout(profileSyncTimerRef.current);
    profileSyncTimerRef.current = window.setTimeout(() => {
      const client = profileSyncClientRef.current;
      if (!client) return;
      setSyncStatus("syncing");
      setSyncMessage("Saving profile changes...");
      const state = syncCloudStateRef.current;
      if (!state) return;
      void client.push(state, profileSyncRevisionRef.current).then((envelope) => {
        profileSyncRevisionRef.current = envelope.revision;
        profileSyncLastSignatureRef.current = syncCloudSignatureRef.current;
        setSyncStatus("synced");
        setSyncMessage(`Synced ${new Date(envelope.updatedAt).toLocaleTimeString()}`);
      }).catch((error: Error & { conflict?: { revision: number; state: StudentCloudState } }) => {
        if (error.conflict) {
          const merged = mergeStudentCloudStates(syncCloudStateRef.current ?? normalizeStudentCloudState(error.conflict.state), normalizeStudentCloudState(error.conflict.state));
          profileSyncRevisionRef.current = error.conflict.revision;
          profileSyncLastSignatureRef.current = JSON.stringify(merged);
          applyCloudStateRef.current(merged);
        }
        setSyncStatus("error");
        setSyncMessage("Sync conflict or network error; local changes were retained.");
      });
    }, 900);
    return () => {
      if (profileSyncTimerRef.current) window.clearTimeout(profileSyncTimerRef.current);
    };
  }, [storageHydrated, syncCloudSignature, syncCloudState]);

  useEffect(() => {
    const handleOnline = () => {
      profileSyncLastSignatureRef.current = "";
      setSyncStatus(profileSyncClientRef.current ? "syncing" : "local");
      setSyncMessage("Connection restored; preparing profile sync...");
    };
    const handleOffline = () => {
      setSyncStatus("offline");
      setSyncMessage("Offline; changes will remain local.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!selectedLibraryEntry) return;
    setRecentIds((previous) => [
      selectedLibraryEntry.id,
      ...previous.filter((id) => id !== selectedLibraryEntry.id)
    ].slice(0, 8));
  }, [selectedLibraryEntry]);

  useEffect(() => {
    if (!availableRoots.length) return;
    if (!availableRoots.includes(libraryRoot)) {
      setLibraryRoot("any");
    }
  }, [availableRoots, libraryRoot]);

  useEffect(() => {
    if (!availableLibraryQualities.length) return;
    if (!availableLibraryQualities.some((option) => option.value === libraryQuality)) {
      setLibraryQuality(availableLibraryQualities[0]?.value ?? "");
    }
  }, [availableLibraryQualities, libraryQuality]);

  useEffect(() => {
    if (!availableInversionOptions.some((option) => option.value === libraryInversion)) {
      setLibraryInversion("all");
    }
  }, [availableInversionOptions, libraryInversion]);

  useEffect(() => {
    if (!filteredLibraryEntries.length) {
      if (selectedLibraryId) setSelectedLibraryId("");
      return;
    }
    if (!filteredLibraryEntries.some((entry) => entry.id === selectedLibraryId)) {
      setSelectedLibraryId(filteredLibraryEntries[0]?.id ?? "");
    }
  }, [filteredLibraryEntries, selectedLibraryId]);

  useEffect(() => {
    setVoicingLimit(MAX_VISIBLE_VOICINGS);
  }, [deferredLibrarySearch, fretFilter, libraryFunctionKey, libraryFunctionRole, libraryInversion, libraryQuality, libraryRoot, libraryTag, stringFilter]);

  useEffect(() => {
    if (!comparisonCandidates.some((entry) => entry.id === compareChordId)) {
      setCompareChordId(comparisonCandidates[0]?.id ?? "");
    }
  }, [compareChordId, comparisonCandidates]);

  useEffect(() => {
    if (!comparisonCandidates.some((entry) => entry.id === thirdCompareChordId)) {
      setThirdCompareChordId(comparisonCandidates[1]?.id ?? comparisonCandidates[0]?.id ?? "");
    }
  }, [comparisonCandidates, thirdCompareChordId]);

  useEffect(() => {
    if (!activeTimerId) return;
    const interval = window.setInterval(() => {
      setPracticeStats((previous) => ({
        ...previous,
        [activeTimerId]: {
          seconds: (previous[activeTimerId]?.seconds ?? 0) + 1,
          reps: previous[activeTimerId]?.reps ?? 0
        }
      }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimerId]);

  useEffect(() => {
    setActiveTimerId(null);
  }, [selectedLibraryEntry?.id]);

  return (
    <section className={`library library-redesign ${displaySettings.highContrast ? "library-high-contrast" : ""} ${displaySettings.largeCharts ? "library-large-charts" : ""}`}>
      <header className="library-heading studio-heading">
        <div>
          <span className="tag">Interactive reference</span>
          <h2>Chord library</h2>
          <p>Find a shape, hear it, and focus on one task at a time.</p>
        </div>
        <div className="studio-session-note library-collection-note">
          <span className="label">Your collection</span>
          <strong>{CHORD_LIBRARY.length} playable shapes</strong>
          <span>Filter the list, then keep one voicing in focus.</span>
        </div>
      </header>

      <div className="library-collection-switch" aria-label="Chord collection">
          {[
            { id: "all", label: "All" },
            { id: "favorites", label: `Favorites ${favoriteIds.length}` },
            { id: "recent", label: `Recent ${recentIds.length}` }
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={`chip ${activeCollection === option.id ? "active" : ""}`}
              onClick={() => setActiveCollection(option.id as "all" | "favorites" | "recent")}
            >
              {option.label}
            </button>
          ))}
      </div>

      <div className="library-card library-shell">
        <section className="library-harmonic-finder" aria-labelledby="harmonic-finder-title">
          <div className="library-section-heading">
            <div><span className="label">Primary search</span><h3 id="harmonic-finder-title">Harmonic Finder</h3></div>
            <span className="muted">Choose the role first, then compare guitar shapes.</span>
          </div>
          <div className="library-harmony-controls">
            <label>Key
              <select value={libraryFunctionKey} onChange={(event) => setLibraryFunctionKey(event.target.value)}>
                <option value="any">Any key</option>
                {CHORD_FUNCTION_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
            <label>Mode
              <select value={libraryMode} onChange={(event) => { setLibraryMode(event.target.value as HarmonyMode); setLibraryFunctionRole("any"); }}>
                <option value="major">Major</option><option value="minor">Minor</option>
              </select>
            </label>
            <label>Function / role
              <select value={libraryFunctionRole} onChange={(event) => setLibraryFunctionRole(event.target.value as "any" | HarmonicRole)}>
                <option value="any">All functions</option>
                {availableFunctionOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label>Harmonic event
              <select value={libraryHarmonicEvent} onChange={(event) => { setLibraryHarmonicEvent(event.target.value as HarmonicEvent | "all"); setLibraryFunctionRole("any"); }}>
                <option value="all">Diatonic and chromatic</option>
                <option value="diatonic">Diatonic</option><option value="borrowed">Borrowed / modal interchange</option>
                <option value="secondary-dominant">Secondary dominants</option><option value="tonicization">Tonicization</option><option value="cadence">Cadences</option>
              </select>
            </label>
          </div>
          {selectedFunction ? <p className="library-harmony-explanation"><strong>{selectedFunction.role}</strong> {selectedFunction.explanation} {selectedFunction.tendencyTones.length ? `Tendency tones: ${selectedFunction.tendencyTones.join(", ")}.` : ""} {selectedFunction.suggestedResolution}</p> : <p className="library-harmony-explanation muted">No playable shape is currently tagged for this role. The theory role remains available for analysis and can be added when a matching quality is present.</p>}
          <div className="library-circle" aria-label={`Circle of fifths for ${activeHarmonyKey} ${libraryMode}`}>
            {circlePoints.slice(0, 8).map((point) => <button key={`${point.note}-${point.role}`} type="button" className={point.note === activeHarmonyKey ? "active" : ""} onClick={() => setLibraryFunctionKey(point.note)} aria-label={`${point.note}, ${point.role}, resolves toward ${point.likelyResolution}`}><strong>{point.note}</strong><small>{point.degree} · {point.role}</small></button>)}
          </div>
        </section>

        <section className="library-secondary-search" aria-labelledby="library-shape-search-title">
          <div className="library-subsection-heading">
            <div><span className="label">Shape search</span><h3 id="library-shape-search-title">Find a voicing by name</h3></div>
            <span className="muted">Optional shortcut when you already know the chord or shape.</span>
          </div>
          <div className="library-findbar library-secondary-filters">
            <div className="library-search">
              <label className="label" htmlFor="library-search">Chord name or voicing</label>
              <input id="library-search" type="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Try Dm7, G/B, Fmaj7..." />
            </div>
            <details className="library-more-filters">
              <summary>Shape filters</summary>
              <div className="library-filter-popover">
                <label htmlFor="library-root">Root identity</label>
                <select id="library-root" value={libraryRoot} onChange={(event) => setLibraryRoot(event.target.value)}>{(availableRoots.length ? availableRoots : CHORD_LIBRARY_ROOTS).map((root) => <option key={root} value={root}>{root === "any" ? "Any root" : root}</option>)}</select>
                <label htmlFor="library-quality">Chord type</label>
                <select id="library-quality" value={libraryQuality} onChange={(event) => setLibraryQuality(event.target.value)}>{availableLibraryQualities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <label htmlFor="library-inversion">Position / shape</label>
                <select id="library-inversion" value={libraryInversion} onChange={(event) => setLibraryInversion(event.target.value)}>{availableInversionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <label htmlFor="library-tag">Difficulty</label>
                <select id="library-tag" value={libraryTag} onChange={(event) => setLibraryTag(event.target.value as "all" | DifficultyTag)}><option value="all">All difficulties</option>{CHORD_DIFFICULTY_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
                <label htmlFor="library-fret-range">Fret range</label>
                <select id="library-fret-range" value={fretFilter} onChange={(event) => setFretFilter(event.target.value as typeof fretFilter)}><option value="all">Any fret</option><option value="4">Open to fret 4</option><option value="8">Open to fret 8</option><option value="12">Open to fret 12</option></select>
                <label htmlFor="library-string-set">String set</label>
                <select id="library-string-set" value={stringFilter} onChange={(event) => setStringFilter(event.target.value as typeof stringFilter)}><option value="all">Any string set</option><option value="open">Includes open strings</option><option value="partial">Partial chords</option><option value="full">Five or more ringing strings</option></select>
                <button className="btn ghost" type="button" onClick={() => { setLibraryRoot("any"); setLibraryQuality("any"); setLibraryInversion("all"); setLibraryTag("all"); setFretFilter("all"); setStringFilter("all"); }}>Reset shape filters</button>
              </div>
            </details>
          </div>

          {searchMatches.length > 0 ? (
            <div className="library-jump-results">
              <span className="label">Quick results</span>
              <div className="variant-list">
                {searchMatches.map((entry) => (
                  <button key={entry.id} type="button" className="chip" onClick={() => jumpToChord(entry.id)}>
                    {entry.chord.name} · {entry.position}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {deferredLibrarySearch && searchMatches.length === 0 ? (
            <div className="history-empty library-no-results" role="status">
              No chord shape matches <strong>{librarySearch.trim()}</strong>. The library is still ready for theory, planner, and audio actions; clear the search or choose another function.
            </div>
          ) : null}
        </section>

        <section className="library-optional-section library-learning-section" aria-labelledby="library-learning-stage-title">
          <div className="library-stage-kicker"><span className="label">Optional learning studio</span><strong id="library-learning-stage-title">Build a guided path from the selected function</strong><span className="muted">Open-ended exploration stays below the primary search.</span></div>
          <ChordLearningStudio
            activeKey={activeHarmonyKey}
            mode={libraryMode}
            state={learningState}
            onStateChange={setLearningState}
            selectedEntry={selectedLibraryEntry}
            selectedFunction={selectedFunction}
            filteredEntries={filteredLibraryEntries}
            practiceStats={practiceStats}
            displaySettings={displaySettings}
            onRoleChange={(role) => setLibraryFunctionRole(role)}
            onKeyChange={(key) => setLibraryFunctionKey(key)}
            onSelectEntry={(id) => setSelectedLibraryId(id)}
            onLogPractice={addPracticeRep}
            onPlayChord={(chord, mode = "strum", voicingId) => playChordPreview(chord, mode, voicingId)}
          />
        </section>

        <section className="library-optional-section library-planner-section" aria-labelledby="library-planner-stage-title">
          <div className="library-stage-kicker"><span className="label">Practice planner</span><strong id="library-planner-stage-title">Turn a selected voicing into a focused session</strong><span className="muted">Planning tools stay lazy and do not affect the browse path.</span></div>
          <ChordPracticePlanner
            entries={filteredLibraryEntries}
            selectedEntry={selectedLibraryEntry}
            practiceStats={practiceStats}
            assignments={teacherAssignments}
            stringMistakes={stringMistakes}
            activeStudentId={activeStudentId}
            onSelectEntry={(id) => jumpToChord(id)}
            onPlayChord={(chord, mode = "strum") => playChordPreview(chord, mode)}
            sightReadingMode={sightReadingMode}
            onSightReadingModeChange={setSightReadingMode}
          />
        </section>

        <nav className="library-workspace-tabs" aria-label="Library tools">
          {([
            ["browse", "Browse"],
            ["practice", "Practice"],
            ["compare", "Compare"],
            ["tools", "Packs & export"]
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={workspace === id ? "active" : ""}
              aria-current={workspace === id ? "page" : undefined}
              onClick={() => setWorkspace(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="library-progression-analyzer" aria-labelledby="progression-analyzer-title">
          <div className="library-section-heading"><div><span className="label">Context tool</span><h3 id="progression-analyzer-title">Analyze a progression</h3></div><span className="muted">Try <code>G Em Am D7</code> or paste a short chord sequence.</span></div>
          <div className="library-progression-input"><input aria-label="Progression input" value={progressionInput} onChange={(event) => setProgressionInput(event.target.value)} placeholder="G · Em · Am · D7" /><button className="btn" type="button" onClick={runProgressionAnalysis}>Analyze in {activeHarmonyKey} {libraryMode}</button></div>
          {progressionAnalysis ? <div className="library-progression-results"><p><strong>{progressionAnalysis.summary}</strong> {progressionAnalysis.items.length ? "Choose a role below to return to functional shapes." : ""}</p>{progressionAnalysis.items.map((item, index) => <article key={`${item.symbol}-${index}`}><strong>{item.symbol}</strong><span>{item.function?.role ?? "Unmapped"}</span><p>{item.notes}</p><small>Substitutions: {item.substitutions.join(", ") || "none"} · Simpler: {item.simplerAlternatives.join(", ") || "none"}</small>{item.function ? <button className="inline-link" type="button" onClick={() => { setLibraryFunctionRole(item.function?.role ?? "any"); setLibraryFunctionKey(progressionAnalysis.key); }}>Show {item.function.role} shapes</button> : null}</article>)}</div> : null}
        </section>

        {selectedLibraryEntry ? (
          <div className="library-workspace">
            <aside className="library-voicing-list" aria-label="Matching chord voicings">
              <div className="library-list-heading">
                <span className="label">Voicings</span>
                <strong>{filteredLibraryEntries.length}</strong>
              </div>
              {visibleFunctionalGroups.map((group) => (
                <div key={group.identity} className="library-identity-group">
                  <div className="library-identity-heading"><strong>{group.identity.replace(":", " ")}</strong><small>{group.function?.role ?? "Shape identity"}</small></div>
                  {group.entries.map((entry) => (
                    <button key={entry.id} type="button" className={`library-voicing-row ${entry.id === selectedLibraryEntry.id ? "active" : ""}`} onClick={() => setSelectedLibraryId(entry.id)}>
                      <span><strong>{entry.chord.name}</strong><small>{entry.position}</small></span>
                      <small>{getDifficultyScore(entry)}/8</small>
                    </button>
                  ))}
                </div>
              ))}
              {visibleVoicingEntries.length < filteredLibraryEntries.length ? (
                <button className="btn ghost library-load-more" type="button" onClick={() => setVoicingLimit((limit) => limit + MAX_VISIBLE_VOICINGS)}>
                  Show {Math.min(MAX_VISIBLE_VOICINGS, filteredLibraryEntries.length - visibleVoicingEntries.length)} more voicings
                </button>
              ) : null}
            </aside>

            <div className={`library-stage workspace-${workspace}`}>
              <header className="library-stage-header">
                <div>
                  <span className="label">{selectedLibraryEntry.qualityLabel} · {selectedLibraryEntry.position}</span>
                  <h3>{selectedLibraryEntry.chord.name}</h3>
                  <p>{selectedLibraryEntry.summary}</p>
                </div>
                <div className="library-preview-buttons">
                  <button className="btn primary" type="button" onClick={() => playChordPreview(selectedLibraryEntry.chord, "strum")}>Play</button>
                  <button className="btn" type="button" onClick={() => playChordPreview(selectedLibraryEntry.chord, "arpeggio")}>Arpeggio</button>
                  <button
                    className={`btn ${favoriteSet.has(selectedLibraryEntry.id) ? "primary" : "ghost"}`}
                    type="button"
                    onClick={() => toggleFavorite(selectedLibraryEntry.id)}
                  >
                    {favoriteSet.has(selectedLibraryEntry.id) ? "Favorited" : "Favorite"}
                  </button>
                </div>
              </header>

              {workspace === "browse" ? (
                <div className="library-browse-view">
                  <div className="library-primary-diagram">
                    {sightReadingMode ? <div className="library-chart-hidden" role="status">Chart hidden until you answer in sight-reading mode.</div> : <ChordDiagram chord={selectedLibraryEntry.chord} orientation={displaySettings.handedness} highContrast={displaySettings.highContrast} largeChart={displaySettings.largeCharts} simplifiedChart={displaySettings.simplifiedCharts} />}
                  </div>
                  <div className="library-primary-copy">
                    <div className="library-tag-row">
                      {selectedLibraryEntry.difficultyTags.map((tag) => <span key={tag} className="meta-chip">{tag}</span>)}
                      {selectedLibraryEntry.functionContexts.slice(0, 2).map((context) => (
                        <span key={`${context.key}-${context.roles.join("-")}`} className="meta-chip">
                          {context.key}: {context.roles.join("/")}
                        </span>
                      ))}
                    </div>
                    <div className="library-key-facts">
                      <div><span className="label">Fingering</span><p>{selectedLibraryEntry.recommendedVariant}</p></div>
                      <div><span className="label">Practice focus</span><p>{selectedLibraryEntry.practiceFocus}</p></div>
                      <div><span className="label">Frets</span><p>{selectedLibraryEntry.chord.frets.map((fret) => fret < 0 ? "X" : fret === 0 ? "O" : fret).join(" ")}</p></div>
                    </div>
                    <div className="library-function-card">
                      <span className="label">Computed function</span>
                      {selectedFunction ? <><strong>{selectedFunction.role} · {selectedFunction.event}</strong><p>{selectedFunction.explanation}</p><small>{selectedFunction.tendencyTones.length ? `Tendency tones: ${selectedFunction.tendencyTones.join(", ")}. ` : ""}{selectedFunction.suggestedResolution}</small><div className="chip-row"><span className="muted">Next:</span>{selectedFunction.nextRoles.map((role) => <button key={role} type="button" className="chip" onClick={() => setLibraryFunctionRole(role)}>{role}</button>)}</div></> : <p className="muted">This identity is not a playable match for the selected computed role.</p>}
                    </div>
                    {transitionRecommendations.length ? <div className="library-transition-card"><span className="label">Low-cost next shapes</span>{transitionRecommendations.map(({ entry, cost }) => <button key={entry.id} type="button" className="library-transition-row" onClick={() => setSelectedLibraryId(entry.id)}><span><strong>{entry.chord.name}</strong><small>{entry.position}</small></span><small>{cost.score}/100 · {cost.explanation}</small></button>)}</div> : null}
                    <details className="library-disclosure">
                      <summary>Technique notes</summary>
                      <div className="library-disclosure-content">
                        <div><h4>Alternate fingerings</h4><ul>{selectedLibraryEntry.alternateFingerings.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        <div><h4>Muting and strings</h4><ul>{[...selectedLibraryEntry.mutingNotes, ...selectedLibraryEntry.avoidStrings].map((item) => <li key={item}>{item}</li>)}</ul></div>
                        <div><h4>Common mistakes</h4><ul>{getCommonMistakes(selectedLibraryEntry).map((item) => <li key={item}>{item}</li>)}</ul></div>
                      </div>
                    </details>
                    <details className="library-disclosure">
                      <summary>Theory and song context</summary>
                      <div className="library-disclosure-content">
                        {selectedTheory ? <div><h4>Why it works</h4><p>Degrees: {selectedTheory.degrees}. Bass: {selectedTheory.bass}.</p><p>{selectedTheory.voiceLeading}</p></div> : null}
                        <div><h4>Where to use it</h4>{selectedSongExamples.length ? <ul>{selectedSongExamples.map((item) => <li key={item.family}>{item.title}: {item.context}</li>)}</ul> : <p>Use it where the function tags match the song key.</p>}</div>
                      </div>
                    </details>
                    <details className="library-disclosure">
                      <summary>My notes</summary>
                      <textarea
                        aria-label="Notes for selected voicing"
                        value={selectedUserNote}
                        onChange={(event) => updateUserNote(selectedLibraryEntry.id, event.target.value)}
                        placeholder="What feels best on your instrument?"
                      />
                    </details>
                    {selectedLibraryEntry.nearbyAlternatives.length > 0 ? (
                      <div className="library-nearby-inline">
                        <span className="label">Try next</span>
                        {selectedLibraryEntry.nearbyAlternatives.map((alternative) => (
                          alternative.targetId ? (
                            <button key={alternative.label} className="inline-link" type="button" onClick={() => jumpToChord(alternative.targetId!)}>
                              {alternative.label}
                            </button>
                          ) : null
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {workspace === "practice" ? (
                <div className="library-task-layout">
                  <section className="library-task-primary">
                    <GuitarTechnique3D chord={selectedLibraryEntry.chord} handedness={displaySettings.handedness} mode="left-hand" labels />
                    <div className="practice-metric">
                      <span className="label">Focused practice</span>
                      <strong>{Math.floor(selectedPracticeStats.seconds / 60)}:{String(selectedPracticeStats.seconds % 60).padStart(2, "0")}</strong>
                      <p>{selectedPracticeStats.reps} repetitions · difficulty {selectedDifficultyScore}/8</p>
                    </div>
                    <div className="chip-row">
                      <button className={`btn ${activeTimerId === selectedLibraryEntry.id ? "primary" : ""}`} type="button" onClick={() => setActiveTimerId((current) => current === selectedLibraryEntry.id ? null : selectedLibraryEntry.id)}>
                        {activeTimerId === selectedLibraryEntry.id ? "Pause timer" : "Start timer"}
                      </button>
                      <button className="btn" type="button" onClick={() => addPracticeRep(selectedLibraryEntry.id)}>Log rep</button>
                    </div>
                    <div className="practice-rating">
                      <span className="label">How did it feel?</span>
                      <div className="chip-row">
                        <button className="chip" type="button" onClick={() => scheduleReview(selectedLibraryEntry.id, "again")}>Again</button>
                        <button className="chip" type="button" onClick={() => scheduleReview(selectedLibraryEntry.id, "good")}>Good</button>
                        <button className="chip" type="button" onClick={() => scheduleReview(selectedLibraryEntry.id, "easy")}>Easy</button>
                      </div>
                      <p className="muted">Next review: {selectedPracticeStats.nextReviewAt ? new Date(selectedPracticeStats.nextReviewAt).toLocaleString() : "Not scheduled"}</p>
                    </div>
                    <div className="practice-mistake-log">
                      <span className="label">Log a problem string</span>
                      <div className="chip-row">
                        {STANDARD_STRING_NOTES.map((note, index) => (
                          <button key={`${note}-${index}`} className="chip" type="button" onClick={() => logStringMistake(selectedLibraryEntry.id, index)}>
                            {index + 1}: {note}
                          </button>
                        ))}
                      </div>
                      <p className="muted">
                        {stringMistakes[selectedLibraryEntry.id]?.length
                          ? `Most logged: string ${[0, 1, 2, 3, 4, 5].sort((a, b) => (stringMistakes[selectedLibraryEntry.id]?.filter((item) => item === b).length ?? 0) - (stringMistakes[selectedLibraryEntry.id]?.filter((item) => item === a).length ?? 0))[0] + 1}`
                          : "No string-specific mistakes logged yet."}
                      </p>
                    </div>
                    {recommendation ? <p>Suggested next: <button className="inline-link" type="button" onClick={() => jumpToChord(recommendation.id)}>{recommendation.chord.name} · {recommendation.position}</button></p> : null}
                  </section>
                  <aside className="library-task-secondary">
                    <div>
                      <span className="label">Due reviews</span>
                      <div className="variant-list">
                        {dueReviewEntries.length ? dueReviewEntries.map((entry) => <button key={entry.id} className="chip" type="button" onClick={() => jumpToChord(entry.id)}>{entry.chord.name}</button>) : <p className="muted">Nothing due yet.</p>}
                      </div>
                    </div>
                    <div>
                      <span className="label">Ear training</span>
                      <div className="chip-row">
                        <button className="btn" type="button" onClick={() => startEarTraining("chord")}>Identify chord</button>
                        <button className="btn" type="button" onClick={() => startEarTraining("function")}>Identify function</button>
                      </div>
                      {earTarget ? (
                        <div className="ear-training-box">
                          <p>{earTarget.prompt === "chord" ? "Which chord did you hear?" : "Which function did you hear?"}</p>
                          <div className="chip-row">{earTarget.options.map((option) => <button key={option} type="button" className={`chip ${earAnswer === option ? "active" : ""}`} onClick={() => answerEarTraining(option)}>{option}</button>)}</div>
                          <div className="chip-row"><button className="btn ghost" type="button" onClick={() => playChordPreview(earTarget.entry.chord, "arpeggio", earTarget.entry.id)}>Replay</button><button className="btn ghost" type="button" onClick={connectMidi}>Connect MIDI</button><button className="btn ghost" type="button" onClick={clearMidiNotes}>Clear MIDI</button></div>
                          {earResult ? <strong>{earResult}</strong> : null}<p className="muted">{midiStatus}{midiHeldNotes.length > 1 ? " · polyphonic recognition active" : " · one held note uses root fallback"}</p>
                        </div>
                      ) : null}
                    </div>
                  </aside>
                </div>
              ) : null}

              {workspace === "compare" ? (
                <div className="library-compare-view">
                  <div className="compare-picker">
                    <label className="label" htmlFor="compare-second">Second voicing</label>
                    <select id="compare-second" value={compareChordId} onChange={(event) => setCompareChordId(event.target.value)}>
                      {comparisonCandidates.length ? comparisonCandidates.map((entry) => <option key={entry.id} value={entry.id}>{entry.chord.name} · {entry.position}</option>) : <option value="">No matching voicings</option>}
                    </select>
                    <label className="label" htmlFor="compare-third">Third voicing</label>
                    <select id="compare-third" value={thirdCompareChordId} onChange={(event) => setThirdCompareChordId(event.target.value)}>
                      {comparisonCandidates.length ? comparisonCandidates.map((entry) => <option key={entry.id} value={entry.id}>{entry.chord.name} · {entry.position}</option>) : <option value="">No matching voicings</option>}
                    </select>
                  </div>
                  <div className="library-comparison-cards">
                    {[selectedLibraryEntry, compareEntry, thirdCompareEntry].filter((entry): entry is ChordLibraryItem => Boolean(entry)).map((entry, index) => (
                      <article key={entry.id} className={index === 0 ? "active" : ""}>
                        <span className="label">{index === 0 ? "Primary" : `Option ${index + 1}`}</span>
                        <h4>{entry.chord.name}</h4>
                        <ChordDiagram chord={entry.chord} orientation={displaySettings.handedness} highContrast={displaySettings.highContrast} largeChart={displaySettings.largeCharts} simplifiedChart={displaySettings.simplifiedCharts} />
                        <p>{entry.summary}</p>
                        <div className="chip-row"><button className="btn" type="button" onClick={() => playChordPreview(entry.chord, "strum")}>Play</button>{index > 0 ? <button className="btn ghost" type="button" onClick={() => jumpToChord(entry.id)}>Make primary</button> : null}</div>
                      </article>
                    ))}
                  </div>
                  {compareEntry ? (
                    <div className="library-disclosure-content voice-leading-notes">
                      <span className="label">Voice-leading guide</span>
                      <p>Smallest visible changes from {selectedLibraryEntry.chord.name} to {compareEntry.chord.name}:</p>
                      <ul>{getVoiceLeadingNotes(selectedLibraryEntry, compareEntry).map((note) => <li key={note}>{note}</li>)}</ul>
                    </div>
                  ) : null}
                  <details className="library-disclosure">
                    <summary>Show shared-note fretboard</summary>
                    <div className="heatmap-grid" aria-label="Fretboard shared-note heatmap">
                      {heatmapNotes.map((cell) => <span key={cell.key} className={`heatmap-cell ${cell.state}`} title={`${selectedTuning.strings[cell.stringIndex]} string fret ${cell.fret}: ${cell.note}`}>{cell.fret === 0 ? selectedTuning.strings[cell.stringIndex] : cell.note}</span>)}
                    </div>
                  </details>
                  <button className="btn primary library-print-button" type="button" onClick={() => window.print()}>Print comparison</button>
                </div>
              ) : null}

              {workspace === "tools" ? (
                <div className="library-tools-view">
                  <section>
                    <div className="library-section-heading"><div><span className="label">Sound and setup</span><h4>Instrument options</h4></div></div>
                    <div className="library-compact-controls">
                      <div><label htmlFor="library-capo">Capo {capoFret}</label><input id="library-capo" type="range" min="0" max="7" value={capoFret} onChange={(event) => setCapoFret(Number(event.target.value))}/><p>{selectedLibraryEntry.chord.name} sounds as {selectedCapoName}.</p></div>
                      <div><label htmlFor="library-tuning">Tuning</label><select id="library-tuning" value={tuningId} onChange={(event) => setTuningId(event.target.value as TuningId)}>{TUNINGS.map((tuning) => <option key={tuning.id} value={tuning.id}>{tuning.label}</option>)}</select><p>{getChordNoteNames(selectedLibraryEntry.chord, selectedTuning).join(" ")}</p></div>
                      <div><span>Sample voice</span><div className="chip-row">{SAMPLE_VOICES.map((voice) => <button key={voice} type="button" className={`chip ${sampleVoice === voice ? "active" : ""}`} onClick={() => setSampleVoice(voice)}>{voice}</button>)}</div><label htmlFor="sample-velocity">Velocity {Math.round(sampleVelocity * 100)}%</label><input id="sample-velocity" type="range" min="0" max="1" step="0.01" value={sampleVelocity} onChange={(event) => setSampleVelocity(Number(event.target.value))} /><p>{sampleStatus}</p></div>
                    </div>
                    <div className="custom-fretboard-editor">
                      <div className="library-section-heading"><div><span className="label">Voicing builder</span><h4>Make a custom shape</h4></div><button className="btn ghost" type="button" onClick={() => setCustomFrets([-1, -1, -1, -1, -1, -1])}>Clear</button></div>
                      <p className="muted">Click a string to cycle mute, open, and frets 1–5. The chart updates immediately.</p>
                      <div className="custom-fretboard-grid" aria-label="Custom fretboard editor">
                        {customFrets.map((fret, index) => (
                          <button key={index} type="button" className="custom-fret-cell" aria-label={`String ${index + 1}, fret ${fret < 0 ? "muted" : fret}`} onClick={() => setCustomFrets((previous) => previous.map((current, currentIndex) => currentIndex === index ? (current >= 5 ? -1 : current + 1) : current))}>
                            <strong>{STANDARD_STRING_NOTES[index]}</strong><span>{fret < 0 ? "X" : fret === 0 ? "O" : fret}</span>
                          </button>
                        ))}
                      </div>
                      <div className="custom-fretboard-preview"><ChordDiagram chord={customChord} orientation={displaySettings.handedness} highContrast={displaySettings.highContrast} largeChart={displaySettings.largeCharts} simplifiedChart={displaySettings.simplifiedCharts} /><button className="btn" type="button" onClick={() => playChordPreview(customChord, "strum", "custom")}>Play custom shape</button></div>
                    </div>
                  </section>
                  <section>
                    <div className="library-section-heading">
                      <div><span className="label">Progression packs</span><h4>Practice in context</h4></div>
                      <button className="btn ghost" type="button" onClick={() => setActivePackId("all")}>Clear pack</button>
                    </div>
                    <div className="library-pack-list">
                      {allProgressionPacks.map((pack) => (
                        <button key={pack.id} type="button" className={activePackId === pack.id ? "active" : ""} onClick={() => { setActivePackId(pack.id); if (pack.chordIds[0]) jumpToChord(pack.chordIds[0]); }}>
                          <span><strong>{pack.title}</strong><small>{pack.keyCenter} · {pack.progression.join(" · ")}</small></span><small>{pack.rightHandPattern}</small>
                        </button>
                      ))}
                    </div>
                    <details className="library-disclosure"><summary>Create a custom pack</summary><div className="custom-pack-builder"><div><label htmlFor="custom-pack-name">Name</label><input id="custom-pack-name" value={customPackName} onChange={(event) => setCustomPackName(event.target.value)}/></div><div><label htmlFor="custom-pack-pattern">Right-hand pattern</label><select id="custom-pack-pattern" value={customPackPattern} onChange={(event) => setCustomPackPattern(event.target.value)}>{RIGHT_HAND_PATTERNS.map((pattern) => <option key={pattern} value={pattern}>{pattern}</option>)}</select></div><button className="btn primary" type="button" onClick={saveCurrentCustomPack}>Save current set</button></div></details>
                  </section>
                  <section>
                    <div className="library-section-heading"><div><span className="label">Profiles</span><h4>Student progress</h4></div></div>
                    <div className="library-profile-row">
                      <select value={activeStudentId} onChange={(event) => loadStudentProfile(event.target.value)}><option value="default-student">Current device profile</option>{studentProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
                      <input value={newStudentName} onChange={(event) => setNewStudentName(event.target.value)} placeholder="Student name" aria-label="New student name"/>
                      <button className="btn" type="button" onClick={saveStudentProfile}>Save profile</button>
                    </div>
                    <p className={`sync-status sync-${syncStatus}`} role="status"><strong>{syncStatus === "synced" ? "Cloud synced" : syncStatus === "syncing" ? "Syncing" : syncStatus === "offline" ? "Offline" : syncStatus === "error" ? "Sync issue" : "Local profile"}</strong> · {syncMessage}</p>
                    <div className="instrument-profile-grid">
                      <label>Scale length (in)<input type="number" min="20" max="30" step="0.1" value={instrumentProfile.scaleLengthInches} onChange={(event) => updateInstrumentProfile({ scaleLengthInches: Math.max(20, Math.min(30, Number(event.target.value) || 25.5)) })} /></label>
                      <label>Action<select value={instrumentProfile.action} onChange={(event) => updateInstrumentProfile({ action: event.target.value as InstrumentProfile["action"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                      <label>Preferred tuning<select value={instrumentProfile.tuningId} onChange={(event) => updateInstrumentProfile({ tuningId: event.target.value })}>{TUNINGS.map((tuning) => <option key={tuning.id} value={tuning.id}>{tuning.label}</option>)}</select></label>
                    </div>
                    <div className="display-mode-controls">
                      <span className="label">Display</span>
                      <label><input type="checkbox" checked={displaySettings.handedness === "left"} onChange={(event) => setDisplaySettings((previous) => ({ ...previous, handedness: event.target.checked ? "left" : "right" }))} /> Left-handed</label>
                      <label><input type="checkbox" checked={displaySettings.highContrast} onChange={(event) => setDisplaySettings((previous) => ({ ...previous, highContrast: event.target.checked }))} /> High contrast</label>
                      <label><input type="checkbox" checked={displaySettings.largeCharts} onChange={(event) => setDisplaySettings((previous) => ({ ...previous, largeCharts: event.target.checked }))} /> Larger charts</label>
                      <label><input type="checkbox" checked={displaySettings.simplifiedCharts} onChange={(event) => setDisplaySettings((previous) => ({ ...previous, simplifiedCharts: event.target.checked }))} /> Simplified charts</label>
                    </div>
                  </section>
                  <section>
                    <div className="library-section-heading"><div><span className="label">Teacher assignments</span><h4>Practice tasks</h4></div></div>
                    <div className="assignment-builder">
                      <input aria-label="Assignment title" value={newAssignmentTitle} onChange={(event) => setNewAssignmentTitle(event.target.value)} placeholder="Assignment title" />
                      <input aria-label="Assignment due date" type="date" value={newAssignmentDueAt} onChange={(event) => setNewAssignmentDueAt(event.target.value)} />
                      <button className="btn" type="button" onClick={createAssignment}>Assign current set</button>
                    </div>
                    <div className="assignment-list">
                      {teacherAssignments.filter((assignment) => assignment.studentId === activeStudentId).length ? teacherAssignments.filter((assignment) => assignment.studentId === activeStudentId).map((assignment) => (
                        <article key={assignment.id} className={`assignment-card ${assignment.completedAt ? "complete" : ""}`}>
                          <label><input type="checkbox" checked={Boolean(assignment.completedAt)} onChange={() => toggleAssignment(assignment)} /><strong>{assignment.title}</strong></label>
                          <small>{assignment.description}{assignment.dueAt ? ` · Due ${new Date(assignment.dueAt).toLocaleDateString()}` : ""}</small>
                          <label>Teacher comment<textarea value={assignment.teacherComments ?? ""} onChange={(event) => updateAssignmentComment(assignment, event.target.value)} placeholder="Helpful practice direction" /></label>
                          <div className="assignment-feedback"><label>Feedback<input value={feedbackDrafts[assignment.id] ?? ""} onChange={(event) => setFeedbackDrafts((previous) => ({ ...previous, [assignment.id]: event.target.value }))} placeholder="Add feedback" /></label><button className="btn ghost" type="button" onClick={() => addAssignmentFeedback(assignment)}>Post feedback</button></div>
                          {assignment.feedbackHistory?.length ? <ul className="assignment-feedback-history">{assignment.feedbackHistory.map((feedback) => <li key={feedback.id}><strong>{feedback.author}</strong> <time dateTime={feedback.createdAt}>{new Date(feedback.createdAt).toLocaleDateString()}</time><p>{feedback.body}</p></li>)}</ul> : null}
                          <button className="text-button" type="button" onClick={() => deleteAssignment(assignment.id)}>Remove</button>
                        </article>
                      )) : <p className="muted">No assignments for this student yet.</p>}
                    </div>
                  </section>
                  <section className="teacher-export">
                    <div className="library-section-heading"><div><span className="label">Teacher export</span><h4>Printable practice sheet</h4></div><button className="btn primary" type="button" onClick={() => window.print()}>Print or save PDF</button></div>
                    <div className="library-profile-row">
                      <select aria-label="Teacher key" value={teacherKey} onChange={(event) => setTeacherKey(event.target.value)}>{CHORD_FUNCTION_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}</select>
                      <select aria-label="Teacher skill" value={teacherSkill} onChange={(event) => setTeacherSkill(event.target.value as "all" | DifficultyTag)}><option value="all">All skills</option>{CHORD_DIFFICULTY_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
                      <select aria-label="Teacher pack" value={teacherPackId} onChange={(event) => setTeacherPackId(event.target.value)}><option value="all">No pack filter</option>{allProgressionPacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.title}</option>)}</select>
                    </div>
                    <div className="chip-row"><button className="btn" type="button" onClick={exportTeacherPacks}>Export packs</button><label className="btn ghost" htmlFor="teacher-pack-import">Import packs</label><input id="teacher-pack-import" type="file" accept="application/json,.json" className="visually-hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) importTeacherPacks(file); event.currentTarget.value = ""; }}/></div>
                    <p className="muted">{teacherSheetEntries.length} chords will be included in the printable sheet.</p>
                    <details className="library-disclosure">
                      <summary>Preview printable sheet</summary>
                      <div className="teacher-sheet-grid">
                        {teacherSheetEntries.map((entry) => (
                          <article key={`teacher-${entry.id}`} className="teacher-sheet-card">
                            <h3>{entry.chord.name}</h3>
                            <ChordDiagram chord={entry.chord} orientation={displaySettings.handedness} highContrast={displaySettings.highContrast} largeChart={displaySettings.largeCharts} simplifiedChart={displaySettings.simplifiedCharts} />
                            <p>{entry.position}</p>
                            <p className="muted">{entry.practiceFocus}</p>
                          </article>
                        ))}
                      </div>
                    </details>
                  </section>
                </div>
              ) : null}

              <div className="print-compare-sheet">
                {[selectedLibraryEntry, compareEntry, thirdCompareEntry].filter((entry): entry is ChordLibraryItem => Boolean(entry)).map((entry) => (
                  <article key={`print-${entry.id}`} className="print-compare-card"><h3>{entry.chord.name}</h3><p>{entry.position}</p><ChordDiagram chord={entry.chord} orientation={displaySettings.handedness} highContrast={displaySettings.highContrast} largeChart={displaySettings.largeCharts} simplifiedChart={displaySettings.simplifiedCharts}/><p>{entry.recommendedVariant}</p></article>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="history-empty">No voicings match these filters. Clear the pack or broaden the search.</div>
        )}
      </div>
    </section>
  );
}
