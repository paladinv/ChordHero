import type { ChordLibraryItem } from "./chords";

export type VoicingOptimization = {
  entries: ChordLibraryItem[];
  score: number;
  explanation: string;
};

const fretMovement = (from: ChordLibraryItem, to: ChordLibraryItem) =>
  from.chord.frets.reduce((total, fret, index) => {
    const next = to.chord.frets[index];
    return total + (fret < 0 || next < 0 ? 0 : Math.abs(fret - next));
  }, 0);

const retainedFingerBonus = (from: ChordLibraryItem, to: ChordLibraryItem) =>
  (from.chord.frets ?? []).reduce((total, fret, index) => {
    const next = to.chord.frets[index];
    const finger = from.chord.fingers?.[index];
    return total + (fret >= 0 && fret === next && finger && finger === to.chord.fingers?.[index] ? 2 : 0);
  }, 0);

/** Bounded dynamic-programming optimizer. Candidates are grouped by chord identity and capped. */
export function optimizeChordProgression(
  progression: readonly ChordLibraryItem[],
  candidatesByIdentity: ReadonlyMap<string, readonly ChordLibraryItem[]>,
  maxCandidates = 8,
): VoicingOptimization {
  if (!progression.length) return { entries: [], score: 0, explanation: "Add at least one progression chord to optimize voicings." };
  const paths: Array<{ entries: ChordLibraryItem[]; score: number }> = [{ entries: [], score: 0 }];
  progression.forEach((requested, index) => {
    const candidates = (candidatesByIdentity.get(`${requested.root}:${requested.quality}`) ?? [requested]).slice(0, maxCandidates);
    const next: Array<{ entries: ChordLibraryItem[]; score: number }> = [];
    paths.forEach((path) => candidates.forEach((candidate) => {
      const previous = path.entries[path.entries.length - 1];
      const transition = previous ? fretMovement(previous, candidate) * 2 - retainedFingerBonus(previous, candidate) : 0;
      next.push({ entries: [...path.entries, candidate], score: path.score + transition });
    }));
    next.sort((a, b) => a.score - b.score || a.entries.map((item) => item.id).join().localeCompare(b.entries.map((item) => item.id).join()));
    paths.splice(0, paths.length, ...next.slice(0, maxCandidates));
    if (index === progression.length - 1 && !paths.length) return;
  });
  const best = paths[0] ?? { entries: [], score: 0 };
  return { ...best, explanation: `Optimized ${best.entries.length} shapes by minimizing fret movement and rewarding retained fingers.` };
}

const NOTE_INDEX: Record<string, number> = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const STANDARD_OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const STANDARD_OPEN_PITCH_CLASSES = [4, 9, 2, 7, 11, 4];

const signedPitchDelta = (pitch: number, reference: number) => ((pitch - reference + 6) % 12 + 12) % 12 - 6;

/** Return sounding MIDI notes for each string; null marks a muted or invalid string. */
export function chordStringMidiNotes(frets: readonly number[], tuningNotes: readonly string[], capo = 0): Array<number | null> {
  return STANDARD_OPEN_MIDI.map((standardMidi, stringIndex) => {
    const fret = frets[stringIndex];
    const openPitch = NOTE_INDEX[tuningNotes[stringIndex] ?? ""];
    if (!Number.isInteger(fret) || fret < 0 || openPitch === undefined) return null;
    const delta = signedPitchDelta(openPitch, STANDARD_OPEN_PITCH_CLASSES[stringIndex]);
    return standardMidi + delta + fret + Math.max(0, Math.round(capo));
  });
}

export function spellChordForKey(name: string, key: string) {
  const match = name.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return name;
  const root = match[1];
  const preferFlats = /b|F$|Bb$|Eb$|Ab$|Db$|Gb$/.test(key);
  const pitch = NOTE_INDEX[root];
  if (pitch === undefined) return name;
  return `${(preferFlats ? FLAT : SHARP)[pitch]}${match[2]}`;
}

export type CustomShape = { name: string; frets: number[]; fingers?: Array<number | null> };

/** Validate a user-entered shape without doing any work beyond its six-string input. */
export function validateCustomChordShape(
  shape: CustomShape,
  tuning: readonly string[],
  expectedPitchClasses: readonly number[],
  capo = 0,
  allowedMissingPitchClasses: readonly number[] = [],
) {
  const errors: string[] = [];
  const frets = Array.isArray(shape.frets) ? shape.frets : [];
  const fingers = shape.fingers === undefined ? [] : shape.fingers;
  if (frets.length !== tuning.length) errors.push(`Provide exactly ${tuning.length} string positions.`);
  if (shape.fingers !== undefined && fingers.length !== tuning.length) errors.push(`Provide exactly ${tuning.length} finger numbers or leave them blank.`);
  tuning.forEach((note, index) => { if (NOTE_INDEX[note] === undefined) errors.push(`Tuning string ${index + 1} has an unsupported note.`); });
  frets.forEach((fret, index) => { if (!Number.isInteger(fret) || fret < -1 || fret > 24) errors.push(`String ${index + 1} must be mute (-1) or fret 0–24.`); });
  fingers.forEach((finger, index) => { if (finger !== null && finger !== undefined && (!Number.isInteger(finger) || finger < 1 || finger > 4)) errors.push(`String ${index + 1} finger must be 1–4 or blank.`); });
  const notes = frets.flatMap((fret, index) => fret < 0 || NOTE_INDEX[tuning[index]] === undefined ? [] : [(NOTE_INDEX[tuning[index]] + fret + capo) % 12]);
  const actual = new Set(notes);
  const expected = new Set(expectedPitchClasses.map((pitch) => ((pitch + capo) % 12 + 12) % 12));
  const missing = [...expected].filter((pitch) => !actual.has(pitch));
  const extra = [...actual].filter((pitch) => !expected.has(pitch));
  const allowedMissing = new Set(allowedMissingPitchClasses.map((pitch) => ((pitch + capo) % 12 + 12) % 12));
  const missingRequired = missing.filter((pitch) => !allowedMissing.has(pitch));
  if (missingRequired.length) errors.push(`Missing required chord tones: ${missingRequired.join(", ")}.`);
  if (extra.length) errors.push(`Contradictory pitch classes: ${extra.join(", ")}.`);
  return { valid: errors.length === 0, errors, missing, extra, pitchClasses: [...actual] };
}

export type ChartHealthIssue = { kind: "duplicate" | "fingering" | "pitch"; message: string; fix?: string };

export function analyzeChordChartHealth(entries: readonly ChordLibraryItem[], pitchResults: ReadonlyMap<string, { matches: boolean; message: string }>): ChartHealthIssue[] {
  const issues: ChartHealthIssue[] = [];
  const seen = new Map<string, string>();
  entries.forEach((entry) => {
    const signature = entry.chord.frets.join(",");
    if (seen.has(signature)) issues.push({ kind: "duplicate", message: `${entry.chord.name} duplicates ${seen.get(signature)}.`, fix: "Keep the simpler voicing or show it as an alternate." });
    else seen.set(signature, entry.chord.name);
    entry.chord.fingers?.forEach((finger, index) => { if (finger !== null && (!Number.isInteger(finger) || finger < 1 || finger > 4)) issues.push({ kind: "fingering", message: `${entry.chord.name} has an invalid finger on string ${index + 1}.`, fix: "Use finger numbers 1–4 or leave the string unassigned." }); });
    const pitch = pitchResults.get(entry.id);
    if (pitch && !pitch.matches) issues.push({ kind: "pitch", message: `${entry.chord.name}: ${pitch.message}`, fix: "Check tuning, capo, muted strings, or choose a compatible voicing." });
  });
  return issues.slice(0, 40);
}

export function suggestChordSubstitutions(entry: ChordLibraryItem, genre: string) {
  const normalized = genre.toLowerCase();
  const suggestions = entry.nearbyAlternatives.map((item) => ({ label: item.label, description: item.description, reason: `Keeps the ${entry.functionContexts[0]?.roles[0] ?? "current"} harmonic role.` }));
  if (normalized.includes("jazz")) suggestions.push({ label: `${entry.chord.name}7`, description: "Add a seventh for a stronger dominant or turnaround color.", reason: "Jazz-style color while preserving the root." });
  if (normalized.includes("folk") || normalized.includes("pop")) suggestions.push({ label: `${entry.chord.name}sus2`, description: "Use a suspended shape for a lighter open-string color.", reason: "Keeps the root and fifth while reducing harmonic density." });
  return suggestions.slice(0, 4);
}

export type TransposedChartPreview = { id: string; originalName: string; targetName: string; delta: number; targetSymbols: string[]; targetSoundedSymbols?: string[]; missingShapes: string[]; setupWarning?: string };

/** Preview setlist transposition without mutating saved charts. */
export function previewSetlistTranspose(
  charts: readonly { id: string; name: string; filters?: { key?: string }; settings?: { capo?: number; tuning?: string }; arrangement?: { progression?: readonly { played: string; sounded?: string }[] } }[],
  targetKey: string,
  noteIndex: Readonly<Record<string, number>>,
  resolveShape: (symbol: string) => boolean,
) {
  return charts.map((chart) => {
    const sourceKey = chart.filters?.key ?? "C";
    const delta = ((noteIndex[targetKey] ?? 0) - (noteIndex[sourceKey] ?? 0) + 12) % 12;
    const targetName = `${chart.name} · ${targetKey}`;
    const progression = chart.arrangement?.progression ?? [];
    const transposeSymbols = (symbols: readonly string[]) => symbols.map((symbol) => { const match = symbol.match(/^([A-G](?:#|b)?)(.*)$/); if (!match) return symbol; const sourcePitch = noteIndex[match[1]] ?? 0; const targetPitch = (sourcePitch + delta) % 12; const names = /b/.test(targetKey) ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] : ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; return `${names[targetPitch]}${match[2]}`; });
    const targetSymbols = transposeSymbols(progression.map((step) => step.played));
    const targetSoundedSymbols = transposeSymbols(progression.map((step) => step.sounded ?? step.played));
    const missingShapes = targetSymbols.filter((symbol) => !resolveShape(symbol)).slice(0, 8);
    const setupWarning = chart.settings?.capo ? `Existing capo ${chart.settings.capo} may need recalibration.` : undefined;
    return { id: chart.id, originalName: chart.name, targetName, delta, targetSymbols, targetSoundedSymbols, missingShapes, setupWarning };
  });
}

export type TransposableChart = {
  id: string;
  name: string;
  filters?: { key?: string };
  arrangement?: {
    key?: string;
    progression?: readonly { played: string; sounded?: string }[];
  };
};

/** Build fresh target-key copies. The input charts are never mutated or replaced. */
export function createSetlistTransposeCopies<T extends TransposableChart>(
  charts: readonly T[],
  previews: readonly Pick<TransposedChartPreview, "id" | "targetName" | "targetSymbols" | "targetSoundedSymbols">[],
  targetKey: string,
  makeId: (chart: T, index: number) => string,
): T[] {
  return previews.flatMap((preview, previewIndex) => {
    const source = charts.find((chart) => chart.id === preview.id);
    if (!source) return [];
    const arrangement = source.arrangement ? {
      ...source.arrangement,
      key: targetKey,
      progression: source.arrangement.progression?.map((step, index) => {
        const target = preview.targetSymbols[index];
        const sounded = preview.targetSoundedSymbols?.[index] ?? target;
        return target ? { ...step, played: target, sounded } : { ...step };
      })
    } : source.arrangement;
    return [{
      ...source,
      id: makeId(source, previewIndex),
      name: preview.targetName,
      filters: source.filters ? { ...source.filters, key: targetKey } : source.filters,
      arrangement,
    } as T];
  });
}
