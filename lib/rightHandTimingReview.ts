import type { BeatTiming } from "./songRecordingAnalysis";

export type TimingProfile = { toleranceMs: number; targetOffsetMs: number };
export const DEFAULT_TIMING_PROFILE: TimingProfile = { toleranceMs: 35, targetOffsetMs: 0 };
export function timingProfile(value?: Partial<TimingProfile>): TimingProfile {
  const finite = (input: unknown, fallback: number) => typeof input === "number" && Number.isFinite(input) ? input : fallback;
  return { toleranceMs: Math.max(10, Math.min(100, Math.round(finite(value?.toleranceMs, 35)))), targetOffsetMs: Math.max(-100, Math.min(100, Math.round(finite(value?.targetOffsetMs, 0)))) };
}
export function matchTimingTargets(onsets: number[], targets: { step: number; ms: number }[], intervalMs: number, profile = DEFAULT_TIMING_PROFILE) {
  const used = new Set<number>();
  const beats: BeatTiming[] = targets.map(({ step, ms }) => {
    const target = ms + profile.targetOffsetMs;
    let nearest = -1, distance = Infinity;
    onsets.forEach((onset, index) => { const delta = Math.abs(onset - target); if (!used.has(index) && delta < distance) { nearest = index; distance = delta; } });
    const matchWindow = Math.min(intervalMs * .42, Math.max(170, profile.toleranceMs));
    if (nearest < 0 || distance > matchWindow) return { step, expectedMs: Math.round(target), observedMs: null, offsetMs: null, status: "missed" };
    used.add(nearest);
    const offsetMs = Math.round(onsets[nearest] - target);
    return { step, expectedMs: Math.round(target), observedMs: Math.round(onsets[nearest]), offsetMs, status: offsetMs < -profile.toleranceMs ? "early" : offsetMs > profile.toleranceMs ? "late" : "on-time" };
  });
  const offsets = beats.flatMap((beat) => beat.offsetMs === null ? [] : [Math.abs(beat.offsetMs)]);
  const mean = offsets.length ? offsets.reduce((sum, n) => sum + n, 0) / offsets.length : intervalMs;
  const misses = beats.filter((beat) => beat.status !== "on-time").length;
  return { beats, score: Math.max(0, Math.min(100, Math.round(100 - mean / Math.max(1, intervalMs) * 125 - misses * 3))) };
}

export function audioLevel(channels: readonly Float32Array[]) {
  let squares = 0, count = 0, peak = 0;
  for (const channel of channels) for (const value of channel) { squares += value * value; count++; peak = Math.max(peak, Math.abs(value)); }
  return { rms: count ? Math.sqrt(squares / count) : 0, peak };
}
export function matchedAudioGains(a: ReturnType<typeof audioLevel>, b: ReturnType<typeof audioLevel>) {
  // Attenuate only: the quieter RMS and either peak ceiling constrain both signals.
  const rms = Math.min(.1, a.rms, b.rms, a.peak ? .9 * a.rms / a.peak : 0, b.peak ? .9 * b.rms / b.peak : 0);
  return { a: a.rms > 1e-7 ? rms / a.rms : 0, b: b.rms > 1e-7 ? rms / b.rms : 0, rms };
}
