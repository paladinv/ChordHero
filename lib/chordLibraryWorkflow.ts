import type { Chord } from "../components/ChordDiagram";
import type { ChordLibraryItem } from "./chords";
import { completenessAudit, type ChordLabTuning } from "./chordLab";
import { chordQuality, chordQualityFromAlias, CHORD_QUALITIES } from "./chordQualities";

export const LOCAL_CHORDS_KEY = "chord-hero-local-shapes-v1";
export const TRANSITION_LOG_KEY = "chord-hero-transition-log-v1";
export const LIBRARY_BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 256_000;
export type LocalChordShape = { id: string; chord: Chord; root: string; quality: string; inversion: "standard" | "inverted"; provenance: "generated" | "manual"; reviewStatus?: "unreviewed" | "user-verified"; reviewedAt?: string; createdAt: string };
export type TransitionEvent = { id: string; fromId: string; toId: string; outcome: "clean" | "missed"; tempo: number; timestamp: string };
const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const PITCH_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const ROOT_PC: Record<string, number> = Object.fromEntries(ROOTS.map((n, i) => [n, i]));
const FORMULAS = Object.fromEntries(CHORD_QUALITIES.map((quality) => [quality.id, [...quality.intervals]])) as Record<string, number[]>;
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const normalizeRoot = (root: string) => ({ Cb: "B", Db: "C#", "D#": "Eb", "E#": "F", Fb: "E", Gb: "F#", "G#": "Ab", "A#": "Bb", "B#": "C" } as Record<string, string>)[root] ?? root;

export function parseChordIdentity(text: string) {
  if (typeof text !== "string" || text.length > 48) return null;
  const normalized = text.replace(/♯/g, "#").replace(/♭/g, "b");
  const match = /^\s*([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?\s*$/.exec(normalized);
  if (!match) return null;
  const root = normalizeRoot(match[1]);
  const bass = match[3] ? normalizeRoot(match[3]) : null;
  if (!(root in ROOT_PC) || (bass && !(bass in ROOT_PC))) return null;
  const rawQuality = match[2].replace(/[\s_]/g, "").toLowerCase();
  let quality: string | undefined;
  if (rawQuality === "") quality = "major";
  else quality = chordQualityFromAlias(rawQuality)?.id;
  if (!quality || !FORMULAS[quality]) return null;
  return { root, quality, bass, name: `${root}${chordQuality(quality)?.suffix ?? ""}${bass ? `/${bass}` : ""}` };
}

/** Bounded six-string search; returns at most six playable shapes in frets 0-7. */
export function generatePlayableVoicings(identity: NonNullable<ReturnType<typeof parseChordIdentity>>, tuning: ChordLabTuning, capo = 0): LocalChordShape[] {
  if (tuning.semitoneOffsets.length !== 6 || tuning.semitoneOffsets.some(n => !Number.isInteger(n) || n < -24 || n > 24)) return [];
  const target = new Set(FORMULAS[identity.quality].map(i => (ROOT_PC[identity.root] + i) % 12));
  const bassPc = identity.bass ? ROOT_PC[identity.bass] : null;
  const choices = OPEN_MIDI.map((open, string) => {
    const frets = Array.from({ length: 8 }, (_, fret) => fret).filter(fret => {
      const pitch = ((open + tuning.semitoneOffsets[string] + capo + fret) % 12 + 12) % 12;
      return string === 0 && bassPc !== null ? pitch === bassPc : target.has(pitch);
    });
    return string === 0 && bassPc !== null ? frets : [-1, ...frets];
  });
  let beam: Array<{ frets: number[]; notes: Array<number | null>; coverage: number; minFret: number; maxFret: number }> = [{ frets: [], notes: [], coverage: 0, minFret: 99, maxFret: 0 }];
  const BEAM_WIDTH = 256;
  for (let string = 0; string < 6; string++) {
    const next = beam.flatMap(state => choices[string].flatMap(fret => {
      if (fret > 0 && state.minFret !== 99 && Math.max(state.maxFret, fret) - Math.min(state.minFret, fret) > 4) return [];
      const note = fret < 0 ? null : ((OPEN_MIDI[string] + tuning.semitoneOffsets[string] + capo + fret) % 12 + 12) % 12;
      const notes = [...state.notes, note], coverage = new Set(notes.filter((n): n is number => n !== null)).size;
      const minFret = fret > 0 ? Math.min(state.minFret, fret) : state.minFret;
      const maxFret = fret > 0 ? Math.max(state.maxFret, fret) : state.maxFret;
      return [{ frets: [...state.frets, fret], notes, coverage, minFret, maxFret }];
    }));
    beam = next.sort((a, b) => b.coverage - a.coverage || a.frets.filter(f => f < 0).length - b.frets.filter(f => f < 0).length || a.frets.reduce((sum, f) => sum + Math.max(0, f), 0) - b.frets.reduce((sum, f) => sum + Math.max(0, f), 0)).slice(0, BEAM_WIDTH);
  }
  const candidates = beam.flatMap(state => {
    const notes = state.notes.filter((note): note is number => note !== null);
    const bass = state.frets.flatMap((fret, string) => fret < 0 ? [] : [{ midi: OPEN_MIDI[string] + tuning.semitoneOffsets[string] + capo + fret, pitch: ((OPEN_MIDI[string] + tuning.semitoneOffsets[string] + capo + fret) % 12 + 12) % 12 }]).reduce<{ midi: number; pitch: number } | null>((lowest, note) => !lowest || note.midi < lowest.midi ? note : lowest, null)?.pitch ?? null;
      if (notes.length < 3 || (bassPc !== null && bass !== bassPc) || state.notes.some((note, string) => note !== null && !target.has(note) && !(string === 0 && bassPc !== null && note === bassPc)) || state.coverage < Math.min(3, target.size)) return [];
    return [{ frets: state.frets, coverage: state.coverage, span: state.minFret === 99 ? 0 : state.maxFret - state.minFret }];
  });
  const seen = new Set<string>();
  return candidates.sort((a, b) => b.coverage - a.coverage || a.span - b.span || a.frets.reduce((s, n) => s + Math.max(0, n), 0) - b.frets.reduce((s, n) => s + Math.max(0, n), 0))
    .filter(item => { const key = item.frets.join(","); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 6)
    .map((item, index) => {
      const bassIndex = item.frets.findIndex(f => f >= 0);
      const bassPcActual = bassIndex < 0 ? -1 : ((OPEN_MIDI[bassIndex] + tuning.semitoneOffsets[bassIndex] + capo + item.frets[bassIndex]) % 12 + 12) % 12;
      const isChordInversion = bassPcActual !== ROOT_PC[identity.root] && target.has(bassPcActual);
      return { id: `local-generated-${identity.root}-${identity.quality}-${identity.bass ?? "root"}-${item.frets.join("")}`, root: identity.root, quality: identity.quality, inversion: isChordInversion ? "inverted" as const : "standard" as const, provenance: "generated" as const, createdAt: new Date(0).toISOString(), chord: { name: `${identity.name} · generated ${index + 1}`, frets: item.frets, fingers: Array(6).fill(null) } };
    });
}

export function validateLocalChordShapes(value: unknown): LocalChordShape[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.slice(0, 200).flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const x = raw as Record<string, unknown>, c = x.chord as Record<string, unknown> | undefined;
    if (typeof x.id !== "string" || !/^local-(generated|manual)-[A-Za-z0-9#_-]{1,120}$/.test(x.id) || ids.has(x.id) || typeof x.root !== "string" || !(normalizeRoot(x.root) in ROOT_PC) || typeof x.quality !== "string" || !FORMULAS[x.quality] || !c || typeof c.name !== "string" || c.name.length > 100 || !Array.isArray(c.frets) || c.frets.length !== 6 || !c.frets.every(f => Number.isInteger(f) && (f as number) >= -1 && (f as number) <= 24)) return [];
    ids.add(x.id);
    const frets = c.frets as number[];
    return [{ id: x.id, root: normalizeRoot(x.root), quality: x.quality, inversion: x.inversion === "inverted" ? "inverted" as const : "standard" as const, provenance: x.provenance === "manual" ? "manual" as const : "generated" as const, reviewStatus: x.reviewStatus === "user-verified" ? "user-verified" as const : "unreviewed" as const, ...(typeof x.reviewedAt === "string" ? { reviewedAt: x.reviewedAt.slice(0, 32) } : {}), createdAt: typeof x.createdAt === "string" ? x.createdAt.slice(0, 32) : "", chord: { name: c.name, frets, fingers: Array.isArray(c.fingers) && c.fingers.length === 6 && c.fingers.every(f => f === null || [1, 2, 3, 4].includes(f as number)) ? c.fingers as Chord["fingers"] : Array(6).fill(null) } }];
  });
}

export function validateTransitionLog(value: unknown): TransitionEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-500).flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const x = raw as Record<string, unknown>, time = typeof x.timestamp === "string" ? Date.parse(x.timestamp) : NaN;
    if (typeof x.id !== "string" || x.id.length > 80 || typeof x.fromId !== "string" || x.fromId.length > 150 || typeof x.toId !== "string" || x.toId.length > 150 || (x.outcome !== "clean" && x.outcome !== "missed") || !Number.isFinite(x.tempo) || (x.tempo as number) < 30 || (x.tempo as number) > 300 || !Number.isFinite(time)) return [];
    return [{ id: x.id, fromId: x.fromId, toId: x.toId, outcome: x.outcome, tempo: Math.round(x.tempo as number), timestamp: new Date(time).toISOString() }];
  });
}

export function classifyFingerMovements(from: Chord, to: Chord) {
  return Array.from({ length: 6 }, (_, string) => {
    const a = from.frets[string] ?? -1, b = to.frets[string] ?? -1, fa = from.fingers?.[string] ?? null, fb = to.fingers?.[string] ?? null;
    const state = a < 0 && b < 0 ? "muted both" : a < 0 ? "fret" : b < 0 ? "lift" : a === b && fa === fb ? "held" : fa !== null && fb !== null && fa !== fb ? "re-finger" : "move";
    return { string: 6 - string, fromFret: a, toFret: b, fromFinger: fa, toFinger: fb, state };
  });
}

export function identifyChordFromPitchClasses(pitches: readonly number[]) {
  const actual = new Set(pitches.filter(n => Number.isInteger(n) && n >= 0 && n < 12));
  if (!actual.size) return null;
  const matches = Object.entries(FORMULAS).flatMap(([quality, intervals]) => ROOTS.flatMap(root => {
    const expected = new Set(intervals.map(i => (ROOT_PC[root] + i) % 12));
    const definition = chordQuality(quality)!;
    const essential = new Set(definition.essential.map(i => (ROOT_PC[root] + i) % 12));
    return [...essential].every(n => actual.has(n)) && [...actual].every(n => expected.has(n)) ? [{ root, quality, specificity: expected.size - actual.size }] : [];
  }));
  if (!matches.length) return null;
  const best = Math.min(...matches.map(match => match.specificity));
  const ranked = matches.filter(match => match.specificity === best);
  return ranked.length === 1 ? { root: ranked[0].root, quality: ranked[0].quality } : null;
}

export function validateLibraryBackup(value: unknown) {
  let json: string;
  try { json = JSON.stringify(value) ?? ""; } catch { return { ok: false as const, error: "Backup is not valid JSON data." }; }
  if (!json || json.length > MAX_BACKUP_BYTES) return { ok: false as const, error: "Backup is empty or exceeds the 256 KB limit." };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false as const, error: "Invalid backup object." };
  const x = value as Record<string, unknown>;
  if (x.version !== LIBRARY_BACKUP_VERSION || !x.data || typeof x.data !== "object" || Array.isArray(x.data)) return { ok: false as const, error: "Unsupported backup version or missing data." };
  const data = x.data as Record<string, unknown>;
  if (!data.overrides || typeof data.overrides !== "object" || Array.isArray(data.overrides) || !data.history || typeof data.history !== "object" || Array.isArray(data.history) || !Array.isArray(data.collections) || !Array.isArray(data.shapes) || !Array.isArray(data.transitions)) return { ok: false as const, error: "Backup is missing required local-data sections." };
  return { ok: true as const, data: { overrides: data.overrides, history: data.history, collections: data.collections, shapes: validateLocalChordShapes(data.shapes), transitions: validateTransitionLog(data.transitions) } };
}

export function validateSoundingHarmony(entry: ChordLibraryItem, tuning: ChordLabTuning, capo = 0) {
  const result = completenessAudit(entry, tuning, capo);
  if (!result.supported) return { status: "unverified" as const, message: `No supported formula for ${entry.quality}; no correctness claim made.`, notes: result.actual };
  const expected = new Set(result.expected), actual = new Set(result.actual);
  const soundingByString = entry.chord.frets.flatMap((fret, string) => fret < 0 ? [] : [{ string, midi: OPEN_MIDI[string] + (tuning.semitoneOffsets[string] ?? 0) + fret + capo }]);
  const bassNote = soundingByString.reduce<{string:number;midi:number}|null>((lowest, note) => !lowest || note.midi < lowest.midi ? note : lowest, null);
  const rootPc = ROOT_PC[normalizeRoot(entry.root)];
  const quality = chordQuality(entry.quality);
  const expectedPitchClasses = new Set(rootPc === undefined ? [] : (quality?.intervals ?? []).map(interval => ((rootPc + interval + capo) % 12 + 12) % 12));
  const bassMidi = bassNote?.midi ?? null;
  const bassPitch = bassMidi === null ? null : ((bassMidi % 12) + 12) % 12;
  const slashBass = /\/([A-G](?:#|b)?)/.exec(entry.chord.name)?.[1];
  const expectedBass = slashBass && ROOT_PC[normalizeRoot(slashBass)] !== undefined ? (ROOT_PC[normalizeRoot(slashBass)] + capo) % 12 : rootPc === undefined ? null : (rootPc + capo) % 12;
  const bassIsChordTone = bassPitch !== null && expectedPitchClasses.has(bassPitch);
  const bassMatches = bassPitch !== null && (slashBass ? bassPitch === expectedBass : entry.inversion === "inverted" ? rootPc !== undefined && bassIsChordTone && bassPitch !== (rootPc + capo) % 12 : bassPitch === expectedBass);
  const allowedPitches = new Set(rootPc === undefined ? [] : (quality?.intervals ?? []).map(interval => PITCH_NAMES[(rootPc + interval + capo) % 12]));
  if (slashBass && expectedBass !== null && bassPitch === expectedBass) allowedPitches.add(PITCH_NAMES[expectedBass]);
  const unexpected = [...actual].filter(note => !allowedPitches.has(note));
  const valid = result.missing.length === 0 && unexpected.length === 0 && bassMatches;
  const bassIssue = !bassMatches ? slashBass ? `; lowest sounding bass does not match requested slash tone ${slashBass}` : entry.inversion === "inverted" ? "; lowest sounding bass does not match a non-root chord tone for the declared inversion" : "; lowest sounding bass does not match the written root (check inversion label)" : "";
  const stringIssues = entry.chord.frets.flatMap((fret, string) => {
    if (fret < 0) return [];
    const pitch = ((OPEN_MIDI[string] + (tuning.semitoneOffsets[string] ?? 0) + fret + capo) % 12 + 12) % 12;
    return expectedPitchClasses.has(pitch) || (slashBass && pitch === expectedBass) ? [] : [{ string: 6 - string, fret, note: PITCH_NAMES[pitch], issue: "Unexpected sounding tone" }];
  });
  return { status: valid ? "pass" as const : "invalid" as const, message: valid ? slashBass ? "Essential formula tones match; the requested slash bass is present as the lowest sounding note." : "Essential formula tones and declared bass/inversion match the supported chord formula." : `Formula mismatch${result.missing.length ? `; missing essential tone(s) ${result.missing.join(", ")}` : ""}${result.optionalMissing.length ? `; optional color omitted ${result.optionalMissing.join(", ")}` : ""}${unexpected.length ? `; contains unexpected tone(s) ${unexpected.join(", ")}` : ""}${bassIssue}.`, notes: result.actual, missing: result.missing, optionalMissing: result.optionalMissing, bassMidi, bassPitch, stringIssues };
}

export function buildLocalShapeReviewPacket(value: unknown, tuning: ChordLabTuning, capo = 0) {
  const inputCount = Array.isArray(value) ? value.length : 0;
  const shapes = validateLocalChordShapes(value);
  const entries = shapes.map((shape) => {
    const candidate = shape as unknown as ChordLibraryItem;
    const quality = chordQuality(shape.quality);
    const validation = validateSoundingHarmony(candidate, tuning, capo);
    return {
      shape,
      provenance: shape.provenance,
      reviewStatus: shape.reviewStatus ?? "unreviewed",
      formula: quality ? { qualityId: quality.id, intervals: [...quality.intervals], essential: [...quality.essential], optional: [...quality.optional] } : null,
      pitchValidation: { status: validation.status, message: validation.message, expectedEssential: validation.status === "unverified" ? [] : completenessAudit(candidate, tuning, capo).expected, soundingNotes: validation.notes, missingEssential: validation.status === "unverified" ? [] : validation.missing, missingOptional: validation.status === "unverified" ? [] : validation.optionalMissing, bassPitch: validation.status === "unverified" ? null : validation.bassPitch }
    };
  });
  return {
    schemaVersion: 1,
    kind: "local-chord-shape-review-packet",
    generatedAt: new Date().toISOString(),
    canonicalPromotion: false,
    notice: "Formula and pitch checks are automated estimates; review status is local user metadata. This packet is not teacher endorsement and does not add shapes to the canonical library.",
    scope: { tuning: tuning.label, capo, limit: 200, inputCount, includedCount: entries.length, excludedCount: Math.max(0, inputCount - entries.length), capped: inputCount > 200 },
    entries
  };
}

/** Deterministic, bounded single-string edits for the selected invalid chart only. */
export function suggestVoicingCorrections(entry: ChordLibraryItem, tuning: ChordLabTuning, capo = 0, limit = 5) {
  const original = validateSoundingHarmony(entry, tuning, capo);
  if (original.status !== "invalid" || entry.chord.frets.length !== 6) return [];
  const suggestions: Array<{ frets: number[]; change: string; status: string }> = [];
  const tried = new Set<string>();
  for (let string = 0; string < 6; string++) {
    const current = entry.chord.frets[string];
    const candidates = [...new Set([...(current < 0 ? [] : [-1]), ...Array.from({ length: 13 }, (_, fret) => fret).filter(fret => fret !== current)])].sort((a, b) => a - b);
    for (const fret of candidates) {
      const frets = [...entry.chord.frets]; frets[string] = fret;
      const key = frets.join(","); if (tried.has(key)) continue; tried.add(key);
      const test = validateSoundingHarmony({ ...entry, chord: { ...entry.chord, frets } }, tuning, capo);
      if (test.status === "pass") suggestions.push({ frets, change: `String ${6 - string}: ${current < 0 ? "muted" : `fret ${current}`} → ${fret < 0 ? "mute" : `fret ${fret}`}`, status: test.status });
      if (suggestions.length >= Math.max(1, Math.min(5, limit))) return suggestions;
    }
  }
  return suggestions;
}

export function provenanceConfidence(entry: ChordLibraryItem, source: "curated" | "generated" | "local override", validation: ReturnType<typeof validateSoundingHarmony>) {
  const score = source === "curated" ? 72 : source === "generated" ? 45 : 60;
  return { label: source === "curated" ? "Curated library" : source === "generated" ? "Generated candidate" : "Local edit", score: validation.status === "pass" ? Math.min(95, score + 18) : validation.status === "invalid" ? Math.max(10, score - 30) : score, explanation: validation.status === "unverified" ? "Theory validation is unavailable for this quality." : validation.status === "pass" ? "Structural provenance plus a passing local pitch check; not a peer-reviewed guarantee." : `Local pitch check found a possible mismatch for ${entry.chord.name}.` };
}
