"use client";

import { useState } from "react";
import type { ChordLabTuning } from "../lib/chordLab";
import { generatePlayableVoicings, parseChordIdentity, validateLocalChordShapes, LOCAL_CHORDS_KEY } from "../lib/chordLibraryWorkflow";
import ChordDiagram from "./ChordDiagram";

export default function ChordSearchFallback({ query, tuning, capo }: { query: string; tuning: ChordLabTuning; capo: number }) {
  const [shapes, setShapes] = useState<ReturnType<typeof generatePlayableVoicings>>([]);
  const [message, setMessage] = useState("");
  const generate = () => {
    const identity = parseChordIdentity(query);
    if (!identity) { setShapes([]); setMessage("That chord symbol is not recognized. Supported families include triads, augmented/diminished, sixths, sevenths, ninths, elevens, thirteenths, suspended chords, add9, and slash basses."); return; }
    const candidates = generatePlayableVoicings(identity, tuning, capo);
    setShapes(candidates);
    setMessage(candidates.length ? `${candidates.length} playable candidates found. Algorithmic suggestions; review before use.` : "No shape found in the bounded fret-0-to-7 search. Try another tuning or omit the slash bass.");
  };
  return <div className="history-empty library-no-results">
    <p role="status">No curated chord shape matches <strong>{query.trim()}</strong>. Generate bounded local candidates; this does not alter the canonical library.</p>
    <button className="btn" type="button" onClick={generate}>Generate local voicings</button>
    {message && <p role="status" aria-live="polite">{message}</p>}
    {shapes.map(shape => <div className="library-transition-row" key={shape.id}>
      <strong>{shape.chord.name} · Generated candidate</strong><ChordDiagram chord={shape.chord}/>
      <small>{shape.chord.frets.map(f => f < 0 ? "X" : f === 0 ? "O" : f).join(" ")} · Confidence: unreviewed algorithmic candidate; verify the chart before use.</small>
      <button className="btn" type="button" onClick={() => {
        try {
          const existing = validateLocalChordShapes(JSON.parse(localStorage.getItem(LOCAL_CHORDS_KEY) ?? "[]"));
          localStorage.setItem(LOCAL_CHORDS_KEY, JSON.stringify(validateLocalChordShapes([...existing, shape])));
          setMessage("Saved as an unreviewed local candidate. Verify the chart and tones before approval.");
        } catch { setMessage("Could not save locally; browser storage may be unavailable or full."); }
      }}>Save local shape</button>
      <button className="btn" type="button" onClick={() => {
        try {
          const existing = validateLocalChordShapes(JSON.parse(localStorage.getItem(LOCAL_CHORDS_KEY) ?? "[]"));
          const verified = { ...shape, reviewStatus: "user-verified" as const, reviewedAt: new Date().toISOString() };
          localStorage.setItem(LOCAL_CHORDS_KEY, JSON.stringify(validateLocalChordShapes([...existing.filter(item => item.id !== shape.id), verified])));
          setMessage("Approved as a user-verified local shape. Canonical shared data was not changed.");
        } catch { setMessage("Could not approve locally; browser storage may be unavailable or full."); }
      }}>Approve as user-verified local shape</button>
    </div>)}
  </div>;
}
