import { Chord } from "../components/ChordDiagram";

export type Level = {
  name: string;
  description: string;
  chords: Chord[];
};

export type ChordLibraryItem = {
  id: string;
  root: string;
  quality: string;
  qualityLabel: string;
  inversion: "standard" | "inverted";
  position: string;
  chord: Chord;
};

const CHORD_LIBRARY_ITEMS: ChordLibraryItem[] = [
  {
    id: "c-major-open",
    root: "C",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "C", frets: [-1, 3, 2, 0, 1, 0] }
  },
  {
    id: "c-major-barre",
    root: "C",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "A-shape barre",
    chord: { name: "C", frets: [-1, 3, 5, 5, 5, 3], barre: { fret: 3, from: 1, to: 5 } }
  },
  {
    id: "c-add9-open",
    root: "C",
    quality: "add9",
    qualityLabel: "Add 9",
    inversion: "standard",
    position: "Open color tone",
    chord: { name: "Cadd9", frets: [-1, 3, 2, 0, 3, 0] }
  },
  {
    id: "c-major7-open",
    root: "C",
    quality: "major7",
    qualityLabel: "Major 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Cmaj7", frets: [-1, 3, 2, 0, 0, 0] }
  },
  {
    id: "c-minor-barre",
    root: "C",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "A-shape barre",
    chord: { name: "Cm", frets: [-1, 3, 5, 5, 4, 3], barre: { fret: 3, from: 1, to: 5 } }
  },
  {
    id: "c-dominant7-open",
    root: "C",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "C7", frets: [-1, 3, 2, 3, 1, 0] }
  },
  {
    id: "c-over-g",
    root: "C",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "2nd inversion",
    chord: { name: "C/G", frets: [3, 3, 2, 0, 1, 0] }
  },
  {
    id: "d-major-open",
    root: "D",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "D", frets: [-1, -1, 0, 2, 3, 2] }
  },
  {
    id: "d-sus4-open",
    root: "D",
    quality: "sus4",
    qualityLabel: "Suspended 4",
    inversion: "standard",
    position: "Open suspension",
    chord: { name: "Dsus4", frets: [-1, -1, 0, 2, 3, 3] }
  },
  {
    id: "d-minor-open",
    root: "D",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Dm", frets: [-1, -1, 0, 2, 3, 1] }
  },
  {
    id: "d-dominant7-open",
    root: "D",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "D7", frets: [-1, -1, 0, 2, 1, 2] }
  },
  {
    id: "d-minor7-open",
    root: "D",
    quality: "minor7",
    qualityLabel: "Minor 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Dm7", frets: [-1, -1, 0, 2, 1, 1] }
  },
  {
    id: "d-over-fsharp",
    root: "D",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "1st inversion",
    chord: { name: "D/F#", frets: [2, 0, 0, 2, 3, 2] }
  },
  {
    id: "e-major-open",
    root: "E",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "E", frets: [0, 2, 2, 1, 0, 0] }
  },
  {
    id: "e-minor-open",
    root: "E",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Em", frets: [0, 2, 2, 0, 0, 0] }
  },
  {
    id: "e-dominant7-open",
    root: "E",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "E7", frets: [0, 2, 0, 1, 0, 0] }
  },
  {
    id: "e-minor7-open",
    root: "E",
    quality: "minor7",
    qualityLabel: "Minor 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Em7", frets: [0, 2, 0, 0, 0, 0] }
  },
  {
    id: "f-major-barre",
    root: "F",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "E-shape barre",
    chord: { name: "F", frets: [1, 3, 3, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } }
  },
  {
    id: "f-major7-open",
    root: "F",
    quality: "major7",
    qualityLabel: "Major 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Fmaj7", frets: [-1, -1, 3, 2, 1, 0] }
  },
  {
    id: "f-over-a",
    root: "F",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "1st inversion",
    chord: { name: "F/A", frets: [-1, 0, 3, 2, 1, 1] }
  },
  {
    id: "g-major-open",
    root: "G",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "G", frets: [3, 2, 0, 0, 0, 3] }
  },
  {
    id: "g-major-barre",
    root: "G",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "E-shape barre",
    chord: { name: "G", frets: [3, 5, 5, 4, 3, 3], barre: { fret: 3, from: 0, to: 5 } }
  },
  {
    id: "g-sus4-open",
    root: "G",
    quality: "sus4",
    qualityLabel: "Suspended 4",
    inversion: "standard",
    position: "Open suspension",
    chord: { name: "Gsus4", frets: [3, 2, 0, 0, 1, 3] }
  },
  {
    id: "g-minor-barre",
    root: "G",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "E-shape barre",
    chord: { name: "Gm", frets: [3, 5, 5, 3, 3, 3], barre: { fret: 3, from: 0, to: 5 } }
  },
  {
    id: "g-dominant7-open",
    root: "G",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "G7", frets: [3, 2, 0, 0, 0, 1] }
  },
  {
    id: "g-over-b",
    root: "G",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "1st inversion",
    chord: { name: "G/B", frets: [-1, 2, 0, 0, 0, 3] }
  },
  {
    id: "a-major-open",
    root: "A",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "A", frets: [-1, 0, 2, 2, 2, 0] }
  },
  {
    id: "a-minor-open",
    root: "A",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Am", frets: [-1, 0, 2, 2, 1, 0] }
  },
  {
    id: "a-sus2-open",
    root: "A",
    quality: "sus2",
    qualityLabel: "Suspended 2",
    inversion: "standard",
    position: "Open suspension",
    chord: { name: "Asus2", frets: [-1, 0, 2, 2, 0, 0] }
  },
  {
    id: "a-minor7-open",
    root: "A",
    quality: "minor7",
    qualityLabel: "Minor 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "Am7", frets: [-1, 0, 2, 0, 1, 0] }
  },
  {
    id: "a-dominant7-open",
    root: "A",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: { name: "A7", frets: [-1, 0, 2, 0, 2, 0] }
  },
  {
    id: "am-over-c",
    root: "A",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "inverted",
    position: "1st inversion",
    chord: { name: "Am/C", frets: [-1, 3, 2, 2, 1, 0] }
  },
  {
    id: "bb-major-barre",
    root: "Bb",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "A-shape barre",
    chord: { name: "Bb", frets: [-1, 1, 3, 3, 3, 1], barre: { fret: 1, from: 1, to: 5 } }
  },
  {
    id: "b-minor-barre",
    root: "B",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "A-shape barre",
    chord: { name: "Bm", frets: [-1, 2, 4, 4, 3, 2], barre: { fret: 2, from: 1, to: 5 } }
  },
  {
    id: "csharp-minor-barre",
    root: "C#",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "A-shape barre",
    chord: { name: "C#m", frets: [-1, 4, 6, 6, 5, 4], barre: { fret: 4, from: 1, to: 5 } }
  },
  {
    id: "fsharp-major-barre",
    root: "F#",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "E-shape barre",
    chord: { name: "F#", frets: [2, 4, 4, 3, 2, 2], barre: { fret: 2, from: 0, to: 5 } }
  },
  {
    id: "em-over-b",
    root: "E",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "inverted",
    position: "2nd inversion",
    chord: { name: "Em/B", frets: [-1, 2, 2, 0, 0, 0] }
  }
];

const dedupeByName = (items: ChordLibraryItem[]) =>
  Array.from(new Map(items.map((item) => [item.chord.name, item.chord])).values());

const findChordByName = (name: string) => {
  const match = CHORD_LIBRARY_ITEMS.find((item) => item.chord.name === name);
  if (!match) {
    throw new Error(`Chord '${name}' was not found in the shared chord library.`);
  }
  return match.chord;
};

export const CHORD_LIBRARY = CHORD_LIBRARY_ITEMS;

export const CHORD_LIBRARY_ROOTS = Array.from(
  new Set(CHORD_LIBRARY_ITEMS.map((item) => item.root))
).sort((left, right) => left.localeCompare(right));

export const CHORD_QUALITY_OPTIONS = Array.from(
  new Map(CHORD_LIBRARY_ITEMS.map((item) => [item.quality, item.qualityLabel])).entries()
).map(([value, label]) => ({ value, label }));

export const CHORD_LOOKUP = new Map(
  dedupeByName(CHORD_LIBRARY_ITEMS).map((chord) => [chord.name, chord])
);

export const LEVELS: Level[] = [
  {
    name: "Open Chords",
    description: "Comfortable open shapes to build speed.",
    chords: ["C", "G", "D", "Em", "Am", "E", "A"].map(findChordByName)
  },
  {
    name: "Open + Spice",
    description: "Add sus and dominant flavors for quicker switches.",
    chords: ["Cadd9", "Dsus4", "G", "Em7", "Am7", "E7", "D"].map(findChordByName)
  },
  {
    name: "Barre Chords",
    description: "Full grip shapes for strength and clarity.",
    chords: ["F", "Bm", "Bb", "Gm", "C#m", "F#"].map(findChordByName)
  },
  {
    name: "Inversions",
    description: "Slash chords to sharpen bass movement.",
    chords: ["C/G", "G/B", "D/F#", "Am/C", "Em/B", "F/A"].map(findChordByName)
  }
];
