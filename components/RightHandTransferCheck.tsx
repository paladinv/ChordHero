"use client";
import { useEffect, useState } from "react";
import type { RightHandExercise } from "../lib/rightHandExercises";
import { RIGHT_HAND_PROGRESSIONS } from "../lib/rightHandPracticePresets";
import { readRightHandTakes } from "../lib/rightHandTakeLibrary";
import { acceptedTransferEvidence, type TransferTarget } from "../lib/rightHandPracticeRefinement";

const KEY = "chord-hero:right-hand:transfer:v1";
export default function RightHandTransferCheck({ exercise, bpm, progressionId, chordProgression, onApply, onRecord }: { exercise: RightHandExercise; bpm: number; progressionId: string; chordProgression: string[]; onApply: (bpm: number, progressionId: string) => void; onRecord: () => void }) {
  const [target, setTarget] = useState<TransferTarget | null>(null);
  const [takes, setTakes] = useState<ReturnType<typeof readRightHandTakes>>({});
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => setTakes(readRightHandTakes()); refresh();
    try { const saved = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (saved?.version === 1 && saved.target?.exerciseId === exercise.id && JSON.stringify(saved.target.pattern) === JSON.stringify(exercise.pattern) && Number.isFinite(Date.parse(saved.target.startedAt)) && saved.target.bpm >= 40 && saved.target.bpm <= 180 && Array.isArray(saved.target.chordProgression) && saved.target.chordProgression.length <= 8) setTarget(saved.target); else setTarget(null); } catch { setTarget(null); }
    window.addEventListener("chord-hero:right-hand-storage", refresh);
    return () => window.removeEventListener("chord-hero:right-hand-storage", refresh);
  }, [exercise.id, exercise.pattern]);
  const prepare = (kind: "progression" | "tempo") => {
    let nextBpm = bpm; let nextId = progressionId; let nextChords = chordProgression;
    if (kind === "progression") {
      const known = new Set(Object.values(takes).flat().map((take) => JSON.stringify(take.analysis.practiceContext?.chordProgression)));
      const candidates = RIGHT_HAND_PROGRESSIONS.filter((item) => item.chords.length && item.id !== progressionId && !known.has(JSON.stringify(item.chords)));
      if (!candidates.length) { setMessage("All available progressions appear in this browser’s take history. Try the changed-tempo check instead."); return; }
      const chosen = candidates[Math.floor(Math.random() * candidates.length)]; nextId = chosen.id; nextChords = [...chosen.chords];
    } else nextBpm = bpm <= 168 ? bpm + 12 : bpm - 12;
    const next = { exerciseId: exercise.id, bpm: nextBpm, pattern: [...exercise.pattern], chordProgression: [...nextChords], startedAt: new Date().toISOString() };
    setTarget(next); try { localStorage.setItem(KEY, JSON.stringify({ version: 1, target: next })); } catch { /* Session remains usable. */ }
    onApply(nextBpm, nextId); setMessage("Transfer target prepared. Nothing starts automatically. Press Play or open recording review when ready.");
  };
  const evidence = target ? (takes[exercise.id] ?? []).find((take) => take.reviewAccepted === true && acceptedTransferEvidence(take.analysis, target, take.createdAt)) : undefined;
  const ready = target && target.bpm === bpm && JSON.stringify(target.chordProgression) === JSON.stringify(chordProgression);
  return <div className="learning-card"><h3>Can the pattern travel?</h3><p>Keep this exact pattern, but change one context: a progression not in this browser’s recorded history, or a 12-BPM tempo change. “Unfamiliar” is local-history based, not a claim about what you know.</p><div className="learning-actions"><button type="button" onClick={() => prepare("progression")}>Prepare unfamiliar progression</button><button type="button" onClick={() => prepare("tempo")}>Prepare changed tempo</button></div>{target ? <><p>Target: {target.bpm} BPM · {target.chordProgression.join(" – ") || "no chord backing"} · same written pattern.</p><strong>{evidence ? `Transfer timing demonstrated · ${evidence.analysis.timingScore}% · accepted take ${evidence.id}` : "Transfer timing not yet demonstrated"}</strong><p>A new accepted, reliable recording at ≥80% canonical timing must cover the complete written pattern in this exact context. Self-ratings, older takes, and trimmed rescoring cannot award this flag. Timing does not establish correct chord voicings or stroke mechanics.</p><button type="button" disabled={!ready} onClick={onRecord}>Record this transfer check</button>{!ready ? <small>Prepare a new check to match the current settings.</small> : null}</> : null}<p role="status">{message}</p></div>;
}
