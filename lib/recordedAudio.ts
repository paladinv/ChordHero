const buffersByContext = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer | null>>>();

export function loadRecordedAudio(context: AudioContext, path: string) {
  let contextCache = buffersByContext.get(context);
  if (!contextCache) {
    contextCache = new Map();
    buffersByContext.set(context, contextCache);
  }

  const cached = contextCache.get(path);
  if (cached) return cached;

  const pending = fetch(path)
    .then((response) => {
      if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .catch(() => null);

  contextCache.set(path, pending);
  return pending;
}

type ClickOptions = {
  accent?: boolean;
  volume?: number;
  when?: number;
};

export async function playRecordedClick(
  context: AudioContext,
  { accent = false, volume = 0.24, when }: ClickOptions = {}
) {
  const buffer = await loadRecordedAudio(context, "/audio/percussion/hi-hat-close.wav");
  if (!buffer) return false;

  const source = context.createBufferSource();
  const gain = context.createGain();
  const now = Math.max(context.currentTime, when ?? context.currentTime);

  source.buffer = buffer;
  source.playbackRate.value = accent ? 1.08 : 0.88;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(accent ? volume * 1.25 : volume, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (accent ? 0.18 : 0.14));
  source.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  return true;
}

const STRING_SAMPLE: Record<number, number> = {
  6: 40,
  5: 45,
  4: 48,
  3: 54,
  2: 60,
  1: 63
};

const CONTEXT_SAMPLE: Record<string, number> = {
  G: 42,
  C: 48,
  Am: 45
};

const CHORD_ROOT: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

function samplePath(midi: number) {
  return `/samples/guitar/clean/${midi}.mp3`;
}

export async function preloadRightHandAudio(context: AudioContext) {
  await Promise.all([
    loadRecordedAudio(context, "/audio/percussion/hi-hat-close.wav"),
    loadRecordedAudio(context, "/samples/guitar/muted.mp3"),
    ...Object.values(STRING_SAMPLE).map((midi) => loadRecordedAudio(context, samplePath(midi))),
    ...Object.values(CONTEXT_SAMPLE).map((midi) => loadRecordedAudio(context, samplePath(midi)))
  ]);
}

type GuitarStepOptions = {
  token: string;
  technique: "strumming" | "plectrum" | "fingerpicking";
  accent?: boolean;
  volume?: number;
  when?: number;
  targetSound?: "acoustic-strum" | "muted-funk" | "fingerstyle" | "clean-electric";
};

export async function playRecordedGuitarStep(
  context: AudioContext,
  { token, technique, accent = false, volume = 0.2, when, targetSound = "clean-electric" }: GuitarStepOptions
) {
  if (token === "·") return false;
  const clean = token.replace("!", "");
  const stringNumber = Number(clean.match(/\d/)?.[0] ?? (technique === "strumming" ? 4 : 3));
  const path = clean === "X" || targetSound === "muted-funk" ? "/samples/guitar/muted.mp3" : samplePath(STRING_SAMPLE[stringNumber] ?? 54);
  const buffer = await loadRecordedAudio(context, path);
  if (!buffer) return false;

  const source = context.createBufferSource();
  const gain = context.createGain();
  const tone = context.createBiquadFilter();
  const now = Math.max(context.currentTime, when ?? context.currentTime);
  source.buffer = buffer;
  source.playbackRate.value = targetSound === "acoustic-strum" ? 0.94 : targetSound === "fingerstyle" ? 1.02 : technique === "strumming" ? 0.96 : 1;
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(targetSound === "muted-funk" ? 2400 : targetSound === "acoustic-strum" ? 5200 : targetSound === "fingerstyle" ? 4200 : 7600, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(accent ? volume * 1.25 : volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (clean === "X" || targetSound === "muted-funk" ? 0.13 : targetSound === "fingerstyle" ? 0.5 : 0.42));
  source.connect(tone);
  tone.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  return true;
}

export async function playRecordedBackingPulse(
  context: AudioContext,
  chord: string,
  when: number,
  volume = 0.1
) {
  const directSample = CONTEXT_SAMPLE[chord];
  const rootName = chord.match(/^([A-G](?:#|b)?)/)?.[1] ?? "C";
  const root = CHORD_ROOT[rootName] ?? 0;
  const sourceMidi = directSample ?? 48;
  const targetMidi = 48 + root;
  const buffer = await loadRecordedAudio(context, samplePath(sourceMidi));
  if (!buffer) return false;
  const source = context.createBufferSource();
  const gain = context.createGain();
  const now = Math.max(context.currentTime, when);
  source.buffer = buffer;
  source.playbackRate.value = directSample ? 1 : 2 ** ((targetMidi - sourceMidi) / 12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
  source.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  return true;
}
