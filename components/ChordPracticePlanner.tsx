"use client";

import { useEffect, useMemo, useState } from "react";
import { CHORD_LIBRARY, type ChordLibraryItem } from "../lib/chords";
import { HARMONY_NOTES, type HarmonyNote } from "../lib/harmony";
import { analyzePracticeRecording, type RecordingAnalysis } from "../lib/songRecordingAnalysis";
import type { PracticeStats, TeacherAssignment } from "../lib/studentProfile";
import {
  buildAchievementMap,
  buildChordFamilyDependencyMap,
  buildPracticeToday,
  buildRepertoireMilestones,
  buildSessionPlan,
  buildTeacherAnalytics,
  compareLocalRecordings,
  buildWeeklyPracticePlan,
  formatPlannerNote,
  FOCUSED_FIVE_MINUTE_DRILLS,
  findGenrePresetEntry,
  GENRE_VOICING_PRESETS,
  getFretRangeLabel,
  getVoicingCoverage,
  getEasierNextSteps,
  getGenrePracticePath,
  getOfflineLibraryStatus,
  normalizeTransitionDrills,
  pickRandomPracticalChord,
  scoreVoicingConfidence,
  simulateKeyChange,
  inspectFingerTransition,
  recommendAdaptiveRhythm,
  recommendCapoPositions,
  type EnharmonicPreference,
  type GenrePracticePath,
  type LocalRecordingDescriptor,
  type OfflinePackSelection,
  type TransitionDrill,
  type VocalRange
} from "../lib/chordPracticePlanner";

type ChordPracticePlannerProps = {
  entries: ChordLibraryItem[];
  selectedEntry: ChordLibraryItem | null;
  practiceStats: PracticeStats;
  assignments: TeacherAssignment[];
  stringMistakes: Record<string, number[]>;
  activeStudentId: string;
  onSelectEntry: (id: string) => void;
  onPlayChord?: (chord: ChordLibraryItem["chord"], mode?: "strum" | "arpeggio") => void;
  sightReadingMode: boolean;
  onSightReadingModeChange: (enabled: boolean) => void;
};

const OFFLINE_STORAGE_KEY = "chord-hero-library-offline-planner-v1";
const DEFAULT_OFFLINE_SELECTION: OfflinePackSelection = { keyIds: ["G"], tuningIds: ["standard"], sampleVoices: ["steel"] };
const VIDEO_LINKS_STORAGE_KEY = "chord-hero-library-technique-video-links";
const TRANSITION_DRILLS_STORAGE_KEY = "chord-hero-library-transition-drills";
const NOTIFICATION_SETTINGS_STORAGE_KEY = "chord-hero-library-practice-notifications";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function createDescriptor(file: File, analysis: RecordingAnalysis, label: string): LocalRecordingDescriptor {
  return { id: `${label}-${file.name}-${file.lastModified}`, label, sizeBytes: file.size, durationMs: analysis.durationMs, analysis };
}

export default function ChordPracticePlanner({
  entries,
  selectedEntry,
  practiceStats,
  assignments,
  stringMistakes,
  activeStudentId,
  onSelectEntry,
  onPlayChord,
  sightReadingMode,
  onSightReadingModeChange
}: ChordPracticePlannerProps) {
  const [genre, setGenre] = useState<GenrePracticePath["id"]>("folk");
  const [songKey, setSongKey] = useState<HarmonyNote>("G");
  const [vocalRange, setVocalRange] = useState<VocalRange>({ lowMidi: 48, highMidi: 67 });
  const [enharmonic, setEnharmonic] = useState<EnharmonicPreference>("auto");
  const [comparisonId, setComparisonId] = useState("");
  const [cleanReps, setCleanReps] = useState(0);
  const [timingScore, setTimingScore] = useState(86);
  const [currentBpm, setCurrentBpm] = useState(78);
  const [offlineSelection, setOfflineSelection] = useState<OfflinePackSelection>(DEFAULT_OFFLINE_SELECTION);
  const [offlineMessage, setOfflineMessage] = useState("Selection is stored locally; audio remains opt-in and on demand.");
  const [reference, setReference] = useState<LocalRecordingDescriptor | null>(null);
  const [studentTake, setStudentTake] = useState<LocalRecordingDescriptor | null>(null);
  const [recordingStatus, setRecordingStatus] = useState("Choose two local audio files to compare attack and timing.");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [simulatorKey, setSimulatorKey] = useState<HarmonyNote>("G");
  const [selectedDrillId, setSelectedDrillId] = useState<(typeof FOCUSED_FIVE_MINUTE_DRILLS)[number]["id"]>("f-barre");
  const [sightAnswer, setSightAnswer] = useState("");
  const [sightResult, setSightResult] = useState("");
  const [teachingStep, setTeachingStep] = useState(0);
  const [videoLinks, setVideoLinks] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoMessage, setVideoMessage] = useState("");
  const [transitionHistory, setTransitionHistory] = useState<Array<{ id: string; label: string; score: number; recordedAt: string }>>([]);
  const [transitionDrills, setTransitionDrills] = useState<TransitionDrill[]>([]);
  const [drillName, setDrillName] = useState("");
  const [drillTempo, setDrillTempo] = useState(72);
  const [drillReps, setDrillReps] = useState(5);
  const [notificationSettings, setNotificationSettings] = useState({ dueReviews: true, activeGoals: true });
  const [notificationMessage, setNotificationMessage] = useState("");
  const [randomEntryId, setRandomEntryId] = useState("");
  const [genrePreset, setGenrePreset] = useState<(typeof GENRE_VOICING_PRESETS)[number]["id"]>("folk-open");
  const [presetMessage, setPresetMessage] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (stored) setOfflineSelection({ ...DEFAULT_OFFLINE_SELECTION, ...JSON.parse(stored) });
    } catch {
      // Local planner preferences are optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(offlineSelection));
    } catch {
      // Private browsing can reject local storage without affecting practice.
    }
  }, [offlineSelection]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIDEO_LINKS_STORAGE_KEY);
      if (stored) setVideoLinks(JSON.parse(stored).filter((value: unknown): value is string => typeof value === "string").slice(0, 8));
    } catch {
      // Local technique references are optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIDEO_LINKS_STORAGE_KEY, JSON.stringify(videoLinks));
    } catch {
      // Keep personal links available for the current session if storage is unavailable.
    }
  }, [videoLinks]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TRANSITION_DRILLS_STORAGE_KEY);
      if (stored) setTransitionDrills(normalizeTransitionDrills(JSON.parse(stored), CHORD_LIBRARY));
      const notificationStored = window.localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
      if (notificationStored) setNotificationSettings((current) => ({ ...current, ...JSON.parse(notificationStored) }));
    } catch {
      // Optional practice preferences must never block the library.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRANSITION_DRILLS_STORAGE_KEY, JSON.stringify(transitionDrills.slice(0, 24)));
      window.localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(notificationSettings));
    } catch {
      // Keep the current session usable when storage is unavailable.
    }
  }, [notificationSettings, transitionDrills]);

  const comparisonEntry = useMemo(
    () => entries.find((entry) => entry.id === comparisonId) ?? entries.find((entry) => entry.id !== selectedEntry?.id) ?? null,
    [comparisonId, entries, selectedEntry?.id]
  );
  const capoRecommendations = useMemo(() => recommendCapoPositions(songKey, vocalRange, entries), [entries, songKey, vocalRange]);
  const path = getGenrePracticePath(genre);
  const sessionPlan = useMemo(() => buildSessionPlan(entries, practiceStats, assignments.filter((assignment) => assignment.studentId === activeStudentId), genre), [activeStudentId, assignments, entries, genre, practiceStats]);
  const achievements = useMemo(() => buildAchievementMap(entries, practiceStats), [entries, practiceStats]);
  const analytics = useMemo(() => buildTeacherAnalytics(entries, practiceStats, assignments.filter((assignment) => assignment.studentId === activeStudentId), stringMistakes), [activeStudentId, assignments, entries, practiceStats, stringMistakes]);
  const rhythm = useMemo(() => recommendAdaptiveRhythm(currentBpm, cleanReps, timingScore, path), [cleanReps, currentBpm, path, timingScore]);
  const transition = selectedEntry && comparisonEntry ? inspectFingerTransition(selectedEntry, comparisonEntry) : null;
  const offlineStatus = useMemo(() => getOfflineLibraryStatus(offlineSelection, entries), [entries, offlineSelection]);
  const comparison = reference && studentTake ? compareLocalRecordings(studentTake, reference) : null;
  const confidence = useMemo(() => scoreVoicingConfidence(selectedEntry), [selectedEntry]);
  const easierSteps = useMemo(() => getEasierNextSteps(selectedEntry, entries), [entries, selectedEntry]);
  const keyChange = useMemo(() => simulateKeyChange(path.roles, simulatorKey, entries), [entries, path.roles, simulatorKey]);
  const practiceToday = useMemo(() => buildPracticeToday(entries, practiceStats, genre), [entries, genre, practiceStats]);
  const coverage = useMemo(() => getVoicingCoverage(selectedEntry), [selectedEntry]);
  const milestones = useMemo(() => buildRepertoireMilestones(entries, practiceStats), [entries, practiceStats]);
  const familyDependencies = useMemo(() => buildChordFamilyDependencyMap(entries, practiceStats), [entries, practiceStats]);
  const weeklyPlan = useMemo(() => buildWeeklyPracticePlan(entries, practiceStats, assignments.filter((assignment) => assignment.studentId === activeStudentId), genre), [activeStudentId, assignments, entries, genre, practiceStats]);
  const selectedDrill = FOCUSED_FIVE_MINUTE_DRILLS.find((drill) => drill.id === selectedDrillId) ?? FOCUSED_FIVE_MINUTE_DRILLS[0];
  const sightOptions = useMemo(() => {
    if (!selectedEntry) return [];
    return Array.from(new Set([selectedEntry.chord.name, ...entries.filter((entry) => entry.id !== selectedEntry.id).slice(0, 3).map((entry) => entry.chord.name)]));
  }, [entries, selectedEntry]);
  const teachingLabels = ["Theory", "Listening", "Hands-on"];

  const toggleOfflineValue = (field: keyof OfflinePackSelection, value: string) => {
    setOfflineSelection((current) => {
      const values = current[field];
      return { ...current, [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };

  const analyzeFile = async (file: File, label: "teacher" | "student") => {
    setIsAnalyzing(true);
    setRecordingStatus(`Analyzing local ${label} reference...`);
    try {
      const analysis = await analyzePracticeRecording(file, { referenceBpm: currentBpm, expectedSteps: 4, pitchScoringMode: "timing" });
      const descriptor = createDescriptor(file, analysis, label);
      if (label === "teacher") setReference(descriptor);
      else setStudentTake(descriptor);
      setRecordingStatus(`${label === "teacher" ? "Teacher reference" : "Student take"} analyzed locally. No upload was performed.`);
    } catch {
      setRecordingStatus("The file could not be analyzed in this browser. Try a short WAV, MP3, or M4A take.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const recordTransition = () => {
    if (!selectedEntry || !comparisonEntry || !transition) return;
    const label = `${selectedEntry.chord.name} -> ${comparisonEntry.chord.name}`;
    setTransitionHistory((history) => [{ id: `${label}-${Date.now()}`, label, score: transition.cost.score, recordedAt: new Date().toISOString() }, ...history].slice(0, 12));
  };

  const saveTransitionDrill = () => {
    if (!selectedEntry || !comparisonEntry || !drillName.trim()) return;
    const ids = [selectedEntry.id, comparisonEntry.id];
    setTransitionDrills((drills) => [{ id: `drill-${Date.now()}`, name: drillName.trim().slice(0, 80), chordIds: ids, tempo: Math.max(40, Math.min(180, drillTempo)), targetReps: Math.max(1, Math.min(50, drillReps)), createdAt: new Date().toISOString() }, ...drills].slice(0, 24));
    setDrillName("");
  };

  const runTransitionDrill = (drill: TransitionDrill) => {
    const first = entries.find((entry) => entry.id === drill.chordIds[0]);
    if (first) onSelectEntry(first.id);
    setDrillTempo(drill.tempo);
    setDrillReps(drill.targetReps);
  };

  const requestPracticeNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationMessage("This browser does not expose notifications; due reviews remain visible in the planner.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationMessage(permission === "granted" ? "Permission granted. The planner will show due reviews when you open it; it does not schedule background alerts." : "Permission not granted. Due reviews remain available in the planner.");
    } catch {
      setNotificationMessage("Notifications are unavailable here; due reviews remain visible in the planner.");
    }
  };

  const chooseRandomChord = () => {
    const picked = pickRandomPracticalChord(entries, { seed: Date.now() });
    if (picked) {
      setRandomEntryId(picked.id);
      onSelectEntry(picked.id);
    }
  };

  const applyGenrePreset = (id: (typeof GENRE_VOICING_PRESETS)[number]["id"]) => {
    const preset = GENRE_VOICING_PRESETS.find((candidate) => candidate.id === id) ?? GENRE_VOICING_PRESETS[0];
    const entry = findGenrePresetEntry(entries, id);
    setGenrePreset(id);
    setGenre(preset.genre);
    if (entry) {
      onSelectEntry(entry.id);
      setPresetMessage(`${preset.label}: selected ${entry.chord.name} without changing the active library filters.`);
    } else {
      setPresetMessage(`${preset.label}: no matching shape is in the current result set, so your existing results were preserved.`);
    }
  };

  const addVideoReference = () => {
    try {
      const parsed = new URL(videoUrl.trim());
      if (parsed.protocol !== "https:") throw new Error("HTTPS required");
      setVideoLinks((links) => Array.from(new Set([parsed.toString(), ...links])).slice(0, 8));
      setVideoUrl("");
      setVideoMessage("Saved on this device only.");
    } catch {
      setVideoMessage("Add a valid HTTPS video URL. The link stays local and is never uploaded by the library.");
    }
  };

  const answerSightReading = () => {
    if (!selectedEntry) return;
    const correct = sightAnswer.trim().toLowerCase() === selectedEntry.chord.name.toLowerCase();
    setSightResult(correct ? "Correct. Reveal the chart and check your fingering." : `Not quite. The answer is ${selectedEntry.chord.name}.`);
    if (correct) onSightReadingModeChange(false);
  };

  const advanceTeachingStep = () => {
    const next = (teachingStep + 1) % teachingLabels.length;
    setTeachingStep(next);
    if (next === 1 && selectedEntry) onPlayChord?.(selectedEntry.chord, "arpeggio");
    if (next === 2 && selectedEntry) onSelectEntry(selectedEntry.id);
  };

  return (
    <section className="chord-practice-planner" aria-labelledby="chord-practice-planner-title">
      <header className="planner-heading">
        <div><span className="label">Practice planner</span><h3 id="chord-practice-planner-title">Turn a chord shape into a session</h3><p>Local-first planning tools for vocal fit, transitions, rhythm, progress, and teacher review.</p></div>
        <span className="planner-badge">No uploads · lazy panel</span>
      </header>

      <div className="planner-grid planner-focus-grid">
        <section className="planner-panel planner-today-panel">
          <div className="planner-panel-heading"><div><span className="label">Practice today</span><h4>One useful next session</h4></div><span className="planner-score">{practiceToday.minutes} min</span></div>
          <p>{practiceToday.summary}</p>
          <div className="planner-today-actions">
            {practiceToday.dueReview ? <button className="chip" type="button" onClick={() => onSelectEntry(practiceToday.dueReview!.id)}>Review {practiceToday.dueReview.chord.name}</button> : <span className="planner-note">No due review</span>}
            {practiceToday.weakTransition ? <button className="chip" type="button" onClick={() => onSelectEntry(practiceToday.weakTransition!.id)}>Repair {practiceToday.weakTransition.chord.name}</button> : null}
            <span className="planner-song-pill">{practiceToday.song.title} · {practiceToday.song.progression}</span>
          </div>
        </section>

        <section className="planner-panel planner-confidence-panel">
          <div className="planner-panel-heading"><div><span className="label">Voicing confidence</span><h4>{confidence.score}/100 · {confidence.label}</h4></div><span className="planner-confidence-ring" aria-label={`${confidence.score} percent confidence`}>{confidence.score}%</span></div>
          <p>{confidence.explanation}</p>
          <div className="planner-confidence-bars"><span><b>Completeness</b><i><em style={{ width: `${confidence.completeness}%` }} /></i></span><span><b>Practicality</b><i><em style={{ width: `${confidence.practicality}%` }} /></i></span></div>
          <ul className="planner-factor-list">{confidence.factors.map((factor) => <li key={factor}>{factor}</li>)}</ul>
        </section>
      </div>

      <div className="planner-grid planner-top-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Song setup</span><h4>Vocal range and capo</h4></div></div>
          <div className="planner-form-grid">
            <label>Song key<select value={songKey} onChange={(event) => setSongKey(event.target.value as HarmonyNote)}>{HARMONY_NOTES.map((note) => <option key={note} value={note}>{formatPlannerNote(note, enharmonic)}</option>)}</select></label>
            <label>Low note MIDI<input type="number" min="36" max="72" value={vocalRange.lowMidi} onChange={(event) => setVocalRange((current) => ({ ...current, lowMidi: Math.max(36, Math.min(current.highMidi - 1, Number(event.target.value) || 48)) }))} /></label>
            <label>High note MIDI<input type="number" min="48" max="96" value={vocalRange.highMidi} onChange={(event) => setVocalRange((current) => ({ ...current, highMidi: Math.min(96, Math.max(current.lowMidi + 1, Number(event.target.value) || 67)) }))} /></label>
            <label>Chord spelling<select value={enharmonic} onChange={(event) => setEnharmonic(event.target.value as EnharmonicPreference)}><option value="auto">Auto</option><option value="sharp">Prefer sharps</option><option value="flat">Prefer flats</option></select></label>
          </div>
          <div className="planner-capo-list">{capoRecommendations.slice(0, 3).map((recommendation) => <button key={recommendation.capo} type="button" onClick={() => setSongKey(recommendation.soundingKey)}><strong>Capo {recommendation.capo}</strong><span>{formatPlannerNote(recommendation.shapeKey, enharmonic)} shapes · {recommendation.beginnerShapeCount} easy</span><small>{recommendation.explanation}</small></button>)}</div>
          <p className="planner-note">Vocal fit uses the selected tonic and range center as a planning signal; confirm the melody in the target song.</p>
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Genre path</span><h4>{path.label} practice route</h4></div><label>Style<select value={genre} onChange={(event) => setGenre(event.target.value as GenrePracticePath["id"])}>{["folk", "pop", "blues", "jazz", "worship"].map((id) => <option key={id} value={id}>{getGenrePracticePath(id as GenrePracticePath["id"]).label}</option>)}</select></label></div>
          <p>{path.focus}</p><div className="planner-role-strip">{path.roles.map((role) => <span key={role}>{role}</span>)}</div>
          <ol className="planner-step-list">{path.steps.map((step, index) => <li key={step}><strong>{index + 1}</strong><span>{step}</span></li>)}</ol>
          <div className="planner-preset-list" aria-label="Genre voicing presets">{GENRE_VOICING_PRESETS.map((preset) => <button key={preset.id} type="button" className={preset.id === genrePreset ? "active" : ""} onClick={() => applyGenrePreset(preset.id)}><strong>{preset.label}</strong><small>{preset.description}</small></button>)}</div>
          {presetMessage ? <p className="planner-note" role="status">{presetMessage}</p> : null}
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Key-change simulator</span><h4>Keep the function, change the shapes</h4></div></div>
          <label>Target key<select value={simulatorKey} onChange={(event) => setSimulatorKey(event.target.value as HarmonyNote)}>{HARMONY_NOTES.map((note) => <option key={note} value={note}>{formatPlannerNote(note, enharmonic)}</option>)}</select></label>
          <div className="planner-key-change-list">{keyChange.map((item) => <button key={item.role} type="button" disabled={!item.entry} onClick={() => item.entry && onSelectEntry(item.entry.id)}><span><strong>{item.role}</strong><small>{item.entry ? `${item.entry.chord.name} · ${item.entry.position}` : "No matching shape"}</small></span><small>{item.reason}</small></button>)}</div>
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Easier next step</span><h4>Reduce the load without losing the chord</h4></div></div>
          {easierSteps.length ? <div className="planner-easier-list">{easierSteps.map((step) => <button key={step.id} type="button" onClick={() => onSelectEntry(step.id)}><span><strong>{step.label}</strong><small>{step.type}</small></span><p>{step.description}</p></button>)}</div> : <p className="planner-note">Select a barre or full voicing to see partial and capo-friendly routes.</p>}
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel planner-drill-panel">
          <div className="planner-panel-heading"><div><span className="label">Five-minute drills</span><h4>Target one pain point</h4></div><span className="planner-score">5:00</span></div>
          <div className="planner-drill-tabs">{FOCUSED_FIVE_MINUTE_DRILLS.map((drill) => <button key={drill.id} type="button" className={drill.id === selectedDrill.id ? "active" : ""} onClick={() => { setSelectedDrillId(drill.id); if (drill.targetName) { const match = entries.find((entry) => entry.chord.name === drill.targetName || entry.chord.name.startsWith(`${drill.targetName}/`)); if (match) onSelectEntry(match.id); } }}>{drill.title}</button>)}</div>
          <ol className="planner-step-list">{selectedDrill.steps.map((step, index) => <li key={step}><strong>{index + 1}</strong><span>{step}</span></li>)}</ol>
          <p className="planner-note"><strong>Finish line:</strong> {selectedDrill.success}</p>
        </section>

        <section className="planner-panel planner-sight-panel">
          <div className="planner-panel-heading"><div><span className="label">Sight-reading mode</span><h4>Answer before the chart appears</h4></div><label><input type="checkbox" checked={sightReadingMode} onChange={(event) => { onSightReadingModeChange(event.target.checked); setSightResult(""); setSightAnswer(""); }} /> Hide chart</label></div>
          {sightReadingMode ? <><p>Look at the chord name only in the library header, build the shape from memory, then submit your answer.</p><label>Your answer<input value={sightAnswer} onChange={(event) => setSightAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") answerSightReading(); }} placeholder="Chord name" /></label><button className="btn" type="button" onClick={answerSightReading} disabled={!selectedEntry || !sightAnswer.trim()}>Check answer</button>{sightResult ? <p className="planner-sight-result" role="status">{sightResult}</p> : null}</> : <p className="planner-note">Enable this mode to hide the selected chord chart until you answer.</p>}
          {!selectedEntry ? <p className="planner-note">Select a voicing in Browse to start a sight-reading prompt.</p> : null}
          {!sightReadingMode && selectedEntry ? <div className="planner-sight-options">{sightOptions.map((option) => <button key={option} type="button" onClick={() => { setSightAnswer(option); onSightReadingModeChange(true); }}>{option}</button>)}</div> : null}
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Transition inspector</span><h4>See the fingers that move</h4></div></div>
          <label>Compare with<select value={comparisonEntry?.id ?? ""} onChange={(event) => setComparisonId(event.target.value)}>{entries.filter((entry) => entry.id !== selectedEntry?.id).slice(0, 80).map((entry) => <option key={entry.id} value={entry.id}>{entry.chord.name} · {entry.position}</option>)}</select></label>
          {selectedEntry && comparisonEntry && transition ? <><p className="planner-transition-summary"><strong>{selectedEntry.chord.name} → {comparisonEntry.chord.name}</strong> · {transition.summary}</p><div className="planner-stat-row"><span>{transition.sharedFingerCount} shared fingers</span><span>{transition.cost.fretMovement} fret movement</span><span>{transition.cost.barreDifficulty} barre load</span></div><div className="planner-compact-comparison"><span>Bass: {selectedEntry.chord.frets[0] < 0 ? "muted" : selectedEntry.chord.name.split("/")[1] ?? "root"}</span><span>High: {selectedEntry.chord.frets.at(-1) === 0 ? "open" : `${selectedEntry.chord.frets.at(-1)}fr`}</span><span>Fret range: {getFretRangeLabel(selectedEntry.chord.frets)}</span><span>Barre: {selectedEntry.chord.barre ? `yes, ${selectedEntry.chord.barre.fret}fr` : "no"}</span><span>Stretch: {selectedEntry.difficultyTags.includes("stretch") ? "high" : "low"}</span><span>Cost: {transition.cost.score}/100</span></div><ul className="planner-move-list">{transition.fingerMoves.map((move) => <li key={move.finger}><strong>Finger {move.finger}</strong><span>{move.kind} {move.fromString ? `string ${move.fromString}, fret ${move.fromFret}` : ""}{move.toString ? ` → string ${move.toString}, fret ${move.toFret}` : ""}</span></li>)}</ul></> : <p className="planner-note">Select a chord and a second voicing in the library to inspect the transition.</p>}
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Adaptive rhythm</span><h4>Count in, then earn tempo</h4></div><span className="planner-score">{rhythm.recommendedBpm} BPM</span></div>
          <div className="planner-form-grid"><label>Practice BPM<input type="number" min="40" max="180" value={currentBpm} onChange={(event) => setCurrentBpm(Math.max(40, Math.min(180, Number(event.target.value) || 78)))} /></label><label>Clean reps<input type="number" min="0" max="20" value={cleanReps} onChange={(event) => setCleanReps(Math.max(0, Math.min(20, Number(event.target.value) || 0)))} /></label><label>Timing score<input type="number" min="0" max="100" value={timingScore} onChange={(event) => setTimingScore(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} /></label></div>
          <p>{rhythm.explanation}</p><div className="planner-stat-row"><span>Count-in: {rhythm.countInBeats} beats</span><span>Next: {rhythm.nextBpm} BPM</span><span>{rhythm.canAdvance ? "Ready to advance" : `${rhythm.cleanRepsNeeded} clean reps left`}</span></div>
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Chord-tone coverage</span><h4>{coverage.percent}% of tones present</h4></div><span className="planner-score">{coverage.present.length}/{coverage.total}</span></div>
          <div className="planner-coverage-meter" aria-label={`${coverage.percent} percent chord tone coverage`}><span style={{ width: `${coverage.percent}%` }} /></div>
          <p className="planner-note">{coverage.explanation}</p>
          <div className="planner-chip-list"><span className="chip active">Present: {coverage.present.join(", ") || "none"}</span><span className="chip">Omitted: {coverage.omitted.join(", ") || "none"}</span></div>
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Named transition drills</span><h4>Save this change</h4></div><span className="planner-badge">Local only</span></div>
          <div className="planner-drill-form"><input value={drillName} onChange={(event) => setDrillName(event.target.value)} placeholder="G -> C -> D" aria-label="Transition drill name" /><input type="number" min="40" max="180" value={drillTempo} onChange={(event) => setDrillTempo(Math.max(40, Math.min(180, Number(event.target.value) || 72)))} aria-label="Transition drill tempo" /><input type="number" min="1" max="50" value={drillReps} onChange={(event) => setDrillReps(Math.max(1, Math.min(50, Number(event.target.value) || 5)))} aria-label="Transition drill target repetitions" /><button className="btn" type="button" onClick={saveTransitionDrill} disabled={!selectedEntry || !comparisonEntry || !drillName.trim()}>Save</button></div>
          {transitionDrills.length ? <div className="planner-saved-drills">{transitionDrills.map((drill) => <div key={drill.id}><span><strong>{drill.name}</strong><small>{drill.tempo} BPM · {drill.targetReps} reps</small></span><button className="btn ghost" type="button" onClick={() => runTransitionDrill(drill)}>Run</button><button className="text-button" type="button" onClick={() => setTransitionDrills((items) => items.filter((item) => item.id !== drill.id))}>Delete</button></div>)}</div> : <p className="planner-note">Choose two voicings above, name the change, and save it for a future session.</p>}
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Session planner</span><h4>{sessionPlan.title} · {sessionPlan.totalMinutes} min</h4></div></div>
          <div className="planner-session-list">{sessionPlan.items.map((item) => <button key={item.id} type="button" onClick={() => item.chordIds[0] && onSelectEntry(item.chordIds[0])}><span><strong>{item.title}</strong><small>{item.detail}</small></span><b>{item.minutes}m</b></button>)}</div>
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Family achievements</span><h4>Build range, not just reps</h4></div></div>
          <div className="planner-achievement-list">{achievements.map((item) => <button key={item.family} type="button" onClick={() => item.nextChordId && onSelectEntry(item.nextChordId)}><span><strong>{item.family}</strong><small>{item.detail}</small></span><b>{item.completed}/{item.total}</b><i><em style={{ width: `${item.percent}%` }} /></i></button>)}</div>
        </section>
      </div>

      <section className="planner-panel planner-dependency-panel">
        <div className="planner-panel-heading"><div><span className="label">Chord-family dependency map</span><h4>Move from reliable shapes to richer colors</h4></div><span className="planner-badge">Current library set</span></div>
        <p className="planner-note">Each stage explains what prepares the next one. Select a suggested shape to continue without changing your active filters.</p>
        <div className="planner-dependency-map">{familyDependencies.map((item, index) => <article key={item.id} className={item.unlocked ? "unlocked" : "locked"}><span className="planner-dependency-step">{index + 1}</span><div><strong>{item.label}</strong><small>{item.explanation}</small><span>{item.completed}/{item.total} practiced</span></div><button className="btn ghost" type="button" disabled={!item.nextChordId || !item.unlocked} onClick={() => item.nextChordId && onSelectEntry(item.nextChordId)}>{item.nextChordId ? "Choose next shape" : "No shape in set"}</button></article>)}</div>
      </section>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Random practical chord</span><h4>Practice the active filter</h4></div><span className="planner-badge">Current results only</span></div>
          <p className="planner-note">Picks from the current key, function, difficulty, and search result set instead of showing an arbitrary shape.</p>
          <button className="btn primary" type="button" onClick={chooseRandomChord} disabled={!entries.length}>Choose random voicing</button>
          {randomEntryId ? <p className="planner-random-result" role="status">Selected: {entries.find((entry) => entry.id === randomEntryId)?.chord.name ?? "voicing"}</p> : null}
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Practice notifications</span><h4>Keep reviews visible</h4></div><span className="planner-badge">No background scheduling</span></div>
          <div className="planner-notification-options"><label><input type="checkbox" checked={notificationSettings.dueReviews} onChange={(event) => setNotificationSettings((current) => ({ ...current, dueReviews: event.target.checked }))} /> Due reviews</label><label><input type="checkbox" checked={notificationSettings.activeGoals} onChange={(event) => setNotificationSettings((current) => ({ ...current, activeGoals: event.target.checked }))} /> Active goals</label></div>
          <button className="btn" type="button" onClick={() => void requestPracticeNotifications()}>Allow browser permission</button>
          {notificationMessage ? <p className="planner-note" role="status">{notificationMessage}</p> : null}
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Teach me this progression</span><h4>{teachingLabels[teachingStep]} step</h4></div><span className="planner-score">{teachingStep + 1}/3</span></div>
          <p>{teachingStep === 0 ? `Theory: ${path.roles.join(" -> ")} keeps a clear ${path.label.toLowerCase()} function path. Notice where tension resolves.` : teachingStep === 1 ? "Listening: hear the selected voicing, then sing or name its role before touching the next shape." : "Hands-on: make the selected shape, play two slow repetitions, and log one clean change."}</p>
          <button className="btn" type="button" onClick={advanceTeachingStep}>{teachingStep === 0 ? "Play listening step" : teachingStep === 1 ? "Start hands-on step" : "Restart theory"}</button>
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Repertoire milestones</span><h4>Unlock song context</h4></div></div>
          <div className="planner-milestone-list">{milestones.map((milestone) => <article key={milestone.id} className={milestone.unlocked ? "unlocked" : "locked"}><span><strong>{milestone.title}</strong><small>{milestone.song}</small></span><b>{milestone.completed}/{milestone.required || 0}</b><p>{milestone.detail}</p></article>)}</div>
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Technique references</span><h4>Personal HTTPS video links</h4></div><span className="planner-badge">Local only</span></div>
          <div className="planner-video-add"><input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://example.com/my-technique" inputMode="url" /><button className="btn" type="button" onClick={addVideoReference} disabled={!videoUrl.trim()}>Add link</button></div>
          {videoMessage ? <p className="planner-note" role="status">{videoMessage}</p> : null}
          {videoLinks.length ? <ul className="planner-video-list">{videoLinks.map((link) => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a><button type="button" onClick={() => setVideoLinks((links) => links.filter((candidate) => candidate !== link))}>Remove</button></li>)}</ul> : <p className="planner-note">Add a technique reference you already trust. Links never leave this device.</p>}
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Compare history</span><h4>Track transition cost</h4></div><span className="planner-score">{transitionHistory.length} saved</span></div>
          <button className="btn" type="button" onClick={recordTransition} disabled={!transition}>Record current comparison</button>
          {transitionHistory.length ? <div className="planner-history-list">{transitionHistory.map((item) => <div key={item.id}><span><strong>{item.label}</strong><small>{new Date(item.recordedAt).toLocaleDateString()}</small></span><b>{item.score}/100</b></div>)}</div> : <p className="planner-note">Record the same transition after practice to see whether its cost improves.</p>}
        </section>
      </div>

      <section className="planner-panel planner-recording-panel">
        <div className="planner-panel-heading"><div><span className="label">Teacher reference, local only</span><h4>Compare chord attack and timing</h4></div><span className="planner-note">{recordingStatus}</span></div>
        <div className="planner-recording-grid"><label>Teacher reference<input type="file" accept="audio/*" disabled={isAnalyzing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file, "teacher"); event.currentTarget.value = ""; }} /></label><label>Your take<input type="file" accept="audio/*" disabled={isAnalyzing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file, "student"); event.currentTarget.value = ""; }} /></label></div>
        {reference || studentTake ? <div className="planner-recording-status"><span>Teacher: {reference ? `${reference.label} · ${formatBytes(reference.sizeBytes)}` : "not selected"}</span><span>Student: {studentTake ? `${studentTake.label} · ${formatBytes(studentTake.sizeBytes)}` : "not selected"}</span></div> : null}
        {comparison ? <p className="planner-comparison-result"><strong>{comparison.summary}</strong> Consistency delta: {comparison.consistencyDelta >= 0 ? "+" : ""}{comparison.consistencyDelta}.</p> : <p className="planner-note">Files stay in memory for this comparison and are never uploaded or persisted by the planner.</p>}
      </section>

      <section className="planner-panel planner-weekly-panel">
        <div className="planner-panel-heading"><div><span className="label">Weekly practice plan</span><h4>{weeklyPlan.totalMinutes} minutes across seven short sessions</h4></div><button className="btn primary" type="button" onClick={() => window.print()}>Print weekly plan</button></div>
        <p className="planner-note">{weeklyPlan.summary}</p>
        <div className="planner-weekly-grid">{weeklyPlan.days.map((day) => <article key={day.day}><strong>{day.day}</strong><span>{day.focus} · {day.minutes}m</span><small>{day.detail}</small></article>)}</div>
      </section>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Offline library manager</span><h4>Choose a bounded local pack</h4></div><span className="planner-badge">Adapter only</span></div>
          <div className="planner-choice-group"><span className="label">Keys</span><div>{HARMONY_NOTES.map((note) => <label key={note}><input type="checkbox" checked={offlineSelection.keyIds.includes(note)} onChange={() => toggleOfflineValue("keyIds", note)} />{formatPlannerNote(note, enharmonic)}</label>)}</div></div>
          <div className="planner-choice-group"><span className="label">Tunings</span><div>{["standard", "drop-d", "dadgad", "half-step-down", "standard-7"].map((tuning) => <label key={tuning}><input type="checkbox" checked={offlineSelection.tuningIds.includes(tuning)} onChange={() => toggleOfflineValue("tuningIds", tuning)} />{tuning}</label>)}</div></div>
          <div className="planner-choice-group"><span className="label">Samples</span><div>{["steel", "nylon", "muted", "picked"].map((voice) => <label key={voice}><input type="checkbox" checked={offlineSelection.sampleVoices.includes(voice)} onChange={() => toggleOfflineValue("sampleVoices", voice)} />{voice}</label>)}</div></div>
          <p className="planner-offline-status"><strong>{offlineStatus.storageLabel}</strong> · {offlineStatus.availableChordCount} eligible shapes · {offlineStatus.estimatedAssetCount} asset slots. {offlineStatus.description}</p>
          <button className="btn" type="button" onClick={() => setOfflineMessage(`Prepared a local selection for ${offlineStatus.selected.keyIds.join(", ") || "no keys"}. Actual downloads remain handled by the host audio/cache adapter.`)}>Prepare local selection</button>{offlineMessage ? <small className="planner-note">{offlineMessage}</small> : null}
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Teacher analytics</span><h4>What needs attention?</h4></div><span className="planner-score">{analytics.completionPercent}% complete</span></div>
          <div className="planner-stat-row"><span>{analytics.practiceMinutes} practice min</span><span>{analytics.repetitions} repetitions</span><span>{analytics.assignmentCount} assignments</span></div>
          <p className="planner-note">Weak voicings: {analytics.weakChordIds.slice(0, 4).map((id) => entries.find((entry) => entry.id === id)?.chord.name ?? id).join(", ") || "none recorded"}.</p>
          <div className="planner-analytics-list">{Object.entries(analytics.familyMinutes).map(([family, minutes]) => <span key={family}><strong>{family}</strong><small>{minutes} min</small></span>)}{analytics.commonMistakeStrings.slice(0, 3).map((mistake) => <span key={mistake.stringIndex}><strong>String {mistake.stringIndex + 1} mistakes</strong><small>{mistake.count} reports</small></span>)}</div>
        </section>
      </div>
    </section>
  );
}
