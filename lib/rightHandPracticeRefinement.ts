import type { RecordingAnalysis } from "./songRecordingAnalysis";

export const PICK_ROUTES = {
  alternate: ["5D", "4U", "3D", "2U", "2D", "3U", "4D", "5U"],
  economy: ["5D", "4D", "3D", "2D", "2U", "3U", "4U", "5U"]
};
export function stringCrossings(tokens: readonly string[]) {
  return tokens.flatMap((token, index) => {
    const current = /^([1-6])([DU])!?$/.exec(token);
    const next = /^([1-6])([DU])!?$/.exec(tokens[index + 1] ?? "");
    if (!current || !next || current[1] === next[1]) return [];
    return [{ step: index, from: Number(current[1]), to: Number(next[1]), direction: Number(next[1]) < Number(current[1]) ? "toward thinner strings" : "toward thicker strings", strokes: `${current[2]}→${next[2]}`, skip: Math.abs(Number(current[1]) - Number(next[1])) > 1 }];
  });
}
export type TransferTarget = { exerciseId: string; bpm: number; pattern: string[]; chordProgression: string[]; startedAt: string };
export function acceptedTransferEvidence(analysis: RecordingAnalysis, target: TransferTarget, recordedAt: string) {
  const context = analysis.practiceContext;
  const fullPattern = target.pattern.every((token, index) => token === "·" || analysis.beatTimings.some((beat) => beat.step === index));
  const window = analysis.scoringWindow;
  const fullSource = !analysis.analysisOptions?.scoringWindow && (!window || (!window.originalRecordingId && window.startMs === 0 && Number.isFinite(window.sourceDurationMs) && window.sourceDurationMs > 0 && window.endMs >= window.sourceDurationMs - 1));
  const enoughTargets = (analysis.expectedTimingCount ?? analysis.beatTimings.length) >= target.pattern.filter((token) => token !== "·").length;
  return Boolean(fullSource && fullPattern && enoughTargets && analysis.recordingId && analysis.reviewAccepted === true && analysis.scoreReliability === "reliable" && analysis.timingScore >= 80 && Date.parse(recordedAt) >= Date.parse(target.startedAt) && context?.bpm === target.bpm && JSON.stringify(context.pattern) === JSON.stringify(target.pattern) && JSON.stringify(context.chordProgression) === JSON.stringify(target.chordProgression));
}
