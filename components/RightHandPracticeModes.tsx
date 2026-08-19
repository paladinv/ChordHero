"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RIGHT_HAND_EXERCISES, type RightHandDifficulty, type RightHandExercise, type RightHandTechnique } from "../lib/rightHandExercises";
import type { ExerciseProgress } from "../lib/rightHandPracticeRuntime";
import type { AnticipationMode, CoachingFocus, DynamicsProfile } from "./RightHandCoachingStudio";

const RightHandCoachingStudio = dynamic(() => import("./RightHandCoachingStudio"), {
  ssr: false,
  loading: () => <div className="recording-coach-loading" role="status">Loading the coaching studio…</div>
});

export type RightHandTargetSound = "acoustic-strum" | "muted-funk" | "fingerstyle" | "clean-electric";
export type PracticeModeSettings = {
  targetSound: RightHandTargetSound;
  demoSpeed: 1 | 0.75 | 0.5;
  noLook: boolean;
  clickMix: number;
  guitarMix: number;
  contextMix: number;
  performanceMode: boolean;
  focus: CoachingFocus;
  dynamics: DynamicsProfile;
  ghostStrum: boolean;
  anticipation: AnticipationMode;
};

type Props = {
  status: "idle" | "countin" | "running" | "paused" | "complete";
  bpm: number;
  elapsedSeconds: number;
  activeStep: number;
  loopsCompleted: number;
  exercise: RightHandExercise;
  technique: RightHandTechnique;
  difficulty: RightHandDifficulty;
  progress: Record<string, ExerciseProgress>;
  chordProgression: string[];
  onSettingsChange: (settings: PracticeModeSettings) => void;
  onSetBpm: (bpm: number) => void;
  onSelectExercise: (exercise: RightHandExercise) => void;
  onPreparePerformance: () => void;
  onStartRound: () => void;
  onSetRoundSeconds: (seconds: number) => void;
};

type Playlist = { id: string; name: string; exerciseIds: string[] };
type ChallengePack = {
  schema: "chord-hero-right-hand-pack-v1";
  title: string;
  creator: string;
  license: string;
  attribution: string;
  offlineCompatible: true;
  sourceUrl?: string;
  exerciseIds: string[];
};

const SETTINGS_KEY = "chord-hero:right-hand:practice-modes:v1";
const LIBRARY_KEY = "chord-hero:right-hand:personal-library:v1";
const PACKS_KEY = "chord-hero:right-hand:challenge-packs:v1";
const DEFAULT_SETTINGS: PracticeModeSettings = { targetSound: "clean-electric", demoSpeed: 1, noLook: false, clickMix: 80, guitarMix: 75, contextMix: 45, performanceMode: false, focus: "rhythm", dynamics: "even", ghostStrum: false, anticipation: "adaptive" };
const TARGET_SOUNDS: Array<{ id: RightHandTargetSound; label: string; help: string }> = [
  { id: "acoustic-strum", label: "Acoustic strum", help: "Open, rounded sample voicing" },
  { id: "muted-funk", label: "Muted funk", help: "Short, dry attack reference" },
  { id: "fingerstyle", label: "Fingerstyle", help: "Softer individual-note reference" },
  { id: "clean-electric", label: "Clean electric", help: "Clear, even picking reference" }
];
const SKILL_LABELS = ["Rhythm", "String accuracy", "Dynamics", "Muting", "Thumb independence", "Speed"] as const;

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

function boundedLibrary(value: unknown) {
  const raw = value && typeof value === "object" ? value as { bookmarks?: unknown; playlists?: unknown; notes?: unknown } : {};
  const ids = new Set(RIGHT_HAND_EXERCISES.map((exercise) => exercise.id));
  const bookmarks = Array.isArray(raw.bookmarks) ? raw.bookmarks.filter((id): id is string => typeof id === "string" && ids.has(id)).slice(0, 80) : [];
  const playlists = Array.isArray(raw.playlists) ? raw.playlists.flatMap((entry): Playlist[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Partial<Playlist>;
    if (typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim() || !Array.isArray(item.exerciseIds)) return [];
    return [{ id: item.id.slice(0, 80), name: item.name.trim().slice(0, 48), exerciseIds: item.exerciseIds.filter((id): id is string => typeof id === "string" && ids.has(id)).slice(0, 24) }];
  }).slice(0, 12) : [];
  const notes = raw.notes && typeof raw.notes === "object" ? Object.fromEntries(Object.entries(raw.notes).filter(([id, note]) => ids.has(id) && typeof note === "string").slice(0, 80).map(([id, note]) => [id, (note as string).slice(0, 240)])) : {};
  return { bookmarks, playlists, notes: notes as Record<string, string> };
}

function validatePack(value: unknown): ChallengePack | null {
  if (!value || typeof value !== "object") return null;
  const pack = value as Partial<ChallengePack>;
  const ids = new Set(RIGHT_HAND_EXERCISES.map((exercise) => exercise.id));
  const exerciseIds = Array.isArray(pack.exerciseIds) ? pack.exerciseIds.filter((id): id is string => typeof id === "string" && ids.has(id)).slice(0, 36) : [];
  const validUrl = pack.sourceUrl === undefined || (typeof pack.sourceUrl === "string" && /^https:\/\//.test(pack.sourceUrl));
  if (pack.schema !== "chord-hero-right-hand-pack-v1" || pack.offlineCompatible !== true || !exerciseIds.length || !validUrl) return null;
  if (![pack.title, pack.creator, pack.license, pack.attribution].every((field) => typeof field === "string" && field.trim().length > 1)) return null;
  return { schema: pack.schema, title: pack.title!.trim().slice(0, 80), creator: pack.creator!.trim().slice(0, 80), license: pack.license!.trim().slice(0, 80), attribution: pack.attribution!.trim().slice(0, 240), offlineCompatible: true, sourceUrl: pack.sourceUrl?.slice(0, 400), exerciseIds };
}

function techniqueCue(exercise: RightHandExercise) {
  if (exercise.technique === "strumming") return { mistake: "Driving from a locked forearm or stopping the hand on rests.", correction: "Loosen the wrist and keep a small pendulum motion through rests." };
  if (exercise.technique === "plectrum") return { mistake: "Burying the pick or making string crossings wider than needed.", correction: "Expose less pick and let each return stroke clear the next string." };
  return { mistake: "Collapsing the thumb into the fingers or changing finger assignments.", correction: "Keep the thumb forward and give i, m, and a one consistent string each." };
}

export default function RightHandPracticeModes(props: Props) {
  const { onSettingsChange } = props;
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [library, setLibrary] = useState(() => ({ bookmarks: [] as string[], playlists: [] as Playlist[], notes: {} as Record<string, string> }));
  const [playlistName, setPlaylistName] = useState("");
  const [packMessage, setPackMessage] = useState("Challenge packs remain on this device unless you export them.");
  const [packs, setPacks] = useState<ChallengePack[]>([]);
  const [listenState, setListenState] = useState<"off" | "requesting" | "ready" | "denied" | "unavailable">("off");
  const [liveCue, setLiveCue] = useState("Listen mode is off.");
  const [liveCounts, setLiveCounts] = useState({ onsets: 0, onTime: 0, early: 0, late: 0 });
  const [fatiguePrompt, setFatiguePrompt] = useState(false);
  const [recoveryMisses, setRecoveryMisses] = useState(0);
  const [simulationScore, setSimulationScore] = useState<{ score: number; loops: number; listenScore?: number } | null>(null);
  const [showCoachingStudio, setShowCoachingStudio] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const runningSinceRef = useRef(0);
  const noiseRef = useRef(0.012);
  const lastOnsetRef = useRef(0);
  const lastAnnounceRef = useRef(0);
  const previousStatusRef = useRef(props.status);
  const livePropsRef = useRef({ status: props.status, bpm: props.bpm, subdivision: props.exercise.subdivision });
  livePropsRef.current = { status: props.status, bpm: props.bpm, subdivision: props.exercise.subdivision };

  useEffect(() => {
    const saved = readJson<Partial<PracticeModeSettings>>(SETTINGS_KEY, {});
    const hydrated: PracticeModeSettings = {
      targetSound: TARGET_SOUNDS.some((sound) => sound.id === saved.targetSound) ? saved.targetSound! : DEFAULT_SETTINGS.targetSound,
      demoSpeed: [1, 0.75, 0.5].includes(saved.demoSpeed ?? 0) ? saved.demoSpeed! : 1,
      noLook: Boolean(saved.noLook), clickMix: Math.max(0, Math.min(100, Number(saved.clickMix ?? 80))),
      guitarMix: Math.max(0, Math.min(100, Number(saved.guitarMix ?? 75))), contextMix: Math.max(0, Math.min(100, Number(saved.contextMix ?? 45))),
      performanceMode: false,
      focus: ["rhythm", "strings", "muting"].includes(saved.focus ?? "") ? saved.focus! : DEFAULT_SETTINGS.focus,
      dynamics: ["even", "accent-map", "backbeat", "crescendo"].includes(saved.dynamics ?? "") ? saved.dynamics! : DEFAULT_SETTINGS.dynamics,
      ghostStrum: Boolean(saved.ghostStrum),
      anticipation: ["full", "adaptive", "hidden"].includes(saved.anticipation ?? "") ? saved.anticipation! : DEFAULT_SETTINGS.anticipation
    };
    setSettings(hydrated); onSettingsChange(hydrated);
    setLibrary(boundedLibrary(readJson(LIBRARY_KEY, {})));
    const storedPacks = readJson<unknown[]>(PACKS_KEY, []).map(validatePack).filter((pack): pack is ChallengePack => Boolean(pack)).slice(0, 10);
    setPacks(storedPacks);
  }, [onSettingsChange]);

  const updateSettings = useCallback((patch: Partial<PracticeModeSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...next, performanceMode: false }));
      onSettingsChange(next);
      return next;
    });
  }, [onSettingsChange]);

  const saveLibrary = useCallback((next: typeof library) => {
    const bounded = boundedLibrary(next); setLibrary(bounded); localStorage.setItem(LIBRARY_KEY, JSON.stringify(bounded));
  }, []);

  const stopListening = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    void audioRef.current?.close(); audioRef.current = null;
    setListenState("off"); setLiveCue("Listen mode is off.");
  }, []);

  const startListening = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") { setListenState("unavailable"); setLiveCue("This browser cannot provide live microphone input."); return; }
    setListenState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext(); const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.25; source.connect(analyser);
      streamRef.current = stream; audioRef.current = context; setListenState("ready"); setLiveCue("Listening. Start a round when ready.");
      const samples = new Float32Array(analyser.fftSize);
      const inspect = () => {
        analyser.getFloatTimeDomainData(samples);
        let square = 0; for (let index = 0; index < samples.length; index += 1) square += samples[index] * samples[index];
        const rms = Math.sqrt(square / samples.length); const now = performance.now();
        noiseRef.current = noiseRef.current * 0.985 + Math.min(rms, noiseRef.current * 1.8) * 0.015;
        const attack = rms > Math.max(0.025, noiseRef.current * 2.25) && now - lastOnsetRef.current > 85;
        if (attack && livePropsRef.current.status === "running") {
          lastOnsetRef.current = now;
          const subdivision = livePropsRef.current.subdivision;
          const stepMs = 60000 / livePropsRef.current.bpm / (subdivision === "Quarter notes" ? 1 : subdivision === "Eighth notes" ? 2 : subdivision === "Triplets" ? 3 : 4);
          const phase = (now - runningSinceRef.current) % stepMs; const signed = phase > stepMs / 2 ? phase - stepMs : phase;
          const kind = Math.abs(signed) <= stepMs * 0.16 ? "onTime" : signed < 0 ? "early" : "late";
          setLiveCounts((counts) => ({ ...counts, onsets: counts.onsets + 1, [kind]: counts[kind] + 1 }));
          if (now - lastAnnounceRef.current > 420) { lastAnnounceRef.current = now; setLiveCue(kind === "onTime" ? "Centered on the pulse — keep it easy." : kind === "early" ? "A touch early — breathe into the next stroke." : "A touch late — keep the hand moving through the beat."); }
        }
        frameRef.current = requestAnimationFrame(inspect);
      };
      frameRef.current = requestAnimationFrame(inspect);
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setListenState(denied ? "denied" : "unavailable"); setLiveCue(denied ? "Microphone permission was not granted. You can still practise without listen mode." : "Microphone input could not be started.");
    }
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);
  useEffect(() => {
    if (props.status === "running" && previousStatusRef.current !== "running") { runningSinceRef.current = performance.now(); setLiveCounts({ onsets: 0, onTime: 0, early: 0, late: 0 }); setSimulationScore(null); }
    if (props.status === "complete" && previousStatusRef.current !== "complete" && settings.performanceMode) {
      const listenScore = liveCounts.onsets ? Math.round(liveCounts.onTime / liveCounts.onsets * 100) : undefined;
      setSimulationScore({ score: listenScore ?? Math.min(100, 60 + props.loopsCompleted * 6), loops: props.loopsCompleted, listenScore });
      updateSettings({ performanceMode: false });
    }
    previousStatusRef.current = props.status;
  }, [liveCounts, props.loopsCompleted, props.status, settings.performanceMode, updateSettings]);

  useEffect(() => {
    if (props.status === "running" && props.elapsedSeconds >= 90 && props.elapsedSeconds % 90 === 0) setFatiguePrompt(true);
    if (props.status === "idle") setFatiguePrompt(false);
  }, [props.elapsedSeconds, props.status]);

  useEffect(() => {
    const onRating = (event: Event) => {
      const rating = (event as CustomEvent<string>).detail;
      setRecoveryMisses((count) => rating === "clean" ? 0 : Math.min(3, count + 1));
    };
    window.addEventListener("chord-hero:right-hand-rating", onRating); return () => window.removeEventListener("chord-hero:right-hand-rating", onRating);
  }, []);

  const skillMap = useMemo(() => {
    const entries = Object.entries(props.progress).filter(([, item]) => item.sessions > 0);
    const average = (values: number[], fallback: number) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : fallback;
    const timing = average(entries.map(([, item]) => item.bestTimingScore ?? 0).filter(Boolean), 40);
    const clean = average(entries.map(([, item]) => Math.min(100, item.cleanSessions / Math.max(1, item.sessions) * 100)), 35);
    const best = average(entries.map(([, item]) => Math.min(100, item.bestBpm / 1.4)), 30);
    const techniqueScore = (needle: string, fallback: number) => average(entries.filter(([id]) => id.includes(needle)).map(([, item]) => Math.min(100, (item.cleanSessions + 1) / Math.max(2, item.sessions) * 100)), fallback);
    return [timing, average([timing, 100 - Math.min(80, entries.reduce((sum, [, item]) => sum + (item.recentMisses?.length ?? 0), 0) * 4)], 40), clean, techniqueScore("mute", 30), techniqueScore("finger", 30), best];
  }, [props.progress]);
  const weakestIndex = skillMap.indexOf(Math.min(...skillMap));
  const warmup = ["Muted quarter-note pendulum at half tempo", "One-string alternate strokes with tiny crossings", "Soft/loud pairs without changing tempo", "Light release-and-touch mute pulses", "Thumb-only bass pulse, then add one finger", "Two clean loops at 70% of your ceiling"][weakestIndex];
  const cue = techniqueCue(props.exercise);
  const bookmarked = library.bookmarks.includes(props.exercise.id);

  const randomize = () => {
    const matches = RIGHT_HAND_EXERCISES.filter((exercise) => exercise.technique === props.technique && exercise.difficulty === props.difficulty && exercise.id !== props.exercise.id);
    const next = matches[Math.floor(Math.random() * matches.length)] ?? RIGHT_HAND_EXERCISES.find((exercise) => exercise.technique === props.technique && exercise.difficulty === props.difficulty);
    if (next) props.onSelectExercise(next);
  };
  const applyRecovery = () => {
    const simpler = RIGHT_HAND_EXERCISES.filter((exercise) => exercise.technique === props.technique && exercise.pattern.length < props.exercise.pattern.length).sort((a, b) => a.pattern.length - b.pattern.length)[0];
    props.onSetBpm(Math.max(40, props.bpm - 8)); if (simpler) props.onSelectExercise(simpler); setRecoveryMisses(0);
  };
  const startSimulation = () => { updateSettings({ performanceMode: true, noLook: true }); setSimulationScore(null); props.onPreparePerformance(); requestAnimationFrame(() => requestAnimationFrame(props.onStartRound)); };

  const createPlaylist = () => {
    const name = playlistName.trim(); if (!name) return;
    saveLibrary({ ...library, playlists: [...library.playlists, { id: crypto.randomUUID(), name, exerciseIds: [props.exercise.id] }] }); setPlaylistName("");
  };
  const importPack = async (file: File | undefined) => {
    if (!file || file.size > 100_000) { setPackMessage("Choose a JSON pack smaller than 100 KB."); return; }
    try {
      const pack = validatePack(JSON.parse(await file.text())); if (!pack) throw new Error("invalid");
      const next = [...packs.filter((item) => item.title !== pack.title || item.creator !== pack.creator), pack].slice(-10); setPacks(next); localStorage.setItem(PACKS_KEY, JSON.stringify(next)); setPackMessage(`${pack.title} imported for offline use with attribution.`);
    } catch { setPackMessage("Pack rejected. It needs the v1 schema, attribution, licence, offline flag, and valid exercise IDs."); }
  };
  const exportPack = (pack: ChallengePack) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${pack.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="right-hand-practice-modes" aria-labelledby="practice-lab-title">
      <header><div><span className="label">Practice lab</span><h3 id="practice-lab-title">Shape the round without crowding the player</h3></div><span>Saved locally</span></header>

      <div className="practice-mode-summary">
        <div><span className="label">Technical focus</span><strong>{props.exercise.focus}</strong></div>
        <div><span className="label">Common mistake</span><p>{cue.mistake}</p></div>
        <div><span className="label">Fix it now</span><p>{cue.correction}</p></div>
      </div>

      <section className="coaching-studio-launch"><div><span className="label">3D & focused coaching</span><strong>Hand motion, string routes, dynamics, rehearsal, setup and hands-free control</strong><p>Loaded only when opened; the Three.js renderer starts only after you open its 3D coach.</p></div><button type="button" aria-expanded={showCoachingStudio} onClick={() => setShowCoachingStudio((value) => !value)}>{showCoachingStudio ? "Close coaching studio" : "Open coaching studio"}</button></section>
      {showCoachingStudio ? <RightHandCoachingStudio status={props.status} bpm={props.bpm} elapsedSeconds={props.elapsedSeconds} activeStep={props.activeStep} loopsCompleted={props.loopsCompleted} exercise={props.exercise} progress={props.progress} playlists={library.playlists} chordProgression={props.chordProgression} focus={settings.focus} dynamics={settings.dynamics} ghostStrum={settings.ghostStrum} anticipation={settings.anticipation} onModeChange={updateSettings} onSetRoundSeconds={props.onSetRoundSeconds} onSelectExercise={props.onSelectExercise} onToggleRound={props.onStartRound} /> : null}

      <details open><summary>Sound, demo & no-look</summary><div className="practice-mode-grid">
        <label>Target sound<select value={settings.targetSound} onChange={(event) => updateSettings({ targetSound: event.target.value as RightHandTargetSound })}>{TARGET_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select><small>{TARGET_SOUNDS.find((sound) => sound.id === settings.targetSound)?.help}; no extra sample download.</small></label>
        <label>Demo motion<select value={settings.demoSpeed} onChange={(event) => updateSettings({ demoSpeed: Number(event.target.value) as PracticeModeSettings["demoSpeed"] })}><option value={1}>Full speed</option><option value={0.75}>75% slow motion</option><option value={0.5}>50% slow motion</option></select><small>Changes the hand animation only, never your BPM.</small></label>
        <label className="check-card"><input type="checkbox" checked={settings.noLook} onChange={(event) => updateSettings({ noLook: event.target.checked })} /> No-look after count-in<small>The pattern fades only while the round is running.</small></label>
      </div><div className="practice-mixer" aria-label="Backing track mixer">{([["Click", "clickMix"], ["Guitar demo", "guitarMix"], ["Chord context", "contextMix"]] as const).map(([label, key]) => <label key={key}><span>{label}<b>{settings[key]}%</b></span><input type="range" min={0} max={100} value={settings[key]} onChange={(event) => updateSettings({ [key]: Number(event.target.value) })} /></label>)}</div></details>

      <details><summary>Live listen & performance simulation</summary><div className="listen-performance-grid">
        <section className={`live-listen-card state-${listenState}`}><span className="label">Live listen · onset timing</span><strong aria-live="polite">{liveCue}</strong><p>Feedback is based on detected attacks against the pulse. It does not claim live chord recognition.</p><div><button type="button" onClick={listenState === "ready" ? stopListening : () => void startListening()} disabled={listenState === "requesting"}>{listenState === "ready" ? "Stop listening" : listenState === "requesting" ? "Requesting…" : "Enable microphone"}</button><small>{liveCounts.onsets} attacks · {liveCounts.onTime} centered · {liveCounts.early} early · {liveCounts.late} late</small></div></section>
        <section className="performance-card"><span className="label">Performance simulation</span><strong>Full round, no visual prompts</strong><p>Uses your current chord progression and mixer. Listen mode improves the final timing evidence.</p><button type="button" onClick={startSimulation} disabled={props.status === "running" || props.status === "countin"}>Start performance</button>{simulationScore ? <div className="simulation-score" role="status"><b>{simulationScore.score}%</b><span>{simulationScore.loops} loops · {simulationScore.listenScore === undefined ? "completion score; no microphone timing" : `${simulationScore.listenScore}% attacks centered`}</span></div> : null}</section>
      </div></details>

      <details><summary>Skill map & adaptive warmup</summary><div className="skill-map">{SKILL_LABELS.map((label, index) => <div key={label} className={index === weakestIndex ? "weakest" : ""}><span>{label}<b>{skillMap[index]}%</b></span><i><em style={{ width: `${skillMap[index]}%` }} /></i></div>)}</div><div className="adaptive-warmup"><span className="label">Today&apos;s weakest-metric warmup</span><strong>{warmup}</strong><p>Start at {Math.max(40, Math.round(props.bpm * 0.5))} BPM for 60–90 seconds, then return to the selected drill.</p></div></details>

      <details><summary>Bookmarks, playlists & notes</summary><div className="practice-library-actions"><button type="button" aria-pressed={bookmarked} onClick={() => saveLibrary({ ...library, bookmarks: bookmarked ? library.bookmarks.filter((id) => id !== props.exercise.id) : [...library.bookmarks, props.exercise.id] })}>{bookmarked ? "Remove bookmark" : "Bookmark this drill"}</button><label>Personal reminder<textarea value={library.notes[props.exercise.id] ?? ""} maxLength={240} placeholder="Keep pick shallow…" onChange={(event) => saveLibrary({ ...library, notes: { ...library.notes, [props.exercise.id]: event.target.value } })} /></label><div><label>New playlist<input value={playlistName} maxLength={48} placeholder="Friday groove set" onChange={(event) => setPlaylistName(event.target.value)} /></label><button type="button" onClick={createPlaylist}>Create with this drill</button></div></div>{library.playlists.length ? <div className="practice-playlists">{library.playlists.map((playlist) => <div key={playlist.id}><strong>{playlist.name}</strong><span>{playlist.exerciseIds.length} drills</span><button type="button" disabled={playlist.exerciseIds.includes(props.exercise.id)} onClick={() => saveLibrary({ ...library, playlists: library.playlists.map((item) => item.id === playlist.id ? { ...item, exerciseIds: [...item.exerciseIds, props.exercise.id] } : item) })}>Add current</button></div>)}</div> : <p className="empty-practice-library">No named playlists yet.</p>}</details>

      <details><summary>Random drill, recovery & challenge packs</summary><div className="random-recovery-grid"><section><span className="label">Constrained random pattern</span><strong>{props.technique} · {props.difficulty}</strong><p>Chooses another authored pattern with valid notation at the same technique and difficulty.</p><button type="button" onClick={randomize}>Choose a random drill</button></section><section className={recoveryMisses >= 2 ? "recovery-ready" : ""}><span className="label">Recovery mode</span><strong>{recoveryMisses >= 2 ? "A reset is ready" : `${recoveryMisses} / 2 difficult rounds`}</strong><p>{recoveryMisses >= 2 ? `Apply ${Math.max(40, props.bpm - 8)} BPM and a shorter ${props.technique} pattern. Nothing changes until you confirm.` : "Two mistakes/too-fast ratings will offer a gentler version."}</p>{recoveryMisses >= 2 ? <button type="button" onClick={applyRecovery}>Apply recovery setup</button> : null}</section></div><section className="challenge-pack-import"><div><span className="label">Attributed challenge packs</span><strong>Local JSON import · offline after import</strong><p>{packMessage}</p></div><label className="file-button">Import pack<input type="file" accept="application/json,.json" onChange={(event) => void importPack(event.target.files?.[0])} /></label></section>{packs.map((pack) => <div className="challenge-pack" key={`${pack.creator}-${pack.title}`}><div><strong>{pack.title}</strong><span>By {pack.creator} · {pack.license} · {pack.exerciseIds.length} drills</span><small>{pack.attribution}</small></div><button type="button" onClick={() => exportPack(pack)}>Export</button></div>)}</details>

      {fatiguePrompt ? <div className="fatigue-check" role="alert"><div><span className="label">90-second fatigue check</span><strong>Can your wrist and shoulders still feel loose?</strong><p>Pause for sharp pain, numbness, or building tension. This is a posture reminder, not medical advice.</p></div><button type="button" onClick={() => setFatiguePrompt(false)}>I reset my posture</button></div> : null}
    </section>
  );
}
