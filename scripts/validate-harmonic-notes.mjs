const NOTE_INDEX = new Map([
  ["C", 0], ["C#", 1], ["Db", 1], ["D", 2], ["D#", 3], ["Eb", 3], ["E", 4], ["F", 5],
  ["F#", 6], ["Gb", 6], ["G", 7], ["G#", 8], ["Ab", 8], ["A", 9], ["A#", 10], ["Bb", 10], ["B", 11]
]);
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
const EXPECTED_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
  minor7: [0, 3, 7, 10],
  major7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7]
};

const pitchClass = (midi) => ((midi % 12) + 12) % 12;

export function validateHarmonicNotes(entries, report = console.warn) {
  let complete = 0;
  let partial = 0;
  let bassWarnings = 0;
  for (const entry of entries) {
    const root = NOTE_INDEX.get(entry.root);
    const expected = EXPECTED_INTERVALS[entry.quality];
    if (root === undefined || !expected) {
      report(`Harmonic coverage note: ${entry.id} uses an unmapped quality or root (${entry.root}/${entry.quality}).`);
      partial += 1;
      continue;
    }
    const notes = entry.chord.frets.flatMap((fret, index) => fret < 0 ? [] : [pitchClass(OPEN_STRING_MIDI[index] + fret)]);
    const intervals = new Set(notes.map((note) => (note - root + 12) % 12));
    const missing = expected.filter((interval) => !intervals.has(interval));
    if (missing.length) {
      partial += 1;
      report(`Harmonic coverage note: ${entry.id} (${entry.chord.name}) omits interval(s) ${missing.join(", ")}; verify the partial voicing is intentional.`);
    } else {
      complete += 1;
    }

    if (entry.inversion === "inverted") {
      const bass = entry.chord.frets.findIndex((fret) => fret >= 0);
      const slashBass = entry.chord.name.split("/")[1];
      const slashBassClass = NOTE_INDEX.get(slashBass);
      if (bass < 0 || slashBassClass === undefined || pitchClass(OPEN_STRING_MIDI[bass] + entry.chord.frets[bass]) !== slashBassClass) {
        bassWarnings += 1;
        report(`Harmonic bass note: ${entry.id} is labeled ${entry.chord.name}, but its lowest sounding string does not match the slash bass.`);
      }
    }
  }
  return { total: entries.length, complete, partial, bassWarnings };
}
