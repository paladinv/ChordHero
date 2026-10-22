"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./SongLibraryLearningTools.module.css";
import { CHORD_LIBRARY } from "../lib/chords";
import { auditSongArrangement, buildSongRecallPrompts, chordFunctionLabels, estimateTempoFromTaps, songSecondsAtBookmark, spellChordName, type RecallPrompt } from "../lib/songLibraryLearning";
import type { LibrarySong, SongBackingTrack, SongBackingTrackInstrument, SongLibraryState, SongPlayabilityProfile } from "../lib/songLibrary";
import { deleteRecording, estimateBrowserStorage, inspectBackingTrackKeys, loadRecording, saveRecording } from "../lib/songRecording";

type SpeechRecognitionResult = { isFinal: boolean; 0?: { transcript?: string } };
type SpeechRecognitionEvent = { results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: SpeechRecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
type Props = { song: LibrarySong; state: SongLibraryState; keyName: string; tempoBpm: number; displayChords: boolean; recording: boolean; canManageTracks: boolean; onStartRecording: () => void; onStopRecording: () => void; onChange: (next: SongLibraryState, description: string) => boolean | void };

const MAX_TRACK_BYTES = 50_000_000;
const instruments: SongBackingTrackInstrument[] = ["vocals", "guitar", "bass", "drums", "other"];
const shapeProfile: SongPlayabilityProfile = { maxFretSpan: 4, maxFret: 7, avoidBarre: false, preferredMode: "simplified" };
function chordNames(song: LibrarySong) {
  const names = song.sections.flatMap((section) => section.blocks.flatMap((block) => block.chords ?? (block.type === "chords" ? block.text?.split(/[\s|]+/) ?? [] : [])));
  const composition = song.composition?.sections.flatMap((section) => Object.values(section.measuresByTrack).flatMap((measures) => measures.flatMap((measure) => measure.events.flatMap((event) => event.chord ? [event.chord] : [])))) ?? [];
  return [...new Set([...names, ...composition].map((name) => name.trim()).filter(Boolean))].slice(0, 64);
}

export default function SongLibraryLearningTools({ song, state, keyName, tempoBpm, displayChords, recording, canManageTracks, onStartRecording, onStopRecording, onChange }: Props) {
  const [harmonyMode, setHarmonyMode] = useState<"chords" | "nashville" | "roman">("chords");
  const [recallKind, setRecallKind] = useState<"lyrics" | "chords">("lyrics");
  const [recallSectionId, setRecallSectionId] = useState(song.sections[0]?.id ?? "");
  const [promptIndex, setPromptIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [measureSectionId, setMeasureSectionId] = useState(song.composition?.sections[0]?.id ?? "");
  const [measureTrackId, setMeasureTrackId] = useState(song.composition?.tracks.find((track) => !track.muted)?.id ?? "");
  const [measureBookmarkBeat, setMeasureBookmarkBeat] = useState("1");
  const [profile, setProfile] = useState<SongPlayabilityProfile>(state.preferences.playabilityProfile ?? shapeProfile);
  const [trackName, setTrackName] = useState("");
  const [trackInstrument, setTrackInstrument] = useState<SongBackingTrackInstrument>("other");
  const [trackSection, setTrackSection] = useState("");
  const [trackMeasure, setTrackMeasure] = useState("");
  const [trackBeat, setTrackBeat] = useState("1");
  const [trackOffset, setTrackOffset] = useState("0");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [trackMessage, setTrackMessage] = useState("");
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [audioBusy, setAudioBusy] = useState<string | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [activeSectionId, setActiveSectionId] = useState(song.sections[0]?.id ?? "");
  const [calibrationBookmarkId, setCalibrationBookmarkId] = useState("");
  const [calibrationTaps, setCalibrationTaps] = useState<Record<string, number[]>>({});
  const [calibrationMessage, setCalibrationMessage] = useState("");
  const [storageReport, setStorageReport] = useState<{ missingIds: string[]; orphanIds: string[]; usageBytes?: number; quotaBytes?: number } | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [tourStep, setTourStep] = useState(-1);
  const audioElements = useRef<Record<string, HTMLAudioElement | null>>({});
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const urls = useRef<Record<string, string>>({});
  const recordingRef = useRef(recording);
  const activeSectionRef = useRef(activeSectionId);
  const recordingActions = useRef({ onStartRecording, onStopRecording });
  recordingRef.current = recording;
  activeSectionRef.current = activeSectionId;
  recordingActions.current = { onStartRecording, onStopRecording };

  useEffect(() => {
    setRecallSectionId(song.sections[0]?.id ?? ""); setActiveSectionId(song.sections[0]?.id ?? "");
    setMeasureSectionId(song.composition?.sections[0]?.id ?? ""); setMeasureTrackId(song.composition?.tracks.find((track) => !track.muted)?.id ?? "");
    setProfile(state.preferences.playabilityProfile ?? shapeProfile); setPromptIndex(0); setRevealed(false);
    setCalibrationTaps({}); setStorageReport(null);
  }, [song.id, song.sections, song.composition?.sections, song.composition?.tracks, state.preferences.playabilityProfile]);
  useEffect(() => { setCalibrationBookmarkId(state.sectionBookmarks.find((bookmark) => bookmark.songId === song.id && bookmark.marker?.measure)?.id ?? ""); }, [song.id, state.sectionBookmarks]);
  useEffect(() => () => {
    recognition.current?.stop();
    for (const url of Object.values(urls.current)) URL.revokeObjectURL(url);
    urls.current = {};
  }, [song.id]);

  const allChords = useMemo(() => chordNames(song), [song]);
  const prompts = useMemo(() => buildSongRecallPrompts(song, recallSectionId, recallKind), [recallKind, recallSectionId, song]);
  const prompt: RecallPrompt | undefined = prompts.length ? prompts[promptIndex % prompts.length] : undefined;
  const attempts = state.recallAttempts.filter((attempt) => attempt.songId === song.id && attempt.sectionId === recallSectionId && attempt.kind === recallKind).slice(0, 50);
  const attemptsRemembered = attempts.filter((attempt) => attempt.remembered).length;
  const tracks = state.backingTracks.filter((track) => track.songId === song.id).slice(0, 16);
  const bookmarks = state.sectionBookmarks.filter((bookmark) => bookmark.songId === song.id && bookmark.marker?.measure).slice(0, 64);
  const arrangementIssues = useMemo(() => auditSongArrangement(song), [song]);
  const composition = song.composition;
  const measureSection = composition?.sections.find((section) => section.id === measureSectionId);
  const measureTrack = composition?.tracks.find((track) => track.id === measureTrackId && !track.muted);
  const sectionMeasures = measureSection && measureTrack ? measureSection.measuresByTrack[measureTrack.id] ?? [] : [];
  const harmonyRows = useMemo(() => allChords.map((chord) => { const displayChord = spellChordName(chord, state.preferences.chordSpelling, keyName); return { chord: displayChord, ...chordFunctionLabels(chord, keyName) }; }), [allChords, keyName, state.preferences.chordSpelling]);
  const shapes = useMemo(() => allChords.map((name) => {
    const candidates = CHORD_LIBRARY.filter((item) => item.chord.name === name);
    const playable = candidates.filter((item) => {
      const frets = item.chord.frets.filter((fret) => fret > 0);
      const span = frets.length ? Math.max(...frets) - Math.min(...frets) : 0;
      const highest = frets.length ? Math.max(...frets) : 0;
      return span <= profile.maxFretSpan && highest <= profile.maxFret && (!profile.avoidBarre || !item.chord.barre);
    }).sort((left, right) => {
      const preferred = (item: typeof left) => profile.preferredMode === "barre" ? Number(!item.chord.barre) : profile.preferredMode === "partial-barre" ? Number(!item.difficultyTags.includes("partial")) : profile.preferredMode === "open" ? Number(!item.position.toLowerCase().includes("open")) : Number(item.difficultyTags.includes("barre"));
      return preferred(left) - preferred(right) || Math.max(...left.chord.frets.filter((fret) => fret > 0), 0) - Math.max(...right.chord.frets.filter((fret) => fret > 0), 0);
    });
    return { name, found: candidates.length, best: playable[0] };
  }), [allChords, profile]);
  const fittedCount = shapes.filter((shape) => shape.best).length;

  const saveRecall = (remembered: boolean) => {
    if (!prompt) return;
    const attempt = { id: crypto.randomUUID(), songId: song.id, sectionId: prompt.sectionId, kind: recallKind, remembered, createdAt: new Date().toISOString() };
    onChange({ ...state, recallAttempts: [attempt, ...state.recallAttempts].slice(0, 1000) }, "Saved a local song recall check");
    setRevealed(false); setPromptIndex((index) => (index + 1) % Math.max(1, prompts.length));
  };

  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onChange({ ...state, preferences: { ...state.preferences, playabilityProfile: profile } }, "Updated personal chord playability profile");
  };

  const uploadTrack = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (new FormData(form).get("audio") as File | null);
    if (!canManageTracks) { setTrackMessage("Your current library role cannot add backing tracks."); return; }
    if (!file) { setTrackMessage("Choose an audio file first."); return; }
    if (!file.type.startsWith("audio/") || file.size > MAX_TRACK_BYTES) { setTrackMessage("Choose an audio file no larger than 50 MB."); return; }
    if (!rightsConfirmed) { setTrackMessage("Confirm that you have permission to use this audio before attaching it."); return; }
    if (tracks.length >= 16) { setTrackMessage("This song already has the maximum of 16 attached tracks."); return; }
    const id = crypto.randomUUID();
    const track: SongBackingTrack = { id, songId: song.id, name: (trackName || file.name).slice(0, 120), instrument: trackInstrument, sectionId: trackSection || undefined, measure: trackMeasure ? Math.max(1, Math.min(9999, Math.round(Number(trackMeasure)))) : undefined, beat: Math.max(1, Math.min(64, Number(trackBeat) || 1)), offsetMs: Math.max(-3_600_000, Math.min(3_600_000, Math.round(Number(trackOffset) || 0))), mimeType: file.type, sizeBytes: file.size, rightsConfirmedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    try {
      await saveRecording(`backing-track:${id}`, file);
      const accepted = onChange({ ...state, backingTracks: [track, ...state.backingTracks].slice(0, 200) }, "Attached a local backing track");
      if (accepted === false) { await deleteRecording(`backing-track:${id}`); return; }
      setTrackMessage(`${track.name} saved on this device. Audio is not embedded in library backups or sync payloads.`);
      setTrackName(""); setTrackMeasure(""); setTrackOffset("0"); setRightsConfirmed(false); form.reset();
    } catch (error) { setTrackMessage(error instanceof Error ? error.message : "The audio file could not be saved locally."); }
  };

  const loadTrackPreview = async (track: SongBackingTrack) => {
    if (urls.current[track.id]) return;
    setAudioBusy(track.id);
    try {
      const blob = await loadRecording(`backing-track:${track.id}`);
      if (!blob) { setTrackMessage(`The local audio for ${track.name} is unavailable. It may have been cleared by the browser.`); return; }
      const url = URL.createObjectURL(blob); urls.current[track.id] = url; setAudioUrls((current) => ({ ...current, [track.id]: url }));
    } catch (error) { setTrackMessage(error instanceof Error ? error.message : "Audio could not be loaded."); }
    finally { setAudioBusy(null); }
  };

  const checkStorageHealth = async () => {
    setStorageBusy(true);
    try {
      const [audio, estimate] = await Promise.all([inspectBackingTrackKeys(state.backingTracks.map((track) => track.id)), estimateBrowserStorage()]);
      setStorageReport({ missingIds: audio.missingIds, orphanIds: audio.orphanIds, ...estimate });
      setTrackMessage(audio.missingIds.length ? `${audio.missingIds.length} audio file(s) need relinking.` : "All registered backing-track files are present on this device.");
    } catch (error) { setTrackMessage(error instanceof Error ? error.message : "Local audio storage could not be inspected."); }
    finally { setStorageBusy(false); }
  };

  const reattachTrack = async (track: SongBackingTrack, file: File | undefined) => {
    if (!file || !canManageTracks) return;
    if (!file.type.startsWith("audio/") || file.size > MAX_TRACK_BYTES) { setTrackMessage("Choose an audio file no larger than 50 MB."); return; }
    try {
      await saveRecording(`backing-track:${track.id}`, file);
      const nextTrack = { ...track, mimeType: file.type, sizeBytes: file.size };
      const accepted = onChange({ ...state, backingTracks: state.backingTracks.map((item) => item.id === track.id ? nextTrack : item) }, "Relinked local backing-track audio");
      if (accepted === false) { await deleteRecording(`backing-track:${track.id}`).catch(() => undefined); return; }
      setStorageReport((report) => report ? { ...report, missingIds: report.missingIds.filter((id) => id !== track.id) } : report);
      setTrackMessage(`${track.name} was relinked on this device. The audio remains local.`);
    } catch (error) { setTrackMessage(error instanceof Error ? error.message : "The selected audio could not be relinked."); }
  };

  const tapToAlign = (track: SongBackingTrack) => {
    const audio = audioElements.current[track.id];
    if (!audio || audio.paused) { setCalibrationMessage("Load and play the audio, then tap at least three consecutive beats."); return; }
    const taps = [...(calibrationTaps[track.id] ?? []), audio.currentTime].slice(-8);
    setCalibrationTaps((current) => ({ ...current, [track.id]: taps }));
    const bpm = estimateTempoFromTaps(taps);
    if (!bpm) { setCalibrationMessage(`${taps.length}/3 taps captured. Keep tapping on the beat.`); return; }
    const bookmark = bookmarks.find((item) => item.id === calibrationBookmarkId);
    const songTime = bookmark ? songSecondsAtBookmark(song, bookmark, bpm) : 0;
    if (bookmark && songTime === undefined) { setCalibrationMessage("That bookmark is not attached to a composition measure. Choose a measure bookmark or align to song start."); return; }
    const offsetMs = Math.max(-3_600_000, Math.min(3_600_000, Math.round((taps[0] - (songTime ?? 0)) * 1000)));
    const updated = { ...track, offsetMs, alignmentBpm: bpm, alignmentBookmarkId: bookmark?.id };
    const accepted = onChange({ ...state, backingTracks: state.backingTracks.map((item) => item.id === track.id ? updated : item) }, "Calibrated backing-track tempo and offset");
    if (accepted !== false) setCalibrationMessage(`Estimated ${bpm} BPM; audio offset ${offsetMs} ms from ${bookmark ? `${bookmark.label} · bar ${bookmark.marker?.measure}, beat ${bookmark.marker?.beat ?? 1}` : "song start"}.`);
  };

  const previewBookmarkAlignment = async (track: SongBackingTrack) => {
    const audio = audioElements.current[track.id];
    if (!audio) { await loadTrackPreview(track); setCalibrationMessage("Preview loaded. Press play, then use this control to jump to the calibrated section bookmark."); return; }
    const bookmark = bookmarks.find((item) => item.id === track.alignmentBookmarkId) ?? bookmarks.find((item) => item.id === calibrationBookmarkId);
    const bpm = track.alignmentBpm ?? tempoBpm;
    const songTime = bookmark ? songSecondsAtBookmark(song, bookmark, bpm) : 0;
    if (bookmark && songTime === undefined) { setCalibrationMessage("The aligned bookmark is no longer available in this composition."); return; }
    audio.currentTime = Math.max(0, (songTime ?? 0) + track.offsetMs / 1000);
    try { await audio.play(); setCalibrationMessage(`Previewing at ${bookmark?.label ?? "song start"} · ${bpm} BPM.`); }
    catch { setCalibrationMessage("Press play in the audio controls to preview this alignment."); }
  };

  const enableVoiceCommands = (enabled: boolean) => {
    onChange({ ...state, preferences: { ...state.preferences, voiceCommandsEnabled: enabled } }, enabled ? "Enabled explicit browser speech-recognition consent" : "Disabled browser speech-recognition consent");
    if (!enabled) stopVoice();
  };

  const setPreviewMuted = (muted: boolean) => onChange({ ...state, preferences: { ...state.preferences, previewMuted: muted } }, muted ? "Muted local audio previews" : "Unmuted local audio previews");

  const removeTrack = async (track: SongBackingTrack) => {
    if (!canManageTracks) { setTrackMessage("Your current library role cannot remove backing tracks."); return; }
    if (!window.confirm(`Remove the local audio file “${track.name}” from this song?`)) return;
    const accepted = onChange({ ...state, backingTracks: state.backingTracks.filter((item) => item.id !== track.id) }, "Removed a backing track");
    if (accepted === false) return;
    await deleteRecording(`backing-track:${track.id}`).catch(() => undefined);
    if (urls.current[track.id]) URL.revokeObjectURL(urls.current[track.id]);
    delete urls.current[track.id]; setAudioUrls((current) => { const next = { ...current }; delete next[track.id]; return next; });
  };

  const scrollToSection = (sectionId: string) => {
    activeSectionRef.current = sectionId; setActiveSectionId(sectionId);
    document.getElementById(`library-section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const voiceCommand = (text: string) => {
    const command = text.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    const index = song.sections.findIndex((section) => section.id === activeSectionRef.current);
    if (/next section|next part/.test(command)) { const next = song.sections[Math.min(song.sections.length - 1, Math.max(0, index + 1))]; if (next) scrollToSection(next.id); setVoiceMessage(next ? `Moved to ${next.title}.` : "There is no next section."); return; }
    if (/repeat section|again|repeat that/.test(command)) { scrollToSection(activeSectionRef.current); setVoiceMessage("Returned to the current section."); return; }
    if (/start recording|stop recording/.test(command)) { if (/start recording/.test(command)) { if (recordingRef.current) { setVoiceMessage("A recording is already in progress."); return; } recordingActions.current.onStartRecording(); setVoiceMessage("Recording started."); } else { if (!recordingRef.current) { setVoiceMessage("No recording is in progress."); return; } recordingActions.current.onStopRecording(); setVoiceMessage("Recording stopped."); } return; }
    if (/show answer|reveal answer/.test(command)) { setRevealed(true); setVoiceMessage("Recall answer revealed."); return; }
    setVoiceMessage(`Didn't recognize “${text.slice(0, 80)}”. Try “next section,” “repeat section,” “start recording,” or “show answer.”`);
  };
  const startVoice = () => {
    if (!state.preferences.voiceCommandsEnabled) { setVoiceMessage("Turn on browser voice-control consent below before enabling speech recognition."); return; }
    const SpeechRecognition = typeof window === "undefined" ? undefined : (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceMessage("Voice commands are not supported by this browser. Use the visible buttons or a keyboard/foot pedal."); return; }
    try {
      const engine = new SpeechRecognition(); engine.lang = "en-US"; engine.continuous = true; engine.interimResults = false;
      engine.onresult = (event) => { const result = event.results[event.results.length - 1]; if (result?.isFinal) voiceCommand(result[0]?.transcript ?? ""); };
      engine.onerror = () => { setVoiceMessage("Voice recognition stopped or was denied by the browser."); setVoiceActive(false); };
      engine.onend = () => { recognition.current = null; setVoiceActive(false); };
      recognition.current = engine; engine.start(); setVoiceActive(true); setVoiceMessage("Listening only after your request. Recognized speech is not saved by this app.");
    } catch { setVoiceMessage("Could not start voice recognition. Check browser microphone permission."); setVoiceActive(false); }
  };
  const stopVoice = () => { recognition.current?.stop(); recognition.current = null; setVoiceActive(false); setVoiceMessage("Voice commands stopped."); };
  const tourSteps = ["study-harmony-details", "study-measure-details", "study-recall-details", "study-playability-details", "study-tracks-details", "study-privacy-details"];
  const focusTourStep = (index: number) => {
    const target = document.getElementById(tourSteps[index]) as HTMLDetailsElement | null;
    if (target) { target.open = true; target.scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
  const startTour = () => { setTourStep(0); window.setTimeout(() => focusTourStep(0), 0); };
  const nextTourStep = () => {
    const next = tourStep + 1;
    if (next >= tourSteps.length) {
      setTourStep(-1);
      onChange({ ...state, preferences: { ...state.preferences, learningToolsTourCompleted: true } }, "Completed the Song Library learning-tools tour");
      setVoiceMessage("Quick tour complete. You can replay it any time.");
      return;
    }
    setTourStep(next); focusTourStep(next);
  };
  const dismissTour = () => { setTourStep(-1); onChange({ ...state, preferences: { ...state.preferences, learningToolsTourCompleted: true } }, "Dismissed the Song Library learning-tools tour"); };
  const storagePercent = storageReport?.usageBytes && storageReport.quotaBytes ? Math.min(100, Math.round(storageReport.usageBytes / storageReport.quotaBytes * 100)) : undefined;

  return <section className={`library-management-card feature-card ${styles.root}`} aria-labelledby="song-learning-tools-title">
    <span className="label">Song study tools</span><h2 id="song-learning-tools-title">Learn the form, not just the page</h2>

    <div className="study-tour" aria-live="polite"><p>{state.preferences.learningToolsTourCompleted ? "Want a quick refresher on these tools?" : "New to these study tools? Take a short, skippable guided tour."}</p>{tourStep < 0 ? <button type="button" className="text-button" onClick={startTour}>{state.preferences.learningToolsTourCompleted ? "Replay quick tour" : "Start quick tour"}</button> : <div className="button-row"><strong>Tour {tourStep + 1} of {tourSteps.length}</strong><button type="button" className="text-button" onClick={nextTourStep}>{tourStep + 1 === tourSteps.length ? "Finish" : "Next"}</button><button type="button" className="text-button" onClick={dismissTour}>Skip tour</button></div>}</div>

    <details open id="study-harmony-details"><summary>Movable harmony · {keyName}</summary>
      <label>Notation view<select value={harmonyMode} onChange={(event) => setHarmonyMode(event.target.value as typeof harmonyMode)}><option value="chords">Chord names</option><option value="nashville">Nashville numbers</option><option value="roman">Roman numerals</option></select></label>
      <label>Chord spelling<select value={state.preferences.chordSpelling} onChange={(event) => onChange({ ...state, preferences: { ...state.preferences, chordSpelling: event.target.value as SongLibraryState["preferences"]["chordSpelling"] } }, "Changed chord spelling preference")}><option value="key">Follow key</option><option value="sharps">Prefer sharps</option><option value="flats">Prefer flats</option></select></label>
      <div className="study-harmony" aria-live="polite">{displayChords ? harmonyRows.map((row, index) => <span className={`study-harmony-row ${row.inKey ? "" : "out-of-key"}`} key={`${row.chord}-${index}`} title={row.explanation}><b>{row.chord}</b><span>{harmonyMode === "nashville" ? row.nashville : harmonyMode === "roman" ? row.roman : row.chord}</span>{!row.inKey && <small>Chromatic · review</small>}</span>) : <p className="muted">Chord names are hidden by this song&apos;s sheet preferences.</p>}{!harmonyRows.length && <p className="muted">Add chord metadata to this song to see movable labels.</p>}</div>
      <p className="muted">Labels use the selected key ({keyName}); chromatic roots are flagged as review hints, not errors. Slash chords retain bass-degree relationships.</p>
    </details>

    <details open id="study-measure-details"><summary>Measure map and beat-level bookmarks</summary>
      {composition ? <><div className="two-inputs"><label>Section<select value={measureSection?.id ?? ""} onChange={(event) => setMeasureSectionId(event.target.value)}>{composition.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label><label>Track<select value={measureTrack?.id ?? ""} onChange={(event) => setMeasureTrackId(event.target.value)}>{composition.tracks.filter((track) => !track.muted).map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label></div>{measureSection && measureTrack ? <article className="study-measure-section"><h3>{measureSection.title} · {measureSection.timeSignature ?? composition.timeSignature}{measureSection.repeats > 1 ? ` · repeat ×${measureSection.repeats}` : ""} · {measureTrack.name}</h3><label>Bookmark beat within each bar<input aria-label="Bookmark beat within each bar" type="number" min="1" max="64" step="0.125" value={measureBookmarkBeat} onChange={(event) => setMeasureBookmarkBeat(event.target.value)}/></label><div className="study-measure-grid">{sectionMeasures.slice(0, 64).map((measure, index) => { const markers = state.sectionBookmarks.filter((bookmark) => bookmark.songId === song.id && bookmark.sectionId === measureSection.id && bookmark.marker?.measure === index + 1); return <article className="study-measure" key={measure.id}><b>Bar {index + 1}</b><div>{measure.events.slice().sort((left, right) => left.startBeat - right.startBeat).slice(0, 32).map((event) => <span key={event.id}>Beat {Number((event.startBeat + 1).toFixed(3))}: {event.kind === "rest" ? "rest" : event.chord ? displayChords ? spellChordName(event.chord, state.preferences.chordSpelling, keyName) : "chord" : event.kind === "note" ? `fret ${event.fret ?? "?"}` : "chord"}</span>)}</div><button type="button" className="text-button" onClick={() => { const beat = Math.max(1, Math.min(64, Number(measureBookmarkBeat) || 1)); const now = new Date().toISOString(); const bookmark = { id: crypto.randomUUID(), songId: song.id, sectionId: measureSection.id, label: `${measureSection.title} · bar ${index + 1}`, note: "Quick bookmark from the measure map.", marker: { measure: index + 1, beat }, createdAt: now, updatedAt: now }; onChange({ ...state, sectionBookmarks: [bookmark, ...state.sectionBookmarks].slice(0, 500) }, "Added a beat-level bookmark"); }}>Bookmark beat {measureBookmarkBeat}</button>{markers.map((marker) => <small key={marker.id}>Saved: beat {marker.marker?.beat ?? 1} · {marker.label}</small>)}</article>; })}</div>{sectionMeasures.length > 64 && <p className="muted">Showing the first 64 of {sectionMeasures.length} measures; open the editor to access the full arrangement.</p>}</article> : <p className="muted">No unmuted composition track is available.</p>}</> : <p className="muted">This song has no measure composition yet. Open the Song Builder to author bars, rests, repeats, and track events.</p>}
      {composition && <Link href={`/song-builder?songId=${encodeURIComponent(song.id)}`} className="text-button">Edit measures in Song Builder</Link>}
    </details>

    <details open id="study-recall-details"><summary>Lyrics and chord recall</summary>
      <div className="two-inputs"><label>Recall type<select value={recallKind} onChange={(event) => { setRecallKind(event.target.value as typeof recallKind); setPromptIndex(0); setRevealed(false); }}><option value="lyrics">Lyrics</option><option value="chords">Chords</option></select></label><label>Section<select value={recallSectionId} onChange={(event) => { setRecallSectionId(event.target.value); setPromptIndex(0); setRevealed(false); }}>{song.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></div>
      {prompt ? <div className="recall-card"><strong>{prompt.question}</strong>{revealed ? <p className="recall-answer">{prompt.answer}</p> : <p className="muted">Answer from memory before revealing.</p>}<div className="button-row"><button className="btn" type="button" onClick={() => setRevealed(true)} disabled={revealed}>Reveal answer</button><button className="btn primary" type="button" disabled={!revealed} onClick={() => saveRecall(true)}>Remembered</button><button className="btn" type="button" disabled={!revealed} onClick={() => saveRecall(false)}>Needs review</button></div><p className="muted">Recent recall checks: {attemptsRemembered}/{attempts.length} remembered.</p></div> : <p className="muted">This section has no {recallKind} lines available for recall practice.</p>}
    </details>

    <details id="study-playability-details"><summary>Personal chord playability profile</summary>
      <p className="muted">Recommendations use known guitar chord shapes only. They do not alter the song arrangement or claim that an unverified fingering is playable.</p>
      <form className="study-profile-form" onSubmit={saveProfile}><label>Maximum fret span <input type="number" min="1" max="6" value={profile.maxFretSpan} onChange={(event) => setProfile({ ...profile, maxFretSpan: Math.max(1, Math.min(6, Number(event.target.value) || 1)) })}/></label><label>Highest fret <input type="number" min="1" max="24" value={profile.maxFret} onChange={(event) => setProfile({ ...profile, maxFret: Math.max(1, Math.min(24, Number(event.target.value) || 1)) })}/></label><label>Preferred voicing<select value={profile.preferredMode} onChange={(event) => setProfile({ ...profile, preferredMode: event.target.value as SongPlayabilityProfile["preferredMode"] })}><option value="open">Open</option><option value="partial-barre">Partial barre</option><option value="barre">Barre</option><option value="simplified">Simplified</option></select></label><label><input type="checkbox" checked={profile.avoidBarre} onChange={(event) => setProfile({ ...profile, avoidBarre: event.target.checked })}/>Avoid barre shapes</label><button type="submit" className="btn">Save my profile</button></form>
      <p><strong>{fittedCount}/{shapes.length}</strong> listed chords have a catalog fingering within this profile.</p><ul className="study-playability-list">{shapes.map((shape) => <li key={shape.name}><b>{shape.name}</b>{shape.best ? ` · ${shape.best.position} (${shape.best.chord.frets.filter((fret) => fret > 0).length ? Math.max(...shape.best.chord.frets.filter((fret) => fret > 0)) : 0} highest fret)` : shape.found ? " · no catalog shape fits these limits" : " · no stored fingering to evaluate"}</li>)}</ul>
    </details>

    <details id="study-tracks-details"><summary>User-provided backing tracks and stems ({tracks.length})</summary>
      <p className="muted">Audio file bytes stay in this browser and are not included in backups or sync. Track labels, alignment, and permission confirmation are library metadata. Upload only audio you have permission to use. Up to 16 tracks per song, 50 MB each.</p>
      <p><strong>Backing track files:</strong> {Math.round(tracks.reduce((sum, track) => sum + track.sizeBytes, 0) / 1024)} KB across {tracks.length} stems.</p>
      <div className="button-row"><label><input type="checkbox" checked={state.preferences.previewMuted} onChange={(event) => setPreviewMuted(event.target.checked)}/> Keep previews muted until I unmute them</label><button type="button" className="text-button" onClick={() => void checkStorageHealth()} disabled={storageBusy}>{storageBusy ? "Checking storage…" : "Check offline audio health"}</button></div>
      {storageReport && <div className="storage-health" role="status"><strong>{storageReport.missingIds.length ? `${storageReport.missingIds.length} missing audio file(s)` : "Registered audio files are available"}</strong>{storagePercent !== undefined && <span>Browser storage: {storagePercent}% used · {Math.round((storageReport.usageBytes ?? 0) / 1_048_576)} / {Math.round((storageReport.quotaBytes ?? 0) / 1_048_576)} MB</span>}{storagePercent !== undefined && storagePercent >= 80 && <span className="danger-text">Storage is nearly full; export your library metadata and keep a separate copy of local audio.</span>}{storageReport.orphanIds.length > 0 && <span>{storageReport.orphanIds.length} unlinked audio file key(s) found. No files were deleted.</span>}</div>}
      <form className="study-track-form" onSubmit={(event) => void uploadTrack(event)}><label>Audio file<input name="audio" type="file" accept="audio/*" required disabled={!canManageTracks}/></label><label>Stem label<input value={trackName} onChange={(event) => setTrackName(event.target.value)} maxLength={120} placeholder="e.g. harmony vocal" disabled={!canManageTracks}/></label><label>Instrument<select value={trackInstrument} onChange={(event) => setTrackInstrument(event.target.value as SongBackingTrackInstrument)} disabled={!canManageTracks}>{instruments.map((instrument) => <option key={instrument} value={instrument}>{instrument}</option>)}</select></label><label>Section<select value={trackSection} onChange={(event) => setTrackSection(event.target.value)} disabled={!canManageTracks}><option value="">Whole song</option>{song.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label><label>Start measure<input type="number" min="1" max="9999" value={trackMeasure} onChange={(event) => setTrackMeasure(event.target.value)} placeholder="Optional" disabled={!canManageTracks}/></label><label>Beat<input type="number" min="1" max="64" step="0.125" value={trackBeat} onChange={(event) => setTrackBeat(event.target.value)} disabled={!canManageTracks}/></label><label>Audio offset · ms<input type="number" min="-3600000" max="3600000" step="100" value={trackOffset} onChange={(event) => setTrackOffset(event.target.value)} disabled={!canManageTracks}/></label><label><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} disabled={!canManageTracks}/>I have permission to use this audio</label><button className="btn primary" type="submit" disabled={!canManageTracks || tracks.length >= 16}>Save local track</button></form>
      <p role="status">{trackMessage}</p>
      {bookmarks.length > 0 && <label>Align to bookmark<select value={calibrationBookmarkId} onChange={(event) => { setCalibrationBookmarkId(event.target.value); setCalibrationTaps({}); }}><option value="">Song start</option>{bookmarks.map((bookmark) => <option key={bookmark.id} value={bookmark.id}>{bookmark.label} · bar {bookmark.marker?.measure}, beat {bookmark.marker?.beat ?? 1}</option>)}</select></label>}
      <p className="muted">Tap along while a preview is playing. After three or more taps, the median spacing estimates tempo and stores the audio offset against the selected measure bookmark.</p><p role="status">{calibrationMessage}</p>
      <div className="study-backing-tracks">{tracks.map((track) => <article key={track.id}><div><strong>{track.name}</strong><small>{track.instrument} · {track.sectionId ? song.sections.find((section) => section.id === track.sectionId)?.title ?? "Section" : "Whole song"}{track.measure ? ` · bar ${track.measure}` : ""} · beat {track.beat ?? 1} · offset {track.offsetMs} ms{track.alignmentBpm ? ` · calibrated ${track.alignmentBpm} BPM` : " · not calibrated"} · {Math.round(track.sizeBytes / 1024)} KB</small>{storageReport?.missingIds.includes(track.id) && <label className="reattach-audio">Audio is missing. Reattach file<input type="file" accept="audio/*" disabled={!canManageTracks} onChange={(event) => { void reattachTrack(track, event.target.files?.[0]); event.target.value = ""; }}/></label>}</div>{audioUrls[track.id] ? <audio ref={(element) => { audioElements.current[track.id] = element; }} controls preload="none" muted={state.preferences.previewMuted} src={audioUrls[track.id]} onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; if (Number.isFinite(duration)) event.currentTarget.currentTime = Math.max(0, Math.min(Math.max(0, duration - 0.05), track.offsetMs / 1000)); }}/>: <button type="button" className="text-button" disabled={audioBusy === track.id} onClick={() => void loadTrackPreview(track)}>{audioBusy === track.id ? "Loading…" : "Load preview"}</button>}<div className="button-row"><button type="button" className="text-button" onClick={() => tapToAlign(track)}>{calibrationTaps[track.id]?.length ? `Tap beat · ${calibrationTaps[track.id].length}` : "Tap to align"}</button><button type="button" className="text-button" onClick={() => void previewBookmarkAlignment(track)}>Preview bookmark alignment</button><button type="button" className="text-button danger-text" disabled={!canManageTracks} onClick={() => void removeTrack(track)}>Remove</button></div></article>)}{!tracks.length && <p className="muted">No backing tracks attached.</p>}</div>
    </details>

    <details id="study-privacy-details"><summary>Privacy, audio, and hands-free controls</summary>
      <p className="muted">Songs, preferences, and audio files are stored on this device. Audio files are excluded from library backups and sync. Voice recognition is off by default; if enabled, the browser may process speech according to its own service and privacy settings. This app does not save recognized audio or transcripts.</p>
      <label><input type="checkbox" checked={state.preferences.voiceCommandsEnabled} onChange={(event) => enableVoiceCommands(event.target.checked)}/> Allow browser speech recognition for hands-free commands</label>
      <label><input type="checkbox" checked={state.preferences.previewMuted} onChange={(event) => setPreviewMuted(event.target.checked)}/> Keep previews muted until I unmute them</label>
      <label>Current section<select value={activeSectionId} onChange={(event) => scrollToSection(event.target.value)}>{song.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label><div className="button-row"><button type="button" className="btn" onClick={() => scrollToSection(song.sections[Math.max(0, song.sections.findIndex((section) => section.id === activeSectionId) - 1)]?.id ?? activeSectionId)}>Previous section</button><button type="button" className="btn" onClick={() => scrollToSection(song.sections[Math.min(song.sections.length - 1, song.sections.findIndex((section) => section.id === activeSectionId) + 1)]?.id ?? activeSectionId)}>Next section</button><button type="button" className="btn" onClick={recording ? onStopRecording : onStartRecording}>{recording ? "Stop recording" : "Start recording"}</button><button type="button" className="btn primary" aria-pressed={voiceActive} disabled={!state.preferences.voiceCommandsEnabled && !voiceActive} onClick={voiceActive ? stopVoice : startVoice}>{voiceActive ? "Stop voice control" : "Enable voice control"}</button></div><p role="status">{voiceMessage}</p>
    </details>

    <details><summary>Arrangement quality check</summary><p className="muted">This local review detects structural inconsistencies; it does not rewrite your song or judge its musical quality.</p>{arrangementIssues.length ? <ul className="study-quality-list">{arrangementIssues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul> : <p className="study-quality-ok">No obvious structure or chord-format issues found.</p>}</details>
  </section>;
}

