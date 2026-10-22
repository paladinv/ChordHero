"use client";

import { useEffect, useMemo, useState } from "react";
import ChordDiagram, { type Chord } from "./ChordDiagram";
import { LOCAL_CHORDS_KEY, validateLocalChordShapes, validateSoundingHarmony, type LocalChordShape } from "../lib/chordLibraryWorkflow";
import type { ChordLibraryItem } from "../lib/chords";

type Preference = "comfort" | "challenge";
type Setup = Record<string, unknown>;
type SavedSetup = { id: string; title: string; setup: Setup };
type LocalDrill = { id: string; name: string; shapeIds: string[]; clean: number; missed: number; needsWork: number };
const SETUPS_KEY = "chord-hero.trainer.song-setups.v1";
const PREFERENCE_KEY = "chord-hero.trainer.adaptive-preference.v1";
const DRILLS_KEY = "chord-hero.trainer.local-shape-drills.v1";
const TUNINGS = { standard: [0, 0, 0, 0, 0, 0], dropD: [-2, 0, 0, 0, 0, 0], dadgad: [-2, 0, 0, 0, -2, -2], openG: [-2, -2, 0, 0, 0, -2] } as const;
const boundedSetup = (value: Setup): Setup => ({
  pace: value.pace === "manual" ? "manual" : Math.max(2, Math.min(8, Number(value.pace) || 3)),
  tuning: ["standard", "dropD", "dadgad", "openG", "custom"].includes(String(value.tuning)) ? value.tuning : "standard",
  customTuning: String(value.customTuning ?? "My tuning").slice(0, 60),
  capo: Math.max(0, Math.min(12, Math.round(Number(value.capo) || 0))),
  strum: ["none", "down", "downUp", "island", "shuffle"].includes(String(value.strum)) ? value.strum : "none",
  rhythm: value.rhythm === true,
  bpm: Math.max(40, Math.min(120, Math.round(Number(value.bpm) || 60))),
  neckLock: ["off", "open", "low", "mid", "high", "custom"].includes(String(value.neckLock)) ? value.neckLock : "off",
  customNeckMin: Math.max(0, Math.min(20, Math.round(Number(value.customNeckMin) || 0))),
  customNeckMax: Math.max(0, Math.min(20, Math.round(Number(value.customNeckMax) || 12))),
  orientation: value.orientation === "left" ? "left" : "right",
});

export default function TrainerLocalPractice({ songId, songTitle, setup, catalogRoute, settingsLocked, preference, onApply, onPreference }: {
  songId: string; songTitle: string; setup: object; catalogRoute?: Chord[]; settingsLocked: boolean; preference: Preference; onApply: (setup: object) => boolean; onPreference: (value: Preference) => void;
}) {
  const [shapes, setShapes] = useState<LocalChordShape[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [ratedSteps, setRatedSteps] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<SavedSetup[]>([]);
  const [drills, setDrills] = useState<LocalDrill[]>([]);
  const [drillName, setDrillName] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const localShapes = validateLocalChordShapes(JSON.parse(localStorage.getItem(LOCAL_CHORDS_KEY) || "[]"));
      setShapes(localShapes.slice(0, 200));
      const raw = JSON.parse(localStorage.getItem(SETUPS_KEY) || "[]");
      setSaved(Array.isArray(raw) ? raw.slice(0, 12).flatMap((x) => x && typeof x.id === "string" && typeof x.title === "string" && x.setup && typeof x.setup === "object" ? [{ id: x.id.slice(0, 80), title: x.title.slice(0, 60), setup: boundedSetup(x.setup) }] : []) : []);
      const routes = JSON.parse(localStorage.getItem(DRILLS_KEY) || "[]");
      setDrills(Array.isArray(routes) ? routes.slice(0, 20).flatMap((x) => x && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.shapeIds) && x.shapeIds.length >= 2 && x.shapeIds.length <= 20 && x.shapeIds.every((id: unknown) => typeof id === "string" && id.length <= 150) ? [{ id: x.id.slice(0, 80), name: x.name.slice(0, 60), shapeIds: x.shapeIds, clean: Math.max(0, Math.min(500, Math.round(Number(x.clean) || 0))), missed: Math.max(0, Math.min(500, Math.round(Number(x.missed) || 0))), needsWork: Math.max(0, Math.min(500, Math.round(Number(x.needsWork) || 0))) }] : []) : []);
    } catch { setMessage("Local Trainer extras could not be read; your catalog practice is unchanged."); }
  }, []);

  const tuningId = String((setup as Setup).tuning ?? "standard");
  const capo = Math.max(0, Math.min(12, Number((setup as Setup).capo) || 0));
  const tuning = TUNINGS[tuningId as keyof typeof TUNINGS];
  const validatedShapes = useMemo(() => shapes.map((item) => ({ ...item, validation: tuning ? validateSoundingHarmony(item as unknown as ChordLibraryItem, { label: tuningId, strings: [], semitoneOffsets: tuning }, capo) : null })), [capo, shapes, tuning, tuningId]);
  const route = useMemo(() => selected.flatMap((id) => { const item = validatedShapes.find((shape) => shape.id === id); return item ? [item] : []; }), [selected, validatedShapes]);
  const current = route[step];
  const estimate = useMemo(() => {
    const chords = catalogRoute?.length ? catalogRoute : route.map((item) => item.chord);
    let barreChanges = 0, sharedAnchors = 0, fretMovement = 0;
    for (let i = 1; i < chords.length; i++) {
      const a = chords[i - 1].frets.filter((f) => f > 0), b = chords[i].frets.filter((f) => f > 0);
      const hasBarre = (frets: number[]) => frets.some((fret) => frets.filter((other) => other === fret).length >= 2);
      if (hasBarre(a) !== hasBarre(b)) barreChanges++;
      const shared = chords[i - 1].frets.filter((fret, string) => fret > 0 && fret === chords[i].frets[string]).length;
      if (shared) sharedAnchors++;
      const first = (frets: number[]) => frets.find((fret) => fret > 0) ?? 0;
      fretMovement += Math.abs(first(chords[i - 1].frets) - first(chords[i].frets));
    }
    return { barreChanges, sharedAnchors, fretMovement };
  }, [catalogRoute, route]);

  const persist = (next: SavedSetup[]) => {
    setSaved(next.slice(-12));
    try { localStorage.setItem(SETUPS_KEY, JSON.stringify(next.slice(-12))); } catch { setMessage("Could not save this setup in local storage."); }
  };
  const persistDrills = (next: LocalDrill[]) => {
    setDrills(next.slice(-20));
    try { localStorage.setItem(DRILLS_KEY, JSON.stringify(next.slice(-20))); } catch { setMessage("Could not save this custom drill locally."); }
  };
  const saveDrill = () => {
    if (selected.length < 2) { setMessage("Select at least two shapes to save an exact custom drill."); return; }
    const drill = { id: `local-route-${Date.now()}`, name: (drillName.trim() || "My custom shape set").slice(0, 60), shapeIds: selected.slice(0, 20), clean: 0, missed: 0, needsWork: 0 };
    persistDrills([...drills, drill]); setDrillName(""); setMessage(`Saved “${drill.name}” as an exact local-shape route.`);
  };
  const replayDrill = (drill: LocalDrill) => {
    const missing = drill.shapeIds.filter((id) => !shapes.some((shape) => shape.id === id));
    if (missing.length) { setMessage(`Exact replay unavailable: ${missing.length} saved local shape ID(s) are missing. No replacement shapes were substituted.`); return; }
    setSelected(drill.shapeIds); setStep(0); setRatedSteps(new Set()); setMessage(`Exact route loaded: ${drill.name}. Ratings remain local and separate from catalog evidence.`);
  };
  const rateDrill = (key: "clean" | "missed" | "needsWork") => {
    if (ratedSteps.has(step)) return;
    const active = drills.find((drill) => drill.shapeIds.length === selected.length && drill.shapeIds.every((id, index) => id === selected[index]));
    if (!active) { setMessage("Save this exact shape route first to keep ratings attached to its local drill."); return; }
    persistDrills(drills.map((drill) => drill.id === active.id ? { ...drill, [key]: Math.min(500, drill[key] + 1) } : drill));
    setRatedSteps((previous) => new Set(previous).add(step));
    setStep((index) => Math.min(route.length - 1, index + 1));
  };
  const saveSetup = () => {
    if (!songId) { setMessage("Choose a song set before saving its setup."); return; }
    const entry = { id: `${songId}-${Date.now()}`.slice(0, 80), title: (name.trim() || songTitle || "Song setup").slice(0, 60), setup: boundedSetup(setup as Setup) };
    persist([...saved.filter((item) => item.id !== entry.id), entry]); setName(""); setMessage(`Saved “${entry.title}” locally.`);
  };
  const selectPreference = (value: Preference) => {
    onPreference(value);
    try { localStorage.setItem(PREFERENCE_KEY, value); } catch { setMessage("Preference applies for this visit but could not be saved locally."); }
  };

  return <div className="trainer-local-tools">
    <section aria-labelledby="trainer-local-shapes-title"><h3 id="trainer-local-shapes-title">My ChordLab shapes</h3>
      <p>Choose validated local physical shapes for a private practice set. This mini-drill does not add ratings to catalog transition evidence.</p>
      {!shapes.length ? <p>No saved ChordLab shapes are available on this device.</p> : <div role="group" aria-label="Select custom chord shapes">{validatedShapes.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => { setSelected((old) => event.target.checked ? [...old, item.id].slice(0, 20) : old.filter((id) => id !== item.id)); setStep(0); setRatedSteps(new Set()); }} /> {item.chord.name} · {!item.validation ? "unverified for custom tuning" : item.validation.status === "pass" ? "pitch check passed" : "incompatible / unverified"}</label>)}</div>}
      {route.length > 0 && <><p>{route.length} selected · {current ? `${current.chord.name} (${step + 1}/${route.length}) · ${!current.validation ? "Unverified: custom tuning offsets are not available" : current.validation.status === "pass" ? "Pitch check passed" : `Incompatible / unverified: ${current.validation.message}`}` : "ready"}</p>{current && <ChordDiagram chord={current.chord} />}<button type="button" className="btn" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step <= 0}>Previous shape</button> <button type="button" className="btn" onClick={() => setStep((n) => Math.min(route.length - 1, n + 1))} disabled={step >= route.length - 1}>Next shape</button> <button type="button" className="btn ghost" onClick={() => { setSelected([]); setStep(0); setRatedSteps(new Set()); }}>Clear set</button><div role="group" aria-label="Rate this custom-shape route"><span>Rate current custom route: </span><button className="btn" type="button" onClick={() => rateDrill("clean")} disabled={ratedSteps.has(step)}>Clean</button> <button className="btn" type="button" onClick={() => rateDrill("needsWork")} disabled={ratedSteps.has(step)}>Needs work</button> <button className="btn" type="button" onClick={() => rateDrill("missed")} disabled={ratedSteps.has(step)}>Missed</button></div>
      <label>Save as exact local drill <input value={drillName} maxLength={60} onChange={(event) => setDrillName(event.target.value)} /></label> <button type="button" className="btn" onClick={saveDrill} disabled={selected.length < 2}>Save custom route</button>
      {drills.map((drill) => <div key={drill.id}><strong>{drill.name}</strong> <small>{drill.shapeIds.length} exact shapes · {drill.clean} clean / {drill.needsWork} needs work / {drill.missed} missed</small> <button type="button" className="btn" onClick={() => replayDrill(drill)}>Replay exact route</button> <button type="button" className="btn ghost" onClick={() => persistDrills(drills.filter((item) => item.id !== drill.id))}>Remove</button></div>)}
      </>}
      {(catalogRoute?.length ?? route.length) > 1 && <p><strong>{catalogRoute?.length ? "Upcoming route estimate" : "Route demand estimate"}:</strong> {estimate.barreChanges} barre-status changes, {estimate.sharedAnchors} adjacent shared-anchor changes, and {estimate.fretMovement} frets of summed first-finger-position movement. Heuristic from stored frets, not a measurement of your hand or playing.</p>}
    </section>
    <section aria-labelledby="trainer-song-setup-title"><h3 id="trainer-song-setup-title">Song-set setup snapshots</h3><p>Save and reapply pace, tuning, capo, strum/rhythm, neck range, and hand orientation for this song set. Stored only on this device.</p>
      <label>Snapshot name <input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label> <button type="button" className="btn" onClick={saveSetup} disabled={!songId}>Save current setup</button>
      {saved.filter((item) => item.id.startsWith(`${songId}-`)).map((item) => <div key={item.id}><strong>{item.title}</strong> <button type="button" className="btn" disabled={settingsLocked} onClick={() => { setMessage(onApply({ ...setup, ...item.setup, songId }) ? `Applied “${item.title}”.` : "Setup could not be applied while the round is locked."); }}>Apply</button> <button type="button" className="btn ghost" onClick={() => persist(saved.filter((entry) => entry.id !== item.id))}>Remove</button></div>)}
    </section>
    <section aria-labelledby="trainer-adaptive-preference-title"><h3 id="trainer-adaptive-preference-title">Adaptive practice preference</h3><label>Sampling style <select value={preference} onChange={(event) => selectPreference(event.target.value as Preference)}><option value="comfort">Comfort-first</option><option value="challenge">Challenge-seeking</option></select></label><p>Catalog Trainer pacing uses your Clean / Needs work / Missed ratings and this setting: comfort-first slows sooner and advances after three clean changes; challenge-seeking slows more gently and advances after two. These custom-set ratings stay separate. No audio, motion, or external signals are sampled.</p></section>
    {message && <p role="status">{message}</p>}
  </div>;
}
