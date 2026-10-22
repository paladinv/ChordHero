"use client";

import SongBuilderTimeline from "./SongBuilderTimeline";
import SongBuilderStudio, { type BuilderWorkspace } from "./SongBuilderStudio";
import SongBuilderRecorder from "./SongBuilderRecorder";
import SongBuilderFeedback from "./SongBuilderFeedback";
import { readPortableSong, writeAcrossBars } from "@/lib/songBuilderStudio";
import { extractMusicXml } from "@/lib/songBuilderZip";
import SongBuilderTools, { type PracticeSettings, type ScoreSettings } from "./SongBuilderTools";
import { createTemplate, suggestHarmonicChords, syncLinkedSections, TEMPLATES, type BuilderTemplate } from "@/lib/songBuilderEditing";
import { exportMidi, exportMusicXml, importMidi, importMusicXml } from "@/lib/songBuilderExchange";
import LocalizedCopy from "./LocalizedCopy";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { CHORD_LOOKUP } from "@/lib/chords";
import { normalizeComposition, createManualSong, readSongLibraryState, writeSongLibraryState, type LibrarySong, type SongComposition, type SongCompositionEvent, type SongCompositionMeasure, type SongCompositionSection, type SongCompositionTrack, type SongInstrument, type SongLibraryState, type SongSection } from "@/lib/songLibrary";
import { barBeatSeconds, barSecondsBeat, addCompositionMeasure, addCompositionSection, addCompositionTrack, addOrRemoveEvent, buildSongTimeline, createSongComposition, duplicateCompositionSection, measureClickCount, measureCount, measureQuarterBeats, measureStepCount, meterParts, midiNoteLabel, parseTuningNotes, removeCompositionMeasure, removeCompositionSection, removeCompositionTrack, reorderCompositionSection, SONG_BUILDER_DRUMS, songBuilderDrumName, SONG_BUILDER_KEYS, SONG_BUILDER_METERS, SONG_BUILDER_SUBDIVISIONS, SONG_BUILDER_TUNINGS, updateTrackTuning, type SongTimeline, type TimelineBar } from "@/lib/songBuilder";
import { createSongBuilderAudio, type SongBuilderAudio } from "@/lib/songBuilderAudio";
import { BUILDER_SHEET_HEIGHT, BUILDER_SHEET_WIDTH, canvasPng, canvasesPdf, drawNotationPage, makeLongPng, renderNotationPages, renderLeadSheetPages, notationPageGroups, type NotationView } from "@/lib/songBuilderExport";

type PlaybackState = "idle" | "loading" | "count-in" | "playing" | "paused" | "finished";
type PlaybackPosition = { barIndex: number; sectionId: string; measureIndex: number; fraction: number; beat: number };
type MeterCue = { at: number; accent: boolean };

const UID = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const safeName = (value: string) => value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "chord-hero-song";
const DURATIONS = [
  { value: 1, label: "Quarter" },
  { value: 0.5, label: "Eighth" },
  { value: 1 / 3, label: "Triplet eighth" },
  { value: 0.25, label: "Sixteenth" },
  { value: 2, label: "Half" },
  { value: 4, label: "Whole" },
  { value: 1.5, label: "Dotted quarter" },
  { value: 0.75, label: "Dotted eighth" },
  { value: 0.4, label: "Quintuplet eighth" },
  { value: 2 / 7, label: "Septuplet eighth" },
];
const INSTRUMENTS: SongInstrument[] = ["guitar", "ukulele", "bass", "piano", "vocals", "percussion"];
const isFrettedInstrument = (instrument: SongInstrument) => instrument === "guitar" || instrument === "ukulele" || instrument === "bass";

function libraryVoicing(track: SongCompositionTrack, chord: string): Array<number | null> | undefined {
  const isStandardGuitar = track.instrument === "guitar" && track.tuning.join(",") === "40,45,50,55,59,64";
  return isStandardGuitar ? CHORD_LOOKUP.get(chord)?.frets.map((fret) => fret < 0 ? null : fret) : undefined;
}

function createMeasures(count: number): SongCompositionMeasure[] {
  return Array.from({ length: count }, (_, index) => ({ id: UID(`measure-${index + 1}`), events: [] }));
}

function compositionFromSong(song: LibrarySong): SongComposition {
  if (song.composition) return song.composition;
  const composition = createSongComposition(song.key || "C", song.bpm || 90, song.timeSignature || "4/4");
  const track = composition.tracks[0];
  const importedSections = song.sections.length ? song.sections : [{ id: UID("section"), title: "Verse", blocks: [] as SongSection["blocks"] }];
  composition.sections = importedSections.slice(0, 64).map((source, sectionIndex) => {
    const chords = source.blocks.filter((block) => block.type === "chords").flatMap((block) => block.chords ?? []).slice(0, 128);
    const count = Math.max(4, chords.length);
    const measures = createMeasures(count);
    chords.forEach((chord, index) => { measures[index].events.push({ id: UID("event"), kind: "chord", chord, startBeat: 0, durationBeats: measureQuarterBeats(song.timeSignature || "4/4") }); });
    const lyrics = source.blocks.filter((block) => block.type === "lyrics").map((block) => block.text ?? "").join("\n");
    const notes = source.blocks.filter((block) => block.type === "annotation").map((block) => block.text ?? "").join("\n");
    return {
      id: source.id || UID(`section-${sectionIndex + 1}`), title: source.title || `Section ${sectionIndex + 1}`, kind: source.kind || "other", repeats: 1,
      lyrics, notes, measuresByTrack: { [track.id]: measures },
    };
  });
  return composition;
}

function librarySections(composition: SongComposition): SongSection[] {
  return composition.sections.map((section) => {
    const chords = composition.tracks.flatMap((track) => section.measuresByTrack[track.id] ?? [])
      .flatMap((measure) => measure.events.filter((event) => event.kind === "chord").map((event) => event.chord ?? ""))
      .filter(Boolean);
    const tabTracks = composition.tracks.filter((track) => (section.measuresByTrack[track.id] ?? []).some((measure) => measure.events.some((event) => event.kind === "note")));
    const tabLines = tabTracks.map((track) => {
      const notes = (section.measuresByTrack[track.id] ?? []).flatMap((measure) => measure.events.filter((event) => event.kind === "note").map((event) => event.string ? `s${event.string}f${event.fret}` : `midi:${event.midiPitches?.map((pitch) => track.instrument === "percussion" ? songBuilderDrumName(pitch) : String(pitch)).join("+") ?? "?"}`));
      return `${track.name}: ${notes.join(" ")}`;
    });
    return {
      id: section.id,
      title: section.title,
      kind: section.kind,
      blocks: [
        ...(section.lyrics?.trim() ? [{ type: "lyrics" as const, text: section.lyrics.trim() }] : []),
        ...(chords.length ? [{ type: "chords" as const, chords }] : []),
        ...(tabLines.length ? [{ type: "tab" as const, lines: tabLines }] : []),
        ...(section.notes?.trim() ? [{ type: "annotation" as const, text: section.notes.trim() }] : []),
      ],
    };
  });
}

function eventAtStep(measure: SongCompositionMeasure | undefined, step: number, subdivision: number) {
  if (!measure) return undefined;
  const beat = step * 4 / subdivision;
  return measure.events.find((event) => Math.abs(event.startBeat - beat) < 0.0001);
}

function timelineMetronome(timeline: SongTimeline): MeterCue[] {
  return timeline.bars.flatMap((bar) => {
    const { denominator } = meterParts(bar.meter);
    const pulseBeats = 4 / denominator;
    return Array.from({ length: measureClickCount(bar.meter) }, (_, index) => ({ at: bar.startsAt + barBeatSeconds(bar, index * pulseBeats), accent: index === 0 })).filter((cue) => cue.at >= 0 && cue.at < bar.startsAt + bar.duration - 0.00001);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function SongBuilder() {
  const [workspace,setWorkspace] = useState<BuilderWorkspace>("compose");
  const [libraryOpen,setLibraryOpen] = useState(false);
  const [guideStep,setGuideStep] = useState<number|null>(null);
  const guidedSongRef = useRef("");
  const scoreDragRef = useRef<number|null>(null);
  const scoreRangeSelectedRef = useRef(false);
  const [template, setTemplate] = useState<BuilderTemplate>("Blank");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedBeat, setSelectedBeat] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [practice, setPractice] = useState<PracticeSettings>({ enabled: false, start: 1, end: 4, beat: 1, countIn: true, increase: 0, maximum: 120 });
  const [score, setScore] = useState<ScoreSettings>({ barsPerLine: 4, trackId: "", diagrams: false, sectionBreaks: false, paper: "letter", orientation: "landscape" });
  const historyRef = useRef(new Map<string, { past: LibrarySong[]; future: LibrarySong[] }>());
  const [, setHistoryTick] = useState(0);
  const practiceRef = useRef(practice);
  const playbackTempoRef = useRef(100);
  const rangeAnchorRef = useRef<number | null>(null);
  useEffect(() => { practiceRef.current = practice; }, [practice]);
  const [library, setLibrary] = useState<SongLibraryState | null>(null);
  const libraryRef = useRef<SongLibraryState | null>(null);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [activeSectionId, setActiveSectionId] = useState("");
  const [activeTrackId, setActiveTrackId] = useState("");
  const [activeMeasureIndex, setActiveMeasureIndex] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [artistDraft, setArtistDraft] = useState("");
  const [eventMode, setEventMode] = useState<"chord" | "note" | "rest">("chord");
  const [chordQuery, setChordQuery] = useState("C");
  const [voicingDraft, setVoicingDraft] = useState<Array<number | null>>([]);
  const [voicingEdited, setVoicingEdited] = useState(false);
  const [noteString, setNoteString] = useState(1);
  const [noteFret, setNoteFret] = useState(0);
  const [midiPitchDraft, setMidiPitchDraft] = useState(60);
  const [duration, setDuration] = useState(1);
  const [accentNext, setAccentNext] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackPosition, setPlaybackPosition] = useState<PlaybackPosition | null>(null);
  const [countIn, setCountIn] = useState(0);
  const [playbackScope, setPlaybackScope] = useState("song");
  const [previewScope, setPreviewScope] = useState("song");
  const [playbackTempo, setPlaybackTempo] = useState(100);
  const [hearTracks, setHearTracks] = useState(true);
  const [metronome, setMetronome] = useState(true);
  const [loop, setLoop] = useState(false);
  const [notationView, setNotationView] = useState<NotationView>("tab");
  const [page, setPage] = useState(0);
  const [customTuningDraft, setCustomTuningDraft] = useState("");
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("Changes save on this device.");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<SongBuilderAudio | null>(null);
  const timerRef = useRef<number | null>(null);
  const timelineRef = useRef<SongTimeline | null>(null);
  const liveTracksRef = useRef<SongCompositionTrack[]>([]);
  const metronomeCuesRef = useRef<MeterCue[]>([]);
  const startedAtRef = useRef(0);
  const countInStartRef = useRef(0);
  const countInSecondsRef = useRef(0);
  const countInBeatDurationRef = useRef(0);
  const savedCountRemainingRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  const nextEventRef = useRef(0);
  const nextClickRef = useRef(0);
  const lastCountBeatRef = useRef(-1);
  const lastPositionAtRef = useRef(0);
  const lastLoopRef = useRef(0);
  const playbackOptionsRef = useRef({ hearTracks, metronome, loop });

  useEffect(() => { playbackOptionsRef.current = { hearTracks, metronome, loop }; }, [hearTracks, metronome, loop]);

  useEffect(() => {
    try { if (!localStorage.getItem("chord-builder-guide-seen")) setGuideStep(0); } catch {}
    const stored = readSongLibraryState();
    libraryRef.current = stored;
    setLibrary(stored);
    let lastSong="";try{lastSong=localStorage.getItem("chord-builder-last-song")??"";}catch{}
    const requested = new URLSearchParams(window.location.search).get("songId") || lastSong;
    const requestedSong = requested ? stored.songs.find((song) => song.id === requested) : undefined;
    const first = requestedSong ?? stored.songs.slice().reverse().find((song) => song.composition) ?? stored.songs.find((song) => song.origin === "manual");
    if (first) {
      setSelectedSongId(first.id);
      setActiveSectionId(first.composition?.sections[0]?.id ?? "");
      setActiveTrackId(first.composition?.tracks[0]?.id ?? "");
    }
  }, []);

  useEffect(()=>{if(selectedSongId)try{localStorage.setItem("chord-builder-last-song",selectedSongId);}catch{}},[selectedSongId]);

  const songs = useMemo(() => (library?.songs ?? []).filter((song) => song.origin === "manual" || Boolean(song.composition)).slice().reverse(), [library]);
  const song = songs.find((item) => item.id === selectedSongId);
  const composition = song?.composition;
  const recordingSignature=useMemo(()=>composition?JSON.stringify(normalizeComposition(composition)):"",[composition]);
  const section = composition?.sections.find((item) => item.id === activeSectionId) ?? composition?.sections[0];
  const track = composition?.tracks.find((item) => item.id === activeTrackId) ?? composition?.tracks[0];
  const selectedSongIdValue = song?.id ?? "";
  const selectedSongTitle = song?.title ?? "";
  const selectedSongArtist = song?.artist ?? "";
  const selectedTrackId = track?.id ?? "";
  const selectedTrackTuning = track?.tuning.map(midiNoteLabel).join(" ") ?? "";
  const selectedTrackTuningKey = track?.tuning.join(",") ?? "";
  const selectedTrackCapo = track?.capo ?? 0;
  const matchingTuningPreset = track ? SONG_BUILDER_TUNINGS[track.instrument].find((preset) => preset.midi.join(",") === track.tuning.join(",")) : undefined;
  const isCustomTuning = Boolean(track && (track.tuningLabel.startsWith("Custom") || !matchingTuningPreset));
  const sectionMeasures = section && track ? section.measuresByTrack[track.id] ?? [] : [];
  const activeMeasure = sectionMeasures[activeMeasureIndex];
  const meter = section?.timeSignature || composition?.timeSignature || "4/4";
  const stepCount = Math.max(1,Math.ceil((activeMeasure?.beats??measureQuarterBeats(meter))*(composition?.subdivision??8)/4));
  const queryChords = useMemo(() => [...CHORD_LOOKUP.keys()].filter((name) => name.toLowerCase().includes(chordQuery.trim().toLowerCase())).slice(0, 16), [chordQuery]);
  const displayedVoicing = track ? (voicingEdited
    ? Array.from({ length: track.tuning.length }, (_, index) => voicingDraft[index] ?? null)
    : libraryVoicing(track, chordQuery)) : undefined;
  const notationTimeline = useMemo(() => song ? buildSongTimeline(song, previewScope === "song" ? undefined : previewScope) : { bars: [], events: [], duration: 0 }, [song, previewScope]);
  const playbackTimeline = useMemo(() => song ? buildSongTimeline(song, playbackScope === "song" ? undefined : playbackScope) : { bars: [], events: [], duration: 0 }, [song, playbackScope]);
  const feedbackBar = playbackPosition ? playbackTimeline.bars.find((item) => item.index === playbackPosition.barIndex) : undefined;
  const feedbackTime = feedbackBar && playbackPosition ? feedbackBar.startsAt + barBeatSeconds(feedbackBar, playbackPosition.beat) : 0;
  const feedbackCue = feedbackBar ? feedbackBar.events.filter((cue) => cue.pitches.length && cue.track.instrument !== "percussion" && !cue.track.muted && (!composition?.tracks.some((item) => item.solo) || cue.track.solo)).sort((left, right) => left.at - right.at).find((cue) => cue.at + cue.duration >= feedbackTime - 0.08) : undefined;
  const notationPages = useMemo(() => song ? notationPageGroups(song, notationTimeline.bars, notationView, score) : [], [song, notationTimeline.bars, notationView, score]);
  const pageCount = Math.max(1, notationPages.length);
  const followPage = playbackPosition && ["playing", "count-in", "paused"].includes(playbackState) ? notationPages.findIndex((blocks) => blocks.some((block) => block.bars.some((bar) => bar.index === playbackPosition.barIndex))) : -1;
  const boundedPage = Math.max(0, Math.min(followPage >= 0 ? followPage : page, pageCount - 1));
  const previewPosition = playbackPosition && playbackScope === previewScope ? playbackPosition : null;
  const availableInstruments = composition && composition.tracks.length >= 15 ? [] : INSTRUMENTS;

  useEffect(() => {
    if (track?.instrument === "percussion") { setEventMode("note"); setMidiPitchDraft(36); }
  }, [selectedTrackId, track?.instrument]);

  useEffect(() => {
    setTitleDraft(selectedSongTitle);
    setArtistDraft(selectedSongArtist);
  }, [selectedSongIdValue, selectedSongTitle, selectedSongArtist]);

  useEffect(() => {
    setCustomTuningDraft(selectedTrackTuning);
  }, [selectedTrackId, selectedTrackTuning]);

  useEffect(() => {
    setVoicingEdited(false);
    setVoicingDraft([]);
  }, [chordQuery, selectedTrackId, selectedTrackTuningKey, selectedTrackCapo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !song) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    try {
      const pageCanvas = drawNotationPage(song, notationTimeline.bars, notationView, boundedPage, previewPosition, score);
      canvas.width = BUILDER_SHEET_WIDTH;
      canvas.height = BUILDER_SHEET_HEIGHT;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(pageCanvas, 0, 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not draw the notation preview.");
    }
  }, [song, notationTimeline, notationView, boundedPage, previewPosition, score]);

  function stopClock() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopPlayback() {
    stopClock();
    audioRef.current?.stop();
    setPlaybackState("idle");
    setPlaybackPosition(null);
    setCountIn(0);
    timelineRef.current = null;
    nextEventRef.current = 0;
    nextClickRef.current = 0;
    lastLoopRef.current = 0;
    savedCountRemainingRef.current = 0;
    pausedElapsedRef.current = 0;
  }

  useEffect(() => { const release = () => { rangeAnchorRef.current = null; }; window.addEventListener("pointerup", release); return () => window.removeEventListener("pointerup", release); }, []);

  useEffect(() => () => {
    stopClock();
    audioRef.current?.close();
  }, []);

  function persistSong(updatedSong: LibrarySong, recordHistory = true) {
    const current = libraryRef.current;
    if (!current) return;
    const oldSong = current.songs.find((item) => item.id === updatedSong.id);
    const withoutMix = (value: SongComposition | undefined) => value ? { ...value, tracks: value.tracks.map(({ volume, pan, solo, muted, sound, reverb, ...track }) => track) } : value;
    const mixOnly = oldSong?.id === updatedSong.id && JSON.stringify(withoutMix(oldSong.composition)) === JSON.stringify(withoutMix(updatedSong.composition));
    if (["playing", "count-in", "loading", "paused"].includes(playbackState) && !mixOnly) stopPlayback();
    if (updatedSong.composition) { liveTracksRef.current = updatedSong.composition.tracks; audioRef.current?.updateMix(updatedSong.composition.tracks); }
    const previous = current.songs.find((item) => item.id === updatedSong.id);
    if (recordHistory && previous) {
      const history = historyRef.current.get(previous.id) ?? { past: [], future: [] };
      history.past = [...history.past, previous].slice(-60); history.future = [];
      historyRef.current.set(previous.id, history); setHistoryTick((tick) => tick + 1);
    }
    let revisions = updatedSong.builderRevisions ?? [];
    const lastAuto = revisions.filter((item) => item.name === "Autosave").at(-1);
    if (previous?.composition && recordHistory && (!lastAuto || Date.now() - Date.parse(lastAuto.savedAt) >= 30000)) {
      revisions = [...revisions, { id: UID("revision"), name: "Autosave", savedAt: new Date().toISOString(), composition: previous.composition }].slice(-20);
    }
    const nextSong = { ...updatedSong, builderRevisions: revisions, updatedAt: new Date().toISOString() };
    const next = { ...current, songs: [...current.songs.filter((item) => item.id !== nextSong.id), nextSong] };
    libraryRef.current = next;
    setLibrary(next);
    try {
      writeSongLibraryState(next);
      setSaveMessage("All changes saved on this device.");
    } catch {
      setSaveMessage("Storage is full. Export a Song Library backup before continuing.");
    }
  }

  function applySyncedLibrary(nextLibrary: SongLibraryState) {
    stopPlayback();
    const normalized = nextLibrary;
    libraryRef.current = normalized;
    setLibrary(normalized);
    try { writeSongLibraryState(normalized); setSaveMessage("Synced library saved on this device."); }
    catch { setSaveMessage("The synced library exceeds this browser’s storage. Download a backup before editing."); }
  }

  function saveComposition(nextComposition: SongComposition) {
    if (!song) return;
    const latest = libraryRef.current?.songs.find((item) => item.id === song.id) ?? song;
    // Edits made through a linked occurrence update its original section.
    let linked = nextComposition;
    for (const item of nextComposition.sections.filter((entry) => entry.linkedTo)) {
      const old = composition?.sections.find((entry) => entry.id === item.id);
      const oldSource = composition?.sections.find((entry) => entry.id === item.linkedTo);
      const source = linked.sections.find((entry) => entry.id === item.linkedTo);
      if (old && source && JSON.stringify(source.measuresByTrack) === JSON.stringify(oldSource?.measuresByTrack) && JSON.stringify(old.measuresByTrack) !== JSON.stringify(item.measuresByTrack)) linked = { ...linked, sections: linked.sections.map((entry) => entry.id === source.id ? { ...entry, measuresByTrack: item.measuresByTrack } : entry) };
    }
    nextComposition = syncLinkedSections(linked);
    const nextSong = { ...latest, key: nextComposition.key, bpm: nextComposition.bpm, timeSignature: nextComposition.timeSignature, composition: nextComposition, sections: librarySections(nextComposition) };
    persistSong(nextSong);
  }

  function updateComposition(change: (current: SongComposition) => SongComposition) {
    if (!composition) return;
    saveComposition(change(composition));
  }

  function createSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim() || !newArtist.trim()) return;
    const comp = createTemplate(template);
    const base = createManualSong({ title: newTitle.trim(), artist: newArtist.trim(), key: comp.key, timeSignature: comp.timeSignature, bpm: comp.bpm, chords: [] });
    const fresh = { ...base, sections: librarySections(comp), composition: comp };
    persistSong(fresh);
    setSelectedSongId(fresh.id);
    setSelectedEventId(""); setPractice((current) => ({ ...current, enabled: false })); setScore((current) => ({ ...current, trackId: "" }));
    setActiveSectionId(comp.sections[0].id);
    setActiveTrackId(comp.tracks[0].id);
    setActiveMeasureIndex(0);
    setNewTitle("");
    setNewArtist("");
    setMessage("New song created. Add a chord or a note to start composing.");
  }

  function openSong(selected: LibrarySong) {
    stopPlayback();
    setSelectedSongId(selected.id);
    setSelectedEventId(""); setPractice((current) => ({ ...current, enabled: false })); setScore((current) => ({ ...current, trackId: "" }));
    const comp = compositionFromSong(selected);
    setActiveSectionId(comp.sections[0]?.id ?? "");
    setActiveTrackId(comp.tracks[0]?.id ?? "");
    setActiveMeasureIndex(0);
    setPreviewScope("song");
    setPlaybackScope("song");
    if (!selected.composition) {
      persistSong({ ...selected, composition: comp, sections: librarySections(comp) });
      setMessage("Song opened as an editable arrangement.");
    }
  }

  function updateSongField(field: "title" | "artist", value: string) {
    if (!song) return;
    const updated = { ...song, [field]: value.trim() || (field === "title" ? song.title : song.artist) };
    if (field === "title") setTitleDraft(value); else setArtistDraft(value);
    if (value.trim() && value.trim() !== song[field]) persistSong(updated);
  }

  function toggleGridEvent(step: number) {
    if (!composition || !section || !track) return;
    const startBeat = step * 4 / composition.subdivision;
    setSelectedBeat(startBeat);
    const existing = eventAtStep(activeMeasure, step, composition.subdivision);
    if (existing) { setSelectedEventId(existing.id); setMessage("Event selected. Open Composition tools to change its settings or delete it."); return; }
    setSelectedEventId("");
    if (track.instrument === "percussion" && eventMode === "chord") {
      setMessage("Percussion parts use individual drum hits. Choose a drum sound from the pitch list.");
      return;
    }
    const base = { id: UID("event"), startBeat, durationBeats: duration, accent: accentNext, tuplet: Math.abs(duration - 1 / 3) < 0.001 ? 3 : Math.abs(duration - 0.4) < 0.001 ? 5 : Math.abs(duration - 2 / 7) < 0.001 ? 7 : undefined };
    let nextEvent: SongCompositionEvent;
    if (eventMode === "chord") {
      const chord = chordQuery.trim();
      if (!CHORD_LOOKUP.has(chord) && !/^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus[24]?|add\d|\d|°|\+)?(?:\/[A-G](?:#|b)?)?$/.test(chord)) {
        setMessage("Choose a chord from the chord suggestions.");
        return;
      }
      const voicing = voicingEdited ? voicingDraft.slice(0, track.tuning.length) : libraryVoicing(track, chord);
      nextEvent = { ...base, kind: "chord", chord, voicing };
    } else if (eventMode === "rest") {
      nextEvent = { ...base, kind: "rest" };
    } else {
      nextEvent = isFrettedInstrument(track.instrument) ? { ...base, kind: "note", string: noteString, fret: noteFret } : { ...base, kind: "note", midiPitches: [midiPitchDraft] };
    }
    const next = writeAcrossBars(composition, section.id, track.id, activeMeasureIndex, nextEvent);
    saveComposition(next);
    setSelectedEventId(nextEvent.id);
    setAccentNext(false);
  }

  function captureNote(note: { pitch: number | number[]; startBeat: number; durationBeats: number; velocity: number; sectionId: string; trackId: string; measureIndex: number }) {
    const latest = libraryRef.current?.songs.find((item) => item.id === selectedSongId)?.composition ?? composition;
    const targetSection = latest?.sections.find((item) => item.id === note.sectionId);
    const targetTrack = latest?.tracks.find((item) => item.id === note.trackId);
    if (!latest || !targetSection || !targetTrack) { setMessage("The selected section or track changed before the captured note could be added."); return; }
    let measureIndex = Math.max(0, note.measureIndex);
    const startBeat = note.startBeat;
    try {
      const pitches = Array.isArray(note.pitch) ? [...new Set(note.pitch)].slice(0, 12) : [note.pitch];
      const eventPitches = !isFrettedInstrument(targetTrack.instrument) && targetTrack.instrument !== "percussion" && pitches.length > 1 ? [pitches] : pitches.map((pitch) => [pitch]);
      let next = latest;
      let firstEvent: SongCompositionEvent | undefined;
      for (const chordPitches of eventPitches) {
        const pitch = chordPitches[0];
        const playable = isFrettedInstrument(targetTrack.instrument) ? targetTrack.tuning.map((open, index) => ({ string: targetTrack.tuning.length - index, fret: pitch - open - targetTrack.capo })).filter((position) => position.fret >= 0 && position.fret <= 24).sort((left, right) => left.fret - right.fret)[0] : undefined;
        const event: SongCompositionEvent = { id: UID("captured-note"), kind: "note", startBeat, durationBeats: note.durationBeats, midiPitches: chordPitches, velocity: note.velocity, ...(playable ? { string: playable.string, fret: playable.fret } : {}) };
        if (!firstEvent) firstEvent = event;
        next = writeAcrossBars(next, note.sectionId, note.trackId, measureIndex, event);
      }
      measureIndex = next.sections.find((item) => item.id === note.sectionId)?.measuresByTrack[note.trackId]?.findIndex((bar) => bar.events.some((item) => item.id === firstEvent?.id)) ?? measureIndex;
      const inserted = next.sections.find((item) => item.id === note.sectionId)?.measuresByTrack[note.trackId]?.[measureIndex]?.events.find((item) => item.id === firstEvent?.id);
      saveComposition(next);
      setActiveSectionId(note.sectionId);
      setActiveTrackId(note.trackId);
      setActiveMeasureIndex(measureIndex);
      setSelectedEventId(firstEvent?.id ?? "");
      setMessage(`${pitches.map(midiNoteLabel).join(" + ")} ${pitches.length > 1 ? "chord tones" : "note"} added to ${targetTrack.name} at bar ${measureIndex + 1}, beat ${Number(((inserted?.startBeat ?? startBeat) + 1).toFixed(2))}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add the captured note.");
    }
  }

  function createSection() {
    if (!composition) return;
    if (composition.sections.length >= 64) { setMessage("A composition supports up to 64 sections."); return; }
    const next = addCompositionSection(composition, "New section");
    saveComposition(next);
    setActiveSectionId(next.sections.at(-1)?.id ?? "");
    setActiveMeasureIndex(0);
  }

  function addTrack(instrument: SongInstrument) {
    if (!composition || composition.tracks.length >= 15) return;
    const next = addCompositionTrack(composition, instrument);
    saveComposition(next);
    setActiveTrackId(next.tracks.at(-1)?.id ?? "");
    setSelectedEventId("");
  }

  function updateTrack(trackId: string, change: (current: SongCompositionTrack) => SongCompositionTrack) {
    if (!composition) return;
    updateComposition((current) => ({ ...current, tracks: current.tracks.map((item) => item.id === trackId ? change(item) : item) }));
  }

  function updateSection(sectionId: string, change: (current: SongCompositionSection) => SongCompositionSection) {
    if (!composition) return;
    updateComposition((current) => {
      const selected = current.sections.find((item) => item.id === sectionId);
      if (!selected) return current;
      const changed = change(selected);
      const occurrenceFields = { title: changed.title, repeats: changed.repeats, linkedTo: changed.linkedTo, pageBreak: changed.pageBreak };
      return { ...current, sections: current.sections.map((item) => item.id === sectionId ? { ...changed, ...occurrenceFields } : selected.linkedTo === item.id && changed.linkedTo ? { ...item, bpm: changed.bpm, timeSignature: changed.timeSignature, kind: changed.kind, notes: changed.notes, lyrics: changed.lyrics } : item) };
    });
  }

  function clearMeasure() {
    if (!composition || !section || !track || !activeMeasure) return;
    updateComposition((current) => ({ ...current, sections: current.sections.map((item) => item.id !== section.id ? item : {
      ...item, measuresByTrack: { ...item.measuresByTrack, [track.id]: (item.measuresByTrack[track.id] ?? []).map((measure, index) => index === activeMeasureIndex ? { ...measure, events: [] } : measure) },
    }) }));
  }

  function moveScoreEvent(sectionId: string, trackId: string, sourceMeasureIndex: number, eventId: string, targetMeasureIndex: number, targetBeat: number) {
    if (!composition) return;
    const occurrence = composition.sections.find((item) => item.id === sectionId);
    const sourceId = occurrence?.linkedTo ?? sectionId;
    const source = composition.sections.find((item) => item.id === sourceId);
    const measure = source?.measuresByTrack[trackId]?.[sourceMeasureIndex];
    const dragged = measure?.events.find((item) => item.id === eventId);
    if (!source || !dragged) return;
    const groupId = dragged.splitGroup ?? dragged.id;
    const sourceMeasures = source.measuresByTrack[trackId] ?? [];
    const pieces = sourceMeasures.flatMap((item) => item.events.filter((event) => event.id === groupId || event.splitGroup === groupId)).sort((left, right) => left.startBeat - right.startBeat);
    const representative = pieces[0] ?? dragged;
    const duration = pieces.reduce((sum, item) => sum + item.durationBeats, 0);
    const finalTie = pieces.at(-1)?.tie ?? false;
    let next: SongComposition = { ...composition, sections: composition.sections.map((item) => item.id !== sourceId ? item : { ...item, measuresByTrack: { ...item.measuresByTrack, [trackId]: (item.measuresByTrack[trackId] ?? []).map((bar) => ({ ...bar, events: bar.events.filter((event) => event.id !== groupId && event.splitGroup !== groupId) })) } }) };
    next = syncLinkedSections(next);
    try {
      next = writeAcrossBars(next, sectionId, trackId, targetMeasureIndex, { ...representative, id: groupId, splitGroup: undefined, tie: finalTie, startBeat: Math.max(0, targetBeat), durationBeats: duration });
      saveComposition(next);
      setActiveSectionId(sectionId); setActiveTrackId(trackId); setActiveMeasureIndex(targetMeasureIndex); setSelectedEventId(groupId); setWorkspace("compose");
      setMessage(`Moved ${representative.kind === "chord" ? representative.chord : representative.kind === "note" ? "note" : "rest"} to bar ${targetMeasureIndex + 1}, beat ${Number((targetBeat + 1).toFixed(2))}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not move that score event."); }
  }

  function makePlaybackCues(timeline: SongTimeline) {
    return timelineMetronome(timeline);
  }

  function tickPlayback() {
    const player = audioRef.current;
    const timeline = timelineRef.current;
    if (!player || !timeline || !timeline.bars.length) return;
    const now = player.context.currentTime;
    const startAt = startedAtRef.current;
    if (now < startAt) {
      setPlaybackState("count-in");
      const elapsed = Math.max(0, now - countInStartRef.current);
      const beatIndex = Math.max(0, Math.min(Math.ceil(countInSecondsRef.current / Math.max(0.01, countInBeatDurationRef.current)) - 1, Math.floor(elapsed / Math.max(0.01, countInBeatDurationRef.current))));
      const beatChanged = beatIndex !== lastCountBeatRef.current;
      if (beatChanged) {
        lastCountBeatRef.current = beatIndex;
        setCountIn(Math.max(1, measureClickCount(timeline.bars[0].meter) - beatIndex));
        if (playbackOptionsRef.current.metronome) player.click(now + 0.01, beatIndex === 0);
      }
      return;
    }
    setPlaybackState("playing");
    const elapsed = now - startAt;
    const looping = playbackOptionsRef.current.loop;
    if (elapsed >= timeline.duration && !looping) {
      const last = timeline.bars.at(-1);
      if (last) setPlaybackPosition({ barIndex: last.index, sectionId: last.sectionId, measureIndex: last.measureIndex, fraction: 1, beat: last.measureBeats });
      stopClock();
      setPlaybackState("finished");
      return;
    }
    const cycle = looping && timeline.duration > 0 ? Math.floor(elapsed / timeline.duration) : 0;
    const localTime = timeline.duration > 0 ? elapsed - cycle * timeline.duration : elapsed;
    if (cycle !== lastLoopRef.current && practiceRef.current.increase > 0 && playbackTempoRef.current < practiceRef.current.maximum) {
      const nextTempo = Math.min(practiceRef.current.maximum, playbackTempoRef.current + practiceRef.current.increase);
      const factor = playbackTempoRef.current / nextTempo;
      timeline.bars = timeline.bars.map((bar) => ({ ...bar, startsAt: bar.startsAt * factor, duration: bar.duration * factor, bpm: bar.bpm / factor, tempoChanges: bar.tempoChanges?.map((mark) => ({ ...mark, bpm: mark.bpm / factor })) }));
      timeline.events = timeline.events.map((cue) => ({ ...cue, at: cue.at * factor, duration: cue.duration * factor })); timeline.duration *= factor;
      metronomeCuesRef.current = makePlaybackCues(timeline); startedAtRef.current = now;
      nextEventRef.current = 0; nextClickRef.current = 0; lastLoopRef.current = 0;
      playbackTempoRef.current = nextTempo; setPlaybackTempo(nextTempo); return;
    }
    if (cycle !== lastLoopRef.current) {
      lastLoopRef.current = cycle;
      nextEventRef.current = 0;
      nextClickRef.current = 0;
    }
    const cycleOffset = cycle * timeline.duration;
    while (nextEventRef.current < timeline.events.length && timeline.events[nextEventRef.current].at <= localTime + 0.12) {
      const cue = timeline.events[nextEventRef.current++];
      const liveTrack = liveTracksRef.current.find((track) => track.id === cue.track.id) ?? cue.track;
      if (cue.at < localTime - 0.075 || !playbackOptionsRef.current.hearTracks || liveTrack.muted || (liveTracksRef.current.some((track) => track.solo) && !liveTrack.solo)) continue;
      const pitches = cue.event.technique === "strum-up" ? [...cue.pitches].reverse() : cue.pitches;
      pitches.forEach((midi, index) => player.play(midi, startAt + cycleOffset + cue.at + (cue.event.kind === "chord" ? index * (cue.event.strumSeconds ?? 0.012) : 0), cue.duration, liveTrack.instrument, cue.event.accent, liveTrack, cue.event.technique, { ...cue.event, targetMidi: cue.event.connectedTo ? timeline.events.find((item) => item.event.id === cue.event.connectedTo && item.track.id === liveTrack.id)?.pitches[0] : undefined }));
    }
    const clicks = metronomeCuesRef.current;
    while (nextClickRef.current < clicks.length && clicks[nextClickRef.current].at <= localTime + 0.12) {
      const cue = clicks[nextClickRef.current++];
      if (cue.at >= localTime - 0.075 && playbackOptionsRef.current.metronome) player.click(startAt + cycleOffset + cue.at, cue.accent);
    }
    const bar = timeline.bars.find((item) => localTime >= item.startsAt && localTime < item.startsAt + item.duration);
    if (bar && now - lastPositionAtRef.current > 0.08) {
      lastPositionAtRef.current = now;
      const barElapsed = localTime - bar.startsAt;
      const beat = barSecondsBeat(bar, barElapsed);
      setPlaybackPosition({ barIndex: bar.index, sectionId: bar.sectionId, measureIndex: bar.measureIndex, fraction: Math.min(1, beat / bar.measureBeats), beat });
    }
  }

  async function startPlayback(settings = practice, scopeOverride = playbackScope, tempoOverride = playbackTempo) {
    if (!song || !composition) return;
    stopPlayback();
    const scope = scopeOverride === "song" ? undefined : scopeOverride;
    let timeline = buildSongTimeline(song, scope, tempoOverride / 100);
    playbackTempoRef.current = tempoOverride;
    if (settings.enabled) {
      const selected = timeline.bars.slice(Math.max(0, settings.start - 1), Math.max(settings.start, settings.end));
      const first = selected[0]; const last = selected.at(-1);
      if (first && last) {
        const offset = first.startsAt + barBeatSeconds(first, Math.min(first.measureBeats - 1 / 96, Math.max(0, settings.beat - 1)));
        const end = last.startsAt + last.duration;
        const events = timeline.events.filter((cue) => cue.at >= offset - 0.0001 && cue.at < end).map((cue) => ({ ...cue, at: cue.at - offset }));
        timeline = { bars: selected.map((bar) => ({ ...bar, startsAt: bar.startsAt - offset })), events, duration: end - offset };
      } else { setMessage("The practice range is outside this song or section."); return; }
    }
    if (!timeline.bars.length || timeline.duration <= 0) { setMessage("Add a section and measure before starting playback."); return; }
    const player = audioRef.current ?? createSongBuilderAudio();
    audioRef.current = player;
    liveTracksRef.current = composition.tracks; player.updateMix(composition.tracks);
    timelineRef.current = timeline;
    metronomeCuesRef.current = makePlaybackCues(timeline);
    setPlaybackState("loading");
    setMessage("Preparing the arrangement…");
    try {
      if (hearTracks) await player.prepare(timeline.events.filter((cue) => !cue.track.muted && cue.track.instrument !== "percussion").flatMap((cue) => cue.pitches), timeline.events.some((cue) => !cue.track.muted && cue.track.instrument === "percussion"), [...new Set(timeline.events.filter((cue) => !cue.track.muted).map((cue) => cue.track.instrument))]);
      else if (player.context.state === "suspended") await player.context.resume();
    } catch {
      setMessage("Audio could not start in this browser. Visual follow-along is still available.");
    }
    if (timelineRef.current !== timeline) return;
    const firstBar = timeline.bars[0];
    const { denominator } = meterParts(firstBar.meter);
    const beatDuration = 60 / firstBar.bpm * 4 / denominator;
    const clickCount = measureClickCount(firstBar.meter);
    countInBeatDurationRef.current = beatDuration;
    countInSecondsRef.current = settings.countIn ? beatDuration * clickCount : 0;
    countInStartRef.current = player.context.currentTime;
    startedAtRef.current = countInStartRef.current + countInSecondsRef.current;
    savedCountRemainingRef.current = 0;
    pausedElapsedRef.current = 0;
    nextEventRef.current = 0;
    nextClickRef.current = 0;
    lastCountBeatRef.current = -1;
    lastPositionAtRef.current = 0;
    lastLoopRef.current = 0;
    setCountIn(clickCount);
    setPreviewScope(scope ?? "song");
    setPage(0);
    setMessage(hearTracks ? "Playing the arrangement. Turn off Hear tracks to follow along silently." : "Follow along with the moving playhead.");
    setPlaybackState("count-in");
    timerRef.current = window.setInterval(() => tickPlayback(), 20);
  }

  function pausePlayback() {
    if (playbackState !== "playing" && playbackState !== "count-in") return;
    const now = audioRef.current?.context.currentTime ?? 0;
    savedCountRemainingRef.current = Math.max(0, startedAtRef.current - now);
    pausedElapsedRef.current = Math.max(0, now - startedAtRef.current);
    stopClock();
    audioRef.current?.stop();
    setPlaybackState("paused");
  }

  function resumePlayback() {
    const player = audioRef.current;
    if (!player || playbackState !== "paused" || !timelineRef.current) return;
    const now = player.context.currentTime;
    if (savedCountRemainingRef.current > 0) {
      const elapsedCount = countInSecondsRef.current - savedCountRemainingRef.current;
      countInStartRef.current = now - elapsedCount;
      startedAtRef.current = now + savedCountRemainingRef.current;
      lastCountBeatRef.current = Math.floor(elapsedCount / Math.max(0.01, countInBeatDurationRef.current));
    } else {
      startedAtRef.current = now - pausedElapsedRef.current;
      const timeline = timelineRef.current;
      const local = playbackOptionsRef.current.loop && timeline.duration > 0 ? pausedElapsedRef.current % timeline.duration : pausedElapsedRef.current;
      nextEventRef.current = timeline.events.findIndex((cue) => cue.at >= local - 0.0001);
      if (nextEventRef.current < 0) nextEventRef.current = timeline.events.length;
      nextClickRef.current = metronomeCuesRef.current.findIndex((cue) => cue.at >= local - 0.0001);
      if (nextClickRef.current < 0) nextClickRef.current = metronomeCuesRef.current.length;
      lastLoopRef.current = timeline.duration > 0 ? Math.floor(pausedElapsedRef.current / timeline.duration) : 0;
    }
    setPlaybackState(savedCountRemainingRef.current > 0 ? "count-in" : "playing");
    timerRef.current = window.setInterval(() => tickPlayback(), 20);
  }

  async function exportNotation(format: "png" | "pdf", sheet: "score" | "lead" = "score") {
    if (!song || !composition) return;
    const scope = previewScope === "song" ? undefined : previewScope;
    try {
      const pages = sheet === "lead" ? renderLeadSheetPages(song, scope) : renderNotationPages(song, notationView, scope, null, score);
      const base = `${safeName(song.title)}-${sheet === "lead" ? "lead-sheet" : notationView}`;
      if (format === "pdf") downloadBlob(canvasesPdf(pages, score.paper, score.orientation), `${base}.pdf`);
      else downloadBlob(await canvasPng(makeLongPng(pages)), `${base}.png`);
      setMessage(`${format.toUpperCase()} ${sheet === "lead" ? "lead sheet" : notationView === "tab" ? "tablature" : "notation"} downloaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The notation export failed.");
    }
  }

  function travelHistory(direction: "undo" | "redo") {
    const id = selectedSongId; const history = historyRef.current.get(id); const latest = libraryRef.current?.songs.find((item) => item.id === id);
    if (!history || !latest) return;
    const from = direction === "undo" ? history.past : history.future; const to = direction === "undo" ? history.future : history.past;
    const snapshot = from.pop(); if (!snapshot) return; to.push(latest); stopPlayback();
    persistSong(snapshot, false); setActiveMeasureIndex(0); setSelectedEventId(""); setHistoryTick((tick) => tick + 1); setMessage(direction === "undo" ? "Change undone." : "Change redone.");
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!(event.metaKey || event.ctrlKey) || event.altKey || !["z", "y"].includes(key)) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault(); travelHistory(event.shiftKey || key === "y" ? "redo" : "undo");
    };
    window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle);
  });
  function saveRevision(name: string) {
    if (!song || !composition) return;
    persistSong({ ...song, builderRevisions: [...(song.builderRevisions ?? []), { id: UID("revision"), name, savedAt: new Date().toISOString(), composition }].slice(-20) });
    setMessage("Revision saved.");
  }
  async function importFile(file: File) {
    if (file.size > 20 * 1024 * 1024) { setMessage("Choose a file smaller than 20 MB."); return; }
    try {
      const imported = /\.json$/i.test(file.name) ? { ...readPortableSong(await file.text()), warnings: [] as string[] } : /\.midi?$/i.test(file.name) ? importMidi(await file.arrayBuffer()) : importMusicXml(/\.mxl$/i.test(file.name) ? await extractMusicXml(await file.arrayBuffer()) : await file.text());
      const comp = imported.composition;
      if(!comp) throw new Error("The imported composition is invalid.");
      const base = createManualSong({ title: imported.title, artist: imported.artist, key: comp.key, bpm: comp.bpm, timeSignature: comp.timeSignature, chords: [] });
      const fresh = { ...base, composition: comp, sections: librarySections(comp), ...("builderPhrases" in imported ? {builderPhrases:imported.builderPhrases,builderArrangements:imported.builderArrangements}: {}) }; persistSong(fresh); openSong(fresh);
      setMessage(`Imported ${file.name}. ${imported.warnings.join(" ")}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import this file."); }
  }

  if (!library) return <section className="song-builder card"><p>Loading Song Builder…</p></section>;

  return <div className={`song-builder builder-workspace ${song ? "builder-has-song" : ""} ${libraryOpen ? "builder-library-open" : ""} ${focusMode ? "builder-focus-mode" : ""}`} data-workspace={workspace}>
    <header className="song-builder-heading">
      <div><span className="label">Compose and rehearse</span><h1><LocalizedCopy id="songBuilderTitle" /></h1><p>Compose guitar, ukulele, bass, piano, and vocal parts in one arrangement.</p></div>
      <Link className="btn" href="/song-library">Open Song Library</Link>
    </header>

    {guideStep!==null?<section className="card builder-guide" aria-label="Song Builder introduction"><h2>Your first four bars · step {guideStep+1} of 4</h2><p>{["Create a separate practice song with four empty bars.","Write a C–G–Am–F progression, then try changing one chord in the grid.","Hear the four bars and follow the playhead. Stop playback when ready.","Export your score and keep a portable composition backup."][Math.min(guideStep,3)]}</p><button className="btn primary" type="button" onClick={()=>{if(guideStep===0){const comp=createSongComposition();const base=createManualSong({title:"My first four bars",artist:"Me",key:comp.key,bpm:comp.bpm,timeSignature:comp.timeSignature,chords:[]});const fresh={...base,composition:comp,sections:librarySections(comp)};persistSong(fresh);openSong(fresh);guidedSongRef.current=fresh.id;setWorkspace("compose");setGuideStep(1);}else if(guideStep===1){if(song?.id!==guidedSongRef.current){setMessage("Use Start again to create a separate guide song.");return;}const comp=createTemplate("Pop song");comp.sections=comp.sections.slice(0,1);saveComposition(comp);setActiveSectionId(comp.sections[0].id);setActiveTrackId(comp.tracks[0].id);setGuideStep(2);}else if(guideStep===2){void startPlayback();setWorkspace("practice");setGuideStep(3);}else{stopPlayback();setWorkspace("export");void exportNotation("pdf");setGuideStep(null);try{localStorage.setItem("chord-builder-guide-seen","yes");}catch{}}}}>{["Create guide song","Fill four-bar progression","Play and follow along","Download score"][Math.min(guideStep,3)]}</button><button className="btn" type="button" onClick={()=>setGuideStep(0)}>Start again</button><button className="btn" type="button" onClick={()=>{setGuideStep(null);try{localStorage.setItem("chord-builder-guide-seen","yes");}catch{}}}>Dismiss guide</button></section>:null}
    <div className="song-builder-shell">
      <aside className="song-builder-side card">
        <span className="label">Your songs</span>
        <h2>Start a composition</h2>
        <form className="song-builder-create" onSubmit={createSong}>
          <label>Song title<input required maxLength={160} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. The Long Way Home" /></label>
          <label>Artist<input required maxLength={160} value={newArtist} onChange={(event) => setNewArtist(event.target.value)} placeholder="Your name" /></label>
          <label>Starting template<select value={template} onChange={(e) => setTemplate(e.target.value as BuilderTemplate)}>{TEMPLATES.map((item) => <option key={item}>{item}</option>)}</select></label><button className="btn primary" type="submit">Create song</button><label>Import MIDI or MusicXML<input type="file" accept=".mid,.midi,.musicxml,.xml,.mxl,.json" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ""; }}/></label>
        </form>
        <p className="song-builder-save-note">Genre starters include editable chord, bass, keyboard, and drum parts where they fit the style.</p>
        <p className="song-builder-save-note">Songs autosave in this browser and appear in Song Library.</p>
        <div className="song-builder-saved-list" aria-label="Saved songs">
          {songs.map((item) => <button key={item.id} type="button" className={selectedSongId === item.id ? "active" : ""} onClick={() => openSong(item)}><strong>{item.title}</strong><span>{item.artist}{item.composition ? " · editable" : " · convert to edit"}</span></button>)}
          {!songs.length ? <p>Your original songs will appear here.</p> : null}
        </div>
      </aside>

      {song && composition && section && track ? <main className="song-builder-main">
        <div className="builder-edit-toolbar card" role="toolbar" aria-label="Editing controls">
          <nav className="builder-workspace-nav" aria-label="Song Builder workspace">{(["compose","arrange","practice","export"] as const).map(view=><button className="btn" key={view} type="button" aria-pressed={workspace===view} onClick={()=>setWorkspace(view)}>{view[0].toUpperCase()+view.slice(1)}</button>)}</nav><button className="btn" type="button" onClick={()=>setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen}>Songs</button><button className="btn" type="button" onClick={()=>setGuideStep(0)}>Quick guide</button>
          <button className="btn" type="button" disabled={!historyRef.current.get(song.id)?.past.length} onClick={() => travelHistory("undo")}>Undo</button>
          <button className="btn" type="button" disabled={!historyRef.current.get(song.id)?.future.length} onClick={() => travelHistory("redo")}>Redo</button>
          <button className="btn" type="button" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)}>{focusMode ? "Full workspace" : "Focus note entry"}</button>
          {focusMode ? <><label>Section<select value={section.id} onChange={(e) => { setActiveSectionId(e.target.value); setActiveMeasureIndex(0); }}>{composition.sections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Track<select value={track.id} onChange={(e) => { setActiveTrackId(e.target.value); setActiveMeasureIndex(0); }}>{composition.tracks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Bar<select value={activeMeasureIndex} onChange={(e) => setActiveMeasureIndex(Number(e.target.value))}>{sectionMeasures.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label></> : null}
          <small>⌘/Ctrl+Z undo · Shift+⌘/Ctrl+Z redo</small>
        </div>
        <div className="builder-panel-stack"><section className="song-builder-card card" data-builder-panel="metadata">
          <div className="song-builder-card-head"><div><span className="label">Song details</span><h2>{song.title}</h2></div><span className="song-builder-save" role="status">{saveMessage}</span></div>
          <div className="song-builder-fields">
            <label>Title<input value={titleDraft || song.title} maxLength={160} onChange={(event) => setTitleDraft(event.target.value)} onBlur={() => updateSongField("title", titleDraft)} /></label>
            <label>Artist<input value={artistDraft || song.artist} maxLength={160} onChange={(event) => setArtistDraft(event.target.value)} onBlur={() => updateSongField("artist", artistDraft)} /></label>
            <label>Key<select value={composition.key} onChange={(event) => updateComposition((current) => ({ ...current, key: event.target.value }))}>{SONG_BUILDER_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
            <label>Tempo · BPM<input type="number" min={40} max={240} value={composition.bpm} onChange={(event) => updateComposition((current) => ({ ...current, bpm: Math.max(40, Math.min(240, Number(event.target.value) || 90)) }))} /></label>
            <label>Time signature<select value={composition.timeSignature} onChange={(event) => updateComposition((current) => ({ ...current, timeSignature: event.target.value }))}>{!SONG_BUILDER_METERS.includes(composition.timeSignature) ? <option>{composition.timeSignature}</option> : null}{SONG_BUILDER_METERS.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
        </section>

        <section className="song-builder-card card" data-builder-panel="arrange" aria-label="Arrangement sections">
          <div className="song-builder-card-head"><div><span className="label">Arrangement</span><h2>Sections and measures</h2></div><button className="btn" type="button" onClick={createSection}>Add section</button></div>
          <div className="song-builder-section-list">{composition.sections.map((item, index) => <div className={item.id === section.id ? "active" : ""} key={item.id}>
            <button type="button" className="song-builder-section-select" aria-pressed={item.id === section.id} onClick={() => { setActiveSectionId(item.id); setActiveMeasureIndex(0); }}><strong>{item.title}</strong><span>{item.kind} · {measureCount(item)} bars · repeats {item.repeats}</span></button>
            <div className="song-builder-icon-actions"><button type="button" aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => updateComposition((current) => reorderCompositionSection(current, item.id, -1))}>↑</button><button type="button" aria-label={`Move ${item.title} down`} disabled={index === composition.sections.length - 1} onClick={() => updateComposition((current) => reorderCompositionSection(current, item.id, 1))}>↓</button><button type="button" aria-label={`Duplicate ${item.title}`} disabled={composition.sections.length >= 64} onClick={() => { const next = duplicateCompositionSection(composition, item.id); next.sections[index + 1].linkedTo = undefined; saveComposition(next); setActiveSectionId(next.sections[index + 1]?.id ?? item.id); }}>＋</button><button type="button" aria-label={`Delete ${item.title}`} disabled={composition.sections.length < 2} onClick={() => { const next = removeCompositionSection(composition, item.id); next.sections = next.sections.map((entry) => entry.linkedTo === item.id ? { ...entry, linkedTo: undefined } : entry); saveComposition(next); if (item.id === activeSectionId) { setActiveSectionId(next.sections[0]?.id ?? ""); setActiveMeasureIndex(0); } }}>×</button></div>
          </div>)}</div>
          <div className="builder-link-controls"><label>Link this occurrence to<select value={section.linkedTo ?? ""} onChange={(e) => updateSection(section.id, (current) => ({ ...current, linkedTo: e.target.value || undefined }))}><option value="">Independent section</option>{composition.sections.filter((item) => item.id !== section.id && !item.linkedTo && !composition.sections.some((linked) => linked.linkedTo === section.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{section.linkedTo ? <p>Notes follow the original section. Select “Independent section” to edit a separate copy.</p> : null}</div>
          <div className="song-builder-fields song-builder-section-fields">
            <label>Section name<input value={section.title} maxLength={120} onChange={(event) => updateSection(section.id, (current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Section type<select value={section.kind} onChange={(event) => updateSection(section.id, (current) => ({ ...current, kind: event.target.value as SongCompositionSection["kind"] }))}>{["intro", "verse", "chorus", "bridge", "solo", "ending", "other"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label>Repeats<input type="number" min={1} max={32} value={section.repeats} onChange={(event) => updateSection(section.id, (current) => ({ ...current, repeats: Math.max(1, Math.min(32, Number(event.target.value) || 1)) }))} /></label>
            <label>Section tempo<input type="number" min={40} max={240} placeholder={`${composition.bpm} BPM`} value={section.bpm ?? ""} onChange={(event) => updateSection(section.id, (current) => ({ ...current, bpm: event.target.value ? Math.max(40, Math.min(240, Number(event.target.value) || composition.bpm)) : undefined }))} /></label>
            <label>Section meter<select value={section.timeSignature ?? composition.timeSignature} onChange={(event) => updateSection(section.id, (current) => ({ ...current, timeSignature: event.target.value === composition.timeSignature ? undefined : event.target.value }))}>{!SONG_BUILDER_METERS.includes(section.timeSignature ?? composition.timeSignature) ? <option>{section.timeSignature ?? composition.timeSignature}</option> : null}{SONG_BUILDER_METERS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Section notes<input value={section.notes ?? ""} maxLength={2000} onChange={(event) => updateSection(section.id, (current) => ({ ...current, notes: event.target.value }))} placeholder="Arrangement notes" /></label>
            <label className="song-builder-wide">Lyrics<textarea value={section.lyrics ?? ""} maxLength={4000} rows={2} onChange={(event) => updateSection(section.id, (current) => ({ ...current, lyrics: event.target.value }))} placeholder="Optional lyrics for this section" /></label>
          </div>
          <div className="song-builder-measures"><strong>Bars</strong><div>{sectionMeasures.map((_, index) => <button type="button" key={index} className={activeMeasureIndex === index ? "active" : ""} aria-pressed={activeMeasureIndex === index} onPointerDown={(e) => { if (e.shiftKey) { setPractice({ ...practice, enabled: true, start: Math.min(activeMeasureIndex, index) + 1, end: Math.max(activeMeasureIndex, index) + 1 }); setPlaybackScope(section.id); setLoop(true); } else rangeAnchorRef.current = index; }} onPointerEnter={(e) => { if (e.buttons === 1 && rangeAnchorRef.current !== null) { setPractice({ ...practice, enabled: true, start: Math.min(rangeAnchorRef.current, index) + 1, end: Math.max(rangeAnchorRef.current, index) + 1 }); setPlaybackScope(section.id); setLoop(true); } }} onPointerUp={() => { rangeAnchorRef.current = null; }} onClick={() => { setActiveMeasureIndex(index); setSelectedEventId(""); }}>{index + 1}</button>)}<button type="button" disabled={sectionMeasures.length >= 512} onClick={() => { updateComposition((current) => addCompositionMeasure(current, section.id)); setActiveMeasureIndex(sectionMeasures.length); }}>＋ Add bar</button>{sectionMeasures.length > 1 ? <button type="button" className="text-button" onClick={() => { const index = Math.min(activeMeasureIndex, sectionMeasures.length - 1); updateComposition((current) => removeCompositionMeasure(current, section.id, activeMeasureIndex)); setActiveMeasureIndex(Math.max(0, index - (index === sectionMeasures.length - 1 ? 1 : 0))); }}>Remove selected bar</button> : null}</div></div>
        </section>

        <section className="song-builder-card card" data-builder-panel="tracks" aria-label="Instrument tracks">
          <div className="song-builder-card-head"><div><span className="label">Tracks</span><h2>Choose the part to edit</h2></div>{availableInstruments.length ? <div className="song-builder-add-track">{availableInstruments.map((instrument) => <button key={instrument} className="btn" type="button" onClick={() => addTrack(instrument)}>Add {instrument}</button>)}</div> : <span className="song-builder-muted">All instrument tracks added</span>}</div>
          <div className="song-builder-track-list">{composition.tracks.map((item) => <button key={item.id} type="button" aria-pressed={item.id === track.id} className={item.id === track.id ? "active" : ""} onClick={() => { setActiveTrackId(item.id); setNoteString(Math.min(noteString, item.tuning.length)); setActiveMeasureIndex((current) => Math.min(current, Math.max(0, (section?.measuresByTrack[item.id]?.length ?? 1) - 1))); }}><strong>{item.name}</strong><span>{item.instrument} · {item.tuningLabel}</span></button>)}</div>
          <div className="song-builder-fields song-builder-track-fields">
            <label>Track name<input value={track.name} maxLength={80} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, name: event.target.value }))} /></label>
            {isFrettedInstrument(track.instrument) ? <>
              <label>Tuning<select value={isCustomTuning ? "custom" : matchingTuningPreset?.label ?? "custom"} onChange={(event) => { const preset = SONG_BUILDER_TUNINGS[track.instrument].find((item) => item.label === event.target.value); if (preset) updateTrack(track.id, (current) => updateTrackTuning(current, preset.midi, preset.label)); else { setCustomTuningDraft(track.tuning.map(midiNoteLabel).join(" ")); updateTrack(track.id, (current) => updateTrackTuning(current, current.tuning, "Custom tuning")); } }}><optgroup label={`${track.instrument} presets`}>{SONG_BUILDER_TUNINGS[track.instrument].map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}</optgroup><option value="custom">Custom tuning</option></select></label>
              <label>Capo<input type="number" min={0} max={12} value={track.capo} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, capo: Math.max(0, Math.min(12, Number(event.target.value) || 0)) }))} /></label>
            </> : <p className="song-builder-muted">MIDI part · notes use concert pitch. Enter a pitch per note or record it with MIDI.</p>}
            <label className="song-builder-check"><input type="checkbox" checked={track.muted === true} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, muted: event.target.checked }))} /> Mute during listen-back</label>
            {isFrettedInstrument(track.instrument) && isCustomTuning ? <label className="song-builder-wide">Open strings · low to high<input value={customTuningDraft || track.tuning.map(midiNoteLabel).join(" ")} onChange={(event) => setCustomTuningDraft(event.target.value)} onBlur={() => { const pitches = parseTuningNotes(customTuningDraft); if (pitches) updateTrack(track.id, (current) => updateTrackTuning(current, pitches, `Custom · ${customTuningDraft.trim()}`)); else if (customTuningDraft.trim()) setMessage("Use note names with octaves, such as E2 A2 D3 G3 B3 E4."); }} placeholder="E2 A2 D3 G3 B3 E4" /></label> : null}
          </div>
          {composition.tracks.length > 1 ? <button className="text-button song-builder-remove-track" type="button" onClick={() => { const next = removeCompositionTrack(composition, track.id); saveComposition(next); setActiveTrackId(next.tracks[0]?.id ?? ""); }}>Remove {track.name} track</button> : null}
        </section>

        <section className="song-builder-card card" data-builder-panel="compose" aria-label="Chord and note editor">
          <div className="song-builder-card-head"><div><span className="label">Bar {activeMeasureIndex + 1} · {section.title}</span><h2>{track.name} part</h2></div><span className="song-builder-muted">{stepCount} grid positions · {meter} · {section.bpm ?? composition.bpm} BPM</span></div>
          <div className="song-builder-fields song-builder-entry-fields">
            <label>Entry type<select value={eventMode} onChange={(event) => setEventMode(event.target.value as "chord" | "note" | "rest")}>
              {track.instrument !== "percussion" ? <option value="chord">Chord</option> : null}<option value="note">{track.instrument === "percussion" ? "Drum hit" : "Single note"}</option><option value="rest">Rest</option>
            </select></label>
            {eventMode === "chord" ? <label>Chord name<input list="song-builder-chord-list" value={chordQuery} onChange={(event) => setChordQuery(event.target.value)} placeholder="Search chord names" /><datalist id="song-builder-chord-list">{queryChords.map((name) => <option key={name} value={name} />)}</datalist><small>{CHORD_LOOKUP.has(chordQuery) ? "Chord from Chord Hero library" : queryChords.length ? "Choose a suggested chord" : "Type a chord name"}</small></label> : eventMode === "note" ? isFrettedInstrument(track.instrument) ? <><label>String<select value={noteString} onChange={(event) => setNoteString(Number(event.target.value))}>{Array.from({ length: track.tuning.length }, (_, index) => track.tuning.length - index).map((number) => <option key={number} value={number}>String {number} · {midiNoteLabel(track.tuning[track.tuning.length - number])}</option>)}</select></label><label>Fret<input type="number" min={0} max={24} value={noteFret} onChange={(event) => setNoteFret(Math.max(0, Math.min(24, Number(event.target.value) || 0)))} /></label></> : track.instrument === "percussion" ? <label>Drum sound<select value={midiPitchDraft} onChange={(event) => setMidiPitchDraft(Number(event.target.value))}>{SONG_BUILDER_DRUMS.map(({ pitch, label }) => <option key={pitch} value={pitch}>{label} · MIDI {pitch}</option>)}</select></label> : <label>Pitch<select value={midiPitchDraft} onChange={(event) => setMidiPitchDraft(Number(event.target.value))}>{Array.from({ length: 61 }, (_, index) => index + 36).map((pitch) => <option key={pitch} value={pitch}>{midiNoteLabel(pitch)}</option>)}</select></label> : null}
            <label>Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{DURATIONS.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}</select></label>
            <label className="song-builder-check"><input type="checkbox" checked={accentNext} onChange={(event) => setAccentNext(event.target.checked)} /> Accent next event</label>
          </div>
          <p className="song-builder-help">Choose a chord or enter a note, then select a position. Fretboard parts use strings and frets; piano and vocal parts use concert-pitch MIDI notes; percussion uses individual General MIDI drum sounds. In the score, drag an event to another measure on the same part to move it. Empty positions are silent; explicit rests are available in Entry type.</p>
          {eventMode !== "rest" && isFrettedInstrument(track.instrument) ? <div className="song-builder-fretboard" role="group" aria-label={eventMode === "note" ? "Choose a string and fret for a note" : "Choose a fret for each string in the chord voicing"}>
            <div className="song-builder-fretboard-row song-builder-fretboard-heading"><span>{eventMode === "note" ? "String" : "Voicing"}</span><span>{eventMode === "chord" ? "X" : ""}</span>{Array.from({ length: 13 }, (_, fret) => <span key={fret}>{fret}</span>)}</div>
            {Array.from({ length: track.tuning.length }, (_, row) => {
              const stringNumber = row + 1;
              const tuningIndex = track.tuning.length - stringNumber;
              return <div className="song-builder-fretboard-row" key={stringNumber}>
                <strong>String {stringNumber}<small>{midiNoteLabel(track.tuning[tuningIndex])}</small></strong>
                {eventMode === "chord" ? <button type="button" className={displayedVoicing?.[tuningIndex] === null ? "selected" : ""} aria-label={`Mute string ${stringNumber} in ${chordQuery}`} aria-pressed={displayedVoicing?.[tuningIndex] === null} onClick={() => { const next = displayedVoicing ? [...displayedVoicing] : Array.from({ length: track.tuning.length }, () => null); next[tuningIndex] = null; setVoicingDraft(next); setVoicingEdited(true); }}>×</button> : <span />}
                {Array.from({ length: 13 }, (_, fret) => <button type="button" key={fret} className={eventMode === "note" ? noteString === stringNumber && noteFret === fret ? "selected" : "" : displayedVoicing?.[tuningIndex] === fret ? "selected" : ""} aria-label={`String ${stringNumber}, fret ${fret}${eventMode === "note" ? ", select note" : ` for ${chordQuery} voicing`}`} aria-pressed={eventMode === "note" ? noteString === stringNumber && noteFret === fret : displayedVoicing?.[tuningIndex] === fret} onClick={() => {
                  if (eventMode === "note") { setNoteString(stringNumber); setNoteFret(fret); return; }
                  const next = displayedVoicing ? [...displayedVoicing] : Array.from({ length: track.tuning.length }, () => null); next[tuningIndex] = fret; setVoicingDraft(next); setVoicingEdited(true);
                }}>{eventMode === "chord" && displayedVoicing?.[tuningIndex] === fret ? fret : eventMode === "note" && noteString === stringNumber && noteFret === fret ? fret : ""}</button>)}
              </div>;
            })}
            <p>{eventMode === "note" ? `Selected: string ${noteString}, fret ${noteFret}.` : voicingEdited ? "Tap a fret or × for each string. The voicing is saved with the chord." : displayedVoicing ? "Known guitar shapes start from Chord Hero’s voicing. Tap frets to customize." : "Tap frets to enter a custom chord voicing for this instrument."}</p>
          </div>
          : null}
          <div className="song-builder-grid-scroll"><div className="song-builder-step-grid" style={{ "--steps": stepCount } as CSSProperties} role="group" aria-label={`${track.name} bar ${activeMeasureIndex + 1} composition grid`}>
            {Array.from({ length: stepCount }, (_, step) => {
              const event = eventAtStep(activeMeasure, step, composition.subdivision);
              const isPlayhead = playbackPosition?.sectionId === section.id && playbackPosition.measureIndex === activeMeasureIndex && Math.floor(playbackPosition.beat * composition.subdivision / 4) === step;
              const text = event ? event.kind === "rest" ? "Rest" : event.kind === "chord" ? event.chord : event.string ? `${event.string}:${event.fret}` : event.midiPitches?.map((pitch) => track.instrument === "percussion" ? songBuilderDrumName(pitch) : midiNoteLabel(pitch)).join(" + ") ?? "Note" : "·";
              return <button key={step} type="button" className={`${event ? "filled" : ""} ${event?.accent ? "accented" : ""} ${isPlayhead ? "playhead" : ""}`} aria-pressed={Boolean(event)} aria-label={`Grid position ${step + 1}: ${event ? `${event.kind} ${text}` : "rest"}. Activate to ${event ? "edit" : `add ${eventMode}`}.`} onClick={(click) => { if (click.shiftKey) { setSelectedBeat(step * 4 / composition.subdivision); setMessage(`Start here is set to beat ${1 + step * 4 / composition.subdivision}.`); } else toggleGridEvent(step); }}><small>{step + 1}</small><strong>{text}</strong></button>;
            })}
          </div></div>
          <div className="song-builder-fields"><label>Pickup / measure length · quarter beats<input type="number" min={.25} max={16} step={.25} value={activeMeasure?.beats??measureQuarterBeats(meter)} onChange={e=>{const beats=Math.max(.25,Math.min(16,Number(e.target.value)||measureQuarterBeats(meter)));updateSection(section.id,current=>({...current,measuresByTrack:Object.fromEntries(Object.entries(current.measuresByTrack).map(([id,measures])=>[id,measures.map((bar,index)=>index===activeMeasureIndex?{...bar,beats}:bar)]))}));}}/></label><label>Tempo changes · beat:BPM<input key={`${section.id}-${activeMeasureIndex}`} placeholder="2:100, 3:120" defaultValue={activeMeasure?.tempoChanges?.map(mark=>`${mark.beat+1}:${mark.bpm}`).join(", ")??""} onBlur={e=>{const marks=e.target.value.trim()?e.target.value.split(",").map(item=>item.trim().split(":").map(Number)).map(([beat,bpm])=>({beat:beat-1,bpm})):[];if(marks.some(mark=>!Number.isFinite(mark.beat)||!Number.isFinite(mark.bpm)||mark.beat<0||mark.beat>=(activeMeasure?.beats??measureQuarterBeats(meter))||mark.bpm<40||mark.bpm>240)){setMessage("Use beat:BPM pairs within this measure, at 40–240 BPM.");return;}updateSection(section.id,current=>({...current,measuresByTrack:Object.fromEntries(Object.entries(current.measuresByTrack).map(([id,measures])=>[id,measures.map((bar,index)=>index===activeMeasureIndex?{...bar,tempoChanges:marks}:bar)]))}));}}/></label></div>
          <div className="song-builder-grid-footer"><label>Grid subdivision<select value={composition.subdivision} onChange={(event) => updateComposition((current) => ({ ...current, subdivision: Number(event.target.value) as SongComposition["subdivision"] }))}>{SONG_BUILDER_SUBDIVISIONS.map((value) => <option key={value} value={value}>{value === 4 ? "Quarter notes" : value === 8 ? "Eighth notes" : value === 12 ? "Triplets" : "Sixteenth notes"}</option>)}</select></label><button className="btn" type="button" onClick={clearMeasure} disabled={!activeMeasure?.events.length}>Clear bar</button></div>
        </section>

        {workspace==="arrange"?<SongBuilderTimeline hasSelection={Boolean(selectedEventId)} onEdit={()=>setWorkspace("compose")} composition={composition} onChange={saveComposition} onSelect={(sectionId,trackId,index,eventId)=>{setActiveSectionId(sectionId);setActiveTrackId(trackId);setActiveMeasureIndex(index);setSelectedEventId(eventId??"");}} onMessage={setMessage} position={playbackPosition}/>:null}
        <SongBuilderStudio sharedPhrases={library.songs.flatMap(item=>item.builderPhrases??[]).slice(-200)} library={library} song={song} composition={composition} section={section} track={track} measureIndex={activeMeasureIndex} eventId={selectedEventId} workspace={workspace} startBeat={selectedBeat} onCapture={captureNote} onLocate={(sectionId, trackId, index) => { setActiveSectionId(sectionId); setActiveTrackId(trackId); setActiveMeasureIndex(index); setWorkspace("compose"); }} onChange={saveComposition} onSaveSong={persistSong} onApplyLibrary={applySyncedLibrary} onMessage={setMessage} onDownload={downloadBlob}/>
        {workspace==="practice"?<><SongBuilderRecorder key={song.id} songId={song.id} signature={recordingSignature} onPlay={async()=>{setPlaybackTempo(100);setPlaybackScope("song");await startPlayback({...practice,enabled:false,countIn:true},"song",100);return countInSecondsRef.current;}} onReplay={async()=>{setPlaybackTempo(100);setPlaybackScope("song");await startPlayback({...practice,enabled:false,countIn:false},"song",100);}} onStop={stopPlayback} onMessage={setMessage}/><SongBuilderFeedback expectedPitches={feedbackCue?.pitches ?? []} expectedKey={feedbackCue ? `${feedbackCue.barIndex}:${feedbackCue.event.id}` : ""} expectedSecondsUntil={feedbackCue ? feedbackCue.at - feedbackTime : null} active={playbackState === "playing"} sectionId={feedbackBar?.sectionId ?? section.id} sectionName={feedbackBar?.sectionTitle ?? section.title} currentTempo={feedbackBar?.bpm ?? section.bpm ?? composition.bpm} history={song.builderPracticeSessions ?? []} onSaveSession={(sessions) => { const latest = libraryRef.current?.songs.find((item) => item.id === song.id) ?? song; persistSong({ ...latest, builderPracticeSessions: [...(latest.builderPracticeSessions ?? []), ...sessions].slice(-100) }, false); }} onSetPracticeTempo={(sectionId, bpm) => { const targetSection = composition.sections.find((item) => item.id === sectionId); const baseTempo = targetSection?.bpm ?? composition.bpm; stopPlayback(); setPlaybackScope(sectionId); setPlaybackTempo(Math.max(50, Math.min(200, Math.round(bpm / baseTempo * 100)))); setMessage(`Practice tempo set to ${bpm} BPM for ${targetSection?.title ?? section.title}. Start playback when ready.`); }}/></>:null}
        <SongBuilderTools workspace={workspace} song={song} composition={composition} section={section} track={track} measureIndex={activeMeasureIndex} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} onChange={saveComposition} onMessage={setMessage} onLocate={(sectionId, trackId, index) => { setActiveSectionId(sectionId); setActiveTrackId(trackId); setActiveMeasureIndex(index); }} practice={practice} onPractice={(settings) => { stopPlayback(); setPractice(settings); }} score={score} onScore={setScore} onDownload={(format) => { try { downloadBlob(format === "midi" ? exportMidi(song) : exportMusicXml(song), `${safeName(song.title)}.${format === "midi" ? "mid" : "musicxml"}`); setMessage(`${format.toUpperCase()} downloaded.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed."); } }} onImport={(file) => void importFile(file)} onRevision={saveRevision} onRestore={saveComposition}/>
        <section className="song-builder-card card" data-builder-panel="playback" aria-label="Follow along and listen">
          <div className="song-builder-card-head"><div><span className="label">Follow along and listen</span><h2>Play the arrangement</h2></div><span className={`song-builder-play-state state-${playbackState}`} role="status">{playbackState === "count-in" ? `Count-in · ${countIn}` : playbackState === "idle" || playbackState === "finished" ? "Ready" : playbackState}</span></div>
          <div className="song-builder-transport">
            <label>Play<select value={playbackScope} disabled={["playing", "loading", "count-in"].includes(playbackState)} onChange={(event) => setPlaybackScope(event.target.value)}><option value="song">Full song</option>{composition.sections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            {playbackState === "idle" || playbackState === "finished" ? <button className="btn primary" type="button" onClick={() => void startPlayback()}>{playbackState === "finished" ? "Play again" : "Play"}</button> : playbackState === "paused" ? <button className="btn primary" type="button" onClick={resumePlayback}><LocalizedCopy id="resume" /></button> : <button className="btn primary" type="button" onClick={pausePlayback} disabled={playbackState === "loading"}><LocalizedCopy id="pause" /></button>}
            <button className="btn" type="button" onClick={() => { stopPlayback(); setPractice({ ...practice, enabled: true, start: activeMeasureIndex + 1, end: sectionMeasures.length, beat: selectedBeat + 1 }); setPlaybackScope(section.id); void startPlayback({ ...practice, enabled: true, start: activeMeasureIndex + 1, end: sectionMeasures.length, beat: selectedBeat + 1 }, section.id); }}>Start here</button><button className="btn" type="button" onClick={stopPlayback} disabled={playbackState === "idle" || playbackState === "finished"}>Stop</button>
            <label className="song-builder-check"><input type="checkbox" checked={hearTracks} disabled={["playing", "loading", "count-in"].includes(playbackState)} onChange={(event) => setHearTracks(event.target.checked)} /> Hear tracks</label>
            <label className="song-builder-check"><input type="checkbox" checked={metronome} onChange={(event) => setMetronome(event.target.checked)} /> Metronome</label>
            <label className="song-builder-check"><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} /> Loop selected range</label>
            <label className="song-builder-tempo">Playback tempo · {playbackTempo}%<input type="range" min={50} max={200} step={5} value={playbackTempo} onChange={(event) => { stopPlayback(); setPlaybackTempo(Number(event.target.value)); }} /></label>
          </div>
          <p className="song-builder-help">Hear tracks plays the composed notes. Turn it off to follow the moving score with only the metronome.</p>
        </section>

        </div><section className="song-builder-card card builder-score-preview" aria-label="Notation preview and export">
          <div className="song-builder-card-head"><div><span className="label">Print and export</span><h2>Notation preview</h2></div><div className="song-builder-export-buttons"><label>Show<select value={previewScope} onChange={(event) => { setPreviewScope(event.target.value); setPage(0); }}><option value="song">Full song</option>{composition.sections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button className="btn" type="button" onClick={() => void exportNotation("png")}>Download PNG</button><button className="btn primary" type="button" onClick={() => void exportNotation("pdf")}>Download PDF</button><button className="btn" type="button" onClick={() => void exportNotation("png", "lead")}>Lead sheet PNG</button><button className="btn" type="button" onClick={() => void exportNotation("pdf", "lead")}>Lead sheet PDF</button></div></div>
          <div className="song-builder-notation-switch" role="group" aria-label="Notation view"><button type="button" aria-pressed={notationView === "tab"} className={notationView === "tab" ? "active" : ""} onClick={() => setNotationView("tab")}>Tablature</button><button type="button" aria-pressed={notationView === "staff"} className={notationView === "staff" ? "active" : ""} onClick={() => setNotationView("staff")}>Standard notation</button><button type="button" aria-pressed={notationView === "both"} className={notationView === "both" ? "active" : ""} onClick={() => setNotationView("both")}>Staff + tab</button><span>Guitar uses octave treble; ukulele and piano use treble; bass uses bass clef. MIDI parts print on staff.</span></div>
          {pageCount > 1 ? <div className="song-builder-pages"><button type="button" disabled={boundedPage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous page</button><span>Page {boundedPage + 1} of {pageCount}</span><button type="button" disabled={boundedPage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next page</button></div> : null}
          <div className="builder-interactive-score"><canvas ref={canvasRef} className="song-builder-canvas" aria-label={`${notationView === "both" ? "Staff and tablature" : notationView === "tab" ? "Tablature" : "Standard notation"} preview for ${song.title}`} />
          <div className="builder-score-hit-regions" aria-label="Interactive score">{(()=>{let top=126;return (notationPages[boundedPage]??[]).flatMap((block,blockIndex)=>{const blockTop=top;top+=block.height;return block.bars.map((bar,local)=>{const width=966/block.bars.length;return <div key={`${blockIndex}-${bar.index}`} className="builder-score-bar" style={{left:`${(172+local*width)/12}%`,top:`${blockTop/9}%`,width:`${width/12}%`,height:`${block.height/9}%`}}><button className="builder-score-bar-target" type="button" aria-label={`Play ${bar.sectionTitle} measure ${bar.measureIndex+1}`} onPointerDown={()=>{scoreDragRef.current=bar.index;scoreRangeSelectedRef.current=false;}} onPointerUp={()=>{const start=scoreDragRef.current;scoreDragRef.current=null;if(start!==null&&start!==bar.index){scoreRangeSelectedRef.current=true;setPractice({...practice,enabled:true,start:Math.min(start,bar.index)+1,end:Math.max(start,bar.index)+1,beat:1});setPlaybackScope(previewScope);setLoop(true);setMessage("Score passage selected for looping.");}}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();scoreRangeSelectedRef.current=true;try{const source=JSON.parse(event.dataTransfer.getData("application/x-chord-hero-score-event")) as {sectionId:string;trackId:string;measureIndex:number;eventId:string};if(source.trackId!==block.trackId)return;const rect=event.currentTarget.getBoundingClientRect();const targetBeat=Math.max(0,Math.min(bar.measureBeats,((event.clientX-rect.left)/rect.width)*bar.measureBeats));moveScoreEvent(source.sectionId,source.trackId,source.measureIndex,source.eventId,bar.measureIndex,targetBeat);}catch{setMessage("Drag a score note or chord into a measure to move it.");}}} onClick={e=>{if(scoreRangeSelectedRef.current){scoreRangeSelectedRef.current=false;return;}if(e.shiftKey){setPractice({...practice,enabled:true,start:bar.index+1,end:bar.index+1,beat:1});setPlaybackScope(previewScope);setLoop(true);setWorkspace("practice");}else{setPlaybackScope(previewScope);void startPlayback({...practice,enabled:true,start:bar.index+1,end:notationTimeline.bars.length,beat:1},previewScope);}}}/>{bar.events.filter(cue=>cue.track.id===block.trackId).map((cue,j)=><button key={`${cue.event.id}-${j}`} className="builder-score-event-target" type="button" draggable onDragStart={event=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("application/x-chord-hero-score-event",JSON.stringify({sectionId:bar.sectionId,trackId:block.trackId,measureIndex:bar.measureIndex,eventId:cue.event.id}));}} aria-label={`Edit ${cue.event.kind} ${cue.event.chord??cue.event.fret??""} in ${bar.sectionTitle} measure ${bar.measureIndex+1}`} style={{left:`${cue.event.startBeat/bar.measureBeats*88+3}%`}} onClick={()=>{stopPlayback();setActiveSectionId(bar.sectionId);setActiveTrackId(block.trackId);setActiveMeasureIndex(bar.measureIndex);setSelectedEventId(cue.event.id);setWorkspace("compose");}}/>)}</div>;});});})()}</div></div>
        </section>
      </main> : <main className="song-builder-empty card"><span className="label">Original music starts here</span><h2>Write the part you hear.</h2><p>Create a song or open one of your existing manual songs to turn its chords into an editable arrangement.</p><Link className="btn primary" href="/song-library">Browse Song Library</Link></main>}
    </div>
    <p className="song-builder-message" role="status">{message}</p>
  </div>;
}
