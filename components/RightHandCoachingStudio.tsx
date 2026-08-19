"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RIGHT_HAND_EXERCISES, type RightHandExercise } from "../lib/rightHandExercises";
import { describeRightHandStep, type ExerciseProgress } from "../lib/rightHandPracticeRuntime";
import type { RecordingAnalysis } from "../lib/songRecordingAnalysis";

const RightHandTechnique3D = dynamic(() => import("./RightHandTechnique3D"), {
  ssr: false,
  loading: () => <div className="guitar-technique-3d-loading" role="status">Loading the 3D hand coach…</div>
});

export type CoachingFocus = "rhythm" | "strings" | "muting";
export type DynamicsProfile = "even" | "accent-map" | "backbeat" | "crescendo";
export type AnticipationMode = "full" | "adaptive" | "hidden";

type Playlist = { id: string; name: string; exerciseIds: string[] };
type Setup = {
  pick: "fingers" | "thin" | "medium" | "heavy";
  strings: 6 | 7 | 12;
  tuning: "standard" | "drop-d" | "dadgad";
  guitar: "acoustic" | "electric";
};
type TakeSummary = { id: string; createdAt: string; analysis: RecordingAnalysis };
type FootswitchState = "idle" | "requesting" | "selected" | "ready" | "unsupported" | "error";
type BluetoothCharacteristicLike = {
  startNotifications: () => Promise<BluetoothCharacteristicLike>;
  stopNotifications?: () => Promise<BluetoothCharacteristicLike>;
  addEventListener: (name: string, listener: EventListener) => void;
  removeEventListener: (name: string, listener: EventListener) => void;
};
type BluetoothDeviceLike = {
  name?: string;
  gatt?: { connected: boolean; connect: () => Promise<{ getPrimaryService: (uuid: string) => Promise<{ getCharacteristic: (uuid: string) => Promise<BluetoothCharacteristicLike> }> }>; disconnect: () => void };
};

type Props = {
  status: "idle" | "countin" | "running" | "paused" | "complete";
  bpm: number;
  elapsedSeconds: number;
  activeStep: number;
  loopsCompleted: number;
  exercise: RightHandExercise;
  progress: Record<string, ExerciseProgress>;
  playlists: Playlist[];
  chordProgression: string[];
  focus: CoachingFocus;
  dynamics: DynamicsProfile;
  ghostStrum: boolean;
  anticipation: AnticipationMode;
  onModeChange: (patch: { focus?: CoachingFocus; dynamics?: DynamicsProfile; ghostStrum?: boolean; anticipation?: AnticipationMode }) => void;
  onSetRoundSeconds: (seconds: number) => void;
  onSelectExercise: (exercise: RightHandExercise) => void;
  onToggleRound: () => void;
};

const SETUP_KEY = "chord-hero:right-hand:guitar-setup:v1";
const RECORDING_KEY = "chord-hero:right-hand:recording-history:v2";
const FOOTSWITCH_KEY = "chord-hero:right-hand:footswitch:v1";
const DEFAULT_SETUP: Setup = { pick: "medium", strings: 6, tuning: "standard", guitar: "acoustic" };
const OPEN_STRING_HZ = [329.63, 246.94, 196, 146.83, 110, 82.41];

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

function boundedSetup(value: unknown): Setup {
  const raw = value && typeof value === "object" ? value as Partial<Setup> : {};
  return {
    pick: ["fingers", "thin", "medium", "heavy"].includes(raw.pick ?? "") ? raw.pick! : DEFAULT_SETUP.pick,
    strings: [6, 7, 12].includes(raw.strings ?? 0) ? raw.strings! : 6,
    tuning: ["standard", "drop-d", "dadgad"].includes(raw.tuning ?? "") ? raw.tuning! : "standard",
    guitar: ["acoustic", "electric"].includes(raw.guitar ?? "") ? raw.guitar! : "acoustic"
  };
}

function likelyStrings(analysis: RecordingAnalysis | null, targets: readonly number[]) {
  const frequency = analysis?.detectedPitch?.frequencyHz;
  if (!frequency) return [];
  const candidates = OPEN_STRING_HZ.flatMap((open, index) => frequency >= open * 0.94 && frequency <= open * 3.2 ? [index + 1] : []);
  const targetMatches = candidates.filter((string) => targets.includes(string));
  return (targetMatches.length ? targetMatches : candidates).slice(0, 3);
}

function alternateRoutes(exercise: RightHandExercise, target: readonly number[]) {
  if (exercise.technique === "strumming") return [[1, 2, 3, 4, 5, 6], [3, 4, 5, 6], [1, 2, 3, 4]];
  if (exercise.technique === "plectrum") {
    const base = target[0] ?? 3;
    return [[base], [Math.max(1, base - 1)], [Math.min(6, base + 1)]];
  }
  return [target.length ? [...target] : [6, 3, 2, 1], [6, 4, 3, 2], [5, 3, 2, 1]];
}

function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RightHandCoachingStudio(props: Props) {
  const { exercise, onSelectExercise, onSetRoundSeconds, onToggleRound } = props;
  const [show3D, setShow3D] = useState(false);
  const [routeIndex, setRouteIndex] = useState(0);
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [takes, setTakes] = useState<TakeSummary[]>([]);
  const [observed, setObserved] = useState<RecordingAnalysis | null>(null);
  const [rehearsal, setRehearsal] = useState<{ ids: string[]; index: number } | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  const [footswitch, setFootswitch] = useState<FootswitchState>("idle");
  const [footswitchName, setFootswitchName] = useState("");
  const [serviceUuid, setServiceUuid] = useState("");
  const [characteristicUuid, setCharacteristicUuid] = useState("");
  const [shareName, setShareName] = useState("");
  const deviceRef = useRef<BluetoothDeviceLike | null>(null);
  const characteristicRef = useRef<BluetoothCharacteristicLike | null>(null);
  const notificationRef = useRef<EventListener | null>(null);
  const previousStatusRef = useRef(props.status);

  const described = useMemo(() => props.exercise.pattern.map((token) => describeRightHandStep(token, props.exercise.technique)), [props.exercise]);
  const current = described[props.activeStep] ?? described[0];
  const routes = useMemo(() => alternateRoutes(props.exercise, current?.strings ?? []), [current?.strings, props.exercise]);
  const route = routes[Math.min(routeIndex, routes.length - 1)] ?? [];
  const possibleObserved = likelyStrings(observed, route);
  const currentChord = props.chordProgression.length ? props.chordProgression[props.loopsCompleted % props.chordProgression.length] : "No chord backing";
  const exerciseProgress = props.progress[props.exercise.id];
  const anticipationOpacity = props.anticipation === "hidden" ? 0 : props.anticipation === "full" ? 1 : Math.max(.18, 1 - (exerciseProgress?.cleanSessions ?? 0) * .14);

  const weakestTechnique = useMemo(() => {
    const totals = (["strumming", "plectrum", "fingerpicking"] as const).map((technique) => {
      const exercises = RIGHT_HAND_EXERCISES.filter((item) => item.technique === technique);
      const sessions = exercises.reduce((sum, item) => sum + (props.progress[item.id]?.sessions ?? 0), 0);
      const clean = exercises.reduce((sum, item) => sum + (props.progress[item.id]?.cleanSessions ?? 0), 0);
      return { technique, score: sessions ? clean / sessions : 0 };
    });
    return totals.sort((a, b) => a.score - b.score)[0].technique;
  }, [props.progress]);
  const todayWarmup = RIGHT_HAND_EXERCISES.find((item) => item.technique === weakestTechnique && item.difficulty === "beginner") ?? props.exercise;
  const musicalExercise = RIGHT_HAND_EXERCISES.find((item) => item.technique === props.exercise.technique && item.difficulty === "intermediate") ?? props.exercise;

  useEffect(() => {
    setSetup(boundedSetup(readJson(SETUP_KEY, DEFAULT_SETUP)));
    const savedFoot = readJson<{ service?: string; characteristic?: string }>(FOOTSWITCH_KEY, {});
    setServiceUuid(typeof savedFoot.service === "string" ? savedFoot.service.slice(0, 80) : "");
    setCharacteristicUuid(typeof savedFoot.characteristic === "string" ? savedFoot.characteristic.slice(0, 80) : "");
  }, []);

  useEffect(() => {
    const all = readJson<Record<string, TakeSummary[]>>(RECORDING_KEY, {});
    const retained = Array.isArray(all[props.exercise.id]) ? all[props.exercise.id].slice(0, 2) : [];
    setTakes(retained); setObserved(retained[0]?.analysis ?? null);
    setRouteIndex(0);
  }, [props.exercise.id]);

  useEffect(() => {
    const onAnalysis = (event: Event) => {
      const detail = (event as CustomEvent<{ exerciseId?: string; analysis?: RecordingAnalysis }>).detail;
      if (detail?.exerciseId !== props.exercise.id || !detail.analysis) return;
      setObserved(detail.analysis);
      const all = readJson<Record<string, TakeSummary[]>>(RECORDING_KEY, {});
      setTakes((all[props.exercise.id] ?? []).slice(0, 2));
    };
    window.addEventListener("chord-hero:right-hand-analysis", onAnalysis);
    return () => window.removeEventListener("chord-hero:right-hand-analysis", onAnalysis);
  }, [props.exercise.id]);

  const saveSetup = useCallback((patch: Partial<Setup>) => {
    setSetup((currentSetup) => {
      const next = boundedSetup({ ...currentSetup, ...patch });
      localStorage.setItem(SETUP_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const startWith = useCallback((exercise: RightHandExercise, seconds: number) => {
    onSelectExercise(exercise); onSetRoundSeconds(seconds);
    requestAnimationFrame(() => requestAnimationFrame(onToggleRound));
  }, [onSelectExercise, onSetRoundSeconds, onToggleRound]);

  const beginRehearsal = useCallback((playlist: Playlist) => {
    const ids = playlist.exerciseIds.filter((id) => RIGHT_HAND_EXERCISES.some((item) => item.id === id)).slice(0, 12);
    const first = RIGHT_HAND_EXERCISES.find((item) => item.id === ids[0]);
    if (!first) return;
    setRehearsal({ ids, index: 0 }); setRestRemaining(0); startWith(first, 60);
  }, [startWith]);

  useEffect(() => {
    const completed = props.status === "complete" && previousStatusRef.current !== "complete";
    previousStatusRef.current = props.status;
    if (completed && rehearsal) setRestRemaining(10);
  }, [props.status, rehearsal]);

  useEffect(() => {
    if (!rehearsal || restRemaining <= 0) return;
    const timer = window.setTimeout(() => {
      if (restRemaining > 1) { setRestRemaining((value) => value - 1); return; }
      const nextIndex = rehearsal.index + 1;
      const next = RIGHT_HAND_EXERCISES.find((item) => item.id === rehearsal.ids[nextIndex]);
      if (!next) { setRestRemaining(0); setRehearsal(null); return; }
      setRestRemaining(0); setRehearsal({ ...rehearsal, index: nextIndex }); startWith(next, 60);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [rehearsal, restRemaining, startWith]);

  const footAction = useCallback((action: "toggle" | "repeat" | "mark") => {
    if (action === "toggle") onToggleRound();
    if (action === "repeat") startWith(exercise, 60);
    if (action === "mark") window.dispatchEvent(new CustomEvent("chord-hero:right-hand-rating", { detail: "mistakes" }));
  }, [exercise, onToggleRound, startWith]);

  useEffect(() => {
    const keyboardFallback = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const action = event.key === "F8" ? "toggle" : event.key === "F9" ? "repeat" : event.key === "F10" ? "mark" : null;
      if (action) { event.preventDefault(); footAction(action); }
    };
    window.addEventListener("keydown", keyboardFallback);
    return () => window.removeEventListener("keydown", keyboardFallback);
  }, [footAction]);

  const disconnectFootswitch = useCallback(() => {
    const characteristic = characteristicRef.current;
    if (characteristic && notificationRef.current) characteristic.removeEventListener("characteristicvaluechanged", notificationRef.current);
    void characteristic?.stopNotifications?.().catch(() => undefined);
    deviceRef.current?.gatt?.disconnect();
    characteristicRef.current = null; notificationRef.current = null; deviceRef.current = null;
    setFootswitch("idle"); setFootswitchName("");
  }, []);

  useEffect(() => () => disconnectFootswitch(), [disconnectFootswitch]);

  const connectFootswitch = async () => {
    type BluetoothNavigator = Navigator & { bluetooth?: { requestDevice: (options: { acceptAllDevices: true; optionalServices?: string[] }) => Promise<BluetoothDeviceLike> } };
    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!bluetooth) { setFootswitch("unsupported"); return; }
    setFootswitch("requesting");
    try {
      const service = serviceUuid.trim(); const characteristicId = characteristicUuid.trim();
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: service ? [service] : undefined });
      deviceRef.current = device; setFootswitchName(device.name || "Selected BLE device");
      if (!service || !characteristicId || !device.gatt) { setFootswitch("selected"); return; }
      const server = await device.gatt.connect();
      const characteristic = await (await server.getPrimaryService(service)).getCharacteristic(characteristicId);
      const listener: EventListener = (event) => {
        const value = (event.target as { value?: DataView } | null)?.value?.getUint8(0);
        footAction(value === 2 ? "repeat" : value === 3 ? "mark" : "toggle");
      };
      characteristic.addEventListener("characteristicvaluechanged", listener); await characteristic.startNotifications();
      characteristicRef.current = characteristic; notificationRef.current = listener;
      localStorage.setItem(FOOTSWITCH_KEY, JSON.stringify({ service: service.slice(0, 80), characteristic: characteristicId.slice(0, 80) }));
      setFootswitch("ready");
    } catch { setFootswitch("error"); }
  };

  const exportPeerChallenge = () => {
    downloadJson({
      schema: "chord-hero-right-hand-peer-challenge-v1", title: `${props.exercise.title} challenge`,
      creator: shareName.trim().slice(0, 60) || "Anonymous player", attribution: `Chord Hero authored drill: ${props.exercise.title}`,
      exerciseIds: [props.exercise.id], targetBpm: props.bpm, createdAt: new Date().toISOString(),
      privacy: { audioIncluded: false, recordingIdsIncluded: false, profileIncluded: false },
      moderation: { conductRequired: true, reportingEndpoint: null, note: "This is a local file. Review it before sharing; no hosted moderation service is implied." }
    }, `chord-hero-${props.exercise.id}-peer-challenge.json`);
  };

  const milestones = [
    { label: "Five attentive rounds", done: (exerciseProgress?.sessions ?? 0) >= 5 },
    { label: "Three controlled rounds", done: (exerciseProgress?.cleanSessions ?? 0) >= 3 },
    { label: "Timing consistency 85%", done: (exerciseProgress?.bestTimingScore ?? 0) >= 85 },
    { label: "Two-round clean streak", done: (exerciseProgress?.cleanStreak ?? 0) >= 2 }
  ];
  const recentMisses = exerciseProgress?.recentMisses?.length ?? 0;
  const practiceAdvice = recentMisses >= 3
    ? `Switch to ${weakestTechnique === props.exercise.technique ? "a contrasting technique" : weakestTechnique} or take a short rest; recent timing misses are clustering.`
    : (exerciseProgress?.totalSeconds ?? 0) >= 900 ? "Balance this block with another technique or a short rest before adding speed." : "Your recent load is modest; one focused round is a sensible next step.";

  return <div className="right-hand-coaching-studio">
    <section className="today-focus-card" aria-labelledby="today-focus-title">
      <header><div><span className="label">Today&apos;s focus</span><h4 id="today-focus-title">Warm up · technique · music</h4>{props.status === "running" ? <small>{Math.max(0, 180 - props.elapsedSeconds)} seconds remain in a three-minute block</small> : null}</div><button type="button" onClick={() => startWith(todayWarmup, 180)}>Start 3-minute session</button></header>
      <div><button type="button" onClick={() => props.onSelectExercise(todayWarmup)}><span>Warmup</span><strong>{todayWarmup.title}</strong></button><button type="button" onClick={() => props.onSelectExercise(props.exercise)}><span>Technical</span><strong>{props.exercise.title}</strong></button><button type="button" onClick={() => props.onSelectExercise(musicalExercise)}><span>Apply</span><strong>{musicalExercise.title}</strong><small>{currentChord}</small></button></div>
    </section>

    <details><summary>3D right-hand coach & string-hit feedback</summary><div className="three-d-coach-intro"><div><strong>{props.exercise.technique === "fingerpicking" ? "Finger assignment at the soundhole" : props.exercise.technique === "plectrum" ? "Pick path across the strings" : "Strum path across the strings"}</strong><p>The right hand plays the strings near the soundhole or bridge. <b>{currentChord}</b> names the chord context; its frets are held by the left hand.</p></div><button type="button" aria-expanded={show3D} onClick={() => setShow3D((value) => !value)}>{show3D ? "Close 3D coach" : "Open 3D coach"}</button></div>
      <div className="route-picker" aria-label="Alternate string routes">{routes.map((strings, index) => <button type="button" key={strings.join("-")} className={routeIndex === index ? "active" : ""} aria-pressed={routeIndex === index} onClick={() => setRouteIndex(index)}>Route {index + 1}: {strings.join("–")}</button>)}</div>
      {show3D ? <RightHandTechnique3D technique={props.exercise.technique} step={props.activeStep} strings={route} run={props.status === "running"} id={props.exercise.id} loop={props.loopsCompleted} chordName={currentChord} /> : null}
      <div className="string-hit-feedback"><div><span className="label">Target strings</span><div className="string-lanes">{[1, 2, 3, 4, 5, 6].map((string) => <i key={string} className={route.includes(string) ? "target" : ""}><b>{string}</b></i>)}</div></div><div><span className="label">Observed after latest take</span><div className="string-lanes">{[1, 2, 3, 4, 5, 6].map((string) => <i key={string} className={possibleObserved.includes(string) ? "observed" : ""}><b>{string}</b></i>)}</div></div><p>{observed?.detectedPitch ? `Estimated possible string route from ${observed.detectedPitch.note} pitch evidence (${Math.min(60, observed.detectedPitch.confidence)}% display confidence). Fretted notes are ambiguous across strings.` : "No pitch evidence yet. The live onset guide can detect an attack, but it cannot identify an individual string."}</p></div>
    </details>

    <details open><summary>Dynamics, one-problem coaching & ghost strokes</summary><div className="coaching-constraint-grid">
      <label>Coach only<select value={props.focus} onChange={(event) => props.onModeChange({ focus: event.target.value as CoachingFocus })}><option value="rhythm">Rhythm</option><option value="strings">String accuracy</option><option value="muting">Muting</option></select><small>{props.focus === "rhythm" ? "Feedback prioritizes pulse placement." : props.focus === "strings" ? "Follow target routes; microphone string identity remains estimated." : "Listen for short releases and controlled silence."}</small></label>
      <label>Volume target<select value={props.dynamics} onChange={(event) => props.onModeChange({ dynamics: event.target.value as DynamicsProfile })}><option value="even">Even control</option><option value="accent-map">Written accents</option><option value="backbeat">Backbeat lift</option><option value="crescendo">One-loop crescendo</option></select><small>The demo volume follows this map; scoring remains directional.</small></label>
      <label className="check-card"><input type="checkbox" checked={props.ghostStrum} onChange={(event) => props.onModeChange({ ghostStrum: event.target.checked })} /> Ghost unaccented offbeats<small>The hand keeps moving while selected demo strokes stay silent.</small></label>
      <label>Anticipation cue<select value={props.anticipation} onChange={(event) => props.onModeChange({ anticipation: event.target.value as AnticipationMode })}><option value="full">Always visible</option><option value="adaptive">Fade with clean rounds</option><option value="hidden">Hidden</option></select><small>Visual support only; your pattern is unchanged.</small></label>
    </div><div className="dynamics-target" aria-label={`${props.dynamics} target dynamics`}>{described.map((step, index) => { const level = props.dynamics === "crescendo" ? .35 + index / Math.max(1, described.length - 1) * .65 : props.dynamics === "backbeat" ? (index % 4 === 1 || index % 4 === 3 ? 1 : .48) : props.dynamics === "accent-map" ? (step.accent ? 1 : .55) : 1; return <i key={index} className={index === props.activeStep ? "active" : ""} style={{ height: `${Math.round(level * 100)}%` }}><span>{Math.round(level * 100)}</span></i>; })}</div><div className="anticipation-cue" style={{ opacity: anticipationOpacity }}><span>Next</span><strong>{described[(props.activeStep + 1) % described.length]?.main ?? "—"}</strong><small>{Math.round(anticipationOpacity * 100)}% visual support</small></div></details>

    <details><summary>Guitar setup, milestones & practice load</summary><div className="guitar-setup-grid"><label>Pick<select value={setup.pick} onChange={(event) => saveSetup({ pick: event.target.value as Setup["pick"] })}><option value="fingers">Fingers / nails</option><option value="thin">Thin pick</option><option value="medium">Medium pick</option><option value="heavy">Heavy pick</option></select></label><label>Strings<select value={setup.strings} onChange={(event) => saveSetup({ strings: Number(event.target.value) as Setup["strings"] })}><option value={6}>6-string</option><option value={7}>7-string</option><option value={12}>12-string</option></select></label><label>Tuning<select value={setup.tuning} onChange={(event) => saveSetup({ tuning: event.target.value as Setup["tuning"] })}><option value="standard">Standard</option><option value="drop-d">Drop D</option><option value="dadgad">DADGAD</option></select></label><label>Guitar<select value={setup.guitar} onChange={(event) => saveSetup({ guitar: event.target.value as Setup["guitar"] })}><option value="acoustic">Acoustic</option><option value="electric">Electric</option></select></label></div><p className="setup-cue">Cue: {setup.pick === "heavy" ? "use a shallow pick depth" : setup.pick === "thin" ? "let the pick flex without gripping harder" : setup.pick === "fingers" ? "keep nail/flesh contact consistent" : "keep a relaxed pinch"}; {setup.tuning === "standard" ? "standard target labels apply" : `${setup.tuning.toUpperCase()} changes pitch context`}. The 3D route remains a six-string teaching view for {setup.strings}-string setups.</p><div className="control-milestones">{milestones.map((item) => <span key={item.label} className={item.done ? "done" : ""}>{item.done ? "✓" : "○"} {item.label}</span>)}</div><div className="practice-load-advice"><span className="label">Rest / switch recommendation</span><strong>{practiceAdvice}</strong><small>Based only on local practice totals and recent recorded misses, not fatigue diagnosis.</small></div></details>

    <details><summary>Before/after, rehearsal & private peer challenge</summary><div className="take-summary"><span className="label">Before / after · retained metadata</span>{takes.length >= 2 ? <><div><strong>Before · {new Date(takes[1].createdAt).toLocaleDateString()}</strong><span>{takes[1].analysis.timingScore}% timing · {takes[1].analysis.chordAttackScore}% attack clarity</span></div><div><strong>After · {new Date(takes[0].createdAt).toLocaleDateString()}</strong><span>{takes[0].analysis.timingScore}% timing · {takes[0].analysis.chordAttackScore}% attack clarity</span></div><p>Change: {takes[0].analysis.timingScore - takes[1].analysis.timingScore >= 0 ? "+" : ""}{takes[0].analysis.timingScore - takes[1].analysis.timingScore} timing. Use Microphone Feedback below to hear the same retained audio; no copy was made.</p></> : <p>Keep two takes in the Microphone Feedback panel to compare scores and hear them side by side.</p>}</div>
      <div className="rehearsal-playlists"><span className="label">Rehearsal mode · 60-sec drills + 10-sec rests</span>{props.playlists.length ? props.playlists.map((playlist) => <button type="button" key={playlist.id} onClick={() => beginRehearsal(playlist)} disabled={Boolean(rehearsal)}>{playlist.name} · {playlist.exerciseIds.length} drills</button>) : <p>Create a named playlist above, then rehearse it here.</p>}{rehearsal ? <div role="status"><strong>{restRemaining ? `Rest ${restRemaining}s` : `Drill ${rehearsal.index + 1}/${rehearsal.ids.length}`}</strong><button type="button" onClick={() => { setRehearsal(null); setRestRemaining(0); }}>End rehearsal</button></div> : null}</div>
      <div className="peer-challenge-export"><label>Public display name (optional)<input value={shareName} maxLength={60} onChange={(event) => setShareName(event.target.value)} placeholder="Anonymous player" /></label><div><strong>Privacy-first challenge file</strong><p>Exports this drill, tempo, attribution, and conduct metadata only. No profile, recording, or audio ID is included. Sharing and moderation happen outside Chord Hero.</p></div><button type="button" onClick={exportPeerChallenge}>Export peer challenge</button></div>
    </details>

    <details><summary>Bluetooth footswitch & keyboard fallback</summary><div className="footswitch-controls"><p>Web Bluetooth is opt-in and hardware-specific. Choose a device only from this button; Chord Hero never scans in the background. Known pedals can provide service and characteristic UUIDs.</p><label>Service UUID<input value={serviceUuid} onChange={(event) => setServiceUuid(event.target.value.slice(0, 80))} placeholder="Optional hardware UUID" /></label><label>Characteristic UUID<input value={characteristicUuid} onChange={(event) => setCharacteristicUuid(event.target.value.slice(0, 80))} placeholder="Optional control UUID" /></label><button type="button" onClick={() => void connectFootswitch()} disabled={footswitch === "requesting" || footswitch === "ready"}>{footswitch === "requesting" ? "Choose in browser…" : "Choose Bluetooth pedal"}</button>{footswitch !== "idle" ? <span role="status">{footswitch === "ready" ? `${footswitchName} ready` : footswitch === "selected" ? `${footswitchName} selected; add its UUIDs to receive controls` : footswitch === "unsupported" ? "Web Bluetooth is unavailable; use keyboard controls" : footswitch === "error" ? "Pedal connection was cancelled or failed" : "Waiting for device choice"}</span> : null}{deviceRef.current ? <button type="button" onClick={disconnectFootswitch}>Forget for this session</button> : null}</div><div className="footswitch-actions"><button type="button" onClick={() => footAction("toggle")}>Start / pause <kbd>F8</kbd></button><button type="button" onClick={() => footAction("repeat")}>Repeat drill <kbd>F9</kbd></button><button type="button" onClick={() => footAction("mark")}>Mark difficulty <kbd>F10</kbd></button></div></details>
  </div>;
}
