"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram, { type Chord } from "./ChordDiagram";
import {
  CHORD_FUNCTION_KEYS,
  type ChordLibraryItem
} from "../lib/chords";
import {
  type HarmonicFunction,
  type HarmonicRole,
  type HarmonyMode,
  type HarmonyNote
} from "../lib/harmony";
import {
  CHORD_GLOSSARY,
  buildKeyCurriculum,
  completePracticeGoalKey,
  createPracticeGoal,
  getComposerSuggestions,
  getKeyProgress,
  getSongReferences,
  isShareableLearningPack,
  makeFretboardMap,
  rankPersonalizedVoicings,
  recommendNextCurriculumTask,
  serializeLearningPack,
  transposeProgression,
  type LearningSkill,
  type LearningState,
} from "../lib/chordLearning";
import type { PracticeStats } from "../lib/studentProfile";

const DEFAULT_GOAL_KEYS: HarmonyNote[] = ["C", "G", "D", "A", "E"];
const MODE_LABELS: Record<HarmonyMode, string> = { major: "Major", minor: "Minor" };

type DisplayOptions = {
  handedness: "right" | "left";
  highContrast: boolean;
  largeCharts: boolean;
};

type ChordLearningStudioProps = {
  activeKey: string;
  mode: HarmonyMode;
  state: LearningState;
  onStateChange: (state: LearningState) => void;
  selectedEntry: ChordLibraryItem | null;
  selectedFunction: HarmonicFunction | null;
  filteredEntries: ChordLibraryItem[];
  practiceStats: PracticeStats;
  displaySettings: DisplayOptions;
  onRoleChange: (role: HarmonicRole) => void;
  onKeyChange: (key: HarmonyNote) => void;
  onSelectEntry: (id: string) => void;
  onLogPractice: (id: string) => void;
  onPlayChord: (chord: Chord, mode?: "strum" | "arpeggio", voicingId?: string) => Promise<void>;
};

export default function ChordLearningStudio({
  activeKey,
  mode,
  state,
  onStateChange,
  selectedEntry,
  selectedFunction,
  filteredEntries,
  practiceStats,
  displaySettings,
  onRoleChange,
  onKeyChange,
  onSelectEntry,
  onLogPractice,
  onPlayChord
}: ChordLearningStudioProps) {
  const [voiceStatus, setVoiceStatus] = useState("Ready");
  const [importStatus, setImportStatus] = useState("");
  const voiceRunRef = useRef(0);

  const learningKey = state.learningKey || (activeKey as HarmonyNote) || "G";
  const songKey = state.songKey || learningKey;
  const songFamily = state.songFamily;
  const learningPreferences = state.handPreference;
  const learningGoals = state.goals;
  const learningComposerRoles = state.composerRoles;
  const updateState = (patch: Partial<LearningState>) => onStateChange({ ...state, ...patch });

  useEffect(() => () => {
    voiceRunRef.current += 1;
  }, []);

  const curriculum = useMemo(() => buildKeyCurriculum(learningKey, mode), [learningKey, mode]);
  const progress = useMemo(() => getKeyProgress(curriculum, practiceStats), [curriculum, practiceStats]);
  const nextTask = useMemo(() => recommendNextCurriculumTask(curriculum, practiceStats), [curriculum, practiceStats]);
  const rankedVoicings = useMemo(() => rankPersonalizedVoicings(filteredEntries, learningPreferences, selectedEntry?.chord).slice(0, 4), [filteredEntries, learningPreferences, selectedEntry]);
  const glossary = selectedEntry ? CHORD_GLOSSARY[selectedEntry.quality] ?? CHORD_GLOSSARY.major : CHORD_GLOSSARY.major;
  const composerStart = selectedFunction?.role ?? (mode === "major" ? "I" : "i");
  const composerSuggestions = useMemo(() => getComposerSuggestions(learningComposerRoles.at(-1) ?? composerStart, mode), [learningComposerRoles, composerStart, mode]);
  const mapCells = useMemo(() => makeFretboardMap(learningKey, mode, learningComposerRoles.at(-1) ?? composerStart), [learningComposerRoles, composerStart, learningKey, mode]);
  const songs = useMemo(() => getSongReferences(songFamily || undefined), [songFamily]);
  const songFamilies = useMemo(() => Array.from(new Set(getSongReferences().map((song) => song.family))), []);
  const activeGoal = learningGoals[0] ?? null;
  const goalComplete = activeGoal ? activeGoal.completedKeys.length >= activeGoal.keys.length : false;

  const completeCurriculumStep = () => {
    const id = nextTask?.representativeIds[0];
    if (id) onLogPractice(id);
  };

  const addComposerRole = (role: HarmonicRole) => {
    updateState({ composerRoles: learningComposerRoles.length >= 12 ? learningComposerRoles : [...learningComposerRoles, role] });
    onRoleChange(role);
  };

  const playTransition = async (target: ChordLibraryItem) => {
    if (!selectedEntry) return;
    const run = ++voiceRunRef.current;
    setVoiceStatus(`Playing ${selectedEntry.chord.name} to ${target.chord.name}...`);
    await onPlayChord(selectedEntry.chord, "strum", selectedEntry.id);
    if (run !== voiceRunRef.current) return;
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    if (run !== voiceRunRef.current) return;
    await onPlayChord(target.chord, "arpeggio", target.id);
    if (run === voiceRunRef.current) setVoiceStatus(`Finished ${selectedEntry.chord.name} to ${target.chord.name}`);
  };

  const createGoal = () => {
    const role = selectedFunction?.role ?? composerStart;
    updateState({ goals: learningGoals.length ? learningGoals : [createPracticeGoal(role, DEFAULT_GOAL_KEYS, `Master ${role} in five keys`)] });
  };

  const completeGoalKey = (key: HarmonyNote) => {
    updateState({ goals: learningGoals.map((goal, index) => index === 0 ? completePracticeGoalKey(goal, key) : goal) });
  };

  const exportPack = () => {
    const pack = serializeLearningPack(`Learn ${learningKey} ${MODE_LABELS[mode]}`, learningKey, mode, learningComposerRoles.length ? learningComposerRoles : [composerStart], filteredEntries.slice(0, 24).map((entry) => entry.id));
    const url = URL.createObjectURL(new Blob([pack], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `chord-hero-${learningKey.toLowerCase()}-learning-pack.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importPack = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isShareableLearningPack(parsed)) throw new Error("invalid");
        updateState({ learningKey: parsed.key, composerRoles: parsed.roles });
        onKeyChange(parsed.key);
        setImportStatus(`Imported ${parsed.title}`);
      } catch {
        setImportStatus("Import rejected: choose a valid Chord Hero learning pack.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="learning-studio" aria-labelledby="learning-studio-title">
      <div className="library-section-heading">
        <div><span className="label">Guided practice</span><h3 id="learning-studio-title">Learn the key, then the shape</h3></div>
        <span className="muted">Role first, voicing second. Progress stays on this device.</span>
      </div>

      <div className="learning-studio-grid learning-foundation-grid">
        <section className="learning-panel learning-curriculum">
          <div className="learning-panel-heading"><div><span className="label">Key path</span><h4>{curriculum.title}</h4></div><label className="learning-panel-control">Key<select value={learningKey} onChange={(event) => { const key = event.target.value as HarmonyNote; updateState({ learningKey: key }); onKeyChange(key); }}><option value="C">C</option><option value="D">D</option><option value="E">E</option><option value="F">F</option><option value="G">G</option><option value="A">A</option><option value="B">B</option></select></label></div>
          <div className="learning-progress-track" aria-label={`${progress.completedStepIds.length} of ${curriculum.steps.length} steps complete`}><span style={{ width: `${curriculum.steps.length ? progress.completedStepIds.length / curriculum.steps.length * 100 : 0}%` }} /></div>
          <p className="learning-progress-copy">{progress.completedStepIds.length}/{curriculum.steps.length} functions unlocked. {nextTask ? `Next: ${nextTask.title}. ${nextTask.description}` : "Key path complete. Review a weak voicing or choose another key."}</p>
          {nextTask ? <div className="learning-next-task"><strong>{nextTask.role}</strong><span>{nextTask.practiceSeconds / 60} minute focus</span><button className="btn primary" type="button" onClick={() => { const id = nextTask.representativeIds[0]; if (id) onSelectEntry(id); completeCurriculumStep(); }}>Practice next</button></div> : null}
          <div className="learning-step-list">{curriculum.steps.slice(0, 8).map((step) => <button key={step.id} type="button" className={progress.completedStepIds.includes(step.id) ? "complete" : step.id === progress.currentStepId ? "current" : "locked"} disabled={!progress.completedStepIds.includes(step.id) && step.id !== progress.currentStepId} onClick={() => { const id = step.representativeIds[0]; if (id) onSelectEntry(id); }}><strong>{step.role}</strong><span>{progress.completedStepIds.includes(step.id) ? "Unlocked" : step.id === progress.currentStepId ? "Current task" : "Locked"}</span></button>)}</div>
        </section>

        <section className="learning-panel learning-preferences">
          <div className="learning-panel-heading"><div><span className="label">Personalization</span><h4>Make shapes fit your hand</h4></div></div>
          <div className="learning-preference-controls">
            <label>Hand span: {learningPreferences.handSpanCm.toFixed(1)} cm<input type="range" min="14" max="25" step="0.5" value={learningPreferences.handSpanCm} onChange={(event) => updateState({ handPreference: { ...learningPreferences, handSpanCm: Number(event.target.value) } })} /></label>
            <label>Target skill<select value={learningPreferences.targetSkill} onChange={(event) => updateState({ handPreference: { ...learningPreferences, targetSkill: event.target.value as LearningSkill } })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
          </div>
          <p className="muted">Recommendations use hand span, difficulty tags, shared fingers, fret movement, string changes, and barre load. Existing instrument settings are unchanged.</p>
          <div className="learning-ranked-list">{rankedVoicings.map(({ entry, reason }) => <button key={entry.id} type="button" onClick={() => onSelectEntry(entry.id)}><span><strong>{entry.chord.name}</strong><small>{entry.position}</small></span><small>{reason}</small></button>)}</div>
        </section>
      </div>

      <section className="learning-panel learning-voice-leading">
        <div className="learning-panel-heading"><div><span className="label">Sequential listening</span><h4>Hear the voice-leading</h4></div><span className="muted" role="status">{voiceStatus}</span></div>
        <p className="muted">The source plays first, then the lowest-cost recommended target. Audio samples stay lazy until you press play.</p>
        <div className="learning-ranked-list learning-transition-list">{rankedVoicings.slice(0, 3).map(({ entry, cost }) => <div key={entry.id}><span><strong>{entry.chord.name}</strong><small>{cost ? `${cost.score}/100 transition cost` : entry.position}</small></span><button className="btn" type="button" onClick={() => void playTransition(entry)}>Play change</button></div>)}</div>
      </section>

      <div className="learning-studio-grid learning-review-grid">
        <section className="learning-panel learning-goals">
          <div className="learning-panel-heading"><div><span className="label">Spaced practice</span><h4>Goals and streaks</h4></div>{!activeGoal ? <button className="btn primary" type="button" onClick={createGoal}>Create V to I goal</button> : null}</div>
          {activeGoal ? <><strong>{activeGoal.title}</strong><p>{activeGoal.completedKeys.length}/{activeGoal.keys.length} keys complete · {activeGoal.streak} day streak{activeGoal.nextReviewAt ? ` · review ${new Date(activeGoal.nextReviewAt).toLocaleDateString()}` : ""}</p><div className="chip-row">{activeGoal.keys.map((key) => <button key={key} type="button" className={`chip ${activeGoal.completedKeys.includes(key) ? "active" : ""}`} onClick={() => completeGoalKey(key)}>{key} {activeGoal.completedKeys.includes(key) ? "done" : "mark done"}</button>)}</div><p className="muted">{goalComplete ? "Goal complete. Keep the streak alive with the scheduled review." : "Mark a key after a clean, focused review."}</p></> : <p className="muted">Create a goal to keep V to I work moving across five keys with lightweight local scheduling.</p>}
        </section>

        <section className="learning-panel learning-glossary">
          <div className="learning-panel-heading"><div><span className="label">Theory snapshot</span><h4>{glossary.label}</h4></div><button className="btn" type="button" onClick={() => selectedEntry && void onPlayChord(selectedEntry.chord, "arpeggio", selectedEntry.id)}>Preview quality</button></div>
          <p>{glossary.sound}</p><div className="interval-visual" aria-label={`${glossary.label} interval visualization`}>{glossary.intervals.map((interval) => <span key={interval.degree} className={`interval-${interval.color}`} style={{ left: `${8 + interval.semitones / 14 * 84}%` }}><b>{interval.degree}</b><small>{interval.semitones} st</small></span>)}</div>
          <p className="muted">Intervals: {glossary.intervals.map((interval) => `${interval.degree} (${interval.semitones} semitones)`).join(" · ")}</p>
        </section>
      </div>

      <section className="learning-panel learning-composer">
        <div className="learning-panel-heading"><div><span className="label">Real-time composer</span><h4>Build the next move</h4></div><span className="muted">Start: {composerStart}</span></div>
        <div className="learning-composer-rows">
          <div className="learning-composer-row"><span className="learning-chip-label">Progression</span><div className="chip-row">{learningComposerRoles.length ? learningComposerRoles.map((role, index) => <button key={`${role}-${index}`} type="button" className="chip active" onClick={() => updateState({ composerRoles: learningComposerRoles.filter((_, currentIndex) => currentIndex !== index) })}>{role} ×</button>) : <span className="muted">No roles added yet.</span>}</div></div>
          <div className="learning-composer-row"><span className="learning-chip-label">Next roles</span><div className="chip-row">{composerSuggestions.map((role) => <button key={role} type="button" className="chip" onClick={() => addComposerRole(role)}>{role}</button>)}<button className="btn ghost" type="button" onClick={() => updateState({ composerRoles: [] })}>Clear</button></div></div>
        </div>
        {selectedFunction ? <p className="library-harmony-explanation">{selectedFunction.explanation} Suggested resolution: {selectedFunction.suggestedResolution}</p> : null}
      </section>

      <section className="learning-panel learning-songs">
        <div className="learning-panel-heading"><div><span className="label">Context without lyrics</span><h4>Song references</h4></div><div className="learning-inline-controls"><label>Family<select value={songFamily} onChange={(event) => updateState({ songFamily: event.target.value })}><option value="">All families</option>{songFamilies.map((family) => <option key={family} value={family}>{family}</option>)}</select></label><label>Key<select value={songKey} onChange={(event) => updateState({ songKey: event.target.value as HarmonyNote })}>{CHORD_FUNCTION_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}</select></label></div></div>
        <div className="song-reference-grid">{songs.map((song) => <article key={song.id}><strong>{song.title}</strong><small>{song.artist} · {song.family}</small><p>{song.context}</p><span>{transposeProgression(song.progression, "C", songKey).join(" · ")}</span><small>Simpler: {song.simplified.join(" · ")}. {song.attribution}</small></article>)}</div>
      </section>

      <section className="learning-panel learning-map">
        <div className="learning-panel-heading"><div><span className="label">Fretboard map</span><h4>{learningKey} {MODE_LABELS[mode]} targets</h4></div><button className="btn primary" type="button" onClick={() => window.print()}>Print map</button></div>
        <p className="muted">Compact six-string view, frets 0–12. Tonic, chord tones, and tendency/resolution targets are highlighted; alternate tuning diagrams remain separate.</p>
        <div className="learning-map-scroll"><div className={`fretboard-map ${displaySettings.handedness === "left" ? "left-handed" : ""} ${displaySettings.highContrast ? "high-contrast" : ""} ${displaySettings.largeCharts ? "large" : ""}`} aria-label={`${learningKey} ${mode} six string fretboard map`}>{mapCells.map((cell) => <span key={`${cell.stringIndex}-${cell.fret}`} className={`fretboard-map-cell ${cell.kind}`} title={`${cell.note}, string ${cell.stringIndex + 1}, fret ${cell.fret}`}>{cell.fret === 0 ? "O" : cell.note}</span>)}</div></div>
      </section>

      <section className="learning-panel learning-sharing">
        <div className="learning-panel-heading"><div><span className="label">Teacher handoff</span><h4>Share this practice pack</h4></div><span className="muted">Local-first JSON, ready for future authenticated cloud sync.</span></div>
        <div className="learning-handoff-actions"><button className="btn" type="button" onClick={exportPack}>Export learning pack</button><label className="btn ghost" htmlFor="learning-pack-import">Import learning pack</label><input id="learning-pack-import" type="file" accept="application/json,.json" className="visually-hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) importPack(file); event.currentTarget.value = ""; }} /></div>
        {importStatus ? <p className="muted" role="status">{importStatus}</p> : null}
      </section>
    </section>
  );
}
