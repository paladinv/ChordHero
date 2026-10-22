"use client";

import { useEffect, useMemo, useState } from "react";
import type { RightHandExercise, RightHandTechnique } from "../lib/rightHandExercises";
import { validRightHandPattern, validRightHandPatternToken } from "../lib/rightHandPracticeRuntime";
import { readPracticePlatformState, updatePracticePlatformState, type CustomRightHandRoutine } from "../lib/practicePlatform";

type Props = {
  exercise: RightHandExercise;
  bpm: number;
  activeRoutineId?: string;
  onApplyRoutine?: (routine: CustomRightHandRoutine) => void;
};

const TOKENS: Record<RightHandTechnique, string[]> = {
  strumming: ["D", "U", "X", "·", "D!", "U!"],
  plectrum: ["1D", "1U", "2D", "2U", "3D", "3U", "4D", "4U", "5D", "5U", "6D", "6U", "·", "D!"],
  fingerpicking: ["P6", "P5", "P4", "i3", "m2", "a1", "P6+ima", "im2+3", "·", "P6!"]
};

function usableRoutines(value: unknown, technique: RightHandTechnique) {
  if (!Array.isArray(value)) return [];
  return value.filter((routine): routine is CustomRightHandRoutine => {
    if (!routine || typeof routine !== "object") return false;
    const item = routine as Partial<CustomRightHandRoutine>;
    return typeof item.id === "string" && typeof item.title === "string" && item.title.trim().length > 0
      && item.technique === technique && typeof item.bpm === "number" && Number.isFinite(item.bpm)
      && typeof item.createdAt === "string" && Array.isArray(item.pattern)
      && validRightHandPattern(item.pattern, technique);
  });
}

export default function RightHandRoutineBuilder({ exercise, bpm, onApplyRoutine }: Props) {
  const [title, setTitle] = useState("");
  const [tokens, setTokens] = useState<string[]>(() => exercise.pattern.slice(0, 32));
  const [routines, setRoutines] = useState<CustomRightHandRoutine[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState("");
  const [message, setMessage] = useState("");
  const palette = useMemo(() => TOKENS[exercise.technique], [exercise.technique]);

  const refresh = () => {
    const next = usableRoutines(readPracticePlatformState().customRoutines, exercise.technique);
    setRoutines(next);
    if (selectedRoutineId && !next.some((routine) => routine.id === selectedRoutineId)) setSelectedRoutineId("");
  };

  useEffect(() => {
    setTokens(exercise.pattern.slice(0, 32));
    setTitle("");
    setSelectedRoutineId("");
    setMessage("");
    refresh();
    // The authored exercise remains the identity anchor for custom patterns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, exercise.technique]);

  const addToken = (token: string) => {
    if (tokens.length >= 32 || !validRightHandPatternToken(token, exercise.technique)) return;
    setTokens((current) => [...current, token]);
  };
  const removeToken = (index: number) => setTokens((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const load = (id: string) => {
    setSelectedRoutineId(id);
    const routine = routines.find((item) => item.id === id);
    if (!routine) return;
    setTitle(routine.title);
    setTokens([...routine.pattern]);
    setMessage(`Loaded ${routine.title}.`);
  };

  const save = () => {
    const cleanTitle = title.trim().slice(0, 80);
    if (!cleanTitle || !validRightHandPattern(tokens, exercise.technique)) {
      setMessage("Add a name and at least two valid tokens for this technique.");
      return;
    }
    const now = new Date().toISOString();
    const id = selectedRoutineId || globalThis.crypto?.randomUUID?.() || `routine-${Date.now()}`;
    const next = updatePracticePlatformState((state) => {
      const routine: CustomRightHandRoutine = { id, title: cleanTitle, pattern: [...tokens], technique: exercise.technique, bpm: Math.max(40, Math.min(180, Math.round(bpm))), createdAt: selectedRoutineId ? (state.customRoutines.find((item) => item.id === id)?.createdAt ?? now) : now };
      const existing = state.customRoutines.some((item) => item.id === id);
      return { ...state, customRoutines: existing ? state.customRoutines.map((item) => item.id === id ? routine : item) : [...state.customRoutines, routine].slice(-80) };
    });
    setRoutines(usableRoutines(next.customRoutines, exercise.technique));
    setSelectedRoutineId(id);
    setTitle(cleanTitle);
    setMessage(selectedRoutineId ? "Routine updated locally." : "Routine saved locally.");
  };

  const remove = () => {
    if (!selectedRoutineId) return;
    const deleted = routines.find((routine) => routine.id === selectedRoutineId);
    const next = updatePracticePlatformState((state) => ({ ...state, customRoutines: state.customRoutines.filter((routine) => routine.id !== selectedRoutineId) }));
    setRoutines(usableRoutines(next.customRoutines, exercise.technique));
    setSelectedRoutineId("");
    setTitle("");
    setMessage(deleted ? `${deleted.title} deleted.` : "Routine deleted.");
  };

  const selectedRoutine = routines.find((routine) => routine.id === selectedRoutineId);
  return (
    <details className="custom-routine-builder">
      <summary>Build a custom routine · {routines.length} saved</summary>
      <div className="routine-editor">
        <label>Routine name<input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="My crossing warmup" /></label>
        {routines.length ? <label>Load saved routine<select value={selectedRoutineId} onChange={(event) => load(event.target.value)}><option value="">New routine</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.title}</option>)}</select></label> : null}
        <div className="routine-token-palette" aria-label={`${exercise.technique} token palette`}><span className="label">Add a token</span>{palette.map((token) => <button key={token} type="button" onClick={() => addToken(token)} disabled={tokens.length >= 32}>{token}</button>)}</div>
        <div className="routine-token-preview" aria-label="Routine pattern preview"><span className="label">Preview · {tokens.length}/32 steps</span><div>{tokens.map((token, index) => <button type="button" key={`${token}-${index}`} onClick={() => removeToken(index)} title="Remove token" aria-label={`Remove ${token} at step ${index + 1}`}>{token}</button>)}</div></div>
        <div className="routine-actions"><button type="button" onClick={save}>{selectedRoutine ? "Update routine" : "Save routine"}</button>{selectedRoutine ? <><button type="button" onClick={() => onApplyRoutine?.(selectedRoutine)} disabled={!onApplyRoutine}>Apply to player</button><button type="button" onClick={remove}>Delete</button></> : null}</div>
      </div>
      <p role="status">{message || "Tokens are technique-aware; click a preview token to remove it."}</p>
    </details>
  );
}
