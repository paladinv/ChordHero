import type { Chord } from "../components/ChordDiagram";
import { CHORD_LIBRARY } from "./chords";

const LIBRARY_BY_ID = new Map(CHORD_LIBRARY.map(entry => [entry.id, entry]));
const LIBRARY_ID_SET = new Set(LIBRARY_BY_ID.keys());
const LIBRARY_QUALITY_SET = new Set(CHORD_LIBRARY.map(entry => entry.quality));

export type ChordOverride = { chord: Chord; displayLabel: string; root: string; quality: string; inversion: "standard" | "inverted"; updatedAt: string };
const VALID_NOTES = new Set(["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]);

export function validateChordOverrides(value: unknown): Record<string, ChordOverride> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, ChordOverride> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
    if (!LIBRARY_ID_SET.has(id)) continue;
    const base = LIBRARY_BY_ID.get(id);
    if (!base || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>, chord = item.chord as Record<string, unknown> | undefined;
    if (!chord || !Array.isArray(chord.frets) || chord.frets.length !== 6 || !Array.isArray(chord.fingers) || chord.fingers.length !== 6) continue;
    if (!chord.frets.every(f => Number.isInteger(f) && (f as number) >= -1 && (f as number) <= 24)) continue;
    if (!chord.fingers.every(f => f === null || f === 1 || f === 2 || f === 3 || f === 4)) continue;
    if (typeof item.root !== "string" || !VALID_NOTES.has(item.root) || typeof item.quality !== "string" || !LIBRARY_QUALITY_SET.has(item.quality)) continue;
    if (item.inversion !== "standard" && item.inversion !== "inverted") continue;
    const candidateLabel = typeof item.displayLabel === "string" ? item.displayLabel : typeof chord.name === "string" ? chord.name : base.chord.name;
    if (!/^[A-Za-z0-9#b/()+\-°♭♯\s]{1,48}$/.test(candidateLabel.trim())) continue;
    const displayLabel = candidateLabel.trim();
    result[id] = { chord: { name: displayLabel, frets: chord.frets as number[], fingers: chord.fingers as Chord["fingers"] }, displayLabel, root: item.root, quality: item.quality, inversion: item.inversion, updatedAt: typeof item.updatedAt === "string" ? item.updatedAt.slice(0, 32) : "" };
  }
  return result;
}
