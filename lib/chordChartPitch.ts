/**
 * Compare the notes that a chart shape actually produces with the chord
 * identity printed above it.
 *
 * This module deliberately works with pitch classes rather than MIDI note
 * numbers.  A chart only needs to answer whether the sounding notes belong to
 * the displayed chord; octave and enharmonic spelling do not change that
 * answer.
 */

export type ChordChartPitchResult = {
  matches: boolean;
  extraNotes: string[];
  missingNotes: string[];
  partial: boolean;
  actualNotes: string[];
  expectedNotes: string[];
  message: string;
};

/** The quality ids used by the chord library, plus diminished for callers
 * that use the broader harmony vocabulary. */
export const CHORD_CHART_QUALITY_INTERVALS: Readonly<Record<string, readonly number[]>> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  dominant7: [0, 4, 7, 10],
  minor7: [0, 3, 7, 10],
  major7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7]
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const NOTE_CLASSES: Readonly<Record<string, number>> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11
};

const emptyResult = (message: string): ChordChartPitchResult => ({
  matches: false,
  extraNotes: [],
  missingNotes: [],
  partial: false,
  actualNotes: [],
  expectedNotes: [],
  message
});

const canonicalNote = (pitchClass: number) => NOTE_NAMES[((pitchClass % 12) + 12) % 12];

const normalizeNoteText = (value: string) => value.trim().replace(/♯/g, "#").replace(/♭/g, "b");

/** Parse a note name with an optional octave (for example E, E2, or F♯3). */
const parseNoteClass = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const cleaned = normalizeNoteText(value);
  const match = cleaned.match(/^([A-Ga-g](?:#|b)?)(?:-?\d+)?$/);
  if (!match) return null;
  const spelling = `${match[1][0].toUpperCase()}${match[1].slice(1)}`;
  return NOTE_CLASSES[spelling] ?? null;
};

const qualityId = (quality: string) => {
  const normalized = quality.trim().toLowerCase();
  if (normalized === "m") return "minor";
  if (normalized === "maj") return "major";
  if (normalized === "maj7") return "major7";
  if (normalized === "min7") return "minor7";
  if (normalized === "7") return "dominant7";
  if (normalized === "dim" || normalized === "dim7") return "diminished";
  return normalized;
};

const qualityLabel = (quality: string) => {
  const labels: Readonly<Record<string, string>> = {
    major: "major",
    minor: "minor",
    diminished: "diminished",
    dominant7: "dominant 7",
    minor7: "minor 7",
    major7: "major 7",
    sus2: "sus2",
    sus4: "sus4",
    add9: "add9"
  };
  return labels[quality] ?? quality;
};

const listNotes = (classes: readonly number[]) => classes.map(canonicalNote);

/**
 * Validate a chart diagram's sounding pitch classes.
 *
 * `frets` and `tuning` are ordered low-to-high, as they are in the six-string
 * chord diagrams.  Any negative fret is muted and is intentionally omitted.
 * Capo is applied both to the fretted notes and to the theoretical chord root.
 * Missing root or fifth notes are treated as an intentional partial voicing;
 * missing color/quality tones are not.  Any extra pitch class is contradictory
 * and therefore makes the result fail, even when the voicing is otherwise
 * partial.
 */
export function validateChordChartPitch(
  frets: number[],
  tuning: string[],
  root: string,
  quality: string,
  capo = 0
): ChordChartPitchResult {
  if (!Array.isArray(frets) || !frets.length) return emptyResult("Invalid chart shape: provide at least one string fret.");
  if (!Array.isArray(tuning) || tuning.length !== frets.length) {
    return emptyResult(`Invalid tuning: provide one valid note per chart string (${frets.length} expected).`);
  }
  if (!Number.isInteger(capo) || capo < 0) return emptyResult("Invalid capo: use a non-negative whole-number fret.");

  const tuningClasses = tuning.map(parseNoteClass);
  const invalidTuningIndex = tuningClasses.findIndex((pitchClass) => pitchClass === null);
  if (invalidTuningIndex >= 0) {
    return emptyResult(`Invalid tuning: string ${invalidTuningIndex + 1} is not a note such as E2 or Eb2.`);
  }

  const invalidFretIndex = frets.findIndex((fret) => !Number.isInteger(fret) || !Number.isFinite(fret));
  if (invalidFretIndex >= 0) {
    return emptyResult(`Invalid fret: string ${invalidFretIndex + 1} must use -1 for mute or a non-negative whole number.`);
  }

  if (typeof root !== "string") return emptyResult("Invalid chord root: provide a note such as C or F#.");
  const rootClass = parseNoteClass(root);
  if (rootClass === null || !/^[A-Ga-g](?:#|b|♯|♭)?$/.test(root.trim())) {
    return emptyResult(`Invalid chord root: “${root}”.`);
  }

  if (typeof quality !== "string") return emptyResult("Unsupported chord quality: provide a library quality id.");
  const id = qualityId(quality);
  const intervals = CHORD_CHART_QUALITY_INTERVALS[id];
  if (!intervals) return emptyResult(`Unsupported chord quality: “${quality}”.`);

  const actualClasses = frets.flatMap((fret, index) => {
    if (fret < 0) return [];
    const openClass = tuningClasses[index];
    // The tuning was validated above; this guard keeps the helper safe if the
    // implementation is later changed to accept a sparse tuning array.
    return openClass === null || openClass === undefined ? [] : [(openClass + fret + capo) % 12];
  });
  const actualSet = new Set(actualClasses);
  const expectedClasses = intervals.map((interval) => (rootClass + interval + capo) % 12);
  const expectedSet = new Set(expectedClasses);
  const actualNotes = listNotes(Array.from(actualSet));
  const expectedNotes = listNotes(Array.from(expectedSet));
  const extraClasses = Array.from(actualSet).filter((pitchClass) => !expectedSet.has(pitchClass));
  const missingClasses = Array.from(expectedSet).filter((pitchClass) => !actualSet.has(pitchClass));
  const extraNotes = listNotes(extraClasses);
  const missingNotes = listNotes(missingClasses);

  // A root or fifth may be left out by a deliberately partial shape.  The
  // third, seventh, suspension, and ninth are identity-bearing tones and must
  // remain present for a positive match.
  const rootPitch = expectedClasses[0];
  const fifthPitch = (rootClass + 7 + capo) % 12;
  const onlyIntentionalMissing = missingClasses.every((pitchClass) => pitchClass === rootPitch || pitchClass === fifthPitch);
  const partial = missingClasses.length > 0 && extraClasses.length === 0 && onlyIntentionalMissing;
  const matches = extraClasses.length === 0 && (missingClasses.length === 0 || partial);
  const label = `${canonicalNote((rootClass + capo) % 12)} ${qualityLabel(id)}`;

  let message: string;
  if (matches && partial) {
    message = `Partial match: ${label}. Missing ${missingNotes.join(", ")}; the root or fifth may be intentionally omitted.`;
  } else if (matches) {
    message = `Match: ${label}. All sounding pitch classes agree.`;
  } else if (extraNotes.length > 0) {
    const missingText = missingNotes.length ? ` Missing ${missingNotes.join(", ")}.` : "";
    message = `Warning: ${label} has contradictory extra note${extraNotes.length === 1 ? "" : "s"} ${extraNotes.join(", ")}.${missingText} Check the tuning, capo, or muted strings.`;
  } else if (missingNotes.length > 0) {
    message = `Incomplete match: ${label} is missing ${missingNotes.join(", ")}. Keep the chord's identity tones fretted or ringing.`;
  } else {
    message = `No sounding notes match ${label}.`;
  }

  return { matches, extraNotes, missingNotes, partial, actualNotes, expectedNotes, message };
}

/** Readable aliases for callers that describe this operation as a comparison or analysis. */
export const compareChordChartPitch = validateChordChartPitch;
export const analyzeChordChartPitch = validateChordChartPitch;

