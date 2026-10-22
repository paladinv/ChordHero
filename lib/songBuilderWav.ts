import type { LibrarySong } from "./songLibrary";
import { buildSongTimeline } from "./songBuilder";
import { createSongBuilderAudio } from "./songBuilderAudio";
export function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(bytes);
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < frames; i++)
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, data[channel][i]));
      view.setInt16(44 + (i * channels + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
  return new Blob([bytes], { type: "audio/wav" });
}
export async function renderSongWav(song: LibrarySong, trackId?: string) {
  const timeline = buildSongTimeline(song);
  if (!song.composition || !timeline.duration)
    throw new Error("Add music before exporting audio.");
  if (timeline.duration > 600)
    throw new Error("WAV export supports up to ten minutes. Export a shorter arrangement.");
  const context = new OfflineAudioContext(2, Math.ceil((timeline.duration + .5) * 44100), 44100);
  const player = createSongBuilderAudio(context);
  const tracks = song.composition.tracks.map((track) => ({ ...track, muted: trackId ? track.id !== trackId : track.muted, solo: trackId ? track.id === trackId : track.solo }));
  player.updateMix(tracks);
  await player.prepare(timeline.events.flatMap((cue) => cue.pitches), false, [...new Set(timeline.events.map((cue) => cue.track.instrument))]);
  for (const cue of timeline.events) {
    const track = tracks.find((item) => item.id === cue.track.id)!;
    const pitches = cue.event.technique === "strum-up" ? [...cue.pitches].reverse() : cue.pitches;
    pitches.forEach((pitch, i) => player.play(pitch, Math.max(0, cue.at) + (cue.event.kind === "chord" ? i * (cue.event.strumSeconds ?? .012) : 0), cue.duration, track.instrument, cue.event.accent, track, cue.event.technique, { ...cue.event, targetMidi: cue.event.connectedTo ? timeline.events.find((next) => next.track.id === track.id && next.event.id === cue.event.connectedTo)?.pitches[0] : undefined }));
  }
  return encodeWav(await context.startRendering());
}
