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
};

export async function playRecordedClick(
  context: AudioContext,
  { accent = false, volume = 0.24 }: ClickOptions = {}
) {
  const buffer = await loadRecordedAudio(context, "/audio/percussion/hi-hat-close.wav");
  if (!buffer) return false;

  const source = context.createBufferSource();
  const gain = context.createGain();
  const now = context.currentTime;

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
