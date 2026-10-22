import type { SongComposition, SongCompositionEvent } from "./songLibrary";
import { addCompositionMeasure, measureQuarterBeats } from "./songBuilder";
import { CHORD_LOOKUP } from "./chords";

export type ProgressionPattern = "pop" | "sensitive" | "classic" | "jazz" | "minor" | "blues";

export const PROGRESSION_PATTERNS: Array<{ id: ProgressionPattern; name: string; degrees: string[]; feel: string }> = [
  { id: "pop", name: "Pop · I–V–vi–IV", degrees: ["I", "V", "vi", "IV"], feel: "Familiar, uplifting loop" },
  { id: "sensitive", name: "Sensitive · vi–IV–I–V", degrees: ["vi", "IV", "I", "V"], feel: "Reflective start with a strong return" },
  { id: "classic", name: "Classic · I–vi–IV–V", degrees: ["I", "vi", "IV", "V"], feel: "Classic 1950s progression" },
  { id: "jazz", name: "Jazz cadence · ii–V–I–I", degrees: ["ii", "V", "I", "I"], feel: "A simple major-key resolution" },
  { id: "minor", name: "Minor · i–VI–III–VII", degrees: ["i", "VI", "III", "VII"], feel: "Minor progression with a broad lift" },
  { id: "blues", name: "12-bar blues", degrees: ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"], feel: "Twelve-bar blues in the selected key" },
];

const KEY_PC: Record<string, number> = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MAJOR = ["", "m", "m", "", "", "m", "dim"];
const MINOR = ["m", "dim", "", "m", "m", "", ""];
const DEGREE_INDEX: Record<string, number> = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

export function chordsForProgression(key: string, pattern: ProgressionPattern): string[] {
  const root = key.trim().replace(/m$/i, "");
  const minor = /m$/i.test(key) || pattern === "minor";
  const pc = KEY_PC[root];
  if (pc === undefined) throw new Error(`The key “${key}” is not supported by the progression helper yet.`);
  const intervals = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const quality = minor ? MINOR : MAJOR;
  const selected = PROGRESSION_PATTERNS.find((item) => item.id === pattern)!;
  const names = minor || /b/.test(root) ? FLAT_NAMES : SHARP_NAMES;
  return selected.degrees.map((degree) => {
    const upper = degree.toUpperCase();
    const index = DEGREE_INDEX[upper];
    const chordRoot = names[(pc + intervals[index]) % 12];
    const suffix = quality[index];
    const diminished = suffix === "dim" ? "dim" : suffix;
    return `${chordRoot}${diminished}`;
  });
}

export function applyChordProgression(
  composition: SongComposition,
  sectionId: string,
  trackId: string,
  pattern: ProgressionPattern,
): SongComposition {
  const chords = chordsForProgression(composition.key, pattern);
  let next = composition;
  let section = next.sections.find((item) => item.id === sectionId);
  const track = next.tracks.find((item) => item.id === trackId);
  if (!section || !track) throw new Error("Select a section and instrument track first.");

  while ((section.measuresByTrack[trackId]?.length ?? 0) < chords.length) {
    next = addCompositionMeasure(next, sectionId);
    section = next.sections.find((item) => item.id === sectionId)!;
  }

  const measures = section.measuresByTrack[trackId] ?? [];
  const now = measures.map((measure, index) => ({
    ...measure,
    events: index < chords.length
      ? [
          ...measure.events.filter((event) => event.kind !== "chord"),
          {
            id: `progression-${crypto.randomUUID()}`,
            kind: "chord" as const,
            chord: chords[index],
            ...(track.instrument === "guitar" && track.tuning.join(",") === "40,45,50,55,59,64"
              ? { voicing: CHORD_LOOKUP.get(chords[index])?.frets.map((fret) => fret < 0 ? null : fret) }
              : {}),
            startBeat: 0,
            durationBeats: measure.beats ?? measureQuarterBeats(section!.timeSignature ?? next.timeSignature),
          } satisfies SongCompositionEvent,
        ]
      : measure.events,
  }));

  return {
    ...next,
    sections: next.sections.map((item) => item.id === sectionId
      ? { ...item, measuresByTrack: { ...item.measuresByTrack, [trackId]: now } }
      : item),
  };
}

