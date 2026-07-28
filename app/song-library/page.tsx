"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import sharedSongContent from "../../shared/content/v1/songs.json";
import {
  emptySongLibraryState,
  matchesSongFilters,
  normalizeImportedSong,
  createManualSong,
  recordSongPractice,
  setSectionMastery,
  setLibraryPreference,
  hasDuplicateSource,
  hasDuplicateSong,
  checkSourceHealth,
  setWeeklyGoal,
  saveQueueResumePoint,
  finishQueue,
  recordPracticeSession,
  weeklyPracticeStats,
  playVariationPreview,
  toggleFavorite,
  readSongLibraryState,
  songChords,
  type LibrarySong,
  type SongLibraryState,
  writeSongLibraryState,
} from "../../lib/songLibrary";
import { deleteRecording, loadRecording, saveRecording } from "../../lib/songRecording";
import { analyzeRecording, trimRecording as trimAudioRecording } from "../../lib/songRecordingAnalysis";
import { recommendQueue, setLibraryPermission, setResourcePermission } from "../../lib/songSync";
import { retrySourceHealth } from "../../lib/songSourceDiagnostics";
import { decryptLibraryBackup, encryptLibraryBackup } from "../../lib/songCloudBackup";
import { ultimateGuitarSource } from "../../lib/songSource";

const BUNDLED_SONGS = sharedSongContent.songs as unknown as LibrarySong[];
const techniqueLabels: Record<string, string> = { All: "All techniques", strumming: "Strumming", fingerpicking: "Fingerpicking", plectrum: "Plectrum" };

export default function SongLibraryPage() {
  const [state, setState] = useState<SongLibraryState>(() => readSongLibraryState());
  const latestState = useRef(state);
  latestState.current = state;
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [key, setKey] = useState("All");
  const [meter, setMeter] = useState("All");
  const [technique, setTechnique] = useState("All");
  const [libraryId, setLibraryId] = useState("All");
  const [sortBy, setSortBy] = useState("title");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [queueId, setQueueId] = useState("All");
  const [manualSections, setManualSections] = useState([{ title: "Verse", chords: "", lyrics: "", tab: "" }]);
  const [isOnline, setIsOnline] = useState(true);
  const [goalInput, setGoalInput] = useState("3");
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [waveformZoom, setWaveformZoom] = useState(1);
  const recordingAudio = useRef<HTMLAudioElement | null>(null);
  const [trimDraft, setTrimDraft] = useState<Record<string, { start: number; end: number }>>({});
  const [selectedId, setSelectedId] = useState(BUNDLED_SONGS[0]?.id ?? "");
  const [selectedVariationId, setSelectedVariationId] = useState(BUNDLED_SONGS[0]?.variations[0]?.id ?? "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceArtist, setSourceArtist] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [status, setStatus] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualKey, setManualKey] = useState("C");
  const [manualMeter, setManualMeter] = useState("4/4");
  const [manualBpm, setManualBpm] = useState("90");
  const [manualChords, setManualChords] = useState("");
  const [manualLyrics, setManualLyrics] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(window.navigator.onLine);
      const online = () => setIsOnline(true); const offline = () => setIsOnline(false);
      window.addEventListener("online", online); window.addEventListener("offline", offline);
      return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
    }
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const currentState = latestState.current;
    const links = currentState.songs.filter((song) => song.sourceUrl).map((song) => song.sourceUrl as string).filter((url, index, urls) => urls.indexOf(url) === index);
    if (!links.length) return;
    let cancelled = false;
    void Promise.all(links.map((url) => checkSourceHealth(url))).then((health) => { if (!cancelled) { const next = { ...latestState.current, sourceHealth: [...latestState.current.sourceHealth.filter((item) => !health.some((entry) => entry.url === item.url)), ...health] }; setState(next); writeSongLibraryState(next); } });
    return () => { cancelled = true; };
  }, [isOnline]);

  const allSongs = useMemo(() => [...BUNDLED_SONGS, ...state.songs], [state.songs]);
  const selectedSong = allSongs.find((song) => song.id === selectedId) ?? allSongs[0];
  const selectedQueue = state.practiceQueues.find((queue) => queue.id === queueId);
  const selectedVariation = selectedSong?.variations.find((variation) => variation.id === selectedVariationId) ?? selectedSong?.variations[0];
  const filteredSongs = useMemo(() => {
    const songs = allSongs.filter((song) => matchesSongFilters(song, { query, difficulty, key, meter, technique, libraryId }, state.collections)).filter((song) => !favoritesOnly || state.favorites.includes(song.id)).filter((song) => queueId === "All" || state.practiceQueues.find((queue) => queue.id === queueId)?.songIds.includes(song.id));
    return [...songs].sort((left, right) => sortBy === "difficulty" ? left.difficulty.localeCompare(right.difficulty) : sortBy === "bpm" ? left.bpm - right.bpm : sortBy === "recent" ? (state.recentSongIds.indexOf(left.id) + 100) - (state.recentSongIds.indexOf(right.id) + 100) : left.title.localeCompare(right.title));
  }, [allSongs, difficulty, favoritesOnly, key, libraryId, meter, query, queueId, sortBy, state.collections, state.favorites, state.practiceQueues, state.recentSongIds, technique]);
  const resumeSong = state.resumePoint ? allSongs.find((song) => song.id === state.resumePoint?.songId) : undefined;
  const selectedProgress = selectedSong ? state.practiceProgress.find((progress) => progress.songId === selectedSong.id) : undefined;
  const averageMastery = selectedProgress?.sectionMastery && Object.values(selectedProgress.sectionMastery).length ? Math.round(Object.values(selectedProgress.sectionMastery).reduce((sum, value) => sum + value, 0) / Object.values(selectedProgress.sectionMastery).length) : 0;
  const weeklyStats = useMemo(() => weeklyPracticeStats(state), [state]);
  const keys = useMemo(() => Array.from(new Set(allSongs.flatMap((song) => [song.key, ...song.variations.map((variation) => variation.key)]))).sort(), [allSongs]);
  const meters = useMemo(() => Array.from(new Set(allSongs.flatMap((song) => [song.timeSignature, ...song.variations.map((variation) => variation.timeSignature)]))).sort(), [allSongs]);
  const difficulties = useMemo(() => Array.from(new Set(allSongs.map((song) => song.difficulty))).sort(), [allSongs]);

  const updateState = (next: SongLibraryState) => {
    setState(next);
    writeSongLibraryState(next);
  };

  const selectSong = (song: LibrarySong) => {
    setSelectedId(song.id);
    setSelectedVariationId(song.variations[0]?.id ?? "");
    updateState(recordSongPractice(state, song.id, song.variations[0]?.id));
  };

  const toggleSongFavorite = () => selectedSong && updateState(toggleFavorite(state, selectedSong.id));

  const previewVariation = (variation: LibrarySong["variations"][number]) => {
    if (typeof window === "undefined") return;
    const audio = new AudioContext(); playVariationPreview(variation, audio); window.setTimeout(() => void audio.close(), Math.max(1200, variation.pattern.split(/\s+/).length * (60000 / variation.bpm) + 300));
  };

  const updatePreference = (preference: "largePrint" | "handsFree") => {
    const nextValue = !state.preferences[preference]; updateState(setLibraryPreference(state, { [preference]: nextValue }));
  };

  const updateManualSection = (index: number, field: "title" | "chords" | "lyrics" | "tab", value: string) => setManualSections((sections) => sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, [field]: value } : section));

  const startRecording = async () => {
    if (!selectedSong || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { setRecordingStatus("Audio recording is unavailable in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); const chunks: Blob[] = []; const startedAt = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); const id = `recording-${crypto.randomUUID()}`; const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" }); await saveRecording(id, blob); const analysis = await analyzeRecording(blob).catch(() => ({ peaks: [], durationMs: Date.now() - startedAt })); updateState({ ...state, recordings: [{ id, songId: selectedSong.id, durationMs: analysis.durationMs, mimeType: blob.type, waveform: analysis.peaks, createdAt: new Date().toISOString() }, ...state.recordings] }); setRecordingStatus("Recording saved locally."); };
      recorder.start(); setRecording(recorder); setRecordingStatus("Recording…");
    } catch { setRecordingStatus("Microphone permission was not granted."); }
  };

  const stopRecording = () => { recording?.stop(); setRecording(null); };
  const playRecording = async (id: string) => { const blob = await loadRecording(id); if (!blob) { setRecordingStatus("Recording is unavailable."); return; } recordingAudio.current?.pause(); const url = URL.createObjectURL(blob); const audio = new Audio(url); recordingAudio.current = audio; setPlayingRecording(id); audio.onended = () => { URL.revokeObjectURL(url); setPlayingRecording(null); }; await audio.play(); };
  const removeRecording = async (id: string) => { await deleteRecording(id); updateState({ ...state, recordings: state.recordings.filter((record) => record.id !== id) }); };
  const trimSavedRecording = async (recordID: string) => { const record = state.recordings.find((item) => item.id === recordID); const draft = trimDraft[recordID]; if (!record || !draft) return; const blob = await loadRecording(recordID); if (!blob) return; const trimmed = await trimAudioRecording(blob, draft.start, draft.end); await saveRecording(recordID, trimmed); const analysis = await analyzeRecording(trimmed); updateState({ ...state, recordings: state.recordings.map((item) => item.id === recordID ? { ...item, durationMs: analysis.durationMs, waveform: analysis.peaks, trimStartMs: draft.start, trimEndMs: draft.end, mimeType: trimmed.type } : item) }); setRecordingStatus("Recording trimmed."); };
  const makeRecommendedQueue = () => { const queue = recommendQueue(state); updateState({ ...state, practiceQueues: [...state.practiceQueues, queue] }); setQueueId(queue.id); setStatus("Created a queue from your least-mastered sections."); };
  const retrySource = (url: string) => { setStatus("Checking source…"); void retrySourceHealth(url).then(({ health, history }) => { updateState({ ...state, sourceHealth: [...state.sourceHealth.filter((item) => item.url !== url), health] }); setStatus(`${health.status === "online" ? "Source is available" : "Source unavailable"} · ${history.length} attempt(s).`); }); };
  const shareLibrary = () => { const library = state.collections.find((collection) => collection.id === libraryId); const accountID = window.prompt("Account email or ID to invite"); if (!library || !accountID) return; const role = window.prompt("Permission: viewer or editor", "viewer"); if (role !== "viewer" && role !== "editor") return; const scope = window.prompt("Share library, selected song, or selected queue", "library"); if (scope === "song") { updateState(setResourcePermission(state, "song", selectedSong.id, accountID, role)); setStatus(`Invited ${accountID} to ${selectedSong.title}.`); } else if (scope === "queue" && selectedQueue) { updateState(setResourcePermission(state, "queue", selectedQueue.id, accountID, role)); setStatus(`Invited ${accountID} to ${selectedQueue.name}.`); } else { updateState(setLibraryPermission(state, library.id, accountID, role)); setStatus(`Invited ${accountID} to ${library.name}.`); } };

  const addQueue = () => {
    if (queueId !== "All" && selectedSong) {
      const existingQueue = state.practiceQueues.find((queue) => queue.id === queueId);
      if (existingQueue && !existingQueue.songIds.includes(selectedSong.id)) {
        updateState({ ...state, practiceQueues: state.practiceQueues.map((queue) => queue.id === queueId ? { ...queue, songIds: [...queue.songIds, selectedSong.id], updatedAt: new Date().toISOString() } : queue) }); setStatus(`Added ${selectedSong.title} to ${existingQueue.name}.`); return;
      }
    }
    const name = window.prompt("Name this practice queue", "Today's practice")?.trim(); if (!name) return;
    const now = new Date().toISOString(); const queue = { id: `queue-${crypto.randomUUID()}`, name, songIds: selectedSong ? [selectedSong.id] : [], createdAt: now, updatedAt: now };
    updateState({ ...state, practiceQueues: [...state.practiceQueues, queue] }); setQueueId(queue.id); setStatus(`Created ${name}.`);
  };

  const moveQueueSong = (queueID: string, songID: string, direction: -1 | 1) => {
    const queue = state.practiceQueues.find((item) => item.id === queueID); if (!queue) return; const index = queue.songIds.indexOf(songID); const target = index + direction; if (index < 0 || target < 0 || target >= queue.songIds.length) return;
    const songIds = [...queue.songIds]; [songIds[index], songIds[target]] = [songIds[target], songIds[index]];
    updateState({ ...state, practiceQueues: state.practiceQueues.map((item) => item.id === queueID ? { ...item, songIds, updatedAt: new Date().toISOString() } : item) });
  };

  const saveResume = (queue: typeof state.practiceQueues[number], songID: string) => updateState(saveQueueResumePoint(state, { queueId: queue.id, songId: songID, variationId: selectedVariation?.id }));
  const completeSelectedQueue = () => { const queue = state.practiceQueues.find((item) => item.id === queueId); if (queue) { updateState(finishQueue(state, queue, selectedSong?.id)); setStatus("Queue completed. Your weekly goal was updated."); } };

  const saveManualSong = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const song = createManualSong({ title: manualTitle, artist: manualArtist, key: manualKey, timeSignature: manualMeter, bpm: Math.max(40, Math.min(240, Number(manualBpm) || 90)), chords: manualChords.split(/[,\s]+/).map((chord) => chord.trim()).filter(Boolean), lyrics: manualLyrics });
    const sections = manualSections.map((section, index) => ({
      id: `${song.id}-section-${index + 1}`,
      title: section.title.trim() || `Section ${index + 1}`,
      blocks: [
        { type: "chords" as const, chords: section.chords.split(/[,\s]+/).map((chord) => chord.trim()).filter(Boolean) },
        ...(section.lyrics.trim() ? [{ type: "lyrics" as const, text: section.lyrics.trim() }] : []),
        ...(section.tab.trim() ? [{ type: "tab" as const, lines: section.tab.split("\n") }] : []),
      ],
    }));
    const next = { ...state, songs: [...state.songs, { ...song, sections }] };
    const practiced = recordSongPractice(next, song.id, song.variations[0]?.id);
    updateState(practiced); setSelectedId(song.id); setSelectedVariationId(song.variations[0]?.id ?? ""); setManualTitle(""); setManualArtist(""); setManualChords(""); setManualLyrics(""); setManualSections([{ title: "Verse", chords: "", lyrics: "", tab: "" }]); setStatus("Created a custom song on this device.");
  };

  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "chord-hero-song-library.json"; anchor.click(); URL.revokeObjectURL(url);
  };

  const exportEncryptedLibrary = async () => { const password = window.prompt("Create a password for this encrypted backup"); if (!password) return; const payload = await encryptLibraryBackup(state, password); const url = URL.createObjectURL(new Blob([payload], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "chord-hero-encrypted-library.json"; anchor.click(); URL.revokeObjectURL(url); setStatus("Encrypted backup exported. Keep the password safe."); };

  const importLibrary = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if (parsed?.version === 1 && Array.isArray(parsed.collections) && Array.isArray(parsed.songs)) { updateState({ ...emptySongLibraryState(), ...parsed, songs: [...state.songs, ...parsed.songs.filter((song: LibrarySong) => !state.songs.some((existing) => existing.id === song.id))] }); setStatus("Library backup restored."); } else throw new Error("Invalid library"); } catch { setStatus("That backup could not be imported."); } }; reader.readAsText(file); event.target.value = "";
  };

  const importEncryptedLibrary = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const password = window.prompt("Password for encrypted backup"); if (!password) return; void file.text().then((payload) => decryptLibraryBackup(payload, password)).then((imported) => { updateState(imported); setStatus("Encrypted backup restored."); }).catch(() => setStatus("Could not decrypt that backup.")); event.target.value = ""; };

  const createLibrary = () => {
    const name = window.prompt("Name your song library", "My practice songs")?.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const collection = { id: `library-${crypto.randomUUID()}`, name, description: "A personal song collection", songIds: [], createdAt: now, updatedAt: now };
    updateState({ ...state, collections: [...state.collections, collection] });
    setLibraryId(collection.id);
    setStatus(`Created ${name}.`);
  };

  const addToLibrary = (collectionId: string) => {
    if (!selectedSong) return;
    const now = new Date().toISOString();
    const collections = state.collections.map((collection) => collection.id === collectionId && !collection.songIds.includes(selectedSong.id)
      ? { ...collection, songIds: [...collection.songIds, selectedSong.id], updatedAt: now }
      : collection);
    updateState({ ...state, collections });
    setStatus(`Saved ${selectedSong.title} to your library.`);
  };

  const removeFromLibrary = (collectionId: string) => {
    if (!selectedSong) return;
    const collections = state.collections.map((collection) => collection.id === collectionId
      ? { ...collection, songIds: collection.songIds.filter((id) => id !== selectedSong.id), updatedAt: new Date().toISOString() }
      : collection);
    updateState({ ...state, collections });
    setStatus(`Removed ${selectedSong.title}.`);
  };

  const setDefaultVariation = (collectionId: string, variationId: string) => {
    updateState({ ...state, collections: state.collections.map((collection) => collection.id === collectionId ? { ...collection, defaultVariationId: variationId, updatedAt: new Date().toISOString() } : collection) });
    setStatus("Default practice variation updated.");
  };

  const deleteLibrary = (collectionId: string) => {
    const collection = state.collections.find((item) => item.id === collectionId);
    if (!collection || !window.confirm(`Delete ${collection.name}? Songs will remain in the catalogue.`)) return;
    updateState({ ...state, collections: state.collections.filter((item) => item.id !== collectionId) });
    if (libraryId === collectionId) setLibraryId("All");
  };

  const renameLibrary = (collectionId: string) => {
    const collection = state.collections.find((item) => item.id === collectionId);
    const name = collection && window.prompt("Rename song library", collection.name)?.trim();
    if (!collection || !name) return;
    updateState({ ...state, collections: state.collections.map((item) => item.id === collectionId ? { ...item, name, updatedAt: new Date().toISOString() } : item) });
  };

  const saveSourceLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sourceUrl.trim()) return;
    if (hasDuplicateSource(state, sourceUrl) || hasDuplicateSong(state, sourceTitle, sourceArtist)) { setStatus("That song or source link is already saved."); return; }
    const song = normalizeImportedSong({ title: sourceTitle, artist: sourceArtist, sourceUrl, notes: sourceNotes });
    const next = { ...state, songs: [...state.songs, song] };
    updateState(next);
    void checkSourceHealth(song.sourceUrl ?? "").then((health) => updateState({ ...next, sourceHealth: [...next.sourceHealth.filter((item) => item.url !== health.url), health] }));
    setSelectedId(song.id);
    setSelectedVariationId(song.variations[0].id);
    setSourceUrl(""); setSourceTitle(""); setSourceArtist(""); setSourceNotes("");
    setStatus("Saved the source link locally. The original page remains the source for protected tab and lyric content.");
  };

  return (
    <main className="page focused-page song-library-page">
      <section className="studio-heading">
        <div>
          <span className="tag">Song Library</span>
          <h1>Build a practice catalogue that feels like yours.</h1>
          <p>Search fifty traditional and public-domain songs, save collections, and choose the right-hand arrangement for today&apos;s practice.</p>
        </div>
        <div className="studio-session-note"><span className="label">Catalogue</span><strong>{allSongs.length} songs · {allSongs.reduce((total, song) => total + song.variations.length, 0)} variations</strong><span>{isOnline ? "Online · source links available" : "Offline · bundled songs remain available"}</span></div>
      </section>

      <section className="song-library-layout">
        <div className="song-library-browser">
          <div className="song-library-toolbar">
            <label className="search-field"><span className="sr-only">Search songs</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, artist, lyrics, chords…" /></label>
            <button className="btn" type="button" onClick={createLibrary}>New library</button>
          </div>
          <div className="song-filter-grid">
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Difficulty"><option value="All">All difficulties</option>{difficulties.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={key} onChange={(event) => setKey(event.target.value)} aria-label="Key"><option value="All">All keys</option>{keys.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={meter} onChange={(event) => setMeter(event.target.value)} aria-label="Time signature"><option value="All">All meters</option>{meters.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={technique} onChange={(event) => setTechnique(event.target.value)} aria-label="Technique">{Object.entries(techniqueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={libraryId} onChange={(event) => setLibraryId(event.target.value)} aria-label="Song library"><option value="All">All collections</option>{state.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort songs"><option value="title">Sort: title</option><option value="difficulty">Sort: difficulty</option><option value="bpm">Sort: tempo</option><option value="recent">Sort: recently practiced</option></select>
            <select value={queueId} onChange={(event) => setQueueId(event.target.value)} aria-label="Practice queue"><option value="All">All queues</option>{state.practiceQueues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}</select>
            <button className={`filter-toggle ${favoritesOnly ? "active" : ""}`} type="button" onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}>★ Favorites</button>
          </div>
          <div className="song-library-count">{filteredSongs.length} result{filteredSongs.length === 1 ? "" : "s"}</div>
          <div className="song-library-list">
            {filteredSongs.map((song) => <button className={`song-library-row ${song.id === selectedSong?.id ? "active" : ""}`} key={song.id} type="button" onClick={() => selectSong(song)}><span><strong>{song.title}</strong><small>{song.artist} · {song.difficulty} · {song.timeSignature}</small></span><span className="song-row-tag">{song.origin === "imported" ? "Saved link" : song.tags[0] ?? "Traditional"}</span></button>)}
            {!filteredSongs.length && <div className="empty-state"><strong>No songs match those filters.</strong><span>Try a broader search or clear a filter.</span></div>}
          </div>
        </div>

        {selectedSong && <aside className="song-library-detail">
          <div className="detail-kicker">{selectedSong.origin === "imported" ? "Saved source link" : selectedSong.license}</div>
          <h2>{selectedSong.title}</h2>
          <p className="muted">{selectedSong.artist} · {selectedSong.source}</p>
          <div className="song-detail-meta"><span>{selectedSong.key}</span><span>{selectedSong.timeSignature}</span><span>{selectedSong.difficulty}</span><span>{selectedSong.bpm} BPM</span></div>
          {selectedSong.sourceUrl && <p><a href={isOnline ? selectedSong.sourceUrl : undefined} target="_blank" rel="noreferrer" className={`source-link ${!isOnline ? "source-link-disabled" : ""}`} aria-disabled={!isOnline}>{isOnline ? "Open original source ↗" : "Source unavailable offline"}</a></p>}
          <div className="variation-picker"><span className="label">Practice variation</span>{selectedSong.variations.map((variation) => <div className={`variation-card ${variation.id === selectedVariation?.id ? "active" : ""}`} key={variation.id}><button type="button" onClick={() => setSelectedVariationId(variation.id)}><strong>{variation.name}</strong><span>{techniqueLabels[variation.technique]} · {variation.key} · {variation.timeSignature} · {variation.bpm} BPM</span><small>{variation.pattern}</small></button><button className="variation-preview" type="button" onClick={() => previewVariation(variation)}>▶ Preview pattern</button>{state.collections.filter((collection) => collection.songIds.includes(selectedSong.id)).map((collection) => <button className="variation-default" key={collection.id} type="button" onClick={() => setDefaultVariation(collection.id, variation.id)}>{collection.defaultVariationId === variation.id ? `Default for ${collection.name}` : `Set default for ${collection.name}`}</button>)}</div>)}</div>
          <div className="song-detail-actions"><Link className="btn primary" href={`/songs?songId=${encodeURIComponent(selectedSong.id)}&variationId=${encodeURIComponent(selectedVariation?.id ?? "")}&largePrint=${state.preferences.largePrint ? "1" : "0"}&handsFree=${state.preferences.handsFree ? "1" : "0"}`} onClick={() => { const practiced = recordSongPractice(state, selectedSong.id, selectedVariation?.id); const queue = state.practiceQueues.find((item) => item.id === queueId); updateState(queue ? saveQueueResumePoint(practiced, { queueId: queue.id, songId: selectedSong.id, variationId: selectedVariation?.id }) : practiced); }}>Open Song Coach</Link><button className="btn" type="button" onClick={toggleSongFavorite} aria-pressed={state.favorites.includes(selectedSong.id)}>{state.favorites.includes(selectedSong.id) ? "★ Favorited" : "☆ Favorite"}</button><button className="btn" type="button" onClick={addQueue}>Add to queue</button>{state.collections.map((collection) => { const saved = collection.songIds.includes(selectedSong.id); return <button className="btn" key={collection.id} type="button" onClick={() => saved ? removeFromLibrary(collection.id) : addToLibrary(collection.id)}>{saved ? `Remove from ${collection.name}` : `Save to ${collection.name}`}</button>; })}</div>
          <div className="song-detail-section"><span className="label">Chord progression</span><div className="song-chord-inline">{songChords(selectedSong).map((chord, index) => <span key={`${chord}-${index}`}>{chord}</span>)}</div></div>
          {selectedSong.sections.map((section) => { const mastery = state.practiceProgress.find((progress) => progress.songId === selectedSong.id)?.sectionMastery?.[section.id] ?? 0; return <div className="song-detail-section" key={section.id}><span className="label">{section.title} · {mastery}% mastered</span><input aria-label={`Mastery for ${section.title}`} type="range" min="0" max="100" step="10" value={mastery} onChange={(event) => updateState(setSectionMastery(state, selectedSong.id, section.id, Number(event.target.value)))} />{section.blocks.map((block, index) => block.type === "lyrics" ? <p key={index}>{block.text}</p> : block.type === "tab" ? <pre key={index}>{block.lines?.join("\n")}</pre> : block.type === "annotation" ? <p className="muted" key={index}>{block.text}</p> : null)}</div>; })}
          {selectedSong.origin === "imported" && <p className="import-notice">Full offline tab/lyric import is available only when an authorized provider is configured. This saved link does not copy protected source content.</p>}
          {selectedProgress && <p className="muted">Practiced {selectedProgress.practiceCount} time(s) · {selectedProgress.streakDays ?? 1}-day streak · {averageMastery}% average mastery.</p>}
          {selectedSong.origin === "imported" && <p className="muted">Source status: {state.sourceHealth.find((health) => health.url === selectedSong.sourceUrl)?.status ?? (isOnline ? "not checked" : "offline")} {selectedSong.sourceUrl && <button className="text-button" type="button" onClick={() => retrySource(selectedSong.sourceUrl as string)}>Retry health check</button>}</p>}
          <div className="recording-controls"><span className="label">Performance review</span><label className="muted">Waveform zoom <input type="range" min="1" max="4" step="1" value={waveformZoom} onChange={(event) => setWaveformZoom(Number(event.target.value))} /></label>{recording ? <button className="btn" type="button" onClick={stopRecording}>Stop recording</button> : <button className="btn" type="button" onClick={startRecording}>Record yourself</button>}<span className="muted">{recordingStatus}</span>{state.recordings.filter((item) => item.songId === selectedSong.id).map((item) => <div className="recording-row" key={item.id}><span>{Math.round(item.durationMs / 100) / 10}s</span><span className="waveform" aria-label="Recording waveform" aria-valuemin={0} aria-valuemax={100} aria-valuenow={playingRecording === item.id ? 50 : 0} style={{ transform: `scaleX(${waveformZoom})`, transformOrigin: "left center" }} onClick={(event) => { const audio = recordingAudio.current; if (!audio) return; const bounds = event.currentTarget.getBoundingClientRect(); audio.currentTime = ((event.clientX - bounds.left) / bounds.width) * audio.duration; }} role="slider" tabIndex={0}>{(item.waveform ?? []).map((peak, index) => <i key={index} style={{ height: `${Math.max(8, peak * 100)}%` }} />)}</span>{item.sectionId && <span className="muted">Section: {item.sectionId}</span>}<button className="text-button" type="button" onClick={() => void playRecording(item.id)}>{playingRecording === item.id ? "Playing…" : "Play"}</button><button className="text-button" type="button" onClick={() => void removeRecording(item.id)}>Delete</button><button className="text-button" type="button" onClick={() => setTrimDraft({ ...trimDraft, [item.id]: trimDraft[item.id] ?? { start: 0, end: item.durationMs } })}>Trim</button>{trimDraft[item.id] && <><input aria-label="Trim start" type="range" min="0" max={item.durationMs} value={trimDraft[item.id].start} onChange={(event) => setTrimDraft({ ...trimDraft, [item.id]: { ...trimDraft[item.id], start: Number(event.target.value) } })} /><input aria-label="Trim end" type="range" min="0" max={item.durationMs} value={trimDraft[item.id].end} onChange={(event) => setTrimDraft({ ...trimDraft, [item.id]: { ...trimDraft[item.id], end: Number(event.target.value) } })} /><button className="text-button" type="button" onClick={() => void trimSavedRecording(item.id)}>Save trim</button></>}</div>)}</div>
        </aside>}
      </section>

      <section className="song-library-bottom-grid">
        <div className="library-management-card"><div className="card-heading"><div><span className="label">Your collections</span><h2>Practice libraries</h2></div><span><button className="btn" type="button" onClick={createLibrary}>Create</button> <button className="btn" type="button" onClick={shareLibrary} disabled={libraryId === "All"}>Share</button></span></div>{state.collections.length ? state.collections.map((collection) => <div className="collection-row" key={collection.id}><span><strong>{collection.name}</strong><small>{collection.songIds.length} songs · {state.sharedAccess.filter((access) => access.libraryId === collection.id).length} collaborators</small></span><span><button className="text-button" type="button" onClick={() => { setLibraryId(collection.id); }}>Select</button> <button className="text-button" type="button" onClick={() => renameLibrary(collection.id)}>Rename</button> <button className="text-button" type="button" onClick={() => deleteLibrary(collection.id)}>Delete</button></span></div>) : <p className="muted">Create a collection to keep a focused set of songs close at hand.</p>}</div>
        <form className="library-management-card" onSubmit={saveSourceLink}><div className="card-heading"><div><span className="label">{ultimateGuitarSource.label}</span><h2>Browse and save a source</h2></div><a className="btn" href={ultimateGuitarSource.searchURL(query)} target="_blank" rel="noreferrer">Browse UG ↗</a></div><p className="muted">Search Ultimate Guitar in the original site, then save a link here. No protected tab or lyric content is copied without an authorized provider.</p><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Ultimate Guitar URL" required type="url" /><div className="two-inputs"><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Song title" /><input value={sourceArtist} onChange={(event) => setSourceArtist(event.target.value)} placeholder="Artist" /></div><textarea value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} placeholder="Your practice notes (optional)" rows={3} /><button className="btn primary" type="submit">Save source link</button></form>
        <form className="library-management-card" onSubmit={saveManualSong}><div className="card-heading"><div><span className="label">Custom song</span><h2>Create and edit sections</h2></div></div><div className="two-inputs"><input aria-label="Song title" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="Song title" required /><input aria-label="Artist" value={manualArtist} onChange={(event) => setManualArtist(event.target.value)} placeholder="Artist" /></div><div className="two-inputs"><input aria-label="Key" value={manualKey} onChange={(event) => setManualKey(event.target.value)} placeholder="Key" /><input aria-label="Meter" value={manualMeter} onChange={(event) => setManualMeter(event.target.value)} placeholder="Meter" /><input aria-label="BPM" value={manualBpm} onChange={(event) => setManualBpm(event.target.value)} type="number" min="40" max="240" placeholder="BPM" /></div>{manualSections.map((section, index) => <fieldset className="manual-section-editor" key={index}><legend>Section {index + 1}</legend><input aria-label={`Section ${index + 1} title`} value={section.title} onChange={(event) => updateManualSection(index, "title", event.target.value)} placeholder="Section title" /><input aria-label={`Section ${index + 1} chords`} value={section.chords} onChange={(event) => updateManualSection(index, "chords", event.target.value)} placeholder="Chords, e.g. C G Am F" /><textarea aria-label={`Section ${index + 1} lyrics`} value={section.lyrics} onChange={(event) => updateManualSection(index, "lyrics", event.target.value)} placeholder="Lyrics" rows={2} /><textarea aria-label={`Section ${index + 1} tab`} value={section.tab} onChange={(event) => updateManualSection(index, "tab", event.target.value)} placeholder="Tab lines (optional)" rows={2} />{manualSections.length > 1 && <button className="text-button" type="button" onClick={() => setManualSections((sections) => sections.filter((_, sectionIndex) => sectionIndex !== index))}>Remove section</button>}</fieldset>)}<button className="btn" type="button" onClick={() => setManualSections((sections) => [...sections, { title: `Section ${sections.length + 1}`, chords: "", lyrics: "", tab: "" }])}>Add section</button><button className="btn primary" type="submit">Save custom song</button></form>
        <div className="library-management-card"><div className="card-heading"><div><span className="label">Practice queues</span><h2>Drag songs into order</h2></div><span><button className="btn" type="button" onClick={addQueue}>New queue</button> <button className="btn" type="button" onClick={makeRecommendedQueue}>Recommend</button></span></div>{state.practiceQueues.length ? state.practiceQueues.map((queue) => <div className="queue-card" key={queue.id}><strong>{queue.name}</strong>{queue.songIds.map((songID, index) => <div className="queue-row" draggable key={songID} onDragStart={(event) => event.dataTransfer.setData("text/song-id", songID)} onDrop={(event) => { event.preventDefault(); const dragged = event.dataTransfer.getData("text/song-id"); if (dragged && dragged !== songID) { const from = queue.songIds.indexOf(dragged); const to = queue.songIds.indexOf(songID); const songIds = [...queue.songIds]; songIds.splice(from, 1); songIds.splice(to, 0, dragged); updateState({ ...state, practiceQueues: state.practiceQueues.map((item) => item.id === queue.id ? { ...item, songIds, updatedAt: new Date().toISOString() } : item) }); } }} onDragOver={(event) => event.preventDefault()}><span>{index + 1}. {allSongs.find((song) => song.id === songID)?.title ?? "Missing song"}</span><span><button className="text-button" type="button" onClick={() => moveQueueSong(queue.id, songID, -1)} aria-label="Move song up">↑</button> <button className="text-button" type="button" onClick={() => moveQueueSong(queue.id, songID, 1)} aria-label="Move song down">↓</button></span></div>)}</div>) : <p className="muted">Create a queue, then add songs from the detail panel.</p>}</div>
        <div className="library-management-card"><span className="label">Practice modes</span><h2>Make practice more accessible</h2><label><input type="checkbox" checked={state.preferences.largePrint} onChange={() => updatePreference("largePrint")} /> Large-print Song Coach</label><label><input type="checkbox" checked={state.preferences.handsFree} onChange={() => updatePreference("handsFree")} /> Hands-free controls and voice prompts</label><p className="muted">Cloud backup and sharing are intentionally reserved for a future account-enabled release; local export/import remains available now.</p></div>
      </section>
      <section className="song-library-bottom-grid">
        <div className="library-management-card"><span className="label">Weekly practice goal</span><h2>{state.weeklyGoal.completedSessions} / {state.weeklyGoal.targetSessions} sessions</h2><div className="goal-bar"><span style={{ width: `${Math.min(100, (state.weeklyGoal.completedSessions / Math.max(1, state.weeklyGoal.targetSessions)) * 100)}%` }} /></div><form className="inline-form" onSubmit={(event) => { event.preventDefault(); updateState(setWeeklyGoal(state, Number(goalInput))); }}><input aria-label="Weekly practice sessions" type="number" min="1" max="30" value={goalInput} onChange={(event) => setGoalInput(event.target.value)} /><button className="btn" type="submit">Set goal</button></form><button className="btn" type="button" onClick={() => selectedSong && updateState(recordPracticeSession(state, selectedSong.id, 15 * 60000, 0))}>Log 15-minute session</button><p className="muted">{weeklyStats.minutes} minutes · {weeklyStats.sessions} sessions · {weeklyStats.streak}-day streak</p></div>
        <div className="library-management-card"><span className="label">Mastery chart</span><h2>Section progress</h2>{selectedProgress?.sectionMastery && Object.entries(selectedProgress.sectionMastery).map(([sectionID, value]) => <div className="mastery-chart-row" key={sectionID}><span>{selectedSong?.sections.find((section) => section.id === sectionID)?.title ?? sectionID}</span><span className="mastery-bar"><i style={{ width: `${value}%` }} /></span><strong>{value}%</strong></div>)}{!selectedProgress?.sectionMastery && <p className="muted">Mark section mastery from the song detail panel.</p>}<p className="muted">Mastery improvement this week: {weeklyStats.averageMasteryDelta}%</p></div>
        <div className="library-management-card"><span className="label">Continue practicing</span><h2>{resumeSong?.title ?? "No queue in progress"}</h2>{resumeSong ? <Link className="btn primary" href={`/songs?songId=${encodeURIComponent(resumeSong.id)}&variationId=${encodeURIComponent(state.resumePoint?.variationId ?? "")}`}>Resume queue</Link> : <p className="muted">Open a song from a queue to save your resume point.</p>}{state.queueHistory.length > 0 && <p className="muted">Last completed: {new Date(state.queueHistory[0].completedAt).toLocaleDateString()}</p>}<button className="btn" type="button" onClick={completeSelectedQueue} disabled={queueId === "All"}>Complete selected queue</button></div>
      </section>
      {status && <p className="toast-message" role="status">{status}</p>}
      <p className="library-storage-note">Local library storage is versioned and device-only. <button className="text-button" type="button" onClick={exportLibrary}>Export backup</button> <label className="text-button">Import backup<input type="file" accept="application/json" onChange={importLibrary} hidden /></label> <button className="text-button" type="button" onClick={() => void exportEncryptedLibrary()}>Encrypted backup</button> <label className="text-button">Restore encrypted<input type="file" accept="application/json" onChange={importEncryptedLibrary} hidden /></label> <button className="text-button" type="button" onClick={() => { updateState(emptySongLibraryState()); setStatus("Local custom libraries cleared."); }}>Clear custom data</button></p>
    </main>
  );
}
