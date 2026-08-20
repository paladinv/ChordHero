"use client";

import type { CSSProperties } from "react";
import type { RightHandExercise, RightHandTechnique } from "../lib/rightHandExercises";
import { describeRightHandStep as describeStep, rightHandCountLabel as countLabel } from "../lib/rightHandPracticeRuntime";

type PracticeStatus = "idle" | "countin" | "running" | "paused" | "complete";
type Step = ReturnType<typeof describeStep>;

type RightHandFollowAlongProps = {
  status: PracticeStatus;
  technique: RightHandTechnique;
  demoSpeed: number;
  noLook: boolean;
  countIn: number;
  activeStep: number;
  loopsCompleted: number;
  selectedExercise: RightHandExercise;
  currentStep: Step;
  describedPattern: readonly Step[];
  troubleLoop: { start: number; end: number } | null;
};

export default function RightHandFollowAlong({ status, technique, demoSpeed, noLook, countIn, activeStep, loopsCompleted, selectedExercise, currentStep, describedPattern, troubleLoop }: RightHandFollowAlongProps) {
  return <div className={`follow-along ${status === "running" ? "playing" : ""}`}>
    <div className={`motion-demo technique-${technique} demo-speed-${demoSpeed * 100}`} style={{ "--target-string": String(currentStep.strings[0] ?? 3) } as CSSProperties}>
      {status === "countin" ? <div className="count-in-display"><span>Get ready</span><strong>{countIn}</strong></div> : <><div className="string-motion" aria-hidden="true">{[1, 2, 3, 4, 5, 6].map((string) => <i key={string} className={currentStep.strings.includes(string) ? "active" : ""} />)}<b>{currentStep.main}</b></div><strong>{currentStep.main}</strong><span>{currentStep.detail}</span></>}
    </div>
    <div className={`pattern-stage ${noLook && status === "running" ? "no-look" : ""}`}>
      <div className="pattern-meta"><span>{selectedExercise.subdivision}</span><span>{status === "running" ? `${loopsCompleted} loops` : `${selectedExercise.pattern.length} steps`}</span></div>
      <div className="pattern-strip scroll-hint" role="list" aria-label="Follow-along pattern">
        {describedPattern.map((step, index) => <div className={`pattern-step ${index === activeStep ? "active" : ""} ${step.accent ? "accent" : ""} ${step.rest ? "rest" : ""} ${troubleLoop && index >= troubleLoop.start && index <= troubleLoop.end ? "looped" : ""}`} key={`${selectedExercise.pattern[index]}-${index}`} role="listitem" aria-current={index === activeStep ? "step" : undefined} aria-label={`${countLabel(index, selectedExercise.subdivision)}: ${step.detail}${step.accent ? ", accented" : ""}`}><span className="pattern-count">{countLabel(index, selectedExercise.subdivision)}</span><strong aria-hidden="true">{step.main}</strong><small aria-hidden="true">{step.detail}</small></div>)}
      </div>
    </div>
  </div>;
}
