"use client";

import { useEffect, useState } from "react";
import RightHandPracticeModes, { type PracticeModeSettings } from "./RightHandPracticeModes";
import type { RightHandDifficulty, RightHandExercise } from "../lib/rightHandExercises";
import type { ExerciseProgress } from "../lib/rightHandPracticeRuntime";

export type { PracticeModeSettings } from "./RightHandPracticeModes";

export type RightHandStylePreset = {
  id: string;
  label: string;
  exerciseId: string;
  feel: "straight" | "swing";
  accent: "downbeat" | "two-four" | "pattern";
  progression: string;
};
export type RightHandChallengeMode = "standard" | "sustain" | "ladder" | "silent" | "random";

const STYLE_PRESETS: RightHandStylePreset[] = [
  { id: "neutral", label: "Core", exerciseId: "strum-eighth-engine", feel: "straight", accent: "pattern", progression: "off" },
  { id: "reggae", label: "Reggae", exerciseId: "strum-reggae", feel: "straight", accent: "two-four", progression: "pop-g" },
  { id: "funk", label: "Funk", exerciseId: "strum-funk", feel: "straight", accent: "pattern", progression: "pop-c" },
  { id: "shuffle", label: "Shuffle", exerciseId: "strum-backbeat", feel: "swing", accent: "two-four", progression: "blues-a" },
  { id: "bluegrass", label: "Bluegrass", exerciseId: "pick-crosspicking", feel: "straight", accent: "downbeat", progression: "gcd" },
  { id: "bossa", label: "Bossa nova", exerciseId: "finger-syncopated-pinch", feel: "straight", accent: "pattern", progression: "pop-c" },
  { id: "travis", label: "Travis", exerciseId: "finger-travis", feel: "straight", accent: "downbeat", progression: "gcd" }
];

type Props = {
  autoRamp: boolean;
  rampAmount: number;
  ladderRequiredRounds: number;
  midiEnabled: boolean;
  voiceEnabled: boolean;
  clickFeel: "straight" | "swing";
  accentMode: "downbeat" | "two-four" | "pattern";
  silentEvery: number;
  troubleLoop: { start: number; end: number } | null;
  activeStep: number;
  loopsCompleted: number;
  goalTargetBpm: number;
  goalRequiredRounds: number;
  goalRoundsAtTarget: number;
  ladderStage: number;
  cleanStreak: number;
  stylePreset: string;
  exerciseId: string;
  technique: "strumming" | "plectrum" | "fingerpicking";
  patternLength: number;
  subdivisionsPerBeat: number;
  challengeMode: RightHandChallengeMode;
  goalTimingScore: number;
  goalPracticeMinutes: number;
  practisedMinutes: number;
  status: "idle" | "countin" | "running" | "paused" | "complete";
  bpm: number;
  elapsedSeconds: number;
  difficulty: RightHandDifficulty;
  exercise: RightHandExercise;
  progress: Record<string, ExerciseProgress>;
  onAutoRampChange: (value: boolean) => void;
  onRampAmountChange: (value: number) => void;
  onLadderRequiredRoundsChange: (value: number) => void;
  onResetSpeedLadder: () => void;
  onEnableMidi: () => void;
  onEnableVoice: () => void;
  onClickFeelChange: (value: "straight" | "swing") => void;
  onAccentModeChange: (value: "downbeat" | "two-four" | "pattern") => void;
  onSilentEveryChange: (value: number) => void;
  onSetTroubleLoop: (start: number, end: number) => void;
  onClearTroubleLoop: () => void;
  onUpdateGoal: (targetBpm: number, requiredRounds: number, timingScore: number, practiceMinutes: number) => void;
  onApplyStylePreset: (preset: RightHandStylePreset) => void;
  onChallengeChange: (mode: RightHandChallengeMode) => void;
  onPlayInContext: () => void;
  onModeSettingsChange: (settings: PracticeModeSettings) => void;
  onSetBpm: (bpm: number) => void;
  onSelectExercise: (exercise: RightHandExercise) => void;
  onPreparePerformance: () => void;
  onStartRound: () => void;
};

const SETUP_KEY = "chord-hero:right-hand:setup-checklist:v1";
const SETUP_ITEMS = ["posture", "pick grip", "metronome volume", "tuning", "room noise", "chord calibration"] as const;

export default function RightHandAdvancedTools(props: Props) {
  const [setup, setSetup] = useState<string[]>([]);
  const [overlay, setOverlay] = useState<"muting" | "palm" | "angle" | "fingers">("angle");
  const [leftHanded, setLeftHanded] = useState(false);
  const [customStart, setCustomStart] = useState(1);
  const [customEnd, setCustomEnd] = useState(Math.min(4, props.patternLength));
  useEffect(() => {
    try {
      setSetup(JSON.parse(localStorage.getItem(SETUP_KEY) ?? "[]"));
      const platform = JSON.parse(localStorage.getItem("chord-hero:practice-platform:v1") ?? "null");
      setLeftHanded(platform?.accessibility?.handedness === "left");
    } catch { /* Ignore malformed local preferences. */ }
  }, []);
  const toggleSetup = (item: string) => setSetup((current) => {
    const next = current.includes(item) ? current.filter((value) => value !== item) : [...current, item];
    localStorage.setItem(SETUP_KEY, JSON.stringify(next)); return next;
  });
  const applyLoopLength = (steps: number) => {
    const start = Math.max(0, Math.min(props.activeStep, props.patternLength - 1));
    props.onSetTroubleLoop(start, Math.min(props.patternLength - 1, start + steps - 1));
  };
  return (
    <section className="right-hand-advanced-panel" aria-label="Advanced practice controls">
      <section className="style-presets" aria-label="Choose a musical style setup">
        <span className="label">Style setup</span>
        <div className="style-preset-strip scroll-hint">{STYLE_PRESETS.map((preset) => <button key={preset.id} type="button" className={props.stylePreset === preset.id ? "active" : ""} aria-pressed={props.stylePreset === preset.id} onClick={() => props.onApplyStylePreset(preset)}>{preset.label}</button>)}</div>
        <small>Style presets choose a suitable drill, feel, accent map, and chord context. Every control remains editable.</small>
      </section>
      <div className="practice-options">
        <label><input type="checkbox" checked={props.autoRamp} onChange={(event) => props.onAutoRampChange(event.target.checked)} /> Use gradual speed ladder</label>
        <select aria-label="Automatic tempo increase" value={props.rampAmount} onChange={(event) => props.onRampAmountChange(Number(event.target.value))} disabled={!props.autoRamp}>
          <option value={2}>+2 BPM</option><option value={4}>+4 BPM</option><option value={6}>+6 BPM</option>
        </select>
        <select aria-label="Clean rounds required per ladder step" value={props.ladderRequiredRounds} onChange={(event) => props.onLadderRequiredRoundsChange(Number(event.target.value))} disabled={!props.autoRamp}>
          <option value={2}>2 clean rounds</option><option value={3}>3 clean rounds</option><option value={4}>4 clean rounds</option>
        </select>
        <button type="button" onClick={props.onResetSpeedLadder}>Reset ladder</button>
        <button type="button" className={props.midiEnabled ? "active" : ""} onClick={props.onEnableMidi}>{props.midiEnabled ? "MIDI pedal ready" : "Enable MIDI pedal"}</button>
        <button type="button" className={props.voiceEnabled ? "active" : ""} onClick={props.onEnableVoice}>{props.voiceEnabled ? "Voice ready" : "Voice control"}</button>
      </div>

      <section className="exercise-goal" aria-labelledby="exercise-goal-title">
        <div><span className="label">Four-dimensional goal</span><h3 id="exercise-goal-title">{props.goalRoundsAtTarget >= props.goalRequiredRounds ? "Clean-round goal complete" : `${props.goalRoundsAtTarget} / ${props.goalRequiredRounds} clean rounds at ${props.goalTargetBpm} BPM`}</h3><div className="goal-progress" role="progressbar" aria-label="Exercise goal progress" aria-valuemin={0} aria-valuemax={props.goalRequiredRounds} aria-valuenow={props.goalRoundsAtTarget}><i style={{ width: `${Math.min(100, props.goalRoundsAtTarget / props.goalRequiredRounds * 100)}%` }} /></div><small>Timing {props.goalTimingScore}% · practice {Math.round(props.practisedMinutes)} / {props.goalPracticeMinutes} min</small></div>
        <div className="goal-controls">
          <label>Target BPM<input type="number" min="40" max="180" step="2" value={props.goalTargetBpm} onChange={(event) => props.onUpdateGoal(Math.max(40, Math.min(180, Number(event.target.value))), props.goalRequiredRounds, props.goalTimingScore, props.goalPracticeMinutes)} /></label>
          <label>Clean rounds<select value={props.goalRequiredRounds} onChange={(event) => props.onUpdateGoal(props.goalTargetBpm, Number(event.target.value), props.goalTimingScore, props.goalPracticeMinutes)}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={5}>5</option></select></label>
          <label>Timing score<input type="number" min="50" max="100" step="1" value={props.goalTimingScore} onChange={(event) => props.onUpdateGoal(props.goalTargetBpm, props.goalRequiredRounds, Math.max(50, Math.min(100, Number(event.target.value))), props.goalPracticeMinutes)} /></label>
          <label>Practice minutes<input type="number" min="1" max="120" step="1" value={props.goalPracticeMinutes} onChange={(event) => props.onUpdateGoal(props.goalTargetBpm, props.goalRequiredRounds, props.goalTimingScore, Math.max(1, Math.min(120, Number(event.target.value))))} /></label>
          <small>Ladder stage {props.ladderStage} · streak {props.cleanStreak}/{props.ladderRequiredRounds}</small>
        </div>
      </section>

      <section className="challenge-mode-panel" aria-labelledby="challenge-mode-title"><header><span className="label">Challenge mode</span><h3 id="challenge-mode-title">Choose one constraint</h3></header><div>{([
        ["standard", "Standard", "Your current round settings"], ["sustain", "2-minute sustain", "Hold accuracy for 120 seconds"], ["ladder", "Speed ladder", "Advance after clean rounds"], ["silent", "Silent recovery", "Every fourth beat disappears"], ["random", "Random accents", "Deterministic changing accents"]
      ] as const).map(([id, label, help]) => <button type="button" key={id} className={props.challengeMode === id ? "active" : ""} aria-pressed={props.challengeMode === id} onClick={() => props.onChallengeChange(id)}><strong>{label}</strong><span>{help}</span></button>)}</div></section>

      <details className="advanced-practice-tools" open>
        <summary>Feel, silent bars & trouble loops</summary>
        <div className="advanced-practice-grid">
          <label>Feel<select value={props.clickFeel} onChange={(event) => props.onClickFeelChange(event.target.value as Props["clickFeel"])}><option value="straight">Straight</option><option value="swing">Swing eighths</option></select></label>
          <label>Accents<select value={props.accentMode} onChange={(event) => props.onAccentModeChange(event.target.value as Props["accentMode"])}><option value="pattern">Pattern + beat</option><option value="downbeat">Beat 1</option><option value="two-four">Beats 2 & 4</option></select></label>
          <label>Silent-gap challenge<select value={props.silentEvery} onChange={(event) => props.onSilentEveryChange(Number(event.target.value))}><option value={0}>Off</option><option value={4}>Every 4th beat</option><option value={8}>Every 8th beat</option></select></label>
          <label>Loop length<select defaultValue="beat" onChange={(event) => { const value = event.target.value; if (value === "beat") applyLoopLength(props.subdivisionsPerBeat); if (value === "bar") applyLoopLength(props.subdivisionsPerBeat * 4); if (value === "two-bars") applyLoopLength(props.subdivisionsPerBeat * 8); }}><option value="beat">One beat</option><option value="bar">One bar</option><option value="two-bars">Two bars</option><option value="custom">Custom range</option></select></label>
          <button type="button" onClick={() => applyLoopLength(props.subdivisionsPerBeat)}>Loop current beat</button>
          {props.troubleLoop ? <button type="button" onClick={props.onClearTroubleLoop}>Clear trouble loop</button> : null}
        </div>
        <div className="custom-loop-range"><label>Custom start<input type="number" min={1} max={props.patternLength} value={customStart} onChange={(event) => setCustomStart(Number(event.target.value))} /></label><label>Custom end<input type="number" min={customStart} max={props.patternLength} value={customEnd} onChange={(event) => setCustomEnd(Number(event.target.value))} /></label><button type="button" onClick={() => props.onSetTroubleLoop(Math.max(0, customStart - 1), Math.max(customStart - 1, customEnd - 1))}>Apply exact range</button></div>
        <div className="challenge-checkpoint"><strong>{props.loopsCompleted >= 4 ? "Checkpoint reached" : `${Math.min(props.loopsCompleted, 4)} / 4 clean loops`}</strong><span>{props.loopsCompleted >= 4 ? "Listen back or rate the round before adding speed." : "Stay relaxed through four loops; silent gaps make the checkpoint harder."}</span></div>
      </details>

      <details className="pre-practice-checklist"><summary>Setup checklist · {setup.length}/{SETUP_ITEMS.length}</summary><div>{SETUP_ITEMS.map((item) => <label key={item}><input type="checkbox" checked={setup.includes(item)} onChange={() => toggleSetup(item)} /> {item}</label>)}</div><small>Saved locally. It is a preparation aid, not a medical or tuning diagnosis.</small></details>

      <section className={`hand-position-clinic ${leftHanded ? "mirrored" : ""}`} aria-labelledby="hand-position-title"><header><div><span className="label">Hand-position overlay</span><h3 id="hand-position-title">{leftHanded ? "Left-handed" : "Right-handed"} visual cue</h3></div><span>{props.technique}</span></header><div className="hand-overlay-tabs">{(["muting", "palm", "angle", "fingers"] as const).map((item) => <button key={item} type="button" className={overlay === item ? "active" : ""} aria-pressed={overlay === item} onClick={() => setOverlay(item)}>{item}</button>)}</div><div className={`hand-overlay-diagram overlay-${overlay}`} role="img" aria-label={`${leftHanded ? "Left-handed mirrored" : "Right-handed"} ${overlay} placement guide`}><i className="bridge" /><i className="palm" /><i className="pick" /><i className="finger f1" /><i className="finger f2" /><i className="finger f3" /><b>{overlay === "muting" ? "Touch lightly near the bridge; do not press the string to the fretboard." : overlay === "palm" ? "Rest the heel at the bridge edge so ringing can be controlled without locking the wrist." : overlay === "angle" ? "Tilt the pick slightly through the string and keep the stroke compact." : "P = thumb · i = index · m = middle · a = ring; assign one finger per target string."}</b></div></section>

      <button type="button" className="play-in-context" onClick={props.onPlayInContext}><strong>Play it in context</strong><span>Open this exercise, tempo, pattern, and progression in Song Coach →</span></button>

      <section className="practice-safety-strip" aria-label="Technique preparation and recovery">
        <div><span className="label">Warm up · 90 sec</span><strong>Muted strings at half tempo</strong><p>Keep the pick grip light and make the motion smaller than feels necessary.</p></div>
        <div><span className="label">Cool down · 60 sec</span><strong>Open-hand reset</strong><p>Stop for sharp pain, numbness, or persistent tension. Shake out gently; never stretch into pain.</p></div>
      </section>

      <RightHandPracticeModes status={props.status} bpm={props.bpm} elapsedSeconds={props.elapsedSeconds} loopsCompleted={props.loopsCompleted} exercise={props.exercise} technique={props.technique} difficulty={props.difficulty} progress={props.progress} onSettingsChange={props.onModeSettingsChange} onSetBpm={props.onSetBpm} onSelectExercise={props.onSelectExercise} onPreparePerformance={props.onPreparePerformance} onStartRound={props.onStartRound} />
    </section>
  );
}
