import type { ChordLibraryItem } from "./chords";

const NOTE_CLASSES: Readonly<Record<string, number>> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
  "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const QUALITY_INTERVALS: Readonly<Record<string, readonly number[]>> = {
  major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6], dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11], minor7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 2, 4, 7]
};
const STANDARD_OPEN_MIDI = [40, 45, 50, 55, 59, 64];

const pitchClass = (note: string) => NOTE_CLASSES[note] ?? null;
const normalize = (value: number) => ((value % 12) + 12) % 12;
const signedDelta = (value: number) => {
  const normalized = normalize(value);
  return normalized > 6 ? normalized - 12 : normalized;
};
const noteName = (value: number) => NOTE_NAMES[normalize(value)];

export type ChordSpellingPreference = "key-aware" | "sharp" | "flat" | "both";

const noteSpelling = (value: number, preference: Exclude<ChordSpellingPreference, "key-aware" | "both"> | "key-aware", key: string) => {
  const preferFlat = preference === "flat" || (preference === "key-aware" && /b|F$|Bb$|Eb$|Ab$|Db$|Gb$/.test(key));
  return (preferFlat ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] : NOTE_NAMES)[normalize(value)];
};

/** Display a chord using an explicit spelling preference without changing its pitch. */
export function spellChordName(name: string, key: string, preference: ChordSpellingPreference = "key-aware") {
  const parts = name.split("/");
  const spellPart = (part: string, mode: "sharp" | "flat" | "key-aware") => {
    const match = part.match(/^([A-G](?:#|b)?)(.*)$/);
    if (!match) return part;
    const root = pitchClass(match[1]);
    return root === null ? part : `${noteSpelling(root, mode, key)}${match[2]}`;
  };
  if (preference === "both") {
    const sharp = parts.map((part) => spellPart(part, "sharp")).join("/");
    const flat = parts.map((part) => spellPart(part, "flat")).join("/");
    return sharp === flat ? sharp : `${sharp} (${flat})`;
  }
  return parts.map((part) => spellPart(part, preference)).join("/");
}

export type ShapeIdentityMatch = {
  entry: ChordLibraryItem;
  score: number;
  missing: string[];
  extras: string[];
  bass: string;
  bassRole: "root" | "third" | "fifth" | "color" | "unknown";
};

export type ShapeIdentityReport = {
  actualPitchClasses: number[];
  actualNotes: string[];
  bass: string | null;
  matches: ShapeIdentityMatch[];
  uncertain: boolean;
  message: string;
};

/**
 * Identify a six-string shape against the local chord library. The candidates
 * are intentionally supplied by the caller so this remains bounded to the
 * currently loaded library and does not invent a remote chord dictionary.
 */
export function identifyChordShape(
  frets: readonly number[],
  tuning: readonly string[],
  capo: number,
  candidates: readonly ChordLibraryItem[],
): ShapeIdentityReport {
  if (frets.length !== tuning.length || !frets.length) {
    return { actualPitchClasses: [], actualNotes: [], bass: null, matches: [], uncertain: true, message: "Enter one fret value for every tuned string." };
  }
  const midi: Array<{ midi: number; pitch: number }> = [];
  frets.forEach((fret, index) => {
    const open = pitchClass(tuning[index] ?? "");
    if (!Number.isInteger(fret) || fret < 0 || open === null) return;
    midi.push({ midi: STANDARD_OPEN_MIDI[index] + signedDelta(open - ([4, 9, 2, 7, 11, 4][index] ?? 0)) + fret + Math.max(0, Math.round(capo)), pitch: normalize(open + fret + capo) });
  });
  if (!midi.length) return { actualPitchClasses: [], actualNotes: [], bass: null, matches: [], uncertain: true, message: "The shape has no sounding strings to identify." };
  const bassPoint = midi.reduce((lowest, current) => current.midi < lowest.midi ? current : lowest, midi[0]);
  const actual = Array.from(new Set(midi.map((note) => note.pitch)));
  const matches = candidates.flatMap((entry) => {
    const root = pitchClass(entry.root);
    const intervals = QUALITY_INTERVALS[entry.quality];
    if (root === null || !intervals) return [];
    const expected = new Set(intervals.map((interval) => normalize(root + interval + capo)));
    const missingClasses = Array.from(expected).filter((pitch) => !actual.includes(pitch));
    const extras = actual.filter((pitch) => !expected.has(pitch));
    const matched = actual.filter((pitch) => expected.has(pitch));
    const identityCoverage = matched.length / expected.size;
    const score = Math.round(identityCoverage * 70 + (extras.length ? 0 : 20) + (missingClasses.length === 0 ? 10 : 0));
    if (score < 55) return [];
    const bassOffset = normalize(bassPoint.pitch - normalize(root + capo));
    const bassRole: ShapeIdentityMatch["bassRole"] = bassOffset === 0 ? "root" : bassOffset === 3 || bassOffset === 4 ? "third" : bassOffset === 7 ? "fifth" : intervals.includes(bassOffset) ? "color" : "unknown";
    return [{ entry, score, missing: missingClasses.map(noteName), extras: extras.map(noteName), bass: noteName(bassPoint.pitch), bassRole }];
  }).sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id)).slice(0, 3);
  const uncertain = !matches.length || (matches.length > 1 && matches[0].score === matches[1].score);
  const top = matches[0];
  const message = top
    ? `${uncertain ? "Possible match" : "Likely"}: ${top.entry.chord.name}${top.bassRole === "root" ? " (root position)" : `/${top.bass} bass (${top.bassRole})`}${top.missing.length ? ` · missing ${top.missing.join(", ")}` : ""}${top.extras.length ? ` · extra ${top.extras.join(", ")}` : ""}.`
    : "No confident local chord identity matched this shape. Check tuning, capo, or muted strings.";
  return { actualPitchClasses: actual, actualNotes: actual.map(noteName), bass: noteName(bassPoint.pitch), matches, uncertain, message };
}

/** A small, pure helper used by the fretboard-note quiz and melody filter. */
export function soundingShapePitchClasses(frets: readonly number[], tuning: readonly string[], capo = 0) {
  return Array.from(new Set(frets.flatMap((fret, index) => {
    if (!Number.isInteger(fret) || fret < 0) return [];
    const open = pitchClass(tuning[index] ?? "");
    return open === null ? [] : [normalize(open + fret + capo)];
  })));
}

/** Return the lowest sounding pitch class, respecting alternate tuning/capo. */
export function soundingShapeBassPitchClass(frets: readonly number[], tuning: readonly string[], capo = 0) {
  const points = frets.flatMap((fret, index) => {
    if (!Number.isInteger(fret) || fret < 0) return [];
    const open = pitchClass(tuning[index] ?? "");
    if (open === null) return [];
    return [{ midi: STANDARD_OPEN_MIDI[index] + signedDelta(open - ([4, 9, 2, 7, 11, 4][index] ?? 0)) + fret + Math.max(0, Math.round(capo)), pitch: normalize(open + fret + capo) }];
  });
  return points.length ? points.reduce((lowest, current) => current.midi < lowest.midi ? current : lowest, points[0]).pitch : null;
}

export function filterVoicingsByBass<T extends { chord: { frets: readonly number[] } }>(entries: readonly T[], bass: string, tuning: readonly string[], capo = 0) {
  const wanted = pitchClass(bass);
  if (wanted === null) return [];
  return entries.filter((entry) => soundingShapeBassPitchClass(entry.chord.frets, tuning, capo) === wanted);
}

export const chordQualityPitchClasses = (root: string, quality: string, capo = 0) => {
  const rootClass = pitchClass(root);
  const intervals = QUALITY_INTERVALS[quality];
  return rootClass === null || !intervals ? [] : intervals.map((interval) => normalize(rootClass + interval + capo));
};

