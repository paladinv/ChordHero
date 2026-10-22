import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { RecordingAnalysis } from "./songRecordingAnalysis";
import type { ExerciseProgress } from "./rightHandPracticeRuntime";

type Latest = { exerciseId: string; analysis: RecordingAnalysis } | null;
export function useRightHandLearningPreferences(bpm: number, setBpm: (bpm: number) => void, setLatest: Dispatch<SetStateAction<Latest>>, setProgress: Dispatch<SetStateAction<Record<string, ExerciseProgress>>>) {
  const [layout, updateLayout] = useState<"beginner" | "advanced">("beginner");
  const [pending, setPending] = useState<number | null>(null);
  const startRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => {
    try { if (localStorage.getItem("chord-hero:right-hand:layout:v1") === "advanced") updateLayout("advanced"); } catch { /* Preferences are optional. */ }
    const review = async (event: Event) => {
      const detail = (event as CustomEvent<{ exerciseId?: string; recordingId?: string; reviewAccepted?: boolean }>).detail;
      if (!detail?.exerciseId || !detail.recordingId || typeof detail.reviewAccepted !== "boolean") return;
      const { readPracticePlatformState, writePracticePlatformState } = await import("./practicePlatform");
      const state = readPracticePlatformState();
      const matching = state.events.some((item) => item.area === "rightHand" && item.itemId === detail.exerciseId && item.recordingId === detail.recordingId);
      if (!matching) return;
      const events = state.events.map((item) => item.area === "rightHand" && item.itemId === detail.exerciseId && item.recordingId === detail.recordingId ? { ...item, reviewAccepted: detail.reviewAccepted } : item);
      writePracticePlatformState({ ...state, events });
      setLatest((current) => current && current.exerciseId === detail.exerciseId && current.analysis.recordingId === detail.recordingId ? { ...current, analysis: { ...current.analysis, reviewAccepted: detail.reviewAccepted } } : current);
      setProgress((previous) => {
        const current = previous[detail.exerciseId!]; if (!current) return previous;
        const accepted = events.filter((item) => item.area === "rightHand" && item.itemId === detail.exerciseId && item.recordingId && item.reviewAccepted !== false && typeof item.score === "number");
        const bestTimingScore = accepted.length ? Math.max(...accepted.map((item) => item.score!)) : undefined;
        return { ...previous, [detail.exerciseId!]: { ...current, bestTimingScore, recentMisses: detail.reviewAccepted ? current.recentMisses : [] } };
      });
    };
    window.addEventListener("chord-hero:right-hand-review", review);
    return () => window.removeEventListener("chord-hero:right-hand-review", review);
  }, [setLatest, setProgress]);
  useEffect(() => { if (pending !== null && bpm === pending) { setPending(null); void startRef.current(); } }, [bpm, pending]);
  return {
    layout,
    setLayout: (value: "beginner" | "advanced") => { updateLayout(value); try { localStorage.setItem("chord-hero:right-hand:layout:v1", value); } catch { /* Session layout still works. */ } },
    requestStart: (tempo: number) => { setBpm(tempo); setPending(tempo); },
    bindStart: (start: () => Promise<void>) => { startRef.current = start; }
  };
}
