export type RecordingAnalysis = { peaks: number[]; durationMs: number; sampleRate: number };

export async function analyzeRecording(blob: Blob, bucketCount = 96): Promise<RecordingAnalysis> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer()); const channel = buffer.getChannelData(0); const bucketSize = Math.max(1, Math.floor(channel.length / bucketCount)); const peaks = Array.from({ length: Math.min(bucketCount, Math.ceil(channel.length / bucketSize)) }, (_, bucket) => { let peak = 0; const start = bucket * bucketSize; const end = Math.min(channel.length, start + bucketSize); for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(channel[index])); return Math.round(peak * 100) / 100; }); return { peaks, durationMs: Math.round(buffer.duration * 1000), sampleRate: buffer.sampleRate };
  } finally { await context.close(); }
}

export async function trimRecording(blob: Blob, startMs: number, endMs: number): Promise<Blob> {
  const context = new AudioContext();
  try { const source = await context.decodeAudioData(await blob.arrayBuffer()); const start = Math.max(0, startMs / 1000); const end = Math.min(source.duration, Math.max(start, endMs / 1000)); const output = context.createBuffer(source.numberOfChannels, Math.max(1, Math.floor((end - start) * source.sampleRate)), source.sampleRate); for (let channel = 0; channel < source.numberOfChannels; channel += 1) output.copyToChannel(source.getChannelData(channel).slice(Math.floor(start * source.sampleRate), Math.floor(end * source.sampleRate)), channel); return new Blob([encodeWav(output)], { type: "audio/wav" }); } finally { await context.close(); }
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer { const channels = buffer.numberOfChannels; const length = buffer.length * channels * 2 + 44; const view = new DataView(new ArrayBuffer(length)); const write = (offset: number, value: string) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0))); write(0, "RIFF"); view.setUint32(4, length - 8, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, length - 44, true); let offset = 44; for (let index = 0; index < buffer.length; index += 1) for (let channel = 0; channel < channels; channel += 1) { const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[index])); view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += 2; } return view.buffer; }
