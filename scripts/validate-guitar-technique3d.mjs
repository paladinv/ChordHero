import assert from "node:assert/strict";
import {
  chordToLeftHandTargets,
  guitarFretPosition,
  GUITAR_CAMERA_PRESETS,
  normalizeGuitarChord,
  techniqueToMotionPlan
} from "../lib/guitarTechnique3d.ts";

const chord = normalizeGuitarChord({
  name: "A barre",
  frets: [5, 7, 7, 6, 5, 5],
  barre: { fret: 5, from: 0, to: 5 }
});
assert.equal(chord.frets.length, 6, "chords always expose six strings");
assert.equal(chordToLeftHandTargets(chord).filter((target) => target.barre).length, 3, "barre targets only fretted strings within its declared span");
assert.deepEqual(techniqueToMotionPlan("strumming", 1).direction, "up", "strumming alternates direction");
assert.deepEqual(techniqueToMotionPlan("plectrum", 0, [7]).strings, [0], "single picking bounds an invalid string selection");
assert.deepEqual(techniqueToMotionPlan("fingerpicking", 0, [0, 2, 4]).fingers, [1, 2, 3], "fingerpicking assigns independent fingers");
assert.equal(guitarFretPosition(0), -3.3, "the nut is fret zero");
assert.ok(guitarFretPosition(12) > guitarFretPosition(11), "fret positions increase toward the body");
assert.ok(guitarFretPosition(12) - guitarFretPosition(0) < guitarFretPosition(24) - guitarFretPosition(0), "fret spacing follows logarithmic scale math");
assert.deepEqual(Object.keys(GUITAR_CAMERA_PRESETS), ["overview", "fretting", "picking"], "camera presets remain available");
console.log("Guitar technique 3D mapping validation passed.");
