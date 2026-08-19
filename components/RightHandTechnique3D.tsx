"use client";

import dynamic from "next/dynamic";
import type { RightHandTechnique } from "../lib/guitarTechnique3d";

const GuitarTechnique3D = dynamic(() => import("./GuitarTechnique3D"), {
  ssr: false,
  loading: () => <div className="guitar-technique-3d-loading" role="status">Loading 3D fretboard…</div>
});

type RightHandTechnique3DProps = {
  technique: RightHandTechnique;
  step: number;
  strings: readonly number[];
  run: boolean;
  id: string;
  loop: number;
};

export default function RightHandTechnique3D({ technique, step, strings, run, id, loop }: RightHandTechnique3DProps) {
  return <GuitarTechnique3D mode="right-hand" technique={technique} activePatternStep={step} activeStrings={strings.map((string) => string - 1)} autoPlay={run} gestureKey={`${id}:${step}:${loop}`} labels />;
}
