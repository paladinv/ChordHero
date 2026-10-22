import qualityCatalog from "../shared/content/v1/chord-qualities.json";

export type ChordQualityDefinition = {
  id: string;
  label: string;
  suffix: string;
  aliases: readonly string[];
  intervals: readonly number[];
  essential: readonly number[];
  optional: readonly number[];
};

// Interval values are semitones above the chord root. Optional tones are colors,
// not missing-note failures for guitar voicings.
export const CHORD_QUALITIES: readonly ChordQualityDefinition[] = qualityCatalog;

export const CHORD_QUALITY_BY_ID = new Map(CHORD_QUALITIES.map((quality) => [quality.id, quality]));
const normalizedAlias = (value: string) => value.toLowerCase().replace(/[♭]/g, "b").replace(/[♯]/g, "#").replace(/[\s_]/g, "").replace(/(?<=[a-z])-(?=[a-z])/g, "");
export function chordQualityFromAlias(value: string): ChordQualityDefinition | undefined {
  const alias = normalizedAlias(value);
  return CHORD_QUALITIES.find((quality) => quality.aliases.some((candidate) => normalizedAlias(candidate) === alias));
}
export function chordQuality(value: string): ChordQualityDefinition | undefined {
  return CHORD_QUALITY_BY_ID.get(value) ?? chordQualityFromAlias(value);
}

