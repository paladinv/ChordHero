"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DIFFICULTY_DETAILS,
  RIGHT_HAND_EXERCISES,
  TECHNIQUE_DETAILS,
  RightHandDifficulty,
  RightHandExercise,
  RightHandTechnique
} from "../../lib/rightHandExercises";

const TECHNIQUES = Object.keys(TECHNIQUE_DETAILS) as RightHandTechnique[];
const DIFFICULTIES = Object.keys(DIFFICULTY_DETAILS) as RightHandDifficulty[];

function describeStep(step: string, technique: RightHandTechnique) {
  const accent = step.endsWith("!");
  const clean = step.replace("!", "");
  if (clean === "·") return { main: "—", detail: "rest", accent, rest: true };
  if (clean === "X") return { main: "×", detail: "mute", accent, rest: false };
  if (technique === "strumming") {
    return { main: clean === "D" ? "↓" : "↑", detail: clean === "D" ? "down" : "up", accent, rest: false };
  }
  if (technique === "plectrum") {
    const match = clean.match(/^(\d)(D|U)$/);
    return {
      main: match?.[2] === "D" ? "↓" : "↑",
      detail: match ? `string ${match[1]}` : clean,
      accent,
      rest: false
    };
  }
  const stringNumbers = clean.match(/\d/g)?.join(" + ");
  return {
    main: clean.replace(/[\d+]/g, "") || clean,
    detail: stringNumbers ? `string ${stringNumbers}` : "pinch",
    accent,
    rest: false
  };
}

function countLabel(index: number, length: number, subdivision: RightHandExercise["subdivision"]) {
  if (subdivision === "Quarter notes") return String((index % 4) + 1);
  if (subdivision === "Eighth notes") return index % 2 === 0 ? String((index / 2) % 4 + 1) : "&";
  if (subdivision === "Triplets") return [String(Math.floor(index / 3) % 4 + 1), "trip", "let"][index % 3];
  return [String(Math.floor(index / 4) % 4 + 1), "e", "&", "a"][index % 4];
}

export default function RightHandPage() {
  const [technique, setTechnique] = useState<RightHandTechnique>("strumming");
  const [difficulty, setDifficulty] = useState<RightHandDifficulty>("beginner");
  const [selectedId, setSelectedId] = useState("strum-quarter-downs");
  const [bpm, setBpm] = useState(72);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const exercises = useMemo(
    () => RIGHT_HAND_EXERCISES.filter((exercise) => exercise.technique === technique && exercise.difficulty === difficulty),
    [difficulty, technique]
  );
  const selectedExercise = RIGHT_HAND_EXERCISES.find((exercise) => exercise.id === selectedId) ?? exercises[0];

  const selectExercise = useCallback((exercise: RightHandExercise) => {
    setSelectedId(exercise.id);
    setBpm(exercise.bpm);
    setActiveStep(0);
    setIsPlaying(false);
  }, []);

  const changeFilters = (nextTechnique: RightHandTechnique, nextDifficulty: RightHandDifficulty) => {
    setTechnique(nextTechnique);
    setDifficulty(nextDifficulty);
    const first = RIGHT_HAND_EXERCISES.find(
      (exercise) => exercise.technique === nextTechnique && exercise.difficulty === nextDifficulty
    );
    if (first) selectExercise(first);
  };

  const playClick = useCallback(async (accent: boolean, rest: boolean) => {
    if (!soundOn || rest) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const context = audioContextRef.current;
    if (context.state === "suspended") await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = accent ? 1120 : 760;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.28 : 0.16, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.07);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  }, [soundOn]);

  useEffect(() => {
    if (!isPlaying || !selectedExercise) return;
    const subdivisions = selectedExercise.subdivision === "Quarter notes" ? 1
      : selectedExercise.subdivision === "Eighth notes" ? 2
      : selectedExercise.subdivision === "Triplets" ? 3 : 4;
    const interval = window.setInterval(() => {
      setActiveStep((previous) => (previous + 1) % selectedExercise.pattern.length);
    }, 60000 / bpm / subdivisions);
    return () => window.clearInterval(interval);
  }, [bpm, isPlaying, selectedExercise]);

  useEffect(() => {
    if (!isPlaying || !selectedExercise) return;
    const step = describeStep(selectedExercise.pattern[activeStep], selectedExercise.technique);
    playClick(step.accent, step.rest);
  }, [activeStep, isPlaying, playClick, selectedExercise]);

  if (!selectedExercise) return null;

  const selectedIndex = exercises.findIndex((exercise) => exercise.id === selectedExercise.id);
  const currentStep = describeStep(selectedExercise.pattern[activeStep], selectedExercise.technique);

  return (
    <main className="page right-hand-page">
      <section className="right-hand-heading">
        <div>
          <span className="tag">Right-hand studio</span>
          <h1>Make rhythm feel effortless.</h1>
          <p>Pick a technique and level. One focused exercise stays open while the rest wait quietly in the library.</p>
        </div>
        <div className="right-hand-session-note" aria-label="Practice recommendation">
          <span className="label">A good session</span>
          <strong>10 focused minutes</strong>
          <span>Start slowly. Raise the tempo only after three clean loops.</span>
        </div>
      </section>

      <section className="right-hand-techniques" aria-label="Choose a right-hand technique">
        {TECHNIQUES.map((item) => {
          const detail = TECHNIQUE_DETAILS[item];
          return (
            <button
              className={item === technique ? "active" : ""}
              key={item}
              type="button"
              onClick={() => changeFilters(item, difficulty)}
              aria-pressed={item === technique}
            >
              <span className="technique-symbol" aria-hidden="true">{detail.symbol}</span>
              <span><strong>{detail.label}</strong><small>{detail.description}</small></span>
            </button>
          );
        })}
      </section>

      <section className="right-hand-workspace">
        <aside className="exercise-browser">
          <div className="difficulty-tabs" aria-label="Choose difficulty">
            {DIFFICULTIES.map((item) => (
              <button
                key={item}
                type="button"
                className={item === difficulty ? "active" : ""}
                onClick={() => changeFilters(technique, item)}
                aria-pressed={item === difficulty}
              >
                {DIFFICULTY_DETAILS[item].label}
              </button>
            ))}
          </div>
          <div className="exercise-browser-heading">
            <div><span className="label">{DIFFICULTY_DETAILS[difficulty].label}</span><p>{DIFFICULTY_DETAILS[difficulty].description}</p></div>
            <span>{exercises.length} drills</span>
          </div>
          <div className="exercise-list">
            {exercises.map((exercise, index) => (
              <button
                key={exercise.id}
                type="button"
                className={exercise.id === selectedExercise.id ? "active" : ""}
                onClick={() => selectExercise(exercise)}
              >
                <span className="exercise-number">{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{exercise.title}</strong><small>{exercise.focus}</small></span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="practice-player">
          <header className="practice-player-header">
            <div>
              <span className="label">{TECHNIQUE_DETAILS[technique].shortLabel} · {DIFFICULTY_DETAILS[difficulty].label}</span>
              <h2>{selectedExercise.title}</h2>
              <p>{selectedExercise.focus}</p>
            </div>
            <span className="exercise-position">{selectedIndex + 1} / {exercises.length}</span>
          </header>

          <div className={`follow-along ${isPlaying ? "playing" : ""}`}>
            <div className="motion-demo" aria-live="polite">
              <span className="motion-orbit" aria-hidden="true" />
              <strong>{currentStep.main}</strong>
              <span>{currentStep.detail}</span>
            </div>
            <div className="pattern-stage">
              <div className="pattern-meta"><span>{selectedExercise.subdivision}</span><span>{selectedExercise.pattern.length} steps · loops continuously</span></div>
              <div className="pattern-strip" role="list" aria-label="Follow-along pattern">
                {selectedExercise.pattern.map((step, index) => {
                  const described = describeStep(step, selectedExercise.technique);
                  return (
                    <div className={`pattern-step ${index === activeStep ? "active" : ""} ${described.accent ? "accent" : ""} ${described.rest ? "rest" : ""}`} key={`${step}-${index}`} role="listitem">
                      <span className="pattern-count">{countLabel(index, selectedExercise.pattern.length, selectedExercise.subdivision)}</span>
                      <strong>{described.main}</strong>
                      <small>{described.detail}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="transport">
            <button className="transport-play" type="button" onClick={() => setIsPlaying((playing) => !playing)}>
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>{isPlaying ? "Pause" : "Start demo"}
            </button>
            <div className="tempo-field">
              <label htmlFor="right-hand-tempo"><span>Tempo</span><strong>{bpm} BPM</strong></label>
              <input id="right-hand-tempo" type="range" min="40" max="180" step="2" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
              <div><span>40</span><button type="button" onClick={() => setBpm(selectedExercise.bpm)}>Reset to {selectedExercise.bpm}</button><span>180</span></div>
            </div>
            <button className={`sound-toggle ${soundOn ? "active" : ""}`} type="button" onClick={() => setSoundOn((on) => !on)} aria-pressed={soundOn}>
              {soundOn ? "Sound on" : "Sound off"}
            </button>
          </div>

          <div className="coach-note">
            <span className="coach-mark">i</span>
            <div><span className="label">Coach&apos;s cue</span><p>{selectedExercise.coaching}</p></div>
          </div>

          <footer className="exercise-nav">
            <button type="button" disabled={selectedIndex <= 0} onClick={() => selectExercise(exercises[selectedIndex - 1])}>← Previous</button>
            <button type="button" disabled={selectedIndex >= exercises.length - 1} onClick={() => selectExercise(exercises[selectedIndex + 1])}>Next exercise →</button>
          </footer>
        </div>
      </section>
    </main>
  );
}
