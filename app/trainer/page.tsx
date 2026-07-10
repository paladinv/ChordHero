"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram, { Chord } from "../../components/ChordDiagram";
import { LEVELS } from "../../lib/chords";

const MAX_CHORDS = 10;
const INTERVAL_MS = 3000;
const FLASH_MS = 650;
const COUNTDOWN_TICK_MS = 120;

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

export default function TrainerPage() {
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
  const [metronomeOn, setMetronomeOn] = useState(true);

  const countRef = useRef(0);
  const historyRef = useRef<Chord[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextChangeAt = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const activeLevelIndex = difficultyMode === "auto" ? levelIndex : manualLevelIndex;
  const activeLevel = LEVELS[activeLevelIndex];
  const progressLabel = `${Math.min(count, MAX_CHORDS)}/${MAX_CHORDS}`;

  const resetRound = useCallback(() => {
    countRef.current = 0;
    historyRef.current = [];
    setCount(0);
    setHistory([]);
    setCurrentChord(null);
    setSelectedChord(null);
    setSelectedHistoryIndex(null);
    setSecondsLeft(0);
    nextChangeAt.current = null;
  }, []);

  const startRound = useCallback((nextLevelIndex?: number) => {
    if (typeof nextLevelIndex === "number") {
      setLevelIndex(nextLevelIndex);
    }
    resetRound();
    setStatus("running");
  }, [resetRound]);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playClick = useCallback(async (frequency = 900) => {
    if (!metronomeOn) return;
    const ctx = await ensureAudioContext();
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
  }, [ensureAudioContext, metronomeOn]);

  const advance = useCallback(() => {
    if (countRef.current >= MAX_CHORDS) return;

    const lastChord = historyRef.current[historyRef.current.length - 1];
    const next = pickChord(activeLevel.chords, lastChord ?? null);

    setCurrentChord(next);
    setHistory((previous) => {
      const updated = [...previous, next];
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
  }, [activeLevel.chords]);

  useEffect(() => {
    if (status !== "running") return;

    advance();
    const id = setInterval(() => {
      advance();
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [advance, status, activeLevelIndex]);

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
  }, [metronomeOn, playClick, secondsLeft, status]);

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

  const levelTitle = useMemo(() => {
    if (difficultyMode === "manual") {
      return `Manual: ${activeLevel.name}`;
    }
    return `Level ${levelIndex + 1}: ${activeLevel.name}`;
  }, [activeLevel.name, difficultyMode, levelIndex]);

  return (
    <main className="page focused-page trainer-page">
      <section className="hero trainer-hero">
        <div className="brand">
          <span className="tag">Trainer</span>
          <h1>Timed chord switches without the page clutter.</h1>
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
              <p>3 seconds per chord. Focus on clean fingers and relaxed wrists.</p>
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
            <button className="btn" onClick={() => setStatus("paused")} disabled={status !== "running"}>
              Pause
            </button>
            <button className="btn" onClick={() => setStatus("running")} disabled={status !== "paused"}>
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
              onClick={() => setMetronomeOn((previous) => !previous)}
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
                Auto-advance levels
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

      <section className="trainer-review-grid">
        <div className="history">
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
                  onClick={() => {
                    setSelectedChord(chord);
                    setSelectedHistoryIndex(index);
                  }}
                >
                  <span className="history-count">{String(index + 1).padStart(2, "0")}</span>
                  <span className="history-name">{chord.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="selected">
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
