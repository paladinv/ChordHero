"use client";

import ChordDiagram from "../../components/ChordDiagram";

type Chord = {
  name: string;
  frets: number[];
  barre?: {
    fret: number;
    from: number;
    to: number;
  };
};

type Level = {
  name: string;
  description: string;
  chords: Chord[];
};

const LEVELS: Level[] = [
  {
    name: "Open Chords",
    description: "Comfortable open shapes to build speed.",
    chords: [
      { name: "C", frets: [-1, 3, 2, 0, 1, 0] },
      { name: "G", frets: [3, 2, 0, 0, 0, 3] },
      { name: "D", frets: [-1, -1, 0, 2, 3, 2] },
      { name: "Em", frets: [0, 2, 2, 0, 0, 0] },
      { name: "Am", frets: [-1, 0, 2, 2, 1, 0] },
      { name: "E", frets: [0, 2, 2, 1, 0, 0] },
      { name: "A", frets: [-1, 0, 2, 2, 2, 0] }
    ]
  },
  {
    name: "Open + Spice",
    description: "Add sus and dominant flavors for quicker switches.",
    chords: [
      { name: "Cadd9", frets: [-1, 3, 2, 0, 3, 0] },
      { name: "Dsus4", frets: [-1, -1, 0, 2, 3, 3] },
      { name: "G", frets: [3, 2, 0, 0, 0, 3] },
      { name: "Em7", frets: [0, 2, 0, 0, 0, 0] },
      { name: "Am7", frets: [-1, 0, 2, 0, 1, 0] },
      { name: "E7", frets: [0, 2, 0, 1, 0, 0] },
      { name: "D", frets: [-1, -1, 0, 2, 3, 2] }
    ]
  },
  {
    name: "Barre Chords",
    description: "Full grip shapes for strength and clarity.",
    chords: [
      { name: "F", frets: [1, 3, 3, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
      { name: "Bm", frets: [-1, 2, 4, 4, 3, 2], barre: { fret: 2, from: 1, to: 5 } },
      { name: "Bb", frets: [1, 3, 3, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
      { name: "Gm", frets: [3, 5, 5, 3, 3, 3], barre: { fret: 3, from: 0, to: 5 } },
      { name: "C#m", frets: [-1, 4, 6, 6, 5, 4], barre: { fret: 4, from: 1, to: 5 } },
      { name: "F#", frets: [2, 4, 4, 3, 2, 2], barre: { fret: 2, from: 0, to: 5 } }
    ]
  },
  {
    name: "Inversions",
    description: "Slash chords to sharpen bass movement.",
    chords: [
      { name: "C/G", frets: [3, 3, 2, 0, 1, 0] },
      { name: "G/B", frets: [-1, 2, 0, 0, 0, 3] },
      { name: "D/F#", frets: [2, 0, 0, 2, 3, 2] },
      { name: "Am/C", frets: [-1, 3, 2, 2, 1, 0] },
      { name: "Em/B", frets: [-1, 2, 2, 0, 0, 0] },
      { name: "F/A", frets: [-1, 0, 3, 2, 1, 1] }
    ]
  }
];

export default function ChordChartPage() {
  return (
    <main className="page chords">
      <section className="chords-hero">
        <div>
          <p className="eyebrow">Chord Chart</p>
          <h1>Printable chord shapes by level.</h1>
          <p>
            Print this page to keep the shapes handy on your music stand. Each
            section matches the trainer difficulty levels.
          </p>
        </div>
        <div className="print-card">
          <h2>Print tips</h2>
          <ul>
            <li>Use portrait mode.</li>
            <li>Enable background graphics.</li>
            <li>Scale to fit if needed.</li>
          </ul>
        </div>
      </section>

      {LEVELS.map((level) => (
        <section key={level.name} className="chord-section">
          <div className="chord-section-header">
            <div>
              <h2>{level.name}</h2>
              <p>{level.description}</p>
            </div>
          </div>
          <div className="chord-grid">
            {level.chords.map((chord) => (
              <div key={chord.name} className="chord-tile">
                <span className="label">{chord.name}</span>
                <ChordDiagram chord={chord} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
