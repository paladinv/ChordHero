import type { RecordingAnalysis } from "./songRecordingAnalysis";
import { summarizeHarmonicListeningClues } from "./songRecordingAnalysis";
type Take = { id: string; createdAt: string; reviewAccepted?: boolean; analysis: RecordingAnalysis };
type FullAcceptedRightHandAnalysis = RecordingAnalysis & { practiceContext: { bpm: number; pattern: string[]; chordProgression: string[] } };
function comparisonContext(analysis: RecordingAnalysis) {
  return JSON.stringify({ practiceContext: analysis.practiceContext, instrumentProfile: analysis.analysisOptions?.instrumentProfile, scoringMode: analysis.analysisOptions?.pitchScoringMode });
}
export function fullAcceptedRightHandTake(analysis: RecordingAnalysis | null): analysis is FullAcceptedRightHandAnalysis {
  if (!analysis?.recordingId || analysis.reviewAccepted !== true || analysis.scoreReliability !== "reliable" || analysis.signalDiagnostics?.materiallyClipped || !analysis.practiceContext?.pattern.length || analysis.analysisOptions?.scoringWindow) return false;
  const window = analysis.scoringWindow;
  if (window && (window.originalRecordingId || window.startMs !== 0 || window.endMs < window.sourceDurationMs - 1)) return false;
  return analysis.practiceContext.pattern.every((token, index) => token === "·" || token === "-" || analysis.beatTimings.some((beat) => beat.step === index));
}
export function previousComparableTake(current: RecordingAnalysis | null, history: readonly Take[]): Take | null {
  if (!fullAcceptedRightHandTake(current)) return null;
  const saved = history.find((take) => take.id === current.recordingId);
  if (!saved || !Number.isFinite(Date.parse(saved.createdAt))) return null;
  return [...history].filter((take) => take.id !== current.recordingId && take.reviewAccepted === true && fullAcceptedRightHandTake(take.analysis) && Date.parse(take.createdAt) < Date.parse(saved.createdAt) && comparisonContext(take.analysis) === comparisonContext(current)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export type RightHandNextAction = { kind: "timing" | "chord" | "repeat"; start: number; end: number; label: string; evidence: string };

/** Timing hotspots win; chord clues are only a fallback for accepted full takes. */
export function nextRightHandAction(analysis: RecordingAnalysis | null, patternLength: number, bpm: number, title: string): RightHandNextAction {
  const length = Math.max(1, patternLength);
  const accepted = fullAcceptedRightHandTake(analysis);
  if (!accepted) return { kind: "repeat", start: 0, end: length - 1, label: `Repeat ${title} once at ${bpm} BPM and record the full pattern.`, evidence: "No accepted full-pattern evidence is available; do not choose a chord action from this take." };
  const hotspot = analysis.beatTimings.filter((beat) => beat.status !== "on-time").sort((left, right) => (right.status === "missed" ? 1 : 0) - (left.status === "missed" ? 1 : 0) || Math.abs(right.offsetMs ?? Number.POSITIVE_INFINITY) - Math.abs(left.offsetMs ?? Number.POSITIVE_INFINITY))[0];
  if (hotspot) {
    const step = hotspot.step % length;
    return { kind: "timing", start: step, end: Math.min(length - 1, step + 1), label: `Loop step ${step + 1} with a neighbouring step at ${bpm} BPM.`, evidence: `One observed ${hotspot.status} timing miss at step ${step + 1} has priority over chord clues.` };
  }
  const clues = summarizeHarmonicListeningClues(analysis.harmonicEvidence, analysis.practiceContext.pattern);
  const transitionSteps = new Set(clues.transitions.map((transition) => transition.step));
  const clue = clues.mismatches.find((mismatch) => transitionSteps.has(mismatch.step)) ?? clues.mismatches[0];
  if (clue) {
    const step = Math.max(0, Math.min(length - 1, clue.step));
    return { kind: "chord", start: Math.max(0, step - 1), end: Math.min(length - 1, step + 1), label: `Listen around step ${step + 1} at ${bpm} BPM.`, evidence: `${clue.label} This is a heuristic listening clue, not a finger or pitch diagnosis.` };
  }
  return { kind: "repeat", start: 0, end: length - 1, label: `Repeat ${title} once at ${bpm} BPM and record the full pattern.`, evidence: `Evidence: ${analysis.timingScore}% accepted timing, without a timing miss or retained chord mismatch.` };
}
