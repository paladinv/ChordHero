import { CHORD_LOOKUP } from "./chords";
import type { LibrarySong, SongComposition, SongCompositionEvent, SongCompositionMeasure, SongCompositionSection, SongCompositionTrack, SongInstrument } from "./songLibrary";

export const SONG_BUILDER_TUNINGS: Record<SongInstrument, { label: string; midi: number[] }[]> = {
  guitar: [
    { label: "Standard · E A D G B E", midi: [40, 45, 50, 55, 59, 64] },
    { label: "Drop D · D A D G B E", midi: [38, 45, 50, 55, 59, 64] },
    { label: "DADGAD · D A D G A D", midi: [38, 45, 50, 55, 57, 62] },
    { label: "Open G · D G D G B D", midi: [38, 43, 50, 55, 59, 62] },
    { label: "Half-step down", midi: [39, 44, 49, 54, 58, 63] },
  ],
  ukulele: [{ label: "Standard · G C E A", midi: [67, 60, 64, 69] }],
  bass: [{ label: "Standard · E A D G", midi: [28, 33, 38, 43] }],
};

const DEFAULT_TUNING: Record<SongInstrument, number[]> = {
  guitar: SONG_BUILDER_TUNINGS.guitar[0].midi,
  ukulele: SONG_BUILDER_TUNINGS.ukulele[0].midi,
  bass: SONG_BUILDER_TUNINGS.bass[0].midi,
};

export const SONG_BUILDER_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Am", "Em", "Bm", "F#m", "C#m", "G#m", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"];
export const SONG_BUILDER_METERS = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "12/8"];
export const SONG_BUILDER_SUBDIVISIONS = [4, 8, 12, 16] as const;

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const makeMeasures = (count: number): SongCompositionMeasure[] => Array.from({ length: count }, (_, index) => ({ id: uid(`measure-${index + 1}`), events: [] }));

export function meterParts(value: string) {
  const match = value.match(/^\s*(\d{1,2})\s*\/\s*(2|4|8|16)\s*$/);
  if (!match) return { numerator: 4, denominator: 4 };
  const numerator = Math.max(1, Math.min(16, Number(match[1])));
  return { numerator, denominator: Number(match[2]) };
}

export function measureQuarterBeats(meter: string) {
  const { numerator, denominator } = meterParts(meter);
  return numerator * 4 / denominator;
}

export function measureClickCount(meter: string) {
  return meterParts(meter).numerator;
}

export function measureStepCount(meter: string, subdivision: number) {
  return Math.max(1, Math.round(measureQuarterBeats(meter) * subdivision / 4));
}

export function createSongComposition(key = "C", bpm = 90, timeSignature = "4/4"): SongComposition {
  const track: SongCompositionTrack = { id: uid("track"), name: "Guitar", instrument: "guitar", tuning: [...DEFAULT_TUNING.guitar], tuningLabel: SONG_BUILDER_TUNINGS.guitar[0].label, capo: 0 };
  const section: SongCompositionSection = {
    id: uid("section"), title: "Verse", kind: "verse", repeats: 1,
    measuresByTrack: { [track.id]: makeMeasures(4) }, notes: "", lyrics: "",
  };
  return { version: 1, key, bpm, timeSignature, subdivision: 8, tracks: [track], sections: [section] };
}

export function addCompositionTrack(composition: SongComposition, instrument: SongInstrument): SongComposition {
  const tuning = SONG_BUILDER_TUNINGS[instrument][0];
  const track: SongCompositionTrack = { id: uid("track"), name: instrument === "ukulele" ? "Ukulele" : instrument[0].toUpperCase() + instrument.slice(1), instrument, tuning: [...tuning.midi], tuningLabel: tuning.label, capo: 0 };
  return { ...composition, tracks: [...composition.tracks, track], sections: composition.sections.map((section) => {
    const length = Math.max(1, ...Object.values(section.measuresByTrack).map((measures) => measures.length));
    return { ...section, measuresByTrack: { ...section.measuresByTrack, [track.id]: makeMeasures(length) } };
  }) };
}

export function addCompositionSection(composition: SongComposition, title = "New section"): SongComposition {
  const id = uid("section");
  const sections = composition.sections.map((section) => ({ ...section, measuresByTrack: { ...section.measuresByTrack } }));
  const measuresByTrack: Record<string, SongCompositionMeasure[]> = Object.fromEntries(composition.tracks.map((track) => [track.id, makeMeasures(4)]));
  return { ...composition, sections: [...sections, { id, title, kind: "verse", repeats: 1, notes: "", lyrics: "", measuresByTrack }] };
}

export function addCompositionMeasure(composition: SongComposition, sectionId: string): SongComposition {
  return { ...composition, sections: composition.sections.map((section) => section.id !== sectionId ? section : {
    ...section,
    measuresByTrack: Object.fromEntries(composition.tracks.map((track) => [track.id, [...(section.measuresByTrack[track.id] ?? []), ...makeMeasures(1)]])),
  }) };
}

export function reorderCompositionSection(composition: SongComposition, sectionId: string, direction: -1 | 1): SongComposition {
  const index = composition.sections.findIndex((section) => section.id === sectionId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= composition.sections.length) return composition;
  const sections = [...composition.sections];
  [sections[index], sections[destination]] = [sections[destination], sections[index]];
  return { ...composition, sections };
}

export function duplicateCompositionSection(composition: SongComposition, sectionId: string): SongComposition {
  const source = composition.sections.find((section) => section.id === sectionId);
  if (!source) return composition;
  const measuresByTrack = Object.fromEntries(Object.entries(source.measuresByTrack).map(([trackId, measures]) => [trackId, measures.map((measure) => {
    const measureId = uid("measure");
    return { ...measure, id: measureId, events: measure.events.map((event) => ({ ...event, id: uid("event") })) };
  })]));
  const duplicate: SongCompositionSection = { ...source, id: uid("section"), title: `${source.title} copy`, measuresByTrack };
  const index = composition.sections.findIndex((section) => section.id === sectionId);
  const sections = [...composition.sections];
  sections.splice(index + 1, 0, duplicate);
  return { ...composition, sections };
}

export function removeCompositionSection(composition: SongComposition, sectionId: string): SongComposition {
  if (composition.sections.length <= 1) return composition;
  return { ...composition, sections: composition.sections.filter((section) => section.id !== sectionId) };
}

export function removeCompositionTrack(composition: SongComposition, trackId: string): SongComposition {
  if (composition.tracks.length <= 1) return composition;
  return { ...composition, tracks: composition.tracks.filter((track) => track.id !== trackId), sections: composition.sections.map((section) => {
    const measuresByTrack = { ...section.measuresByTrack };
    delete measuresByTrack[trackId];
    return { ...section, measuresByTrack };
  }) };
}

export function removeCompositionMeasure(composition: SongComposition, sectionId: string, measureIndex: number): SongComposition {
  return { ...composition, sections: composition.sections.map((section) => {
    if (section.id !== sectionId) return section;
    return { ...section, measuresByTrack: Object.fromEntries(composition.tracks.map((track) => {
      const measures = [...(section.measuresByTrack[track.id] ?? [])];
      if (measures.length > 1) measures.splice(measureIndex, 1);
      return [track.id, measures];
    })) };
  }) };
}

export function measureCount(section: SongCompositionSection) {
  return Math.max(1, ...Object.values(section.measuresByTrack).map((measures) => measures.length));
}

export function chordIntervals(name: string): number[] {
  const root = name.match(/^([A-G](?:#|b)?)/)?.[1];
  const suffix = name.slice(root?.length ?? 0).split("/")[0]?.toLowerCase() ?? "";
  if (/dim|°/.test(suffix)) return /7/.test(suffix) ? [0, 3, 6, 9] : [0, 3, 6];
  if (/aug|\+/.test(suffix)) return [0, 4, 8];
  if (/sus2/.test(suffix)) return [0, 2, 7];
  if (/sus4|sus/.test(suffix)) return [0, 5, 7];
  const minor = /^m(?!aj)|min/.test(suffix);
  const fifth = /b5/.test(suffix) ? 6 : /#5/.test(suffix) ? 8 : 7;
  const tones = [0, minor ? 3 : 4, fifth];
  if (/maj7/.test(suffix)) tones.push(11);
  else if (/7|9|11|13/.test(suffix)) tones.push(10);
  if (/add9|9|11|13/.test(suffix)) tones.push(14);
  return [...new Set(tones)];
}

const PITCH_CLASS: Record<string, number> = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const STANDARD_GUITAR = [40, 45, 50, 55, 59, 64];

export function eventMidiPitches(track: SongCompositionTrack, event: SongCompositionEvent): number[] {
  if (event.kind === "note" && event.string && event.fret !== undefined) {
    const tuningIndex = track.tuning.length - event.string;
    if (tuningIndex < 0 || tuningIndex >= track.tuning.length) return [];
    return [track.tuning[tuningIndex] + track.capo + event.fret];
  }
  if (event.kind !== "chord") return [];
  if (event.voicing?.length) return event.voicing.flatMap((fret, index) => fret === null || index >= track.tuning.length ? [] : [track.tuning[index] + track.capo + fret]);
  const rootMatch = event.chord?.match(/^([A-G](?:#|b)?)/);
  if (!rootMatch) return [];
  const root = PITCH_CLASS[rootMatch[1]] ?? 0;
  const slashBass = event.chord?.match(/\/([A-G](?:#|b)?)/)?.[1];
  if (track.instrument === "guitar" && track.tuning.length === 6 && track.tuning.every((pitch, index) => pitch === STANDARD_GUITAR[index])) {
    const shape = CHORD_LOOKUP.get(event.chord!)?.frets;
    if (shape?.length === 6) return shape.flatMap((fret, index) => fret < 0 ? [] : [track.tuning[index] + track.capo + fret]);
  }
  const intervals = chordIntervals(event.chord ?? "");
  const base = track.instrument === "bass" ? 40 : track.instrument === "ukulele" ? 60 : 48;
  const notes = intervals.map((interval) => {
    const pitchClass = (root + interval) % 12;
    let midi = base + ((pitchClass - base + 120) % 12);
    if (midi < base + 3) midi += 12;
    return midi;
  });
  if (slashBass) {
    const slashPitch = PITCH_CLASS[slashBass];
    if (slashPitch !== undefined) notes.unshift(base + ((slashPitch - base + 120) % 12));
  }
  return [...new Set(notes)];
}

export type TimelineEvent = { at: number; duration: number; barIndex: number; track: SongCompositionTrack; event: SongCompositionEvent; pitches: number[] };
export type TimelineBar = {
  index: number;
  sectionId: string;
  sectionTitle: string;
  sectionKind: SongSectionSectionKind;
  repeat: number;
  measureIndex: number;
  meter: string;
  bpm: number;
  measureBeats: number;
  startsAt: number;
  duration: number;
  events: TimelineEvent[];
};
type SongSectionSectionKind = SongCompositionSection["kind"];
export type SongTimeline = { bars: TimelineBar[]; events: TimelineEvent[]; duration: number };

export function buildSongTimeline(song: LibrarySong, sectionId?: string, tempoScale = 1): SongTimeline {
  const composition = song.composition;
  if (!composition) return { bars: [], events: [], duration: 0 };
  const sections = sectionId ? composition.sections.filter((section) => section.id === sectionId) : composition.sections;
  const bars: TimelineBar[] = [];
  const events: TimelineEvent[] = [];
  let cursor = 0;
  for (const section of sections) {
    const meter = section.timeSignature || composition.timeSignature;
    const beats = measureQuarterBeats(meter);
    const bpm = Math.max(40, Math.min(240, Math.round((section.bpm || composition.bpm) * tempoScale)));
    const duration = beats * 60 / bpm;
    for (let repeat = 1; repeat <= section.repeats; repeat += 1) {
      for (let measureIndex = 0; measureIndex < measureCount(section); measureIndex += 1) {
        const index = bars.length;
        const bar: TimelineBar = { index, sectionId: section.id, sectionTitle: section.title, sectionKind: section.kind, repeat, measureIndex, meter, bpm, measureBeats: beats, startsAt: cursor, duration, events: [] };
        for (const track of composition.tracks) {
          const measure = section.measuresByTrack[track.id]?.[measureIndex];
          for (const event of measure?.events ?? []) {
            if (event.startBeat >= beats) continue;
            const cue: TimelineEvent = { at: cursor + event.startBeat * 60 / bpm, duration: Math.min(event.durationBeats, beats - event.startBeat) * 60 / bpm, barIndex: index, track, event, pitches: eventMidiPitches(track, event) };
            bar.events.push(cue);
            events.push(cue);
          }
        }
        bars.push(bar);
        cursor += duration;
      }
    }
  }
  events.sort((left, right) => left.at - right.at || left.track.id.localeCompare(right.track.id));
  return { bars, events, duration: cursor };
}

export function addOrRemoveEvent(composition: SongComposition, sectionId: string, trackId: string, measureIndex: number, event: SongCompositionEvent): SongComposition {
  return { ...composition, sections: composition.sections.map((section) => {
    if (section.id !== sectionId) return section;
    const measures = [...(section.measuresByTrack[trackId] ?? makeMeasures(measureIndex + 1))];
    while (measures.length <= measureIndex) measures.push(...makeMeasures(1));
    const current = measures[measureIndex];
    const existing = current.events.find((item) => Math.abs(item.startBeat - event.startBeat) < 0.0001);
    measures[measureIndex] = { ...current, events: existing ? current.events.filter((item) => item.id !== existing.id) : [...current.events, event].sort((a, b) => a.startBeat - b.startBeat) };
    return { ...section, measuresByTrack: { ...section.measuresByTrack, [trackId]: measures } };
  }) };
}

export function updateTrackTuning(track: SongCompositionTrack, tuning: number[], label = "Custom tuning"): SongCompositionTrack {
  return { ...track, tuning: tuning.slice(0, 7).map((pitch) => Math.max(20, Math.min(96, Math.round(pitch)))), tuningLabel: label };
}

export function midiNoteLabel(midi: number) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function parseTuningNotes(value: string) {
  const pitchClass: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const values = value.trim().split(/[\s,]+/).map((token) => {
    const match = token.match(/^([A-G](?:#|b)?)(-?\d)$/i);
    if (!match) return NaN;
    const semitone = pitchClass[match[1][0].toUpperCase() + match[1].slice(1)] ?? pitchClass[match[1].toUpperCase()];
    return semitone === undefined ? NaN : (Number(match[2]) + 1) * 12 + semitone;
  });
  return values.length >= 4 && values.length <= 7 && values.every(Number.isFinite) ? values : null;
}
