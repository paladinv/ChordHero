"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DIFFICULTY_DETAILS,
  RIGHT_HAND_EXERCISES,
  TECHNIQUE_DETAILS,
  RightHandDifficulty,
  RightHandExercise,
  RightHandTechnique
} from "../../lib/rightHandExercises";
import {
  playRecordedBackingPulse,
  playRecordedClick,
  playRecordedGuitarStep,
  preloadRightHandAudio
} from "../../lib/recordedAudio";

type PracticeStatus = "idle" | "countin" | "running" | "paused" | "complete";
type SoundMode = "click" | "guitar" | "both" | "silent";
type Backing = "off" | "G" | "C" | "Am";
type Rating = "clean" | "mistakes" | "fast";
type ExerciseProgress = {
  bestBpm: number;
  sessions: number;
  cleanSessions: number;
  totalSeconds: number;
  lastPracticed: string;
};

const TECHNIQUES = Object.keys(TECHNIQUE_DETAILS) as RightHandTechnique[];
const DIFFICULTIES = Object.keys(DIFFICULTY_DETAILS) as RightHandDifficulty[];
const ROUND_OPTIONS = [
  { seconds: 30, label: "30 sec" },
  { seconds: 60, label: "1 min" },
  { seconds: 180, label: "3 min" },
  { seconds: 0, label: "Free" }
];
const GUIDED_PATHS = [
  {
    id: "steady-strummer",
    title: "First week of strumming",
    description: "Pulse → down-up motion → rests → mutes",
    exercises: ["strum-quarter-downs", "strum-eighth-engine", "strum-space", "strum-first-mute"]
  },
  {
    id: "accurate-pick",
    title: "Alternate-picking accuracy",
    description: "Single string → crossing → skipping → triplets",
    exercises: ["pick-single-string", "pick-two-string", "pick-inside-out", "pick-triplet-roll"]
  },
  {
    id: "fingerstyle-foundation",
    title: "Fingerstyle foundations",
    description: "Thumb → P–i–m–a → pinches → Travis picking",
    exercises: ["finger-thumb", "finger-pima", "finger-pinches", "finger-travis"]
  }
];

function describeStep(step: string, technique: RightHandTechnique) {
  const accent = step.endsWith("!");
  const clean = step.replace("!", "");
  if (clean === "·") return { main: "—", detail: "rest", accent, rest: true, strings: [] as number[] };
  if (clean === "X") return { main: "×", detail: "mute", accent, rest: false, strings: [1, 2, 3, 4, 5, 6] };
  if (technique === "strumming") {
    return {
      main: clean === "D" ? "↓" : "↑",
      detail: clean === "D" ? "down" : "up",
      accent,
      rest: false,
      strings: [1, 2, 3, 4, 5, 6]
    };
  }
  if (technique === "plectrum") {
    const match = clean.match(/^(\d)(D|U)$/);
    const stringNumber = Number(match?.[1] ?? 3);
    return {
      main: match?.[2] === "D" ? "↓" : "↑",
      detail: `string ${stringNumber}`,
      accent,
      rest: false,
      strings: [stringNumber]
    };
  }
  const strings = clean.match(/\d/g)?.map(Number) ?? [];
  return {
    main: clean.replace(/[\d+]/g, "") || clean,
    detail: strings.length ? `string ${strings.join(" + ")}` : "pinch",
    accent,
    rest: false,
    strings
  };
}

function countLabel(index: number, subdivision: RightHandExercise["subdivision"]) {
  if (subdivision === "Quarter notes") return String((index % 4) + 1);
  if (subdivision === "Eighth notes") return index % 2 === 0 ? String((index / 2) % 4 + 1) : "&";
  if (subdivision === "Triplets") return [String(Math.floor(index / 3) % 4 + 1), "trip", "let"][index % 3];
  return [String(Math.floor(index / 4) % 4 + 1), "e", "&", "a"][index % 4];
}

function subdivisionsPerBeat(subdivision: RightHandExercise["subdivision"]) {
  if (subdivision === "Quarter notes") return 1;
  if (subdivision === "Eighth notes") return 2;
  if (subdivision === "Triplets") return 3;
  return 4;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;
}

function exerciseById(id: string | null) {
  return RIGHT_HAND_EXERCISES.find((exercise) => exercise.id === id);
}

function rememberedTempo(exercise: RightHandExercise, progressBpm = 0) {
  if (typeof window === "undefined") return progressBpm || exercise.bpm;
  const stored = Number(window.localStorage.getItem(`chord-hero:right-hand:tempo:${exercise.id}`));
  return Number.isFinite(stored) && stored >= 40 && stored <= 180 ? stored : progressBpm || exercise.bpm;
}

export default function RightHandPage() {
  const [technique, setTechnique] = useState<RightHandTechnique>("strumming");
  const [difficulty, setDifficulty] = useState<RightHandDifficulty>("beginner");
  const [selectedId, setSelectedId] = useState("strum-quarter-downs");
  const [bpm, setBpm] = useState(72);
  const [status, setStatus] = useState<PracticeStatus>("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [countIn, setCountIn] = useState(4);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loopsCompleted, setLoopsCompleted] = useState(0);
  const [roundSeconds, setRoundSeconds] = useState(60);
  const [soundMode, setSoundMode] = useState<SoundMode>("both");
  const [backing, setBacking] = useState<Backing>("off");
  const [autoRamp, setAutoRamp] = useState(true);
  const [rampAmount, setRampAmount] = useState(4);
  const [showPaths, setShowPaths] = useState(false);
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [hydrated, setHydrated] = useState(false);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to practise");

  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const timeoutsRef = useRef<Set<number>>(new Set());
  const sourcesGenerationRef = useRef(0);
  const statusRef = useRef<PracticeStatus>("idle");
  const tapsRef = useRef<number[]>([]);
  const togglePlaybackRef = useRef<() => void>(() => undefined);

  const exercises = useMemo(
    () => RIGHT_HAND_EXERCISES.filter((exercise) => exercise.technique === technique && exercise.difficulty === difficulty),
    [difficulty, technique]
  );
  const selectedExercise = exerciseById(selectedId) ?? exercises[0];
  const describedPattern = useMemo(
    () => selectedExercise?.pattern.map((step) => describeStep(step, selectedExercise.technique)) ?? [],
    [selectedExercise]
  );
  const selectedIndex = exercises.findIndex((exercise) => exercise.id === selectedExercise?.id);
  const currentStep = describedPattern[activeStep] ?? describedPattern[0];
  const exerciseProgress = selectedExercise ? progress[selectedExercise.id] : undefined;
  const remainingSeconds = roundSeconds ? Math.max(0, roundSeconds - elapsedSeconds) : elapsedSeconds;
  const activePath = GUIDED_PATHS.find((path) => path.id === activePathId);
  const pathIndex = activePath?.exercises.indexOf(selectedExercise?.id ?? "") ?? -1;

  const clearScheduledWork = useCallback(() => {
    sourcesGenerationRef.current += 1;
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    if (elapsedTimerRef.current !== null) window.clearInterval(elapsedTimerRef.current);
    schedulerRef.current = null;
    elapsedTimerRef.current = null;
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = window.setTimeout(() => {
      timeoutsRef.current.delete(timeout);
      callback();
    }, Math.max(0, delay));
    timeoutsRef.current.add(timeout);
    return timeout;
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const context = audioContextRef.current;
    if (context.state === "suspended") await context.resume();
    await preloadRightHandAudio(context);
    return context;
  }, []);

  const finishSession = useCallback(() => {
    if (!selectedExercise || !["running", "countin"].includes(statusRef.current)) return;
    clearScheduledWork();
    statusRef.current = "complete";
    setStatus("complete");
    setElapsedSeconds(roundSeconds || elapsedSeconds);
    setStatusMessage("Round complete. Rate the feel before continuing.");
    setProgress((previous) => {
      const current = previous[selectedExercise.id] ?? {
        bestBpm: 0,
        sessions: 0,
        cleanSessions: 0,
        totalSeconds: 0,
        lastPracticed: ""
      };
      return {
        ...previous,
        [selectedExercise.id]: {
          ...current,
          sessions: current.sessions + 1,
          totalSeconds: current.totalSeconds + (roundSeconds || elapsedSeconds),
          lastPracticed: new Date().toISOString()
        }
      };
    });
  }, [clearScheduledWork, elapsedSeconds, roundSeconds, selectedExercise]);

  const pauseSession = useCallback(() => {
    if (!["running", "countin"].includes(statusRef.current)) return;
    clearScheduledWork();
    statusRef.current = "paused";
    setStatus("paused");
    setStatusMessage("Paused");
  }, [clearScheduledWork]);

  const resetSession = useCallback(() => {
    clearScheduledWork();
    statusRef.current = "idle";
    setStatus("idle");
    setActiveStep(0);
    setCountIn(4);
    setElapsedSeconds(0);
    setLoopsCompleted(0);
    setStatusMessage("Ready to practise");
  }, [clearScheduledWork]);

  const beginScheduledPlayback = useCallback((
    context: AudioContext,
    exercise: RightHandExercise,
    startAt: number,
    generation: number
  ) => {
    const stepDuration = 60 / bpm / subdivisionsPerBeat(exercise.subdivision);
    let nextStepTime = startAt;
    let scheduledIndex = 0;
    const sessionStart = startAt;
    statusRef.current = "running";

    const scheduleAhead = () => {
      if (
        generation !== sourcesGenerationRef.current ||
        !["countin", "running"].includes(statusRef.current)
      ) return;
      const horizon = context.currentTime + 0.14;
      while (nextStepTime < horizon) {
        if (roundSeconds > 0 && nextStepTime - sessionStart >= roundSeconds) {
          scheduleTimeout(finishSession, (nextStepTime - context.currentTime) * 1000);
          if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
          schedulerRef.current = null;
          return;
        }

        const stepOrdinal = scheduledIndex;
        const patternIndex = stepOrdinal % exercise.pattern.length;
        const rawStep = exercise.pattern[patternIndex];
        const step = describeStep(rawStep, exercise.technique);
        const isBeat = scheduledIndex % subdivisionsPerBeat(exercise.subdivision) === 0;
        const when = nextStepTime;

        if (!step.rest && (soundMode === "click" || soundMode === "both")) {
          void playRecordedClick(context, { accent: step.accent || isBeat, volume: 0.13, when });
        }
        if (!step.rest && (soundMode === "guitar" || soundMode === "both")) {
          void playRecordedGuitarStep(context, {
            token: rawStep,
            technique: exercise.technique,
            accent: step.accent,
            volume: soundMode === "both" ? 0.15 : 0.22,
            when
          });
        }
        if (backing !== "off" && isBeat) {
          void playRecordedBackingPulse(context, backing, when, 0.07);
        }

        scheduleTimeout(() => {
          if (generation !== sourcesGenerationRef.current) return;
          setActiveStep(patternIndex);
          if (patternIndex === 0 && stepOrdinal > 1) setLoopsCompleted((value) => value + 1);
        }, (when - context.currentTime) * 1000);

        scheduledIndex += 1;
        nextStepTime += stepDuration;
      }
    };

    scheduleTimeout(() => {
      if (generation !== sourcesGenerationRef.current) return;
      statusRef.current = "running";
      setStatus("running");
      setStatusMessage("Playing");
      setElapsedSeconds(0);
      const startedAt = performance.now();
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.floor((performance.now() - startedAt) / 1000));
      }, 250);
    }, (startAt - context.currentTime) * 1000);

    scheduleAhead();
    schedulerRef.current = window.setInterval(scheduleAhead, 25);
  }, [backing, bpm, finishSession, roundSeconds, scheduleTimeout, soundMode]);

  const startSession = useCallback(async () => {
    if (!selectedExercise || statusRef.current === "running" || statusRef.current === "countin") return;
    clearScheduledWork();
    const context = await ensureAudio();
    const beatDuration = 60 / bpm;
    const firstBeat = context.currentTime + 0.08;
    const generation = sourcesGenerationRef.current;
    statusRef.current = "countin";
    setStatus("countin");
    setCountIn(4);
    setStatusMessage("Count in");

    for (let beat = 0; beat < 4; beat += 1) {
      const when = firstBeat + beat * beatDuration;
      void playRecordedClick(context, { accent: beat === 0, volume: 0.2, when });
      scheduleTimeout(() => setCountIn(4 - beat), (when - context.currentTime) * 1000);
    }
    beginScheduledPlayback(context, selectedExercise, firstBeat + 4 * beatDuration, generation);
  }, [beginScheduledPlayback, bpm, clearScheduledWork, ensureAudio, scheduleTimeout, selectedExercise]);

  const selectExercise = useCallback((exercise: RightHandExercise) => {
    resetSession();
    setTechnique(exercise.technique);
    setDifficulty(exercise.difficulty);
    setSelectedId(exercise.id);
    setBpm(rememberedTempo(exercise, progress[exercise.id]?.bestBpm));
  }, [progress, resetSession]);

  const changeFilters = useCallback((nextTechnique: RightHandTechnique, nextDifficulty: RightHandDifficulty) => {
    resetSession();
    setTechnique(nextTechnique);
    setDifficulty(nextDifficulty);
    const storageKey = `chord-hero:right-hand:last:${nextTechnique}:${nextDifficulty}`;
    const remembered = typeof window !== "undefined" ? exerciseById(window.localStorage.getItem(storageKey)) : undefined;
    const first = remembered?.technique === nextTechnique && remembered.difficulty === nextDifficulty
      ? remembered
      : RIGHT_HAND_EXERCISES.find((exercise) => exercise.technique === nextTechnique && exercise.difficulty === nextDifficulty);
    if (first) {
      setSelectedId(first.id);
      setBpm(rememberedTempo(first, progress[first.id]?.bestBpm));
    }
  }, [progress, resetSession]);

  const rateSession = useCallback((rating: Rating) => {
    if (!selectedExercise) return;
    const nextBpm = rating === "clean" && autoRamp
      ? Math.min(180, bpm + rampAmount)
      : rating === "fast"
        ? Math.max(40, bpm - 6)
        : bpm;
    if (rating === "clean") {
      setProgress((previous) => {
        const current = previous[selectedExercise.id] ?? {
          bestBpm: 0,
          sessions: 1,
          cleanSessions: 0,
          totalSeconds: roundSeconds || elapsedSeconds,
          lastPracticed: new Date().toISOString()
        };
        return {
          ...previous,
          [selectedExercise.id]: {
            ...current,
            bestBpm: Math.max(current.bestBpm, bpm),
            cleanSessions: current.cleanSessions + 1
          }
        };
      });
    }
    resetSession();
    setBpm(nextBpm);
    setStatusMessage(
      rating === "clean"
        ? autoRamp ? `Clean round. Next tempo: ${nextBpm} BPM.` : "Clean round saved."
        : rating === "fast" ? `Tempo reduced to ${nextBpm} BPM.` : "Repeat at the same tempo."
    );
  }, [autoRamp, bpm, elapsedSeconds, rampAmount, resetSession, roundSeconds, selectedExercise]);

  const tapTempo = useCallback(() => {
    const now = performance.now();
    const recent = tapsRef.current.filter((tap) => now - tap < 2500);
    const next = [...recent, now].slice(-5);
    tapsRef.current = next;
    if (next.length < 2) return;
    const gaps = next.slice(1).map((tap, index) => tap - next[index]);
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    setBpm(Math.max(40, Math.min(180, Math.round(60000 / average))));
  }, []);

  const enableMidi = useCallback(async () => {
    type MidiAccess = { inputs: Map<string, { onmidimessage: ((event: { data: Uint8Array }) => void) | null }> };
    type MidiNavigator = Navigator & { requestMIDIAccess?: () => Promise<MidiAccess> };
    const request = (navigator as MidiNavigator).requestMIDIAccess;
    if (!request) {
      setStatusMessage("Web MIDI is not available in this browser.");
      return;
    }
    const access = await request.call(navigator);
    access.inputs.forEach((input) => {
      input.onmidimessage = (event) => {
        const [command, , velocity] = event.data;
        if ((command & 0xf0) === 0x90 && velocity > 0) togglePlaybackRef.current();
      };
    });
    setMidiEnabled(true);
    setStatusMessage("MIDI pedal enabled. Any note toggles playback.");
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (hydrated) return;
    const savedProgress = window.localStorage.getItem("chord-hero:right-hand:progress");
    const savedSettings = window.localStorage.getItem("chord-hero:right-hand:settings");
    const params = new URLSearchParams(window.location.search);
    if (savedProgress) {
      try { setProgress(JSON.parse(savedProgress)); } catch { /* Ignore malformed local data. */ }
    }
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (ROUND_OPTIONS.some((option) => option.seconds === settings.roundSeconds)) setRoundSeconds(settings.roundSeconds);
        if (["click", "guitar", "both", "silent"].includes(settings.soundMode)) setSoundMode(settings.soundMode);
        if (["off", "G", "C", "Am"].includes(settings.backing)) setBacking(settings.backing);
        if (typeof settings.autoRamp === "boolean") setAutoRamp(settings.autoRamp);
        if ([2, 4, 6].includes(settings.rampAmount)) setRampAmount(settings.rampAmount);
      } catch { /* Ignore malformed local data. */ }
    }
    const linkedExercise = exerciseById(params.get("exercise"));
    const fallbackTechnique = (window.localStorage.getItem("chord-hero:right-hand:technique") as RightHandTechnique) || "strumming";
    const fallbackDifficulty = (window.localStorage.getItem("chord-hero:right-hand:difficulty") as RightHandDifficulty) || "beginner";
    const remembered = exerciseById(
      window.localStorage.getItem(`chord-hero:right-hand:last:${fallbackTechnique}:${fallbackDifficulty}`)
    );
    const initial = linkedExercise ?? remembered;
    if (initial) {
      setTechnique(initial.technique);
      setDifficulty(initial.difficulty);
      setSelectedId(initial.id);
      const savedTempo = Number(window.localStorage.getItem(`chord-hero:right-hand:tempo:${initial.id}`));
      setBpm(Number.isFinite(savedTempo) && savedTempo >= 40 && savedTempo <= 180 ? savedTempo : initial.bpm);
    }
    setHydrated(true);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !selectedExercise) return;
    window.localStorage.setItem("chord-hero:right-hand:progress", JSON.stringify(progress));
    window.localStorage.setItem("chord-hero:right-hand:technique", technique);
    window.localStorage.setItem("chord-hero:right-hand:difficulty", difficulty);
    window.localStorage.setItem(`chord-hero:right-hand:last:${technique}:${difficulty}`, selectedExercise.id);
    window.localStorage.setItem(`chord-hero:right-hand:tempo:${selectedExercise.id}`, String(bpm));
    window.localStorage.setItem("chord-hero:right-hand:settings", JSON.stringify({
      roundSeconds, soundMode, backing, autoRamp, rampAmount
    }));
    const url = new URL(window.location.href);
    url.searchParams.set("exercise", selectedExercise.id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [activePathId, autoRamp, backing, bpm, difficulty, hydrated, progress, rampAmount, roundSeconds, selectedExercise, soundMode, technique]);

  useEffect(() => {
    const toggle = () => {
      if (statusRef.current === "running" || statusRef.current === "countin") pauseSession();
      else void startSession();
    };
    togglePlaybackRef.current = toggle;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea, button")) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setBpm((value) => Math.min(180, value + 2));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setBpm((value) => Math.max(40, value - 2));
      } else if (event.key === "[" && selectedIndex > 0) {
        selectExercise(exercises[selectedIndex - 1]);
      } else if (event.key === "]" && selectedIndex < exercises.length - 1) {
        selectExercise(exercises[selectedIndex + 1]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exercises, pauseSession, selectExercise, selectedIndex, startSession]);

  useEffect(() => {
    type PracticeWindow = Window & {
      render_game_to_text?: () => string;
      advanceTime?: (milliseconds: number) => void;
    };
    const practiceWindow = window as PracticeWindow;
    practiceWindow.render_game_to_text = () => JSON.stringify({
      mode: statusRef.current,
      exercise: selectedExercise?.id,
      technique,
      difficulty,
      bpm,
      step: activeStep,
      loops: loopsCompleted,
      elapsedSeconds,
      roundSeconds,
      coordinateSystem: "Pattern steps run left to right; guitar strings display 1 (high) to 6 (low)."
    });
    practiceWindow.advanceTime = (milliseconds) => {
      if (!selectedExercise) return;
      const stepMs = 60000 / bpm / subdivisionsPerBeat(selectedExercise.subdivision);
      const steps = Math.max(1, Math.floor(milliseconds / stepMs));
      setActiveStep((value) => (value + steps) % selectedExercise.pattern.length);
    };
    return () => {
      delete practiceWindow.render_game_to_text;
      delete practiceWindow.advanceTime;
    };
  }, [activeStep, bpm, difficulty, elapsedSeconds, loopsCompleted, roundSeconds, selectedExercise, technique]);

  useEffect(() => () => clearScheduledWork(), [clearScheduledWork]);

  if (!selectedExercise || !currentStep) return null;

  const motionStyle = {
    "--target-string": String(currentStep.strings[0] ?? 3)
  } as CSSProperties;

  return (
    <main className="page right-hand-page">
      <section className="right-hand-heading">
        <div>
          <span className="tag">Right-hand studio</span>
          <h1>Make rhythm feel effortless.</h1>
          <p>Follow the motion, hear the technique, and build speed through short, measurable practice rounds.</p>
        </div>
        <div className="right-hand-session-note" aria-label="Current practice progress">
          <span className="label">Your practice</span>
          <strong>{exerciseProgress?.bestBpm ? `${exerciseProgress.bestBpm} BPM best` : "Start with control"}</strong>
          <span>{exerciseProgress?.sessions ?? 0} rounds · {formatTime(exerciseProgress?.totalSeconds ?? 0)} practised</span>
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

      <section className="practice-paths">
        <button className="practice-paths-toggle" type="button" onClick={() => setShowPaths((visible) => !visible)} aria-expanded={showPaths}>
          <span><span className="label">Guided paths</span><strong>{activePath?.title ?? "Not sure where to start?"}</strong></span>
          <span>{showPaths ? "Hide" : "Choose a path"} {showPaths ? "↑" : "↓"}</span>
        </button>
        {showPaths && (
          <div className="practice-path-grid">
            {GUIDED_PATHS.map((path) => (
              <button
                key={path.id}
                type="button"
                className={activePathId === path.id ? "active" : ""}
                onClick={() => {
                  setActivePathId(path.id);
                  const first = exerciseById(path.exercises[0]);
                  if (first) selectExercise(first);
                  setShowPaths(false);
                }}
              >
                <strong>{path.title}</strong><span>{path.description}</span><small>{path.exercises.length} steps</small>
              </button>
            ))}
          </div>
        )}
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
          <div className="exercise-list scroll-hint">
            {exercises.map((exercise, index) => {
              const itemProgress = progress[exercise.id];
              return (
                <button
                  key={exercise.id}
                  type="button"
                  className={exercise.id === selectedExercise.id ? "active" : ""}
                  onClick={() => selectExercise(exercise)}
                >
                  <span className="exercise-number">{itemProgress?.cleanSessions ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{exercise.title}</strong><small>{exercise.focus}{itemProgress?.bestBpm ? ` · ${itemProgress.bestBpm} BPM` : ""}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="practice-player">
          <header className="practice-player-header">
            <div>
              <span className="label">{TECHNIQUE_DETAILS[technique].shortLabel} · {DIFFICULTY_DETAILS[difficulty].label}</span>
              <h2>{selectedExercise.title}</h2>
              <p>{selectedExercise.focus}</p>
              {activePath && pathIndex >= 0 && <small>Path: {activePath.title} · step {pathIndex + 1} of {activePath.exercises.length}</small>}
            </div>
            <span className="exercise-position">{selectedIndex + 1} / {exercises.length}</span>
          </header>

          <div className={`follow-along ${status === "running" ? "playing" : ""}`}>
            <div className={`motion-demo technique-${technique}`} style={motionStyle}>
              {status === "countin" ? (
                <div className="count-in-display"><span>Get ready</span><strong>{countIn}</strong></div>
              ) : (
                <>
                  <div className="string-motion" aria-hidden="true">
                    {[1, 2, 3, 4, 5, 6].map((string) => (
                      <i key={string} className={currentStep.strings.includes(string) ? "active" : ""} />
                    ))}
                    <b>{currentStep.main}</b>
                  </div>
                  <strong>{currentStep.main}</strong>
                  <span>{currentStep.detail}</span>
                </>
              )}
            </div>
            <div className="pattern-stage">
              <div className="pattern-meta">
                <span>{selectedExercise.subdivision}</span>
                <span>{status === "running" ? `${loopsCompleted} loops` : `${selectedExercise.pattern.length} steps`}</span>
              </div>
              <div className="pattern-strip scroll-hint" role="list" aria-label="Follow-along pattern">
                {describedPattern.map((step, index) => (
                  <div
                    className={`pattern-step ${index === activeStep ? "active" : ""} ${step.accent ? "accent" : ""} ${step.rest ? "rest" : ""}`}
                    key={`${selectedExercise.pattern[index]}-${index}`}
                    role="listitem"
                    aria-current={index === activeStep ? "step" : undefined}
                    aria-label={`${countLabel(index, selectedExercise.subdivision)}: ${step.detail}${step.accent ? ", accented" : ""}`}
                  >
                    <span className="pattern-count">{countLabel(index, selectedExercise.subdivision)}</span>
                    <strong aria-hidden="true">{step.main}</strong>
                    <small aria-hidden="true">{step.detail}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="session-setup" aria-label="Practice round settings">
            <div>
              <span className="label">Round</span>
              <div className="segmented compact">
                {ROUND_OPTIONS.map((option) => (
                  <button key={option.seconds} type="button" className={roundSeconds === option.seconds ? "active" : ""} onClick={() => setRoundSeconds(option.seconds)}>{option.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="right-hand-sound">Hear</label>
              <select id="right-hand-sound" value={soundMode} onChange={(event) => setSoundMode(event.target.value as SoundMode)}>
                <option value="both">Guitar + click</option>
                <option value="guitar">Guitar demo</option>
                <option value="click">Click only</option>
                <option value="silent">Visual only</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="right-hand-backing">Context</label>
              <select id="right-hand-backing" value={backing} onChange={(event) => setBacking(event.target.value as Backing)}>
                <option value="off">No backing</option>
                <option value="G">G pulse</option>
                <option value="C">C pulse</option>
                <option value="Am">Am pulse</option>
              </select>
            </div>
          </div>

          <div className="transport">
            <button
              className="transport-play"
              type="button"
              onClick={() => {
                if (status === "running" || status === "countin") pauseSession();
                else void startSession();
              }}
            >
              <span aria-hidden="true">{status === "running" || status === "countin" ? "Ⅱ" : "▶"}</span>
              {status === "paused" ? "Restart round" : status === "running" || status === "countin" ? "Pause" : "Start round"}
            </button>
            <div className="tempo-field">
              <label htmlFor="right-hand-tempo"><span>Tempo</span><strong>{bpm} BPM</strong></label>
              <input id="right-hand-tempo" type="range" min="40" max="180" step="2" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
              <div><span>40</span><button type="button" onClick={tapTempo}>Tap tempo</button><button type="button" onClick={() => setBpm(selectedExercise.bpm)}>Reset {selectedExercise.bpm}</button><span>180</span></div>
            </div>
            <div className="session-clock">
              <span className="label">{roundSeconds ? "Remaining" : "Elapsed"}</span>
              <strong>{formatTime(remainingSeconds)}</strong>
            </div>
          </div>

          <div className="practice-options">
            <label><input type="checkbox" checked={autoRamp} onChange={(event) => setAutoRamp(event.target.checked)} /> Auto-raise after a clean round</label>
            <select aria-label="Automatic tempo increase" value={rampAmount} onChange={(event) => setRampAmount(Number(event.target.value))} disabled={!autoRamp}>
              <option value={2}>+2 BPM</option>
              <option value={4}>+4 BPM</option>
              <option value={6}>+6 BPM</option>
            </select>
            <button type="button" className={midiEnabled ? "active" : ""} onClick={() => void enableMidi()}>{midiEnabled ? "MIDI pedal ready" : "Enable MIDI pedal"}</button>
          </div>

          {status === "complete" && (
            <section className="round-feedback" aria-labelledby="round-feedback-title">
              <div><span className="label">Round complete</span><h3 id="round-feedback-title">How did it feel?</h3><p>Your answer sets the next tempo and updates this drill&apos;s progress.</p></div>
              <div>
                <button type="button" onClick={() => rateSession("clean")}><strong>Clean</strong><span>{autoRamp ? `Raise ${rampAmount} BPM` : "Save result"}</span></button>
                <button type="button" onClick={() => rateSession("mistakes")}><strong>A few mistakes</strong><span>Repeat this tempo</span></button>
                <button type="button" onClick={() => rateSession("fast")}><strong>Too fast</strong><span>Lower 6 BPM</span></button>
              </div>
            </section>
          )}

          <div className="coach-note">
            <span className="coach-mark">i</span>
            <div><span className="label">Coach&apos;s cue</span><p>{selectedExercise.coaching}</p></div>
          </div>

          <details className="notation-guide">
            <summary>How to read this pattern</summary>
            <div>
              <span><b>↓ / ↑</b> Down / up stroke</span>
              <span><b>×</b> Muted stroke</span>
              <span><b>—</b> Rest; keep moving</span>
              <span><b>P i m a</b> Thumb, index, middle, ring</span>
              <span><b>1–6</b> High E to low E string</span>
              <span><b>Orange edge</b> Accent</span>
            </div>
            <p>Shortcuts: Space play/pause · ↑/↓ tempo · [ / ] previous/next.</p>
          </details>

          <footer className="exercise-nav">
            <button type="button" disabled={selectedIndex <= 0} onClick={() => selectExercise(exercises[selectedIndex - 1])}>← Previous</button>
            <button
              type="button"
              disabled={selectedIndex >= exercises.length - 1}
              onClick={() => selectExercise(exercises[selectedIndex + 1])}
            >
              Next exercise →
            </button>
          </footer>
        </div>
      </section>
      <p className="visually-hidden" role="status" aria-live="polite">{statusMessage}</p>
    </main>
  );
}
