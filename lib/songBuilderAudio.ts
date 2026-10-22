import { loadRecordedAudio } from "./recordedAudio";
import type { SongInstrument, SongCompositionTrack, SongCompositionEvent } from "./songLibrary";

const SAMPLE_NOTES = [37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 86];
const sampleFor = (midi: number) => SAMPLE_NOTES.reduce((best, candidate) => Math.abs(candidate - midi) < Math.abs(best - midi) ? candidate : best, SAMPLE_NOTES[0]);

export type SongBuilderAudio = {
  context: AudioContext;
  prepare: (midiNotes: number[], percussion?: boolean, instruments?: SongInstrument[]) => Promise<void>;
  play: (midi: number, when: number, duration: number, instrument: SongInstrument, accent?: boolean, track?: SongCompositionTrack, technique?: SongCompositionEvent["technique"], expression?: SongCompositionEvent & { targetMidi?: number }) => void;
  click: (when: number, accent?: boolean) => void;
  updateMix: (tracks: SongCompositionTrack[]) => void;
  stop: () => void;
  close: () => void;
};

type OfflineSongBuilderAudio = Omit<SongBuilderAudio, "context"> & { context: OfflineAudioContext };
export function createSongBuilderAudio(): SongBuilderAudio;
export function createSongBuilderAudio(context: OfflineAudioContext): OfflineSongBuilderAudio;
export function createSongBuilderAudio(provided?: OfflineAudioContext): Omit<SongBuilderAudio, "context"> & { context: AudioContext | OfflineAudioContext } {
  const context = provided ?? new AudioContext();
  const buffers = new Map<number, AudioBuffer | null>();
  let closedHatBuffer: AudioBuffer | null = null;
  const active = new Set<AudioScheduledSourceNode>();
  const mixers = new Map<string, { volume: GainNode; panner: StereoPannerNode; reverb: GainNode }>();
  const mixerFor = (track: SongCompositionTrack) => {
    let bus = mixers.get(track.id);
    if (!bus) {
      const volume = context.createGain(); const panner = context.createStereoPanner(); const convolver = context.createConvolver(); const reverb = context.createGain();
      const impulseLength = Math.max(1, Math.floor(context.sampleRate * 1.1));
      const impulse = context.createBuffer(2, impulseLength, context.sampleRate);
      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const samples = impulse.getChannelData(channel);
        for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2.8;
      }
      convolver.buffer = impulse; volume.connect(panner); volume.connect(convolver); convolver.connect(reverb); reverb.connect(panner); panner.connect(context.destination);
      bus = { volume, panner, reverb }; mixers.set(track.id, bus);
    }
    return bus;
  };
  const trackSource = (source: AudioScheduledSourceNode) => {
    active.add(source);
    source.addEventListener("ended", () => { active.delete(source); source.disconnect(); }, { once: true });
  };
  const load = async (sampleMidi: number) => {
    const cached = buffers.get(sampleMidi);
    if (cached !== undefined) return cached;
    const buffer = await loadRecordedAudio(context, `/samples/guitar/clean/${sampleMidi}.mp3`);
    buffers.set(sampleMidi, buffer);
    return buffer;
  };
  const playPercussion = (midi: number, when: number, accent: boolean, track?: SongCompositionTrack) => {
    const start = Math.max(context.currentTime, when);
    const output = track ? mixerFor(track).volume : context.destination;
    const level = accent ? 0.32 : 0.24;
    const isKick = midi === 35 || midi === 36;
    const isHat = midi === 42 || midi === 44 || midi === 46;
    const isCymbal = [49, 51, 52, 53, 55, 57, 59].includes(midi);
    const isTom = midi >= 45 && midi <= 50;
    if (midi === 42 && closedHatBuffer) {
      const source = context.createBufferSource();
      const envelope = context.createGain();
      source.buffer = closedHatBuffer;
      source.playbackRate.setValueAtTime(1, start);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(level, start + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      source.connect(envelope); envelope.connect(output);
      trackSource(source); source.start(start); source.stop(start + 0.14);
      return;
    }
    if (isKick || isTom) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const baseFrequency = isKick ? (midi === 35 ? 105 : 130) : 80 + (midi - 45) * 22;
      const decay = isKick ? 0.22 : 0.16;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(baseFrequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(isKick ? 42 : 62, start + decay);
      envelope.gain.setValueAtTime(Math.max(0.0001, level), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      oscillator.connect(envelope); envelope.connect(output);
      trackSource(oscillator); oscillator.start(start); oscillator.stop(start + decay + 0.015);
      return;
    }
    const decay = isHat ? midi === 46 ? 0.42 : 0.075 : isCymbal ? 0.55 : 0.16;
    const noiseBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * decay)), context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    const noise = context.createBufferSource(); noise.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = isHat || isCymbal ? "highpass" : "bandpass";
    filter.frequency.value = isHat ? 6500 : isCymbal ? 4200 : midi === 39 ? 1500 : 1900;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(Math.max(0.0001, level * (isCymbal ? 0.65 : 0.85)), start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    noise.connect(filter); filter.connect(envelope); envelope.connect(output);
    trackSource(noise); noise.start(start); noise.stop(start + decay);
  };

  return {
    context,
    updateMix(tracks) {
      const solo = tracks.some((track) => track.solo);
      for (const track of tracks) {
        const existing = mixers.has(track.id);
        const bus = mixerFor(track);
        const value = track.muted || solo && !track.solo ? 0 : track.volume ?? 1;
        if(existing) bus.volume.gain.setTargetAtTime(value, context.currentTime, 0.015);
        else bus.volume.gain.setValueAtTime(value, context.currentTime);
        bus.panner.pan.setTargetAtTime(track.pan ?? 0, context.currentTime, 0.015);
        const wet = Math.max(0, Math.min(.28, (track.reverb ?? 0) * .28));
        if (existing) bus.reverb.gain.setTargetAtTime(wet, context.currentTime, .025);
        else bus.reverb.gain.setValueAtTime(wet, context.currentTime);
      }
    },
    async prepare(midiNotes, percussion = false, instruments) {
      const needsGuitarSamples = !instruments || instruments.some((instrument) => instrument === "guitar" || instrument === "ukulele");
      const samples = needsGuitarSamples ? [...new Set(midiNotes.filter(Number.isFinite).map(sampleFor))] : [];
      await Promise.all([...samples.map(load), ...(percussion ? [loadRecordedAudio(context, "/audio/percussion/hi-hat-close.wav").then((buffer) => { closedHatBuffer = buffer; })] : [])]);
      if (context instanceof AudioContext && context.state === "suspended") await context.resume();
    },
    play(midi, when, duration, instrument, accent = false, track, technique, expression) {
      if (instrument === "percussion") {
        if (!track || !track.muted) playPercussion(midi, when, accent, track);
        return;
      }
      const start = Math.max(context.currentTime, when);
      const end = start + Math.max(0.09, Math.min(64, technique === "palm-mute" ? duration * 0.35 : expression?.articulation === "staccato" ? duration * 0.5 : duration));
      const sampleMidi = sampleFor(midi);
      const buffer = instrument === "bass" || instrument === "piano" || instrument === "vocals" ? null : buffers.get(sampleMidi);
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = instrument === "vocals" ? "bandpass" : "lowpass";
      filter.frequency.setValueAtTime(track?.sound === "warm" ? 1800 : track?.sound === "bright" ? 10000 : instrument === "bass" ? 620 : instrument === "ukulele" ? 7600 : instrument === "vocals" ? 1450 : 5400, start);
      gain.gain.setValueAtTime(0.0001, start);
      const dynamics = { pp: .3, p: .45, mp: .6, mf: .75, f: .9, ff: 1 };
      const intensity = (expression?.velocity ?? .75) / .75 * (expression?.dynamic ? dynamics[expression.dynamic] : 1);
      const target = expression?.targetMidi ?? (technique === "slide" && expression?.slideToFret !== undefined && track && expression.string ? track.tuning[track.tuning.length - expression.string] + track.capo + expression.slideToFret : midi + (expression?.bendSemitones ?? 2));
      const shift = (technique === "hammer-on" || technique === "pull-off") && expression?.targetMidi === undefined ? 0 : target - midi;
      const legato = technique === "hammer-on" || technique === "pull-off";
      const peak = (accent ? 0.26 : instrument === "bass" ? 0.22 : 0.2) * (legato ? 0.65 : 1) * intensity;
      gain.gain.exponentialRampToValueAtTime(peak, start + (legato ? 0.025 : 0.012));
      if (instrument === "bass") gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(end, start + Math.max(0.16, Math.min(0.42, duration * 0.55))));
      else gain.gain.setTargetAtTime(0.0001, instrument === "piano" ? Math.min(end, start + 0.13) : Math.max(start + 0.025, end - 0.12), instrument === "piano" ? 0.22 : 0.045);
      filter.connect(gain);
      if (track) gain.connect(mixerFor(track).volume); else gain.connect(context.destination);
      if (buffer && track?.sound !== "synth") {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(2 ** ((midi - sampleMidi) / 12), start);
        if (technique === "bend" || technique === "slide" || legato) source.playbackRate.exponentialRampToValueAtTime(2 ** ((midi - sampleMidi + shift) / 12), start + Math.min(0.25, duration / 2));
        if (technique === "vibrato") { const lfo = context.createOscillator(); const depth = context.createGain(); lfo.frequency.value = 5; depth.gain.value = 18; lfo.connect(depth); depth.connect(source.detune); trackSource(lfo); lfo.start(start); lfo.stop(end); }
        source.connect(filter);
        trackSource(source);
        source.start(start);
        source.stop(end + 0.2);
      } else {
        const source = context.createOscillator();
        source.type = instrument === "vocals" || instrument === "bass" ? "sawtooth" : instrument === "piano" ? "triangle" : "triangle";
        source.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), start);
        if (technique === "bend" || technique === "slide" || legato) source.frequency.exponentialRampToValueAtTime(440 * 2 ** ((midi - 69 + shift) / 12), start + Math.min(0.25, duration / 2));
        if (technique === "vibrato") { const lfo = context.createOscillator(); const depth = context.createGain(); lfo.frequency.value = 5; depth.gain.value = 18; lfo.connect(depth); depth.connect(source.detune); trackSource(lfo); lfo.start(start); lfo.stop(end); }
        source.connect(filter);
        trackSource(source);
        source.start(start);
        source.stop(end + 0.03);
        if (instrument === "vocals") {
          const overtone = context.createOscillator();
          const overtoneGain = context.createGain();
          overtone.type = "triangle";
          overtone.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12) * 2, start);
          overtone.detune.setValueAtTime(7, start);
          overtoneGain.gain.setValueAtTime(0.0001, start);
          overtoneGain.gain.exponentialRampToValueAtTime(0.035 * intensity, start + 0.035);
          overtoneGain.gain.setTargetAtTime(0.0001, Math.max(start + 0.05, end - 0.12), 0.08);
          overtone.connect(filter);
          trackSource(overtone);
          overtone.start(start);
          overtone.stop(end + 0.03);
        }
        if (instrument === "piano") {
          const overtone = context.createOscillator();
          const overtoneGain = context.createGain();
          overtone.type = "triangle";
          overtone.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12) * 2.01, start);
          overtoneGain.gain.setValueAtTime(0.0001, start);
          overtoneGain.gain.exponentialRampToValueAtTime(0.045 * intensity, start + 0.012);
          overtoneGain.gain.exponentialRampToValueAtTime(0.0001, Math.max(start + 0.02, Math.min(end, start + 0.65)));
          overtone.connect(overtoneGain);
          overtoneGain.connect(track ? mixerFor(track).volume : context.destination);
          trackSource(overtone);
          overtone.start(start);
          overtone.stop(Math.max(start + 0.02, end));
        }
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
      if (context instanceof AudioContext) void context.close();
    },
  };
}
