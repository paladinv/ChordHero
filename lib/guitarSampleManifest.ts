export type GuitarSampleVoice = "steel" | "nylon" | "muted" | "picked";
export type GuitarSampleArticulation = "strum" | "arpeggio";
export type GuitarSampleLayer = { minVelocity: number; maxVelocity: number; pathTemplate: string };
export type GuitarSampleManifest = {
  schemaVersion: 1;
  fallbackRootDirectory: string;
  voices: Record<GuitarSampleVoice, { fallbackVoice: "clean" | "muted"; articulations: Record<GuitarSampleArticulation, GuitarSampleLayer[]> }>;
  voicings: Record<string, Partial<Record<GuitarSampleVoice, Partial<Record<GuitarSampleArticulation, GuitarSampleLayer[]>>>> >;
};

let manifestPromise: Promise<GuitarSampleManifest | null> | null = null;

export function loadGuitarSampleManifest(): Promise<GuitarSampleManifest | null> {
  if (!manifestPromise) manifestPromise = fetch("/samples/guitar/manifest.json").then((response) => response.ok ? response.json() as Promise<GuitarSampleManifest> : null).catch(() => null);
  return manifestPromise;
}

export function selectGuitarSamplePaths(manifest: GuitarSampleManifest, options: { voicingId?: string; voice: GuitarSampleVoice; articulation: GuitarSampleArticulation; velocity: number; midi: number }) {
  const voiceConfig = manifest.voices[options.voice];
  const voicingLayers = manifest.voicings[options.voicingId ?? ""]?.[options.voice]?.[options.articulation];
  const layers = voicingLayers?.length ? voicingLayers : voiceConfig?.articulations[options.articulation] ?? [];
  const layer = layers.find((candidate) => options.velocity >= candidate.minVelocity && options.velocity <= candidate.maxVelocity) ?? layers[0];
  if (!layer || !voiceConfig) return [];
  const path = layer.pathTemplate.replace(/\{midi\}/g, String(Math.max(0, Math.min(127, options.midi)))).replace(/\{voicing\}/g, options.voicingId ?? "default");
  return [path, `${manifest.fallbackRootDirectory}/${voiceConfig.fallbackVoice === "muted" ? "muted" : "clean"}.mp3`];
}
