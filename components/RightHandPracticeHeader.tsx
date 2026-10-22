import LocalizedCopy from "./LocalizedCopy";
import { formatPracticeTime, type ExerciseProgress } from "../lib/rightHandPracticeRuntime";
export default function RightHandPracticeHeader({ progress }: { progress?: ExerciseProgress }) {
  return <section className="right-hand-heading"><div><span className="tag">Right-hand studio</span><h1><LocalizedCopy id="rightHandTitle" /></h1><p><LocalizedCopy id="rightHandIntro" /></p></div><div className="right-hand-session-note" aria-label="Current practice progress"><span className="label">Your practice</span><strong>{progress?.bestBpm ? `${progress.bestBpm} BPM best` : "Start with control"}</strong><span>{progress?.sessions ?? 0} rounds · {formatPracticeTime(progress?.totalSeconds ?? 0)} practised{progress?.bestTimingScore ? ` · ${progress.bestTimingScore}% timing` : ""}</span></div></section>;
}
