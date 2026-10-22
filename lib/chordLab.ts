import type { Chord } from "../components/ChordDiagram";
import type { ChordLibraryItem } from "./chords";
import { analyzeChordFunction, scoreTransition, type HarmonyMode, type HarmonicRole } from "./harmony";
import { spellPitchClass, type NoteSpelling } from "./noteSpelling";
import { chordQuality, CHORD_QUALITIES } from "./chordQualities";

export type ChordLabTuning = { label: string; strings: readonly string[]; semitoneOffsets: readonly number[] };
export type LabStats = { strength?: number; reps?: number; misses?: number; seconds?: number; nextReviewAt?: string };
const PITCH = new Map(["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map((n, i) => [n, i]));
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const pc = (name: string) => PITCH.get(name) ?? PITCH.get(({ Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" } as Record<string, string>)[name] ?? "") ?? -1;
const noteName = (midi: number, spelling: NoteSpelling = "current") => spellPitchClass(midi, spelling);

export function soundingSummary(entry: ChordLibraryItem, tuning: ChordLabTuning, capo = 0, spelling: NoteSpelling = "current") {
  if (entry.chord.frets.length !== 6 || tuning.semitoneOffsets.length !== 6) return { supported: false as const, midi: [], pitches: [], bass: null, melody: null };
  const midi = soundingMidi(entry.chord, tuning, capo);
  return { supported: true as const, midi, pitches: [...new Set(midi.map(n => noteName(n, spelling)))], bass: midi.length ? noteName(Math.min(...midi), spelling) : null, melody: midi.length ? noteName(Math.max(...midi), spelling) : null };
}

export function completenessAudit(entry: ChordLibraryItem, tuning: ChordLabTuning, capo = 0, intentionalOmissions: number[] = [], spelling: NoteSpelling = "current") {
  const summary = soundingSummary(entry, tuning, capo, spelling);
  if (!summary.supported) return { supported: false as const, expected: [], actual: [], missing: [], optionalMissing: [], doubled: [], intentional: [] };
  const root = pc(entry.root);
  const formula = chordQuality(entry.quality);
  if (root < 0 || !formula) return { supported: false as const, expected: [], actual: summary.pitches, missing: [], optionalMissing: [], doubled: [], intentional: [] };
  const expectedMidi = formula.essential.map(i => (root + i + capo) % 12);
  const optionalMidi = formula.optional.map(i => (root + i + capo) % 12);
  const counts = new Map<number, number>(); summary.midi.forEach(n => counts.set(n % 12, (counts.get(n % 12) ?? 0) + 1));
  const expected = [...new Set(expectedMidi)].map(n => noteName(n, spelling)), missing = expectedMidi.filter(n => !counts.has(n)).map(n => noteName(n, spelling)), optionalMissing = optionalMidi.filter(n => !counts.has(n)).map(n => noteName(n, spelling)), intentional = [...new Set(intentionalOmissions.filter(i => Number.isInteger(i) && i >= 0 && i < expectedMidi.length && !counts.has(expectedMidi[i])).map(i => noteName(expectedMidi[i], spelling)))];
  return { supported: true as const, expected, actual: summary.pitches, missing: [...new Set(missing.filter(n => !intentional.includes(n)))], optionalMissing: [...new Set(optionalMissing)], doubled: [...counts].filter(([, count]) => count > 1).map(([n]) => noteName(n, spelling)), intentional };
}

export function progressionTransitionCost(a:ChordLibraryItem,b:ChordLibraryItem,tuning:ChordLabTuning,capo=0) {
  if(a.chord.frets.length!==6||b.chord.frets.length!==6||tuning.semitoneOffsets.length!==6)return Infinity;
  const midi=(entry:ChordLibraryItem,i:number)=>entry.chord.frets[i]<0?null:OPEN_MIDI[i]+tuning.semitoneOffsets[i]+entry.chord.frets[i]+capo;
  const perString=Array.from({length:6},(_,i)=>{const x=midi(a,i),y=midi(b,i);return x===null&&y===null?0:x===null||y===null?8:Math.abs(x-y);}).reduce((sum,n)=>sum+n,0);
  return perString+scoreTransition(a.chord,b.chord).score/20;
}
export function actualChordName(entry: ChordLibraryItem, tuning: ChordLabTuning, capo = 0, spelling: NoteSpelling = "current") {
  const s = soundingSummary(entry, tuning, capo, spelling); if (!s.supported || !s.pitches.length) return "Unsupported voicing";
  const pcs = new Set(s.midi.map(n => n % 12));
  const matches = CHORD_QUALITIES.flatMap(definition => Array.from({ length: 12 }, (_, root) => ({ quality: definition.id, root, tones: new Set(definition.intervals.map(i => (root + i) % 12)), essential: new Set(definition.essential.map(i => (root + i) % 12)) })).filter(x => [...x.essential].every(n => pcs.has(n)) && [...pcs].every(n => x.tones.has(n))));
  const preferred = matches.filter(m => m.root === (pc(entry.root) + capo + 12) % 12 && m.quality === entry.quality);
  const chosen = preferred.length ? preferred : matches;
  const labels = Object.fromEntries(CHORD_QUALITIES.map((quality) => [quality.id, quality.suffix]));
  if (chosen.length !== 1 && preferred.length !== 1) return `Pitch set: ${s.pitches.join("–")}${s.bass ? ` (bass ${s.bass})` : ""}`;
  const m = chosen[0]; return `${spellPitchClass(m.root, spelling)}${labels[m.quality]}${s.bass && pc(s.bass) !== m.root ? `/${s.bass}` : ""}`;
}

export function optimizeProgression(identities: ChordLibraryItem[][], tuning: ChordLabTuning, capo = 0) {
  if (identities.length < 1 || identities.length > 12 || identities.some(group => !group.length || group.length > 12 || group.some(e => e.chord.frets.length !== 6)) || tuning.semitoneOffsets.length !== 6) return null;
  const notes = identities.map(group => group.map(entry => Array.from({length:6}, (_,i) => entry.chord.frets[i] < 0 ? null : OPEN_MIDI[i] + tuning.semitoneOffsets[i] + entry.chord.frets[i] + capo)));
  const allEntries = identities.flat(); const noteById = new Map(allEntries.map((entry,i) => [entry.id, notes.flat()[i]]));
  const pairCosts = new Map<string, number>();
  for (let step=1; step<identities.length; step++) for (const a of identities[step-1]) for (const b of identities[step]) {
    const x=noteById.get(a.id)!, y=noteById.get(b.id)!;
    const perString=x.reduce<number>((sum,n,i)=>sum+(n===null&&y[i]===null?0:n===null||y[i]===null?8:Math.abs(n-y[i]!)),0);
    pairCosts.set(`${a.id}\0${b.id}`, perString + scoreTransition(a.chord,b.chord).score / 20);
  }
  const cost = (a: ChordLibraryItem, b: ChordLibraryItem) => pairCosts.get(`${a.id}\0${b.id}`) ?? Infinity;
  let states = identities[0].map(entry => ({ entry, total: 0, path: [entry] }));
  for (const choices of identities.slice(1)) states = choices.map(entry => { const best = states.map(s => ({ ...s, total: s.total + cost(s.entry, entry), path: [...s.path, entry] })).sort((a,b) => a.total-b.total)[0]; return { ...best, entry }; });
  return states.sort((a,b) => a.total-b.total)[0];
}

export const soundingMidi = (chord: Chord, tuning: ChordLabTuning, capo = 0) => chord.frets.flatMap((fret, i) => fret < 0 ? [] : [OPEN_MIDI[i] + (tuning.semitoneOffsets[i] ?? 0) + fret + capo]);
export const pitchClasses = (chord: Chord, tuning: ChordLabTuning) => new Set(soundingMidi(chord, tuning).map(n => n % 12));

export function voicingIntent(entry: ChordLibraryItem, tuning?: ChordLabTuning, capo = 0) {
  const frets = entry.chord.frets.filter(f => f >= 0), open = frets.filter(f => f === 0).length;
  const span = frets.length ? Math.max(...frets) - Math.min(...frets) : 0;
  const low = entry.chord.frets.findIndex(f => f >= 0), bass = low < 0 ? 0 : entry.chord.frets[low];
  const intents = [
    { name: "Bass movement", reason: low < 0 ? "No sounding bass note is defined by this shape." : `The lowest sounding pitch is ${tuning ? `${noteName(OPEN_MIDI[low] + (tuning.semitoneOffsets[low] ?? 0) + bass + capo)}${Math.floor((OPEN_MIDI[low] + (tuning.semitoneOffsets[low] ?? 0) + bass + capo) / 12) - 1}` : `string ${6 - low}`} at fret ${bass}; ${entry.inversion === "inverted" ? "the library marks this as an inversion." : "this low-string placement can support a moving bass line."}`, fits: entry.inversion === "inverted" || low <= 2 && bass > 0 },
    { name: "Lead fill", reason: `The top voice is ${entry.chord.frets[5] < 0 ? "muted" : tuning ? `${noteName(OPEN_MIDI[5] + (tuning.semitoneOffsets[5] ?? 0) + entry.chord.frets[5] + capo)}${Math.floor((OPEN_MIDI[5] + (tuning.semitoneOffsets[5] ?? 0) + entry.chord.frets[5] + capo) / 12) - 1}` : `fret ${entry.chord.frets[5]}`}, with a compact upper-string shape for melodic answers.`, fits: entry.chord.frets[5] >= 0 && (entry.chord.frets[0] < 0 || entry.chord.frets[1] < 0) },
    { name: "Compact comping", reason: `${frets.length} sounding strings${span <= 4 ? ` within a ${span}-fret span` : ""}; useful for controlled rhythmic hits.`, fits: frets.length <= 4 || span <= 3 },
    { name: "Accompaniment", reason: `${open} open string${open === 1 ? "" : "s"} and ${frets.length} sounding strings provide a stable, resonant bed.`, fits: true }
  ];
  return intents.find(item => item.fits) ?? intents[3];
}

export function nearestEquivalent(selected: ChordLibraryItem, entries: ChordLibraryItem[], tuning: ChordLabTuning, capo = 0) {
  const root = pc(selected.root), formula = chordQuality(selected.quality)?.intervals;
  if (root < 0 || !formula) return null;
  const target = new Set(formula.map(n => (root + n + capo) % 12));
  if (!target.size) return null;
  return entries.filter(e => e.id !== selected.id && e.root === selected.root && e.quality === selected.quality && sameSet(pitchClasses({ ...e.chord, frets: e.chord.frets.map(f => f < 0 ? f : f + capo) }, tuning), target))
    .sort((a, b) => fretCost(a.chord) - fretCost(b.chord))[0] ?? null;
}
const sameSet = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every(n => b.has(n));
const fretCost = (c: Chord) => c.frets.reduce((s, f) => s + Math.max(0, f), 0) + c.frets.filter(f => f > 4).length * 4;

export function chordTones(entry: ChordLibraryItem, tuning: ChordLabTuning, capo = 0, spelling: NoteSpelling = "current") {
  const quality = chordQuality(entry.quality); if (!quality) return [];
  const root = pc(entry.root); if (root < 0) return [];
  const played = soundingMidi(entry.chord, tuning, capo);
  const labels = new Map<number, string>([[0,"Root"],[2,"2nd / 9th"],[3,"Minor 3rd"],[4,"Major 3rd"],[5,"4th / 11th"],[6,"Diminished 5th"],[7,"5th"],[8,"Augmented 5th"],[9,"6th / 13th"],[10,"Minor 7th"],[11,"Major 7th"]]);
  return quality.intervals.map((interval) => {
    const pitch = (root + interval + capo) % 12;
    const midi = played.filter(n => n % 12 === pitch).sort((a, b) => a - b)[0];
    return { label: `${labels.get(interval) ?? `+${interval}`} (${quality.optional.includes(interval) ? "optional color" : "essential"})`, pitch: noteName(pitch, spelling), midi };
  });
}

export function inversionBassDegree(entry: ChordLibraryItem, tuning: ChordLabTuning, capo = 0, spelling: NoteSpelling = "current") {
  const summary = soundingSummary(entry, tuning, capo, spelling);
  if (!summary.supported || !summary.midi.length) return { note: null, degree: "No sounding bass", label: "No sounding bass" };
  const lowest = Math.min(...summary.midi), bassPc = lowest % 12, rootPc = (pc(entry.root) + capo + 12) % 12;
  const quality = chordQuality(entry.quality);
  const interval = (bassPc - rootPc + 12) % 12;
  const degreeLabels = new Map<number, string>([[0,"root position"],[3,"3rd in bass"],[4,"3rd in bass"],[6,"5th in bass"],[7,"5th in bass"],[8,"5th in bass"],[9,"6th in bass"],[10,"7th in bass"],[11,"7th in bass"]]);
  const isChordTone = Boolean(quality?.intervals.includes(interval));
  const degree = isChordTone ? degreeLabels.get(interval) ?? `color tone (${spellPitchClass(interval, spelling)}) in bass` : "non-chord bass tone";
  const octave = Math.floor(lowest / 12) - 1;
  return { note: `${noteName(lowest, spelling)}${octave}`, degree, label: `${degree} · ${noteName(lowest, spelling)}${octave}` };
}

export function voiceLeading(from: ChordLibraryItem, to: ChordLibraryItem, tuning: ChordLabTuning, capo = 0) {
  return Array.from({ length: 6 }, (_, i) => {
    const midiAt = (entry: ChordLibraryItem) => entry.chord.frets[i] < 0 ? undefined : OPEN_MIDI[i] + (tuning.semitoneOffsets[i] ?? 0) + entry.chord.frets[i] + capo;
    const x = midiAt(from), y = midiAt(to), string = `String ${6 - i}`;
    const label = (n: number | undefined) => n === undefined ? "mute" : `${noteName(n)}${Math.floor(n / 12) - 1}`;
    return `${string}: ${label(x)} → ${label(y)}${x === undefined || y === undefined ? "" : x === y ? " (held)" : ` (${y > x ? "+" : ""}${y - x} semitones)`}`;
  });
}

export function functionalAlternatives(selected: ChordLibraryItem, entries: ChordLibraryItem[], key: string, mode: HarmonyMode) {
  const current = analyzeChordFunction({ key, mode, root: selected.root, quality: selected.quality }).find(fn => fn.available);
  if (!current) return [];
  const tonic: HarmonicRole[] = mode === "major" ? ["I", "vi", "iii"] : ["i", "VI", "III"];
  const predominant: HarmonicRole[] = mode === "major" ? ["IV", "ii"] : ["iv", "ii°"];
  const dominant: HarmonicRole[] = ["V", "vii°"];
  const family = [tonic, predominant, dominant].find(roles => roles.includes(current.role));
  if (!family) return [];
  return entries.flatMap(entry => {
    if (entry.id === selected.id) return [];
    const fn = analyzeChordFunction({ key, mode, root: entry.root, quality: entry.quality }).find(candidate => candidate.available && family.includes(candidate.role) && candidate.role !== current.role);
    const familyName = family === tonic ? "tonic" : family === predominant ? "predominant" : "dominant";
    return fn ? [{ entry, role: fn.role, reason: `${fn.role} is a ${familyName}-function alternative to ${current.role} in ${key} ${mode}. ${fn.suggestedResolution}` }] : [];
  });
}

export function reviewQueue(entries: ChordLibraryItem[], stats: Record<string, LabStats>, now = Date.now()) {
  return entries.map(entry => {
    const s = stats[entry.id] ?? {}, due = s.nextReviewAt ? Date.parse(s.nextReviewAt) : Infinity;
    const reps = Math.max(0, s.reps ?? 0), strength = Math.max(0, s.strength ?? 0), misses = Math.max(0, s.misses ?? 0);
    const confidence = Math.max(0, Math.min(100, Math.round(Math.min(10, reps) * 5 + Math.min(10, strength) * 5 - Math.min(8, misses) * 8)));
    const reason = due <= now ? "Due for review" : reps === 0 ? "No repetitions logged yet" : misses > 0 ? `${misses} logged miss${misses === 1 ? "" : "es"}; reinforce recall` : strength === 0 ? "No practice-strength signal logged" : "Practice signal is stable; maintain recall";
    return { entry, reason, confidence, due: due <= now };
  }).sort((a, b) => Number(b.due) - Number(a.due) || a.confidence - b.confidence).slice(0, 6);
}

export function transitionEstimate(a: ChordLibraryItem, b: ChordLibraryItem, genre: string, key: string, mode: HarmonyMode, tempo: number) {
  const distance = a.chord.frets.reduce((sum, fret, i) => sum + (fret < 0 || b.chord.frets[i] < 0 ? 1 : Math.abs(fret - b.chord.frets[i])), 0);
  const bothOpen = a.chord.frets.includes(0) && b.chord.frets.includes(0);
  const bothClosed = !a.chord.frets.includes(0) && !b.chord.frets.includes(0);
  const bothSeventh = a.quality.includes("7") && b.quality.includes("7");
  const genreWeight = genre === "Jazz" ? (bothSeventh ? 1.2 : 0.84)
    : genre === "Folk" ? (bothOpen ? 1.2 : 0.82)
      : genre === "Rock" ? (bothClosed ? 1.12 : 0.9)
        : bothOpen ? 1.08 : 0.96;
  const fromFunction = analyzeChordFunction({ key, mode, root: a.root, quality: a.quality }).find(fn => fn.available);
  const toFunctions = analyzeChordFunction({ key, mode, root: b.root, quality: b.quality }).filter(fn => fn.available);
  const keyWeight = fromFunction && toFunctions.length ? (toFunctions.some(fn => fromFunction.nextRoles.includes(fn.role)) ? 1.18 : 0.82) : 0.75;
  return Math.max(0, Math.min(100, Math.round((100 - distance * (tempo > 120 ? 8 : tempo < 70 ? 4 : 6)) * genreWeight * keyWeight)));
}
