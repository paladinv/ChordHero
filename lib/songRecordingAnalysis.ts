import { isRestToken, measureAudioEvidence, type AudioIndicator, type DynamicsEvidence } from "./rightHandAudioEvidence";
import { matchTimingTargets, timingProfile, type TimingProfile } from "./rightHandTimingReview";
import type { ReferenceVoice } from "./rightHandReferenceAudio";
import { measureRecordingSignal, type RecordingSignalDiagnostics } from "./rightHandRecordingQuality";

export type BeatTiming = {
  step: number;
  expectedMs: number;
  observedMs: number | null;
  offsetMs: number | null;
  status: "early" | "on-time" | "late" | "missed";
};

export type HarmonicEvidence = {
  step: number;
  patternToken?: string;
  expectedMs: number;
  observedMs: number;
  expectedChord: string;
  detectedChord: string;
  confidence: number;
  signatureMatch?: number;
};

export type PitchScoringMode = "timing" | "root" | "quality";
export type ChordCalibrationSignature = {
  chord: string;
  chroma: number[];
  root: number | null;
  qualityConfidence: number;
  signalConfidence: number;
};

export type RecordingAnalysis = {
  peaks: number[];
  durationMs: number;
  sampleRate: number;
  tempoDriftPercent: number;
  timingConsistencyPercent: number;
  analysisNote: string;
  onsetMs: number[];
  allOnsetMs?: number[];
  timingScore: number;
  averageOffsetMs: number;
  timingTendency: "rushing" | "dragging" | "steady";
  troubleBeats: number[];
  chordAttackScore: number;
  beatTimings: BeatTiming[];
  detectedPitch: { note: string; frequencyHz: number; confidence: number } | null;
  harmonicEvidence: HarmonicEvidence[];
  chordAccuracyScore: number | null;
  calibrationConfidence: number;
  recordingSuitability: "good" | "noisy" | "quiet";
  scoreReliability?: "reliable" | "limited" | "insufficient";
  timingEvidenceCount?: number;
  expectedTimingCount?: number;
  chordEvidenceExcluded?: number;
  latencyOffsetMs?: number;
  scoreScope?: string;
  recordingId?: string;
  reviewAccepted?: boolean;
  audioIndicators?: AudioIndicator[];
  dynamics?: DynamicsEvidence;
  timingProfile?: TimingProfile;
  personalizedTiming?: { score: number; beatTimings: BeatTiming[] };
  scoringWindow?: { startMs: number; endMs: number; sourceDurationMs: number; originalRecordingId?: string };
  practiceContext?: { bpm: number; pattern: string[]; chordProgression: string[] };
  retained?: boolean;
  analysisOptions?: AnalysisOptions;
  referenceVoice?: ReferenceVoice;
  signalDiagnostics?: RecordingSignalDiagnostics;
};

export type HarmonicListeningClue = {
  kind: "transition" | "mismatch";
  step: number;
  patternToken?: string;
  expectedChord: string;
  detectedChord: string;
  fromChord?: string;
  label: string;
};

/**
 * Keep chord feedback inspectable without presenting template matching as pitch truth.
 * These are deliberately limited to expected chord transitions and retained mismatches.
 */
export function summarizeHarmonicListeningClues(evidence: readonly HarmonicEvidence[], pattern: readonly string[] = []) {
  const ordered = [...evidence].sort((left, right) => left.step - right.step);
  const transitions: HarmonicListeningClue[] = [];
  const mismatches: HarmonicListeningClue[] = [];
  ordered.forEach((item, index) => {
    const step = Number.isFinite(item.step) ? item.step : index;
    const patternToken = item.patternToken ?? (pattern.length ? pattern[step % pattern.length] : undefined);
    if (item.detectedChord !== item.expectedChord) mismatches.push({ kind: "mismatch", step, patternToken, expectedChord: item.expectedChord, detectedChord: item.detectedChord, label: `Step ${step + 1}${patternToken ? ` (${patternToken})` : ""}: expected ${item.expectedChord}, closest template ${item.detectedChord}.` });
    const previous = ordered[index - 1];
    if (previous && previous.expectedChord !== item.expectedChord) transitions.push({ kind: "transition", step, patternToken, expectedChord: item.expectedChord, detectedChord: item.detectedChord, fromChord: previous.expectedChord, label: `Step ${step + 1}${patternToken ? ` (${patternToken})` : ""}: listen for ${previous.expectedChord} → ${item.expectedChord}; retained evidence is closest to ${item.detectedChord}.` });
  });
  return { transitions, mismatches };
}

export type AnalysisOptions = {
  referenceBpm?: number;
  subdivisionsPerBeat?: number;
  expectedSteps?: number;
  expectedChordProgression?: string[];
  calibrationNoiseFloor?: number;
  instrumentProfile?: "acoustic" | "electric";
  pitchScoringMode?: PitchScoringMode;
  targetSignatures?: Record<string, ChordCalibrationSignature>;
  inputLatencyMs?: number;
  expectedFirstOnsetMs?: number;
  expectedPattern?: string[];
  expectedAccents?: number[];
  maxDurationMs?: number;
  scoringWindow?: { startMs: number; endMs: number; originalRecordingId?: string };
  timingProfile?: TimingProfile;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function detectOnsets(channel: Float32Array, sampleRate: number, options: AnalysisOptions) {
  const frameSize = Math.max(64, Math.floor(sampleRate * 0.012));
  const energy: number[] = [];
  for (let start = 0; start < channel.length; start += frameSize) {
    let sum = 0;
    const end = Math.min(channel.length, start + frameSize);
    for (let index = start; index < end; index += 1) sum += channel[index] ** 2;
    energy.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const sorted = [...energy].sort((a, b) => a - b);
  const measuredFloor = sorted[Math.floor(sorted.length * 0.55)] ?? 0;
  const noiseFloor = Math.max(measuredFloor, options.calibrationNoiseFloor ?? 0);
  const profileFloor = options.instrumentProfile === "electric" ? 0.012 : 0.02;
  const threshold = Math.max(profileFloor, noiseFloor * (options.instrumentProfile === "electric" ? 2.35 : 2.75));
  const onsets: number[] = [];
  let last = -8;
  for (let index = 1; index < energy.length; index += 1) {
    const transient = energy[index] - energy[index - 1];
    if (energy[index] > threshold && transient > Math.max(profileFloor * 0.45, threshold * 0.28) && index - last >= 6) {
      onsets.push((index * frameSize / sampleRate) * 1000);
      last = index;
    }
  }
  return { onsets, energy, noiseFloor, peakEnergy: Math.max(...energy, 0) };
}


export async function analyzeRecording(blob: Blob, bucketCount = 96, referenceBpm?: number): Promise<RecordingAnalysis> {
  return analyzePracticeRecording(blob, { referenceBpm }, bucketCount);
}

export async function analyzePracticeRecording(blob: Blob, options: AnalysisOptions = {}, bucketCount = 96): Promise<RecordingAnalysis> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (options.maxDurationMs && buffer.duration * 1000 > options.maxDurationMs) throw new Error(`Recording exceeds the ${Math.round(options.maxDurationMs / 1000)}-second analysis limit.`);
    const sourceDurationMs = buffer.duration * 1000;
    if (options.scoringWindow && (!Number.isFinite(options.scoringWindow.startMs) || !Number.isFinite(options.scoringWindow.endMs))) throw new Error("Window boundaries must be finite milliseconds.");
    const windowStartMs = Math.max(0, Math.min(sourceDurationMs, options.scoringWindow?.startMs ?? 0));
    const windowEndMs = Math.min(sourceDurationMs, options.scoringWindow?.endMs ?? sourceDurationMs);
    if (windowEndMs - windowStartMs < 200) throw new Error("Select at least 200 ms of recorded audio.");
    const channel = buffer.getChannelData(0).slice(Math.floor(windowStartMs * buffer.sampleRate / 1000), Math.floor(windowEndMs * buffer.sampleRate / 1000));
    const signalDiagnostics = measureRecordingSignal(channel, buffer.sampleRate);
    const bucketSize = Math.max(1, Math.floor(channel.length / bucketCount));
    const peaks = Array.from({ length: Math.min(bucketCount, Math.ceil(channel.length / bucketSize)) }, (_, bucket) => {
      let peak = 0;
      for (let index = bucket * bucketSize; index < Math.min(channel.length, (bucket + 1) * bucketSize); index += 1) peak = Math.max(peak, Math.abs(channel[index]));
      return Math.round(peak * 100) / 100;
    });
    const detected = detectOnsets(channel, buffer.sampleRate, options);
    const latencyOffsetMs = Math.max(0, Math.min(500, Math.round(options.inputLatencyMs ?? 0)));
    const allOnsets = detected.onsets.map((onset) => Math.max(windowStartMs, onset + windowStartMs - latencyOffsetMs));
    const onsets = allOnsets.filter((onset) => options.expectedFirstOnsetMs === undefined || onset >= options.expectedFirstOnsetMs - 35);
    const { energy, noiseFloor, peakEnergy } = detected;
    const intervals = onsets.slice(1).map((value, index) => value - onsets[index]).filter((value) => value > 70);
    const averageInterval = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : 0;
    const subdivisions = Math.max(1, options.subdivisionsPerBeat ?? 1);
    const expectedInterval = options.referenceBpm ? 60000 / options.referenceBpm / subdivisions : averageInterval;
    let tempoDriftPercent = expectedInterval && averageInterval ? Math.round(((averageInterval - expectedInterval) / expectedInterval) * 100) : 0;
    let timingConsistencyPercent = intervals.length > 1 && averageInterval
      ? clampScore(100 - (Math.sqrt(intervals.reduce((sum, value) => sum + (value - averageInterval) ** 2, 0) / intervals.length) / averageInterval) * 125)
      : 0;
    const first = options.expectedFirstOnsetMs === undefined
      ? (onsets[0] ?? 0)
      : Math.max(0, options.expectedFirstOnsetMs);
    const firstStep = Math.max(0, Math.ceil((windowStartMs - first) / Math.max(1, expectedInterval)));
    const expectedCount = Math.max(0, Math.min(firstStep + 64, Math.ceil((windowEndMs - first) / Math.max(1, expectedInterval))));
    const targets: { step: number; ms: number }[] = [];
    for (let step = firstStep; step < expectedCount; step += 1) {
      if (options.expectedPattern?.length && isRestToken(options.expectedPattern[step % options.expectedPattern.length])) continue;
      const target = first + step * expectedInterval;
      if (target >= windowStartMs && target < windowEndMs) targets.push({ step, ms: target });
    }
    const canonical = matchTimingTargets(onsets, targets, expectedInterval);
    const beatTimings = canonical.beats;
    const profile = timingProfile(options.timingProfile);
    const personalized = matchTimingTargets(onsets, targets, expectedInterval, profile);
    const deviations = beatTimings.flatMap((beat) => beat.offsetMs === null ? [] : [beat.offsetMs]);
    if (options.expectedPattern?.length) {
      const matched = beatTimings.filter((beat) => beat.observedMs !== null);
      const normalized = matched.slice(1).map((beat, i) => (beat.observedMs! - matched[i].observedMs!) / (beat.step - matched[i].step));
      const mean = normalized.reduce((sum, n) => sum + n, 0) / Math.max(1, normalized.length);
      tempoDriftPercent = mean && expectedInterval ? Math.round((mean - expectedInterval) / expectedInterval * 100) : 0;
      timingConsistencyPercent = normalized.length > 1 && mean ? clampScore(100 - Math.sqrt(normalized.reduce((sum, n) => sum + (n - mean) ** 2, 0) / normalized.length) / mean * 125) : 0;
    }
    const troubleBeats = beatTimings.filter((beat) => beat.status !== "on-time").map((beat) => beat.step);
    const averageOffsetMs = deviations.length ? Math.round(deviations.reduce((sum, value) => sum + value, 0) / deviations.length) : 0;
    const timingScore = expectedInterval ? canonical.score : timingConsistencyPercent;
    const timingTendency = averageOffsetMs < -25 ? "rushing" : averageOffsetMs > 25 ? "dragging" : "steady";
    const transientEnergy = detected.onsets.reduce((sum, onset) => sum + (energy[Math.round(onset / 12)] ?? 0), 0) / Math.max(1, onsets.length);
    const chordAttackScore = clampScore((transientEnergy / Math.max(0.02, noiseFloor * 4)) * 65 + timingScore * 0.35);
    const calibrationConfidence = clampScore((peakEnergy / Math.max(0.008, noiseFloor * 5)) * 40);
    const recordingSuitability = peakEnergy < Math.max(0.025, noiseFloor * 2.1) ? "quiet" : noiseFloor > peakEnergy * 0.28 ? "noisy" : "good";

    const timingEvidenceCount = beatTimings.filter((beat) => beat.observedMs !== null).length;
    const expectedAttackCount = beatTimings.length;
    const evidenceCoverage = expectedAttackCount ? timingEvidenceCount / expectedAttackCount : 0;
    const scoreReliability: RecordingAnalysis["scoreReliability"] = signalDiagnostics.materiallyClipped || recordingSuitability !== "good" || calibrationConfidence < 35 || timingEvidenceCount < 2
      ? "insufficient"
      : calibrationConfidence < 60 || evidenceCoverage < .55
        ? "limited"
        : "reliable";
    const scoringMode = options.pitchScoringMode ?? "quality";
    const shouldAnalyzePitch = scoringMode !== "timing" && Boolean(options.expectedSteps || options.expectedChordProgression?.length || options.instrumentProfile);
    const pitchAndHarmony = shouldAnalyzePitch
      ? await import("./rightHandPitchAnalysis").then(({ analyzePitchAndHarmony }) => analyzePitchAndHarmony(channel, buffer.sampleRate, detected.onsets, beatTimings.map((beat) => ({ ...beat, expectedMs: beat.expectedMs - windowStartMs, observedMs: beat.observedMs === null ? null : beat.observedMs - windowStartMs + latencyOffsetMs })), options.expectedChordProgression ?? [], subdivisions, scoringMode, options.targetSignatures ?? {}, options.expectedPattern ?? []))
      : { detectedPitch: null, harmonicEvidence: [] as HarmonicEvidence[], chordAccuracyScore: null };
    const { detectedPitch, harmonicEvidence: rawHarmonicEvidence } = pitchAndHarmony;
    const minimumChordConfidence = scoreReliability === "reliable" ? 35 : 55;
    const harmonicEvidence = rawHarmonicEvidence.filter((item) => item.confidence >= minimumChordConfidence);
    const chordEvidenceExcluded = rawHarmonicEvidence.length - harmonicEvidence.length;
    const chordAccuracyScore = scoreReliability === "reliable" && harmonicEvidence.length > 0 && harmonicEvidence.length >= Math.min(2, rawHarmonicEvidence.length)
      ? clampScore(harmonicEvidence.reduce((sum, item) => sum + item.confidence, 0) / harmonicEvidence.length)
      : null;
    const hasProgression = harmonicEvidence.length > 0;
    const accentPattern = options.expectedAccents ?? (options.expectedPattern?.some((token) => token.includes("!")) ? options.expectedPattern.map((token) => token.includes("!") ? 1 : 0) : undefined);
    const audioEvidence = measureAudioEvidence(channel, buffer.sampleRate, beatTimings.flatMap((beat) => beat.observedMs === null ? [] : [{ ms: beat.observedMs - windowStartMs + latencyOffsetMs, step: beat.step }]), noiseFloor, accentPattern);

    return {
      peaks, durationMs: Math.round(buffer.duration * 1000), sampleRate: buffer.sampleRate, tempoDriftPercent,
      timingConsistencyPercent, onsetMs: onsets.map(Math.round), allOnsetMs: allOnsets.map(Math.round), timingScore, averageOffsetMs, timingTendency,
      troubleBeats: [...new Set(troubleBeats)], chordAttackScore, beatTimings, detectedPitch, harmonicEvidence,
      chordAccuracyScore, calibrationConfidence, recordingSuitability, scoreReliability,
      timingEvidenceCount, expectedTimingCount: expectedAttackCount, chordEvidenceExcluded, latencyOffsetMs, ...audioEvidence,
      signalDiagnostics,
      timingProfile: profile, personalizedTiming: { score: personalized.score, beatTimings: personalized.beats },
      scoringWindow: { startMs: windowStartMs, endMs: windowEndMs, sourceDurationMs, originalRecordingId: options.scoringWindow?.originalRecordingId },
      analysisOptions: structuredClone(options),
      scoreScope: `Timing uses ${timingEvidenceCount}/${expectedAttackCount} matched attacks${options.expectedFirstOnsetMs === undefined ? " with relative first-attack alignment" : " against the recorded play cue; pre-PLAY attacks excluded"}. Intended rests are not graded as missed attacks. Chord evidence excludes low-confidence detections and never identifies individual strings.`,
      analysisNote: signalDiagnostics.materiallyClipped
        ? `Possible clipping or strong saturation: ${signalDiagnostics.nearFullScalePercent}% near-full-scale samples, longest run ${signalDiagnostics.longestNearFullScaleMs} ms. Lower microphone/input gain and make another take. This take stays available to hear but is excluded from reliable progress scoring.`
        : scoringMode === "timing"
        ? "Timing-only mode ignores pitch. Scores use onset placement and should be treated as practice guidance, not grading."
        : hasProgression
          ? `${scoringMode === "root" ? "Root" : "Root-and-quality"} evidence is a confidence estimate${Object.keys(options.targetSignatures ?? {}).length ? " compared with your saved local chord signatures" : " from harmonic templates"}, not certain polyphonic recognition. ${chordEvidenceExcluded ? `${chordEvidenceExcluded} uncertain detection${chordEvidenceExcluded === 1 ? " was" : "s were"} excluded. ` : ""}Confirm by listening back.`
          : "Pitch is a monophonic root estimate; timing and attack scores use onset placement. Select a chord progression to enable chord evidence."
    };
  } finally {
    await context.close();
  }
}

export async function analyzeChordCalibration(blob: Blob, chord: string): Promise<ChordCalibrationSignature> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = buffer.getChannelData(0);
    return await import("./rightHandPitchAnalysis").then(({ createChordCalibrationSignature }) => createChordCalibrationSignature(channel, buffer.sampleRate, chord));
  } finally {
    await context.close();
  }
}

export async function trimRecording(blob: Blob, startMs: number, endMs: number): Promise<Blob> {
  const context = new AudioContext();
  try {
    const source = await context.decodeAudioData(await blob.arrayBuffer());
    const start = Math.max(0, startMs / 1000);
    const end = Math.min(source.duration, Math.max(start, endMs / 1000));
    const output = context.createBuffer(source.numberOfChannels, Math.max(1, Math.floor((end - start) * source.sampleRate)), source.sampleRate);
    for (let channel = 0; channel < source.numberOfChannels; channel += 1) output.copyToChannel(source.getChannelData(channel).slice(Math.floor(start * source.sampleRate), Math.floor(end * source.sampleRate)), channel);
    return new Blob([encodeWav(output)], { type: "audio/wav" });
  } finally { await context.close(); }
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const view = new DataView(new ArrayBuffer(length));
  const write = (offset: number, value: string) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, length - 8, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, length - 44, true);
  let offset = 44;
  for (let index = 0; index < buffer.length; index += 1) for (let channel = 0; channel < channels; channel += 1) {
    const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += 2;
  }
  return view.buffer;
}
