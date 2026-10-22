import type { SongComposition, SongCompositionEvent, SongCompositionMeasure, SongCompositionSection, SongCompositionTrack } from "./songLibrary";
import { addCompositionTrack, chordIntervals, createSongComposition, eventMidiPitches, measureCount, measureQuarterBeats } from "./songBuilder";

const uid = () => crypto.randomUUID();
export const TECHNIQUES = ["hammer-on", "pull-off", "slide", "bend", "vibrato", "palm-mute", "strum-up", "strum-down"] as const;
export const TEMPLATES = ["Blank", "Pop song", "Twelve-bar blues", "Fingerpicking", "Bass groove", "Folk acoustic", "Indie pop band", "Rock band", "R&B keys"] as const;
export type BuilderTemplate = typeof TEMPLATES[number];

export function resolveSection(composition: SongComposition, section: SongCompositionSection): SongCompositionSection {
  const source = composition.sections.find((item) => item.id === section.linkedTo && !item.linkedTo);
  return source ? { ...source, id: section.id, title: section.title, repeats: section.repeats, linkedTo: source.id, pageBreak: section.pageBreak } : section;
}

export function syncLinkedSections(composition: SongComposition): SongComposition {
  return { ...composition, sections: composition.sections.map((section) => resolveSection(composition, section)) };
}

export function editMeasure(composition: SongComposition, sectionId: string, trackId: string, index: number, change: (measure: SongCompositionMeasure) => SongCompositionMeasure) {
  const section = composition.sections.find((item) => item.id === sectionId);
  const sourceId = section?.linkedTo ?? sectionId;
  return syncLinkedSections({ ...composition, sections: composition.sections.map((item) => item.id !== sourceId ? item : { ...item, measuresByTrack: { ...item.measuresByTrack, [trackId]: (item.measuresByTrack[trackId] ?? []).map((measure, position) => position === index ? change(measure) : measure) } }) });
}

export function transposeEvent(event: SongCompositionEvent, semitones: number): SongCompositionEvent {
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const rootValues: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  return { ...event, id: uid(), chord: event.chord?.replace(/(^|\/)([A-G](?:#|b)?)/g, (_, prefix: string, root: string) => prefix + names[(rootValues[root] + semitones + 120) % 12]), fret: event.fret === undefined ? undefined : event.fret + semitones, voicing: event.voicing?.map((fret) => fret === null ? null : fret + semitones), midiPitches: event.midiPitches?.map((pitch) => pitch + semitones) };
}

export function pasteMeasures(composition: SongComposition, sectionId: string, trackId: string, start: number, clipboard: SongCompositionMeasure[], transpose = 0, shift = 0) {
  const target = composition.sections.find((section) => section.id === sectionId);
  if (!target) return composition;
  const sourceId = target.linkedTo ?? sectionId;
  const copiedIds=new Map(clipboard.flatMap(measure=>measure.events.map(event=>[event.id,uid()] as const)));
  return syncLinkedSections({ ...composition, sections: composition.sections.map((section) => {
    if (section.id !== sourceId) return section;
    const count = Math.max(measureCount(section), start + clipboard.length);
    const measuresByTrack = Object.fromEntries(composition.tracks.map((track) => {
      const measures = [...(section.measuresByTrack[track.id] ?? [])];
      while (measures.length < count) measures.push({ id: uid(), events: [] });
      if (track.id === trackId) clipboard.forEach((measure, offset) => { measures[start + offset] = { id: uid(), events: measure.events.map((event) => {
        const copied = { ...transposeEvent(event, transpose), id:copiedIds.get(event.id)!, connectedTo:event.connectedTo?copiedIds.get(event.connectedTo):undefined, splitGroup:event.splitGroup?copiedIds.get(event.splitGroup):undefined, startBeat: event.startBeat + shift };
        if (copied.midiPitches?.length) {
          const occupied = new Set<number>();
          const frets: Array<number | null> = track.tuning.map(() => null);
          for (const pitch of copied.midiPitches) {
            const candidates = track.tuning.flatMap((open, index) => { const fret = pitch - open - track.capo; return fret >= 0 && fret <= 24 && !occupied.has(index) ? [{ index, fret }] : []; }).sort((a, b) => a.fret - b.fret);
            const best = candidates[0]; if (best) { occupied.add(best.index); frets[best.index] = best.fret; }
          }
          if (copied.kind === "chord") copied.voicing = frets;
          else { const index = frets.findIndex((fret) => fret !== null); copied.string = index < 0 ? undefined : track.tuning.length - index; copied.fret = index < 0 ? undefined : frets[index]!; }
        }
        return copied;
      }) }; });
      return [track.id, measures];
    }));
    return { ...section, measuresByTrack };
  }) });
}

/** Search practical frets and rank shapes by hand span and distance from the last chord. */
export function suggestVoicings(track: SongCompositionTrack, chord: string, previous?: Array<number | null>) {
  if (!(["guitar", "ukulele", "bass"] as string[]).includes(track.instrument)) return [];
  const root = chord.match(/^([A-G](?:#|b)?)/)?.[1];
  const values: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  if (!root) return [];
  const tones = chordIntervals(chord).map((interval) => (values[root] + interval) % 12);
  const results: { frets: Array<number | null>; score: number }[] = [];
  for (let position = 0; position <= 9; position++) {
    const frets = track.tuning.map((pitch) => {
      for (let fret = position; fret <= position + 3; fret++) if (tones.includes((pitch + track.capo + fret) % 12)) return fret;
      return null;
    });
    const sounded = frets.flatMap((fret, i) => fret === null ? [] : [(track.tuning[i] + track.capo + fret) % 12]);
    if (new Set(sounded).size < Math.min(tones.length, 3) || !sounded.includes(values[root])) continue;
    if (results.some((item) => item.frets.join() === frets.join())) continue;
    const distance = frets.reduce<number>((sum, fret, i) => sum + Math.abs((fret ?? 0) - (previous?.[i] ?? 0)), 0);
    results.push({ frets, score: previous ? distance : position });
  }
  return results.sort((a, b) => a.score - b.score).slice(0, 4).map((item) => item.frets);
}

const CHORD_ROOTS: Record<string, number> = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const SCALE_NOTES: Record<string, string[]> = {
  C: ["C", "D", "E", "F", "G", "A", "B"], G: ["G", "A", "B", "C", "D", "E", "F#"], D: ["D", "E", "F#", "G", "A", "B", "C#"], A: ["A", "B", "C#", "D", "E", "F#", "G#"], E: ["E", "F#", "G#", "A", "B", "C#", "D#"], B: ["B", "C#", "D#", "E", "F#", "G#", "A#"], "F#": ["F#", "G#", "A#", "B", "C#", "D#", "E#"], "C#": ["C#", "D#", "E#", "F#", "G#", "A#", "B#"],
  F: ["F", "G", "A", "Bb", "C", "D", "E"], Bb: ["Bb", "C", "D", "Eb", "F", "G", "A"], Eb: ["Eb", "F", "G", "Ab", "Bb", "C", "D"], Ab: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
  Am: ["A", "B", "C", "D", "E", "F", "G"], Em: ["E", "F#", "G", "A", "B", "C", "D"], Bm: ["B", "C#", "D", "E", "F#", "G", "A"], "F#m": ["F#", "G#", "A", "B", "C#", "D", "E"], "C#m": ["C#", "D#", "E", "F#", "G#", "A", "B"], "G#m": ["G#", "A#", "B", "C#", "D#", "E", "F#"], Dm: ["D", "E", "F", "G", "A", "Bb", "C"], Gm: ["G", "A", "Bb", "C", "D", "Eb", "F"], Cm: ["C", "D", "Eb", "F", "G", "Ab", "Bb"], Fm: ["F", "G", "Ab", "Bb", "C", "Db", "Eb"], Bbm: ["Bb", "C", "Db", "Eb", "F", "Gb", "Ab"], Ebm: ["Eb", "F", "Gb", "Ab", "Bb", "Cb", "Db"],
};

/** Diatonic triads that fit the song key, suitable for reharmonizing a selected chord. */
export function suggestHarmonicChords(key: string, current = "") {
  const minor = /m$/.test(key);
  const scaleNotes = SCALE_NOTES[key];
  if (!scaleNotes) return [];
  const scale = scaleNotes.map((note) => CHORD_ROOTS[note]);
  return scale.map((degree, index) => {
    const third = (scale[(index + 2) % 7] + (index + 2 >= 7 ? 12 : 0)) - degree;
    const fifth = (scale[(index + 4) % 7] + (index + 4 >= 7 ? 12 : 0)) - degree;
    const quality = third === 3 && fifth === 6 ? "dim" : third === 3 ? "m" : "";
    const chord = `${scaleNotes[index]}${quality}`;
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII"][index];
    return { chord, roman: quality === "m" ? roman.toLowerCase() : quality === "dim" ? `${roman.toLowerCase()}°` : roman };
  }).filter((item) => item.chord !== current);
}

export function alignSectionLyrics(composition: SongComposition, sectionId: string, trackId: string) {
  const occurrence = composition.sections.find((item) => item.id === sectionId);
  if (!occurrence) return composition;
  const sourceId = occurrence.linkedTo ?? occurrence.id;
  const source = composition.sections.find((item) => item.id === sourceId);
  if (!source) return composition;
  const words = (source.lyrics ?? "").trim().split(/\s+/).filter(Boolean);
  const measures = source.measuresByTrack[trackId] ?? [];
  const notes = measures.flatMap((measure, measureIndex) => measure.events.filter((event) => event.kind === "note" && (Boolean(event.midiPitches?.length) || event.string !== undefined)).map((event) => ({ id: event.id, measureIndex, startBeat: event.startBeat })));
  const aligned = new Map<string, string>();
  if (words.length && notes.length) notes.forEach((note, index) => aligned.set(note.id, words[Math.min(words.length - 1, Math.floor(index * words.length / notes.length))]));
  if (!words.length || !notes.length) return composition;
  const next = { ...composition, sections: composition.sections.map((section) => section.id !== sourceId ? section : { ...section, measuresByTrack: { ...section.measuresByTrack, [trackId]: measures.map((measure) => ({ ...measure, events: measure.events.map((event) => aligned.has(event.id) ? { ...event, lyric: aligned.get(event.id) } : event) })) } }) };
  return syncLinkedSections(next);
}

export type CompositionIssue = { sectionId: string; trackId: string; measureIndex: number; message: string };
export function checkComposition(composition: SongComposition): CompositionIssue[] {
  const issues: CompositionIssue[] = [];
  const keyRoot = CHORD_ROOTS[composition.key.replace(/m$/, "")];
  const minorKey = /m$/.test(composition.key);
  const keyScale = keyRoot === undefined ? [] : (minorKey ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map((step) => (keyRoot + step) % 12);
  const ranges: Record<SongCompositionTrack["instrument"], [number, number]> = { guitar: [40, 88], ukulele: [60, 88], bass: [28, 67], piano: [21, 108], vocals: [36, 84], percussion: [35, 81] };
  for (const section of composition.sections) for (const track of composition.tracks) {
    const beats = measureQuarterBeats(section.timeSignature ?? composition.timeSignature);
    (section.measuresByTrack[track.id] ?? []).forEach((measure, measureIndex) => {
      const length = measure.beats??beats;
      const report = (message: string) => issues.push({ sectionId: section.id, trackId: track.id, measureIndex, message: `${section.title}, ${track.name}, bar ${measureIndex + 1}: ${message}` });
      const events = [...measure.events].sort((a, b) => a.startBeat - b.startBeat);
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (event.startBeat < 0 || !event.grace && event.startBeat + event.durationBeats > length + 0.001) report("event extends outside the measure.");
        const fretted = ["guitar", "ukulele", "bass"].includes(track.instrument);
        if (events.slice(0, i).some((previous) => !event.grace && !previous.grace && previous.startBeat + previous.durationBeats > event.startBeat + 0.001 && (previous.kind === "rest" || event.kind === "rest" || fretted && (previous.kind === "chord" || event.kind === "chord" || previous.string === event.string)))) report("overlapping events on the same part.");
        const pitches = eventMidiPitches(track, event);
        if (pitches.some((pitch) => pitch < 0 || pitch > 127)) report("pitch is outside MIDI range (0–127).");
        if (event.kind !== "rest" && !pitches.length) report("event has no playable pitches.");
        const [low, high] = ranges[track.instrument];
        if (pitches.some((pitch) => pitch < low || pitch > high)) report(`pitch is outside the usual ${track.instrument} range (${low}–${high}).`);
        if (event.kind === "chord" && keyScale.length) {
          const root = event.chord?.match(/^([A-G](?:#|b)?)/)?.[1];
          const pitchClass = root ? CHORD_ROOTS[root] : undefined;
          if (pitchClass !== undefined && !keyScale.includes(pitchClass)) report(`review ${event.chord}: its root is outside the selected ${composition.key} scale.`);
        }
        const frets = event.voicing?.filter((fret): fret is number => fret !== null) ?? (event.fret === undefined ? [] : [event.fret]);
        if (["guitar", "ukulele", "bass"].includes(track.instrument) && frets.some((fret) => fret < 0 || fret > 24)) report("fret is outside the playable range (0–24).");
        const fingered = frets.filter((fret) => fret > 0);
        if (fingered.length > 1 && Math.max(...fingered) - Math.min(...fingered) > 4) report("chord requires a wide hand stretch.");
        if (fretted && event.kind === "note" && event.midiPitches?.length && (!event.string || event.midiPitches.length > 1)) report("imported pitches need a playable string assignment for complete tablature.");
        if (fretted && event.kind === "chord" && !event.voicing?.some((fret) => fret !== null)) report("choose a fretted chord voicing for complete tablature.");
        if (event.tie && !events[i + 1] && measureIndex === (section.measuresByTrack[track.id]?.length ?? 0) - 1) report("tie has no following event in this section.");
      }
    });
  }
  for (const section of composition.sections) for (const measureIndex of Array.from({ length: Math.max(1, ...composition.tracks.map((track) => section.measuresByTrack[track.id]?.length ?? 0)) }, (_, index) => index)) {
    const notes = composition.tracks.flatMap((track) => (section.measuresByTrack[track.id]?.[measureIndex]?.events ?? []).flatMap((event) => event.kind === "rest" || track.instrument === "percussion" ? [] : eventMidiPitches(track, event).map((pitch) => ({ track, event, pitch }))));
    const duplicate = notes.find((note, index) => notes.some((other, otherIndex) => otherIndex > index && other.track.id !== note.track.id && other.pitch === note.pitch && Math.abs(other.event.startBeat - note.event.startBeat) < 0.001));
    if (duplicate) issues.push({ sectionId: section.id, trackId: duplicate.track.id, measureIndex, message: `${section.title}, bar ${measureIndex + 1}: ${duplicate.track.name} shares a simultaneous pitch with another track.` });
  }
  return issues;
}

export function createTemplate(template: BuilderTemplate): SongComposition {
  if (["Folk acoustic", "Indie pop band", "Rock band", "R&B keys"].includes(template)) return createGenreTemplate(template);
  const composition = createSongComposition();
  if (template === "Blank") return composition;
  const track = composition.tracks[0];
  if (template === "Bass groove") Object.assign(track, { name: "Bass", instrument: "bass", tuning: [28, 33, 38, 43], tuningLabel: "Standard · E A D G" });
  const progression = template === "Twelve-bar blues" ? ["C7", "C7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"] : ["C", "G", "Am", "F"];
  const measures = progression.map((chord) => ({ id: uid(), events: template === "Fingerpicking" || template === "Bass groove" ? Array.from({ length: 8 }, (_, i) => ({ id: uid(), kind: "note" as const, startBeat: i / 2, durationBeats: 0.5, string: template === "Bass groove" ? 4 : [6, 3, 2, 1, 4, 3, 2, 1][i], fret: template === "Bass groove" ? [0, 0, 3, 5, 0, 7, 5, 3][i] : 0 })) : [{ id: uid(), kind: "chord" as const, chord, voicing: suggestVoicings(track, chord)[0], startBeat: 0, durationBeats: 4 }] }));
  const source = { ...composition.sections[0], measuresByTrack: { [track.id]: measures } };
  composition.sections = template === "Pop song" ? [source, { ...source, id: uid(), title: "Chorus", kind: "chorus", measuresByTrack: { [track.id]: measures.map((measure) => ({ ...measure, id: uid(), events: measure.events.map((event) => ({ ...event, id: uid() })) })) } }, { ...source, id: uid(), title: "Verse reprise", linkedTo: source.id }] : [source];
  return composition;
}

function createGenreTemplate(template: BuilderTemplate): SongComposition {
  const isKeys = template === "R&B keys";
  let composition = createSongComposition(isKeys ? "Am" : template === "Rock band" ? "E" : template === "Folk acoustic" ? "G" : "C", isKeys ? 88 : template === "Rock band" ? 122 : template === "Folk acoustic" ? 98 : 108, "4/4");
  composition.subdivision = 8;
  const lead = composition.tracks[0];
  if (isKeys) {
    Object.assign(lead, { name: "Keys", instrument: "piano" as const, tuning: [36, 48, 60, 72, 84], tuningLabel: "MIDI range · C2–C6" });
  }
  if (template !== "Folk acoustic") {
    composition = addCompositionTrack(composition, "bass");
    composition = addCompositionTrack(composition, "percussion");
    if (template === "Indie pop band") composition = addCompositionTrack(composition, "piano");
  } else composition = addCompositionTrack(composition, "bass");

  const verse = template === "R&B keys" ? ["Am7", "Dm7", "G7", "Cmaj7"] : template === "Rock band" ? ["E", "A", "D", "A"] : template === "Folk acoustic" ? ["G", "D", "Em", "C"] : ["C", "G", "Am", "F"];
  const chorus = template === "Rock band" ? ["A", "E", "B", "E"] : template === "R&B keys" ? ["Fmaj7", "Em7", "Dm7", "E7"] : template === "Folk acoustic" ? ["C", "G", "D", "G"] : ["F", "C", "G", "Am"];
  const tracks = composition.tracks;
  const guitar = tracks.find((track) => track.instrument === "guitar" || track.instrument === "ukulele");
  const keyboard = tracks.find((track) => track.instrument === "piano");
  const bass = tracks.find((track) => track.instrument === "bass");
  const drums = tracks.find((track) => track.instrument === "percussion");
  const rootValue: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const noteAt = (pitchClass: number, low: number, high: number) => { for (let pitch = low; pitch <= high; pitch += 1) if (pitch % 12 === pitchClass) return pitch; return low; };
  const buildPart = (chords: string[]) => Object.fromEntries(tracks.map((track) => [track.id, chords.map((chord) => {
    const root = chord.match(/^([A-G](?:#|b)?)/)?.[1] ?? "C";
    const rootPitchClass = rootValue[root] ?? 0;
    const events: SongCompositionEvent[] = [];
    if (guitar?.id === track.id) {
      const voicing = suggestVoicings(track, chord)[0];
      for (let step = 0; step < 8; step += 1) events.push({ id: uid(), kind: "chord", chord, voicing, startBeat: step / 2, durationBeats: 0.5, technique: step % 2 ? "strum-up" : "strum-down", accent: step % 4 === 0, strumSeconds: 0.018 });
    } else if (keyboard?.id === track.id) {
      const starts = template === "Indie pop band" ? [0.25, 2.25] : [0, 2];
      events.push({ id: uid(), kind: "chord", chord, startBeat: starts[0], durationBeats: template === "Indie pop band" ? 0.72 : 1.8, velocity: 0.78, accent: true });
      events.push({ id: uid(), kind: "chord", chord, startBeat: starts[1], durationBeats: template === "Indie pop band" ? 0.72 : 1.6, velocity: 0.64 });
    } else if (bass?.id === track.id) {
      const rootPitch = noteAt(rootPitchClass, 28, 40);
      const fifthPitch = noteAt((rootPitchClass + 7) % 12, 28, 40);
      const pattern = template === "Folk acoustic" ? [0, 2] : [0, 1, 2, 3];
      pattern.forEach((beat) => {
        const pitch = beat % 2 === 0 ? rootPitch : fifthPitch;
        const note: SongCompositionEvent = { id: uid(), kind: "note", startBeat: beat, durationBeats: beat === 2 ? 0.85 : 0.72 };
        const stringIndex = track.tuning.findIndex((open) => pitch - open - track.capo >= 0 && pitch - open - track.capo <= 24);
        events.push({ ...note, midiPitches: [pitch], ...(stringIndex >= 0 ? { string: track.tuning.length - stringIndex, fret: pitch - track.tuning[stringIndex] - track.capo } : {}) });
      });
    } else if (drums?.id === track.id) {
      const kick = template === "R&B keys" ? 36 : 36;
      const snare = template === "R&B keys" ? 39 : 38;
      const hatBeats = template === "R&B keys" ? [0.5, 1.5, 2.5, 3.5] : Array.from({ length: 8 }, (_, index) => index / 2);
      [0, 2].forEach((beat) => events.push({ id: uid(), kind: "note", startBeat: beat, durationBeats: 0.25, midiPitches: [kick], velocity: beat === 0 ? 0.95 : 0.8 }));
      [1, 3].forEach((beat) => events.push({ id: uid(), kind: "note", startBeat: beat, durationBeats: 0.25, midiPitches: [snare], velocity: 0.82, accent: beat === 3 }));
      hatBeats.forEach((beat) => events.push({ id: uid(), kind: "note", startBeat: beat, durationBeats: 0.2, midiPitches: [42], velocity: 0.42 }));
    }
    return { id: uid(), events: events.sort((left, right) => left.startBeat - right.startBeat) };
  })]));

  const makeSection = (title: string, kind: SongCompositionSection["kind"], chords: string[]): SongCompositionSection => ({ id: uid(), title, kind, repeats: 1, measuresByTrack: buildPart(chords), notes: template === "R&B keys" ? "Try a relaxed pocket; leave space between the keys and bass." : "Use the starter groove as a sketch and reshape it to fit your song.", lyrics: "" });
  composition.sections = [makeSection("Verse", "verse", verse), makeSection("Chorus", "chorus", chorus)];
  return composition;
}

export function eventLabel(event: SongCompositionEvent) {
  return event.kind === "rest" ? "Rest" : event.kind === "chord" ? event.chord ?? "Chord" : event.midiPitches?.join(", ") ?? `String ${event.string}, fret ${event.fret}`;
}

export function samePitches(track: SongCompositionTrack, left: SongCompositionEvent, right: SongCompositionEvent) {
  return eventMidiPitches(track, left).slice().sort().join() === eventMidiPitches(track, right).slice().sort().join();
}
