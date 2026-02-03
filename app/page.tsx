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

type Song = {
  title: string;
  source: string;
  difficulty: "easy" | "medium";
  tempoMs: number;
  chords: string[];
};

const SONGS: Song[] = [
  {
    title: "Amazing Grace",
    source: "Public domain hymn",
    difficulty: "easy",
    tempoMs: 2200,
    chords: ["G", "C", "G", "D", "G", "Em", "G", "D", "G"]
  },
  {
    title: "Oh! Susanna",
    source: "Public domain folk",
    difficulty: "easy",
    tempoMs: 2000,
    chords: ["C", "F", "C", "G", "C", "F", "C", "G", "C"]
  },
  {
    title: "This Little Light of Mine",
    source: "Traditional spiritual",
    difficulty: "easy",
    tempoMs: 1900,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"]
  },
  {
    title: "Scarborough Fair",
    source: "Traditional English ballad",
    difficulty: "medium",
    tempoMs: 2100,
    chords: ["Am", "C", "Am", "G", "Am", "C", "Am", "Em"]
  },
  {
    title: "Greensleeves",
    source: "Traditional English folk",
    difficulty: "medium",
    tempoMs: 2000,
    chords: ["Am", "G", "F", "E", "Am", "C", "G", "E", "Am"]
  },
  {
    title: "When the Saints Go Marching In",
    source: "Traditional jazz standard",
    difficulty: "easy",
    tempoMs: 1900,
    chords: ["C", "F", "C", "G", "C", "F", "C", "G", "C"]
  },
  {
    title: "House of the Rising Sun (Trad.)",
    source: "Traditional folk",
    difficulty: "medium",
    tempoMs: 2300,
    chords: ["Am", "C", "D", "F", "Am", "C", "E", "E"]
  }
];

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
  const [songIndex, setSongIndex] = useState(0);
  const [songStep, setSongStep] = useState(0);
  const [songStatus, setSongStatus] = useState<"idle" | "running" | "paused">("idle");
  const [metronomeOn, setMetronomeOn] = useState(true);

  const countRef = useRef(0);
  const historyRef = useRef<Chord[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextChangeAt = useRef<number | null>(null);
  const songTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const activeLevelIndex = difficultyMode === "auto" ? levelIndex : manualLevelIndex;
  const activeLevel = LEVELS[activeLevelIndex];
  const selectedLibraryChord = CHORD_LIBRARY.find((chord) => chord.name === libraryChordName) ?? null;
  const activeSong = SONGS[songIndex];
  const currentSongChordName = activeSong.chords[Math.min(songStep, activeSong.chords.length - 1)];
  const currentSongChord =
    CHORD_LIBRARY.find((chord) => chord.name === currentSongChordName) ?? null;

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
    if (!metronomeOn) return null;
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
    if (songStatus !== "running") return;
    if (songTimer.current) {
      clearInterval(songTimer.current);
    }
    songTimer.current = setInterval(() => {
      setSongStep((prev) => {
        const next = prev + 1;
        if (next >= activeSong.chords.length) {
          setSongStatus("paused");
          return prev;
        }
        return next;
      });
    }, activeSong.tempoMs);
    return () => {
      if (songTimer.current) {
        clearInterval(songTimer.current);
      }
    };
  }, [activeSong.chords.length, activeSong.tempoMs, songStatus]);

  useEffect(() => {
    if (!metronomeOn) return;
    if (songStatus === "running") {
      playClick(700);
    }
  }, [metronomeOn, songStatus, songStep]);

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
    setSongStatus("running");
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
          <h1>Switch faster. Play cleaner.</h1>
          <p>
            Train your hands with a 3‑second chord flash. Ten chords per round, then level up and
            graduate to barre shapes.
          </p>
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

      <section className="library">
        <div>
          <h2>Chord library</h2>
          <p>Select any chord and review the fingering.</p>
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
              {CHORD_LIBRARY.map((chord) => (
                <option key={chord.name} value={chord.name}>
                  {chord.name}
                </option>
              ))}
            </select>
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
                setSongIndex(Number(event.target.value));
                setSongStep(0);
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
            <div className="song-controls">
              <button className="btn primary" onClick={handleSongStart}>
                Start lesson
              </button>
              <button
                className="btn"
                onClick={() => setSongStatus("paused")}
                disabled={songStatus !== "running"}
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
                  setSongStatus("idle");
                }}
              >
                Reset
              </button>
            </div>
          </div>
          <div className="song-progress">
            <span className="label">Current chord</span>
            <h3>{currentSongChordName}</h3>
            <p>
              Step {Math.min(songStep + 1, activeSong.chords.length)} of {activeSong.chords.length}
            </p>
            <div className="diagram-wrap">
              {currentSongChord ? <ChordDiagram chord={currentSongChord} /> : <div className="diagram-empty" />}
            </div>
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
