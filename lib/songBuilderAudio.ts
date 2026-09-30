import { loadRecordedAudio } from "./recordedAudio";
import type { SongInstrument } from "./songLibrary";

const SAMPLE_NOTES = [37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 86];
const sampleFor = (midi: number) => SAMPLE_NOTES.reduce((best, candidate) => Math.abs(candidate - midi) < Math.abs(best - midi) ? candidate : best, SAMPLE_NOTES[0]);

export type SongBuilderAudio = {
  context: AudioContext;
  prepare: (midiNotes: number[]) => Promise<void>;
  play: (midi: number, when: number, duration: number, instrument: SongInstrument, accent?: boolean) => void;
  click: (when: number, accent?: boolean) => void;
  stop: () => void;
  close: () => void;
};

export function createSongBuilderAudio(): SongBuilderAudio {
  const context = new AudioContext();
  const buffers = new Map<number, AudioBuffer | null>();
  const active = new Set<AudioScheduledSourceNode>();
  const trackSource = (source: AudioScheduledSourceNode) => {
    active.add(source);
    source.addEventListener("ended", () => active.delete(source), { once: true });
  };
  const load = async (sampleMidi: number) => {
    const cached = buffers.get(sampleMidi);
    if (cached !== undefined) return cached;
    const buffer = await loadRecordedAudio(context, `/samples/guitar/clean/${sampleMidi}.mp3`);
    buffers.set(sampleMidi, buffer);
    return buffer;
  };

  return {
    context,
    async prepare(midiNotes) {
      const samples = [...new Set(midiNotes.filter(Number.isFinite).map(sampleFor))];
      await Promise.all(samples.map(load));
      if (context.state === "suspended") await context.resume();
    },
    play(midi, when, duration, instrument, accent = false) {
      const start = Math.max(context.currentTime, when);
      const end = start + Math.max(0.09, Math.min(8, duration));
      const sampleMidi = sampleFor(midi);
      const buffer = buffers.get(sampleMidi);
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(instrument === "bass" ? 1900 : instrument === "ukulele" ? 7600 : 5400, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.26 : instrument === "bass" ? 0.18 : 0.2, start + 0.012);
      gain.gain.setTargetAtTime(0.0001, Math.max(start + 0.025, end - 0.12), 0.045);
      filter.connect(gain);
      gain.connect(context.destination);
      if (buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(2 ** ((midi - sampleMidi) / 12), start);
        source.connect(filter);
        trackSource(source);
        source.start(start);
        source.stop(end + 0.2);
      } else {
        const source = context.createOscillator();
        source.type = "triangle";
        source.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), start);
        source.connect(filter);
        trackSource(source);
        source.start(start);
        source.stop(end + 0.03);
      }
    },
    click(when, accent = false) {
      const start = Math.max(context.currentTime, when);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(accent ? 1180 : 820, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.13, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
      oscillator.connect(gain);
      gain.connect(context.destination);
      trackSource(oscillator);
      oscillator.start(start);
      oscillator.stop(start + 0.07);
    },
    stop() {
      active.forEach((source) => { try { source.stop(); } catch { /* already finished */ } });
      active.clear();
    },
    close() {
      active.forEach((source) => { try { source.stop(); } catch { /* already finished */ } });
      active.clear();
      void context.close();
    },
  };
}
