/**
 * Pure, bounded helpers for chart arrangements.
 *
 * The chart UI intentionally keeps these operations free of React and browser
 * globals so imports, local recovery, and regression tests all agree on the
 * same expanded musical sequence.
 */

export type ArrangementEnding = "none" | "first" | "second";

export type ChordOccurrence = {
  id?: string;
  chord: string;
  beats: number;
  held?: boolean;
  cue?: string;
  ending?: ArrangementEnding;
};

export type ArrangementSection = {
  id?: string;
  title: string;
  meter: string;
  bpm: number;
  repeats: number;
  occurrences: ChordOccurrence[];
  firstEnding?: ChordOccurrence[];
  secondEnding?: ChordOccurrence[];
  cue?: string;
};

export type ChordChartArrangement = {
  songId: string;
  songTitle: string;
  key: string;
  sections: ArrangementSection[];
};

export type ExpandedOccurrence = ChordOccurrence & {
  sectionId: string;
  sectionTitle: string;
  repeat: number;
  occurrenceIndex: number;
  startBeat: number;
  endBeat: number;
  startMs: number;
  endMs: number;
  meter: string;
  bpm: number;
  durationQuarterBeats: number;
};

const MAX_SECTIONS = 40;
const MAX_OCCURRENCES = 240;
export const MAX_EXPANDED_OCCURRENCES = 512;
const MAX_REPEATS = 8;
const MAX_TEXT = 120;

const text = (value: unknown, fallback = "", max = MAX_TEXT) => typeof value === "string" ? value.trim().slice(0, max) : fallback;
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const normalizeMeter = (value: unknown, fallback = "4/4") => {
  const match = text(value).match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!match) return fallback;
  const numerator = Math.max(1, Math.min(16, Number(match[1])));
  const denominator = [1, 2, 4, 8, 16].includes(Number(match[2])) ? Number(match[2]) : 4;
  return `${numerator}/${denominator}`;
};

export const beatsPerBar = (meter: string) => {
  // `beats` is expressed in the written meter unit. In 6/8 this is six
  // eighth-note beats; timing conversion happens when BPM is applied.
  return Number(normalizeMeter(meter).split("/")[0]);
};

const normalizeOccurrence = (value: unknown, index: number, defaultBeats: number): ChordOccurrence | null => {
  if (typeof value === "string") return { id: `occ-${index + 1}`, chord: text(value, "—", 40), beats: defaultBeats, held: false, cue: "", ending: "none" };
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ChordOccurrence> & { duration?: unknown; durationBeats?: unknown };
  const chord = text(candidate.chord, "", 40);
  if (!chord) return null;
  const beats = Math.max(0.125, Math.min(64, finite(candidate.beats ?? candidate.durationBeats ?? candidate.duration, defaultBeats)));
  const ending = candidate.ending === "first" || candidate.ending === "second" ? candidate.ending : "none";
  return { id: text(candidate.id, `occ-${index + 1}`, 80), chord, beats, held: Boolean(candidate.held), cue: text(candidate.cue), ending };
};

const normalizeSection = (value: unknown, index: number, defaultBpm = 80): ArrangementSection | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ArrangementSection> & { chords?: unknown; beatDurations?: unknown };
  const title = text(candidate.title, `Section ${index + 1}`, 80);
  const meter = normalizeMeter(candidate.meter);
  const defaultBeats = beatsPerBar(meter);
  const rawOccurrences = (Array.isArray(candidate.occurrences) ? candidate.occurrences : Array.isArray(candidate.chords) ? candidate.chords : []).slice(0, MAX_OCCURRENCES);
  const durations = Array.isArray(candidate.beatDurations) ? candidate.beatDurations : [];
  const occurrences = rawOccurrences.flatMap((entry, occurrenceIndex) => normalizeOccurrence(
    typeof entry === "string" && Number.isFinite(Number(durations[occurrenceIndex])) ? { chord: entry, beats: durations[occurrenceIndex] } : entry,
    occurrenceIndex,
    defaultBeats,
  ) ?? []).slice(0, MAX_OCCURRENCES);
  const ending = (key: "firstEnding" | "secondEnding") => Array.isArray(candidate[key]) ? candidate[key].flatMap((entry, endingIndex) => normalizeOccurrence(entry, endingIndex, defaultBeats) ?? []).slice(0, 32) : undefined;
  return {
    id: text(candidate.id, `section-${index + 1}`, 80), title, meter,
    bpm: Math.max(30, Math.min(300, Math.round(finite(candidate.bpm, defaultBpm)))),
    repeats: Math.max(1, Math.min(MAX_REPEATS, Math.round(finite(candidate.repeats, 1)))), occurrences,
    firstEnding: ending("firstEnding"), secondEnding: ending("secondEnding"), cue: text(candidate.cue),
  };
};

export const normalizeArrangement = (value: unknown): ChordChartArrangement => {
  const candidate = value && typeof value === "object" ? value as Partial<ChordChartArrangement> & { bpm?: unknown } : {};
  const sections = Array.isArray(candidate.sections) ? candidate.sections.slice(0, MAX_SECTIONS).flatMap((entry, index) => normalizeSection(entry, index, finite(candidate.bpm, 80)) ?? []) : [];
  return { songId: text(candidate.songId, "local-chart", 120), songTitle: text(candidate.songTitle, "Untitled chart", 120), key: text(candidate.key, "C", 12), sections };
};

/** Expand repeats and endings into a deterministic, bounded occurrence list. */
export const expandArrangementSequence = (value: unknown): (ExpandedOccurrence[] & { truncated?: boolean }) => {
  const arrangement = normalizeArrangement(value);
  let beat = 0;
  let output: ExpandedOccurrence[] = [];
  let truncated = false;
  arrangement.sections.forEach((section) => {
    const sectionId = section.id ?? section.title;
    for (let repeat = 1; repeat <= section.repeats; repeat += 1) {
      if (output.length >= MAX_EXPANDED_OCCURRENCES) { truncated = true; return; }
      const ending = repeat === 1 ? section.firstEnding : repeat === section.repeats && section.repeats > 1 ? section.secondEnding : undefined;
      const source = [...section.occurrences.filter((occurrence) => !occurrence.ending || occurrence.ending === "none" || (occurrence.ending === "first" && repeat === 1) || (occurrence.ending === "second" && repeat === section.repeats)), ...((ending ?? []).map((occurrence) => ({ ...occurrence, ending: repeat === 1 ? "first" as const : "second" as const })))];
      source.forEach((occurrence, occurrenceIndex) => {
        if (output.length >= MAX_EXPANDED_OCCURRENCES) { truncated = true; return; }
        const startBeat = beat;
        const denominator = Number(section.meter.split("/")[1]);
        const durationQuarterBeats = occurrence.beats * (4 / denominator);
        const durationMs = durationQuarterBeats * 60000 / section.bpm;
        output.push({ ...occurrence, sectionId, sectionTitle: section.title, repeat, occurrenceIndex, startBeat, endBeat: startBeat + occurrence.beats, startMs: 0, endMs: durationMs, durationQuarterBeats, meter: section.meter, bpm: section.bpm });
        beat += occurrence.beats;
      });
    }
  });
  // Timings above are section-local; recompute a continuous timeline when BPM
  // changes between sections while preserving exact beat boundaries.
  let elapsedMs = 0;
  output = output.map((occurrence) => {
    const durationMs = occurrence.endMs;
    const next = { ...occurrence, startMs: elapsedMs, endMs: elapsedMs + durationMs };
    elapsedMs += durationMs;
    return next;
  });
  const result = output as ExpandedOccurrence[] & { truncated?: boolean };
  if (truncated) result.truncated = true;
  return result;
};

export const serializeArrangement = (value: unknown) => JSON.stringify(normalizeArrangement(value));

export const deserializeArrangement = (value: unknown): ChordChartArrangement => {
  if (typeof value !== "string") return normalizeArrangement(value);
  try { return normalizeArrangement(JSON.parse(value)); } catch { return normalizeArrangement(undefined); }
};

