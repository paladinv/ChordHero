import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  barreContactSpan,
  chordToLeftHandTargets,
  guitarFretContactZ,
  guitarFretPosition,
  guitarStringContactPoint,
  chooseManualFinger,
  GUITAR_BODY_LENGTH,
  GUITAR_BODY_LENGTH_INCHES,
  GUITAR_BODY_MAX_WIDTH,
  GUITAR_BODY_PROFILE_X_SCALE,
  GUITAR_BODY_RAW_PROFILE_WIDTH,
  GUITAR_FINGER_BONE_LENGTHS,
  GUITAR_NUT_OVERALL_WIDTH,
  GUITAR_NUT_STRING_SPREAD,
  GUITAR_SCALE_LENGTH,
  GUITAR_SCALE_INCHES,
  GUITAR_SADDLE_STRING_SPREAD,
  GUITAR_TWELFTH_FRET_BOARD_WIDTH,
  GUITAR_VISIBLE_FRET_COUNT,
  GUITAR_SOUND_HOLE_RADIUS,
  GUITAR_SOUND_HOLE_CENTER_Z,
  INCH_TO_WORLD,
  solveFingerChain,
  guitarStringXAt,
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
assert.ok(guitarStringXAt(0, -3.3) < guitarStringXAt(5, -3.3), "nut strings are ordered across the nut");
assert.ok(guitarStringXAt(5, 7.2) - guitarStringXAt(0, 7.2) > guitarStringXAt(5, -3.3) - guitarStringXAt(0, -3.3), "strings fan wider at the saddle");
assert.ok(guitarFretContactZ(5) < guitarFretPosition(5), "contact is nut-side of the wire");
assert.equal(guitarStringContactPoint(2, 3).x, guitarStringXAt(2, guitarFretContactZ(3)), "contact x follows tapered string geometry");
assert.ok(Math.abs(INCH_TO_WORLD - GUITAR_SCALE_LENGTH / GUITAR_SCALE_INCHES) < 1e-9, "inch conversion matches scale length");
assert.ok(GUITAR_NUT_STRING_SPREAD < GUITAR_NUT_OVERALL_WIDTH, "playable nut spread fits inside nut width");
assert.ok(GUITAR_TWELFTH_FRET_BOARD_WIDTH > GUITAR_NUT_OVERALL_WIDTH, "12th-fret board widens from nut");
assert.ok(GUITAR_SADDLE_STRING_SPREAD > GUITAR_NUT_STRING_SPREAD, "saddle spread widens from nut");
assert.ok(Math.abs(GUITAR_BODY_LENGTH - GUITAR_BODY_LENGTH_INCHES * INCH_TO_WORLD) < 1e-9, "body length uses converted inches");
assert.ok(Math.abs(GUITAR_BODY_RAW_PROFILE_WIDTH * GUITAR_BODY_PROFILE_X_SCALE - GUITAR_BODY_MAX_WIDTH) < 1e-9, "body profile scales to declared max width");
assert.equal(GUITAR_VISIBLE_FRET_COUNT, 20, "acoustic board renders twenty frets");
assert.ok(GUITAR_SOUND_HOLE_RADIUS > 0.7 && GUITAR_SOUND_HOLE_RADIUS < 0.95, "sound-hole aperture remains acoustic-scale");
assert.equal(GUITAR_SOUND_HOLE_CENTER_Z, 5.78, "sound-hole center remains on the soundboard reference plane");
assert.ok(Object.values(GUITAR_FINGER_BONE_LENGTHS).every((lengths) => lengths[0] > lengths[1] && lengths[1] > lengths[2]), "finger bones taper distally");
const chain = solveFingerChain({ x: -0.45, y: 1.05, z: -1.2 }, guitarStringContactPoint(2, 3), GUITAR_FINGER_BONE_LENGTHS.middle, 1);
assert.ok(chain.endpointError <= 0.01, "constrained chain converges to contact");
assert.ok(chain.points.slice(0, 3).every((point, index) => Math.abs(Math.hypot(chain.points[index + 1].x - point.x, chain.points[index + 1].y - point.y, chain.points[index + 1].z - point.z) - chain.lengths[index]) <= 0.01), "constrained chain preserves bone lengths");
const barreSpan = barreContactSpan(5, 0, 5);
assert.equal(barreSpan.start.z, barreSpan.end.z, "barre endpoints share the fret contact plane");
assert.equal(barreSpan.start.x, guitarStringXAt(0, barreSpan.z), "barre start follows tapered string");
assert.equal(barreSpan.end.x, guitarStringXAt(5, barreSpan.z), "barre end follows tapered string");
assert.deepEqual(chooseManualFinger(chordToLeftHandTargets({ frets: [1, 2, 3, 4, 5, 6], fingers: [1, 2, 3, 4, 1, 2] }), 5, 8), { finger: 4, owned: false, override: true }, "manual target overrides a visible finger when all four are occupied");
for (const [side, bytes, hash] of [["left", 94572, "bc67783144944ea1cda54d9247885825ea5fb9d4651469fe7d00be517a5c2b87"], ["right", 94004, "291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96"]]) {
  const buffer = readFileSync(`public/models/guitar-technique/${side}.glb`);
  assert.equal(buffer.length, bytes, `${side} authored hand byte size is stable`);
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", `${side} is a GLB asset`);
  assert.equal(buffer.readUInt32LE(4), 2, `${side} uses GLB version 2`);
  assert.equal(createHash("sha256").update(buffer).digest("hex"), hash, `${side} authored hand hash is stable`);
  const jsonLength = buffer.readUInt32LE(12); const json = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
  assert.equal(json.skins?.[0]?.joints?.length, 25, `${side} has the expected 25-joint skin`);
  const names = new Set((json.nodes ?? []).map((node) => node.name));
  const jointNames = (json.skins?.[0]?.joints ?? []).map((index) => json.nodes?.[index]?.name);
  assert.ok(jointNames.includes("wrist") && jointNames.includes("middle-finger-tip"), `${side} supports wrist-to-middle-tip calibration`);
  ["wrist", "thumb-metacarpal", "index-finger-metacarpal", "middle-finger-metacarpal", "ring-finger-metacarpal", "pinky-finger-metacarpal", "index-finger-tip", "middle-finger-tip", "ring-finger-tip", "pinky-finger-tip", "thumb-tip"].forEach((name) => assert.ok(names.has(name), `${side} exposes ${name}`));
}
console.log("Guitar technique 3D mapping validation passed.");
