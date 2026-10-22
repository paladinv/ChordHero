import assert from "node:assert/strict";
import test from "node:test";
import { chordQualityPitchClasses, filterVoicingsByBass, identifyChordShape, soundingShapeBassPitchClass, soundingShapePitchClasses, spellChordName } from "../../lib/chordChartShape.ts";

const item = (id, root, quality, name = root) => ({ id, root, quality, qualityLabel: quality, inversion: "standard", position: "Open shape", chord: { name, frets: [] }, difficultyTags: [], summary: "", recommendedVariant: "", alternateFingerings: [], functionContexts: [], mutingNotes: [], avoidStrings: [], nearbyAlternatives: [], practiceFocus: "" });

test("shape identity recognizes a capo-transposed open C shape", () => {
  const c = item("c", "C", "major");
  const report = identifyChordShape([-1, 3, 2, 0, 1, 0], ["E", "A", "D", "G", "B", "E"], 2, [c]);
  assert.equal(report.matches[0].entry.id, "c");
  assert.deepEqual(report.actualNotes, ["D", "F#", "A"]);
  assert.equal(report.bass, "D");
  assert.match(report.message, /root position/i);
});

test("shape identity reports an inversion bass and uncertainty when candidates tie", () => {
  const c = item("c", "C", "major", "C/G");
  const cAlt = item("c-alt", "C", "major", "C alternate");
  const report = identifyChordShape([3, 3, 2, 0, 1, 0], ["E", "A", "D", "G", "B", "E"], 0, [c, cAlt]);
  assert.equal(report.bass, "G");
  assert.equal(report.matches[0].bassRole, "fifth");
  assert.equal(report.uncertain, true);
});

test("sounding pitch helpers respect tuning and capo", () => {
  assert.deepEqual(soundingShapePitchClasses([0, 0, 0, 0, 0, 0], ["D", "A", "D", "G", "B", "E"], 2), [4, 11, 9, 1, 6]);
  assert.deepEqual(chordQualityPitchClasses("C", "major", 2), [2, 6, 9]);
});

test("spelling preference keeps key-aware default and can show both spellings", () => {
  assert.equal(spellChordName("A#", "F", "key-aware"), "Bb");
  assert.equal(spellChordName("Bb", "C", "sharp"), "A#");
  assert.equal(spellChordName("A#/C#", "C", "both"), "A#/C# (Bb/Db)");
});

test("bass helper follows capo and returns only matching local voicings", () => {
  const c = { id: "c", chord: { frets: [-1, 3, 2, 0, 1, 0] } };
  const g = { id: "g", chord: { frets: [3, 2, 0, 0, 0, 3] } };
  assert.equal(soundingShapeBassPitchClass(c.chord.frets, ["E", "A", "D", "G", "B", "E"], 2), 2);
  assert.deepEqual(filterVoicingsByBass([c, g], "D", ["E", "A", "D", "G", "B", "E"], 2).map((entry) => entry.id), ["c"]);
});

