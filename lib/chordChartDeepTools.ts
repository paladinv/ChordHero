import type { ChordLibraryItem } from "./chords";

const NOTE_INDEX: Record<string, number> = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const QUALITY_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6], dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11], minor7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 4, 7, 2],
  major6: [0, 4, 7, 9], minor6: [0, 3, 7, 9], major9: [0, 4, 7, 11, 14], minor9: [0, 3, 7, 10, 14],
  dominant9: [0, 4, 7, 10, 14], add11: [0, 4, 7, 17], dominant7sus4: [0, 5, 7, 10],
  diminished7: [0, 3, 6, 9], halfDiminished7: [0, 3, 6, 10],
};
const INTERVAL_LABELS: Record<number, string> = { 0: "R", 1: "♭2", 2: "2/9", 3: "♭3", 4: "3", 5: "4/11", 6: "♭5", 7: "5", 8: "♭6", 9: "6/13", 10: "♭7", 11: "7" };
const STANDARD_OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const STANDARD_OPEN_PITCH = [4, 9, 2, 7, 11, 4];

export type SupportedInstrument = "ukulele" | "baritone-guitar" | "seven-string";
export type StrumDirection = "down" | "up" | "alternate";
export type PreviewArticulation = "ring" | "short" | "muted";
export type SyntheticTone = "triangle" | "sine" | "sawtooth";
export type AudioPreviewSettings = { direction: StrumDirection; articulation: PreviewArticulation; tone: SyntheticTone };
export const DEFAULT_AUDIO_PREVIEW_SETTINGS: AudioPreviewSettings = { direction: "down", articulation: "ring", tone: "triangle" };
export const INSTRUMENT_TUNINGS: Record<SupportedInstrument, { label: string; notes: string[]; midi: number[] }> = {
  ukulele: { label: "Ukulele · re-entrant G C E A", notes: ["G", "C", "E", "A"], midi: [67, 60, 64, 69] },
  "baritone-guitar": { label: "Baritone guitar · B E A D F# B", notes: ["B", "E", "A", "D", "F#", "B"], midi: [35, 40, 45, 50, 54, 59] },
  "seven-string": { label: "Seven-string guitar · B E A D G B E", notes: ["B", "E", "A", "D", "G", "B", "E"], midi: [35, 40, 45, 50, 55, 59, 64] },
};

export type GeneratedVoicing = {
  frets: number[];
  midi: Array<number | null>;
  notes: string[];
  intervals: string[];
  baseFret: number;
  score: number;
  bass: string;
  coverage: string[];
};

export const CHORD_FAMILY_QUALITIES = Object.keys(QUALITY_INTERVALS);

const normalizedPitch = (value: number) => ((value % 12) + 12) % 12;
export const intervalsForQuality = (quality: string) => QUALITY_INTERVALS[quality] ?? [0, 4, 7];

const signedPitchDelta = (value: number) => {
  const normalized = normalizedPitch(value);
  return normalized > 6 ? normalized - 12 : normalized;
};

/** Objective shape facts for a compact, optional "why this voicing" explanation. */
export function explainVoicingChoice(entry: Pick<ChordLibraryItem, "position" | "difficultyTags" | "chord">, pitchStatus: "match" | "partial" | "mismatch") {
  const frets = entry.chord.frets;
  const sounding = frets.filter((fret) => fret >= 0);
  const fretted = frets.filter((fret) => fret > 0);
  const open = frets.filter((fret) => fret === 0).length;
  const muted = frets.length - sounding.length;
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const reasons = [entry.position.toLowerCase().includes("open") ? `Open-position shape with ${open} open string${open === 1 ? "" : "s"}.` : `Position: ${entry.position}.`];
  if (entry.chord.barre) reasons.push(`Barre at fret ${entry.chord.barre.fret}.`);
  else reasons.push("No barre is marked in the library fingering.");
  if (fretted.length) reasons.push(`Fretted notes span ${span + 1} fret${span === 0 ? "" : "s"} (${Math.min(...fretted)}–${Math.max(...fretted)}).`);
  if (muted) reasons.push(`${muted} string${muted === 1 ? " is" : "s are"} muted.`);
  const tags = entry.difficultyTags.slice(0, 3);
  if (tags.length) reasons.push(`Library tags: ${tags.join(", ")}.`);
  reasons.push(pitchStatus === "match" ? "All required chord tones match the selected tuning and capo." : pitchStatus === "partial" ? "The current tuning/capo check found a partial pitch match." : "Review the pitch warning for the selected tuning/capo.");
  return reasons;
}

export type BassAnalysis = { midi: number; note: string; degree: string; isChordTone: boolean } | null;

/** Analyze the actual lowest sounding string, including alternate tuning and capo. */
export function analyzeVoicingBass(frets: readonly number[], tuning: readonly string[], root: string, quality: string, capo = 0): BassAnalysis {
  if (frets.length !== tuning.length || !frets.length || NOTE_INDEX[root] === undefined) return null;
  const notes = frets.flatMap((fret, index) => {
    const pitch = NOTE_INDEX[tuning[index] ?? ""];
    if (!Number.isInteger(fret) || fret < 0 || pitch === undefined) return [];
    const midi = (STANDARD_OPEN_MIDI[index] ?? 40 + index * 5) + signedPitchDelta(pitch - (STANDARD_OPEN_PITCH[index] ?? 0)) + fret + Math.max(0, Math.round(capo));
    return [{ midi, pitch: ((midi % 12) + 12) % 12 }];
  });
  if (!notes.length) return null;
  const lowest = notes.reduce((left, right) => right.midi < left.midi ? right : left);
  const interval = (lowest.pitch - ((NOTE_INDEX[root] + Math.max(0, Math.round(capo))) % 12) + 12) % 12;
  const formula = intervalsForQuality(quality).map(normalizedPitch);
  const degree = interval === 0 ? "root position" : interval === 3 || interval === 4 ? "3rd in bass" : interval === 6 || interval === 7 || interval === 8 ? "5th in bass" : interval === 9 ? "6th in bass" : interval === 10 || interval === 11 ? "7th in bass" : formula.includes(interval) ? "chord color in bass" : "non-chord bass tone";
  return { midi: lowest.midi, note: `${SHARP_NAMES[lowest.pitch]}${Math.floor(lowest.midi / 12) - 1}`, degree, isChordTone: formula.includes(interval) };
}

/** Sounding contacts from one concrete shape, bounded to the requested neck window. */
export function mapShapeContacts(frets: readonly number[], tuning: readonly string[], root: string, capo = 0, maxFret = 12) {
  if (frets.length !== tuning.length || NOTE_INDEX[root] === undefined) return [];
  const capoFret = Math.max(0, Math.round(capo));
  const rootPitch = (NOTE_INDEX[root] + capoFret) % 12;
  return frets.flatMap((fret, string) => {
    const openPitch = NOTE_INDEX[tuning[string] ?? ""];
    const physicalFret = capoFret + fret;
    if (!Number.isInteger(fret) || fret < 0 || physicalFret > Math.max(0, Math.min(12, maxFret)) || openPitch === undefined) return [];
    const pitch = normalizedPitch(openPitch + physicalFret);
    const interval = normalizedPitch(pitch - rootPitch);
    return [{ string, fret: physicalFret, note: SHARP_NAMES[pitch], interval: INTERVAL_LABELS[interval] ?? `+${interval}`, root: interval === 0 }];
  });
}

export function chartShapeEvidence(matches: boolean, partial = false) {
  return matches ? "Library · pitch match" : partial ? "Library · partial" : "Library · check notes";
}

/** Deterministic scheduling data shared by card and progression Web Audio previews. */
export function buildSyntheticStrumPlan(notes: readonly number[], settings: AudioPreviewSettings, strokeIndex = 0, spreadSeconds = 0.025) {
  const upward = settings.direction === "up" || (settings.direction === "alternate" && strokeIndex % 2 === 1);
  const ordered = upward ? [...notes].reverse() : [...notes];
  const duration = settings.articulation === "ring" ? 1.35 : settings.articulation === "short" ? 0.62 : 0.28;
  const peakGain = settings.articulation === "muted" ? 0.03 : 0.045;
  const filterHz = settings.tone === "sawtooth" ? 1450 : settings.tone === "sine" ? 1100 : 1800;
  return ordered.map((midi, index) => ({ midi, offset: index * Math.max(0, Math.min(0.12, spreadSeconds)), duration, peakGain, filterHz, oscillator: settings.tone }));
}

/** Generate a small set of verified pitch-correct shapes. Work is capped by fret windows and result count. */
export function generateInstrumentVoicings(root: string, quality: string, instrument: SupportedInstrument, maxResults = 5): GeneratedVoicing[] {
  const tuning = INSTRUMENT_TUNINGS[instrument];
  const rootPitch = NOTE_INDEX[root];
  if (!tuning || rootPitch === undefined) return [];
  const intervals = intervalsForQuality(quality).map(normalizedPitch);
  const targets = new Set(intervals.map((interval) => normalizedPitch(rootPitch + interval)));
  const results: GeneratedVoicing[] = [];
  const signatures = new Set<string>();
  const windows = [0, 1, 3, 5, 7, 9, 11, 13];

  for (const start of windows) {
    const candidates = tuning.notes.map((open) => {
      const pitch = NOTE_INDEX[open];
      const frets = Array.from({ length: start === 0 ? 5 : 4 }, (_, index) => start + index)
        .filter((fret) => fret <= 15 && targets.has(normalizedPitch(pitch + fret)));
      return [-1, ...frets].slice(0, 5);
    });
    const current = new Array<number>(tuning.notes.length).fill(-1);
    const visit = (string: number) => {
      if (results.length >= 80) return;
      if (string < current.length) {
        candidates[string].forEach((fret) => { current[string] = fret; visit(string + 1); });
        return;
      }
      const sounding = current.flatMap((fret, index) => fret < 0 ? [] : [{ fret, index, midi: tuning.midi[index] + fret, pitch: normalizedPitch(NOTE_INDEX[tuning.notes[index]] + fret) }]);
      if (sounding.length < Math.min(3, tuning.notes.length)) return;
      const actual = new Set(sounding.map((item) => item.pitch));
      if ([...targets].some((pitch) => !actual.has(pitch)) || [...actual].some((pitch) => !targets.has(pitch))) return;
      const fretted = sounding.map((item) => item.fret).filter((fret) => fret > 0);
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      if (span > 4) return;
      const signature = current.join(",");
      if (signatures.has(signature)) return;
      signatures.add(signature);
      const ordered = [...sounding].sort((a, b) => a.midi - b.midi);
      const bassPitch = ordered[0].pitch;
      const openCount = sounding.filter((item) => item.fret === 0).length;
      const mutedCount = current.filter((fret) => fret < 0).length;
      const baseFret = fretted.length ? Math.min(...fretted) : 1;
      const score = span * 5 + baseFret + mutedCount * 2 - openCount * 2 + (bassPitch === rootPitch ? -5 : 4);
      results.push({ frets: [...current], midi: current.map((fret, index) => fret < 0 ? null : tuning.midi[index] + fret), notes: current.map((fret, index) => fret < 0 ? "×" : SHARP_NAMES[normalizedPitch(NOTE_INDEX[tuning.notes[index]] + fret)]), intervals: current.map((fret, index) => fret < 0 ? "×" : INTERVAL_LABELS[normalizedPitch(NOTE_INDEX[tuning.notes[index]] + fret - rootPitch)]), baseFret, score, bass: SHARP_NAMES[bassPitch], coverage: intervals.map((interval) => INTERVAL_LABELS[interval]) });
    };
    visit(0);
  }
  return results.sort((a, b) => a.score - b.score || a.frets.join(",").localeCompare(b.frets.join(","))).slice(0, Math.max(1, Math.min(8, maxResults)));
}

export type VoicingCoverage = { contacts: Array<{ string: number; fret: number; label: string; emphasis: "root" | "third" | "fifth" | "seventh" | "color" }>; present: string[]; missing: string[]; summary: string };

export function analyzeVoicingCoverage(frets: readonly number[], tuning: readonly string[], root: string, quality: string, capo = 0): VoicingCoverage {
  const rootPitch = NOTE_INDEX[root];
  if (rootPitch === undefined) return { contacts: [], present: [], missing: [], summary: "Chord root is not recognized." };
  const expected = intervalsForQuality(quality).map(normalizedPitch);
  const contacts = frets.flatMap((fret, string) => {
    const open = NOTE_INDEX[tuning[string]];
    if (fret < 0 || open === undefined) return [];
    const interval = normalizedPitch(open + fret + capo - (rootPitch + capo));
    const emphasis = interval === 0 ? "root" : [3, 4].includes(interval) ? "third" : interval === 7 ? "fifth" : [10, 11].includes(interval) ? "seventh" : "color";
    return [{ string, fret, label: INTERVAL_LABELS[interval], emphasis } as const];
  });
  const presentIntervals = new Set(contacts.map((contact) => contact.label));
  const present = expected.map((interval) => INTERVAL_LABELS[interval]).filter((label) => presentIntervals.has(label));
  const missing = expected.map((interval) => INTERVAL_LABELS[interval]).filter((label) => !presentIntervals.has(label));
  const counts = contacts.reduce<Record<string, number>>((result, contact) => ({ ...result, [contact.label]: (result[contact.label] ?? 0) + 1 }), {});
  const summary = `${present.map((label) => `${label}×${counts[label]}`).join(" · ") || "No chord tones"}${missing.length ? ` · missing ${missing.join(", ")}` : " · complete formula"}`;
  return { contacts, present, missing, summary };
}

export function neckChordTones(root: string, quality: string, tuning: readonly string[], maxFret = 12, capo = 0) {
  const capoFret = Math.max(0, Math.round(capo));
  const rootPitch = NOTE_INDEX[root] === undefined ? undefined : normalizedPitch(NOTE_INDEX[root] + capoFret);
  if (rootPitch === undefined) return [];
  const expected = new Set(intervalsForQuality(quality).map(normalizedPitch));
  return tuning.flatMap((open, string) => {
    const openPitch = NOTE_INDEX[open];
    if (openPitch === undefined) return [];
    return Array.from({ length: Math.max(1, Math.min(16, maxFret)) + 1 }, (_, fret) => {
      const interval = normalizedPitch(openPitch + fret - rootPitch);
      return expected.has(interval) && fret >= capoFret ? { string, fret, note: SHARP_NAMES[normalizedPitch(openPitch + fret)], interval: INTERVAL_LABELS[interval], root: interval === 0 } : null;
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  });
}

export function mapIdentityVoicings(entries: readonly ChordLibraryItem[], selected: ChordLibraryItem) {
  const rootPitch = NOTE_INDEX[selected.root];
  return entries.filter((entry) => NOTE_INDEX[entry.root] === rootPitch && entry.quality === selected.quality).map((entry) => {
    const fretted = entry.chord.frets.filter((fret) => fret > 0);
    const baseFret = fretted.length ? Math.min(...fretted) : 1;
    const region = entry.position.toLowerCase().includes("open") ? "Open region" : `Frets ${baseFret}–${Math.max(baseFret, ...fretted)}`;
    const form = /(?:^|\s)([CAGED])(?:-|\s?shape)/i.exec(entry.position)?.[1]?.toUpperCase();
    return { id: entry.id, name: entry.chord.name, position: entry.position, region, baseFret, form: form ? `${form}-form` : "Library voicing", selected: entry.id === selected.id };
  }).sort((a, b) => a.baseFret - b.baseFret || a.id.localeCompare(b.id)).slice(0, 12);
}

export function chordFamilyDifferential(root: string, qualities: readonly string[], baselineQuality = qualities[0] ?? "major") {
  const rootPitch = NOTE_INDEX[root];
  if (rootPitch === undefined) return [];
  const distinct = Array.from(new Set(qualities)).filter((quality) => QUALITY_INTERVALS[quality]).slice(0, 16);
  const baselineQualitySafe = distinct.includes(baselineQuality) ? baselineQuality : distinct[0] ?? "major";
  const baseline = intervalsForQuality(baselineQualitySafe).map(normalizedPitch);
  return distinct.map((quality) => {
    const intervals = intervalsForQuality(quality).map(normalizedPitch);
    const added = intervals.filter((interval) => !baseline.includes(interval)).map((interval) => INTERVAL_LABELS[interval]);
    const removed = baseline.filter((interval) => !intervals.includes(interval)).map((interval) => INTERVAL_LABELS[interval]);
    return { quality, baseline: baselineQualitySafe, formula: intervals.map((interval) => INTERVAL_LABELS[interval]), notes: intervals.map((interval) => SHARP_NAMES[normalizedPitch(rootPitch + interval)]), added, removed };
  });
}

export function explainOpenStringResonance(frets: readonly number[], tuning: readonly string[], root: string, quality: string, capo = 0) {
  const rootPitch = NOTE_INDEX[root];
  if (rootPitch === undefined) return [];
  const allowed = new Set(intervalsForQuality(quality).map((interval) => normalizedPitch(rootPitch + interval + capo)));
  return frets.flatMap((fret, string) => {
    if (fret !== 0) return [];
    const open = NOTE_INDEX[tuning[string]];
    if (open === undefined) return [];
    const sounded = normalizedPitch(open + capo);
    if (allowed.has(sounded)) return [];
    return [{ string, note: SHARP_NAMES[sounded], reason: `Open string ${string + 1} sounds ${SHARP_NAMES[sounded]}, outside the ${root} ${quality} formula. Mute it or intentionally treat it as an extension.` }];
  });
}

export type VersionSnapshot = { selectedIds: readonly string[]; practiceBpm?: number; rhythmPattern?: string; flashcards?: string; annotations?: { notes?: string }; tags?: readonly string[]; settings?: Record<string, unknown> };
export function compareChartVersions(before: VersionSnapshot, after: VersionSnapshot) {
  const beforeIds = new Set(before.selectedIds); const afterIds = new Set(after.selectedIds);
  const added = after.selectedIds.filter((id) => !beforeIds.has(id));
  const removed = before.selectedIds.filter((id) => !afterIds.has(id));
  const moved = after.selectedIds.flatMap((id, index) => beforeIds.has(id) && before.selectedIds.indexOf(id) !== index ? [{ id, from: before.selectedIds.indexOf(id) + 1, to: index + 1 }] : []).slice(0, 24);
  const settingKeys = new Set(["practiceBpm", "rhythmPattern", "flashcards", ...Object.keys(before.settings ?? {}), ...Object.keys(after.settings ?? {})]);
  const settingValue = (snapshot: VersionSnapshot, key: string) => snapshot.settings && Object.prototype.hasOwnProperty.call(snapshot.settings, key) ? snapshot.settings[key] : snapshot[key as "practiceBpm" | "rhythmPattern" | "flashcards"];
  const changedSettings = [...settingKeys].flatMap((key) => {
    const oldValue = settingValue(before, key); const newValue = settingValue(after, key);
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return [];
    const format = (value: unknown) => value === undefined || value === null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return [{ key, before: format(oldValue), after: format(newValue) }];
  });
  const tagAdded = (after.tags ?? []).filter((tag) => !(before.tags ?? []).includes(tag));
  const tagRemoved = (before.tags ?? []).filter((tag) => !(after.tags ?? []).includes(tag));
  const notesChanged = (before.annotations?.notes ?? "") !== (after.annotations?.notes ?? "");
  return { added, removed, moved, changedSettings, tagAdded, tagRemoved, notesChanged, unchanged: !added.length && !removed.length && !moved.length && !changedSettings.length && !tagAdded.length && !tagRemoved.length && !notesChanged };
}

export function chordLearningNote(entry: Pick<ChordLibraryItem, "root" | "quality" | "position" | "inversion" | "practiceFocus">) {
  const intervals = intervalsForQuality(entry.quality).map((interval) => INTERVAL_LABELS[normalizedPitch(interval)]).join("–");
  const inversion = entry.inversion === "inverted" ? "Listen for the non-root bass before naming the chord." : "Confirm the root against the lowest clear chord tone.";
  return `${entry.root} ${entry.quality} uses ${intervals}. ${entry.position}. ${inversion} ${entry.practiceFocus}`;
}
