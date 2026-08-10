export type RecordingAnalysis = {
  peaks: number[];
  durationMs: number;
  sampleRate: number;
  tempoDriftPercent: number;
  timingConsistencyPercent: number;
  analysisNote: string;
  onsetMs: number[];
  timingScore: number;
  averageOffsetMs: number;
  timingTendency: "rushing" | "dragging" | "steady";
  troubleBeats: number[];
  chordAttackScore: number;
};

type AnalysisOptions = {
  referenceBpm?: number;
  subdivisionsPerBeat?: number;
  expectedSteps?: number;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function detectOnsets(channel: Float32Array, sampleRate: number) {
  const frameSize = Math.max(64, Math.floor(sampleRate * 0.012));
  const energy: number[] = [];
  for (let start = 0; start < channel.length; start += frameSize) {
    let sum = 0;
    const end = Math.min(channel.length, start + frameSize);
    for (let index = start; index < end; index += 1) sum += channel[index] ** 2;
    energy.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const sorted = [...energy].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.55)] ?? 0;
  const threshold = Math.max(0.025, noiseFloor * 2.8);
  const onsets: number[] = [];
  let last = -8;
  for (let index = 1; index < energy.length; index += 1) {
    const transient = energy[index] - energy[index - 1];
    if (energy[index] > threshold && transient > Math.max(0.012, threshold * 0.3) && index - last >= 6) {
      onsets.push((index * frameSize / sampleRate) * 1000);
      last = index;
    }
  }
  return { onsets, energy, noiseFloor };
}

export async function analyzeRecording(blob: Blob, bucketCount = 96, referenceBpm?: number): Promise<RecordingAnalysis> {
  return analyzePracticeRecording(blob, { referenceBpm }, bucketCount);
}

export async function analyzePracticeRecording(blob: Blob, options: AnalysisOptions = {}, bucketCount = 96): Promise<RecordingAnalysis> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const bucketSize = Math.max(1, Math.floor(channel.length / bucketCount));
    const peaks = Array.from({ length: Math.min(bucketCount, Math.ceil(channel.length / bucketSize)) }, (_, bucket) => {
      let peak = 0;
      const start = bucket * bucketSize;
      const end = Math.min(channel.length, start + bucketSize);
      for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(channel[index]));
      return Math.round(peak * 100) / 100;
    });
    const { onsets, energy, noiseFloor } = detectOnsets(channel, buffer.sampleRate);
    const intervals = onsets.slice(1).map((value, index) => value - onsets[index]).filter((value) => value > 70);
    const averageInterval = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : 0;
    const subdivisions = Math.max(1, options.subdivisionsPerBeat ?? 1);
    const expectedInterval = options.referenceBpm ? 60000 / options.referenceBpm / subdivisions : averageInterval;
    const tempoDriftPercent = expectedInterval && averageInterval ? Math.round(((averageInterval - expectedInterval) / expectedInterval) * 100) : 0;
    const timingConsistencyPercent = intervals.length > 1 && averageInterval
      ? clampScore(100 - (Math.sqrt(intervals.reduce((sum, value) => sum + (value - averageInterval) ** 2, 0) / intervals.length) / averageInterval) * 125)
      : 0;

    const first = onsets[0] ?? 0;
    const expectedCount = Math.min(options.expectedSteps ?? onsets.length, Math.floor((buffer.duration * 1000 - first) / Math.max(1, expectedInterval)) + 1);
    const deviations: number[] = [];
    const troubleBeats: number[] = [];
    if (expectedInterval && expectedCount) {
      for (let step = 0; step < expectedCount; step += 1) {
        const target = first + step * expectedInterval;
        const nearest = onsets.reduce((best, onset) => Math.abs(onset - target) < Math.abs(best - target) ? onset : best, onsets[0] ?? target);
        const deviation = nearest - target;
        deviations.push(deviation);
        if (Math.abs(deviation) > Math.min(140, expectedInterval * 0.32)) troubleBeats.push(step);
      }
    }
    const averageOffsetMs = deviations.length ? Math.round(deviations.reduce((sum, value) => sum + value, 0) / deviations.length) : 0;
    const meanAbsoluteOffset = deviations.length ? deviations.reduce((sum, value) => sum + Math.abs(value), 0) / deviations.length : expectedInterval;
    const timingScore = expectedInterval ? clampScore(100 - (meanAbsoluteOffset / expectedInterval) * 125 - troubleBeats.length * 2) : timingConsistencyPercent;
    const timingTendency = averageOffsetMs < -25 ? "rushing" : averageOffsetMs > 25 ? "dragging" : "steady";
    const transientEnergy = onsets.reduce((sum, onset) => sum + (energy[Math.round(onset / 12)] ?? 0), 0) / Math.max(1, onsets.length);
    const chordAttackScore = clampScore((transientEnergy / Math.max(0.02, noiseFloor * 4)) * 65 + timingScore * 0.35);

    return {
      peaks, durationMs: Math.round(buffer.duration * 1000), sampleRate: buffer.sampleRate,
      tempoDriftPercent, timingConsistencyPercent, onsetMs: onsets.map(Math.round), timingScore,
      averageOffsetMs, timingTendency, troubleBeats: [...new Set(troubleBeats)], chordAttackScore,
      analysisNote: "Timing and chord-attack scores use onset placement and transient clarity. They do not identify chord pitches; listen to the take to confirm the fretted chord."
    };
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
    for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
      output.copyToChannel(source.getChannelData(channel).slice(Math.floor(start * source.sampleRate), Math.floor(end * source.sampleRate)), channel);
    }
    return new Blob([encodeWav(output)], { type: "audio/wav" });
  } finally {
    await context.close();
  }
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
