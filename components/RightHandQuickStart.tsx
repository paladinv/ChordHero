"use client";
import { useEffect, useId, useState } from "react";
import { RIGHT_HAND_EXERCISES, type RightHandExercise } from "../lib/rightHandExercises";
import { readPracticePlatformState } from "../lib/practicePlatform";
import { QUICK_SESSION_CONTROL, QUICK_SESSION_STATE, quickPracticePlan, quickPracticePlanEvidence, type QuickControl, type QuickSession } from "../lib/rightHandQuickPlan";

export default function RightHandQuickStart({ exercise, bpm, progressionId = "off", disabled = false }: { exercise: RightHandExercise; bpm: number; progressionId?: string; disabled?: boolean }) {
  const [session, setSession] = useState<QuickSession | null>(null);
  const headingId = useId();
  const send = (detail: QuickControl) => window.dispatchEvent(new CustomEvent(QUICK_SESSION_CONTROL, { detail }));
  useEffect(() => {
    const update = (event: Event) => setSession((event as CustomEvent<QuickSession | null>).detail);
    window.addEventListener(QUICK_SESSION_STATE, update); send({ action: "status" });
    return () => window.removeEventListener(QUICK_SESSION_STATE, update);
  }, []);
  const plan = session?.stages ?? quickPracticePlan(exercise, bpm, progressionId, readPracticePlatformState().events);
  const evidence = quickPracticePlanEvidence(exercise, readPracticePlatformState().events);
  const labels = { warmup: "Warmup", focus: "Focused drill", music: "Musical application" };
  return <section className="right-hand-quick-start" aria-labelledby={headingId}>
    <div><span className="label">A focused daily session</span><h3 id={headingId}>Warm up · practise · make music</h3><p>Three 60-second rounds, plus count-ins and two 5-second rests. {evidence.reason}</p><small>{evidence.comparableTakeCount ? `${evidence.comparableTakeCount} retained full takes · ${evidence.evidenceCount} timing events` : "Evidence count: 0 retained full takes · using the current technique as a transparent fallback."}</small></div>
    <ol>{plan.map((stage, index) => <li key={stage.kind} className={session?.index === index ? "active" : ""}><span>{index + 1}. {labels[stage.kind]}</span><strong>{RIGHT_HAND_EXERCISES.find((item) => item.id === stage.exerciseId)?.title}</strong><small>{stage.bpm} BPM · {stage.kind === "music" ? stage.progressionId === "custom" ? "your custom chords" : stage.progressionId : "no backing chords"}</small></li>)}</ol>
    <div className="learning-actions">{!session || session.phase === "complete" ? <button type="button" disabled={disabled} onClick={() => send({ action: "start", stages: quickPracticePlan(exercise, bpm, progressionId, readPracticePlatformState().events) })}>Start three-part session</button> : <><button type="button" disabled={disabled && session.phase === "paused"} onClick={() => send({ action: session.phase === "paused" ? "resume" : "pause" })}>{session.phase === "paused" ? session.pausedFrom === "rest" ? "Resume rest" : "Restart this stage" : "Pause session"}</button><button type="button" onClick={() => send({ action: "cancel" })}>Cancel session</button></>}</div>
    <p role="status">{session ? session.phase === "complete" ? "Session complete. Round completion is practice time, not a measured accuracy result; record a take to check timing." : `Stage ${session.index + 1}/3 · ${labels[plan[session.index].kind]} · ${session.phase === "rest" ? `rest ${session.restRemaining}s` : session.phase === "paused" ? "paused; restarting a stage begins its full minute again" : session.phase}` : disabled ? "Close the recording coach before starting practice audio." : "Your normal player, 3D view and transport follow each stage. Changing the selected drill cancels the sequence."}</p>
  </section>;
}
