"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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

const RECENTS_STORAGE_KEY = "chord-hero-library-recents";
const FAVORITES_STORAGE_KEY = "chord-hero-library-favorites";
const CUSTOM_PACKS_STORAGE_KEY = "chord-hero-library-custom-packs";
const PRACTICE_STATS_STORAGE_KEY = "chord-hero-library-practice-stats";
const USER_NOTES_STORAGE_KEY = "chord-hero-library-user-notes";
const STUDENT_PROFILES_STORAGE_KEY = "chord-hero-library-student-profiles";
const SAMPLE_BASE_PATH = "/samples/guitar";
const OPEN_STRING_FREQUENCIES = [82.41, 110, 146.83, 196, 246.94, 329.63];
const STANDARD_STRING_NOTES = ["E", "A", "D", "G", "B", "E"];
const DEFAULT_LIBRARY_ITEM = CHORD_LIBRARY[0] ?? null;
const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = new Map(NOTES.map((note, index) => [note, index]));
const RIGHT_HAND_PATTERNS = [
  "Down, down-up, up-down-up",
  "Thumb bass, down-up brush",
  "Bass note, light strum, bass note, strum",
  "Short downstrokes with muted releases",
  "Arpeggio 6-4-3-2-1",
  "Alternating bass with pinch"
];
const SAMPLE_VOICES = ["steel", "nylon", "muted", "picked"] as const;
const TUNINGS = [
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
type CustomPack = ProgressionPack & { custom: true };
type PracticeStats = Record<
  string,
  { seconds: number; reps: number; misses?: number; nextReviewAt?: string; strength?: number }
>;
type EarTarget = {
  entry: ChordLibraryItem;
  prompt: "chord" | "function";
  options: string[];
};
type StudentProfile = {
  id: string;
  name: string;
  favorites: string[];
  recents: string[];
  practiceStats: PracticeStats;
  userNotes: Record<string, string>;
};
type HeatmapNote = {
  key: string;
  stringIndex: number;
  fret: number;
  note: string;
  state: "primary" | "comparison" | "shared" | "idle";
};

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

export default function ChordLibraryExplorer() {
  const [libraryRoot, setLibraryRoot] = useState(DEFAULT_LIBRARY_ITEM?.root ?? "");
  const [libraryQuality, setLibraryQuality] = useState(DEFAULT_LIBRARY_ITEM?.quality ?? "");
  const [libraryInversion, setLibraryInversion] = useState<"standard" | "inverted">(
    DEFAULT_LIBRARY_ITEM?.inversion ?? "standard"
  );
  const [libraryTag, setLibraryTag] = useState<"all" | DifficultyTag>("all");
  const [libraryFunctionKey, setLibraryFunctionKey] = useState<"any" | string>("G");
  const [libraryFunctionRole, setLibraryFunctionRole] = useState<"any" | HarmonicRole>("any");
  const [librarySearch, setLibrarySearch] = useState("");
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
  const [tuningId, setTuningId] = useState<TuningId>("standard");
  const [teacherKey, setTeacherKey] = useState("G");
  const [teacherSkill, setTeacherSkill] = useState<"all" | DifficultyTag>("beginner");
  const [teacherPackId, setTeacherPackId] = useState<"all" | string>("all");
  const [sampleStatus, setSampleStatus] = useState("Generated fallback ready");
  const [earTarget, setEarTarget] = useState<EarTarget | null>(null);
  const [earAnswer, setEarAnswer] = useState("");
  const [earResult, setEarResult] = useState("");
  const [thirdCompareChordId, setThirdCompareChordId] = useState("");
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [activeStudentId, setActiveStudentId] = useState("default-student");
  const [newStudentName, setNewStudentName] = useState("");
  const [midiStatus, setMidiStatus] = useState("MIDI not connected");

  const deferredLibrarySearch = useDeferredValue(librarySearch.trim().toLowerCase());
  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const allProgressionPacks = useMemo(
    () => [...PROGRESSION_PACKS, ...customPacks],
    [customPacks]
  );
  const selectedPack = allProgressionPacks.find((pack) => pack.id === activePackId) ?? null;
  const selectedTuning = TUNINGS.find((tuning) => tuning.id === tuningId) ?? TUNINGS[0];
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

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
      Array.from(new Set(libraryPool.map((entry) => entry.root))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [libraryPool]
  );
  const rootPool = useMemo(
    () => libraryPool.filter((entry) => entry.root === libraryRoot),
    [libraryPool, libraryRoot]
  );
  const availableLibraryQualities = useMemo(
    () =>
      CHORD_QUALITY_OPTIONS.filter((option) =>
        rootPool.some((entry) => entry.quality === option.value)
      ),
    [rootPool]
  );
  const availableInversions = useMemo(() => {
    const inversions = new Set(
      rootPool
        .filter((entry) => entry.quality === libraryQuality)
        .map((entry) => entry.inversion)
    );
    return {
      standard: inversions.has("standard"),
      inverted: inversions.has("inverted")
    };
  }, [libraryQuality, rootPool]);

  const filteredLibraryEntries = useMemo(
    () =>
      libraryPool.filter((entry) => {
        if (entry.root !== libraryRoot) return false;
        if (entry.quality !== libraryQuality) return false;
        if (entry.inversion !== libraryInversion) return false;
        if (libraryTag !== "all" && !entry.difficultyTags.includes(libraryTag)) return false;

        if (libraryFunctionRole !== "any" || libraryFunctionKey !== "any") {
          const matchingContexts = entry.functionContexts.filter((context) =>
            libraryFunctionKey === "any" ? true : context.key === libraryFunctionKey
          );
          if (!matchingContexts.length) return false;
          if (
            libraryFunctionRole !== "any" &&
            !matchingContexts.some((context) => context.roles.includes(libraryFunctionRole))
          ) {
            return false;
          }
        }

        if (deferredLibrarySearch.length > 0) {
          const searchableText = [
            entry.chord.name,
            entry.position,
            entry.summary,
            entry.qualityLabel,
            entry.practiceFocus
          ]
            .join(" ")
            .toLowerCase();
          if (!searchableText.includes(deferredLibrarySearch)) return false;
        }

        return true;
      }),
    [
      deferredLibrarySearch,
      libraryFunctionKey,
      libraryFunctionRole,
      libraryInversion,
      libraryPool,
      libraryQuality,
      libraryRoot,
      libraryTag
    ]
  );

  const searchMatches = useMemo(() => {
    if (!deferredLibrarySearch) return [];
    return CHORD_LIBRARY.filter((entry) =>
      entry.chord.name.toLowerCase().includes(deferredLibrarySearch)
    ).slice(0, 8);
  }, [deferredLibrarySearch]);

  const selectedLibraryEntry =
    filteredLibraryEntries.find((entry) => entry.id === selectedLibraryId) ??
    filteredLibraryEntries[0] ??
    null;
  const compareEntry =
    (compareChordId ? CHORD_ITEM_LOOKUP.get(compareChordId) : null) ?? null;
  const thirdCompareEntry =
    (thirdCompareChordId ? CHORD_ITEM_LOOKUP.get(thirdCompareChordId) : null) ?? null;
  const selectedTheory = selectedLibraryEntry ? getTheoryNotes(selectedLibraryEntry) : null;
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
        (entry) => !practicedIds.has(entry.id) && getDifficultyScore(entry) <= currentScore + 1
      ) ?? CHORD_LIBRARY.find((entry) => !practicedIds.has(entry.id)) ?? null
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

  const getSampleBuffer = async (voice: SampleVoice, mode: "strum" | "arpeggio") => {
    const ctx = await ensureAudioContext();
    const sampleMode = voice === "picked" ? "arpeggio" : voice === "muted" ? "muted-strum" : mode;
    const cacheKey = `${voice}-${sampleMode}`;
    const cached = sampleCacheRef.current.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${SAMPLE_BASE_PATH}/${cacheKey}.wav`);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buffer);
      sampleCacheRef.current.set(cacheKey, decoded);
      setSampleStatus(`Recorded ${voice} ${sampleMode} sample loaded`);
      return decoded;
    } catch {
      setSampleStatus("Recorded samples not found; using generated fallback");
      return null;
    }
  };

  const playChordPreview = async (chord: Chord, mode: "strum" | "arpeggio") => {
    const ctx = await ensureAudioContext();
    const sampleBuffer = await getSampleBuffer(sampleVoice, mode);
    if (sampleBuffer) {
      const source = ctx.createBufferSource();
      const sampleGain = ctx.createGain();
      source.buffer = sampleBuffer;
      source.playbackRate.value = Math.pow(2, capoFret / 12);
      sampleGain.gain.value = sampleVoice === "muted" ? 0.42 : 0.65;
      source.connect(sampleGain);
      sampleGain.connect(ctx.destination);
      source.start();
      return;
    }

    const frequencies = getVoicingFrequencies(chord, capoFret, selectedTuning.semitoneOffsets);
    if (!frequencies.length) return;

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
    setLibraryInversion(nextEntry.inversion);
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

  const snapshotStudent = (id: string, name: string): StudentProfile => ({
    id,
    name,
    favorites: favoriteIds,
    recents: recentIds,
    practiceStats,
    userNotes
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

  const connectMidi = async () => {
    const midiNavigator = navigator as Navigator & { requestMIDIAccess?: () => Promise<any> };
    if (!midiNavigator.requestMIDIAccess) {
      setMidiStatus("Web MIDI is not supported in this browser");
      return;
    }
    try {
      const access = await midiNavigator.requestMIDIAccess();
      const handleMessage = (event: any) => {
        const [status, note] = event.data ?? [];
        if ((status & 0xf0) !== 0x90 || !note || event.data[2] === 0) return;
        const midiNote = noteAt(note % 12);
        setMidiStatus(`Last MIDI note: ${midiNote}`);
        if (!earTarget) return;
        const targetRoot = earTarget.entry.root;
        const correct = midiNote === targetRoot;
        setEarAnswer(correct ? (earTarget.prompt === "chord" ? earTarget.entry.chord.name : earTarget.entry.functionContexts[0]?.roles[0] ?? "I") : midiNote);
        setEarResult(correct ? "Correct MIDI root" : `Try again; the root is ${targetRoot}`);
      };
      access.inputs.forEach((input: any) => { input.onmidimessage = handleMessage; });
      setMidiStatus(`${access.inputs.size} MIDI input${access.inputs.size === 1 ? "" : "s"} connected`);
    } catch {
      setMidiStatus("MIDI permission was not granted");
    }
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

  const startEarTraining = (prompt: "chord" | "function") => {
    const pool = filteredLibraryEntries.length ? filteredLibraryEntries : CHORD_LIBRARY;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const correct =
      prompt === "chord"
        ? entry.chord.name
        : entry.functionContexts[0]?.roles[0] ?? "I";
    const distractors =
      prompt === "chord"
        ? CHORD_LIBRARY.map((candidate) => candidate.chord.name)
        : HARMONIC_FUNCTION_OPTIONS;
    const options = Array.from(new Set(distractors))
      .filter((option) => option !== correct)
      .slice(0, 3);
    const shuffled = [correct, ...options].sort(() => Math.random() - 0.5);
    setEarTarget({ entry, prompt, options: shuffled });
    setEarAnswer("");
    setEarResult("");
    void playChordPreview(entry.chord, "strum");
  };

  const answerEarTraining = (answer: string) => {
    if (!earTarget) return;
    const correct =
      earTarget.prompt === "chord"
        ? earTarget.entry.chord.name
        : earTarget.entry.functionContexts[0]?.roles[0] ?? "I";
    setEarAnswer(answer);
    setEarResult(answer === correct ? "Correct" : `Listen again: ${correct}`);
  };

  useEffect(() => {
    try {
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const storedRecents = window.localStorage.getItem(RECENTS_STORAGE_KEY);
      const storedCustomPacks = window.localStorage.getItem(CUSTOM_PACKS_STORAGE_KEY);
      const storedPracticeStats = window.localStorage.getItem(PRACTICE_STATS_STORAGE_KEY);
      const storedUserNotes = window.localStorage.getItem(USER_NOTES_STORAGE_KEY);
      const storedProfiles = window.localStorage.getItem(STUDENT_PROFILES_STORAGE_KEY);
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
      if (storedProfiles) {
        setStudentProfiles(JSON.parse(storedProfiles));
      }
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [favoriteIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(recentIds));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [recentIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_PACKS_STORAGE_KEY, JSON.stringify(customPacks));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [customPacks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify(practiceStats));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [practiceStats]);

  useEffect(() => {
    try {
      window.localStorage.setItem(USER_NOTES_STORAGE_KEY, JSON.stringify(userNotes));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [userNotes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STUDENT_PROFILES_STORAGE_KEY, JSON.stringify(studentProfiles));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  }, [studentProfiles]);

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
      setLibraryRoot(availableRoots[0]);
    }
  }, [availableRoots, libraryRoot]);

  useEffect(() => {
    if (!availableLibraryQualities.length) return;
    if (!availableLibraryQualities.some((option) => option.value === libraryQuality)) {
      setLibraryQuality(availableLibraryQualities[0]?.value ?? "");
    }
  }, [availableLibraryQualities, libraryQuality]);

  useEffect(() => {
    if (!availableInversions[libraryInversion]) {
      setLibraryInversion(availableInversions.standard ? "standard" : "inverted");
    }
  }, [availableInversions, libraryInversion]);

  useEffect(() => {
    if (!filteredLibraryEntries.length) return;
    if (!filteredLibraryEntries.some((entry) => entry.id === selectedLibraryId)) {
      setSelectedLibraryId(filteredLibraryEntries[0]?.id ?? "");
    }
  }, [filteredLibraryEntries, selectedLibraryId]);

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
    <section className="library">
      <div>
        <h2>Chord library</h2>
        <p>
          Filter by key, harmonic role, and difficulty, then compare voicings with fingering,
          coaching, and audio previews.
        </p>
      </div>
      <div className="library-card library-advanced">
        <div className="library-toolbar">
          <div className="library-filters">
            <div>
              <label className="label" htmlFor="library-root">
                Main key
              </label>
              <select
                id="library-root"
                value={libraryRoot}
                onChange={(event) => setLibraryRoot(event.target.value)}
              >
                {(availableRoots.length ? availableRoots : CHORD_LIBRARY_ROOTS).map((root) => (
                  <option key={root} value={root}>
                    {root}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="library-quality">
                Chord type
              </label>
              <select
                id="library-quality"
                value={libraryQuality}
                onChange={(event) => setLibraryQuality(event.target.value)}
              >
                {availableLibraryQualities.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="library-inversion">
                Inversion
              </label>
              <select
                id="library-inversion"
                value={libraryInversion}
                onChange={(event) =>
                  setLibraryInversion(event.target.value as "standard" | "inverted")
                }
              >
                {availableInversions.standard && <option value="standard">Standard</option>}
                {availableInversions.inverted && <option value="inverted">Inverted</option>}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="library-tag">
                Difficulty tag
              </label>
              <select
                id="library-tag"
                value={libraryTag}
                onChange={(event) => setLibraryTag(event.target.value as "all" | DifficultyTag)}
              >
                <option value="all">All tags</option>
                {CHORD_DIFFICULTY_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="library-function-key">
                Common in key of
              </label>
              <select
                id="library-function-key"
                value={libraryFunctionKey}
                onChange={(event) => setLibraryFunctionKey(event.target.value)}
              >
                <option value="any">Any key</option>
                {CHORD_FUNCTION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="library-function-role">
                Musical function
              </label>
              <select
                id="library-function-role"
                value={libraryFunctionRole}
                onChange={(event) =>
                  setLibraryFunctionRole(event.target.value as "any" | HarmonicRole)
                }
              >
                <option value="any">Any role</option>
                {HARMONIC_FUNCTION_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="library-search-row">
            <div className="library-search">
              <label className="label" htmlFor="library-search">
                Search by chord name
              </label>
              <input
                id="library-search"
                type="search"
                value={librarySearch}
                onChange={(event) => setLibrarySearch(event.target.value)}
                placeholder="Try Dm7, G/B, Fmaj7..."
              />
            </div>
            <div className="library-view-switch">
              <span className="label">Collection</span>
              <div className="chip-row">
                {[
                  { id: "all", label: "All" },
                  { id: "favorites", label: `Favorites (${favoriteIds.length})` },
                  { id: "recent", label: `Recent (${recentIds.length})` }
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${activeCollection === option.id ? "active" : ""}`}
                    onClick={() =>
                      setActiveCollection(option.id as "all" | "favorites" | "recent")
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="library-tools-grid">
            <div className="library-tool-panel">
              <span className="label">Capo transposition</span>
              <div className="range-row">
                <input
                  id="library-capo"
                  type="range"
                  min="0"
                  max="7"
                  value={capoFret}
                  onChange={(event) => setCapoFret(Number(event.target.value))}
                />
                <strong>Capo {capoFret}</strong>
              </div>
              <p className="muted">
                {selectedLibraryEntry
                  ? `${selectedLibraryEntry.chord.name} shape sounds as ${selectedCapoName}.`
                  : "Choose a chord to see capo-aware naming."}
              </p>
            </div>

            <div className="library-tool-panel">
              <span className="label">Recorded sample voice</span>
              <div className="chip-row">
                {SAMPLE_VOICES.map((voice) => (
                  <button
                    key={voice}
                    type="button"
                    className={`chip ${sampleVoice === voice ? "active" : ""}`}
                    onClick={() => setSampleVoice(voice)}
                  >
                    {voice}
                  </button>
                ))}
              </div>
              <p className="muted">{sampleStatus}</p>
            </div>

            <div className="library-tool-panel">
              <span className="label">Alternate tuning</span>
              <select value={tuningId} onChange={(event) => setTuningId(event.target.value as TuningId)}>
                {TUNINGS.map((tuning) => (
                  <option key={tuning.id} value={tuning.id}>
                    {tuning.label}
                  </option>
                ))}
              </select>
              <p className="muted">Strings: {selectedTuning.strings.join(" ")}</p>
            </div>

            <div className="library-tool-panel">
              <span className="label">Ear training</span>
              <div className="chip-row">
                <button className="btn" type="button" onClick={() => startEarTraining("chord")}>
                  Identify chord
                </button>
                <button className="btn" type="button" onClick={() => startEarTraining("function")}>
                  Identify function
                </button>
              </div>
              {earTarget ? (
                <div className="ear-training-box">
                  <p className="muted">
                    {earTarget.prompt === "chord"
                      ? "Which chord did you hear?"
                      : "Which function did you hear?"}
                  </p>
                  <div className="chip-row">
                    {earTarget.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`chip ${earAnswer === option ? "active" : ""}`}
                        onClick={() => answerEarTraining(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <div className="chip-row">
                    <button className="btn" type="button" onClick={connectMidi}>
                      Connect MIDI
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => playChordPreview(earTarget.entry.chord, "arpeggio")}
                    >
                      Replay arpeggio
                    </button>
                    {earResult ? <strong>{earResult}</strong> : null}
                  </div>
                  <p className="muted">{midiStatus}. Play the chord root on a MIDI keyboard or fretboard.</p>
                </div>
              ) : null}
            </div>

            <div className="library-tool-panel">
              <span className="label">Due reviews</span>
              {dueReviewEntries.length > 0 ? (
                <div className="variant-list">
                  {dueReviewEntries.map((entry) => (
                    <button key={entry.id} className="chip" type="button" onClick={() => jumpToChord(entry.id)}>
                      {entry.chord.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">No weak voicings are due yet.</p>
              )}
            </div>

            <div className="library-tool-panel">
              <span className="label">Student progress profile</span>
              <select value={activeStudentId} onChange={(event) => loadStudentProfile(event.target.value)}>
                <option value="default-student">Current device profile</option>
                {studentProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
              <div className="chip-row">
                <input
                  value={newStudentName}
                  onChange={(event) => setNewStudentName(event.target.value)}
                  placeholder="New student name"
                  aria-label="New student name"
                />
                <button className="btn" type="button" onClick={saveStudentProfile}>Save profile</button>
              </div>
              <p className="muted">Profiles keep favorites, recents, practice timing, reviews, and notes separate on this device.</p>
            </div>
          </div>

          {searchMatches.length > 0 && (
            <div className="library-jump-results">
              <span className="label">Quick jump</span>
              <div className="variant-list">
                {searchMatches.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="chip"
                    onClick={() => jumpToChord(entry.id)}
                  >
                    {entry.chord.name} • {entry.position}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="library-pack-strip">
            <div className="library-pack-header">
              <div>
                <span className="label">Progression packs</span>
                <p>Browse chords in musical groups instead of isolated shapes.</p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setActivePackId("all")}>
                Show all
              </button>
            </div>
            <div className="library-pack-grid">
              {allProgressionPacks.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className={`pack-card ${activePackId === pack.id ? "active" : ""}`}
                  onClick={() => {
                    setActivePackId(pack.id);
                    if (pack.chordIds[0]) {
                      jumpToChord(pack.chordIds[0]);
                    }
                  }}
                >
                  <span className="label">{pack.keyCenter}</span>
                  <h3>{pack.title}</h3>
                  <p>{pack.description}</p>
                  <p className="muted">{pack.progression.join(" • ")}</p>
                  <p className="muted">Pattern: {pack.rightHandPattern}</p>
                </button>
              ))}
            </div>
            <div className="custom-pack-builder">
              <div>
                <label className="label" htmlFor="custom-pack-name">
                  Custom pack name
                </label>
                <input
                  id="custom-pack-name"
                  value={customPackName}
                  onChange={(event) => setCustomPackName(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="custom-pack-pattern">
                  Right-hand preset
                </label>
                <select
                  id="custom-pack-pattern"
                  value={customPackPattern}
                  onChange={(event) => setCustomPackPattern(event.target.value)}
                >
                  {RIGHT_HAND_PATTERNS.map((pattern) => (
                    <option key={pattern} value={pattern}>
                      {pattern}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn primary" type="button" onClick={saveCurrentCustomPack}>
                Save current practice set
              </button>
            </div>
          </div>

          {(favoriteEntries.length > 0 || recentEntries.length > 0) && (
            <div className="library-quicklists">
              {favoriteEntries.length > 0 && (
                <div>
                  <span className="label">Favorites</span>
                  <div className="variant-list">
                    {favoriteEntries.slice(0, 6).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="chip"
                        onClick={() => jumpToChord(entry.id)}
                      >
                        {entry.chord.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {recentEntries.length > 0 && (
                <div>
                  <span className="label">Recent</span>
                  <div className="variant-list">
                    {recentEntries.slice(0, 6).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="chip"
                        onClick={() => jumpToChord(entry.id)}
                      >
                        {entry.chord.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedLibraryEntry ? (
          <div className="library-results">
            <div className="library-actions">
              <div>
                <span className="library-label">
                  {filteredLibraryEntries.length} matching voicing
                  {filteredLibraryEntries.length === 1 ? "" : "s"} • each variant has its own chart
                </span>
                <div className="variant-list">
                  {filteredLibraryEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`chip ${entry.id === selectedLibraryEntry.id ? "active" : ""}`}
                      onClick={() => setSelectedLibraryId(entry.id)}
                    >
                      {entry.chord.name} • {entry.position}
                    </button>
                  ))}
                </div>
              </div>
              <div className="library-preview-buttons">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => playChordPreview(selectedLibraryEntry.chord, "strum")}
                >
                  Play strum
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => playChordPreview(selectedLibraryEntry.chord, "arpeggio")}
                >
                  Play arpeggio
                </button>
                <button
                  className={`btn ${favoriteSet.has(selectedLibraryEntry.id) ? "primary" : ""}`}
                  type="button"
                  onClick={() => toggleFavorite(selectedLibraryEntry.id)}
                >
                  {favoriteSet.has(selectedLibraryEntry.id) ? "Favorited" : "Add favorite"}
                </button>
              </div>
            </div>

            <div className="comparison-grid">
              <article className="library-inspector">
                <div className="library-inspector-header">
                  <div>
                    <span className="label">Primary voicing</span>
                    <h3>{selectedLibraryEntry.chord.name}</h3>
                    <p>{selectedLibraryEntry.summary}</p>
                  </div>
                  <div className="diagram-wrap chord-chart-panel" aria-label="Selected chord chart">
                    <span className="label">Chord chart</span>
                    <ChordDiagram chord={selectedLibraryEntry.chord} />
                  </div>
                </div>
                <div className="library-tag-row">
                  {selectedLibraryEntry.difficultyTags.map((tag) => (
                    <span key={tag} className="meta-chip">
                      {tag}
                    </span>
                  ))}
                  {selectedLibraryEntry.functionContexts.map((context) => (
                    <span key={`${context.key}-${context.roles.join("-")}`} className="meta-chip">
                      {context.key}: {context.roles.join("/")}
                    </span>
                  ))}
                </div>
                <div className="library-focus-grid">
                  <div className="library-detail-card">
                    <span className="label">Practice timer</span>
                    <h4>
                      {Math.floor(selectedPracticeStats.seconds / 60)}:
                      {String(selectedPracticeStats.seconds % 60).padStart(2, "0")}
                    </h4>
                    <p className="muted">{selectedPracticeStats.reps} focused reps logged.</p>
                    <div className="chip-row">
                      <button
                        className={`btn ${activeTimerId === selectedLibraryEntry.id ? "primary" : ""}`}
                        type="button"
                        onClick={() =>
                          setActiveTimerId((current) =>
                            current === selectedLibraryEntry.id ? null : selectedLibraryEntry.id
                          )
                        }
                      >
                        {activeTimerId === selectedLibraryEntry.id ? "Pause timer" : "Start timer"}
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => addPracticeRep(selectedLibraryEntry.id)}
                      >
                        Log rep
                      </button>
                    </div>
                    <div className="chip-row">
                      <button className="chip" type="button" onClick={() => scheduleReview(selectedLibraryEntry.id, "again")}>
                        Again
                      </button>
                      <button className="chip" type="button" onClick={() => scheduleReview(selectedLibraryEntry.id, "good")}>
                        Good
                      </button>
                      <button className="chip" type="button" onClick={() => scheduleReview(selectedLibraryEntry.id, "easy")}>
                        Easy
                      </button>
                    </div>
                    <p className="muted">
                      Next review:{" "}
                      {selectedPracticeStats.nextReviewAt
                        ? new Date(selectedPracticeStats.nextReviewAt).toLocaleString()
                        : "Rate this voicing to schedule it."}
                    </p>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Difficulty progression</span>
                    <h4>Score {selectedDifficultyScore}/8</h4>
                    <p>
                      Next family:{" "}
                      {recommendation ? (
                        <button
                          className="inline-link"
                          type="button"
                          onClick={() => jumpToChord(recommendation.id)}
                        >
                          {recommendation.chord.name} • {recommendation.position}
                        </button>
                      ) : (
                        "All current families have practice logged."
                      )}
                    </p>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Why this voicing works</span>
                    {selectedTheory ? (
                      <>
                        <p>Scale degrees: {selectedTheory.degrees}</p>
                        <p>Bass note: {selectedTheory.bass}</p>
                        <p>{selectedTheory.voiceLeading}</p>
                        <p className="muted">Open strings: {selectedTheory.openStrings}</p>
                      </>
                    ) : null}
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Song examples</span>
                    {selectedSongExamples.length > 0 ? (
                      <ul>
                        {selectedSongExamples.map((example) => (
                          <li key={example.family}>
                            {example.title} • {example.context}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Try this voicing anywhere the function tags match the song key.</p>
                    )}
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Tuning-aware notes</span>
                    <p>{selectedTuning.label}: {getChordNoteNames(selectedLibraryEntry.chord, selectedTuning).join(" ")}</p>
                    <p className="muted">The diagram keeps the physical fret shape; this panel shows sounding notes for the selected tuning.</p>
                  </div>
                  <div className="library-detail-card">
                    <label className="label" htmlFor="user-voicing-note">
                      User notes
                    </label>
                    <textarea
                      id="user-voicing-note"
                      value={selectedUserNote}
                      onChange={(event) =>
                        updateUserNote(selectedLibraryEntry.id, event.target.value)
                      }
                      placeholder="Mark what feels best on your instrument..."
                    />
                  </div>
                </div>
                <div className="library-detail-grid">
                  <div className="library-detail-card">
                    <span className="label">Recommended fingering</span>
                    <p>{selectedLibraryEntry.recommendedVariant}</p>
                    <p>
                      Frets:{" "}
                      {selectedLibraryEntry.chord.frets
                        .map((fret) => (fret < 0 ? "X" : fret === 0 ? "O" : fret))
                        .join(" ")}
                    </p>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Recommended variants</span>
                    <ul>
                      {selectedLibraryEntry.alternateFingerings.map((variant) => (
                        <li key={variant}>{variant}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Left-hand muting notes</span>
                    <ul>
                      {selectedLibraryEntry.mutingNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Avoid this string</span>
                    <ul>
                      {selectedLibraryEntry.avoidStrings.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Common mistakes</span>
                    <ul>
                      {getCommonMistakes(selectedLibraryEntry).map((mistake) => (
                        <li key={mistake}>{mistake}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Practice focus</span>
                    <p>{selectedLibraryEntry.practiceFocus}</p>
                  </div>
                  <div className="library-detail-card">
                    <span className="label">Musical function</span>
                    <ul>
                      {selectedLibraryEntry.functionContexts.map((context) => (
                        <li key={`${context.key}-${context.roles.join("-")}`}>
                          {context.key}: {context.roles.join("/")} • {context.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>

              <aside className="library-compare">
                <div className="library-compare-header">
                  <div>
                    <span className="label">Comparison mode</span>
                    <h3>{compareEntry ? compareEntry.chord.name : "Add a second voicing"}</h3>
                  </div>
                  <div className="compare-selects">
                    <select
                      value={compareChordId}
                      onChange={(event) => setCompareChordId(event.target.value)}
                    >
                      {comparisonCandidates.length === 0 ? (
                        <option value="">No comparison voicings</option>
                      ) : (
                        comparisonCandidates.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.chord.name} • {entry.position}
                          </option>
                        ))
                      )}
                    </select>
                    <select
                      value={thirdCompareChordId}
                      onChange={(event) => setThirdCompareChordId(event.target.value)}
                    >
                      {comparisonCandidates.length === 0 ? (
                        <option value="">No third voicing</option>
                      ) : (
                        comparisonCandidates.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.chord.name} • {entry.position}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
                {compareEntry ? (
                  <>
                    <div className="diagram-wrap">
                      <ChordDiagram chord={compareEntry.chord} />
                    </div>
                    <p>{compareEntry.summary}</p>
                    <div className="library-compare-actions">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => playChordPreview(compareEntry.chord, "strum")}
                      >
                        Compare strum
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => jumpToChord(compareEntry.id)}
                      >
                        Make primary
                      </button>
                    </div>
                    <div className="library-detail-card">
                      <span className="label">Why compare it</span>
                      <p>{compareEntry.practiceFocus}</p>
                    </div>
                    {thirdCompareEntry ? (
                      <div className="library-detail-card">
                        <span className="label">Third voicing</span>
                        <h3>{thirdCompareEntry.chord.name}</h3>
                        <div className="diagram-wrap">
                          <ChordDiagram chord={thirdCompareEntry.chord} />
                        </div>
                        <p>{thirdCompareEntry.summary}</p>
                      </div>
                    ) : null}
                    <button className="btn primary" type="button" onClick={() => window.print()}>
                      Print compare sheet
                    </button>
                  </>
                ) : (
                  <div className="history-empty">Pick another voicing to compare shapes side by side.</div>
                )}
              </aside>
            </div>

            <div className="library-heatmap">
              <div>
                <span className="label">Shared-note fretboard heatmap</span>
                <p>
                  Compare the selected voicing against the comparison voicing in {selectedTuning.label}.
                </p>
              </div>
              <div className="heatmap-grid" aria-label="Fretboard shared-note heatmap">
                {heatmapNotes.map((cell) => (
                  <span
                    key={cell.key}
                    className={`heatmap-cell ${cell.state}`}
                    title={`${selectedTuning.strings[cell.stringIndex]} string fret ${cell.fret}: ${cell.note}`}
                  >
                    {cell.fret === 0 ? selectedTuning.strings[cell.stringIndex] : cell.note}
                  </span>
                ))}
              </div>
              <div className="heatmap-legend">
                <span><b className="legend-dot primary" /> Primary</span>
                <span><b className="legend-dot comparison" /> Comparison</span>
                <span><b className="legend-dot shared" /> Shared</span>
              </div>
            </div>

            <div className="print-compare-sheet">
              {[selectedLibraryEntry, compareEntry, thirdCompareEntry]
                .filter((entry): entry is ChordLibraryItem => Boolean(entry))
                .map((entry) => (
                  <article key={`print-${entry.id}`} className="print-compare-card">
                    <h3>{entry.chord.name}</h3>
                    <p>{entry.position}</p>
                    <ChordDiagram chord={entry.chord} />
                    <p>{entry.recommendedVariant}</p>
                  </article>
                ))}
            </div>

            <div className="library-nearby">
              <div>
                <span className="label">Nearby alternatives</span>
                <p>Jump to easier voicings, capo ideas, and partial-shape options.</p>
              </div>
              <div className="library-nearby-grid">
                {selectedLibraryEntry.nearbyAlternatives.map((alternative) => (
                  <div key={`${selectedLibraryEntry.id}-${alternative.label}`} className="library-detail-card">
                    <span className="label">
                      {alternative.type} • {alternative.label}
                    </span>
                    <p>{alternative.description}</p>
                    {alternative.targetId ? (
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => jumpToChord(alternative.targetId!)}
                      >
                        Jump there
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {selectedPack ? (
              <div className="library-pack-detail">
                <span className="label">Active pack</span>
                <h3>{selectedPack.title}</h3>
                <p>{selectedPack.focus}</p>
                <div className="variant-list">
                  {selectedPack.chordIds.map((id) => {
                    const entry = CHORD_ITEM_LOOKUP.get(id);
                    if (!entry) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`chip ${entry.id === selectedLibraryEntry.id ? "active" : ""}`}
                        onClick={() => jumpToChord(entry.id)}
                      >
                        {entry.chord.name}
                      </button>
                    );
                  })}
                </div>
                <p className="muted">Suggested progression: {selectedPack.progression.join(" • ")}</p>
                <p className="muted">Right-hand preset: {selectedPack.rightHandPattern}</p>
              </div>
            ) : null}

            <div className="teacher-export">
              <div className="library-pack-header">
                <div>
                  <span className="label">Teacher / PDF export</span>
                  <p>Build a printable practice sheet by key, difficulty, or progression pack.</p>
                </div>
                <button className="btn primary" type="button" onClick={() => window.print()}>
                  Print or save PDF
                </button>
              </div>
              <div className="chip-row">
                <button className="btn" type="button" onClick={exportTeacherPacks}>Export teacher packs</button>
                <label className="btn ghost" htmlFor="teacher-pack-import">Import teacher packs</label>
                <input
                  id="teacher-pack-import"
                  type="file"
                  accept="application/json,.json"
                  className="visually-hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importTeacherPacks(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="library-filters">
                <div>
                  <label className="label" htmlFor="teacher-key">Key</label>
                  <select id="teacher-key" value={teacherKey} onChange={(event) => setTeacherKey(event.target.value)}>
                    {CHORD_FUNCTION_KEYS.map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="teacher-skill">Skill</label>
                  <select
                    id="teacher-skill"
                    value={teacherSkill}
                    onChange={(event) => setTeacherSkill(event.target.value as "all" | DifficultyTag)}
                  >
                    <option value="all">All skills</option>
                    {CHORD_DIFFICULTY_TAGS.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="teacher-pack">Pack</label>
                  <select id="teacher-pack" value={teacherPackId} onChange={(event) => setTeacherPackId(event.target.value)}>
                    <option value="all">No pack filter</option>
                    {allProgressionPacks.map((pack) => (
                      <option key={pack.id} value={pack.id}>{pack.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="teacher-sheet-grid">
                {teacherSheetEntries.map((entry) => (
                  <article key={`teacher-${entry.id}`} className="teacher-sheet-card">
                    <h3>{entry.chord.name}</h3>
                    <ChordDiagram chord={entry.chord} />
                    <p>{entry.position}</p>
                    <p className="muted">{entry.practiceFocus}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="history-empty">
            No voicings match this filter set yet. Try clearing the progression pack, search, or
            difficulty tag.
          </div>
        )}
      </div>
    </section>
  );
}
