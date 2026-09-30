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
  guitarPresetForMode,
  AUTHORED_HAND_LENGTH_INCHES,
  AUTHORED_HAND_POSE_LIMITS,
  AUTHORED_HAND_TARGET_BASIS,
  AUTHORED_HAND_ROLE_FORWARD,
  AUTHORED_HAND_WRIST_TARGET_Y,
  AUTHORED_PICK_DIMENSIONS_MM,
  authoredHandForward,
  normalizeGuitarChord,
  techniqueToMotionPlan
} from "../lib/guitarTechnique3d.ts";
import { authoredHandReadyState, authoredMeshDrawableState } from "../components/guitar3d/authoredHandValidation.ts";

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
for (const [side, bytes, hash] of [["left", 94572, "bc67783144944ea1cda54d9247885825ea5fb9d4651469fe7d00be517a5c2b87"], ["right", 94004, "291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96"]]) {
  const buffer = readFileSync(`public/models/guitar-technique/${side}.glb`);
  assert.equal(buffer.length, bytes, `${side} authored hand byte size is stable`);
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", `${side} is a GLB asset`);
  assert.equal(buffer.readUInt32LE(4), 2, `${side} uses GLB version 2`);
  assert.equal(createHash("sha256").update(buffer).digest("hex"), hash, `${side} authored hand hash is stable`);
  const jsonLength = buffer.readUInt32LE(12); const json = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
  assert.equal(json.meshes?.length, 1, `${side} has one hand mesh`);
  assert.equal(json.meshes?.[0]?.primitives?.length, 1, `${side} has one drawable primitive`);
  const primitive = json.meshes[0].primitives[0];
  assert.equal(primitive.material, 0, `${side} primitive uses its authored material`);
  assert.equal(json.materials?.length, 1, `${side} uses one material without groups`);
  assert.equal(json.accessors?.[primitive.attributes.POSITION]?.count, 1360, `${side} position accessor is populated`);
  assert.equal(json.accessors?.[primitive.indices]?.count, 6942, `${side} index accessor is populated`);
  assert.equal(authoredMeshDrawableState({ isSkinnedMesh: true, hasMaterial: true, materialCount: 1, groupCount: 0, positionCount: 1360, indexCount: 6942 }), true, `${side} zero-group single-material mesh remains drawable`);
  assert.equal(authoredMeshDrawableState({ isSkinnedMesh: true, hasMaterial: true, materialCount: 2, groupCount: 0, positionCount: 1360, indexCount: 6942 }), false, `${side} rejects ungrouped multi-material meshes`);
  assert.equal(authoredMeshDrawableState({ isSkinnedMesh: true, hasMaterial: true, materialCount: 2, groupCount: 2, positionCount: 1360, indexCount: 6942 }), true, `${side} accepts grouped multi-material meshes`);
  assert.equal(authoredHandReadyState({ drawable: true, bounds: { min: [-1, 0, -1], max: [1, 2, 1] }, sceneRegion: { min: [-2, -1, -2], max: [2, 3, 2] } }), true, `${side} finite authored bounds are ready`);
  assert.equal(authoredHandReadyState({ drawable: true, bounds: { min: [Number.NaN, 0, 0], max: [1, 2, 1] }, sceneRegion: { min: [-2, -1, -2], max: [2, 3, 2] } }), false, `${side} rejects non-finite authored bounds`);
  assert.equal(authoredHandReadyState({ drawable: true, bounds: { min: [20, 0, 0], max: [21, 2, 1] }, sceneRegion: { min: [-2, -1, -2], max: [2, 3, 2] } }), false, `${side} rejects out-of-region authored bounds`);
  assert.equal(json.skins?.[0]?.joints?.length, 25, `${side} has the expected 25-joint skin`);
  const names = new Set((json.nodes ?? []).map((node) => node.name));
  const jointNames = (json.skins?.[0]?.joints ?? []).map((index) => json.nodes?.[index]?.name);
  const expectedJointNames = [
    "wrist",
    "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip",
    ...["index-finger", "middle-finger", "ring-finger", "pinky-finger"].flatMap((finger) => [
      `${finger}-metacarpal`, `${finger}-phalanx-proximal`, `${finger}-phalanx-intermediate`, `${finger}-phalanx-distal`, `${finger}-tip`
    ])
  ];
  assert.deepEqual(new Set(jointNames), new Set(expectedJointNames), `${side} uses the canonical 25-joint hand schema`);
  assert.ok(!names.has("thumb-phalanx-intermediate"), `${side} does not require a nonexistent thumb-intermediate joint`);
  assert.ok(jointNames.includes("wrist") && jointNames.includes("middle-finger-tip"), `${side} supports wrist-to-middle-tip calibration`);
  ["wrist", "thumb-metacarpal", "index-finger-metacarpal", "middle-finger-metacarpal", "ring-finger-metacarpal", "pinky-finger-metacarpal", "index-finger-tip", "middle-finger-tip", "ring-finger-tip", "pinky-finger-tip", "thumb-tip"].forEach((name) => assert.ok(names.has(name), `${side} exposes ${name}`));
}
const rendererSource = readFileSync("components/GuitarTechnique3D.tsx", "utf8");
const professionalSource = readFileSync("components/guitar3d/professionalAcousticGuitar.ts", "utf8");
const authoredSource = readFileSync("components/guitar3d/authoredHands.ts", "utf8");
assert.equal((rendererSource.match(/createProfessionalAcousticGuitar\(renderer\)/g) ?? []).length, 1, "renderer instantiates the professional guitar exactly once");
assert.doesNotMatch(rendererSource, /bodyPart\(|taperedPrism\(|makeWoodGrainTexture|new THREE\.InstancedMesh\(fretGeometry/, "legacy guitar construction is absent from the renderer");
assert.match(professionalSource, /new THREE\.InstancedMesh\(fretGeometry, fretMaterial, GUITAR_VISIBLE_FRET_COUNT\)/, "frets remain a twenty-instance draw");
assert.match(professionalSource, /for \(let string = 0; string < 6; string \+= 1\)/, "professional engine keeps six guitar strings");
assert.match(rendererSource, /setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)\)/, "renderer caps device pixel ratio");
assert.match(rendererSource, /if \(!disposed && inViewport && documentVisible\) renderer\.render\(scene, camera\)/, "renderer remains event-driven and viewport/visibility gated");
assert.match(professionalSource, /makeRadiusedBoardGeometry/, "fretboard uses a genuinely radiused surface");
assert.match(professionalSource, /makeTaperedBindingRailGeometry/, "binding follows tapered radiused fretboard edges");
assert.match(professionalSource, /new THREE\.ShapeGeometry\(bodyOutline\(true\)/, "soundboard uses an explicit triangulated skin with an aperture");
assert.match(professionalSource, /geometry\.scale\(GUITAR_BODY_PROFILE_X_SCALE, GUITAR_BODY_LENGTH \/ 8\.1, 1\)/, "soundboard longitudinal scale matches the shell orientation");
assert.match(professionalSource, /geometry\.rotateX\(Math\.PI \/ 2\)/, "soundboard skin follows the shell transform");
assert.doesNotMatch(professionalSource, /geometry\.scale\(GUITAR_BODY_PROFILE_X_SCALE, -GUITAR_BODY_LENGTH/, "soundboard avoids a negative longitudinal determinant");
assert.match(professionalSource, /new Uint8Array\(WOOD_TEXTURE_SIZE \* WOOD_TEXTURE_SIZE \* 4\)/, "procedural wood uses an explicit RGBA buffer");
assert.match(professionalSource, /new THREE\.DataTexture\(data, WOOD_TEXTURE_SIZE, WOOD_TEXTURE_SIZE, THREE\.RGBAFormat\)/, "procedural wood declares RGBA texture format");
assert.match(professionalSource, /data\[offset \+ 3\] = 255/, "procedural wood initializes opaque alpha");
assert.match(professionalSource, /woodTexture\(0xf1cf9f, 0xc48a55, true\)/, "soundboard palette is light warm spruce");
assert.match(professionalSource, /woodTexture\(0x5d2f25, 0x261614, false\)/, "shell palette is restrained dark mahogany");
assert.match(professionalSource, /color: 0xffffff, map: topTexture/, "soundboard texture carries warm spruce albedo without a dark multiplier");
assert.match(professionalSource, /new THREE\.Mesh\(makeSoundboardGeometry\(\), topMaterial\)/, "the visible top uses the one explicit soundboard skin");
assert.doesNotMatch(professionalSource, /bodyPart\(topMaterial/, "the visible top does not rely on an extruded cap");
assert.match(professionalSource, /bodyPart\(\[topMaterial, sideMaterial\]/, "deep shell caps use spruce while extruded side walls use mahogany");
assert.match(professionalSource, /ExtrudeGeometry uses material index 0 for caps and index 1 for walls/, "shell material grouping documents cap and side intent");
assert.match(professionalSource, /top\.position\.set\(0, 0, BODY_CENTER_Z\)/, "single soundboard skin sits above the deep shell");
assert.match(professionalSource, /makePerimeterBindingGeometry/, "purfling is a perimeter binding rather than a full-body overlay");
assert.match(professionalSource, /makeCrownedFretGeometry/, "frets use a normalized crowned geometry");
assert.match(professionalSource, /new THREE\.InstancedMesh\(fretGeometry, fretMaterial, GUITAR_VISIBLE_FRET_COUNT\)/, "professional frets remain instanced");
assert.match(authoredSource, /millimetersToWorld\(AUTHORED_PICK_DIMENSIONS_MM\.width\)/, "authored pick uses physical width conversion");
assert.match(authoredSource, /pick\.scale\.setScalar\(1 \/ Math\.max\(scale/, "authored pick cancels the calibrated hand-root scale");
assert.match(authoredSource, /export function splayAuthoredFingers/, "authored picking hand exposes a reusable finger-splay helper");
assert.match(authoredSource, /\[-0\.16, -0\.05, 0\.06, 0\.15\]/, "authored finger splay uses a conservative anatomical fan");
assert.match(authoredSource, /AUTHORED_HAND_POSE_LIMITS\.metacarpal/, "finger splay is clamped by the metacarpal pose limit");
assert.match(authoredSource, /color: 0xf0442d/, "authored plectrum uses a high-contrast red-orange material");
assert.match(rendererSource, /makePhysicalPickGeometry/, "fallback hand uses a rounded physical pick geometry");
assert.match(rendererSource, /fns\.splay\(rig\)/, "picking pose applies the authored finger splay");
assert.match(rendererSource, /const authoredThumbTipPosition = new THREE\.Vector3\(\)/, "authored thumb-tip placement vector is preallocated");
assert.match(rendererSource, /const authoredIndexTipPosition = new THREE\.Vector3\(\)/, "authored index-tip placement vector is preallocated");
assert.match(rendererSource, /thumbTip\.getWorldPosition\(authoredThumbTipPosition\)/, "authored plectrum reads the posed thumb tip in world space");
assert.match(rendererSource, /indexTip\.getWorldPosition\(authoredIndexTipPosition\)/, "authored plectrum reads the posed index tip in world space");
assert.match(rendererSource, /authoredPickPosition\.copy\(authoredThumbTipPosition\)\.add\(authoredIndexTipPosition\)\.multiplyScalar\(0\.5\)/, "authored plectrum uses the anatomical tip midpoint");
assert.match(rendererSource, /authoredPickPosition\.y \+= 0\.1; authoredPickPosition\.z \+= 0\.04/, "authored plectrum adds small contact clearance");
assert.doesNotMatch(rendererSource, /authoredPickPosition\.set\(guitarStringXAt/, "authored plectrum avoids guessed direct string placement");
assert.match(rendererSource, /right\.pick\.position\.set\(STRING_X\([\s\S]*?0\.72 -[\s\S]*?strumZ \+ 0\.5/, "fallback plectrum stays in the thumb-index tip zone above the strings");
assert.match(rendererSource, /rig\.root\.remove\(rig\.pick\)/, "authored plectrums detach from the calibrated hand root");
assert.match(rendererSource, /rig\.pick\.scale\.setScalar\(1\)/, "detached authored plectrums restore exact world scale");
assert.match(rendererSource, /rig\.pick\.position\.set\(0, 0, 0\)/, "detached authored plectrums reset inherited position");
assert.match(rendererSource, /rig\.pick\.quaternion\.identity\(\)/, "detached authored plectrums reset inherited orientation");
assert.match(rendererSource, /scene\.add\(rig\.pick\)/, "authored plectrums are added directly to scene world space");
assert.doesNotMatch(rendererSource, /scene\.attach\(rig\.pick\)/, "authored plectrums avoid compound attach decomposition");
assert.doesNotMatch(rendererSource, /rig\.root\.worldToLocal\(authoredPickPosition\)/, "detached authored plectrums use world-space placement");
assert.match(rendererSource, /rig\.pick\.rotation\.set\(0, handSign \*/, "detached authored plectrum keeps its broad face parallel to the soundboard");
assert.match(rendererSource, /rig\.pick\.visible = pickingVisible && plan\.kind === "pick"/, "authored plectrum visibility is route and technique gated");
assert.match(rendererSource, /rigs\.left\?\.pick\) rigs\.left\.pick\.visible = false/, "non-picking authored picks are hidden");
assert.doesNotMatch(rendererSource, /RELAXED_PICKING_FINGERS|plan\.kind !== "fingerpick"/, "inactive picking fingers retain their authored bind-pose spread");
assert.doesNotMatch(rendererSource, /if \(plan\.kind !== "pick"\) pose\("thumb"/, "strumming leaves the authored thumb in its bind pose");
assert.match(rendererSource, /if \(plan\.kind === "fingerpick"\).*pose\("thumb"/, "fingerpicking still actively assigns the thumb");
assert.match(rendererSource, /if \(plan\.kind === "pick"\) pose\("thumb"/, "plectrum still actively assigns the thumb for the pinch");
assert.match(rendererSource, /initialPresetRef = useRef<PresetName>\(guitarPresetForMode\(mode\)\)/, "React state derives the initial camera view from mode");
assert.match(rendererSource, /requestedPresetRef = useRef<PresetName>\(initialPresetRef\.current\)/, "requested camera preset starts with the mode-specific view");
assert.match(rendererSource, /GUITAR_CAMERA_PRESETS\[initialPresetRef\.current\]/, "scene initialization reads the stable mode preset ref");
console.log("Guitar technique 3D mapping validation passed.");
