"use client";
import LocalizedCopy from "../../components/LocalizedCopy";
import { useLocale } from "../../lib/localeClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRightHandAudioIsolation } from "../../lib/rightHandAudioIsolation";
import dynamic from "next/dynamic";
import {
  DIFFICULTY_DETAILS,
  RIGHT_HAND_EXERCISES,
  TECHNIQUE_DETAILS,
  RightHandDifficulty,
  RightHandExercise,
  RightHandTechnique
} from "../../lib/rightHandExercises";
import type { RightHandCopyKey } from "../../lib/rightHandCopy";
import {
  playRecordedBackingPulse,
  playRecordedClick,
  playRecordedGuitarStep,
} from "../../lib/recordedAudio";
import type { RecordingAnalysis } from "../../lib/songRecordingAnalysis";
import { RIGHT_HAND_GUIDED_PATHS as GUIDED_PATHS, RIGHT_HAND_PROGRESSIONS as PROGRESSIONS } from "../../lib/rightHandPracticePresets";
import type { PracticeModeSettings, RightHandChallengeMode, RightHandStylePreset } from "../../components/RightHandAdvancedTools";
import { useRightHandMidi } from "../../lib/useRightHandMidi";
import { useRightHandVoiceControl } from "../../lib/useRightHandVoiceControl";
import { useRightHandTapTempo } from "../../lib/useRightHandTapTempo";
import { useRightHandRoutineApplication } from "../../lib/useRightHandRoutineApplication";
import { DEFAULT_RIGHT_HAND_MODE_SETTINGS, describeRightHandStep as describeStep, formatPracticeTime as formatTime, readPracticeAudioPreferences, rememberedRightHandTempo as rememberedTempo, rightHandDynamicsLevel as dynamicsLevel, rightHandExerciseById as exerciseById, rightHandSubdivisionsPerBeat as subdivisionsPerBeat, saveRightHandPracticeResult as savePracticeResult, shouldPlayStyleBacking, validCustomProgression, type ExerciseProgress } from "../../lib/rightHandPracticeRuntime";
import RightHandFollowAlong from "../../components/RightHandFollowAlong";
import RightHandSetupControls from "../../components/RightHandSetupControls";
import RightHandPracticeHeader from "../../components/RightHandPracticeHeader";
import RightHandLearningLaunch from "../../components/RightHandLearningLaunch";
import { useRightHandQuickSession } from "../../lib/useRightHandQuickSession";
import { useRightHandLearningPreferences } from "../../lib/useRightHandLearningPreferences";
import { readRightHandSession, useRightHandSessionContinuity } from "../../lib/rightHandSessionContinuity";
const RightHandRoutineBuilder = dynamic(() => import("../../components/RightHandRoutineBuilder"), { ssr: false });
const RightHandLearningJourney = dynamic(() => import("../../components/RightHandLearningJourney"), { ssr: false });
const RightHandCourses = dynamic(() => import("../../components/RightHandCourses"), { ssr: false, loading: () => <div className="recording-coach-loading">Loading courses…</div> });
const RightHandRecordingCoach = dynamic(() => import("../../components/RightHandRecordingCoach"), { ssr: false, loading: () => <div className="recording-coach-loading">Loading coach…</div> });
const LicensedDemo = dynamic(() => import("../../components/LicensedDemo"), { ssr: false, loading: () => <p>Loading demo…</p> });
const RightHandAdvancedTools = dynamic(() => import("../../components/RightHandAdvancedTools"), { ssr: false, loading: () => <div className="recording-coach-loading">Loading controls…</div> });
const RightHandLiveCoach = dynamic(() => import("../../components/RightHandLiveCoach"), { ssr: false, loading: () => <div className="recording-coach-loading">Loading 3D coach…</div> });
const RightHandSessionRecap = dynamic(() => import("../../components/RightHandSessionRecap"));
type PracticeStatus = "idle" | "countin" | "running" | "paused" | "complete";
type SoundMode = "click" | "guitar" | "both" | "silent";
type Rating = "clean" | "mistakes" | "fast";
type ClickFeel = "straight" | "swing";
type AccentMode = "downbeat" | "two-four" | "pattern";
const TECHNIQUES = Object.keys(TECHNIQUE_DETAILS) as RightHandTechnique[];
const DIFFICULTIES = Object.keys(DIFFICULTY_DETAILS) as RightHandDifficulty[];
const TECHNIQUE_DESCRIPTION_KEYS: Record<RightHandTechnique, RightHandCopyKey> = {
  strumming: "strummingDescription", plectrum: "plectrumDescription", fingerpicking: "fingerpickingDescription"
};
const DIFFICULTY_DESCRIPTION_KEYS: Record<RightHandDifficulty, RightHandCopyKey> = {
  beginner: "beginnerDescription", intermediate: "intermediateDescription", expert: "expertDescription"
};
export default function RightHandPage() {
  const { t } = useLocale();
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
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to practise");
  const [clickFeel, setClickFeel] = useState<ClickFeel>("straight");
  const [accentMode, setAccentMode] = useState<AccentMode>("pattern");
  const [silentEvery, setSilentEvery] = useState(0);
  const [troubleLoop, setTroubleLoop] = useState<{ start: number; end: number } | null>(null);
  const [showRecordingCoach, setShowRecordingCoach] = useState(false);
  const [ladderRequiredRounds, setLadderRequiredRounds] = useState(2);
  const [showDemoMedia, setShowDemoMedia] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [challengeMode, setChallengeMode] = useState<RightHandChallengeMode>("standard");
  const [modes, setModes] = useState<PracticeModeSettings>(DEFAULT_RIGHT_HAND_MODE_SETTINGS);
  const [latestRecordedResult, setLatestRecordedResult] = useState<{ exerciseId: string; analysis: RecordingAnalysis } | null>(null);
  const [activeRoutine, setActiveRoutine] = useState<{ routineId: string; baseExerciseId: string; title: string; pattern: string[] } | null>(null);
  const [retryRange, setRetryRange] = useState<{ start: number; end: number } | null>(null);
  const { layout, setLayout, requestStart, bindStart } = useRightHandLearningPreferences(bpm, setBpm, setLatestRecordedResult, setProgress);
  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const timeoutsRef = useRef<Set<number>>(new Set());
  const sourcesGenerationRef = useRef(0);
  const statusRef = useRef<PracticeStatus>("idle");
  const togglePlaybackRef = useRef<() => void>(() => undefined);
  const loopTroubleStepRef = useRef<(step: number, requestedEnd?: number) => { start: number; end: number } | undefined>();
  const startSessionRef = useRef<() => Promise<void>>(async () => undefined);
  const activeStepRef = useRef(activeStep);
  const troubleLoopRef = useRef(troubleLoop);
  activeStepRef.current = activeStep;
  troubleLoopRef.current = troubleLoop;
  const { midiEnabled, midiConfig, midiInputs, midiStatus, setMidiConfig, enableMidi, disableMidi } = useRightHandMidi({
    onToggle: () => togglePlaybackRef.current(),
    onRepeatLoop: () => {
      const loop = troubleLoopRef.current;
      if (!loop) return false;
      loopTroubleStepRef.current?.(loop.start, loop.end);
      window.setTimeout(() => { void startSessionRef.current(); }, 0);
      return true;
    },
    onMarkStep: () => {
      const step = activeStepRef.current;
      setTroubleLoop({ start: step, end: step });
      setStatusMessage(`Marked active step ${step + 1} for a MIDI trouble loop.`);
      return `Marked active step ${step + 1}.`;
    }
  });
  const { voiceEnabled, enableVoiceControl } = useRightHandVoiceControl({ onToggle: () => togglePlaybackRef.current(), setTempo: setBpm });
  const exercises = useMemo(
    () => RIGHT_HAND_EXERCISES.filter((exercise) => exercise.technique === technique && exercise.difficulty === difficulty),
    [difficulty, technique]
  );
  const baseExercise = exerciseById(selectedId) ?? exercises[0];
  const selectedExercise = useMemo(() => {
    if (!baseExercise || !activeRoutine || activeRoutine.baseExerciseId !== baseExercise.id) return baseExercise;
    return { ...baseExercise, title: `${activeRoutine.title} · custom`, focus: `Custom routine based on ${baseExercise.title}`, pattern: activeRoutine.pattern };
  }, [activeRoutine, baseExercise]);
  useRightHandSessionContinuity(baseExercise, bpm, troubleLoop, hydrated);
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
  const finishSession = useCallback(() => {
    if (!selectedExercise || !["running", "countin"].includes(statusRef.current)) return;
    clearScheduledWork();
    statusRef.current = "complete";
    setStatus("complete");
    setElapsedSeconds(roundSeconds || elapsedSeconds);
    setStatusMessage("Round complete. Rate the feel before continuing.");
    if (!activeRoutine) setProgress((previous) => {
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
  }, [activeRoutine, clearScheduledWork, elapsedSeconds, roundSeconds, selectedExercise]);
  const pauseSession = useCallback(() => {
    void audioContextRef.current?.suspend();
    clearScheduledWork();
    if (!["running", "countin"].includes(statusRef.current)) return;
    statusRef.current = "paused";
    setStatus("paused");
    setStatusMessage("Paused");
  }, [clearScheduledWork]);
  const { liveMic: liveMicRef, silenceForCapture, ensureAudio } = useRightHandAudioIsolation(audioContextRef, pauseSession);
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
  const applyRoutine = useRightHandRoutineApplication({ baseExercise, resetSession, setActiveRoutine, setBpm, setStatusMessage });
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
        const masterVolume = preferences.audioMuted || liveMicRef.current ? 0 : preferences.audioVolume;
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
        const level = dynamicsLevel(modes.dynamics, stepOrdinal, patternIndexes.length, beatNumber, step.accent);
        const when = nextStepTime;
        if (!step.rest && !isSilentGap && masterVolume > 0 && (soundMode === "click" || soundMode === "both")) {
          void playRecordedClick(context, { accent: metronomeAccent, volume: 0.13 * masterVolume * modes.clickMix / 100, when });
        }
        if (!step.rest && !(modes.ghostStrum && exercise.technique === "strumming" && !metronomeAccent && subdivisionIndex > 0) && masterVolume > 0 && (soundMode === "guitar" || soundMode === "both")) {
          void playRecordedGuitarStep(context, {
            token: rawStep,
            technique: exercise.technique,
            accent: level >= .85,
            volume: (soundMode === "both" ? 0.15 : 0.22) * masterVolume * modes.guitarMix / 100 * level,
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
      window.dispatchEvent(new CustomEvent("chord-hero:right-hand-pattern-start", {
        detail: {
          startAt: performance.now(),
          bpm,
          subdivision: exercise.subdivision,
          technique: exercise.technique,
          pattern: patternIndexes.map((index) => exercise.pattern[index])
        }
      }));
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
  }, [accentMode, bpm, challengeMode, chordProgression, clickFeel, finishSession, liveMicRef, modes, roundSeconds, scheduleTimeout, silentEvery, soundMode, stylePreset, troubleLoop]);
  const startSession = useCallback(async () => {
    if (!selectedExercise || statusRef.current === "running" || statusRef.current === "countin") return;
    window.dispatchEvent(new Event("chord-hero:right-hand-start"));
    clearScheduledWork();
    const generation = sourcesGenerationRef.current;
    const context = await ensureAudio();
    if (generation !== sourcesGenerationRef.current) return;
    const beatDuration = 60 / bpm;
    const firstBeat = context.currentTime + 0.08;
    statusRef.current = "countin";
    setStatus("countin");
    setCountIn(4);
    setStatusMessage("Count in");
    for (let beat = 0; beat < 4; beat += 1) {
      const when = firstBeat + beat * beatDuration;
      const audio = readPracticeAudioPreferences();
      if (!liveMicRef.current) void playRecordedClick(context, { accent: beat === 0, volume: (audio.audioMuted ? 0 : 0.2 * audio.audioVolume * modes.clickMix / 100), when });
      scheduleTimeout(() => setCountIn(4 - beat), (when - context.currentTime) * 1000);
    }
    beginScheduledPlayback(context, selectedExercise, firstBeat + 4 * beatDuration, generation);
  }, [beginScheduledPlayback, bpm, clearScheduledWork, ensureAudio, liveMicRef, modes.clickMix, scheduleTimeout, selectedExercise]);
  startSessionRef.current = startSession;
  const selectExercise = useCallback((exercise: RightHandExercise) => {
    resetSession();
    setActiveRoutine(null);
    setTroubleLoop(null);
    setTechnique(exercise.technique);
    setDifficulty(exercise.difficulty);
    setSelectedId(exercise.id);
    setBpm(rememberedTempo(exercise, progress[exercise.id]?.bestBpm));
  }, [progress, resetSession]);
  bindStart(startSession);
  useEffect(() => {
    if (!retryRange || troubleLoop?.start !== retryRange.start || troubleLoop.end !== retryRange.end) return;
    setRetryRange(null); void startSession();
  }, [retryRange, startSession, troubleLoop]);
  const changeFilters = useCallback((nextTechnique: RightHandTechnique, nextDifficulty: RightHandDifficulty) => {
    resetSession();
    setActiveRoutine(null);
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
    if (activeRoutine) {
      resetSession();
      setBpm(nextBpm);
      setStatusMessage("Custom routine round complete. It was not added to authored exercise history.");
      return;
    }
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
  }, [activeRoutine, autoRamp, bpm, elapsedSeconds, goalRequiredRounds, goalTargetBpm, ladderRequiredRounds, progress, rampAmount, resetSession, roundSeconds, selectedExercise]);
  const handleRecordingAnalysis = useCallback((analysis: RecordingAnalysis) => {
    if (!selectedExercise) return;
    setLatestRecordedResult({ exerciseId: selectedExercise.id, analysis });
    if (activeRoutine) {
      setStatusMessage("Custom routine take kept for listening; authored exercise history was unchanged.");
      return;
    }
    if (analysis.scoreReliability !== "reliable" || analysis.reviewAccepted === false) {
      setStatusMessage("Take kept for listening, but weak signal was excluded from progress and goal scoring.");
      return;
    }
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
      misses: analysis.troubleBeats.length, recordingId: analysis.recordingId, reviewAccepted: analysis.reviewAccepted, scoreReliability: analysis.scoreReliability, timingEvidenceCount: analysis.timingEvidenceCount, expectedTimingCount: analysis.expectedTimingCount,
      rightHandContext: {
        tempo: analysis.practiceContext?.bpm ?? bpm,
        pattern: [...(analysis.practiceContext?.pattern ?? selectedExercise.pattern)],
        chordProgression: [...(analysis.practiceContext?.chordProgression ?? chordProgression)],
        scoringMode: analysis.analysisOptions?.pitchScoringMode ?? "quality",
        instrumentProfile: analysis.analysisOptions?.instrumentProfile ?? "acoustic",
        retained: analysis.retained === true
      },
      note: `${analysis.timingTendency}; chord-attack ${analysis.chordAttackScore}%`
    });
  }, [activeRoutine, bpm, chordProgression, selectedExercise]);
  const loopTroubleStep = useCallback((step: number, requestedEnd?: number) => {
    if (!selectedExercise) return;
    const start = Math.max(0, Math.min(Number.isFinite(step) ? Math.floor(step) : 0, selectedExercise.pattern.length - 1));
    const end = Math.max(start, Math.min(selectedExercise.pattern.length - 1, Number.isFinite(requestedEnd ?? start + 3) ? Math.floor(requestedEnd ?? start + 3) : start));
    setTroubleLoop({ start, end });
    resetSession();
    setStatusMessage(`Looping steps ${start + 1}–${end + 1}.`);
    return { start, end };
  }, [resetSession, selectedExercise]);
  loopTroubleStepRef.current = loopTroubleStep;
  const tapTempo = useRightHandTapTempo(setBpm);
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
        if ([0, 30, 60, 120, 180].includes(settings.roundSeconds)) setRoundSeconds(settings.roundSeconds);
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
    const session = readRightHandSession(RIGHT_HAND_EXERCISES);
    const initial = linkedExercise ?? exerciseById(session?.exerciseId ?? null) ?? remembered;
    if (initial) {
      setTechnique(initial.technique);
      setDifficulty(initial.difficulty);
      setSelectedId(initial.id);
      const savedTempo = Number(window.localStorage.getItem(`chord-hero:right-hand:tempo:${initial.id}`));
      const resume = session?.exerciseId === initial.id;
      setBpm(resume ? session.bpm : Number.isFinite(savedTempo) && savedTempo >= 40 && savedTempo <= 180 ? savedTempo : initial.bpm);
      if (resume) { setTroubleLoop(session.loop); setStatusMessage("Previous drill restored. Press Play when ready; audio has not started."); }
    }
    try { sessionStorage.removeItem("chord-hero:right-hand:restore-pending"); } catch { } setHydrated(true);
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated || !selectedExercise) return;
    const persist = () => { try { if (sessionStorage.getItem("chord-hero:right-hand:restore-pending")) return;
    window.localStorage.setItem("chord-hero:right-hand:progress", JSON.stringify(progress));
    window.localStorage.setItem("chord-hero:right-hand:technique", technique);
    window.localStorage.setItem("chord-hero:right-hand:difficulty", difficulty);
    window.localStorage.setItem(`chord-hero:right-hand:last:${technique}:${difficulty}`, selectedExercise.id);
    window.localStorage.setItem(`chord-hero:right-hand:tempo:${selectedExercise.id}`, String(bpm));
    window.localStorage.setItem("chord-hero:right-hand:settings", JSON.stringify({
      roundSeconds, soundMode, progressionId, customProgression, stylePreset, autoRamp, rampAmount, clickFeel, accentMode, silentEvery, ladderRequiredRounds, challengeMode
    }));
    } catch { } };
    const timer = window.setTimeout(persist, 180);
    const hidden = () => { if (document.visibilityState === "hidden") persist(); };
    window.addEventListener("pagehide", persist); document.addEventListener("visibilitychange", hidden);
    const url = new URL(window.location.href);
    url.searchParams.set("exercise", selectedExercise.id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", persist); document.removeEventListener("visibilitychange", hidden); };
  }, [accentMode, activePathId, autoRamp, bpm, challengeMode, clickFeel, customProgression, difficulty, hydrated, ladderRequiredRounds, progress, progressionId, rampAmount, roundSeconds, selectedExercise, silentEvery, soundMode, stylePreset, technique, troubleLoop]);
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
  useRightHandQuickSession({ exercise: selectedExercise, bpm, progressionId, seconds: roundSeconds, status, select: selectExercise, tempo: setBpm, progression: setProgressionId, duration: setRoundSeconds, pause: pauseSession, start: startSession });
  if (!selectedExercise || !currentStep) return null;
  return (
    <main className={`page right-hand-page layout-${layout}`}>
      <RightHandPracticeHeader progress={exerciseProgress} />
      <RightHandLearningLaunch layout={layout} onLayout={setLayout} open={showLearning} onToggle={() => setShowLearning((show) => !show)} />
      {showLearning ? <RightHandLearningJourney exercise={selectedExercise} bpm={bpm} progressionId={progressionId} chordProgression={chordProgression} onApplyTransfer={(tempo, progression) => { resetSession(); setTroubleLoop(null); setBpm(tempo); setProgressionId(progression); }} audioAllowed={!showRecordingCoach && !liveMicRef.current} onApplyTempo={(tempo) => { pauseSession(); requestStart(tempo); }} onSelectExercise={selectExercise} onPause={pauseSession} onRecord={() => { setShowRecordingCoach(true); setShowLearning(false); }} /> : null}
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
              <span><strong>{t(item)}</strong><small>{t(TECHNIQUE_DESCRIPTION_KEYS[item])}</small></span>
            </button>
          );
        })}
      </section>
      <RightHandCourses activeId={activePathId} onActive={setActivePathId} progress={progress} onSelect={selectExercise} />
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
                {t(item === "expert" ? "expert" : item)}
              </button>
            ))}
          </div>
          <div className="exercise-browser-heading">
            <div><span className="label">{t(difficulty === "expert" ? "expert" : difficulty)}</span><p>{t(DIFFICULTY_DESCRIPTION_KEYS[difficulty])}</p></div>
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
              <span className="label">{t(technique)} · {t(difficulty === "expert" ? "expert" : difficulty)}</span>
              <h2>{selectedExercise.title}</h2>
              <p>{selectedExercise.focus}</p>
              {activePath && pathIndex >= 0 && <small>Path: {activePath.title} · step {pathIndex + 1} of {activePath.exercises.length}</small>}
            </div>
            <span className="exercise-position">{selectedIndex + 1} / {exercises.length}</span>
          </header>
          <RightHandLiveCoach technique={selectedExercise.technique} step={activeStep} strings={currentStep.strings} pattern={selectedExercise.pattern} stepDurationMs={60000 / bpm / subdivisionsPerBeat(selectedExercise.subdivision)} run={status === "running"} id={selectedExercise.id} loop={loopsCompleted} chordName={chordProgression[loopsCompleted % Math.max(1, chordProgression.length)]} />
          <RightHandFollowAlong status={status} technique={technique} demoSpeed={modes.demoSpeed} noLook={modes.noLook} countIn={countIn} activeStep={activeStep} loopsCompleted={loopsCompleted} selectedExercise={selectedExercise} currentStep={currentStep} describedPattern={describedPattern} troubleLoop={troubleLoop} />
          <details className="beginner-session-settings" open={layout === "advanced" || undefined}><summary>Round sound & chord settings</summary><RightHandSetupControls roundSeconds={roundSeconds} soundMode={soundMode} progressionId={progressionId} customProgression={customProgression} onRound={(seconds) => { setRoundSeconds(seconds); setChallengeMode("standard"); }} onSound={setSoundMode} onProgression={setProgressionId} onCustom={setCustomProgression} /></details>
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
              <label htmlFor="right-hand-tempo"><span><LocalizedCopy id="tempo" /></span><strong>{bpm} BPM</strong></label>
              <input id="right-hand-tempo" type="range" min="40" max="180" step="2" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
              <div><span>40</span><button type="button" onClick={tapTempo}>Tap tempo</button><button type="button" onClick={() => setBpm(selectedExercise.bpm)}><LocalizedCopy id="reset" />{" "}{selectedExercise.bpm}</button><span>180</span></div>
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
            midiEnabled={midiEnabled} midiStatus={midiStatus} midiInputs={midiInputs} midiConfig={midiConfig} voiceEnabled={voiceEnabled} clickFeel={clickFeel} accentMode={accentMode}
            silentEvery={silentEvery} troubleLoop={troubleLoop} activeStep={activeStep} loopsCompleted={loopsCompleted}
            goalTargetBpm={goalTargetBpm} goalRequiredRounds={goalRequiredRounds} goalRoundsAtTarget={goalRoundsAtTarget}
            ladderStage={exerciseProgress?.ladderStage ?? 0} cleanStreak={exerciseProgress?.cleanStreak ?? 0} stylePreset={stylePreset}
            exerciseId={selectedExercise.id} technique={selectedExercise.technique} patternLength={selectedExercise.pattern.length} subdivisionsPerBeat={subdivisionsPerBeat(selectedExercise.subdivision)} challengeMode={challengeMode}
            goalTimingScore={goalTimingScore} goalPracticeMinutes={goalPracticeMinutes} practisedMinutes={(exerciseProgress?.totalSeconds ?? 0) / 60}
            status={status} bpm={bpm} elapsedSeconds={elapsedSeconds} difficulty={difficulty} exercise={selectedExercise} progress={progress} chordProgression={chordProgression}
            onAutoRampChange={setAutoRamp} onRampAmountChange={setRampAmount} onLadderRequiredRoundsChange={setLadderRequiredRounds}
            onResetSpeedLadder={resetSpeedLadder} onEnableMidi={() => void enableMidi()} onDisableMidi={disableMidi} onMidiConfigChange={setMidiConfig} onEnableVoice={enableVoiceControl}
            onClickFeelChange={setClickFeel} onAccentModeChange={setAccentMode} onSilentEveryChange={setSilentEvery}
            onSetTroubleLoop={loopTroubleStep} onClearTroubleLoop={() => { setTroubleLoop(null); resetSession(); }} onUpdateGoal={updateGoal} onApplyStylePreset={applyStylePreset}
            onChallengeChange={applyChallenge} onPlayInContext={playInContext}
            onModeSettingsChange={setModes} onSetBpm={setBpm} onSelectExercise={selectExercise} onPreparePerformance={() => { if (!chordProgression.length) setProgressionId("pop-g"); setRoundSeconds(60); }} onStartRound={() => void startSession()} onPauseRound={pauseSession} onSetRoundSeconds={setRoundSeconds}
          /> : null}
          <section className="microphone-coach-launch">
            <div><span className="label">Microphone feedback</span><h3>Record a take.</h3><p>Start to grant microphone access. Audio stays in this browser.</p></div>
            <button type="button" onClick={() => setShowRecordingCoach((show) => !show)}>{showRecordingCoach ? "Close coach" : "Open timing coach"}</button>
          </section>
          {showRecordingCoach ? <RightHandRecordingCoach bpm={bpm} subdivisionsPerBeat={subdivisionsPerBeat(selectedExercise.subdivision)} expectedSteps={selectedExercise.pattern.length} expectedPattern={selectedExercise.pattern} exerciseId={selectedExercise.id} expectedChordProgression={chordProgression} targetTechnique={selectedExercise.technique} targetSound={modes.targetSound} onBeforeRecord={silenceForCapture} onAnalysis={handleRecordingAnalysis} onLoopTrouble={loopTroubleStep} onRetryRange={(start, end) => { const range = loopTroubleStep(start, end); if (range) setRetryRange(range); }} /> : null}
          {status === "complete" && (
            <section className="round-feedback" aria-labelledby="round-feedback-title">
              <div><span className="label">Round complete</span><h3 id="round-feedback-title"><LocalizedCopy id="howFeel" /></h3><p>Your answer sets the next tempo and updates this drill&apos;s progress.</p></div>
              <div>
                <button type="button" onClick={() => rateSession("clean")}><strong><LocalizedCopy id="clean" /></strong><span>{autoRamp ? `Raise ${rampAmount} BPM` : "Save result"}</span></button>
                <button type="button" onClick={() => rateSession("mistakes")}><strong><LocalizedCopy id="aFewMistakes" /></strong><span>Repeat this tempo</span></button>
                <button type="button" onClick={() => rateSession("fast")}><strong><LocalizedCopy id="tooFast" /></strong><span>Lower 6 BPM</span></button>
              </div>
              <RightHandSessionRecap analysis={latestRecordedResult?.exerciseId === selectedExercise.id ? latestRecordedResult.analysis : null} patternLength={selectedExercise.pattern.length} title={selectedExercise.title} loops={loopsCompleted} bpm={bpm} seconds={roundSeconds || elapsedSeconds} onLoop={loopTroubleStep} />
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
          <RightHandRoutineBuilder exercise={baseExercise} bpm={bpm} activeRoutineId={activeRoutine?.routineId} onApplyRoutine={applyRoutine} />
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
