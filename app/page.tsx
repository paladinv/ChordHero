"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram, { Chord } from "../components/ChordDiagram";

const MAX_CHORDS = 10;
const INTERVAL_MS = 3000;
const FLASH_MS = 650;
const COUNTDOWN_TICK_MS = 120;

type Level = {
  name: string;
  description: string;
  chords: Chord[];
};

type ChordAlternative = {
  label: string;
  chord: Chord;
};

type ChordLibraryEntry = {
  name: string;
  chord: Chord;
  alternatives: ChordAlternative[];
};

const LEVELS: Level[] = [
  {
    name: "Open Chords",
    description: "Comfortable open shapes to build speed.",
    chords: [
      { name: "C", frets: [-1, 3, 2, 0, 1, 0] },
      { name: "G", frets: [3, 2, 0, 0, 0, 3] },
      { name: "D", frets: [-1, -1, 0, 2, 3, 2] },
      { name: "Em", frets: [0, 2, 2, 0, 0, 0] },
      { name: "Am", frets: [-1, 0, 2, 2, 1, 0] },
      { name: "E", frets: [0, 2, 2, 1, 0, 0] },
      { name: "A", frets: [-1, 0, 2, 2, 2, 0] }
    ]
  },
  {
    name: "Open + Spice",
    description: "Add sus and dominant flavors for quicker switches.",
    chords: [
      { name: "Cadd9", frets: [-1, 3, 2, 0, 3, 0] },
      { name: "Dsus4", frets: [-1, -1, 0, 2, 3, 3] },
      { name: "G", frets: [3, 2, 0, 0, 0, 3] },
      { name: "Em7", frets: [0, 2, 0, 0, 0, 0] },
      { name: "Am7", frets: [-1, 0, 2, 0, 1, 0] },
      { name: "E7", frets: [0, 2, 0, 1, 0, 0] },
      { name: "D", frets: [-1, -1, 0, 2, 3, 2] }
    ]
  },
  {
    name: "Barre Chords",
    description: "Full grip shapes for strength and clarity.",
    chords: [
      { name: "F", frets: [1, 3, 3, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
      { name: "Bm", frets: [-1, 2, 4, 4, 3, 2], barre: { fret: 2, from: 1, to: 5 } },
      { name: "Bb", frets: [1, 3, 3, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
      { name: "Gm", frets: [3, 5, 5, 3, 3, 3], barre: { fret: 3, from: 0, to: 5 } },
      { name: "C#m", frets: [-1, 4, 6, 6, 5, 4], barre: { fret: 4, from: 1, to: 5 } },
      { name: "F#", frets: [2, 4, 4, 3, 2, 2], barre: { fret: 2, from: 0, to: 5 } }
    ]
  },
  {
    name: "Inversions",
    description: "Slash chords to sharpen bass movement.",
    chords: [
      { name: "C/G", frets: [3, 3, 2, 0, 1, 0] },
      { name: "G/B", frets: [-1, 2, 0, 0, 0, 3] },
      { name: "D/F#", frets: [2, 0, 0, 2, 3, 2] },
      { name: "Am/C", frets: [-1, 3, 2, 2, 1, 0] },
      { name: "Em/B", frets: [-1, 2, 2, 0, 0, 0] },
      { name: "F/A", frets: [-1, 0, 3, 2, 1, 1] }
    ]
  }
];

const CHORD_LIBRARY: Chord[] = Array.from(
  new Map(LEVELS.flatMap((level) => level.chords).map((chord) => [chord.name, chord])).values()
);

const createShiftedChord = (chord: Chord, shift: number, label: string): ChordAlternative => ({
  label,
  chord: {
    ...chord,
    name: `${chord.name} +${shift}`,
    frets: chord.frets.map((fret) => (fret > 0 ? fret + shift : fret)),
    barre: chord.barre ? { ...chord.barre, fret: chord.barre.fret + shift } : undefined
  }
});

const CHORD_LIBRARY_ENTRIES: ChordLibraryEntry[] = CHORD_LIBRARY.map((chord) => ({
  name: chord.name,
  chord,
  alternatives: [
    createShiftedChord(chord, 2, "Up the neck (+2)"),
    createShiftedChord(chord, 4, "Higher voicing (+4)")
  ]
}));

type Song = {
  title: string;
  source: string;
  difficulty: "easy" | "medium";
  bpm: number;
  chords: string[];
  strumPattern: string;
  strumFeel: string;
};

const SONGS: Song[] = [
  {
    title: "Amazing Grace",
    source: "Public domain hymn",
    difficulty: "easy",
    bpm: 80,
    chords: ["G", "C", "G", "D", "G", "Em", "G", "D", "G"],
    strumPattern: "D - D - D - D -",
    strumFeel: "Slow 4/4, let the chords ring."
  },
  {
    title: "Oh! Susanna",
    source: "Public domain folk",
    difficulty: "easy",
    bpm: 92,
    chords: ["C", "F", "C", "G", "C", "F", "C", "G", "C"],
    strumPattern: "D D U U D U",
    strumFeel: "Classic pop feel at 8th notes."
  },
  {
    title: "This Little Light of Mine",
    source: "Traditional spiritual",
    difficulty: "easy",
    bpm: 96,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D - D U - U D U",
    strumFeel: "Gospel swing; keep the upstrokes light."
  },
  {
    title: "Scarborough Fair",
    source: "Traditional English ballad",
    difficulty: "medium",
    bpm: 84,
    chords: ["Am", "C", "Am", "G", "Am", "C", "Am", "Em"],
    strumPattern: "D - D - D U - U",
    strumFeel: "Gentle folk ballad."
  },
  {
    title: "Greensleeves",
    source: "Traditional English folk",
    difficulty: "medium",
    bpm: 88,
    chords: ["Am", "G", "F", "E", "Am", "C", "G", "E", "Am"],
    strumPattern: "D - D U - U D U",
    strumFeel: "Waltz-like flow, keep the bass strong."
  },
  {
    title: "When the Saints Go Marching In",
    source: "Traditional jazz standard",
    difficulty: "easy",
    bpm: 100,
    chords: ["C", "F", "C", "G", "C", "F", "C", "G", "C"],
    strumPattern: "D D D D",
    strumFeel: "March feel, accent beats 1 and 3."
  },
  {
    title: "House of the Rising Sun (Trad.)",
    source: "Traditional folk",
    difficulty: "medium",
    bpm: 78,
    chords: ["Am", "C", "D", "F", "Am", "C", "E", "E"],
    strumPattern: "D - D - D U - U",
    strumFeel: "Slow arpeggiated vibe; strum softly."
  },
  {
    title: "Skip to My Lou",
    source: "Traditional American folk",
    difficulty: "easy",
    bpm: 104,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D D U U D U",
    strumFeel: "Bright, bouncy folk."
  },
  {
    title: "The Red River Valley",
    source: "Traditional folk",
    difficulty: "easy",
    bpm: 90,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D - D - D - D -",
    strumFeel: "Ballad timing, let chords ring."
  },
  {
    title: "Shenandoah",
    source: "Traditional folk",
    difficulty: "medium",
    bpm: 72,
    chords: ["G", "D", "Em", "C", "G", "D", "G"],
    strumPattern: "D - D - D U - U",
    strumFeel: "Slow, wide strums."
  },
  {
    title: "The Bear Went Over the Mountain",
    source: "Traditional folk",
    difficulty: "easy",
    bpm: 102,
    chords: ["C", "G", "C", "F", "C", "G", "C"],
    strumPattern: "D D U U D U",
    strumFeel: "Playful campfire groove."
  },
  {
    title: "Auld Lang Syne",
    source: "Traditional Scottish",
    difficulty: "medium",
    bpm: 80,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D - D - D - D -",
    strumFeel: "Slow, stately feel."
  }
];

const CHORD_TIPS: Record<
  string,
  { fingering: string; transition: string; commonMistake: string }
> = {
  C: {
    fingering: "Index on B1, middle on D2, ring on A3. Let high E ring.",
    transition: "Pivot your ring finger when moving between C and Am/F.",
    commonMistake: "Mute the high E string; keep it open."
  },
  G: {
    fingering: "Ring on low E3, middle on A2, pinky on high E3.",
    transition: "Keep ring/pinky planted when moving to D or Em.",
    commonMistake: "Letting the B string mute; curl your fingers."
  },
  D: {
    fingering: "Index on G2, ring on B3, middle on high E2.",
    transition: "Make a triangle shape and lift together for quick changes.",
    commonMistake: "Low strings ringing; mute low E/A."
  },
  Em: {
    fingering: "Middle on A2, ring on D2.",
    transition: "Slide from G by dropping the middle finger first.",
    commonMistake: "Pressing too hard; keep it relaxed."
  },
  Am: {
    fingering: "Index on B1, middle on D2, ring on G2.",
    transition: "From C, keep the index on B1 and pivot.",
    commonMistake: "B string muted; keep knuckles arched."
  },
  F: {
    fingering: "Barre at 1st fret, ring on A3, pinky on D3, middle on G2.",
    transition: "Practice mini‑barre on B/E first, then add bass.",
    commonMistake: "Buzzing on high strings; roll index slightly."
  },
  E: {
    fingering: "Index on G1, middle on A2, ring on D2.",
    transition: "Move as a block from Em (add index).",
    commonMistake: "Muted G string; keep index arched."
  },
  A: {
    fingering: "Index on D2, middle on G2, ring on B2.",
    transition: "Keep fingers compact to avoid muting high E.",
    commonMistake: "High E muted; angle fingers toward the nut."
  }
};

function pickChord(chords: Chord[], last?: Chord | null) {
  if (chords.length === 1) return chords[0];
  let next = chords[Math.floor(Math.random() * chords.length)];
  let safety = 0;
  while (last && next.name === last.name && safety < 10) {
    next = chords[Math.floor(Math.random() * chords.length)];
    safety += 1;
  }
  return next;
}

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
};

const noteToFrequency = (note: string, octave: number) => {
  const offset = NOTE_OFFSETS[note];
  if (offset === undefined) return null;
  const midi = 12 * (octave + 1) + offset;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

const getChordIntervals = (quality: string) => {
  const descriptor = quality.toLowerCase();
  if (descriptor.includes("sus2")) return [0, 2, 7];
  if (descriptor.includes("sus4")) return [0, 5, 7];
  if (descriptor.includes("add9")) return [0, 4, 7, 14];
  if (descriptor.includes("maj7")) return [0, 4, 7, 11];
  if (descriptor.includes("m7")) return [0, 3, 7, 10];
  if (descriptor.includes("m")) return [0, 3, 7];
  if (descriptor.includes("7")) return [0, 4, 7, 10];
  return [0, 4, 7];
};

const getChordFrequencies = (chordName: string) => {
  const [main, bass] = chordName.split("/");
  const rootMatch = main.match(/^([A-G](?:#|b)?)/);
  if (!rootMatch) return [];
  const rootNote = rootMatch[1];
  const quality = main.slice(rootNote.length);
  const intervals = getChordIntervals(quality);
  const rootFrequency = noteToFrequency(rootNote, 4);
  if (!rootFrequency) return [];
  const frequencies = intervals
    .map((interval) => rootFrequency * Math.pow(2, interval / 12))
    .filter((freq) => Number.isFinite(freq));
  if (bass) {
    const bassFrequency = noteToFrequency(bass, 3);
    if (bassFrequency) frequencies.unshift(bassFrequency);
  }
  return frequencies;
};

export default function HomePage() {
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "levelComplete">("idle");
  const [levelIndex, setLevelIndex] = useState(0);
  const [manualLevelIndex, setManualLevelIndex] = useState(0);
  const [difficultyMode, setDifficultyMode] = useState<"auto" | "manual">("auto");
  const [currentChord, setCurrentChord] = useState<Chord | null>(null);
  const [history, setHistory] = useState<Chord[]>([]);
  const [flash, setFlash] = useState(false);
  const [count, setCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [libraryChordName, setLibraryChordName] = useState(CHORD_LIBRARY[0]?.name ?? "");
  const [libraryVariantIndex, setLibraryVariantIndex] = useState(0);
  const [songIndex, setSongIndex] = useState(0);
  const [songStep, setSongStep] = useState(0);
  const [songStatus, setSongStatus] = useState<"idle" | "countin" | "running" | "paused">("idle");
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [songTempoBpm, setSongTempoBpm] = useState(SONGS[0]?.bpm ?? 90);
  const [songBeatsPerChord, setSongBeatsPerChord] = useState(4);
  const [songBeat, setSongBeat] = useState(0);
  const [songCountIn, setSongCountIn] = useState(4);

  const countRef = useRef(0);
  const historyRef = useRef<Chord[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextChangeAt = useRef<number | null>(null);
  const songTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const activeLevelIndex = difficultyMode === "auto" ? levelIndex : manualLevelIndex;
  const activeLevel = LEVELS[activeLevelIndex];
  const selectedLibraryEntry =
    CHORD_LIBRARY_ENTRIES.find((entry) => entry.name === libraryChordName) ?? null;
  const libraryVariants = useMemo(() => {
    if (!selectedLibraryEntry) return [];
    return [
      { label: "Primary shape", chord: selectedLibraryEntry.chord },
      ...selectedLibraryEntry.alternatives
    ];
  }, [selectedLibraryEntry]);
  const activeLibraryVariant = libraryVariants[libraryVariantIndex] ?? libraryVariants[0] ?? null;
  const selectedLibraryChord = activeLibraryVariant?.chord ?? null;
  const activeSong = SONGS[songIndex];
  const currentSongChordName = activeSong.chords[Math.min(songStep, activeSong.chords.length - 1)];
  const currentSongChord =
    CHORD_LIBRARY.find((chord) => chord.name === currentSongChordName) ?? null;
  const songTempoMs = Math.round(60000 / songTempoBpm);

  const progressLabel = `${Math.min(count, MAX_CHORDS)}/${MAX_CHORDS}`;

  const resetRound = () => {
    countRef.current = 0;
    historyRef.current = [];
    setCount(0);
    setHistory([]);
    setCurrentChord(null);
    setSelectedChord(null);
    setSelectedHistoryIndex(null);
    setSecondsLeft(0);
    nextChangeAt.current = null;
  };

  const startRound = (nextLevelIndex?: number) => {
    if (typeof nextLevelIndex === "number") {
      setLevelIndex(nextLevelIndex);
    }
    resetRound();
    setStatus("running");
  };

  const ensureAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playClick = async (frequency = 900) => {
    if (!metronomeOn) return;
    const ctx = await ensureAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
  };

  const playChordSample = async (chordName: string) => {
    const ctx = await ensureAudioContext();
    if (!ctx) return;
    const frequencies = getChordFrequencies(chordName);
    if (!frequencies.length) return;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(ctx.destination);
    masterGain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    frequencies.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      osc.connect(masterGain);
      osc.start(now + index * 0.02);
      osc.stop(now + 1.5);
    });
  };

  const advance = () => {
    if (countRef.current >= MAX_CHORDS) {
      return;
    }

    const lastChord = historyRef.current[historyRef.current.length - 1];
    const next = pickChord(activeLevel.chords, lastChord ?? null);

    setCurrentChord(next);
    setHistory((prev) => {
      const updated = [...prev, next];
      historyRef.current = updated;
      return updated;
    });

    setFlash(true);
    if (flashTimeout.current) {
      clearTimeout(flashTimeout.current);
    }
    flashTimeout.current = setTimeout(() => setFlash(false), FLASH_MS);

    countRef.current += 1;
    setCount(countRef.current);
    nextChangeAt.current = Date.now() + INTERVAL_MS;
    setSecondsLeft(Math.ceil(INTERVAL_MS / 1000));

    if (countRef.current >= MAX_CHORDS) {
      setStatus("levelComplete");
    }
  };

  useEffect(() => {
    if (status !== "running") return;

    advance();
    const id = setInterval(() => {
      advance();
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [status, activeLevelIndex]);

  useEffect(() => {
    if (status !== "running") {
      setSecondsLeft(0);
      return;
    }
    const id = setInterval(() => {
      if (!nextChangeAt.current) return;
      const msLeft = Math.max(0, nextChangeAt.current - Date.now());
      setSecondsLeft(Math.max(0, Math.ceil(msLeft / 1000)));
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (!metronomeOn) return;
    if (status === "running" && secondsLeft > 0) {
      playClick(secondsLeft === 1 ? 1200 : 900);
    }
  }, [metronomeOn, secondsLeft, status]);

  useEffect(() => {
    return () => {
      if (flashTimeout.current) {
        clearTimeout(flashTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (songStatus !== "running" && songStatus !== "countin") return;
    if (songTimer.current) {
      clearInterval(songTimer.current);
    }
    songTimer.current = setInterval(() => {
      if (songStatus === "countin") {
        setSongCountIn((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            setSongStatus("running");
            setSongBeat(0);
            return 0;
          }
          return next;
        });
        return;
      }
      setSongBeat((prevBeat) => {
        const nextBeat = prevBeat + 1;
        if (nextBeat >= songBeatsPerChord) {
          setSongStep((prevStep) => {
            const nextStep = prevStep + 1;
            if (nextStep >= activeSong.chords.length) {
              setSongStatus("paused");
              return prevStep;
            }
            return nextStep;
          });
          return 0;
        }
        return nextBeat;
      });
    }, songTempoMs);
    return () => {
      if (songTimer.current) {
        clearInterval(songTimer.current);
      }
    };
  }, [activeSong.chords.length, songBeatsPerChord, songStatus, songTempoMs]);

  useEffect(() => {
    if (!metronomeOn) return;
    if (songStatus === "running" || songStatus === "countin") {
      playClick(songBeat === 0 ? 900 : 700);
    }
  }, [metronomeOn, songStatus, songBeat]);

  useEffect(() => {
    setLibraryVariantIndex(0);
  }, [libraryChordName]);

  const handleContinue = () => {
    if (difficultyMode === "auto") {
      const nextIndex = Math.min(levelIndex + 1, LEVELS.length - 1);
      setLevelIndex(nextIndex);
      startRound(nextIndex);
      return;
    }
    startRound(manualLevelIndex);
  };

  const handlePause = () => {
    if (status === "running") {
      setStatus("paused");
    }
  };

  const handleResume = () => {
    if (status === "paused") {
      setStatus("running");
    }
  };

  const handleSelectHistory = (chord: Chord, index: number) => {
    setSelectedChord(chord);
    setSelectedHistoryIndex(index);
  };

  const handleSongStart = async () => {
    await ensureAudioContext();
    setSongStep(0);
    setSongBeat(0);
    setSongCountIn(4);
    setSongStatus("countin");
  };

  const levelTitle = useMemo(() => {
    if (difficultyMode === "manual") {
      return `Manual: ${activeLevel.name}`;
    }
    return `Level ${levelIndex + 1}: ${activeLevel.name}`;
  }, [activeLevel.name, difficultyMode, levelIndex]);

  return (
    <main className="page">
      <section className="hero">
        <div className="brand">
          <span className="tag">Chord Hero</span>
          <div className="hero-summary">
            <span>3s flashes</span>
            <span>10-chord rounds</span>
            <span>4 levels</span>
          </div>
          <p className="hero-note">Tap start, keep eyes forward, and ride the metronome click.</p>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{levelTitle}</p>
              <h2>{activeLevel.description}</h2>
            </div>
            <div className="status">
              <span className="badge">{progressLabel}</span>
              <span className={`badge ${status === "running" ? "live" : ""}`}>
                {status === "running" ? "Live" : status === "paused" ? "Paused" : "Ready"}
              </span>
              <span className="badge muted">
                {status === "running" ? `Next chord in ${secondsLeft}s` : "Timer ready"}
              </span>
            </div>
          </div>

          <div className={`chord-card ${flash ? "flash" : ""}`}>
            <div className="chord-info">
              <span className="label">Now playing</span>
              <h3>{currentChord ? currentChord.name : "Press start"}</h3>
              <p>3 seconds per chord • Focus on clean fingers and relaxed wrists.</p>
            </div>
            <div className="diagram-wrap">
              {currentChord ? <ChordDiagram chord={currentChord} /> : <div className="diagram-empty" />}
            </div>
          </div>

          <div className="controls">
            <button
              className="btn primary"
              onClick={async () => {
                await ensureAudioContext();
                startRound();
              }}
              disabled={status === "running"}
            >
              Start Round
            </button>
            <button className="btn" onClick={handlePause} disabled={status !== "running"}>
              Pause
            </button>
            <button className="btn" onClick={handleResume} disabled={status !== "paused"}>
              Resume
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setStatus("idle");
                resetRound();
              }}
            >
              Reset
            </button>
            <button
              className={`btn ${metronomeOn ? "primary" : ""}`}
              onClick={() => setMetronomeOn((prev) => !prev)}
            >
              {metronomeOn ? "Metronome on" : "Metronome off"}
            </button>
          </div>

          <div className="difficulty">
            <div className="toggle">
              <label>
                <input
                  type="radio"
                  name="difficulty"
                  value="auto"
                  checked={difficultyMode === "auto"}
                  onChange={() => setDifficultyMode("auto")}
                />
                Auto‑advance levels
              </label>
              <label>
                <input
                  type="radio"
                  name="difficulty"
                  value="manual"
                  checked={difficultyMode === "manual"}
                  onChange={() => setDifficultyMode("manual")}
                />
                Choose difficulty
              </label>
            </div>
            <select
              value={manualLevelIndex}
              onChange={(event) => setManualLevelIndex(Number(event.target.value))}
              disabled={difficultyMode === "auto"}
            >
              {LEVELS.map((level, index) => (
                <option key={level.name} value={index}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="history">
        <div>
          <h2>Chord history</h2>
          <p>Ten flashes per round. Keep your eyes ahead of your fingers.</p>
        </div>
        <div className="history-grid">
          {history.length === 0 ? (
            <div className="history-empty">No chords yet. Start a round to begin.</div>
          ) : (
            history.map((chord, index) => (
              <button
                key={`${chord.name}-${index}`}
                className={`history-item ${selectedHistoryIndex === index ? "active" : ""}`}
                type="button"
                onClick={() => handleSelectHistory(chord, index)}
              >
                <span className="history-count">{String(index + 1).padStart(2, "0")}</span>
                <span className="history-name">{chord.name}</span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="selected">
        <div>
          <h2>Selected chord</h2>
          <p>Click any chord from history to inspect it here.</p>
        </div>
        <div className="selected-card">
          <div className="selected-info">
            <span className="label">Selected</span>
            <h3>{selectedChord ? selectedChord.name : "None yet"}</h3>
            <p>Use this space to double-check your fingering before the next round.</p>
          </div>
          <div className="diagram-wrap">
            {selectedChord ? <ChordDiagram chord={selectedChord} /> : <div className="diagram-empty" />}
          </div>
        </div>
      </section>

      <section className="library">
        <div>
          <h2>Chord library</h2>
          <p>Pick a chord, explore alternate voicings, and tap to hear it.</p>
        </div>
        <div className="library-card">
          <div>
            <label className="label" htmlFor="chord-library">
              Choose a chord
            </label>
            <select
              id="chord-library"
              value={libraryChordName}
              onChange={(event) => setLibraryChordName(event.target.value)}
            >
              {CHORD_LIBRARY_ENTRIES.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </select>
            <div className="library-actions">
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  if (selectedLibraryEntry) {
                    playChordSample(selectedLibraryEntry.name);
                  }
                }}
              >
                Play sample
              </button>
              <span className="library-label">
                {activeLibraryVariant ? activeLibraryVariant.label : "Select a voicing"}
              </span>
            </div>
            {libraryVariants.length > 0 && (
              <div className="library-variants">
                <p className="label">Voicings</p>
                <div className="variant-list">
                  {libraryVariants.map((variant, index) => (
                    <button
                      key={variant.label}
                      type="button"
                      className={`chip ${index === libraryVariantIndex ? "active" : ""}`}
                      onClick={() => setLibraryVariantIndex(index)}
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedLibraryChord && (
              <div className="fingering">
                <p className="label">How to press</p>
                <p>
                  Strings: E A D G B e
                </p>
                <p>
                  Frets:{" "}
                  {selectedLibraryChord.frets
                    .map((fret) => (fret < 0 ? "X" : fret === 0 ? "O" : fret))
                    .join(" ")}
                </p>
              </div>
            )}
          </div>
          <div className="diagram-wrap">
            {selectedLibraryChord ? (
              <ChordDiagram chord={selectedLibraryChord} />
            ) : (
              <div className="diagram-empty" />
            )}
          </div>
        </div>
      </section>

      <section className="song-coach">
        <div>
          <h2>Song coach</h2>
          <p>Learn public domain songs by looping the chord progression.</p>
        </div>
        <div className="song-card">
          <div className="song-meta">
            <label className="label" htmlFor="song-select">
              Choose a song
            </label>
            <select
              id="song-select"
              value={songIndex}
              onChange={(event) => {
                const nextIndex = Number(event.target.value);
                setSongIndex(nextIndex);
                setSongTempoBpm(SONGS[nextIndex]?.bpm ?? 90);
                setSongStep(0);
                setSongBeat(0);
                setSongCountIn(4);
                setSongStatus("idle");
              }}
            >
              {SONGS.map((song, index) => (
                <option key={song.title} value={index}>
                  {song.title} • {song.difficulty}
                </option>
              ))}
            </select>
            <p className="song-source">{activeSong.source}</p>
            <div className="tempo-control">
              <label className="label" htmlFor="song-tempo">
                Tempo: {songTempoBpm} BPM
              </label>
              <input
                id="song-tempo"
                type="range"
                min={60}
                max={140}
                step={2}
                value={songTempoBpm}
                onChange={(event) => setSongTempoBpm(Number(event.target.value))}
              />
            </div>
            <div className="beats-control">
              <span className="label">Beats per chord</span>
              <div className="chip-row">
                {[2, 4, 6].map((beats) => (
                  <button
                    key={beats}
                    type="button"
                    className={`chip ${songBeatsPerChord === beats ? "active" : ""}`}
                    onClick={() => setSongBeatsPerChord(beats)}
                  >
                    {beats} beats
                  </button>
                ))}
              </div>
            </div>
            <div className="song-controls">
              <button className="btn primary" onClick={handleSongStart}>
                Start lesson
              </button>
              <button
                className="btn"
                onClick={() => setSongStatus("paused")}
                disabled={songStatus !== "running" && songStatus !== "countin"}
              >
                Pause
              </button>
              <button
                className="btn"
                onClick={() => setSongStatus("running")}
                disabled={songStatus !== "paused"}
              >
                Resume
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setSongStep(0);
                  setSongBeat(0);
                  setSongCountIn(4);
                  setSongStatus("idle");
                }}
              >
                Reset
              </button>
            </div>
            <div className="song-guidance">
              <div className="song-guidance-card">
                <span className="label">Strumming pattern</span>
                <p className="strum-pattern">{activeSong.strumPattern}</p>
                <p className="muted">{activeSong.strumFeel}</p>
              </div>
              <div className="song-guidance-card">
                <span className="label">Count-in</span>
                <p className="muted">4 clicks before we start. Tap start, then get ready.</p>
              </div>
            </div>
          </div>
          <div className="song-progress">
            <span className="label">Current chord</span>
            <h3>{currentSongChordName}</h3>
            <p>
              Step {Math.min(songStep + 1, activeSong.chords.length)} of {activeSong.chords.length} •
              Beat {songBeat + 1} of {songBeatsPerChord}
            </p>
            {songStatus === "countin" && (
              <div className="count-in">
                <span className="label">Count-in</span>
                <p>Starting in {songCountIn}...</p>
              </div>
            )}
            <div className="diagram-wrap">
              {currentSongChord ? <ChordDiagram chord={currentSongChord} /> : <div className="diagram-empty" />}
            </div>
            {CHORD_TIPS[currentSongChordName] && (
              <div className="song-tip">
                <span className="label">Chord tips</span>
                <p>
                  <strong>Fingering:</strong> {CHORD_TIPS[currentSongChordName].fingering}
                </p>
                <p>
                  <strong>Transition:</strong> {CHORD_TIPS[currentSongChordName].transition}
                </p>
                <p>
                  <strong>Common mistake:</strong> {CHORD_TIPS[currentSongChordName].commonMistake}
                </p>
              </div>
            )}
            <div className="song-chords">
              {activeSong.chords.map((chord, index) => (
                <span
                  key={`${chord}-${index}`}
                  className={`song-chip ${index === songStep ? "active" : ""}`}
                >
                  {chord}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {status === "levelComplete" && (
        <div className="modal">
          <div className="modal-card">
            <span className="modal-badge">Achievement Unlocked</span>
            <h2>Level complete</h2>
            <p>
              You nailed {MAX_CHORDS} chord switches. Take a breath, then level up to keep building
              speed.
            </p>
            <div className="modal-actions">
              <button className="btn primary" onClick={handleContinue}>
                Advance level
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  setStatus("idle");
                  resetRound();
                }}
              >
                Stop here
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
