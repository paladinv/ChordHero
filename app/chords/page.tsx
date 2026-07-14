"use client";

import ChordDiagram from "../../components/ChordDiagram";
import { CHORD_LIBRARY, CHORD_LIBRARY_ROOTS, LEVELS } from "../../lib/chords";

export default function ChordChartPage() {
  return (
    <main className="page chords focused-page">
      <section className="studio-heading chords-hero">
        <div>
          <span className="tag">Chord Chart</span>
          <h1>Printable chord shapes by level and key.</h1>
          <p>
            Print this page to keep the shapes handy on your music stand. The first set matches the
            trainer levels, and the full library is grouped by root so it is easier to scan.
          </p>
        </div>
        <div className="studio-session-note print-card">
          <span className="label">Print setup</span>
          <strong>Portrait · background on</strong>
          <span>Use “scale to fit” if your browser clips a row.</span>
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
              <div key={`${level.name}-${chord.name}`} className="chord-tile">
                <span className="label">{chord.name}</span>
                <ChordDiagram chord={chord} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {CHORD_LIBRARY_ROOTS.map((root) => {
        const rootChords = CHORD_LIBRARY.filter((entry) => entry.root === root);
        return (
          <section key={root} className="chord-section">
            <div className="chord-section-header">
              <div>
                <h2>{root} library</h2>
                <p>
                  {rootChords.length} voicing{rootChords.length === 1 ? "" : "s"} across standard
                  and inverted shapes.
                </p>
              </div>
            </div>
            <div className="chord-grid">
              {rootChords.map((entry) => (
                <div key={entry.id} className="chord-tile">
                  <span className="label">
                    {entry.chord.name} • {entry.position}
                  </span>
                  <ChordDiagram chord={entry.chord} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
