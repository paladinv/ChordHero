"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { GuitarHandedness, RightHandTechnique } from "../lib/guitarTechnique3d";

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
};

export default function RightHandTechnique3D({ technique, step, strings, run, id, loop, chordName }: RightHandTechnique3DProps) {
  const [handedness, setHandedness] = useState<GuitarHandedness>("right");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setHandedness(root.dataset.handedness === "left" ? "left" : "right");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-handedness"] });
    return () => observer.disconnect();
  }, []);

  return <div className="right-hand-technique-3d"><div className="right-hand-technique-3d__context"><span>{handedness === "left" ? "Left-handed" : "Right-handed"} string motion</span><strong>{chordName ?? "Chord context off"}</strong><small>The fretting hand holds the chord; this view coaches the hand that sounds the strings near the sound hole or bridge.</small></div><GuitarTechnique3D mode="right-hand" handedness={handedness} technique={technique} activePatternStep={step} activeStrings={strings.map((string) => string - 1)} autoPlay={run} gestureKey={`${id}:${step}:${loop}`} labels={false} /></div>;
}
