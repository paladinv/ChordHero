import type { BeatTiming, ChordCalibrationSignature, HarmonicEvidence, PitchScoringMode } from "./songRecordingAnalysis";

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const ROOTS: Record<string, number> = { C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5, "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11 };
const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function chordTemplate(chord: string) {
  const match = chord.trim().match(/^([A-G](?:#|b)?)(m|min|maj|sus2|sus4|7|m7|maj7)?$/i);
  const root = ROOTS[match?.[1]?.toUpperCase() ?? ""];
  if (!Number.isFinite(root)) return null;
  const quality = (match?.[2] ?? "maj").toLowerCase();
  const intervals = quality === "m" || quality === "min" || quality === "m7" ? [0, 3, 7] : quality === "sus2" ? [0, 2, 7] : quality === "sus4" ? [0, 5, 7] : [0, 4, 7];
  if (quality === "7" || quality === "m7") intervals.push(10);
  if (quality === "maj7") intervals.push(11);
  return { root, tones: intervals.map((interval) => (root + interval) % 12) };
}

function detectFundamental(channel: Float32Array, sampleRate: number, start: number) {
  const targetRate = 12000;
  const stride = Math.max(1, Math.round(sampleRate / targetRate));
  const length = 4096;
  const values = new Float32Array(length);
  let rms = 0;
  for (let index = 0; index < length; index += 1) {
    const value = channel[Math.min(channel.length - 1, start + index * stride)] ?? 0;
    values[index] = value; rms += value * value;
  }
  rms = Math.sqrt(rms / length);
  if (rms < 0.008) return null;
  let bestLag = 0;
  let best = 0;
  for (let lag = Math.floor(targetRate / 660); lag <= Math.min(length / 2, Math.ceil(targetRate / 70)); lag += 1) {
    let correlation = 0; let energyA = 0; let energyB = 0;
    for (let index = 0; index < length - lag; index += 1) {
      correlation += values[index] * values[index + lag]; energyA += values[index] ** 2; energyB += values[index + lag] ** 2;
    }
    const normalized = correlation / Math.sqrt(Math.max(1e-9, energyA * energyB));
    if (normalized > best) { best = normalized; bestLag = lag; }
  }
  if (!bestLag || best < 0.32) return null;
  const frequencyHz = targetRate / bestLag;
  const midi = Math.round(69 + 12 * Math.log2(frequencyHz / 440));
  return { note: `${NOTE_NAMES[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`, frequencyHz: Math.round(frequencyHz * 10) / 10, confidence: clampScore(best * 100) };
}

function chromaForWindow(channel: Float32Array, sampleRate: number, centerSample: number) {
  const size = Math.min(4096, channel.length);
  const start = Math.max(0, Math.min(channel.length - size, centerSample - Math.floor(size * 0.12)));
  const chroma = Array(12).fill(0) as number[];
  for (let midi = 40; midi <= 88; midi += 1) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const coefficient = 2 * Math.cos(2 * Math.PI * frequency / sampleRate);
    let previous = 0; let beforePrevious = 0;
    for (let index = 0; index < size; index += 1) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / Math.max(1, size - 1));
      const current = channel[start + index] * window + coefficient * previous - beforePrevious;
      beforePrevious = previous; previous = current;
    }
    const power = Math.max(0, beforePrevious ** 2 + previous ** 2 - coefficient * previous * beforePrevious);
    chroma[midi % 12] += Math.sqrt(power) / (1 + Math.abs(midi - 58) * 0.025);
  }
  const total = chroma.reduce((sum, value) => sum + value, 0) || 1;
  return chroma.map((value) => value / total);
}

function scoreChord(chroma: number[], chord: string) {
  const template = chordTemplate(chord);
  if (!template) return 0;
  let total = 0;
  for (const value of chroma) total += Math.max(0, value);
  total = total || 1;
  let toneEnergy = 0;
  for (const note of template.tones) toneEnergy += Math.max(0, chroma[note]) / total;
  // Normalize first so exact chroma with a larger raw amplitude cannot tie a partial overlap at the cap.
  return clampScore((toneEnergy * 0.82 + Math.max(0, chroma[template.root]) / total * 0.45) * 100);
}

function rootScore(chroma: number[], chord: string) {
  const template = chordTemplate(chord);
  return template ? clampScore(chroma[template.root] * 260) : 0;
}

function signatureSimilarity(left: number[], right: number[]) {
  if (left.length !== 12 || right.length !== 12) return 0;
  let dot = 0; let normLeft = 0; let normRight = 0;
  for (let index = 0; index < 12; index += 1) { dot += left[index] * right[index]; normLeft += left[index] ** 2; normRight += right[index] ** 2; }
  return clampScore(dot / Math.sqrt(Math.max(1e-9, normLeft * normRight)) * 100);
}

export function bestChord(chroma: number[]) {
  const candidates = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].flatMap((root) => [root, `${root}m`, `${root}7`, `${root}m7`, `${root}maj7`, `${root}sus2`, `${root}sus4`]);
  return candidates.reduce((best, chord) => {
    const score = scoreChord(chroma, chord);
    return score > best.score ? { chord, score } : best;
  }, { chord: "—", score: 0 });
}

export function analyzePitchAndHarmony(channel: Float32Array, sampleRate: number, onsets: number[], beatTimings: BeatTiming[], requestedProgression: string[], subdivisions: number, scoringMode: PitchScoringMode = "quality", targetSignatures: Record<string, ChordCalibrationSignature> = {}, expectedPattern: readonly string[] = []) {
  const pitchCandidates = onsets.slice(0, 10).map((onset) => detectFundamental(channel, sampleRate, Math.floor((onset / 1000 + 0.04) * sampleRate))).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const detectedPitch = pitchCandidates.length ? pitchCandidates.reduce((best, item) => item.confidence > best.confidence ? item : best) : null;
  const progression = requestedProgression.filter((chord) => chordTemplate(chord));
  const harmonicEvidence: HarmonicEvidence[] = progression.length ? beatTimings.slice(0, Math.min(16, beatTimings.length)).flatMap((beat) => {
    if (beat.observedMs === null) return [];
    const expectedChord = progression[Math.floor(beat.step / Math.max(1, subdivisions * 4)) % progression.length];
    const center = Math.floor(((beat.observedMs ?? beat.expectedMs) / 1000) * sampleRate);
    const chroma = chromaForWindow(channel, sampleRate, center);
    const templateConfidence = scoringMode === "root" ? rootScore(chroma, expectedChord) : scoreChord(chroma, expectedChord);
    const saved = targetSignatures[expectedChord.toUpperCase()];
    const signatureMatch = saved ? signatureSimilarity(chroma, saved.chroma) : undefined;
    const confidence = signatureMatch === undefined ? templateConfidence : clampScore(templateConfidence * .4 + signatureMatch * .6);
    return [{ step: beat.step, patternToken: expectedPattern.length ? expectedPattern[beat.step % expectedPattern.length] : undefined, expectedMs: beat.expectedMs, observedMs: beat.observedMs, expectedChord, detectedChord: bestChord(chroma).chord, confidence, signatureMatch }];
  }) : [];
  const chordAccuracyScore = harmonicEvidence.length ? clampScore(harmonicEvidence.reduce((sum, item) => sum + item.confidence, 0) / harmonicEvidence.length) : null;
  return { detectedPitch, harmonicEvidence, chordAccuracyScore };
}

export function createChordCalibrationSignature(channel: Float32Array, sampleRate: number, chord: string): ChordCalibrationSignature {
  const windowCount = Math.max(1, Math.min(5, Math.floor(channel.length / Math.max(1, sampleRate * .18))));
  const signatures = Array.from({ length: windowCount }, (_, index) => chromaForWindow(channel, sampleRate, Math.floor(channel.length * (.25 + index * .5 / Math.max(1, windowCount - 1)))));
  const chroma = Array.from({ length: 12 }, (_, note) => signatures.reduce((sum, signature) => sum + signature[note], 0) / signatures.length);
  const template = chordTemplate(chord);
  const peak = Math.max(...chroma, 0);
  const noise = [...chroma].sort((a, b) => a - b)[5] ?? 0;
  return {
    chord,
    chroma: chroma.map((value) => Math.round(value * 10000) / 10000),
    root: template?.root ?? null,
    qualityConfidence: scoreChord(chroma, chord),
    signalConfidence: clampScore((peak - noise) * 360)
  };
}
