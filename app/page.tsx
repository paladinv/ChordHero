"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram, { Chord } from "../components/ChordDiagram";

const MAX_CHORDS = 10;
const INTERVAL_MS = 3000;
const FLASH_MS = 650;

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

  const countRef = useRef(0);
  const historyRef = useRef<Chord[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeLevelIndex = difficultyMode === "auto" ? levelIndex : manualLevelIndex;
  const activeLevel = LEVELS[activeLevelIndex];

  const progressLabel = `${Math.min(count, MAX_CHORDS)}/${MAX_CHORDS}`;

  const resetRound = () => {
    countRef.current = 0;
    historyRef.current = [];
    setCount(0);
    setHistory([]);
    setCurrentChord(null);
  };

  const startRound = (nextLevelIndex?: number) => {
    if (typeof nextLevelIndex === "number") {
      setLevelIndex(nextLevelIndex);
    }
    resetRound();
    setStatus("running");
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
    return () => {
      if (flashTimeout.current) {
        clearTimeout(flashTimeout.current);
      }
    };
  }, []);

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
              onClick={() => startRound()}
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
              <div key={`${chord.name}-${index}`} className="history-item">
                <span className="history-count">{String(index + 1).padStart(2, "0")}</span>
                <span className="history-name">{chord.name}</span>
              </div>
            ))
          )}
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
