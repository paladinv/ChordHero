export type NoteSpelling = "current" | "sharps" | "flats";

export function spellPitchClass(pitch: number, preference: NoteSpelling = "current") {
  const sharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flat = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const current = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const names = preference === "sharps" ? sharp : preference === "flats" ? flat : current;
  return names[((pitch % 12) + 12) % 12];
}
