"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChordLibraryItem } from "../lib/chords";
import { HARMONY_NOTES, type HarmonyNote } from "../lib/harmony";
import { analyzePracticeRecording, type RecordingAnalysis } from "../lib/songRecordingAnalysis";
import type { PracticeStats, TeacherAssignment } from "../lib/studentProfile";
import {
  buildAchievementMap,
  buildSessionPlan,
  buildTeacherAnalytics,
  compareLocalRecordings,
  formatPlannerNote,
  getGenrePracticePath,
  getOfflineLibraryStatus,
  inspectFingerTransition,
  recommendAdaptiveRhythm,
  recommendCapoPositions,
  type EnharmonicPreference,
  type GenrePracticePath,
  type LocalRecordingDescriptor,
  type OfflinePackSelection,
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
};

const OFFLINE_STORAGE_KEY = "chord-hero-library-offline-planner-v1";
const DEFAULT_OFFLINE_SELECTION: OfflinePackSelection = { keyIds: ["G"], tuningIds: ["standard"], sampleVoices: ["steel"] };

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
  onSelectEntry
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

  return (
    <section className="chord-practice-planner" aria-labelledby="chord-practice-planner-title">
      <header className="planner-heading">
        <div><span className="label">Practice planner</span><h3 id="chord-practice-planner-title">Turn a chord shape into a session</h3><p>Local-first planning tools for vocal fit, transitions, rhythm, progress, and teacher review.</p></div>
        <span className="planner-badge">No uploads · lazy panel</span>
      </header>

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
        </section>
      </div>

      <div className="planner-grid">
        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Transition inspector</span><h4>See the fingers that move</h4></div></div>
          <label>Compare with<select value={comparisonEntry?.id ?? ""} onChange={(event) => setComparisonId(event.target.value)}>{entries.filter((entry) => entry.id !== selectedEntry?.id).slice(0, 80).map((entry) => <option key={entry.id} value={entry.id}>{entry.chord.name} · {entry.position}</option>)}</select></label>
          {selectedEntry && comparisonEntry && transition ? <><p className="planner-transition-summary"><strong>{selectedEntry.chord.name} → {comparisonEntry.chord.name}</strong> · {transition.summary}</p><div className="planner-stat-row"><span>{transition.sharedFingerCount} shared fingers</span><span>{transition.cost.fretMovement} fret movement</span><span>{transition.cost.barreDifficulty} barre load</span></div><ul className="planner-move-list">{transition.fingerMoves.map((move) => <li key={move.finger}><strong>Finger {move.finger}</strong><span>{move.kind} {move.fromString ? `string ${move.fromString}, fret ${move.fromFret}` : ""}{move.toString ? ` → string ${move.toString}, fret ${move.toFret}` : ""}</span></li>)}</ul></> : <p className="planner-note">Select a chord and a second voicing in the library to inspect the transition.</p>}
        </section>

        <section className="planner-panel">
          <div className="planner-panel-heading"><div><span className="label">Adaptive rhythm</span><h4>Count in, then earn tempo</h4></div><span className="planner-score">{rhythm.recommendedBpm} BPM</span></div>
          <div className="planner-form-grid"><label>Practice BPM<input type="number" min="40" max="180" value={currentBpm} onChange={(event) => setCurrentBpm(Math.max(40, Math.min(180, Number(event.target.value) || 78)))} /></label><label>Clean reps<input type="number" min="0" max="20" value={cleanReps} onChange={(event) => setCleanReps(Math.max(0, Math.min(20, Number(event.target.value) || 0)))} /></label><label>Timing score<input type="number" min="0" max="100" value={timingScore} onChange={(event) => setTimingScore(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} /></label></div>
          <p>{rhythm.explanation}</p><div className="planner-stat-row"><span>Count-in: {rhythm.countInBeats} beats</span><span>Next: {rhythm.nextBpm} BPM</span><span>{rhythm.canAdvance ? "Ready to advance" : `${rhythm.cleanRepsNeeded} clean reps left`}</span></div>
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

      <section className="planner-panel planner-recording-panel">
        <div className="planner-panel-heading"><div><span className="label">Teacher reference, local only</span><h4>Compare chord attack and timing</h4></div><span className="planner-note">{recordingStatus}</span></div>
        <div className="planner-recording-grid"><label>Teacher reference<input type="file" accept="audio/*" disabled={isAnalyzing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file, "teacher"); event.currentTarget.value = ""; }} /></label><label>Your take<input type="file" accept="audio/*" disabled={isAnalyzing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file, "student"); event.currentTarget.value = ""; }} /></label></div>
        {reference || studentTake ? <div className="planner-recording-status"><span>Teacher: {reference ? `${reference.label} · ${formatBytes(reference.sizeBytes)}` : "not selected"}</span><span>Student: {studentTake ? `${studentTake.label} · ${formatBytes(studentTake.sizeBytes)}` : "not selected"}</span></div> : null}
        {comparison ? <p className="planner-comparison-result"><strong>{comparison.summary}</strong> Consistency delta: {comparison.consistencyDelta >= 0 ? "+" : ""}{comparison.consistencyDelta}.</p> : <p className="planner-note">Files stay in memory for this comparison and are never uploaded or persisted by the planner.</p>}
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
