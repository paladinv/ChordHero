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
  autoOpen: boolean;
  id: string;
  loop: number;
  chordName?: string;
};

export default function RightHandLiveCoach({ technique, step, strings, run, autoOpen, id, loop, chordName }: RightHandLiveCoachProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [id]);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return <section className="right-hand-live-coach" aria-labelledby="right-hand-live-coach-title">
    <div className="right-hand-live-coach__header">
      <div><span className="label">Live 3D coach</span><strong id="right-hand-live-coach-title">Watch the picking hand at the sound hole</strong><p>Start a round to load the interactive guitar. Drag to orbit; use Shift-drag and the wheel to explore the view.</p></div>
      <button type="button" onClick={() => setOpen((visible) => !visible)} aria-expanded={open}>{open ? "Hide 3D coach" : "Open 3D coach"}</button>
    </div>
    {open ? <RightHandTechnique3D technique={technique} step={step} strings={strings} run={run} id={id} loop={loop} chordName={chordName} /> : null}
  </section>;
}
