import assert from "node:assert/strict";
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
  guitarPresetForMode,
  AUTHORED_HAND_LENGTH_INCHES,
  AUTHORED_HAND_POSE_LIMITS,
  AUTHORED_HAND_TARGET_BASIS,
  AUTHORED_HAND_ROLE_FORWARD,
  AUTHORED_HAND_WRIST_TARGET_Y,
  AUTHORED_PICK_DIMENSIONS_MM,
  authoredHandForward,
  normalizeGuitarChord,
  techniqueToMotionPlan,
  rightHandTokenToMotionPlan,
  techniqueMotionContacts,
  techniqueContactPhase,
  GUITAR_TECHNIQUE_CLOSEUPS
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
assert.deepEqual(techniqueMotionContacts(rightHandTokenToMotionPlan("D!", "strumming")), [5, 4, 3, 2, 1, 0], "written downstroke crosses bass to treble");
assert.deepEqual(techniqueMotionContacts(rightHandTokenToMotionPlan("U", "strumming")), [0, 1, 2, 3, 4, 5], "written upstroke crosses treble to bass");
assert.deepEqual(rightHandTokenToMotionPlan("4U!", "plectrum").strings, [3], "written picking target uses its numbered string");
assert.equal(rightHandTokenToMotionPlan("4U!", "plectrum").direction, "up", "pick follows written direction independently of step parity");
assert.equal(rightHandTokenToMotionPlan("D!", "strumming").accent, true, "accent survives notation conversion");
assert.deepEqual(techniqueMotionContacts(rightHandTokenToMotionPlan("·", "strumming")), [], "rests make no contact");
assert.equal(rightHandTokenToMotionPlan("X", "strumming").mute, true, "muted step uses the muting pose");
assert.deepEqual(rightHandTokenToMotionPlan("P6+ima!", "fingerpicking").fingerAssignments, [{ finger: "thumb", string: 5 }, { finger: "index", string: 2 }, { finger: "middle", string: 1 }, { finger: "ring", string: 0 }], "pinch maps thumb and every named treble finger");
assert.deepEqual(rightHandTokenToMotionPlan("im2+3", "fingerpicking").fingerAssignments, [{ finger: "index", string: 1 }, { finger: "middle", string: 2 }], "compact pinch pairs written fingers and strings");
assert.deepEqual(rightHandTokenToMotionPlan("P6+i3", "fingerpicking").fingerAssignments, [{ finger: "thumb", string: 5 }, { finger: "index", string: 2 }], "each directly numbered finger keeps its target");
assert.equal(techniqueContactPhase(rightHandTokenToMotionPlan("D", "strumming"), 0), 1 / 12, "walkthrough contact centers agree with stroke string order");
assert.equal(techniqueContactPhase(rightHandTokenToMotionPlan("P6+ima", "fingerpicking"), 3), 0.5, "pinch contacts occur together");
assert.deepEqual(Object.keys(GUITAR_TECHNIQUE_CLOSEUPS), ["pick-grip", "thumb-independence", "palm-mute"], "right-hand close-ups leave legacy camera API intact");
assert.equal(guitarFretPosition(0), -3.3, "the nut is fret zero");
assert.ok(guitarFretPosition(12) > guitarFretPosition(11), "fret positions increase toward the body");
assert.ok(guitarFretPosition(12) - guitarFretPosition(0) < guitarFretPosition(24) - guitarFretPosition(0), "fret spacing follows logarithmic scale math");
assert.deepEqual(Object.keys(GUITAR_CAMERA_PRESETS), ["overview", "fretting", "picking"], "camera presets remain available");
assert.equal(guitarPresetForMode("right-hand"), "picking", "right-hand mode opens on the picking view");
assert.equal(guitarPresetForMode("left-hand"), "fretting", "left-hand mode opens on the fretting view");
assert.equal(guitarPresetForMode("both"), "overview", "both-hand mode opens on the overview view");
assert.ok(GUITAR_CAMERA_PRESETS.picking.position[1] >= 7 && GUITAR_CAMERA_PRESETS.picking.target[1] >= 0.5, "picking view stays top-down over the sound hole");
assert.ok(GUITAR_CAMERA_PRESETS.fretting.position[1] >= 6.5 && GUITAR_CAMERA_PRESETS.fretting.target[1] >= 0.4, "fretting view stays top-down over fingertip contacts");
assert.ok(guitarStringXAt(0, -3.3) < guitarStringXAt(5, -3.3), "nut strings are ordered across the nut");
assert.ok(guitarStringXAt(5, 7.2) - guitarStringXAt(0, 7.2) > guitarStringXAt(5, -3.3) - guitarStringXAt(0, -3.3), "strings fan wider at the saddle");
assert.ok(guitarFretContactZ(5) < guitarFretPosition(5), "contact is nut-side of the wire");
assert.equal(guitarStringContactPoint(2, 3).x, guitarStringXAt(2, guitarFretContactZ(3)), "contact x follows tapered string geometry");
assert.ok(Math.abs(INCH_TO_WORLD - GUITAR_SCALE_LENGTH / GUITAR_SCALE_INCHES) < 1e-9, "inch conversion matches scale length");
assert.equal(AUTHORED_HAND_LENGTH_INCHES, 7.55, "authored hand calibration remains 7.55 inches wrist-to-middle-tip");
assert.ok(AUTHORED_HAND_POSE_LIMITS.metacarpal < AUTHORED_HAND_POSE_LIMITS.proximal && AUTHORED_HAND_POSE_LIMITS.distal < AUTHORED_HAND_POSE_LIMITS.proximal, "joint limits keep metacarpals and distal joints conservative");
assert.deepEqual(AUTHORED_HAND_TARGET_BASIS.picking.forward, [0, 0, -1], "picking basis reaches toward the soundboard strings");
assert.deepEqual(AUTHORED_HAND_TARGET_BASIS.frettingRight.normal, [0, 1, 0], "fretting palm basis stays above the neck");
assert.equal(AUTHORED_PICK_DIMENSIONS_MM.width, 30, "pick width remains guitar-pick scale");
assert.equal(AUTHORED_PICK_DIMENSIONS_MM.height, 25, "pick height remains guitar-pick scale");
assert.ok(AUTHORED_PICK_DIMENSIONS_MM.width / 25.4 * INCH_TO_WORLD > 0.45, "pick width converts to physical scene scale");
assert.ok(AUTHORED_PICK_DIMENSIONS_MM.thickness / 25.4 * INCH_TO_WORLD < 0.04, "pick thickness stays thin in scene scale");
assert.deepEqual(authoredHandForward("fretting", "right"), AUTHORED_HAND_ROLE_FORWARD.fretting.rightHanded, "right-handed fretting hand reaches inward from the physical left edge");
assert.deepEqual(authoredHandForward("fretting", "left"), AUTHORED_HAND_ROLE_FORWARD.fretting.leftHanded, "left-handed fretting hand reaches inward from the physical right edge");
assert.deepEqual(authoredHandForward("picking", "right"), [0, 0, -1], "picking fingers reach toward the sound hole");
assert.ok(AUTHORED_HAND_WRIST_TARGET_Y.fretting > 0.5 && AUTHORED_HAND_WRIST_TARGET_Y.picking > 0.5, "authored wrists remain above the soundboard");
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
assert.equal(chain.reachable, true, "nearby contact is reachable");
assert.ok(chain.points.slice(0, 3).every((point, index) => Math.abs(Math.hypot(chain.points[index + 1].x - point.x, chain.points[index + 1].y - point.y, chain.points[index + 1].z - point.z) - chain.lengths[index]) <= 0.01), "constrained chain preserves bone lengths");
const unreachable = solveFingerChain({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, [0.4, 0.3, 0.2], 1);
assert.equal(unreachable.reachable, false, "far contact remains marked unreachable");
assert.ok(unreachable.endpointError > 0.01, "far contact exposes measurable error instead of contortion");
const barreSpan = barreContactSpan(5, 0, 5);
assert.equal(barreSpan.start.z, barreSpan.end.z, "barre endpoints share the fret contact plane");
assert.equal(barreSpan.start.x, guitarStringXAt(0, barreSpan.z), "barre start follows tapered string");
assert.equal(barreSpan.end.x, guitarStringXAt(5, barreSpan.z), "barre end follows tapered string");
assert.deepEqual(chooseManualFinger(chordToLeftHandTargets({ frets: [1, 2, 3, 4, 5, 6], fingers: [1, 2, 3, 4, 1, 2] }), 5, 8), { finger: 4, owned: false, override: true }, "manual target overrides a visible finger when all four are occupied");
console.log("Guitar technique 3D math validation passed.");
