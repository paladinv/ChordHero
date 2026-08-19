"use client";
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import type { RecordingAnalysis } from "../../lib/songRecordingAnalysis";
import { RIGHT_HAND_GUIDED_PATHS as GUIDED_PATHS, RIGHT_HAND_PROGRESSIONS as PROGRESSIONS, RIGHT_HAND_ROUND_OPTIONS as ROUND_OPTIONS } from "../../lib/rightHandPracticePresets";
import type { PracticeModeSettings, RightHandChallengeMode, RightHandStylePreset } from "../../components/RightHandAdvancedTools";
import { DEFAULT_RIGHT_HAND_MODE_SETTINGS, describeRightHandStep as describeStep, formatPracticeTime as formatTime, readPracticeAudioPreferences, rememberedRightHandTempo as rememberedTempo, rightHandCountLabel as countLabel, rightHandExerciseById as exerciseById, rightHandSubdivisionsPerBeat as subdivisionsPerBeat, saveRightHandPracticeResult as savePracticeResult, shouldPlayStyleBacking, validCustomProgression, type ExerciseProgress } from "../../lib/rightHandPracticeRuntime";
const RightHandRecordingCoach = dynamic(() => import("../../components/RightHandRecordingCoach"), { ssr: false, loading: () => <div className="recording-coach-loading">Loading coach…</div> });
const LicensedDemo = dynamic(() => import("../../components/LicensedDemo"), { ssr: false, loading: () => <div className="licensed-demo-loading">Loading demonstration slot…</div> });
const RightHandAdvancedTools = dynamic(() => import("../../components/RightHandAdvancedTools"), { ssr: false, loading: () => <div className="recording-coach-loading">Loading controls…</div> });
const RH3D = dynamic(() => import("../../components/RightHandTechnique3D"), { ssr: false });
type PracticeStatus = "idle" | "countin" | "running" | "paused" | "complete";
type SoundMode = "click" | "guitar" | "both" | "silent";
type Rating = "clean" | "mistakes" | "fast";
type ClickFeel = "straight" | "swing";
type AccentMode = "downbeat" | "two-four" | "pattern";
const TECHNIQUES = Object.keys(TECHNIQUE_DETAILS) as RightHandTechnique[];
const DIFFICULTIES = Object.keys(DIFFICULTY_DETAILS) as RightHandDifficulty[];
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
  const [progressionId, setProgressionId] = useState("off");
  const [customProgression, setCustomProgression] = useState("G C D G");
  const [stylePreset, setStylePreset] = useState("neutral");
  const [autoRamp, setAutoRamp] = useState(true);
  const [rampAmount, setRampAmount] = useState(4);
  const [showPaths, setShowPaths] = useState(false);
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [hydrated, setHydrated] = useState(false);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to practise");
  const [clickFeel, setClickFeel] = useState<ClickFeel>("straight");
  const [accentMode, setAccentMode] = useState<AccentMode>("pattern");
  const [silentEvery, setSilentEvery] = useState(0);
  const [troubleLoop, setTroubleLoop] = useState<{ start: number; end: number } | null>(null);
  const [showRecordingCoach, setShowRecordingCoach] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customPattern, setCustomPattern] = useState("");
  const [customRoutineCount, setCustomRoutineCount] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [ladderRequiredRounds, setLadderRequiredRounds] = useState(2);
  const [showDemoMedia, setShowDemoMedia] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [challengeMode, setChallengeMode] = useState<RightHandChallengeMode>("standard");
  const [modes, setModes] = useState<PracticeModeSettings>(DEFAULT_RIGHT_HAND_MODE_SETTINGS);
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
  const chordProgression = useMemo(() => {
    const selectedProgression = PROGRESSIONS.find((item) => item.id === progressionId);
    return progressionId === "custom" ? validCustomProgression(customProgression) : [...(selectedProgression?.chords ?? [])];
  }, [customProgression, progressionId]);
  const goalTargetBpm = exerciseProgress?.goalTargetBpm ?? Math.min(180, selectedExercise.bpm + 20);
  const goalRequiredRounds = exerciseProgress?.goalRequiredRounds ?? 3;
  const goalRoundsAtTarget = exerciseProgress?.goalRoundsAtTarget ?? 0;
  const goalTimingScore = exerciseProgress?.goalTimingScore ?? 85;
  const goalPracticeMinutes = exerciseProgress?.goalPracticeMinutes ?? 10;
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
    const perBeat = subdivisionsPerBeat(exercise.subdivision);
    const baseStepDuration = 60 / bpm / perBeat;
    const patternIndexes = troubleLoop
      ? Array.from({ length: troubleLoop.end - troubleLoop.start + 1 }, (_, index) => troubleLoop.start + index)
      : exercise.pattern.map((_, index) => index);
    let nextStepTime = startAt;
    let scheduledIndex = 0;
    const sessionStart = startAt;
    const preferences = readPracticeAudioPreferences();
    const masterVolume = preferences.audioMuted ? 0 : preferences.audioVolume;
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
        const patternIndex = patternIndexes[stepOrdinal % patternIndexes.length];
        const rawStep = exercise.pattern[patternIndex];
        const step = describeStep(rawStep, exercise.technique);
        const isBeat = scheduledIndex % perBeat === 0;
        const beatNumber = Math.floor(scheduledIndex / perBeat);
        const subdivisionIndex = scheduledIndex % perBeat;
        const isSilentGap = silentEvery > 0 && beatNumber > 0 && beatNumber % silentEvery === silentEvery - 1;
        const regularAccent = accentMode === "two-four"
          ? isBeat && beatNumber % 4 % 2 === 1
          : accentMode === "downbeat" ? isBeat && beatNumber % 4 === 0 : step.accent || isBeat;
        const metronomeAccent = challengeMode === "random" ? (beatNumber * 11 + stepOrdinal * 5 + patternIndexes.length) % 7 < 2 : regularAccent;
        const when = nextStepTime;
        if (!step.rest && !isSilentGap && masterVolume > 0 && (soundMode === "click" || soundMode === "both")) {
          void playRecordedClick(context, { accent: metronomeAccent, volume: 0.13 * masterVolume * modes.clickMix / 100, when });
        }
        if (!step.rest && masterVolume > 0 && (soundMode === "guitar" || soundMode === "both")) {
          void playRecordedGuitarStep(context, {
            token: rawStep,
            technique: exercise.technique,
            accent: step.accent,
            volume: (soundMode === "both" ? 0.15 : 0.22) * masterVolume * modes.guitarMix / 100,
            targetSound: modes.targetSound,
            when
          });
        }
        if (chordProgression.length && masterVolume > 0 && shouldPlayStyleBacking(stylePreset, beatNumber, subdivisionIndex, perBeat)) {
          const chordIndex = Math.floor(beatNumber / 4) % chordProgression.length;
          void playRecordedBackingPulse(context, chordProgression[chordIndex], when, 0.07 * masterVolume * modes.contextMix / 100);
        }
        scheduleTimeout(() => {
          if (generation !== sourcesGenerationRef.current) return;
          setActiveStep(patternIndex);
          if (isBeat && preferences.haptics && !preferences.reducedMotion && "vibrate" in navigator) navigator.vibrate(metronomeAccent ? 18 : 9);
          if (stepOrdinal > 0 && stepOrdinal % patternIndexes.length === 0) setLoopsCompleted((value) => value + 1);
        }, (when - context.currentTime) * 1000);
        scheduledIndex += 1;
        const swingable = clickFeel === "swing" && perBeat === 2;
        nextStepTime += swingable ? (scheduledIndex % 2 === 1 ? baseStepDuration * 4 / 3 : baseStepDuration * 2 / 3) : baseStepDuration;
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
  }, [accentMode, bpm, challengeMode, chordProgression, clickFeel, finishSession, modes, roundSeconds, scheduleTimeout, silentEvery, soundMode, stylePreset, troubleLoop]);
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
      const audio = readPracticeAudioPreferences();
      void playRecordedClick(context, { accent: beat === 0, volume: (audio.audioMuted ? 0 : 0.2 * audio.audioVolume * modes.clickMix / 100), when });
      scheduleTimeout(() => setCountIn(4 - beat), (when - context.currentTime) * 1000);
    }
    beginScheduledPlayback(context, selectedExercise, firstBeat + 4 * beatDuration, generation);
  }, [beginScheduledPlayback, bpm, clearScheduledWork, ensureAudio, modes.clickMix, scheduleTimeout, selectedExercise]);
  const selectExercise = useCallback((exercise: RightHandExercise) => {
    resetSession();
    setTroubleLoop(null);
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
    const previousStreak = progress[selectedExercise.id]?.cleanStreak ?? 0;
    const earnedRamp = rating === "clean" && autoRamp && previousStreak + 1 >= ladderRequiredRounds;
    const nextBpm = earnedRamp && autoRamp
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
            cleanSessions: current.cleanSessions + 1,
            cleanStreak: earnedRamp ? 0 : previousStreak + 1,
            ladderStage: earnedRamp ? (current.ladderStage ?? 0) + 1 : current.ladderStage ?? 0,
            goalTargetBpm,
            goalRequiredRounds,
            goalRoundsAtTarget: bpm >= goalTargetBpm ? Math.min(goalRequiredRounds, (current.goalRoundsAtTarget ?? 0) + 1) : current.goalRoundsAtTarget ?? 0
          }
        };
      });
    }
    if (rating !== "clean") {
      setProgress((previous) => ({
        ...previous,
        [selectedExercise.id]: { ...(previous[selectedExercise.id] ?? { bestBpm: 0, sessions: 1, cleanSessions: 0, totalSeconds: roundSeconds || elapsedSeconds, lastPracticed: new Date().toISOString() }), cleanStreak: 0 }
      }));
    }
    savePracticeResult({
      area: "rightHand", itemId: selectedExercise.id, title: selectedExercise.title,
      seconds: roundSeconds || elapsedSeconds, tempo: bpm,
      score: rating === "clean" ? 100 : rating === "mistakes" ? 68 : 52,
      misses: rating === "clean" ? 0 : rating === "mistakes" ? 2 : 4,
      note: rating === "fast" ? "Tempo felt too fast." : rating === "mistakes" ? "Repeat at the same tempo." : "Self-rated clean round."
    });
    window.dispatchEvent(new CustomEvent("chord-hero:right-hand-rating", { detail: rating }));
    resetSession();
    setBpm(nextBpm);
    const preferences = readPracticeAudioPreferences();
    if (rating === "clean" && preferences.haptics && !preferences.reducedMotion && "vibrate" in navigator) navigator.vibrate([18, 32, 18]);
    setStatusMessage(
      rating === "clean"
        ? earnedRamp && autoRamp ? `${ladderRequiredRounds} clean rounds. Speed ladder advances to ${nextBpm} BPM.` : `Clean streak ${previousStreak + 1}/${ladderRequiredRounds}. Repeat before raising tempo.`
        : rating === "fast" ? `Tempo reduced to ${nextBpm} BPM.` : "Repeat at the same tempo."
    );
  }, [autoRamp, bpm, elapsedSeconds, goalRequiredRounds, goalTargetBpm, ladderRequiredRounds, progress, rampAmount, resetSession, roundSeconds, selectedExercise]);
  const handleRecordingAnalysis = useCallback((analysis: RecordingAnalysis) => {
    if (!selectedExercise) return;
    setProgress((previous) => {
      const current = previous[selectedExercise.id] ?? { bestBpm: 0, sessions: 0, cleanSessions: 0, totalSeconds: 0, lastPracticed: "" };
      return { ...previous, [selectedExercise.id]: {
        ...current,
        bestTimingScore: Math.max(current.bestTimingScore ?? 0, analysis.timingScore),
        recentMisses: analysis.troubleBeats.slice(0, 8),
        lastPracticed: new Date().toISOString()
      } };
    });
    savePracticeResult({
      area: "rightHand", itemId: selectedExercise.id, title: `${selectedExercise.title} · recorded take`,
      seconds: Math.round(analysis.durationMs / 1000), tempo: bpm, score: analysis.timingScore,
      misses: analysis.troubleBeats.length, note: `${analysis.timingTendency}; chord-attack ${analysis.chordAttackScore}%`
    });
  }, [bpm, selectedExercise]);
  const loopTroubleStep = useCallback((step: number, requestedEnd?: number) => {
    if (!selectedExercise) return;
    const start = Math.max(0, Math.min(step, selectedExercise.pattern.length - 1));
    const end = Math.max(start, Math.min(selectedExercise.pattern.length - 1, requestedEnd ?? start + 3));
    setTroubleLoop({ start, end });
    resetSession();
    setStatusMessage(`Looping steps ${start + 1}–${end + 1}.`);
  }, [resetSession, selectedExercise]);
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
  const enableVoiceControl = useCallback(() => {
    type Recognition = { continuous: boolean; lang: string; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };
    type RecognitionConstructor = new () => Recognition;
    const voiceWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Constructor) { setStatusMessage("Voice control is not supported in this browser."); return; }
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").toLowerCase();
      if (/\b(start|play|pause|stop)\b/.test(transcript)) togglePlaybackRef.current();
      if (/\bfaster\b/.test(transcript)) setBpm((value) => Math.min(180, value + 2));
      if (/\bslower\b/.test(transcript)) setBpm((value) => Math.max(40, value - 2));
    };
    recognition.onend = () => setVoiceEnabled(false);
    recognition.start();
    setVoiceEnabled(true);
    setStatusMessage("Voice control ready: start, pause, faster, or slower.");
  }, []);
  const saveCustomRoutine = useCallback(() => {
    if (!selectedExercise) return;
    const tokens = customPattern.trim().split(/[\s,]+/).filter(Boolean);
    if (!customTitle.trim() || tokens.length < 2) {
      setStatusMessage("Name the routine and enter at least two pattern tokens.");
      return;
    }
    void import("../../lib/practicePlatform").then(({ updatePracticePlatformState }) => {
      updatePracticePlatformState((state) => ({ ...state, customRoutines: [...state.customRoutines, {
        id: crypto.randomUUID(), title: customTitle.trim(), pattern: tokens.slice(0, 32),
        technique: selectedExercise.technique, bpm, createdAt: new Date().toISOString()
      }] }));
    });
    setCustomTitle(""); setCustomPattern(""); setCustomRoutineCount((count) => count + 1);
    setStatusMessage("Custom routine saved to your practice workspace.");
  }, [bpm, customPattern, customTitle, selectedExercise]);
  const updateGoal = useCallback((targetBpm: number, requiredRounds: number, timingScore: number, practiceMinutes: number) => {
    if (!selectedExercise) return;
    setProgress((previous) => {
      const current = previous[selectedExercise.id] ?? { bestBpm: 0, sessions: 0, cleanSessions: 0, totalSeconds: 0, lastPracticed: "" };
      return { ...previous, [selectedExercise.id]: { ...current, goalTargetBpm: targetBpm, goalRequiredRounds: requiredRounds, goalTimingScore: timingScore, goalPracticeMinutes: practiceMinutes, goalRoundsAtTarget: 0 } };
    });
    setStatusMessage(`Goal saved: ${requiredRounds} clean rounds, ${targetBpm} BPM, ${timingScore}% timing, ${practiceMinutes} minutes.`);
  }, [selectedExercise]);
  const applyChallenge = useCallback((mode: RightHandChallengeMode) => {
    resetSession(); setChallengeMode(mode);
    if (mode === "sustain") setRoundSeconds(120);
    if (mode === "ladder") setAutoRamp(true);
    if (mode === "silent") setSilentEvery(4);
    setStatusMessage(mode === "standard" ? "Standard practice restored." : `${mode} challenge ready.`);
  }, [resetSession]);
  const playInContext = useCallback(() => {
    if (!selectedExercise) return;
    const params = new URLSearchParams({ context: "right-hand", exercise: selectedExercise.id, tempo: String(bpm), pattern: selectedExercise.pattern.join(" "), style: stylePreset });
    if (chordProgression.length) params.set("progression", chordProgression.join(","));
    window.location.assign(`/songs?${params.toString()}`);
  }, [bpm, chordProgression, selectedExercise, stylePreset]);
  const resetSpeedLadder = useCallback(() => {
    if (!selectedExercise) return;
    setProgress((previous) => {
      const current = previous[selectedExercise.id];
      if (!current) return previous;
      return { ...previous, [selectedExercise.id]: { ...current, cleanStreak: 0, ladderStage: 0 } };
    });
    setBpm(selectedExercise.bpm);
    resetSession();
    setStatusMessage(`Speed ladder reset to ${selectedExercise.bpm} BPM.`);
  }, [resetSession, selectedExercise]);
  const applyStylePreset = useCallback((preset: RightHandStylePreset) => {
    setStylePreset(preset.id);
    setClickFeel(preset.feel);
    setAccentMode(preset.accent);
    setProgressionId(preset.progression);
    const exercise = exerciseById(preset.exerciseId);
    if (exercise) selectExercise(exercise);
    setStatusMessage(`${preset.label} setup loaded. Adjust it freely in advanced tools.`);
  }, [selectExercise]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    if (hydrated) return;
    const savedProgress = window.localStorage.getItem("chord-hero:right-hand:progress");
    const savedSettings = window.localStorage.getItem("chord-hero:right-hand:settings");
    const params = new URLSearchParams(window.location.search);
    if (savedProgress) {
      try { setProgress(JSON.parse(savedProgress)); } catch { }
    }
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (ROUND_OPTIONS.some((option) => option.seconds === settings.roundSeconds)) setRoundSeconds(settings.roundSeconds);
        if (["click", "guitar", "both", "silent"].includes(settings.soundMode)) setSoundMode(settings.soundMode);
        if (PROGRESSIONS.some((item) => item.id === settings.progressionId)) setProgressionId(settings.progressionId);
        else if (settings.backing === "G") setProgressionId("gcd");
        else if (settings.backing === "C") setProgressionId("pop-c");
        if (typeof settings.customProgression === "string") setCustomProgression(settings.customProgression);
        if (typeof settings.stylePreset === "string") setStylePreset(settings.stylePreset);
        if (typeof settings.autoRamp === "boolean") setAutoRamp(settings.autoRamp);
        if ([2, 4, 6].includes(settings.rampAmount)) setRampAmount(settings.rampAmount);
        if (["straight", "swing"].includes(settings.clickFeel)) setClickFeel(settings.clickFeel);
        if (["downbeat", "two-four", "pattern"].includes(settings.accentMode)) setAccentMode(settings.accentMode);
        if ([0, 4, 8].includes(settings.silentEvery)) setSilentEvery(settings.silentEvery);
        if ([2, 3, 4].includes(settings.ladderRequiredRounds)) setLadderRequiredRounds(settings.ladderRequiredRounds);
        if (["standard", "sustain", "ladder", "silent", "random"].includes(settings.challengeMode)) setChallengeMode(settings.challengeMode);
      } catch { }
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
    void import("../../lib/practicePlatform").then(({ readPracticePlatformState }) => {
      setCustomRoutineCount(readPracticePlatformState().customRoutines.length);
    });
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated || !selectedExercise) return;
    window.localStorage.setItem("chord-hero:right-hand:progress", JSON.stringify(progress));
    window.localStorage.setItem("chord-hero:right-hand:technique", technique);
    window.localStorage.setItem("chord-hero:right-hand:difficulty", difficulty);
    window.localStorage.setItem(`chord-hero:right-hand:last:${technique}:${difficulty}`, selectedExercise.id);
    window.localStorage.setItem(`chord-hero:right-hand:tempo:${selectedExercise.id}`, String(bpm));
    window.localStorage.setItem("chord-hero:right-hand:settings", JSON.stringify({
      roundSeconds, soundMode, progressionId, customProgression, stylePreset, autoRamp, rampAmount, clickFeel, accentMode, silentEvery, ladderRequiredRounds, challengeMode
    }));
    const url = new URL(window.location.href);
    url.searchParams.set("exercise", selectedExercise.id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [accentMode, activePathId, autoRamp, bpm, challengeMode, clickFeel, customProgression, difficulty, hydrated, ladderRequiredRounds, progress, progressionId, rampAmount, roundSeconds, selectedExercise, silentEvery, soundMode, stylePreset, technique]);
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
      stylePreset,
      chordProgression,
      troubleLoop,
      goal: { targetBpm: goalTargetBpm, completedRounds: goalRoundsAtTarget, requiredRounds: goalRequiredRounds },
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
  }, [activeStep, bpm, chordProgression, difficulty, elapsedSeconds, goalRequiredRounds, goalRoundsAtTarget, goalTargetBpm, loopsCompleted, roundSeconds, selectedExercise, stylePreset, technique, troubleLoop]);
  useEffect(() => () => clearScheduledWork(), [clearScheduledWork]);
  if (!selectedExercise || !currentStep) return null;
  const motionStyle = { "--target-string": String(currentStep.strings[0] ?? 3) } as CSSProperties;
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
          <span>{exerciseProgress?.sessions ?? 0} rounds · {formatTime(exerciseProgress?.totalSeconds ?? 0)} practised{exerciseProgress?.bestTimingScore ? ` · ${exerciseProgress.bestTimingScore}% timing` : ""}</span>
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
                <strong>{path.title}</strong><span>{path.description}</span><small>{path.exercises.filter((id) => (progress[id]?.cleanSessions ?? 0) > 0).length} / {path.exercises.length} milestones</small>
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
            <RH3D technique={selectedExercise.technique} step={activeStep} strings={currentStep.strings} run={status === "running"} id={selectedExercise.id} loop={loopsCompleted} />
            <div className={`motion-demo technique-${technique} demo-speed-${modes.demoSpeed * 100}`} style={motionStyle}>
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
            <div className={`pattern-stage ${modes.noLook && status === "running" ? "no-look" : ""}`}>
              <div className="pattern-meta">
                <span>{selectedExercise.subdivision}</span>
                <span>{status === "running" ? `${loopsCompleted} loops` : `${selectedExercise.pattern.length} steps`}</span>
              </div>
              <div className="pattern-strip scroll-hint" role="list" aria-label="Follow-along pattern">
                {describedPattern.map((step, index) => (
                  <div
                    className={`pattern-step ${index === activeStep ? "active" : ""} ${step.accent ? "accent" : ""} ${step.rest ? "rest" : ""} ${troubleLoop && index >= troubleLoop.start && index <= troubleLoop.end ? "looped" : ""}`}
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
                  <button key={option.seconds} type="button" className={roundSeconds === option.seconds ? "active" : ""} onClick={() => { setRoundSeconds(option.seconds); setChallengeMode("standard"); }}>{option.label}</button>
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
              <label className="label" htmlFor="right-hand-backing">Chord context</label>
              <select id="right-hand-backing" value={progressionId} onChange={(event) => setProgressionId(event.target.value)}>
                {PROGRESSIONS.map((progression) => <option key={progression.id} value={progression.id}>{progression.label}</option>)}
              </select>
            </div>
            {progressionId === "custom" ? <div className="custom-progression-field"><label className="label" htmlFor="custom-progression">Custom chords</label><input id="custom-progression" value={customProgression} onChange={(event) => setCustomProgression(event.target.value)} placeholder="G C Em D" aria-describedby="custom-progression-help" /><small id="custom-progression-help">2–8 chord symbols, e.g. G C Em D</small></div> : null}
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
          <section className="advanced-tools-launch">
            <div><span className="label">Goals & control</span><strong>{goalRoundsAtTarget} / {goalRequiredRounds} goal rounds · ladder stage {exerciseProgress?.ladderStage ?? 0}</strong></div>
            <button type="button" onClick={() => setShowAdvancedTools((show) => !show)} aria-expanded={showAdvancedTools}>{showAdvancedTools ? "Close advanced controls" : "Open advanced controls"}</button>
          </section>
          {showAdvancedTools ? <RightHandAdvancedTools
            autoRamp={autoRamp} rampAmount={rampAmount} ladderRequiredRounds={ladderRequiredRounds}
            midiEnabled={midiEnabled} voiceEnabled={voiceEnabled} clickFeel={clickFeel} accentMode={accentMode}
            silentEvery={silentEvery} troubleLoop={troubleLoop} activeStep={activeStep} loopsCompleted={loopsCompleted}
            goalTargetBpm={goalTargetBpm} goalRequiredRounds={goalRequiredRounds} goalRoundsAtTarget={goalRoundsAtTarget}
            ladderStage={exerciseProgress?.ladderStage ?? 0} cleanStreak={exerciseProgress?.cleanStreak ?? 0} stylePreset={stylePreset}
            exerciseId={selectedExercise.id} technique={selectedExercise.technique} patternLength={selectedExercise.pattern.length} subdivisionsPerBeat={subdivisionsPerBeat(selectedExercise.subdivision)} challengeMode={challengeMode}
            goalTimingScore={goalTimingScore} goalPracticeMinutes={goalPracticeMinutes} practisedMinutes={(exerciseProgress?.totalSeconds ?? 0) / 60}
            status={status} bpm={bpm} elapsedSeconds={elapsedSeconds} difficulty={difficulty} exercise={selectedExercise} progress={progress}
            onAutoRampChange={setAutoRamp} onRampAmountChange={setRampAmount} onLadderRequiredRoundsChange={setLadderRequiredRounds}
            onResetSpeedLadder={resetSpeedLadder} onEnableMidi={() => void enableMidi()} onEnableVoice={enableVoiceControl}
            onClickFeelChange={setClickFeel} onAccentModeChange={setAccentMode} onSilentEveryChange={setSilentEvery}
            onSetTroubleLoop={loopTroubleStep} onClearTroubleLoop={() => { setTroubleLoop(null); resetSession(); }} onUpdateGoal={updateGoal} onApplyStylePreset={applyStylePreset}
            onChallengeChange={applyChallenge} onPlayInContext={playInContext}
            onModeSettingsChange={setModes} onSetBpm={setBpm} onSelectExercise={selectExercise} onPreparePerformance={() => { if (!chordProgression.length) setProgressionId("pop-g"); setRoundSeconds(60); }} onStartRound={() => togglePlaybackRef.current()}
          /> : null}
          <section className="microphone-coach-launch">
            <div><span className="label">Microphone feedback</span><h3>Compare a short take with the target pulse.</h3><p>Permission is requested only when you start recording. The latest take stays in this browser.</p></div>
            <button type="button" onClick={() => setShowRecordingCoach((show) => !show)}>{showRecordingCoach ? "Close coach" : "Open timing coach"}</button>
          </section>
          {showRecordingCoach ? <RightHandRecordingCoach bpm={bpm} subdivisionsPerBeat={subdivisionsPerBeat(selectedExercise.subdivision)} expectedSteps={selectedExercise.pattern.length} exerciseId={selectedExercise.id} expectedChordProgression={chordProgression} onAnalysis={handleRecordingAnalysis} onLoopTrouble={loopTroubleStep} /> : null}
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
          <details className="technique-clinic">
            <summary>Close-up motion lesson</summary>
            <div className="motion-storyboard" aria-label={`${selectedExercise.technique} motion demonstration`}>
              <span><b>1</b>Set a relaxed grip</span><span><b>2</b>Move through the target string</span><span><b>3</b>Return without locking the wrist</span>
            </div>
            <p>The follow-along and approved media slot respond to the global left/right-handed setting. No media is fetched until you ask for it.</p>
            {showDemoMedia ? <LicensedDemo technique={selectedExercise.technique} /> : <button className="load-demo-media" type="button" onClick={() => setShowDemoMedia(true)}>Load close-up video slot</button>}
          </details>
          <details className="custom-routine-builder">
            <summary>Build a custom routine · {customRoutineCount} saved</summary>
            <div><label>Routine name<input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="My crossing warmup" /></label><label>Pattern tokens<input value={customPattern} onChange={(event) => setCustomPattern(event.target.value)} placeholder={selectedExercise.pattern.join(" ")} /></label><button type="button" onClick={saveCustomRoutine}>Save routine</button></div>
          </details>
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
