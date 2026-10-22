export type AudioIndicator = { kind: "weak-attack" | "sustained-energy" | "roughness"; confidence: number; count: number; explanation: string };
export type DynamicsEvidence = { consistency: number | null; deliberateAccentScore: number | null; attackRms: number[]; confidence: number; note: string };
const score = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
function rms(samples: Float32Array, start: number, end: number) {
  let sum = 0, count = 0;
  for (let i = Math.max(0, start); i < Math.min(samples.length, end); i += 2) { sum += samples[i] ** 2; count++; }
  return Math.sqrt(sum / Math.max(1, count));
}
/** Bounded, time-domain indicators only: these cannot diagnose a string or confirm fret buzz. */
export function measureAudioEvidence(samples: Float32Array, sampleRate: number, attacks: { ms: number; step: number }[], noiseFloor: number, expectedAccents?: number[]) {
  const observations = attacks.slice(0, 64).map(({ ms, step }, index) => {
    const at = Math.round(ms * sampleRate / 1000);
    const attack = rms(samples, at, at + sampleRate * .065);
    const before = rms(samples, at - sampleRate * .045, at);
    const tailEndMs = Math.min(280, (attacks[index + 1]?.ms ?? ms + 305) - ms - 25);
    const tail = tailEndMs >= 190 ? rms(samples, at + sampleRate * .16, at + sampleRate * tailEndMs / 1000) : 0;
    let difference = 0, power = 0;
    const end = Math.min(samples.length - 1, at + Math.round(sampleRate * .09));
    for (let i = at; i < end; i += 2) { difference += (samples[i + 1] - samples[i]) ** 2; power += samples[i] ** 2; }
    return { attack, before, tail, roughness: Math.sqrt(difference / Math.max(.000001, power)), step };
  });
  const levels = observations.map((o) => o.attack);
  const median = [...levels].sort((a, b) => a - b)[Math.floor(levels.length / 2)] ?? 0;
  const snr = median / Math.max(.002, noiseFloor);
  const confidence = observations.length < 3 ? 0 : score(Math.min(1, observations.length / 8) * Math.min(1, Math.max(0, (snr - 1) / 5)) * 85);
  const indicators: AudioIndicator[] = [];
  const add = (kind: AudioIndicator["kind"], count: number, explanation: string) => { if (count && confidence >= 35) indicators.push({ kind, count, confidence, explanation }); };
  add("weak-attack", observations.filter((o) => o.attack < median * .55 && o.attack < o.before * 1.6).length, "Lower attack RMS and weak rise relative to this take. A quiet intentional stroke, mic processing, or incomplete contact can look alike.");
  add("sustained-energy", observations.filter((o) => o.tail > o.attack * .72 && o.tail > noiseFloor * 2).length, "Energy remains high 160–280 ms after an attack. This can indicate ringing, but sustain and the next stroke can produce the same result; listen before muting more.");
  add("roughness", observations.filter((o) => o.roughness > .65 && o.attack > noiseFloor * 3).length, "Elevated sample-to-sample high-frequency energy. Possible buzz-like roughness, pick scrape, distortion, or room noise; not a confirmed buzz diagnosis.");
  const mean = levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length);
  const cv = mean ? Math.sqrt(levels.reduce((sum, n) => sum + (n - mean) ** 2, 0) / Math.max(1, levels.length)) / mean : 1;
  const accentPairs = observations.flatMap((o) => expectedAccents?.length ? [{ measured: o.attack, target: expectedAccents[o.step % expectedAccents.length] ?? 0 }] : []);
  const targetMean = accentPairs.reduce((sum, p) => sum + p.target, 0) / Math.max(1, accentPairs.length);
  const numerator = accentPairs.reduce((sum, p) => sum + (p.measured - mean) * (p.target - targetMean), 0);
  const denominator = Math.sqrt(accentPairs.reduce((sum, p) => sum + (p.measured - mean) ** 2, 0) * accentPairs.reduce((sum, p) => sum + (p.target - targetMean) ** 2, 0));
  const dynamics: DynamicsEvidence = { consistency: confidence >= 35 ? score(100 - cv * 100) : null, deliberateAccentScore: confidence >= 35 && accentPairs.length >= 4 && denominator > .000001 ? score(Math.max(0, numerator / denominator) * 100) : null, attackRms: levels.map((n) => Math.round(n * 10000) / 10000), confidence, note: "Consistency describes equal-volume attacks, not musical quality. Deliberate accents are compared separately only when a varied target accent pattern is supplied. Automatic gain control can distort both." };
  return { audioIndicators: indicators, dynamics };
}

export function isRestToken(token?: string) { return token !== undefined && ["-", "rest", "r", "·", "_", "–", "—"].includes(token.toLowerCase()); }
