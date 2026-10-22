import { useEffect, useRef, useState } from "react";
import { rightHandExerciseById } from "./rightHandPracticeRuntime";
import { QUICK_PLAYER_START, QUICK_SESSION_CONTROL, QUICK_SESSION_STATE, syncQuickSessionWithPlayer, validQuickStages, type QuickControl, type QuickSession, type QuickStage } from "./rightHandQuickPlan";
import type { RightHandExercise } from "./rightHandExercises";

type Props = { exercise: RightHandExercise; bpm: number; progressionId: string; seconds: number; status: string; select: (exercise: RightHandExercise) => void; tempo: (bpm: number) => void; progression: (id: string) => void; duration: (seconds: number) => void; pause: () => void; start: () => Promise<void> };
export function useRightHandQuickSession(props: Props) {
  const [session, setSession] = useState<QuickSession | null>(null);
  const current = useRef(props); current.current = props;
  const active = useRef(session); active.current = session;
  const attempted = useRef(false);
  const prepare = useRef((stages: QuickStage[], index: number) => {
    const stage = stages[index]; const exercise = rightHandExerciseById(stage.exerciseId);
    if (!exercise) return;
    attempted.current = false;
    const callbacks = current.current;
    callbacks.pause(); callbacks.select(exercise); callbacks.tempo(stage.bpm); callbacks.progression(stage.progressionId); callbacks.duration(60);
    setSession({ stages, index, phase: "preparing", restRemaining: 0 });
  });
  useEffect(() => {
    const control = (event: Event) => {
      const detail = (event as CustomEvent<QuickControl>).detail;
      if (!detail || typeof detail !== "object") return;
      const value = active.current;
      if (detail.action === "status") window.dispatchEvent(new CustomEvent(QUICK_SESSION_STATE, { detail: value }));
      if (detail.action === "start") { const stages = validQuickStages(detail.stages); if (stages) prepare.current(stages, 0); }
      if (detail.action === "cancel") { current.current.pause(); attempted.current = false; setSession(null); }
      if (detail.action === "pause" && value && value.phase !== "complete") { current.current.pause(); setSession({ ...value, phase: "paused", pausedFrom: value.phase === "rest" ? "rest" : "stage" }); }
      if (detail.action === "resume" && value?.phase === "paused") {
        if (value.pausedFrom === "rest") setSession({ ...value, phase: "rest" }); else prepare.current(value.stages, value.index);
      }
    };
    const interrupt = () => { const value = active.current; if (value && value.phase !== "complete") { current.current.pause(); setSession({ ...value, phase: "paused", pausedFrom: value.phase === "rest" ? "rest" : "stage" }); } };
    const hidden = () => { if (document.visibilityState === "hidden") interrupt(); };
    const starting = () => {
      const value = active.current; const player = current.current;
      const next = syncQuickSessionWithPlayer(value, { exerciseId: player.exercise.id, bpm: player.bpm, progressionId: player.progressionId, seconds: player.seconds, status: player.status, startRequested: true });
      if (next !== value) { active.current = next; setSession(next); }
    };
    window.addEventListener(QUICK_SESSION_CONTROL, control);
    window.addEventListener(QUICK_PLAYER_START, starting);
    window.addEventListener("chord-hero:right-hand-capture", interrupt);
    window.addEventListener("chord-hero:right-hand-live-mic", interrupt);
    document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener(QUICK_SESSION_CONTROL, control); window.removeEventListener(QUICK_PLAYER_START, starting); window.removeEventListener("chord-hero:right-hand-capture", interrupt); window.removeEventListener("chord-hero:right-hand-live-mic", interrupt); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  useEffect(() => { window.dispatchEvent(new CustomEvent(QUICK_SESSION_STATE, { detail: session })); }, [session]);
  useEffect(() => {
    if (!session) return;
    const stage = session.stages[session.index];
    const next = syncQuickSessionWithPlayer(session, { exerciseId: props.exercise.id, bpm: props.bpm, progressionId: props.progressionId, seconds: props.seconds, status: props.status });
    if (next !== session) { active.current = next; setSession(next); return; }
    if (session.phase === "preparing" && props.exercise.id === stage.exerciseId && props.bpm === stage.bpm && props.progressionId === stage.progressionId && props.seconds === 60 && !attempted.current) {
      attempted.current = true;
      void current.current.start().catch(() => { if (active.current === session) setSession({ ...session, phase: "paused", pausedFrom: "stage" }); });
    }
  }, [props.bpm, props.exercise.id, props.progressionId, props.seconds, props.status, session]);
  useEffect(() => {
    if (session?.phase !== "rest") return;
    const timer = window.setTimeout(() => {
      if (active.current !== session) return;
      if (session.restRemaining > 1) setSession({ ...session, restRemaining: session.restRemaining - 1 });
      else prepare.current(session.stages, session.index + 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [session]);
}
