"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { RightHandTechnique } from "../lib/guitarTechnique3d";

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
};

const TECHNIQUE_COPY: Record<RightHandTechnique, { title: string; action: string }> = {
  strumming: { title: "See the strumming hand cross the strings", action: "Show 3D strumming hand" },
  plectrum: { title: "See the pick travel to the target strings", action: "Show 3D picking hand" },
  fingerpicking: { title: "See the picking fingers reach their strings", action: "Show 3D fingerpicking hand" }
};

export default function RightHandLiveCoach({ technique, step, strings, run, id, loop, chordName }: RightHandLiveCoachProps) {
  const [open, setOpen] = useState(false);
  const copy = TECHNIQUE_COPY[technique];

  useEffect(() => {
    setOpen(false);
  }, [id]);

  return <section className={`right-hand-live-coach${open ? " is-open" : ""}`} aria-labelledby="right-hand-live-coach-title">
    <div className="right-hand-live-coach__header">
      <div>
        <span className="label">3D right-hand display · available now</span>
        <strong id="right-hand-live-coach-title">{copy.title}</strong>
        <p>Open it while idle, then use Play motion or start the round. The left hand frets <b>{chordName ?? "the chord"}</b>; this display teaches the right hand that strikes the strings.</p>
      </div>
      <button type="button" onClick={() => setOpen((visible) => !visible)} aria-expanded={open} aria-controls="right-hand-live-coach-view">{open ? "Hide 3D hand" : copy.action}</button>
    </div>
    <p className="right-hand-live-coach__status" role="status" aria-live="polite">{open ? `3D hand visible · step ${step + 1} · target ${strings.length ? `string${strings.length > 1 ? "s" : ""} ${strings.join(", ")}` : "rest"}` : "The 3D engine stays unloaded until you open this display."}</p>
    {open ? <div id="right-hand-live-coach-view"><RightHandTechnique3D technique={technique} step={step} strings={strings} run={run} id={id} loop={loop} chordName={chordName} /></div> : null}
  </section>;
}
