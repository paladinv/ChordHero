"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { RIGHT_HAND_EXERCISES } from "../lib/rightHandExercises";
import { readRightHandSession, saveRightHandLessonStep } from "../lib/rightHandSessionContinuity";
import {
  rightHandTokenToMotionPlan,
  techniqueContactPhase,
  techniqueMotionContacts,
  techniqueToMotionPlan,
  type GuitarHandedness,
  type RightHandTechnique,
  type TechniqueMotion
} from "../lib/guitarTechnique3d";

const GuitarTechnique3D = dynamic(() => import("./GuitarTechnique3D"), {
  ssr: false,
  loading: () => <div className="guitar-technique-3d-loading" role="status">Loading 3D guitar…</div>
});

type RightHandTechnique3DProps = {
  technique: RightHandTechnique;
  step: number;
  strings: readonly number[];
  run: boolean;
  id: string;
  loop: number;
  chordName?: string;
  pattern?: readonly string[];
  stepDurationMs?: number;
};

function planForStep(technique: RightHandTechnique, pattern: readonly string[] | undefined, step: number, fallbackStrings: readonly number[]): TechniqueMotion {
  const token = pattern?.[step];
  return token === undefined
    ? techniqueToMotionPlan(technique, step, fallbackStrings.map((string) => string - 1))
    : rightHandTokenToMotionPlan(token, technique);
}

function describePlan(plan: TechniqueMotion) {
  if (plan.rest) return "Rest: the hand keeps its ready position and makes no contact.";
  if (plan.mute) return "Mute: the palm settles by the bridge while the fingers brush the strings.";
  if (plan.fingerAssignments?.length) return plan.fingerAssignments.map((assignment) => `${assignment.finger} → string ${assignment.string + 1}`).join(" · ");
  const target = plan.strings.length === 1 ? ` · string ${plan.strings[0] + 1}` : "";
  return `${plan.direction === "neutral" ? "Neutral" : plan.direction} ${plan.kind}${target}`;
}

export default function RightHandTechnique3D({ technique, step, strings, run, id, loop, chordName, pattern, stepDurationMs }: RightHandTechnique3DProps) {
  const [handedness, setHandedness] = useState<GuitarHandedness>("right");
  const [previewStep, setPreviewStep] = useState(step);
  const [contactIndex, setContactIndex] = useState(0);
  const [manualPhase, setManualPhase] = useState<number | undefined>(0);
  const [speed, setSpeed] = useState<0.5 | 0.75>(0.5);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const animationRef = useRef<number | null>(null);

  const displayStep = run ? step : Math.max(0, Math.min(previewStep, Math.max(0, (pattern?.length ?? 1) - 1)));
  const motionPlan = useMemo(() => {
    const plan = planForStep(technique, pattern, displayStep, strings);
    return stepDurationMs && Number.isFinite(stepDurationMs) ? { ...plan, durationMs: Math.max(40, stepDurationMs) } : plan;
  }, [displayStep, pattern, stepDurationMs, strings, technique]);
  const contacts = useMemo(() => techniqueMotionContacts(motionPlan), [motionPlan]);
  const token = pattern?.[displayStep];

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setHandedness(root.dataset.handedness === "left" ? "left" : "right");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-handedness"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches || document.documentElement.dataset.reducedMotion === "true");
    sync();
    query.addEventListener?.("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduced-motion"] });
    return () => { query.removeEventListener?.("change", sync); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    const saved = run ? null : readRightHandSession(RIGHT_HAND_EXERCISES);
    setPreviewStep(!run && saved?.exerciseId === id ? saved.lessonStep : step);
    setContactIndex(0);
  }, [id, run, step]);

  useEffect(() => {
    if (run) setManualPhase(undefined);
    else setManualPhase(techniqueContactPhase(motionPlan, Math.min(contactIndex, Math.max(0, contacts.length - 1))));
  }, [contactIndex, contacts.length, motionPlan, run]);

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
  }, []);

  const stopAnimation = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  };
  const freezeContact = (nextContact: number) => {
    stopAnimation();
    const bounded = Math.max(0, Math.min(Math.max(0, contacts.length - 1), nextContact));
    setContactIndex(bounded);
    setManualPhase(techniqueContactPhase(motionPlan, bounded));
  };
  const selectStep = (nextStep: number) => {
    stopAnimation();
    const length = Math.max(1, pattern?.length ?? 1);
    const bounded = (nextStep + length) % length;
    const nextPlan = planForStep(technique, pattern, bounded, strings);
    setPreviewStep(bounded);
    saveRightHandLessonStep(RIGHT_HAND_EXERCISES, id, bounded);
    setContactIndex(0);
    setManualPhase(techniqueContactPhase(nextPlan, 0));
  };
  const playTo = (endPhase: number) => {
    stopAnimation();
    const boundedEnd = Math.max(0, Math.min(1, endPhase));
    if (reducedMotion || motionPlan.rest) {
      setManualPhase(boundedEnd);
      setPreviewNonce((value) => value + 1);
      return;
    }
    const started = performance.now();
    const duration = Math.max(180, motionPlan.durationMs * boundedEnd / speed);
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setManualPhase(progress * boundedEnd);
      if (progress < 1) animationRef.current = requestAnimationFrame(frame);
      else { animationRef.current = null; setPreviewNonce((value) => value + 1); }
    };
    animationRef.current = requestAnimationFrame(frame);
  };

  return <div className="right-hand-technique-3d">
    <div className="right-hand-technique-3d__context">
      <span>{handedness === "left" ? "Left-handed" : "Right-handed"} string motion</span>
      <strong>{chordName ?? "Chord context off"}</strong>
      <small>{token ? `Written step ${displayStep + 1}: ${token}. ` : ""}{describePlan(motionPlan)}</small>
    </div>
    {!run && pattern?.length ? <div className="guitar-technique-3d__controls" aria-label="Step-by-step 3D walkthrough">
      <button type="button" onClick={() => selectStep(displayStep - 1)} aria-label="Previous written step">Previous step</button>
      <strong aria-live="polite">Step {displayStep + 1}/{pattern.length} · {token}</strong>
      <button type="button" onClick={() => selectStep(displayStep + 1)} aria-label="Next written step">Next step</button>
      <button type="button" disabled={!contacts.length} onClick={() => freezeContact(contactIndex - 1)}>Previous contact</button>
      <button type="button" disabled={!contacts.length} onClick={() => playTo(techniqueContactPhase(motionPlan, contactIndex))}>Play contact</button>
      <button type="button" disabled={!contacts.length} onClick={() => freezeContact(contactIndex + 1)}>Next contact</button>
      <span aria-live="polite">{contacts.length ? `Paused at contact ${contactIndex + 1}/${contacts.length}: string ${contacts[contactIndex] + 1}` : "No contact on this rest"}</span>
      <button type="button" onClick={() => playTo(1)}>{reducedMotion ? "Show step end" : "Play whole step"}</button>
      <label>Walkthrough speed <select value={speed} onChange={(event) => setSpeed(Number(event.target.value) as 0.5 | 0.75)}><option value={0.5}>50%</option><option value={0.75}>75%</option></select></label>
    </div> : null}
    {run ? <p role="status" aria-live="polite">Following practice step {step + 1}{token ? ` · ${token}` : ""}. Controls return when practice pauses.</p> : null}
    <GuitarTechnique3D
      mode="right-hand"
      handedness={handedness}
      technique={technique}
      activePatternStep={displayStep}
      activeStrings={motionPlan.strings}
      motionPlan={motionPlan}
      manualPhase={run ? undefined : manualPhase}
      autoPlay={run}
      gestureKey={run ? `${id}:${step}:${loop}` : `${id}:preview:${displayStep}:${previewNonce}`}
      labels={false}
    />
  </div>;
}
