import { loadRecordedAudio } from "./recordedAudio";
import type { RecordingAnalysis } from "./songRecordingAnalysis";

export type ReferenceVoice = { technique?: "strumming" | "plectrum" | "fingerpicking"; sound?: "acoustic-strum" | "muted-funk" | "fingerstyle" | "clean-electric" };
export async function renderReviewTarget(analysis: RecordingAnalysis, pattern: string[], sampleRate: number, startMs: number, endMs: number, voice: ReferenceVoice) {
  const context = new OfflineAudioContext(1, Math.max(1, Math.ceil((endMs - startMs) * sampleRate / 1000)), sampleRate);
  const strings: Record<number, number> = { 6: 40, 5: 45, 4: 48, 3: 54, 2: 60, 1: 63 };
  await Promise.all(analysis.beatTimings.map(async (beat) => {
    const when = (beat.expectedMs + (analysis.timingProfile?.targetOffsetMs ?? 0) - startMs) / 1000;
    if (when < 0 || when >= (endMs - startMs) / 1000) return;
    const token = (pattern[beat.step % Math.max(1, pattern.length)] ?? "D").replace("!", "");
    const muted = token === "X" || voice.sound === "muted-funk";
    const string = Number(token.match(/\d/)?.[0] ?? (voice.technique === "strumming" ? 4 : 3));
    const sample = await loadRecordedAudio(context, muted ? "/samples/guitar/muted.mp3" : `/samples/guitar/clean/${strings[string] ?? 54}.mp3`);
    if (!sample) throw new Error("Target sample unavailable. No audio has been played.");
    const source = context.createBufferSource(); const gain = context.createGain(); const filter = context.createBiquadFilter();
    source.buffer = sample; source.playbackRate.value = voice.sound === "acoustic-strum" ? .94 : voice.sound === "fingerstyle" ? 1.02 : voice.technique === "strumming" ? .96 : 1;
    filter.type = "lowpass"; filter.frequency.value = muted ? 2400 : voice.sound === "acoustic-strum" ? 5200 : voice.sound === "fingerstyle" ? 4200 : 7600;
    gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(pattern[beat.step % pattern.length]?.includes("!") ? .25 : .2, when + .005); gain.gain.exponentialRampToValueAtTime(.0001, when + (muted ? .13 : .42));
    source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start(when);
  }));
  return context.startRendering();
}
