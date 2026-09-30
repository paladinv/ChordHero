"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { CHORD_LOOKUP } from "@/lib/chords";
import { createManualSong, readSongLibraryState, writeSongLibraryState, type LibrarySong, type SongComposition, type SongCompositionEvent, type SongCompositionMeasure, type SongCompositionSection, type SongCompositionTrack, type SongInstrument, type SongLibraryState, type SongSection } from "@/lib/songLibrary";
import { addCompositionMeasure, addCompositionSection, addCompositionTrack, addOrRemoveEvent, buildSongTimeline, createSongComposition, duplicateCompositionSection, measureClickCount, measureCount, measureQuarterBeats, measureStepCount, meterParts, midiNoteLabel, parseTuningNotes, removeCompositionMeasure, removeCompositionSection, removeCompositionTrack, reorderCompositionSection, SONG_BUILDER_KEYS, SONG_BUILDER_METERS, SONG_BUILDER_SUBDIVISIONS, SONG_BUILDER_TUNINGS, updateTrackTuning, type SongTimeline, type TimelineBar } from "@/lib/songBuilder";
import { createSongBuilderAudio, type SongBuilderAudio } from "@/lib/songBuilderAudio";
import { BUILDER_PAGE_BARS, BUILDER_SHEET_HEIGHT, BUILDER_SHEET_WIDTH, canvasPng, canvasesPdf, drawNotationPage, makeLongPng, renderNotationPages, type NotationView } from "@/lib/songBuilderExport";

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
];
const INSTRUMENTS: SongInstrument[] = ["guitar", "ukulele", "bass"];

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
      const notes = (section.measuresByTrack[track.id] ?? []).flatMap((measure) => measure.events.filter((event) => event.kind === "note").map((event) => `s${event.string}f${event.fret}`));
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
    return Array.from({ length: measureClickCount(bar.meter) }, (_, index) => ({ at: bar.startsAt + index * pulseBeats * 60 / bar.bpm, accent: index === 0 }));
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
  const [eventMode, setEventMode] = useState<"chord" | "note">("chord");
  const [chordQuery, setChordQuery] = useState("C");
  const [voicingDraft, setVoicingDraft] = useState<Array<number | null>>([]);
  const [voicingEdited, setVoicingEdited] = useState(false);
  const [noteString, setNoteString] = useState(1);
  const [noteFret, setNoteFret] = useState(0);
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
  const [instrumentToAdd, setInstrumentToAdd] = useState<SongInstrument>("ukulele");
  const [customTuningDraft, setCustomTuningDraft] = useState("");
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("Changes save on this device.");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<SongBuilderAudio | null>(null);
  const timerRef = useRef<number | null>(null);
  const timelineRef = useRef<SongTimeline | null>(null);
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
    const stored = readSongLibraryState();
    libraryRef.current = stored;
    setLibrary(stored);
    const requested = new URLSearchParams(window.location.search).get("songId");
    const requestedSong = requested && stored.songs.find((song) => song.id === requested);
    const first = requestedSong ?? stored.songs.find((song) => song.composition) ?? stored.songs.find((song) => song.origin === "manual");
    if (first) {
      setSelectedSongId(first.id);
      setActiveSectionId(first.composition?.sections[0]?.id ?? "");
      setActiveTrackId(first.composition?.tracks[0]?.id ?? "");
    }
  }, []);

  const songs = useMemo(() => (library?.songs ?? []).filter((song) => song.origin === "manual" || Boolean(song.composition)).slice().reverse(), [library]);
  const song = songs.find((item) => item.id === selectedSongId);
  const composition = song?.composition;
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
  const stepCount = measureStepCount(meter, composition?.subdivision ?? 8);
  const queryChords = useMemo(() => [...CHORD_LOOKUP.keys()].filter((name) => name.toLowerCase().includes(chordQuery.trim().toLowerCase())).slice(0, 16), [chordQuery]);
  const displayedVoicing = track ? (voicingEdited
    ? Array.from({ length: track.tuning.length }, (_, index) => voicingDraft[index] ?? null)
    : libraryVoicing(track, chordQuery)) : undefined;
  const notationTimeline = useMemo(() => song ? buildSongTimeline(song, previewScope === "song" ? undefined : previewScope) : { bars: [], events: [], duration: 0 }, [song, previewScope]);
  const pageCount = Math.max(1, Math.ceil(notationTimeline.bars.length / BUILDER_PAGE_BARS));
  const boundedPage = Math.max(0, Math.min(page, pageCount - 1));
  const previewPosition = playbackPosition && playbackScope === previewScope ? playbackPosition : null;
  const availableInstruments = composition ? INSTRUMENTS.filter((instrument) => !composition.tracks.some((item) => item.instrument === instrument)) : INSTRUMENTS;

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
      const pageCanvas = drawNotationPage(song, notationTimeline.bars, notationView, boundedPage, previewPosition);
      canvas.width = BUILDER_SHEET_WIDTH;
      canvas.height = BUILDER_SHEET_HEIGHT;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(pageCanvas, 0, 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not draw the notation preview.");
    }
  }, [song, notationTimeline, notationView, boundedPage, previewPosition]);

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

  useEffect(() => () => {
    stopClock();
    audioRef.current?.close();
  }, []);

  function persistSong(updatedSong: LibrarySong) {
    const current = libraryRef.current;
    if (!current) return;
    if (["playing", "count-in", "loading"].includes(playbackState)) stopPlayback();
    const nextSong = { ...updatedSong, updatedAt: new Date().toISOString() };
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

  function saveComposition(nextComposition: SongComposition) {
    if (!song) return;
    const latest = libraryRef.current?.songs.find((item) => item.id === song.id) ?? song;
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
    const comp = createSongComposition();
    const base = createManualSong({ title: newTitle.trim(), artist: newArtist.trim(), key: comp.key, timeSignature: comp.timeSignature, bpm: comp.bpm, chords: [] });
    const fresh = { ...base, sections: librarySections(comp), composition: comp };
    persistSong(fresh);
    setSelectedSongId(fresh.id);
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
    if (value.trim()) persistSong(updated);
  }

  function toggleGridEvent(step: number) {
    if (!composition || !section || !track) return;
    const startBeat = step * 4 / composition.subdivision;
    const base = { id: UID("event"), startBeat, durationBeats: duration, accent: accentNext };
    let nextEvent: SongCompositionEvent;
    if (eventMode === "chord") {
      const chord = chordQuery.trim();
      if (!CHORD_LOOKUP.has(chord) && !/^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus[24]?|add\d|\d|°|\+)?(?:\/[A-G](?:#|b)?)?$/.test(chord)) {
        setMessage("Choose a chord from the chord suggestions.");
        return;
      }
      const voicing = voicingEdited ? voicingDraft.slice(0, track.tuning.length) : libraryVoicing(track, chord);
      nextEvent = { ...base, kind: "chord", chord, voicing };
    } else {
      nextEvent = { ...base, kind: "note", string: noteString, fret: noteFret };
    }
    const next = addOrRemoveEvent(composition, section.id, track.id, activeMeasureIndex, nextEvent);
    saveComposition(next);
    setAccentNext(false);
  }

  function createSection() {
    if (!composition) return;
    const next = addCompositionSection(composition, "New section");
    saveComposition(next);
    setActiveSectionId(next.sections.at(-1)?.id ?? "");
    setActiveMeasureIndex(0);
  }

  function addTrack(instrument: SongInstrument) {
    if (!composition || composition.tracks.some((item) => item.instrument === instrument)) return;
    const next = addCompositionTrack(composition, instrument);
    saveComposition(next);
    setActiveTrackId(next.tracks.at(-1)?.id ?? "");
  }

  function updateTrack(trackId: string, change: (current: SongCompositionTrack) => SongCompositionTrack) {
    if (!composition) return;
    updateComposition((current) => ({ ...current, tracks: current.tracks.map((item) => item.id === trackId ? change(item) : item) }));
  }

  function updateSection(sectionId: string, change: (current: SongCompositionSection) => SongCompositionSection) {
    if (!composition) return;
    updateComposition((current) => ({ ...current, sections: current.sections.map((item) => item.id === sectionId ? change(item) : item) }));
  }

  function clearMeasure() {
    if (!composition || !section || !track || !activeMeasure) return;
    updateComposition((current) => ({ ...current, sections: current.sections.map((item) => item.id !== section.id ? item : {
      ...item, measuresByTrack: { ...item.measuresByTrack, [track.id]: (item.measuresByTrack[track.id] ?? []).map((measure, index) => index === activeMeasureIndex ? { ...measure, events: [] } : measure) },
    }) }));
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
    if (cycle !== lastLoopRef.current) {
      lastLoopRef.current = cycle;
      nextEventRef.current = 0;
      nextClickRef.current = 0;
    }
    const cycleOffset = cycle * timeline.duration;
    while (nextEventRef.current < timeline.events.length && timeline.events[nextEventRef.current].at <= localTime + 0.12) {
      const cue = timeline.events[nextEventRef.current++];
      if (cue.at < localTime - 0.075 || !playbackOptionsRef.current.hearTracks || cue.track.muted) continue;
      cue.pitches.forEach((midi, index) => player.play(midi, startAt + cycleOffset + cue.at + (cue.event.kind === "chord" ? index * 0.012 : 0), cue.duration, cue.track.instrument, cue.event.accent));
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
      const beat = barElapsed * bar.bpm / 60;
      setPlaybackPosition({ barIndex: bar.index, sectionId: bar.sectionId, measureIndex: bar.measureIndex, fraction: Math.min(1, beat / bar.measureBeats), beat });
    }
  }

  async function startPlayback() {
    if (!song || !composition) return;
    stopPlayback();
    const scope = playbackScope === "song" ? undefined : playbackScope;
    const timeline = buildSongTimeline(song, scope, playbackTempo / 100);
    if (!timeline.bars.length || timeline.duration <= 0) { setMessage("Add a section and measure before starting playback."); return; }
    const player = audioRef.current ?? createSongBuilderAudio();
    audioRef.current = player;
    timelineRef.current = timeline;
    metronomeCuesRef.current = makePlaybackCues(timeline);
    const pitches = timeline.events.filter((cue) => !cue.track.muted).flatMap((cue) => cue.pitches);
    setPlaybackState("loading");
    setMessage("Preparing the arrangement…");
    try {
      if (hearTracks) await player.prepare(pitches);
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
    countInSecondsRef.current = beatDuration * clickCount;
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

  async function exportNotation(format: "png" | "pdf") {
    if (!song || !composition) return;
    const scope = previewScope === "song" ? undefined : previewScope;
    try {
      const pages = renderNotationPages(song, notationView, scope);
      const base = `${safeName(song.title)}-${notationView}`;
      if (format === "pdf") downloadBlob(canvasesPdf(pages), `${base}.pdf`);
      else downloadBlob(await canvasPng(makeLongPng(pages)), `${base}.png`);
      setMessage(`${format.toUpperCase()} ${notationView === "tab" ? "tablature" : "notation"} downloaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The notation export failed.");
    }
  }

  if (!library) return <section className="song-builder card"><p>Loading Song Builder…</p></section>;

  return <div className="song-builder">
    <header className="song-builder-heading">
      <div><span className="label">Compose and rehearse</span><h1>Song Builder</h1><p>Create original arrangements for guitar, ukulele, and bass.</p></div>
      <Link className="btn" href="/song-library">Open Song Library</Link>
    </header>

    <div className="song-builder-shell">
      <aside className="song-builder-side card">
        <span className="label">Your songs</span>
        <h2>Start a composition</h2>
        <form className="song-builder-create" onSubmit={createSong}>
          <label>Song title<input required maxLength={160} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. The Long Way Home" /></label>
          <label>Artist<input required maxLength={160} value={newArtist} onChange={(event) => setNewArtist(event.target.value)} placeholder="Your name" /></label>
          <button className="btn primary" type="submit">Create song</button>
        </form>
        <p className="song-builder-save-note">Songs autosave in this browser and appear in Song Library.</p>
        <div className="song-builder-saved-list" aria-label="Saved songs">
          {songs.map((item) => <button key={item.id} type="button" className={selectedSongId === item.id ? "active" : ""} onClick={() => openSong(item)}><strong>{item.title}</strong><span>{item.artist}{item.composition ? " · editable" : " · convert to edit"}</span></button>)}
          {!songs.length ? <p>Your original songs will appear here.</p> : null}
        </div>
      </aside>

      {song && composition && section && track ? <main className="song-builder-main">
        <section className="song-builder-card card">
          <div className="song-builder-card-head"><div><span className="label">Song details</span><h2>{song.title}</h2></div><span className="song-builder-save" role="status">{saveMessage}</span></div>
          <div className="song-builder-fields">
            <label>Title<input value={titleDraft || song.title} maxLength={160} onChange={(event) => setTitleDraft(event.target.value)} onBlur={() => updateSongField("title", titleDraft)} /></label>
            <label>Artist<input value={artistDraft || song.artist} maxLength={160} onChange={(event) => setArtistDraft(event.target.value)} onBlur={() => updateSongField("artist", artistDraft)} /></label>
            <label>Key<select value={composition.key} onChange={(event) => updateComposition((current) => ({ ...current, key: event.target.value }))}>{SONG_BUILDER_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
            <label>Tempo · BPM<input type="number" min={40} max={240} value={composition.bpm} onChange={(event) => updateComposition((current) => ({ ...current, bpm: Math.max(40, Math.min(240, Number(event.target.value) || 90)) }))} /></label>
            <label>Time signature<select value={composition.timeSignature} onChange={(event) => updateComposition((current) => ({ ...current, timeSignature: event.target.value }))}>{SONG_BUILDER_METERS.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
        </section>

        <section className="song-builder-card card" aria-label="Arrangement sections">
          <div className="song-builder-card-head"><div><span className="label">Arrangement</span><h2>Sections and measures</h2></div><button className="btn" type="button" onClick={createSection}>Add section</button></div>
          <div className="song-builder-section-list">{composition.sections.map((item, index) => <div className={item.id === section.id ? "active" : ""} key={item.id}>
            <button type="button" className="song-builder-section-select" aria-pressed={item.id === section.id} onClick={() => { setActiveSectionId(item.id); setActiveMeasureIndex(0); }}><strong>{item.title}</strong><span>{item.kind} · {measureCount(item)} bars · repeats {item.repeats}</span></button>
            <div className="song-builder-icon-actions"><button type="button" aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => updateComposition((current) => reorderCompositionSection(current, item.id, -1))}>↑</button><button type="button" aria-label={`Move ${item.title} down`} disabled={index === composition.sections.length - 1} onClick={() => updateComposition((current) => reorderCompositionSection(current, item.id, 1))}>↓</button><button type="button" aria-label={`Duplicate ${item.title}`} onClick={() => { const next = duplicateCompositionSection(composition, item.id); saveComposition(next); setActiveSectionId(next.sections[index + 1]?.id ?? item.id); }}>＋</button><button type="button" aria-label={`Delete ${item.title}`} disabled={composition.sections.length < 2} onClick={() => { const next = removeCompositionSection(composition, item.id); saveComposition(next); if (item.id === activeSectionId) { setActiveSectionId(next.sections[0]?.id ?? ""); setActiveMeasureIndex(0); } }}>×</button></div>
          </div>)}</div>
          <div className="song-builder-fields song-builder-section-fields">
            <label>Section name<input value={section.title} maxLength={120} onChange={(event) => updateSection(section.id, (current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Section type<select value={section.kind} onChange={(event) => updateSection(section.id, (current) => ({ ...current, kind: event.target.value as SongCompositionSection["kind"] }))}>{["intro", "verse", "chorus", "bridge", "solo", "ending", "other"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label>Repeats<input type="number" min={1} max={32} value={section.repeats} onChange={(event) => updateSection(section.id, (current) => ({ ...current, repeats: Math.max(1, Math.min(32, Number(event.target.value) || 1)) }))} /></label>
            <label>Section tempo<input type="number" min={40} max={240} placeholder={`${composition.bpm} BPM`} value={section.bpm ?? ""} onChange={(event) => updateSection(section.id, (current) => ({ ...current, bpm: event.target.value ? Math.max(40, Math.min(240, Number(event.target.value) || composition.bpm)) : undefined }))} /></label>
            <label>Section meter<select value={section.timeSignature ?? composition.timeSignature} onChange={(event) => updateSection(section.id, (current) => ({ ...current, timeSignature: event.target.value === composition.timeSignature ? undefined : event.target.value }))}>{SONG_BUILDER_METERS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Section notes<input value={section.notes ?? ""} maxLength={2000} onChange={(event) => updateSection(section.id, (current) => ({ ...current, notes: event.target.value }))} placeholder="Arrangement notes" /></label>
            <label className="song-builder-wide">Lyrics<textarea value={section.lyrics ?? ""} maxLength={4000} rows={2} onChange={(event) => updateSection(section.id, (current) => ({ ...current, lyrics: event.target.value }))} placeholder="Optional lyrics for this section" /></label>
          </div>
          <div className="song-builder-measures"><strong>Bars</strong><div>{sectionMeasures.map((_, index) => <button type="button" key={index} className={activeMeasureIndex === index ? "active" : ""} aria-pressed={activeMeasureIndex === index} onClick={() => setActiveMeasureIndex(index)}>{index + 1}</button>)}<button type="button" onClick={() => { updateComposition((current) => addCompositionMeasure(current, section.id)); setActiveMeasureIndex(sectionMeasures.length); }}>＋ Add bar</button>{sectionMeasures.length > 1 ? <button type="button" className="text-button" onClick={() => { const index = Math.min(activeMeasureIndex, sectionMeasures.length - 1); updateComposition((current) => removeCompositionMeasure(current, section.id, activeMeasureIndex)); setActiveMeasureIndex(Math.max(0, index - (index === sectionMeasures.length - 1 ? 1 : 0))); }}>Remove selected bar</button> : null}</div></div>
        </section>

        <section className="song-builder-card card" aria-label="Instrument tracks">
          <div className="song-builder-card-head"><div><span className="label">Tracks</span><h2>Choose the part to edit</h2></div>{availableInstruments.length ? <div className="song-builder-add-track">{availableInstruments.map((instrument) => <button key={instrument} className="btn" type="button" onClick={() => addTrack(instrument)}>Add {instrument}</button>)}</div> : <span className="song-builder-muted">All instrument tracks added</span>}</div>
          <div className="song-builder-track-list">{composition.tracks.map((item) => <button key={item.id} type="button" aria-pressed={item.id === track.id} className={item.id === track.id ? "active" : ""} onClick={() => { setActiveTrackId(item.id); setNoteString(Math.min(noteString, item.tuning.length)); setActiveMeasureIndex((current) => Math.min(current, Math.max(0, (section?.measuresByTrack[item.id]?.length ?? 1) - 1))); }}><strong>{item.name}</strong><span>{item.instrument} · {item.tuningLabel}</span></button>)}</div>
          <div className="song-builder-fields song-builder-track-fields">
            <label>Track name<input value={track.name} maxLength={80} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Tuning<select value={isCustomTuning ? "custom" : matchingTuningPreset?.label ?? "custom"} onChange={(event) => { const preset = SONG_BUILDER_TUNINGS[track.instrument].find((item) => item.label === event.target.value); if (preset) updateTrack(track.id, (current) => updateTrackTuning(current, preset.midi, preset.label)); else { setCustomTuningDraft(track.tuning.map(midiNoteLabel).join(" ")); updateTrack(track.id, (current) => updateTrackTuning(current, current.tuning, "Custom tuning")); } }}><optgroup label={`${track.instrument} presets`}>{SONG_BUILDER_TUNINGS[track.instrument].map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}</optgroup><option value="custom">Custom tuning</option></select></label>
            <label>Capo<input type="number" min={0} max={12} value={track.capo} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, capo: Math.max(0, Math.min(12, Number(event.target.value) || 0)) }))} /></label>
            <label className="song-builder-check"><input type="checkbox" checked={track.muted === true} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, muted: event.target.checked }))} /> Mute during listen-back</label>
            {isCustomTuning ? <label className="song-builder-wide">Open strings · low to high<input value={customTuningDraft || track.tuning.map(midiNoteLabel).join(" ")} onChange={(event) => setCustomTuningDraft(event.target.value)} onBlur={() => { const pitches = parseTuningNotes(customTuningDraft); if (pitches) updateTrack(track.id, (current) => updateTrackTuning(current, pitches, `Custom · ${customTuningDraft.trim()}`)); else if (customTuningDraft.trim()) setMessage("Use note names with octaves, such as E2 A2 D3 G3 B3 E4."); }} placeholder="E2 A2 D3 G3 B3 E4" /></label> : null}
          </div>
          {composition.tracks.length > 1 ? <button className="text-button song-builder-remove-track" type="button" onClick={() => { const next = removeCompositionTrack(composition, track.id); saveComposition(next); setActiveTrackId(next.tracks[0]?.id ?? ""); }}>Remove {track.name} track</button> : null}
        </section>

        <section className="song-builder-card card" aria-label="Chord and note editor">
          <div className="song-builder-card-head"><div><span className="label">Bar {activeMeasureIndex + 1} · {section.title}</span><h2>{track.name} part</h2></div><span className="song-builder-muted">{stepCount} grid positions · {meter} · {section.bpm ?? composition.bpm} BPM</span></div>
          <div className="song-builder-fields song-builder-entry-fields">
            <label>Entry type<select value={eventMode} onChange={(event) => setEventMode(event.target.value as "chord" | "note")}><option value="chord">Chord</option><option value="note">Single note</option></select></label>
            {eventMode === "chord" ? <label>Chord name<input list="song-builder-chord-list" value={chordQuery} onChange={(event) => setChordQuery(event.target.value)} placeholder="Search chord names" /><datalist id="song-builder-chord-list">{queryChords.map((name) => <option key={name} value={name} />)}</datalist><small>{CHORD_LOOKUP.has(chordQuery) ? "Chord from Chord Hero library" : queryChords.length ? "Choose a suggested chord" : "Type a chord name"}</small></label> : <><label>String<select value={noteString} onChange={(event) => setNoteString(Number(event.target.value))}>{Array.from({ length: track.tuning.length }, (_, index) => track.tuning.length - index).map((number) => <option key={number} value={number}>String {number} · {midiNoteLabel(track.tuning[track.tuning.length - number])}</option>)}</select></label><label>Fret<input type="number" min={0} max={24} value={noteFret} onChange={(event) => setNoteFret(Math.max(0, Math.min(24, Number(event.target.value) || 0)))} /></label></>}
            <label>Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{DURATIONS.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}</select></label>
            <label className="song-builder-check"><input type="checkbox" checked={accentNext} onChange={(event) => setAccentNext(event.target.checked)} /> Accent next event</label>
          </div>
          <p className="song-builder-help">Choose a chord or fret a note, then select a position. Select an occupied position to remove its event. Empty positions are rests.</p>
          <div className="song-builder-fretboard" role="group" aria-label={eventMode === "note" ? "Choose a string and fret for a note" : "Choose a fret for each string in the chord voicing"}>
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
          <div className="song-builder-grid-scroll"><div className="song-builder-step-grid" style={{ "--steps": stepCount } as CSSProperties} role="group" aria-label={`${track.name} bar ${activeMeasureIndex + 1} composition grid`}>
            {Array.from({ length: stepCount }, (_, step) => {
              const event = eventAtStep(activeMeasure, step, composition.subdivision);
              const isPlayhead = playbackPosition?.sectionId === section.id && playbackPosition.measureIndex === activeMeasureIndex && Math.floor(playbackPosition.beat * composition.subdivision / 4) === step;
              const text = event ? event.kind === "chord" ? event.chord : `${event.string}:${event.fret}` : "·";
              return <button key={step} type="button" className={`${event ? "filled" : ""} ${event?.accent ? "accented" : ""} ${isPlayhead ? "playhead" : ""}`} aria-pressed={Boolean(event)} aria-label={`Grid position ${step + 1}: ${event ? `${event.kind} ${text}` : "rest"}. Activate to ${event ? "remove" : `add ${eventMode}`}.`} onClick={() => toggleGridEvent(step)}><small>{step + 1}</small><strong>{text}</strong></button>;
            })}
          </div></div>
          <div className="song-builder-grid-footer"><label>Grid subdivision<select value={composition.subdivision} onChange={(event) => updateComposition((current) => ({ ...current, subdivision: Number(event.target.value) as SongComposition["subdivision"] }))}>{SONG_BUILDER_SUBDIVISIONS.map((value) => <option key={value} value={value}>{value === 4 ? "Quarter notes" : value === 8 ? "Eighth notes" : value === 12 ? "Triplets" : "Sixteenth notes"}</option>)}</select></label><button className="btn" type="button" onClick={clearMeasure} disabled={!activeMeasure?.events.length}>Clear bar</button></div>
        </section>

        <section className="song-builder-card card" aria-label="Follow along and listen">
          <div className="song-builder-card-head"><div><span className="label">Follow along and listen</span><h2>Play the arrangement</h2></div><span className={`song-builder-play-state state-${playbackState}`} role="status">{playbackState === "count-in" ? `Count-in · ${countIn}` : playbackState === "idle" || playbackState === "finished" ? "Ready" : playbackState}</span></div>
          <div className="song-builder-transport">
            <label>Play<select value={playbackScope} disabled={["playing", "loading", "count-in"].includes(playbackState)} onChange={(event) => setPlaybackScope(event.target.value)}><option value="song">Full song</option>{composition.sections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            {playbackState === "idle" || playbackState === "finished" ? <button className="btn primary" type="button" onClick={() => void startPlayback()}>{playbackState === "finished" ? "Play again" : "Play"}</button> : playbackState === "paused" ? <button className="btn primary" type="button" onClick={resumePlayback}>Resume</button> : <button className="btn primary" type="button" onClick={pausePlayback} disabled={playbackState === "loading"}>Pause</button>}
            <button className="btn" type="button" onClick={stopPlayback} disabled={playbackState === "idle" || playbackState === "finished"}>Stop</button>
            <label className="song-builder-check"><input type="checkbox" checked={hearTracks} disabled={["playing", "loading", "count-in"].includes(playbackState)} onChange={(event) => setHearTracks(event.target.checked)} /> Hear tracks</label>
            <label className="song-builder-check"><input type="checkbox" checked={metronome} onChange={(event) => setMetronome(event.target.checked)} /> Metronome</label>
            <label className="song-builder-check"><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} /> Loop selected range</label>
            <label className="song-builder-tempo">Playback tempo · {playbackTempo}%<input type="range" min={50} max={120} step={5} value={playbackTempo} onChange={(event) => setPlaybackTempo(Number(event.target.value))} /></label>
          </div>
          <p className="song-builder-help">Hear tracks plays the composed notes. Turn it off to follow the moving score with only the metronome.</p>
        </section>

        <section className="song-builder-card card" aria-label="Notation preview and export">
          <div className="song-builder-card-head"><div><span className="label">Print and export</span><h2>Notation preview</h2></div><div className="song-builder-export-buttons"><label>Show<select value={previewScope} onChange={(event) => { setPreviewScope(event.target.value); setPage(0); }}><option value="song">Full song</option>{composition.sections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button className="btn" type="button" onClick={() => void exportNotation("png")}>Download PNG</button><button className="btn primary" type="button" onClick={() => void exportNotation("pdf")}>Download PDF</button></div></div>
          <div className="song-builder-notation-switch" role="group" aria-label="Notation view"><button type="button" aria-pressed={notationView === "tab"} className={notationView === "tab" ? "active" : ""} onClick={() => setNotationView("tab")}>Tablature</button><button type="button" aria-pressed={notationView === "staff"} className={notationView === "staff" ? "active" : ""} onClick={() => setNotationView("staff")}>Standard notation</button><span>Guitar and ukulele use treble notation; bass uses bass clef.</span></div>
          {pageCount > 1 ? <div className="song-builder-pages"><button type="button" disabled={boundedPage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous page</button><span>Page {boundedPage + 1} of {pageCount}</span><button type="button" disabled={boundedPage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next page</button></div> : null}
          <canvas ref={canvasRef} className="song-builder-canvas" aria-label={`${notationView === "tab" ? "Tablature" : "Standard notation"} preview for ${song.title}`} />
        </section>
      </main> : <main className="song-builder-empty card"><span className="label">Original music starts here</span><h2>Write the part you hear.</h2><p>Create a song or open one of your existing manual songs to turn its chords into an editable arrangement.</p><Link className="btn primary" href="/song-library">Browse Song Library</Link></main>}
    </div>
    <p className="song-builder-message" role="status">{message}</p>
  </div>;
}
