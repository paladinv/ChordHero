import assert from "node:assert/strict";
import test from "node:test";
import { validateChordChartPitch } from "../../lib/chordChartPitch.ts";

const standard = ["E", "A", "D", "G", "B", "E"];
const cShape = [-1, 3, 2, 0, 1, 0];

test("standard C shape matches C major and ignores muted strings", () => {
  const result = validateChordChartPitch(cShape, standard, "C", "major");
  assert.equal(result.matches, true);
  assert.equal(result.partial, false);
  assert.deepEqual(result.extraNotes, []);
  assert.deepEqual(result.missingNotes, []);
  assert(!result.actualNotes.includes("X"));
});

test("capo transposes the expected chord identity", () => {
  const capoC = validateChordChartPitch(cShape, standard, "C", "major", 2);
  assert.equal(capoC.matches, true, "C shape with capo 2 sounds D major");
  assert.deepEqual(capoC.expectedNotes, ["D", "F#", "A"]);
  const incorrectlyLabelledD = validateChordChartPitch(cShape, standard, "D", "major", 2);
  assert.equal(incorrectlyLabelledD.matches, false, "calling the capo shape D would transpose it to E");
});

test("enharmonic tuning spellings resolve to the same pitch classes", () => {
  const enharmonic = validateChordChartPitch(
    [-1, 3, 2, 0, 1, 0],
    ["E", "A", "D", "G", "Cb", "E"],
    "C",
    "major",
  );
  assert.equal(enharmonic.matches, true);
  assert.deepEqual(enharmonic.extraNotes, []);
});

test("Drop-D changes an E-shape bass and reports the contradictory pitch", () => {
  const result = validateChordChartPitch([0, 2, 2, 1, 0, 0], ["D", "A", "D", "G", "B", "E"], "E", "major");
  assert.equal(result.matches, false);
  assert(result.extraNotes.includes("D"));
  assert.match(result.message, /extra note/i);
});

test("intentional partial voicings may omit root and fifth but not a quality tone", () => {
  const rootAndFifthOmitted = validateChordChartPitch([-1, -1, -1, -1, 5, -1], standard, "C", "major");
  assert.equal(rootAndFifthOmitted.matches, true);
  assert.equal(rootAndFifthOmitted.partial, true);
  assert.deepEqual(rootAndFifthOmitted.missingNotes, ["C", "G"]);

  const thirdOmitted = validateChordChartPitch([-1, -1, -1, 0, -1, -1], standard, "C", "major");
  assert.equal(thirdOmitted.matches, false);
  assert.equal(thirdOmitted.partial, false);
  assert(thirdOmitted.missingNotes.includes("E"));
});

test("rejects invalid tuning and malformed chart inputs clearly", () => {
  const invalidTuning = validateChordChartPitch(cShape, ["E", "H", "D", "G", "B", "E"], "C", "major");
  assert.equal(invalidTuning.matches, false);
  assert.match(invalidTuning.message, /Invalid tuning/);
  const invalidShape = validateChordChartPitch([0, 2.5], ["E", "A"], "C", "major");
  assert.equal(invalidShape.matches, false);
  assert.match(invalidShape.message, /Invalid fret/);
});

