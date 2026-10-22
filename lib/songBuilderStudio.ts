import type { LibrarySong, SongComposition, SongCompositionEvent, SongCompositionMeasure, SongCompositionTrack } from "./songLibrary";
import { createManualSong, emptySongLibraryState, migrateSongLibraryState, normalizeComposition } from "./songLibrary";
import { eventMidiPitches, measureQuarterBeats } from "./songBuilder";
import { editMeasure, suggestVoicings, syncLinkedSections } from "./songBuilderEditing";
const uid = () => crypto.randomUUID();
export const RHYTHM_VALUES = [{ label: "Whole", symbol: "𝅝", beats: 4 }, { label: "Half", symbol: "𝅗𝅥", beats: 2 }, { label: "Quarter", symbol: "♩", beats: 1 }, { label: "Eighth", symbol: "♪", beats: .5 }, { label: "Sixteenth", symbol: "♬", beats: .25 }];
export type PatternKind = "strum" | "fingerpick" | "bass" | "drum-pop" | "drum-rock" | "drum-shuffle" | "drum-half-time" | "drum-disco";
export function measureBeats(composition: SongComposition, sectionId: string, index: number) {
  const section = composition.sections.find((item) => item.id === sectionId)!;
  return Object.values(section.measuresByTrack).find((measures) => measures[index]?.beats)?.[index]?.beats ?? measureQuarterBeats(section.timeSignature ?? composition.timeSignature);
}
/** Write a duration across barlines, maintaining all tracks and linking pitched fragments with ties. */
export function writeAcrossBars(composition: SongComposition, sectionId: string, trackId: string, index: number, event: SongCompositionEvent, removeId?: string) {
  let next = composition;
  if (removeId) {
    const original = next.sections.find(section => section.id === sectionId)?.measuresByTrack[trackId]?.[index]?.events.find(item => item.id === removeId);
    if (original?.splitGroup === original?.id && original && event.tie === original.tie) {
      const group = next.sections.find(section => section.id === sectionId)?.measuresByTrack[trackId]?.flatMap(bar => bar.events.filter(item => item.splitGroup === original.id)) ?? [];
      event = { ...event, tie: group.at(-1)?.tie ?? false };
    }
    const count = next.sections.find(section => section.id === sectionId)?.measuresByTrack[trackId]?.length ?? 0;
    for (let bar = 0; bar < count; bar++)
      next = editMeasure(next, sectionId, trackId, bar, measure => ({ ...measure, events: measure.events.filter(item => item.id !== removeId && !(original && original.splitGroup === original.id && item.splitGroup === original.id)) }));
  }
  let remaining = event.durationBeats;
  let start = event.startBeat;
  let bar = index;
  while (remaining > .00001) {
    if (bar >= 512)
      throw new Error("A section supports up to 512 bars.");
    const section = next.sections.find((item) => item.id === sectionId)!;
    const sourceId = section.linkedTo ?? sectionId;
    const beats = bar < (section.measuresByTrack[trackId]?.length ?? 0) ? measureBeats(next, sectionId, bar) : measureQuarterBeats(section.timeSignature ?? next.timeSignature);
    if (start >= beats) {
      start -= beats;
      bar++;
      continue;
    }
    next = {
      ...next, sections: next.sections.map((item) => item.id !== sourceId ? item : {
        ...item, measuresByTrack: Object.fromEntries(next.tracks.map((track) => {
          const measures = [...(item.measuresByTrack[track.id] ?? [])];
          while (measures.length <= bar)
            measures.push({ id: uid(), events: [] });
          return [track.id, measures];
        }))
      })
    };
    next = syncLinkedSections(next);
    const length = Math.min(remaining, beats - start);
    const fragment = { ...event, splitGroup: event.id, id: bar === index ? event.id : uid(), startBeat: start, durationBeats: length, tie: event.kind !== "rest" && Boolean(remaining > length + .00001 || event.tie) };
    next = editMeasure(next, sectionId, trackId, bar, (measure) => ({ ...measure, events: [...measure.events, fragment].sort((a, b) => a.startBeat - b.startBeat) }));
    remaining -= length;
    start = 0;
    bar++;
  }
  return next;
}
export function assignPitches(track: SongCompositionTrack, event: SongCompositionEvent, pitches: number[], position = 0): SongCompositionEvent {
  const used = new Set<number>();
  const voicing: Array<number | null> = track.tuning.map(() => null);
  for (const pitch of pitches) {
    const candidates = track.tuning.flatMap((open, index) => { const fret = pitch - open - track.capo; return fret >= 0 && fret <= 24 && !used.has(index) ? [{ index, fret }] : []; }).sort((a, b) => Math.abs(a.fret - position) - Math.abs(b.fret - position));
    const best = candidates[0];
    if (best) {
      used.add(best.index);
      voicing[best.index] = best.fret;
    }
  }
  if (event.kind === "chord")
    return { ...event, voicing, midiPitches: pitches };
  const index = voicing.findIndex((fret) => fret !== null);
  return { ...event, string: index >= 0 ? track.tuning.length - index : undefined, fret: index >= 0 ? voicing[index]! : undefined, midiPitches: pitches };
}
export function suggestFingerings(track: SongCompositionTrack, event: SongCompositionEvent, previousFret = 0) {
  const pitch = eventMidiPitches(track, event)[0];
  return track.tuning.flatMap((open, index) => { const fret = pitch - open - track.capo; return fret >= 0 && fret <= 24 ? [{ string: track.tuning.length - index, fret, distance: Math.abs(fret - previousFret) }] : []; }).sort((a, b) => a.distance - b.distance || a.fret - b.fret);
}
export function generatePattern(composition: SongComposition, sectionId: string, sourceId: string, targetId: string, kind: PatternKind) {
  const section = composition.sections.find((item) => item.id === sectionId)!;
  const source = composition.tracks.find((track) => track.id === sourceId)!;
  const target = composition.tracks.find((track) => track.id === targetId)!;
  const measures = section.measuresByTrack[sourceId] ?? [];
  let next = composition;
  if (kind.startsWith("drum-")) {
    if (target.instrument !== "percussion") throw new Error("Choose a percussion track for a drum groove.");
    const targetMeasures = section.measuresByTrack[targetId] ?? measures;
    targetMeasures.forEach((measure, index) => {
      const beats = measureBeats(composition, sectionId, index);
      const events: SongCompositionEvent[] = [];
      const add = (beat: number, midi: number, accent = false) => {
        if (beat < beats - 0.001) events.push({ id: uid(), kind: "note", startBeat: beat, durationBeats: Math.min(0.18, beats - beat), midiPitches: [midi], velocity: accent ? 0.92 : 0.7, accent });
      };
      if (kind === "drum-shuffle") {
        for (let beat = 0, step = 0; beat < beats - 0.001; beat += 1 / 3, step += 1) add(beat, step % 3 === 0 ? 51 : 42, step % 3 === 0);
        for (let beat = 0; beat < beats; beat += 1) { if (beat % 2 === 0) add(beat, 36, beat === 0); if (beat % 2 === 1) add(beat, 38, true); }
      } else {
        for (let beat = 0, step = 0; beat < beats - 0.001; beat += 0.5, step += 1) add(beat, kind === "drum-disco" && step % 2 === 0 ? 51 : kind === "drum-rock" && beat >= beats - 0.5 ? 46 : 42, step % 2 === 0);
        for (let beat = 0; beat < beats; beat += 1) {
          if (kind === "drum-half-time") {
            if (beat === 0) add(beat, 36, true);
            if (beat === Math.floor(beats / 2)) add(beat, 38, true);
          } else if (kind === "drum-disco") {
            add(beat, 36, beat === 0);
            if (beat % 2 === 1) add(beat, 38, true);
          } else {
            if (beat % 2 === 0) add(beat, 36, beat === 0);
            if (beat % 2 === 1) add(beat, 38, true);
          }
        }
      }
      next = editMeasure(next, sectionId, targetId, index, (current) => ({ ...current, events: events.sort((left, right) => left.startBeat - right.startBeat || (left.midiPitches?.[0] ?? 0) - (right.midiPitches?.[0] ?? 0)) }));
    });
    return next;
  }
  if (target.instrument === "percussion") throw new Error("Choose a guitar, bass, or keyboard track for a pitched pattern.");
  let lastChord: SongCompositionEvent | undefined;
  measures.forEach((measure, index) => {
    const chords = measure.events.filter((event) => event.kind === "chord").sort((a, b) => a.startBeat - b.startBeat);
    const beats = measureBeats(composition, sectionId, index);
    const events: SongCompositionEvent[] = [];
    for (let beat = 0, step = 0; beat < beats - .001; beat += .5, step++) {
      const chord = chords.filter((event) => event.startBeat <= beat).at(-1) ?? lastChord;
      if (!chord)
        continue;
      const pitches = eventMidiPitches(source, chord);
      if (!pitches.length)
        continue;
      const shape = suggestVoicings(target, chord.chord ?? "C")[0];
      const voiced = shape ? eventMidiPitches(target, { ...chord, voicing: shape, midiPitches: undefined }) : pitches;
      if (kind === "strum")
        events.push({ id: uid(), kind: "chord", chord: chord.chord, voicing: shape, startBeat: beat, durationBeats: Math.min(.5, beats - beat), technique: step % 2 ? "strum-up" : "strum-down", strumSeconds: .025, accent: step % 4 === 0 });
      else {
        const roots: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
        const rootName = chord.chord?.match(/^([A-G](?:#|b)?)/)?.[1];
        const slash = chord.chord?.match(/\/([A-G](?:#|b)?)/)?.[1];
        const root = rootName ? roots[rootName] : pitches[0] % 12;
        const bassRoot = slash ? roots[slash] : root;
        const low = Math.min(...target.tuning) + target.capo;
        const pitch = kind === "bass" ? low + (((step % 4 === 2 ? (root + 7) % 12 : bassRoot) - low + 120) % 12) : voiced[[0, 2, 1, 3, 0, 2, 1, 3][step % 8] % voiced.length];
        events.push(assignPitches(target, { id: uid(), kind: "note", startBeat: beat, durationBeats: Math.min(.5, beats - beat) }, [pitch]));
      }
    }
    lastChord = chords.at(-1) ?? lastChord;
    next = editMeasure(next, sectionId, targetId, index, (current) => ({ ...current, events }));
  });
  return next;
}
export function portableSong(song: LibrarySong) {
  return { format: "chord-hero-composition", version: 1, savedAt: new Date().toISOString(), song: { title: song.title, artist: song.artist, composition: song.composition, builderPhrases: song.builderPhrases ?? [], builderArrangements: song.builderArrangements ?? [] } };
}
export function readPortableSong(text: string): Pick<LibrarySong, "title" | "artist" | "composition" | "builderPhrases" | "builderArrangements"> {
  const file = JSON.parse(text);
  if (file?.format !== "chord-hero-composition" || file.version !== 1)
    throw new Error("Choose a Chord Hero composition file.");
  const composition = normalizeComposition(file.song?.composition);
  if (!composition)
    throw new Error("The composition is invalid.");
  const title = String(file.song.title || "Imported composition").slice(0, 160);
  const artist = String(file.song.artist || "Unknown artist").slice(0, 160);
  const base = createManualSong({ title, artist, key: composition.key, bpm: composition.bpm, timeSignature: composition.timeSignature, chords: [] });
  const normalized = migrateSongLibraryState({ ...emptySongLibraryState(), songs: [{ ...base, composition, builderPhrases: Array.isArray(file.song.builderPhrases) ? file.song.builderPhrases : [], builderArrangements: Array.isArray(file.song.builderArrangements) ? file.song.builderArrangements : [] }] }).songs[0];
  return { title, artist, composition: normalized.composition, builderPhrases: normalized.builderPhrases, builderArrangements: normalized.builderArrangements };
}
