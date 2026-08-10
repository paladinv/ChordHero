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
  weeklyRecap,
  playVariationPreview,
  toggleFavorite,
  addSongAnnotation,
  addCollaboratorComment,
  sourceFreshnessScore,
  simplifyVariation,
  simplifyChord,
  serializeSongPreset,
  parseSongPreset,
  readSongLibraryState,
  songChords,
  transposeChord,
  recommendAdaptiveDifficulty,
  applyAdaptiveRecommendation,
  PRACTICE_PATH_TEMPLATES,
  createPracticePath,
  startPracticePath,
  recordPracticePathProgress,
  estimateSetlistTimeline,
  deriveProficiencyBadges,
  computeChordTransitionHeatmap,
  deriveProficiencyBenchmark,
  rolePermissions,
  enqueuePendingSync,
  archiveSong,
  archiveSetlist,
  addVideoReference,
  scheduleLocalItem,
  dueScheduledItems,
  pendingSyncSummary,
  type SongInstrument,
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
  const notifiedScheduleIds = useRef<Set<string>>(new Set());
  latestState.current = state;
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [key, setKey] = useState("All");
  const [meter, setMeter] = useState("All");
  const [technique, setTechnique] = useState("All");
  const [instrument, setInstrument] = useState("All");
  const [libraryId, setLibraryId] = useState("All");
  const [sortBy, setSortBy] = useState("title");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [queueId, setQueueId] = useState("All");
  const [manualSections, setManualSections] = useState([{ title: "Verse", chords: "", lyrics: "", tab: "" }]);
  const [isOnline, setIsOnline] = useState(true);
  const [goalInput, setGoalInput] = useState("3");
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [waveformZoom, setWaveformZoom] = useState(1);
  const [comparisonRecordingId, setComparisonRecordingId] = useState<string | null>(null);
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
  const [annotationDraft, setAnnotationDraft] = useState({ sectionId: "", body: "", chord: "", measure: "" });
  const [commentDraft, setCommentDraft] = useState("");
  const [viewerMode, setViewerMode] = useState(false);
  const [transposePreview, setTransposePreview] = useState(0);
  const [setlistName, setSetlistName] = useState("Live set");
  const [setlistDuration, setSetlistDuration] = useState("45");
  const [setlistChangeNotes, setSetlistChangeNotes] = useState("");
  const [presetFormat, setPresetFormat] = useState<"chordpro" | "plain-tab" | "musicxml">("chordpro");
  const [licensedMusicXml, setLicensedMusicXml] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoSectionId, setVideoSectionId] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleKind, setScheduleKind] = useState<"song" | "queue">("song");
  const [setlistBreakSeconds, setSetlistBreakSeconds] = useState("30");

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

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    dueScheduledItems(state).forEach((item) => {
      if (!item.notificationOptIn || notifiedScheduleIds.current.has(item.id)) return;
      notifiedScheduleIds.current.add(item.id);
      new Notification("Chord Hero practice reminder", { body: item.note || `Your ${item.kind} practice item is due.` });
    });
  }, [state]);

  const allSongs = useMemo(() => [...BUNDLED_SONGS, ...state.songs], [state.songs]);
  const isArchivedSong = (song: LibrarySong) => Boolean(song.archivedAt || state.archivedSongIds.includes(song.id));
  const visibleSongs = useMemo(() => allSongs.filter((song) => showArchived || !(song.archivedAt || state.archivedSongIds.includes(song.id))), [allSongs, showArchived, state.archivedSongIds]);
  const selectedSong = visibleSongs.find((song) => song.id === selectedId) ?? visibleSongs[0];
  const selectedQueue = state.practiceQueues.find((queue) => queue.id === queueId);
  const selectedVariation = selectedSong?.variations.find((variation) => variation.id === selectedVariationId) ?? selectedSong?.variations[0];
  const adaptiveOverride = selectedSong ? state.adaptiveOverrides[selectedSong.id] : undefined;
  const practiceVariation = selectedVariation ? { ...(state.preferences.simplifyMode ? simplifyVariation(selectedVariation) : selectedVariation), ...(adaptiveOverride ? { bpm: adaptiveOverride.tempo } : {}) } : selectedVariation;
  const filteredSongs = useMemo(() => {
    const songs = visibleSongs.filter((song) => matchesSongFilters(song, { query, difficulty, key, meter, technique, libraryId, instrument }, state.collections)).filter((song) => !favoritesOnly || state.favorites.includes(song.id)).filter((song) => queueId === "All" || state.practiceQueues.find((queue) => queue.id === queueId)?.songIds.includes(song.id));
    return [...songs].sort((left, right) => sortBy === "difficulty" ? left.difficulty.localeCompare(right.difficulty) : sortBy === "bpm" ? left.bpm - right.bpm : sortBy === "recent" ? (state.recentSongIds.indexOf(left.id) + 100) - (state.recentSongIds.indexOf(right.id) + 100) : left.title.localeCompare(right.title));
  }, [difficulty, favoritesOnly, instrument, key, libraryId, meter, query, queueId, sortBy, state.collections, state.favorites, state.practiceQueues, state.recentSongIds, technique, visibleSongs]);
  const resumeSong = state.resumePoint ? visibleSongs.find((song) => song.id === state.resumePoint?.songId) : undefined;
  const selectedProgress = selectedSong ? state.practiceProgress.find((progress) => progress.songId === selectedSong.id) : undefined;
  const averageMastery = selectedProgress?.sectionMastery && Object.values(selectedProgress.sectionMastery).length ? Math.round(Object.values(selectedProgress.sectionMastery).reduce((sum, value) => sum + value, 0) / Object.values(selectedProgress.sectionMastery).length) : 0;
  const weeklyStats = useMemo(() => weeklyPracticeStats(state), [state]);
  const weeklyRecapData = useMemo(() => weeklyRecap(state, allSongs), [allSongs, state]);
  const keys = useMemo(() => Array.from(new Set(allSongs.flatMap((song) => [song.key, ...song.variations.map((variation) => variation.key)]))).sort(), [allSongs]);
  const meters = useMemo(() => Array.from(new Set(allSongs.flatMap((song) => [song.timeSignature, ...song.variations.map((variation) => variation.timeSignature)]))).sort(), [allSongs]);
  const difficulties = useMemo(() => Array.from(new Set(allSongs.map((song) => song.difficulty))).sort(), [allSongs]);
  const instruments = useMemo(() => ["guitar", "ukulele", "bass"] as SongInstrument[], []);
  const adaptiveRecommendation = useMemo(() => selectedSong && selectedVariation ? recommendAdaptiveDifficulty(selectedSong, selectedVariation, selectedProgress, state.recordings) : undefined, [selectedProgress, selectedSong, selectedVariation, state.recordings]);
  const badges = useMemo(() => selectedSong ? deriveProficiencyBadges(selectedSong, selectedProgress, adaptiveOverride?.tempo) : [], [adaptiveOverride?.tempo, selectedProgress, selectedSong]);
  const transitionHeatmap = useMemo(() => selectedSong ? computeChordTransitionHeatmap(selectedSong, selectedProgress, state.recordings) : [], [selectedProgress, selectedSong, state.recordings]);
  const benchmark = useMemo(() => deriveProficiencyBenchmark(state), [state]);
  const selectedSetlistTimeline = useMemo(() => selectedQueue ? estimateSetlistTimeline({ id: "preview", name: selectedQueue.name, entries: selectedQueue.songIds.map((songId) => { const song = allSongs.find((item) => item.id === songId); const variation = song?.variations[0]; return { songId, variationId: variation?.id, capo: variation?.capo ?? 0, tuningId: variation?.tuningId ?? "standard" }; }), targetDurationMinutes: selectedQueue.targetDurationMinutes ?? 30, createdAt: "", updatedAt: "", transitionBreakSeconds: Number(setlistBreakSeconds) || 30 }, allSongs) : undefined, [allSongs, selectedQueue, setlistBreakSeconds]);
  const permissions = rolePermissions(state.preferences.localRole);

  const updateState = (next: SongLibraryState, description = "Local library change", kind: Parameters<typeof enqueuePendingSync>[2] = "local-change") => {
    const withPending = enqueuePendingSync(next, description, kind);
    setState(withPending);
    writeSongLibraryState(withPending);
  };

  const selectSong = (song: LibrarySong) => {
    setSelectedId(song.id);
    setSelectedVariationId(song.variations[0]?.id ?? "");
    setTransposePreview(state.appliedTranspositions[song.id] ?? 0);
    updateState(recordSongPractice(state, song.id, song.variations[0]?.id));
  };

  const toggleSongFavorite = () => selectedSong && updateState(toggleFavorite(state, selectedSong.id));

  const applyAdaptive = () => {
    if (!selectedSong || !adaptiveRecommendation) return;
    updateState(applyAdaptiveRecommendation(state, selectedSong.id, adaptiveRecommendation), "Applied adaptive tempo, simplification, and section loop", "practice");
    setStatus(`Adaptive plan saved: ${adaptiveRecommendation.tempo} BPM${adaptiveRecommendation.sectionId ? " with a section loop" : ""}. The original variation is unchanged.`);
  };

  const createPath = (templateId: string) => {
    const path = createPracticePath(templateId, visibleSongs);
    updateState({ ...state, practicePaths: [path, ...state.practicePaths.filter((item) => item.templateId !== templateId)] }, `Created practice path: ${path.name}`);
    setStatus(`${path.name} path created with ${path.stages.reduce((sum, stage) => sum + stage.eligibleSongIds.length, 0)} eligible song slots.`);
  };

  const startPathQueue = (path: SongLibraryState["practicePaths"][number]) => {
    const queue = startPracticePath(path);
    updateState({ ...state, practiceQueues: [queue, ...state.practiceQueues] }, `Started practice path queue: ${path.name}`);
    setQueueId(queue.id);
    setStatus(`Started ${queue.name}.`);
  };

  const addVideo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!permissions.canArrange) { setStatus("Your local role cannot attach arrangement references."); return; }
    if (!selectedSong || (!videoUrl.trim() && !videoTitle.trim())) return;
    updateState(addVideoReference(state, { songId: selectedSong.id, sectionId: videoSectionId || undefined, title: videoTitle.trim() || "Technique clip", url: videoUrl.trim() || undefined, source: "source-link" }), "Added a section video reference");
    setVideoTitle(""); setVideoUrl(""); setVideoSectionId(""); setStatus("Video reference saved as local metadata; no media was downloaded.");
  };

  const attachLocalVideo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!selectedSong || !file || !permissions.canArrange) return;
    updateState(addVideoReference(state, { songId: selectedSong.id, sectionId: videoSectionId || undefined, title: videoTitle.trim() || file.name, source: "local-reference", localFileName: file.name, localMimeType: file.type, localSizeBytes: file.size }), "Attached a local technique clip reference");
    setVideoTitle(""); setVideoSectionId(""); event.target.value = ""; setStatus("Local video reference saved. The file stays on this device/browser.");
  };

  const schedulePractice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const resourceId = scheduleKind === "song" ? selectedSong?.id : selectedQueue?.id;
    if (!resourceId || !scheduleAt) return;
    let notificationOptIn = false;
    if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
    notificationOptIn = typeof Notification !== "undefined" && Notification.permission === "granted";
    updateState(scheduleLocalItem(state, { kind: scheduleKind, resourceId, dueAt: new Date(scheduleAt).toISOString(), note: scheduleNote.trim() || undefined, notificationOptIn }), "Scheduled a local practice reminder", "schedule");
    setScheduleAt(""); setScheduleNote(""); setStatus(notificationOptIn ? "Local reminder scheduled with browser notification permission." : "Local reminder scheduled; browser notifications remain off.");
  };

  const toggleArchiveSelected = () => {
    if (!selectedSong || !permissions.canEditSongs) { setStatus("Your local role cannot archive songs."); return; }
    const archived = !isArchivedSong(selectedSong);
    updateState(archiveSong(state, selectedSong.id, archived), `${archived ? "Archived" : "Unarchived"} ${selectedSong.title}`, "archive");
    setStatus(`${selectedSong.title} ${archived ? "archived" : "restored"}. Historic practice remains available.`);
  };

  const previewVariation = (variation: LibrarySong["variations"][number]) => {
    if (typeof window === "undefined") return;
    const audio = new AudioContext(); playVariationPreview(variation, audio); window.setTimeout(() => void audio.close(), Math.max(1200, variation.pattern.split(/\s+/).length * (60000 / variation.bpm) + 300));
  };

  const updatePreference = (preference: "largePrint" | "handsFree" | "simplifyMode") => {
    const nextValue = !state.preferences[preference]; updateState(setLibraryPreference(state, { [preference]: nextValue }));
  };

  const updateManualSection = (index: number, field: "title" | "chords" | "lyrics" | "tab", value: string) => setManualSections((sections) => sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, [field]: value } : section));

  const startRecording = async () => {
    if (!selectedSong || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { setRecordingStatus("Audio recording is unavailable in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); const chunks: Blob[] = []; const startedAt = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); const id = `recording-${crypto.randomUUID()}`; const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" }); await saveRecording(id, blob); const analysis = await analyzeRecording(blob, 96, practiceVariation?.bpm).catch(() => ({ peaks: [], durationMs: Date.now() - startedAt, tempoDriftPercent: 0, timingConsistencyPercent: 0, analysisNote: "Analysis unavailable for this recording." })); updateState({ ...state, recordings: [{ id, songId: selectedSong.id, durationMs: analysis.durationMs, mimeType: blob.type, waveform: analysis.peaks, tempoDriftPercent: analysis.tempoDriftPercent, timingConsistencyPercent: analysis.timingConsistencyPercent, analysisNote: analysis.analysisNote, createdAt: new Date().toISOString() }, ...state.recordings] }); setRecordingStatus("Recording saved locally; heuristic timing feedback is ready."); };
      recorder.start(); setRecording(recorder); setRecordingStatus("Recording…");
    } catch { setRecordingStatus("Microphone permission was not granted."); }
  };

  const stopRecording = () => { recording?.stop(); setRecording(null); };
  const playRecording = async (id: string) => { const blob = await loadRecording(id); if (!blob) { setRecordingStatus("Recording is unavailable."); return; } recordingAudio.current?.pause(); const url = URL.createObjectURL(blob); const audio = new Audio(url); recordingAudio.current = audio; setPlayingRecording(id); audio.onended = () => { URL.revokeObjectURL(url); setPlayingRecording(null); }; await audio.play(); };
  const removeRecording = async (id: string) => { await deleteRecording(id); updateState({ ...state, recordings: state.recordings.filter((record) => record.id !== id) }); };
  const trimSavedRecording = async (recordID: string) => { const record = state.recordings.find((item) => item.id === recordID); const draft = trimDraft[recordID]; if (!record || !draft) return; const blob = await loadRecording(recordID); if (!blob) return; const trimmed = await trimAudioRecording(blob, draft.start, draft.end); await saveRecording(recordID, trimmed); const analysis = await analyzeRecording(trimmed, 96, practiceVariation?.bpm); updateState({ ...state, recordings: state.recordings.map((item) => item.id === recordID ? { ...item, durationMs: analysis.durationMs, waveform: analysis.peaks, tempoDriftPercent: analysis.tempoDriftPercent, timingConsistencyPercent: analysis.timingConsistencyPercent, analysisNote: analysis.analysisNote, trimStartMs: draft.start, trimEndMs: draft.end, mimeType: trimmed.type } : item) }); setRecordingStatus("Recording trimmed and re-analyzed."); };
  const makeRecommendedQueue = () => { if (!permissions.canArrange) { setStatus("Your local role cannot create practice queues."); return; } const queue = recommendQueue({ ...state, songs: allSongs }, "Smart practice plan"); updateState({ ...state, practiceQueues: [...state.practiceQueues, queue] }); setQueueId(queue.id); setStatus("Balanced weak sections, new songs, and due reviews into a smart plan."); };
  const retrySource = (url: string) => { setStatus("Checking source…"); void retrySourceHealth(url).then(({ health, history }) => { updateState({ ...state, sourceHealth: [...state.sourceHealth.filter((item) => item.url !== url), health] }); setStatus(`${health.status === "online" ? "Source is available" : "Source unavailable"} · ${history.length} attempt(s).`); }); };
  const shareLibrary = () => { const library = state.collections.find((collection) => collection.id === libraryId); const accountID = window.prompt("Account email or ID to invite"); if (!library || !accountID) return; const role = window.prompt("Permission: viewer, commenter, arranger, setlist-manager, or editor", "viewer") as Exclude<SongLibraryState["sharedAccess"][number]["role"], "owner"> | null; if (!role || !["viewer", "commenter", "arranger", "setlist-manager", "editor"].includes(role)) return; const scope = window.prompt("Share library, selected song, or selected queue", "library"); if (scope === "song" && selectedSong) { updateState(setResourcePermission(state, "song", selectedSong.id, accountID, role), `Shared ${selectedSong.title} with ${role}`); setStatus(`Invited ${accountID} to ${selectedSong.title}.`); } else if (scope === "queue" && selectedQueue) { updateState(setResourcePermission(state, "queue", selectedQueue.id, accountID, role), `Shared ${selectedQueue.name} with ${role}`); setStatus(`Invited ${accountID} to ${selectedQueue.name}.`); } else { updateState(setLibraryPermission(state, library.id, accountID, role), `Shared ${library.name} with ${role}`); setStatus(`Invited ${accountID} to ${library.name}.`); } };

  const addQueue = () => {
    if (!permissions.canArrange) { setStatus("Your local role cannot edit practice queues."); return; }
    if (queueId !== "All" && selectedSong) {
      const existingQueue = state.practiceQueues.find((queue) => queue.id === queueId);
      if (existingQueue && !existingQueue.songIds.includes(selectedSong.id)) {
        updateState({ ...state, practiceQueues: state.practiceQueues.map((queue) => queue.id === queueId ? { ...queue, songIds: [...queue.songIds, selectedSong.id], updatedAt: new Date().toISOString() } : queue) }); setStatus(`Added ${selectedSong.title} to ${existingQueue.name}.`); return;
      }
    }
    const name = window.prompt("Name this practice queue", "Today's practice")?.trim(); if (!name) return;
    const now = new Date().toISOString(); const queue = { id: `queue-${crypto.randomUUID()}`, name, songIds: selectedSong ? [selectedSong.id] : [], createdAt: now, updatedAt: now, targetDurationMinutes: 30 };
    updateState({ ...state, practiceQueues: [...state.practiceQueues, queue] }); setQueueId(queue.id); setStatus(`Created ${name}.`);
  };

  const moveQueueSong = (queueID: string, songID: string, direction: -1 | 1) => {
    if (!permissions.canArrange) return;
    const queue = state.practiceQueues.find((item) => item.id === queueID); if (!queue) return; const index = queue.songIds.indexOf(songID); const target = index + direction; if (index < 0 || target < 0 || target >= queue.songIds.length) return;
    const songIds = [...queue.songIds]; [songIds[index], songIds[target]] = [songIds[target], songIds[index]];
    updateState({ ...state, practiceQueues: state.practiceQueues.map((item) => item.id === queueID ? { ...item, songIds, updatedAt: new Date().toISOString() } : item) });
  };

  const saveResume = (queue: typeof state.practiceQueues[number], songID: string) => updateState(saveQueueResumePoint(state, { queueId: queue.id, songId: songID, variationId: selectedVariation?.id }));
  const completeSelectedQueue = () => { const queue = state.practiceQueues.find((item) => item.id === queueId); if (queue) { const path = state.practicePaths.find((item) => queue.name.startsWith(item.name)); const progressed = path ? recordPracticePathProgress(state, path.templateId, queue.songIds) : state; updateState(finishQueue(progressed, queue, selectedSong?.id), "Completed a practice queue", "practice"); setStatus("Queue completed. Your weekly goal was updated."); } };
  const saveAnnotation = (event: React.FormEvent<HTMLFormElement>, sectionId: string) => { event.preventDefault(); if (!annotationDraft.body.trim()) return; updateState(addSongAnnotation(state, { songId: selectedSong?.id ?? "", sectionId, body: annotationDraft.body.trim(), marker: { chord: annotationDraft.chord.trim() || undefined, measure: annotationDraft.measure ? Number(annotationDraft.measure) : undefined } })); setAnnotationDraft({ sectionId: "", body: "", chord: "", measure: "" }); setStatus("Personal annotation saved to this section."); };
  const saveComment = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selectedSong || !commentDraft.trim() || viewerMode || !permissions.canComment) return; updateState(addCollaboratorComment(state, { songId: selectedSong.id, sectionId: annotationDraft.sectionId || undefined, body: commentDraft.trim(), authorId: "local-player", role: state.preferences.localRole })); setCommentDraft(""); };
  const createSetlist = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!permissions.canManageSetlists) return; const sourceQueue = selectedQueue; const entries = (sourceQueue?.songIds ?? (selectedSong ? [selectedSong.id] : [])).map((songId) => { const song = allSongs.find((item) => item.id === songId); const variation = song?.variations[0]; return { songId, variationId: variation?.id, capo: variation?.capo ?? 0, tuningId: variation?.tuningId ?? "standard", changeNotes: setlistChangeNotes.trim() || undefined }; }); if (!entries.length) return; const now = new Date().toISOString(); const setlist = { id: `setlist-${crypto.randomUUID()}`, name: setlistName.trim() || "Live set", targetDurationMinutes: Math.max(5, Number(setlistDuration) || 45), entries, transitionBreakSeconds: Math.max(0, Math.min(600, Number(setlistBreakSeconds) || 30)), createdAt: now, updatedAt: now }; updateState({ ...state, setlists: [setlist, ...state.setlists] }, `Created setlist: ${setlist.name}`); setStatus(`Setlist ready · ${entries.length} songs · ${setlist.targetDurationMinutes} min target.`); };
  const launchSetlist = (setlist: SongLibraryState["setlists"][number]) => { const first = setlist.entries[0]; const song = allSongs.find((item) => item.id === first?.songId); if (!first || !song) return; window.location.href = `/songs?songId=${encodeURIComponent(song.id)}&variationId=${encodeURIComponent(first.variationId ?? song.variations[0]?.id ?? "")}&setlistId=${encodeURIComponent(setlist.id)}`; };
  const exportPreset = () => { if (!selectedSong) return; try { const content = serializeSongPreset(selectedSong, presetFormat, licensedMusicXml); const extension = presetFormat === "musicxml" ? "musicxml" : presetFormat === "chordpro" ? "pro" : "txt"; const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([content], { type: "text/plain" })); anchor.download = `${selectedSong.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${extension}`; anchor.click(); setStatus(`${presetFormat} preset exported.`); } catch (error) { setStatus(error instanceof Error ? error.message : "Preset export was blocked."); } };
  const importPreset = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || (presetFormat === "musicxml" && !licensedMusicXml)) { setStatus("MusicXML import requires confirming that you have a license for the file."); return; } void file.text().then((text) => { if (presetFormat === "musicxml") { const title = text.match(/<work-title>([^<]+)/i)?.[1] ?? file.name.replace(/\.musicxml?$/i, ""); const artist = text.match(/<creator[^>]*>([^<]+)/i)?.[1] ?? "Licensed source"; return { title, artist, sections: [{ id: `xml-${crypto.randomUUID()}`, title: "Imported score", blocks: [{ type: "annotation" as const, text: "MusicXML metadata imported; verify the licensed score before sharing." }] }], source: "Licensed MusicXML", license: "Licensed-only import confirmed by user" }; } return parseSongPreset(text, presetFormat, `${presetFormat} preset`); }).then((parsed) => { const song = createManualSong({ title: parsed.title, artist: parsed.artist, key: "C", timeSignature: "4/4", bpm: 90, chords: parsed.sections.flatMap((section) => section.blocks.flatMap((block) => block.chords ?? [])), lyrics: parsed.sections.flatMap((section) => section.blocks.flatMap((block) => block.text ?? "")).join("\n") }); updateState({ ...state, songs: [...state.songs, { ...song, source: parsed.source, license: parsed.license, sections: parsed.sections }] }); setStatus("Preset imported as a local song."); }).catch(() => setStatus("That preset could not be imported.")); event.target.value = ""; };

  const saveManualSong = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!permissions.canEditSongs) { setStatus("Your local role cannot create songs."); return; }
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
    const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if ((parsed?.version === 1 || parsed?.version === 2 || parsed?.version === 3) && Array.isArray(parsed.collections) && Array.isArray(parsed.songs)) { updateState({ ...emptySongLibraryState(), ...parsed, version: 3, songs: [...state.songs, ...parsed.songs.filter((song: LibrarySong) => !state.songs.some((existing) => existing.id === song.id))] }, "Imported a library backup", "import"); setStatus("Library backup restored and migrated to v3."); } else throw new Error("Invalid library"); } catch { setStatus("That backup could not be imported."); } }; reader.readAsText(file); event.target.value = "";
  };

  const importEncryptedLibrary = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const password = window.prompt("Password for encrypted backup"); if (!password) return; void file.text().then((payload) => decryptLibraryBackup(payload, password)).then((imported) => { updateState(imported); setStatus("Encrypted backup restored."); }).catch(() => setStatus("Could not decrypt that backup.")); event.target.value = ""; };

  const createLibrary = () => {
    if (!permissions.canEditSongs) { setStatus("Your local role cannot create libraries."); return; }
    const name = window.prompt("Name your song library", "My practice songs")?.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const collection = { id: `library-${crypto.randomUUID()}`, name, description: "A personal song collection", songIds: [], createdAt: now, updatedAt: now };
    updateState({ ...state, collections: [...state.collections, collection] });
    setLibraryId(collection.id);
    setStatus(`Created ${name}.`);
  };

  const addToLibrary = (collectionId: string) => {
    if (!permissions.canEditSongs) return;
    if (!selectedSong) return;
    const now = new Date().toISOString();
    const collections = state.collections.map((collection) => collection.id === collectionId && !collection.songIds.includes(selectedSong.id)
      ? { ...collection, songIds: [...collection.songIds, selectedSong.id], updatedAt: now }
      : collection);
    updateState({ ...state, collections });
    setStatus(`Saved ${selectedSong.title} to your library.`);
  };

  const removeFromLibrary = (collectionId: string) => {
    if (!permissions.canEditSongs) return;
    if (!selectedSong) return;
    const collections = state.collections.map((collection) => collection.id === collectionId
      ? { ...collection, songIds: collection.songIds.filter((id) => id !== selectedSong.id), updatedAt: new Date().toISOString() }
      : collection);
    updateState({ ...state, collections });
    setStatus(`Removed ${selectedSong.title}.`);
  };

  const setDefaultVariation = (collectionId: string, variationId: string) => {
    if (!permissions.canArrange) return;
    updateState({ ...state, collections: state.collections.map((collection) => collection.id === collectionId ? { ...collection, defaultVariationId: variationId, updatedAt: new Date().toISOString() } : collection) });
    setStatus("Default practice variation updated.");
  };

  const deleteLibrary = (collectionId: string) => {
    if (!permissions.canEditSongs) return;
    const collection = state.collections.find((item) => item.id === collectionId);
    if (!collection || !window.confirm(`Delete ${collection.name}? Songs will remain in the catalogue.`)) return;
    updateState({ ...state, collections: state.collections.filter((item) => item.id !== collectionId) });
    if (libraryId === collectionId) setLibraryId("All");
  };

  const renameLibrary = (collectionId: string) => {
    if (!permissions.canEditSongs) return;
    const collection = state.collections.find((item) => item.id === collectionId);
    const name = collection && window.prompt("Rename song library", collection.name)?.trim();
    if (!collection || !name) return;
    updateState({ ...state, collections: state.collections.map((item) => item.id === collectionId ? { ...item, name, updatedAt: new Date().toISOString() } : item) });
  };

  const saveSourceLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!permissions.canEditSongs) { setStatus("Your local role cannot save source links."); return; }
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
            <button className="btn" type="button" onClick={createLibrary} disabled={!permissions.canEditSongs}>New library</button>
          </div>
          <div className="song-filter-grid">
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Difficulty"><option value="All">All difficulties</option>{difficulties.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={key} onChange={(event) => setKey(event.target.value)} aria-label="Key"><option value="All">All keys</option>{keys.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={meter} onChange={(event) => setMeter(event.target.value)} aria-label="Time signature"><option value="All">All meters</option>{meters.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={technique} onChange={(event) => setTechnique(event.target.value)} aria-label="Technique">{Object.entries(techniqueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={instrument} onChange={(event) => setInstrument(event.target.value)} aria-label="Instrument"><option value="All">All instruments</option>{instruments.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
            <select value={libraryId} onChange={(event) => setLibraryId(event.target.value)} aria-label="Song library"><option value="All">All collections</option>{state.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort songs"><option value="title">Sort: title</option><option value="difficulty">Sort: difficulty</option><option value="bpm">Sort: tempo</option><option value="recent">Sort: recently practiced</option></select>
            <select value={queueId} onChange={(event) => setQueueId(event.target.value)} aria-label="Practice queue"><option value="All">All queues</option>{state.practiceQueues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}</select>
            <button className={`filter-toggle ${favoritesOnly ? "active" : ""}`} type="button" onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}>★ Favorites</button>
            <button className={`filter-toggle ${showArchived ? "active" : ""}`} type="button" onClick={() => setShowArchived((value) => !value)} aria-pressed={showArchived}>▣ {showArchived ? "Showing archived" : "Hide archived"}</button>
          </div>
          <div className="song-library-count">{filteredSongs.length} result{filteredSongs.length === 1 ? "" : "s"}</div>
          <div className="song-library-list">
            {filteredSongs.map((song) => <button className={`song-library-row ${song.id === selectedSong?.id ? "active" : ""}`} key={song.id} type="button" onClick={() => selectSong(song)}><span><strong>{song.title}</strong><small>{song.artist} · {song.difficulty} · {song.timeSignature}{isArchivedSong(song) ? " · archived" : ""}</small></span><span className="song-row-tag">{isArchivedSong(song) ? "Archived" : song.origin === "imported" ? "Saved link" : song.tags[0] ?? "Traditional"}</span></button>)}
            {!filteredSongs.length && <div className="empty-state"><strong>No songs match those filters.</strong><span>Try a broader search or clear a filter.</span></div>}
          </div>
        </div>

        {selectedSong && <aside className="song-library-detail">
          <div className="detail-kicker">{selectedSong.origin === "imported" ? "Saved source link" : selectedSong.license}</div>
          <h2>{selectedSong.title}</h2>
          <p className="muted">{selectedSong.artist} · {selectedSong.source}</p>
          <div className="song-detail-meta"><span>{selectedSong.key}</span><span>{selectedSong.timeSignature}</span><span>{selectedSong.difficulty}</span><span>{selectedSong.bpm} BPM</span><span>{isArchivedSong(selectedSong) ? "Archived" : "Active"}</span></div>
          {selectedSong.sourceUrl && <p><a href={isOnline ? selectedSong.sourceUrl : undefined} target="_blank" rel="noreferrer" className={`source-link ${!isOnline ? "source-link-disabled" : ""}`} aria-disabled={!isOnline}>{isOnline ? "Open original source ↗" : "Source unavailable offline"}</a></p>}
          <div className="variation-picker"><span className="label">Practice variation · original arrangements stay unchanged</span>{selectedSong.variations.map((variation) => { const shown = state.preferences.simplifyMode ? simplifyVariation(variation) : variation; return <div className={`variation-card ${variation.id === selectedVariation?.id ? "active" : ""}`} key={variation.id}><button type="button" onClick={() => setSelectedVariationId(variation.id)}><strong>{shown.name}</strong><span>{techniqueLabels[shown.technique]} · {shown.instrument ?? "guitar"} · {shown.tuningLabel ?? shown.tuningId} · capo {shown.capo} · {shown.key} · {shown.timeSignature} · {shown.bpm} BPM</span><small>{shown.pattern}</small></button><button className="variation-preview" type="button" onClick={() => previewVariation(shown)}>▶ Preview pattern</button>{state.collections.filter((collection) => collection.songIds.includes(selectedSong.id)).map((collection) => <button className="variation-default" key={collection.id} type="button" onClick={() => setDefaultVariation(collection.id, variation.id)} disabled={!permissions.canArrange}>{collection.defaultVariationId === variation.id ? `Default for ${collection.name}` : `Set default for ${collection.name}`}</button>)}</div>; })}</div>
          <div className="song-detail-actions"><Link className="btn primary" href={`/songs?songId=${encodeURIComponent(selectedSong.id)}&variationId=${encodeURIComponent(selectedVariation?.id ?? "")}&tempo=${practiceVariation?.bpm ?? ""}&loopSection=${encodeURIComponent(adaptiveOverride?.sectionId ?? "")}&instrument=${encodeURIComponent(selectedVariation?.instrument ?? "guitar")}&tuning=${encodeURIComponent(selectedVariation?.tuningId ?? "standard")}&transpose=${state.appliedTranspositions[selectedSong.id] ?? 0}&largePrint=${state.preferences.largePrint ? "1" : "0"}&handsFree=${state.preferences.handsFree ? "1" : "0"}&simplify=${practiceVariation && practiceVariation.id !== selectedVariation?.id ? "1" : "0"}`} onClick={() => { const practiced = recordSongPractice(state, selectedSong.id, practiceVariation?.id); const queue = state.practiceQueues.find((item) => item.id === queueId); updateState(queue ? saveQueueResumePoint(practiced, { queueId: queue.id, songId: selectedSong.id, variationId: practiceVariation?.id }) : practiced, "Opened Song Coach", "practice"); }}>Open Song Coach</Link><button className="btn" type="button" onClick={toggleSongFavorite} aria-pressed={state.favorites.includes(selectedSong.id)}>{state.favorites.includes(selectedSong.id) ? "★ Favorited" : "☆ Favorite"}</button><button className="btn" type="button" onClick={addQueue} disabled={!permissions.canArrange}>Add to queue</button><button className="btn" type="button" onClick={toggleArchiveSelected}>{isArchivedSong(selectedSong) ? "Unarchive song" : "Archive song"}</button>{state.collections.map((collection) => { const saved = collection.songIds.includes(selectedSong.id); return <button className="btn" key={collection.id} type="button" onClick={() => saved ? removeFromLibrary(collection.id) : addToLibrary(collection.id)} disabled={!permissions.canEditSongs}>{saved ? `Remove from ${collection.name}` : `Save to ${collection.name}`}</button>; })}</div>
          <div className="song-detail-section"><span className="label">Transpose preview</span><div className="chip-row">{[-2, -1, 0, 1, 2].map((semitones) => <button className={`chip ${transposePreview === semitones ? "active" : ""}`} type="button" key={semitones} onClick={() => setTransposePreview(semitones)}>{semitones === 0 ? "Original" : `${semitones > 0 ? "+" : ""}${semitones}`}</button>)}<button className="btn" type="button" onClick={() => { updateState({ ...state, appliedTranspositions: { ...state.appliedTranspositions, [selectedSong.id]: transposePreview } }); setStatus(`Applied ${transposePreview === 0 ? "original key" : `${transposePreview > 0 ? "+" : ""}${transposePreview} semitone`} practice view.`); }}>Apply preview</button></div><div className="song-chord-inline transpose-preview" aria-label="Transposed chord preview">{songChords(selectedSong).map((rawChord, index) => { const chord = state.preferences.simplifyMode ? simplifyChord(rawChord) : rawChord; return <span className={transposePreview !== 0 ? "changed" : ""} key={`${rawChord}-${index}`}>{transposeChord(chord, transposePreview)}</span>; })}</div><p className="muted">Changed chord names are highlighted before you apply them.</p></div>
          <div className="song-detail-section adaptive-card"><span className="label">Adaptive difficulty</span><h3>{adaptiveRecommendation ? `${adaptiveRecommendation.tempo} BPM · ${adaptiveRecommendation.simplifyMode ? "simplified first pass" : "original complexity"}` : "Select a variation"}</h3><p className="muted">{adaptiveRecommendation?.reason ?? "Recommendations use section mastery, practice count, and recent timing feedback."}</p>{adaptiveRecommendation?.sectionId && <p className="adaptive-loop">Loop: {selectedSong.sections.find((section) => section.id === adaptiveRecommendation.sectionId)?.title}</p>}<button className="btn" type="button" onClick={applyAdaptive} disabled={!adaptiveRecommendation}>Apply recommendation</button>{adaptiveOverride && <span className="muted">Applied locally; source variation and original BPM are preserved.</span>}</div>
          {selectedSong.sections.map((section) => { const mastery = state.practiceProgress.find((progress) => progress.songId === selectedSong.id)?.sectionMastery?.[section.id] ?? 0; const annotations = state.annotations.filter((annotation) => annotation.songId === selectedSong.id && annotation.sectionId === section.id); return <div className="song-detail-section" key={section.id}><span className="label">{section.title} · {mastery}% mastered</span><input aria-label={`Mastery for ${section.title}`} type="range" min="0" max="100" step="10" value={mastery} onChange={(event) => updateState(setSectionMastery(state, selectedSong.id, section.id, Number(event.target.value)))} />{section.blocks.map((block, index) => block.type === "lyrics" ? <p key={index}>{block.text}</p> : block.type === "tab" ? <pre key={index}>{block.lines?.join("\n")}</pre> : block.type === "annotation" ? <p className="muted" key={index}>{block.text}</p> : null)}{annotations.map((annotation) => <p className="annotation-note" key={annotation.id}><strong>Note{annotation.marker?.chord ? ` · ${annotation.marker.chord}` : ""}{annotation.marker?.measure ? ` · measure ${annotation.marker.measure}` : ""}:</strong> {annotation.body}</p>)}<form className="inline-form annotation-form" onSubmit={(event) => saveAnnotation(event, section.id)}><input aria-label={`Annotation for ${section.title}`} value={annotationDraft.sectionId === section.id ? annotationDraft.body : ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, sectionId: section.id, body: event.target.value })} placeholder="Add a personal note…" /><input aria-label="Optional chord marker" value={annotationDraft.sectionId === section.id ? annotationDraft.chord : ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, sectionId: section.id, chord: event.target.value })} placeholder="Chord" /><input aria-label="Optional measure marker" inputMode="numeric" value={annotationDraft.sectionId === section.id ? annotationDraft.measure : ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, sectionId: section.id, measure: event.target.value })} placeholder="Measure" /><button className="text-button" type="submit">Save note</button></form></div>; })}
          {selectedSong.origin === "imported" && <p className="import-notice">Full offline tab/lyric import is available only when an authorized provider is configured. This saved link does not copy protected source content.</p>}
          <div className="song-detail-section"><span className="label">Proficiency badges</span><div className="badge-grid">{badges.map((badge) => <span className={`proficiency-badge ${badge.earned ? "earned" : ""}`} key={badge.id} title={badge.description}>{badge.earned ? "●" : "○"} {badge.title}</span>)}</div><span className="muted">Badges are derived from practice data and cannot be edited.</span></div>
          <div className="song-detail-section"><span className="label">Chord-transition heatmap</span><p className="muted">Most troublesome consecutive changes, computed from section mastery and recent timing feedback.</p><div className="transition-heatmap" aria-label="Chord transition heatmap">{transitionHeatmap.length ? transitionHeatmap.map((item) => <span key={`${item.from}-${item.to}`} style={{ "--heat": `${Math.max(8, item.difficulty)}%` } as React.CSSProperties}><strong>{item.label}</strong><small>{item.count}× · difficulty {item.difficulty}/100</small></span>) : <span className="muted">Add chord blocks and practice feedback to see transitions.</span>}</div></div>
          <form className="song-detail-section" onSubmit={addVideo}><span className="label">Section videos and technique clips</span><div className="two-inputs"><select aria-label="Video section" value={videoSectionId} onChange={(event) => setVideoSectionId(event.target.value)}><option value="">Whole song</option>{selectedSong.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select><input aria-label="Video title" value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} placeholder="Technique clip title" /></div><div className="two-inputs"><input aria-label="Video source URL" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="Source link (no download)" /><label className="btn">Attach local video reference<input type="file" accept="video/*" hidden onChange={attachLocalVideo} /></label></div><button className="btn" type="submit">Save source reference</button>{state.videoReferences.filter((reference) => reference.songId === selectedSong.id).map((reference) => <p className="video-reference" key={reference.id}>{reference.title} · {reference.source === "local-reference" ? `Local file: ${reference.localFileName}` : reference.url ? <a href={reference.url} target="_blank" rel="noreferrer">Open source ↗</a> : "Metadata only"}</p>)}</form>
          <div className="song-detail-section collaborator-comments"><div className="card-heading"><span className="label">Collaborator comments</span><button className="text-button" type="button" onClick={() => setViewerMode((value) => !value)} aria-pressed={viewerMode}>{viewerMode ? "Viewer mode on" : "Preview as viewer"}</button></div>{state.comments.filter((comment) => comment.songId === selectedSong.id).map((comment) => <p className="comment-note" key={comment.id}><strong>{comment.authorId}</strong> · {new Date(comment.createdAt).toLocaleString()} · {comment.role}<br />{comment.body}</p>)}<form className="inline-form" onSubmit={saveComment}><input aria-label="Collaborator comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Leave a timestamped comment…" disabled={viewerMode} /><button className="text-button" type="submit" disabled={viewerMode || !commentDraft.trim()}>Comment</button></form>{viewerMode && <p className="muted">Viewer access can read comments and lead sheets; editing is disabled.</p>}</div>
          {selectedProgress && <p className="muted">Practiced {selectedProgress.practiceCount} time(s) · {selectedProgress.streakDays ?? 1}-day streak · {averageMastery}% average mastery.</p>}
          {selectedSong.origin === "imported" && <p className="muted">Source status: {state.sourceHealth.find((health) => health.url === selectedSong.sourceUrl)?.status ?? (isOnline ? "not checked" : "offline")} · freshness score {sourceFreshnessScore(state.sourceHealth.find((health) => health.url === selectedSong.sourceUrl))}/100 {selectedSong.sourceUrl && <button className="text-button" type="button" onClick={() => retrySource(selectedSong.sourceUrl as string)}>Retry health check</button>}</p>}
          <div className="recording-controls"><span className="label">Performance review</span><label className="muted">Waveform zoom <input aria-label="Waveform zoom" type="range" min="1" max="4" step="1" value={waveformZoom} onChange={(event) => setWaveformZoom(Number(event.target.value))} /></label>{recording ? <button className="btn" type="button" onClick={stopRecording}>Stop recording</button> : <button className="btn" type="button" onClick={startRecording}>Record yourself</button>}<span className="muted">{recordingStatus}</span>{state.recordings.filter((item) => item.songId === selectedSong.id).map((item) => { const comparison = comparisonRecordingId && comparisonRecordingId !== item.id ? state.recordings.find((record) => record.id === comparisonRecordingId && record.songId === selectedSong.id) : undefined; return <div className="recording-row" key={item.id}><span>{Math.round(item.durationMs / 100) / 10}s</span><span className="waveform-stack"><span className="waveform" aria-label="Recording waveform" aria-valuemin={0} aria-valuemax={100} aria-valuenow={playingRecording === item.id ? 50 : 0} style={{ transform: `scaleX(${waveformZoom})`, transformOrigin: "left center" }} onClick={(event) => { const audio = recordingAudio.current; if (!audio) return; const bounds = event.currentTarget.getBoundingClientRect(); audio.currentTime = ((event.clientX - bounds.left) / bounds.width) * audio.duration; }} role="slider" tabIndex={0}>{(item.waveform ?? []).map((peak, index) => <i key={index} style={{ height: `${Math.max(8, peak * 100)}%` }} />)}</span>{comparison && <span className="waveform waveform-overlay" aria-label={`Comparison waveform for ${comparison.id}`}>{(comparison.waveform ?? []).map((peak, index) => <i key={index} style={{ height: `${Math.max(8, peak * 100)}%` }} />)}</span>}</span>{item.sectionId && <span className="muted">Section: {item.sectionId}</span>}<button className="text-button" type="button" onClick={() => void playRecording(item.id)}>{playingRecording === item.id ? "Playing…" : "Play"}</button><button className="text-button" type="button" onClick={() => setComparisonRecordingId(comparisonRecordingId === item.id ? null : item.id)}>{comparisonRecordingId === item.id ? "Comparing" : "Compare"}</button><button className="text-button" type="button" onClick={() => void removeRecording(item.id)}>Delete</button><button className="text-button" type="button" onClick={() => setTrimDraft({ ...trimDraft, [item.id]: trimDraft[item.id] ?? { start: 0, end: item.durationMs } })}>Trim</button>{trimDraft[item.id] && <><input aria-label="Trim start" type="range" min="0" max={item.durationMs} value={trimDraft[item.id].start} onChange={(event) => setTrimDraft({ ...trimDraft, [item.id]: { ...trimDraft[item.id], start: Number(event.target.value) } })} /><input aria-label="Trim end" type="range" min="0" max={item.durationMs} value={trimDraft[item.id].end} onChange={(event) => setTrimDraft({ ...trimDraft, [item.id]: { ...trimDraft[item.id], end: Number(event.target.value) } })} /><button className="text-button" type="button" onClick={() => void trimSavedRecording(item.id)}>Save trim</button></>}</div>; })}<label className="muted">Compare with<select aria-label="Compare recording" value={comparisonRecordingId ?? ""} onChange={(event) => setComparisonRecordingId(event.target.value || null)}><option value="">No overlay</option>{state.recordings.filter((item) => item.songId === selectedSong.id).map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()}</option>)}</select></label>{state.recordings.filter((item) => item.songId === selectedSong.id && item.tempoDriftPercent !== undefined).slice(0, 1).map((item) => <p className="analysis-feedback" key={`${item.id}-analysis`}>Heuristic feedback: tempo drift {item.tempoDriftPercent}% · timing consistency {item.timingConsistencyPercent}%. {item.analysisNote}</p>)}</div>
        </aside>}
      </section>

      <section className="song-library-bottom-grid">
        <div className="library-management-card"><span className="label">Practice paths</span><h2>Start with a named goal</h2><p className="muted">Each path keeps stages, eligible songs, and progress local to this device.</p><div className="path-template-grid">{PRACTICE_PATH_TEMPLATES.map((template) => <button className="path-template" type="button" key={template.id} onClick={() => createPath(template.id)} disabled={!permissions.canArrange}><strong>{template.name}</strong><small>{template.description}</small></button>)}</div>{state.practicePaths.map((path) => <div className="path-row" key={path.id}><span><strong>{path.name}</strong><small>{path.stages.filter((stage) => stage.completedSongIds.length >= stage.eligibleSongIds.length && stage.eligibleSongIds.length > 0).length}/{path.stages.length} stages · {path.stages.reduce((sum, stage) => sum + stage.eligibleSongIds.length, 0)} eligible songs</small></span><button className="text-button" type="button" onClick={() => startPathQueue(path)} disabled={!permissions.canArrange}>Start queue</button></div>)}</div>
        <form className="library-management-card" onSubmit={schedulePractice}><span className="label">Local calendar</span><h2>Schedule practice</h2><p className="muted">Reminders are stored locally. The browser Notification API is opt-in and never sends data to a server.</p><div className="two-inputs"><select aria-label="Schedule item type" value={scheduleKind} onChange={(event) => setScheduleKind(event.target.value as "song" | "queue")}><option value="song">Selected song</option><option value="queue">Selected queue</option></select><input aria-label="Due time" type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} required /></div><input aria-label="Reminder note" value={scheduleNote} onChange={(event) => setScheduleNote(event.target.value)} placeholder="Reminder note (optional)" /><button className="btn primary" type="submit" disabled={!permissions.canSchedule || (scheduleKind === "song" ? !selectedSong : !selectedQueue)}>Schedule locally</button>{state.scheduledItems.slice(0, 5).map((item) => <p className="schedule-row" key={item.id}>{new Date(item.dueAt).toLocaleString()} · {item.kind} · {item.notificationOptIn ? "notifications on" : "notifications off"}</p>)}</form>
        <div className="library-management-card"><span className="label">Local collaboration role</span><h2>Capabilities on this device</h2><select aria-label="Local collaboration role" value={state.preferences.localRole} onChange={(event) => updateState(setLibraryPreference(state, { localRole: event.target.value as SongLibraryState["preferences"]["localRole"] }), "Changed local collaboration role")}><option value="owner">Owner</option><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="commenter">Commenter</option><option value="arranger">Arranger</option><option value="setlist-manager">Setlist manager</option></select><p className="muted">{permissions.canEditSongs ? "Can edit song data" : "Song data editing disabled"} · {permissions.canComment ? "Can comment" : "Commenting disabled"} · {permissions.canManageSetlists ? "Can manage setlists" : "Setlist management disabled"}</p><p className="muted">{pendingSyncSummary(state)}</p><Link className="text-button" href="/song-library/conflicts">Review offline conflict queue</Link></div>
        <div className="library-management-card"><span className="label">Privacy-preserving benchmark</span><h2>Local aggregate practice summary</h2><label><input type="checkbox" checked={state.preferences.benchmarkOptIn} onChange={() => updateState(setLibraryPreference(state, { benchmarkOptIn: !state.preferences.benchmarkOptIn }), "Changed local benchmark opt-in")} /> Opt in to local-only aggregate benchmarks</label><p className="muted">No personal data, recordings, or uploads are used. {benchmark ? `${benchmark.sessions} sessions · ${benchmark.songsPracticed} songs · ${benchmark.averageMastery}% average mastery · ${benchmark.practiceMinutes} min.` : "Opt in to see your aggregate summary."}</p><span className="privacy-status">{state.preferences.benchmarkOptIn ? "Privacy status: opted in, device-only" : "Privacy status: off"}</span></div>
      </section>

      <section className="song-library-bottom-grid">
        <div className="library-management-card"><div className="card-heading"><div><span className="label">Your collections</span><h2>Practice libraries</h2></div><span><button className="btn" type="button" onClick={createLibrary}>Create</button> <button className="btn" type="button" onClick={shareLibrary} disabled={libraryId === "All"}>Share</button></span></div>{state.collections.length ? state.collections.map((collection) => <div className="collection-row" key={collection.id}><span><strong>{collection.name}</strong><small>{collection.songIds.length} songs · {state.sharedAccess.filter((access) => access.libraryId === collection.id).length} collaborators</small></span><span><button className="text-button" type="button" onClick={() => { setLibraryId(collection.id); }}>Select</button> <button className="text-button" type="button" onClick={() => renameLibrary(collection.id)}>Rename</button> <button className="text-button" type="button" onClick={() => deleteLibrary(collection.id)}>Delete</button></span></div>) : <p className="muted">Create a collection to keep a focused set of songs close at hand.</p>}</div>
        <form className="library-management-card" onSubmit={saveSourceLink}><div className="card-heading"><div><span className="label">{ultimateGuitarSource.label}</span><h2>Browse and save a source</h2></div><a className="btn" href={ultimateGuitarSource.searchURL(query)} target="_blank" rel="noreferrer">Browse UG ↗</a></div><p className="muted">Search Ultimate Guitar in the original site, then save a link here. No protected tab or lyric content is copied without an authorized provider.</p><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Ultimate Guitar URL" required type="url" /><div className="two-inputs"><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Song title" /><input value={sourceArtist} onChange={(event) => setSourceArtist(event.target.value)} placeholder="Artist" /></div><textarea value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} placeholder="Your practice notes (optional)" rows={3} /><button className="btn primary" type="submit">Save source link</button></form>
        <form className="library-management-card" onSubmit={saveManualSong}><div className="card-heading"><div><span className="label">Custom song</span><h2>Create and edit sections</h2></div></div><div className="two-inputs"><input aria-label="Song title" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="Song title" required /><input aria-label="Artist" value={manualArtist} onChange={(event) => setManualArtist(event.target.value)} placeholder="Artist" /></div><div className="two-inputs"><input aria-label="Key" value={manualKey} onChange={(event) => setManualKey(event.target.value)} placeholder="Key" /><input aria-label="Meter" value={manualMeter} onChange={(event) => setManualMeter(event.target.value)} placeholder="Meter" /><input aria-label="BPM" value={manualBpm} onChange={(event) => setManualBpm(event.target.value)} type="number" min="40" max="240" placeholder="BPM" /></div>{manualSections.map((section, index) => <fieldset className="manual-section-editor" key={index}><legend>Section {index + 1}</legend><input aria-label={`Section ${index + 1} title`} value={section.title} onChange={(event) => updateManualSection(index, "title", event.target.value)} placeholder="Section title" /><input aria-label={`Section ${index + 1} chords`} value={section.chords} onChange={(event) => updateManualSection(index, "chords", event.target.value)} placeholder="Chords, e.g. C G Am F" /><textarea aria-label={`Section ${index + 1} lyrics`} value={section.lyrics} onChange={(event) => updateManualSection(index, "lyrics", event.target.value)} placeholder="Lyrics" rows={2} /><textarea aria-label={`Section ${index + 1} tab`} value={section.tab} onChange={(event) => updateManualSection(index, "tab", event.target.value)} placeholder="Tab lines (optional)" rows={2} />{manualSections.length > 1 && <button className="text-button" type="button" onClick={() => setManualSections((sections) => sections.filter((_, sectionIndex) => sectionIndex !== index))}>Remove section</button>}</fieldset>)}<button className="btn" type="button" onClick={() => setManualSections((sections) => [...sections, { title: `Section ${sections.length + 1}`, chords: "", lyrics: "", tab: "" }])}>Add section</button><button className="btn primary" type="submit">Save custom song</button></form>
        <div className="library-management-card"><div className="card-heading"><div><span className="label">Practice queues</span><h2>Drag songs into order</h2></div><span><button className="btn" type="button" onClick={addQueue}>New queue</button> <button className="btn" type="button" onClick={makeRecommendedQueue}>Smart plan</button></span></div>{state.practiceQueues.length ? state.practiceQueues.map((queue) => <div className="queue-card" key={queue.id}><strong>{queue.name}</strong><small className="muted">{queue.songIds.length} songs · {queue.targetDurationMinutes ?? 30} min target{queue.name.toLowerCase().includes("smart") ? " · balanced weak/new/review" : ""}</small>{queue.songIds.map((songID, index) => <div className="queue-row" draggable key={songID} onDragStart={(event) => event.dataTransfer.setData("text/song-id", songID)} onDrop={(event) => { event.preventDefault(); const dragged = event.dataTransfer.getData("text/song-id"); if (dragged && dragged !== songID) { const from = queue.songIds.indexOf(dragged); const to = queue.songIds.indexOf(songID); const songIds = [...queue.songIds]; songIds.splice(from, 1); songIds.splice(to, 0, dragged); updateState({ ...state, practiceQueues: state.practiceQueues.map((item) => item.id === queue.id ? { ...item, songIds, updatedAt: new Date().toISOString() } : item) }); } }} onDragOver={(event) => event.preventDefault()}><span>{index + 1}. {allSongs.find((song) => song.id === songID)?.title ?? "Missing song"}</span><span><button className="text-button" type="button" onClick={() => moveQueueSong(queue.id, songID, -1)} aria-label="Move song up">↑</button> <button className="text-button" type="button" onClick={() => moveQueueSong(queue.id, songID, 1)} aria-label="Move song down">↓</button></span></div>)}<button className="text-button" type="button" onClick={() => { setQueueId(queue.id); const first = allSongs.find((song) => song.id === queue.songIds[0]); if (first) { setSelectedId(first.id); setSelectedVariationId(queue.songIds[0] ? first.variations[0]?.id ?? "" : ""); } }}>Launch first song</button></div>) : <p className="muted">Create a queue, then add songs from the detail panel.</p>}</div>
        <form className="library-management-card" onSubmit={createSetlist}><div className="card-heading"><div><span className="label">Setlists</span><h2>Plan a seamless live run</h2></div></div><div className="two-inputs"><input aria-label="Setlist name" value={setlistName} onChange={(event) => setSetlistName(event.target.value)} placeholder="Setlist name" /><input aria-label="Target duration minutes" type="number" min="5" max="360" value={setlistDuration} onChange={(event) => setSetlistDuration(event.target.value)} placeholder="Target minutes" /></div><div className="two-inputs"><input aria-label="Capo and tuning change notes" value={setlistChangeNotes} onChange={(event) => setSetlistChangeNotes(event.target.value)} placeholder="Capo/tuning change notes (optional)" /><input aria-label="Between-song change break seconds" type="number" min="0" max="600" value={setlistBreakSeconds} onChange={(event) => setSetlistBreakSeconds(event.target.value)} placeholder="Change break seconds" /></div><p className="muted">Duration estimates include each song plus configured capo/tuning change breaks. Start the first song from the selected setlist below.</p><button className="btn primary" type="submit" disabled={!permissions.canManageSetlists}>Create from selected queue</button>{state.setlists.filter((setlist) => showArchived || !setlist.archivedAt).map((setlist) => { const timeline = estimateSetlistTimeline(setlist, allSongs); return <div className="setlist-row" key={setlist.id}><span><strong>{setlist.name}{setlist.archivedAt ? " · archived" : ""}</strong><small>{setlist.entries.length} songs · estimated {timeline.totalMinutes} min · {timeline.breakMinutes} min change breaks{setlist.entries[0]?.changeNotes ? ` · ${setlist.entries[0].changeNotes}` : ""}</small></span><span><button className="text-button" type="button" onClick={() => launchSetlist(setlist)}>Launch</button> <button className="text-button" type="button" onClick={() => updateState(archiveSetlist(state, setlist.id, !setlist.archivedAt), `${setlist.archivedAt ? "Restored" : "Archived"} setlist`, "archive")}>{setlist.archivedAt ? "Unarchive" : "Archive"}</button></span></div>; })}{selectedSetlistTimeline && <p className="muted">Selected queue preview: {selectedSetlistTimeline.totalMinutes} min total · {selectedSetlistTimeline.songMinutes} min songs · {selectedSetlistTimeline.breakMinutes} min breaks.</p>}</form>
        <div className="library-management-card"><span className="label">Practice modes</span><h2>Make practice more accessible</h2><label><input type="checkbox" checked={state.preferences.largePrint} onChange={() => updatePreference("largePrint")} /> Large-print Song Coach</label><label><input type="checkbox" checked={state.preferences.handsFree} onChange={() => updatePreference("handsFree")} /> Hands-free controls, voice, and MIDI pedal</label><label><input type="checkbox" checked={state.preferences.simplifyMode} onChange={() => updatePreference("simplifyMode")} /> Simplify mode · easier substitutions, reduced rhythm, 75% BPM</label><p className="muted">Simplify mode is a practice aid; it does not overwrite the source arrangement.</p></div>
      </section>
      <section className="song-library-bottom-grid">
        <div className="library-management-card"><span className="label">Weekly recap</span><h2>{weeklyRecapData.sessions} sessions · {weeklyRecapData.minutes} min</h2><p className="muted">{weeklyRecapData.completedSongs.length ? `Completed: ${weeklyRecapData.completedSongs.map((song) => song.title).join(", ")}` : "Complete a practice session to start your recap."}</p><p className="muted">Improving sections: {weeklyRecapData.improvingSections.length ? weeklyRecapData.improvingSections.map((item) => `${allSongs.find((song) => song.id === item.songId)?.title ?? "Song"} · ${item.mastery}%`).join(", ") : "Keep logging mastery to see trends."}</p><strong>Recommended next: {state.practiceQueues.find((queue) => queue.name.toLowerCase().includes("smart"))?.name ?? "Create a smart plan"}</strong></div>
        <div className="library-management-card"><div className="card-heading"><div><span className="label">Offline lead sheet</span><h2>Export or import a preset</h2></div><button className="btn" type="button" onClick={() => window.print()}>Print lead sheet</button></div><p className="muted">ChordPro and plain-text tab stay local and work offline. MusicXML is gated to licensed files only; no protected content is scraped.</p><div className="two-inputs"><select aria-label="Preset format" value={presetFormat} onChange={(event) => setPresetFormat(event.target.value as typeof presetFormat)}><option value="chordpro">ChordPro</option><option value="plain-tab">Plain-text tab</option><option value="musicxml">MusicXML (licensed only)</option></select><label className="checkbox-label"><input type="checkbox" checked={licensedMusicXml} onChange={(event) => setLicensedMusicXml(event.target.checked)} /> I have rights for MusicXML</label></div><div className="preset-actions"><button className="btn" type="button" onClick={exportPreset}>Export preset</button><label className="btn">Import preset<input type="file" accept={presetFormat === "musicxml" ? ".musicxml,.xml" : ".txt,.pro,.chopro"} hidden onChange={importPreset} /></label></div></div>
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
