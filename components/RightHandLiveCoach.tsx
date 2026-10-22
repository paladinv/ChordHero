"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { rightHandTokenToMotionPlan, techniqueMotionContacts, type RightHandTechnique } from "../lib/guitarTechnique3d";

const RightHandTechnique3D = dynamic(() => import("./RightHandTechnique3D"), {
  ssr: false,
  loading: () => <div className="recording-coach-loading">Loading 3D guitar coach…</div>
});

type RightHandLiveCoachProps = {
  technique: RightHandTechnique;
  step: number;
  strings: readonly number[];
  run: boolean;
  id: string;
  loop: number;
  chordName?: string;
  /** Written exercise tokens. Optional so older callers retain inferred motion. */
  pattern?: readonly string[];
  stepDurationMs?: number;
};

const TECHNIQUE_COPY: Record<RightHandTechnique, { title: string; action: string }> = {
  strumming: { title: "See the strumming hand cross the strings", action: "Show 3D strumming hand" },
  plectrum: { title: "See the pick travel to the target strings", action: "Show 3D picking hand" },
  fingerpicking: { title: "See the picking fingers reach their strings", action: "Show 3D fingerpicking hand" }
};

export default function RightHandLiveCoach({ technique, step, strings, run, id, loop, chordName, pattern, stepDurationMs }: RightHandLiveCoachProps) {
  const [open, setOpen] = useState(false);
  const copy = TECHNIQUE_COPY[technique];
  const token = pattern?.[step];
  const writtenPlan = token === undefined ? null : rightHandTokenToMotionPlan(token, technique);
  const contacts = writtenPlan ? techniqueMotionContacts(writtenPlan) : strings.map((string) => string - 1);
  const writtenAction = writtenPlan?.rest ? "rest — no string contact"
    : writtenPlan?.mute ? "muted brush across strings 6–1"
    : writtenPlan?.fingerAssignments?.length ? writtenPlan.fingerAssignments.map((assignment) => `${assignment.finger}→${assignment.string + 1}`).join(" · ")
    : writtenPlan && writtenPlan.direction !== "neutral" ? `${writtenPlan.direction} ${writtenPlan.kind === "pick" && contacts.length ? `on string ${contacts[0] + 1}` : "stroke"}`
    : contacts.length ? `contact string${contacts.length > 1 ? "s" : ""} ${contacts.map((string) => string + 1).join(", ")}` : "ready position";

  useEffect(() => {
    setOpen(false);
  }, [id]);

  return <section className={`right-hand-live-coach${open ? " is-open" : ""}`} aria-labelledby="right-hand-live-coach-title">
    <div className="right-hand-live-coach__header">
      <div>
        <span className="label">3D right-hand preview · one click</span>
        <strong id="right-hand-live-coach-title">{copy.title}</strong>
        <p>Open beside the written pattern, pause on every contact, or follow the live round. The left hand frets <b>{chordName ?? "the chord"}</b>; the preview teaches the hand that sounds the strings.</p>
        {token !== undefined ? <p><b>Step {step + 1}: {token}</b> · {writtenAction}</p> : null}
      </div>
      <button type="button" onClick={() => setOpen((visible) => !visible)} aria-expanded={open} aria-controls="right-hand-live-coach-view">{open ? "Hide 3D hand" : copy.action}</button>
    </div>
    <p className="right-hand-live-coach__status" role="status" aria-live="polite">{open ? `3D hand visible · step ${step + 1}${token ? ` · ${token}` : ""} · ${writtenAction}` : `Preview: ${writtenAction}. The 3D engine stays unloaded until you open this display.`}</p>
    {open ? <div id="right-hand-live-coach-view"><RightHandTechnique3D technique={technique} step={step} strings={strings} run={run} id={id} loop={loop} chordName={chordName} pattern={pattern} stepDurationMs={stepDurationMs} /></div> : null}
  </section>;
}
