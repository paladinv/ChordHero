import type { LibrarySong, SongSection, SongSectionBookmark } from "./songLibrary";

const PITCH: Record<string, number> = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const chordRoot = (value: string) => value.match(/^([A-G](?:#|b)?)/)?.[1];
const keyParts = (value: string) => {
  const match = value.trim().match(/^([A-G](?:#|b)?)(?:m|min)?$/i);
  const root = match?.[1];
  return root && PITCH[root] !== undefined ? { tonic: PITCH[root], minor: /(?:m|min)$/i.test(value.trim()) } : undefined;
};
function degree(pitch: number, tonic: number, scale: number[]) {
  const delta = (pitch - tonic + 12) % 12;
  let nearest = 0;
  let distance = 12;
  for (let index = 0; index < scale.length; index++) {
    const signed = ((delta - scale[index] + 18) % 12) - 6;
    if (Math.abs(signed) < Math.abs(distance)) { nearest = index; distance = signed; }
  }
  return { index: nearest, accidental: distance === 1 ? "#" : distance === -1 ? "b" : "" };
}

/** Convert one chord symbol to movable number and Roman-numeral notation. */
export function chordFunctionLabels(chord: string, key: string) {
  const keyInfo = keyParts(key);
  const match = chord.trim().match(/^([A-G](?:#|b)?)(.*)$/);
  if (!keyInfo || !match || PITCH[match[1]] === undefined) return { nashville: chord, roman: chord, inKey: false, explanation: "Could not determine this chord or key spelling." };
  const scale = keyInfo.minor ? MINOR : MAJOR;
  const inKey = scale.includes((PITCH[match[1]] - keyInfo.tonic + 12) % 12);
  const root = degree(PITCH[match[1]], keyInfo.tonic, scale);
  const quality = match[2].split("/")[0];
  const isMinor = /^(?:m(?!aj)|min)/i.test(quality);
  const isDiminished = /(?:dim|°)/i.test(quality);
  const isAugmented = /(?:aug|\+)/i.test(quality);
  const extension = quality.replace(/^(?:m|min)(?!aj)/i, "").replace(/(?:dim|°|aug|\+)/ig, "");
  const base = ROMAN[root.index];
  const numeral = root.accidental + (isMinor || isDiminished ? base.toLowerCase() : base);
  const number = String(root.index + 1);
  const qualityMark = isDiminished ? "°" : isAugmented ? "+" : isMinor ? "m" : "";
  const slashBass = chord.trim().split("/")[1];
  const bassRoot = slashBass && chordRoot(slashBass);
  const bassDegree = bassRoot && PITCH[bassRoot] !== undefined ? degree(PITCH[bassRoot], keyInfo.tonic, scale) : undefined;
  const nashville = `${root.accidental}${number}${qualityMark}${extension}${bassDegree ? `/${bassDegree.accidental}${bassDegree.index + 1}` : ""}`;
  const roman = `${numeral}${isDiminished ? "°" : isAugmented ? "+" : ""}${extension}${bassDegree ? `/${bassDegree.accidental}${ROMAN[bassDegree.index]}` : ""}`;
  return { nashville, roman, inKey, explanation: inKey ? `The root fits the ${keyInfo.minor ? "minor" : "major"} scale for ${key}.` : `The root is chromatic relative to the ${keyInfo.minor ? "minor" : "major"} scale for ${key}; the label uses its nearest scale degree.` };
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Spell chord roots consistently without changing quality, extensions, or slash-bass structure. */
export function spellChordName(chord: string, spelling: "key" | "sharps" | "flats", key: string): string {
  const useFlats = spelling === "flats" || spelling === "key" && /b/.test(keyParts(key) ? key.trim() : "");
  const names = useFlats ? FLAT_NAMES : SHARP_NAMES;
  return chord.replace(/(^|\/)([A-G](?:#|b)?)/g, (whole, boundary: string, note: string) => PITCH[note] === undefined ? whole : `${boundary}${names[PITCH[note]]}`);
}

/** Convert an audio tap series in media seconds to a robust median BPM estimate. */
export function estimateTempoFromTaps(mediaSeconds: number[]): number | undefined {
  const taps = mediaSeconds.filter(Number.isFinite).slice(-8);
  if (taps.length < 3) return undefined;
  const gaps = taps.slice(1).map((time, index) => time - taps[index]).filter((gap) => gap >= 0.25 && gap <= 2);
  if (gaps.length < 2) return undefined;
  gaps.sort((left, right) => left - right);
  const middle = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
  const bpm = Math.round(60 / median);
  return bpm >= 30 && bpm <= 240 ? bpm : undefined;
}

/** Song-clock position for a composition bookmark, used to align a local audio stem. */
export function songSecondsAtBookmark(song: LibrarySong, bookmark: SongSectionBookmark, bpm: number): number | undefined {
  const composition = song.composition;
  if (!composition || !Number.isFinite(bpm) || bpm < 30 || bpm > 240 || !bookmark.marker?.measure) return undefined;
  const targetIndex = composition.sections.findIndex((section) => section.id === bookmark.sectionId);
  if (targetIndex < 0) return undefined;
  const beatsPerBar = (signature: string | undefined) => Math.max(1, Math.min(32, Number(signature?.split("/")[0]) || 4));
  let totalBeats = 0;
  for (let index = 0; index <= targetIndex; index++) {
    const section = composition.sections[index];
    const measures = Math.max(0, ...Object.values(section.measuresByTrack).map((items) => items.length));
    const beats = beatsPerBar(section.timeSignature ?? composition.timeSignature);
    if (index === targetIndex) totalBeats += Math.max(0, bookmark.marker.measure - 1) * beats + Math.max(0, (bookmark.marker.beat ?? 1) - 1);
    else totalBeats += measures * beats * Math.max(1, section.repeats || 1);
  }
  return totalBeats * 60 / bpm;
}

/** Deterministic content checks. These flag review items; they never rewrite a song. */
export function auditSongArrangement(song: LibrarySong): string[] {
  const issues: string[] = [];
  const sections = song.sections ?? [];
  if (!sections.length) issues.push("Add at least one named section.");
  const ids = sections.map((section) => section.id);
  if (new Set(ids).size !== ids.length) issues.push("Section IDs repeat; bookmarks may point to the wrong section.");
  sections.forEach((section) => {
    const meaningful = section.blocks.some((block) => Boolean(block.text?.trim() || block.lines?.some((line) => line.trim()) || block.chords?.some((chord) => chord.trim())));
    if (!meaningful) issues.push(`${section.title}: section has no lyric, chord, tab, or note content.`);
    const chords = section.blocks.flatMap((block) => block.chords ?? (block.type === "chords" ? block.text?.split(/[\s|]+/) ?? [] : []));
    if (chords.some((chord) => !/^[A-G](?:#|b)?(?:(?:maj|min|m|dim|aug|sus|add|no|omit)?[0-9+#b°()]*)?(?:\/[A-G](?:#|b)?)?$/.test(chord.trim()))) issues.push(`${section.title}: review a chord symbol the validator could not recognize.`);
  });
  const composition = song.composition;
  if (composition) composition.sections.forEach((section) => {
    const counts = Object.values(section.measuresByTrack).map((measures) => measures.length);
    if (counts.length > 1 && counts.some((count) => count !== counts[0])) issues.push(`${section.title}: tracks have different measure counts.`);
    if (!sections.some((item) => item.id === section.id)) issues.push(`${section.title}: composition section is not linked to a song section.`);
  });
  if (!song.variations.length) issues.push("Add at least one practice variation.");
  const variationKeys = song.variations.map((variation) => `${variation.technique}:${variation.key}:${variation.timeSignature}:${variation.bpm}`);
  if (new Set(variationKeys).size < variationKeys.length) issues.push("Two variations share the same technique, key, meter, and tempo metadata.");
  return issues;
}

export type RecallPrompt = { sectionId: string; sectionTitle: string; question: string; answer: string };
export function buildSongRecallPrompts(song: LibrarySong, sectionId: string, kind: "lyrics" | "chords"): RecallPrompt[] {
  const section = song.sections.find((item) => item.id === sectionId);
  if (!section) return [];
  const answers = kind === "lyrics" ? lyricLines(section) : chordSequence(section);
  return answers.map((answer, index) => ({
    sectionId,
    sectionTitle: section.title,
    question: kind === "lyrics" ? `Recall lyric line ${index + 1} from ${section.title}.` : `Recall chord ${index + 1} in ${section.title}.`,
    answer,
  }));
}
function lyricLines(section: SongSection) {
  return section.blocks.flatMap((block) => block.type === "lyrics" ? (block.lines ?? block.text?.split(/\r?\n/) ?? []).map((line) => line.trim()).filter(Boolean) : []).slice(0, 100);
}
function chordSequence(section: SongSection) {
  const blockChords = section.blocks.flatMap((block) => block.type === "chords" ? block.chords ?? block.text?.split(/[\s|]+/) ?? [] : []);
  return [...new Set(blockChords.concat(section.blocks.flatMap((block) => block.type === "tab" ? block.chords ?? [] : [])).map((chord) => chord.trim()).filter(Boolean))].slice(0, 64);
}

