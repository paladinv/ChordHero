export type RecordingSignalDiagnostics = {
  peak: number;
  nearFullScaleSamples: number;
  nearFullScalePercent: number;
  longestNearFullScaleMs: number;
  materiallyClipped: boolean;
};

/** A near-full-scale heuristic, not a diagnosis of the microphone or guitar. */
export function measureRecordingSignal(channel: Float32Array, sampleRate: number): RecordingSignalDiagnostics {
  let peak = 0, nearFullScaleSamples = 0, run = 0, longestRun = 0;
  for (const sample of channel) {
    const magnitude = Math.abs(sample);
    peak = Math.max(peak, magnitude);
    if (magnitude >= .995) {
      nearFullScaleSamples += 1;
      run += 1;
      longestRun = Math.max(longestRun, run);
    } else run = 0;
  }
  const percent = channel.length ? nearFullScaleSamples / channel.length * 100 : 0;
  const longestMs = sampleRate > 0 ? longestRun / sampleRate * 1000 : 0;
  return {
    peak: Math.round(peak * 10000) / 10000,
    nearFullScaleSamples,
    nearFullScalePercent: Math.round(percent * 10000) / 10000,
    longestNearFullScaleMs: Math.round(longestMs * 100) / 100,
    // Isolated full-scale peaks do not fail a take. At least 0.1% of samples,
    // or a sustained 2 ms plateau, is enough to withhold reliable-score status.
    materiallyClipped: percent >= .1 || longestMs >= 2
  };
}
