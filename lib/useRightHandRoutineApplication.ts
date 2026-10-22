"use client";
import { useCallback } from "react";
import type { RightHandExercise } from "./rightHandExercises";
import type { CustomRightHandRoutine } from "./practicePlatform";

type Props = { baseExercise?: RightHandExercise; resetSession: () => void; setActiveRoutine: (value: { routineId: string; baseExerciseId: string; title: string; pattern: string[] } | null) => void; setBpm: (value: number) => void; setStatusMessage: (value: string) => void };
export function useRightHandRoutineApplication({ baseExercise, resetSession, setActiveRoutine, setBpm, setStatusMessage }: Props) {
  return useCallback((routine: CustomRightHandRoutine) => {
    if (!baseExercise || routine.technique !== baseExercise.technique) { setStatusMessage("Choose a routine for the current technique before applying it."); return; }
    resetSession();
    setActiveRoutine({ routineId: routine.id, baseExerciseId: baseExercise.id, title: routine.title, pattern: [...routine.pattern] });
    setBpm(Math.max(40, Math.min(180, Math.round(routine.bpm))));
    setStatusMessage(`${routine.title} applied. Custom rounds stay separate from authored exercise history.`);
  }, [baseExercise, resetSession, setActiveRoutine, setBpm, setStatusMessage]);
}
