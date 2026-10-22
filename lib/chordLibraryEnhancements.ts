import { CHORD_LIBRARY, type ChordLibraryItem } from "./chords";
import { chordQuality, CHORD_QUALITIES } from "./chordQualities";
import { validateSoundingHarmony } from "./chordLibraryWorkflow";
import type { ChordLabTuning } from "./chordLab";
const LIBRARY_ID_SET = new Set(CHORD_LIBRARY.map(entry => entry.id));
export type ChordCollection = { id: string; name: string; chordIds: string[]; updatedAt: string };

export function validateChordCollections(value: unknown): ChordCollection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 30).flatMap(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>, id = typeof item.id === "string" ? item.id.slice(0, 64) : "", name = typeof item.name === "string" ? item.name.trim().slice(0, 48) : "";
    if (!id || !name || seen.has(id) || !Array.isArray(item.chordIds)) return [];
    seen.add(id);
    const chordIds = [...new Set(item.chordIds.filter((candidate): candidate is string => typeof candidate === "string" && LIBRARY_ID_SET.has(candidate)))].slice(0, 100);
    return [{ id, name, chordIds, updatedAt: typeof item.updatedAt === "string" ? item.updatedAt.slice(0, 32) : "" }];
  });
}


export function scoreVoicing(entry: ChordLibraryItem, handSpanCm: number, scaleLengthInches: number, action: "low" | "medium" | "high", transitionScore?: number, tuningOffsets: readonly number[] = [0,0,0,0,0,0], capo = 0, practice?: { reps: number; clean: number; misses: number }) {
  const bounded = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  const handSpan = bounded(handSpanCm, 19, 7, 24);
  const scaleLength = bounded(scaleLengthInches, 25.5, 20, 30);
  const capoFret = Math.round(bounded(capo, 0, 0, 24));
  const frets = Array.from({ length: 6 }, (_, index) => {
    const fret = entry.chord?.frets?.[index];
    return Number.isInteger(fret) && fret! >= -1 && fret! <= 24 ? fret! : -1;
  });
  const fretted = frets.filter(fret => fret > 0);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const muting = frets.filter(fret => fret < 0).length;
  const pitchIndex:Record<string,number>={C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};
  const definition = chordQuality(entry.quality);
  const root = pitchIndex[entry.root];
  const validOffsets = Array.isArray(tuningOffsets) && tuningOffsets.length === 6 && tuningOffsets.every(value => Number.isInteger(value) && value >= -24 && value <= 24);
  const offsets = validOffsets ? tuningOffsets : [0,0,0,0,0,0];
  const actualTones=new Set(frets.flatMap((fret,index)=>fret<0?[]:[((([40,45,50,55,59,64][index]+offsets[index]+fret+capoFret)%12)+12)%12]));
  const fingers = Array.isArray(entry.chord?.fingers) ? entry.chord.fingers : [];
  const uniqueFingers = new Set(fingers.filter((finger): finger is 1 | 2 | 3 | 4 => finger === 1 || finger === 2 || finger === 3 || finger === 4)).size;
  const completeness = definition && root !== undefined ? Math.round(definition.essential.filter(interval=>actualTones.has((root+interval+capoFret)%12)).length/definition.essential.length*100) : null;
  const hasBarre = Array.isArray(entry.difficultyTags) && entry.difficultyTags.includes("barre");
  const fingering = bounded(Math.round((uniqueFingers / Math.max(1, fretted.length)) * 65 + (hasBarre ? 20 : 35)), 50, 0, 100);
  const fretSpan = Math.max(30, 100 - span * 16);
  const transition = bounded(transitionScore ?? 70, 70, 0, 100);
  const reachLimit = handSpan * (25.5 / scaleLength);
  const actionPenalty = action === "high" ? 12 : action === "medium" ? 5 : action === "low" ? 0 : 5;
  const setup = bounded(Math.round(100 - Math.max(0, span + 2 - reachLimit) * 15 - actionPenalty), 50, 15, 100);
  const components: Array<[number, number]> = [[fingering,.2],[fretSpan,.18],[100-muting*8,.08],[transition,.1],[setup,.16]];
  if (completeness !== null) components.push([completeness,.28]);
  const weight = components.reduce((sum,[,partWeight])=>sum+partWeight,0);
  const baseScore = Math.round(components.reduce((sum,[value,partWeight])=>sum+value*partWeight,0)/weight);
  const validPractice = practice && Number.isFinite(practice.reps) && Number.isFinite(practice.clean) && Number.isFinite(practice.misses) && practice.reps > 0;
  const practiceAdjustment = validPractice ? Math.max(-6, Math.min(4, Math.round((practice.clean / Math.max(1, practice.reps) - practice.misses / Math.max(1, practice.reps)) * 6))) : 0;
  const score = bounded(baseScore + practiceAdjustment,50,0,100);
  const reasons = [completeness === null ? `Tone coverage unavailable for unsupported quality: ${entry.quality || "unknown"}.` : `${completeness}% tone coverage estimate`, `${fingering}% fingering simplicity estimate`, `${span}-fret hand span`, `${muting} muted strings`, `${transition}% transition fit`, `${setup}% setup fit estimate`];
  if (!validOffsets) reasons.push("Invalid tuning offsets; standard tuning used for this estimate.");
  if (validPractice) reasons.push(`Practice signal ${practiceAdjustment >= 0 ? "+" : ""}${practiceAdjustment} points from ${Math.max(0, Math.round(practice.reps))} reps (${Math.max(0, Math.round(practice.clean))} clean, ${Math.max(0, Math.round(practice.misses))} misses).`);
  else reasons.push("No practice penalty: this voicing has no recorded attempts.");
  const invalidNumeric = !Number.isFinite(handSpanCm) || handSpanCm < 7 || handSpanCm > 24 || !Number.isFinite(scaleLengthInches) || scaleLengthInches < 20 || scaleLengthInches > 30 || !Number.isInteger(capo) || capo < 0 || capo > 24 || (transitionScore !== undefined && (!Number.isFinite(transitionScore) || transitionScore < 0 || transitionScore > 100));
  if (invalidNumeric) reasons.push("Invalid numeric preference normalized to a safe value.");
  return { score, completeness, fingering, fretSpan, muting, transition, setup, span, reasons };
}

const QUALITY_ROOTS = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"] as const;
const INVERSION_DEGREES = ["root position","3rd in bass","5th in bass","7th in bass","other / slash bass"] as const;
export function chordLibraryCoverage(entries: ChordLibraryItem[], tuning: ChordLabTuning, capo = 0) {
  const rows = entries.slice(0, 2000);
  const qualities = CHORD_QUALITIES.map(quality => quality.id);
  const pitchClassByRoot: Record<string, number> = { C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11 };
  const cells = QUALITY_ROOTS.flatMap(root => qualities.map(quality => {
    const rootPitch = pitchClassByRoot[root];
    const matches = rows.filter(entry => pitchClassByRoot[entry.root] === rootPitch && entry.quality === quality);
    const byDegree: Record<string, number> = Object.fromEntries(INVERSION_DEGREES.map(degree => [degree, 0]));
    for (const entry of matches) {
      const validation = validateSoundingHarmony(entry, tuning, capo);
      const bass = validation.bassPitch;
      const interval = bass === null || bass === undefined ? -1 : (bass - rootPitch + 12) % 12;
      const degree = interval === 0 ? "root position" : [3,4].includes(interval) ? "3rd in bass" : [6,7,8].includes(interval) ? "5th in bass" : [10,11].includes(interval) ? "7th in bass" : "other / slash bass";
      byDegree[degree] += 1;
    }
    return { root, quality, count: matches.length, byDegree };
  }));
  return { scanned: rows.length, roots: QUALITY_ROOTS.length, qualities, cells };
}

export function buildChordQualityReport(entries: ChordLibraryItem[], tuning: ChordLabTuning, capo = 0) {
  const boundedEntries = entries.slice(0, 2000);
  const structural = auditChordLibrary(boundedEntries);
  const theory = { pass: 0, invalid: 0, unverified: 0 };
  for (const entry of boundedEntries) theory[validateSoundingHarmony(entry, tuning, capo).status] += 1;
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), scope: { scanned: boundedEntries.length, capped: entries.length > boundedEntries.length, tuning: tuning.label, capo }, counts: { theory, structuralIssues: structural.issues.length, structuralCategories: structural.categories }, coverage: chordLibraryCoverage(boundedEntries, tuning, capo), structural: structural.issues.slice(0, 500) };
}

export function auditChordLibrary(entries: ChordLibraryItem[]) {
  const rows = Array.isArray(entries) ? entries.slice(0, 2000) as unknown[] : [], ids = new Set<string>();
  const issues = rows.flatMap((raw): Array<{ id: string; name: string; issue: string }> => {
    const entry: Partial<ChordLibraryItem> = raw && typeof raw === "object" ? raw as Partial<ChordLibraryItem> : {};
    const id = typeof entry.id === "string" ? entry.id : "unknown-record";
    const name = typeof entry.chord?.name === "string" ? entry.chord.name : id;
    const chart = entry.chord && typeof entry.chord === "object" ? entry.chord as Partial<ChordLibraryItem["chord"]> : null;
    const found: Array<{ id: string; name: string; issue: string }> = [];
    if (ids.has(id)) found.push({ id, name, issue: "Duplicate record ID" }); else ids.add(id);
    if (!chart || !Array.isArray(chart.frets)) found.push({ id, name, issue: "Missing chart data" });
    else if (chart.frets.length !== 6) found.push({ id, name, issue: "Invalid chart length" });
    else if (chart.frets.some(f => !Number.isInteger(f) || f < -1 || f > 24)) found.push({ id, name, issue: "Invalid fret value" });
    if (!chart || !Array.isArray(chart.fingers) || chart.fingers.length !== 6 || chart.fingers.some(f => f !== null && f !== 1 && f !== 2 && f !== 3 && f !== 4)) found.push({ id, name, issue: "Missing or invalid fingering data" });
    if (!entry.root || !entry.quality || !entry.qualityLabel || !entry.inversion) found.push({ id, name, issue: "Missing theory labels" });
    if (!entry.recommendedVariant || !entry.alternateFingerings?.length) found.push({ id, name, issue: "Unverified fingering metadata" });
    return found;
  });
  return { scanned: rows.length, issues, categories: [...new Set(issues.map(issue => issue.issue))] };
}
