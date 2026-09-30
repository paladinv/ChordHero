import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { authoredHandForward, AUTHORED_HAND_LENGTH_INCHES, AUTHORED_HAND_POSE_LIMITS, AUTHORED_HAND_TARGET_BASIS, AUTHORED_PICK_DIMENSIONS_MM, GUITAR_SCALE_INCHES, INCH_TO_WORLD, type AuthoredHandRole, type FingerChainPoint, type GuitarHandedness } from "../../lib/guitarTechnique3d";
import { authoredHandReadyState, authoredMeshDrawableState } from "./authoredHandValidation";

export type AuthoredHandSide = "left" | "right";
type BindTransform = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 };
type HandBasis = { forward: THREE.Vector3; lateral: THREE.Vector3; normal: THREE.Vector3 };
export type AuthoredHandRig = {
  root: THREE.Group;
  bones: Map<string, THREE.Bone>;
  tips: Map<string, THREE.Bone>;
  bind: Map<string, BindTransform>;
  sourceLength: number;
  scale: number;
  tipError: number;
  pick: THREE.Mesh;
  sourceBasis: HandBasis;
};

const urls: Record<AuthoredHandSide, string> = {
  left: "/models/guitar-technique/left.glb",
  right: "/models/guitar-technique/right.glb"
};
const templates = new Map<AuthoredHandSide, Promise<THREE.Group>>();
const targetHandLength = AUTHORED_HAND_LENGTH_INCHES * INCH_TO_WORLD;
const scratchWrist = new THREE.Vector3();
const scratchMiddleTip = new THREE.Vector3();
const scratchBone = new THREE.Vector3();
const scratchTip = new THREE.Vector3();
const scratchTarget = new THREE.Vector3();
const scratchCurrentDirection = new THREE.Vector3();
const scratchTargetDirection = new THREE.Vector3();
const scratchBoneWorld = new THREE.Quaternion();
const scratchDesiredWorld = new THREE.Quaternion();
const scratchParentWorld = new THREE.Quaternion();
const scratchParentInverse = new THREE.Quaternion();
const scratchDelta = new THREE.Quaternion();
const scratchAxis = new THREE.Vector3(0, 1, 0);
const sourceFingerForward = new THREE.Vector3(0, -1, 0);
const authoredForward = new THREE.Vector3();
const authoredBaseOrientation = new THREE.Quaternion();
const authoredRollOrientation = new THREE.Quaternion();
const authoredOrientation = new THREE.Quaternion();
const sourceLateral = new THREE.Vector3();
const sourceNormal = new THREE.Vector3();
const targetLateral = new THREE.Vector3();
const targetNormal = new THREE.Vector3();
const targetForward = new THREE.Vector3();
const sourceFrame = new THREE.Matrix4();
const targetFrame = new THREE.Matrix4();
const frameMapping = new THREE.Matrix4();
const scratchRelative = new THREE.Quaternion();
const scratchLimitEuler = new THREE.Euler();
const splayAxis = new THREE.Vector3(0, 0, 1);
const authoredFingerSplayRadians = [-0.16, -0.05, 0.06, 0.15] as const;

function loadTemplate(side: AuthoredHandSide) {
  const cached = templates.get(side);
  if (cached) return cached;
  const promise = new GLTFLoader().loadAsync(urls[side]).then((gltf) => gltf.scene as THREE.Group);
  templates.set(side, promise);
  return promise;
}

const fingerNames = ["thumb", "index-finger", "middle-finger", "ring-finger", "pinky-finger"] as const;

/**
 * WebXR's generic hand profile has 25 joints. The thumb has three phalangeal
 * joints (metacarpal, proximal, distal) while the other fingers have four
 * (metacarpal, proximal, intermediate, distal). Keeping this schema explicit
 * prevents a missing thumb-intermediate joint from making an otherwise valid
 * hand disappear.
 */
export const AUTHORED_HAND_JOINT_SCHEMA = {
  wrist: ["wrist"],
  thumb: ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"],
  index: ["index-finger-metacarpal", "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip"],
  middle: ["middle-finger-metacarpal", "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip"],
  ring: ["ring-finger-metacarpal", "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip"],
  pinky: ["pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip"]
} as const;
const requiredNames = Object.values(AUTHORED_HAND_JOINT_SCHEMA).flat();
const fingerJointNames = (name: typeof fingerNames[number]) => name === "thumb"
  ? AUTHORED_HAND_JOINT_SCHEMA.thumb.slice(0, -1)
  : AUTHORED_HAND_JOINT_SCHEMA[name === "index-finger" ? "index" : name === "middle-finger" ? "middle" : name === "ring-finger" ? "ring" : "pinky"].slice(0, -1);

function cloneMaterial(material: THREE.Material) {
  // Promote the imported Lambert/standard material to a small PBR material;
  // this is created once per loaded rig, never in the pose/render path.
  const source = material as THREE.MeshStandardMaterial;
  const clone = material instanceof THREE.MeshPhysicalMaterial
    ? material.clone()
    : new THREE.MeshPhysicalMaterial({
      color: source.color?.clone() ?? new THREE.Color(0xc98268),
      map: source.map ?? null,
      normalMap: source.normalMap ?? null,
      roughness: source.roughness ?? 0.52,
      metalness: source.metalness ?? 0,
      transparent: material.transparent,
      opacity: material.opacity,
      side: THREE.DoubleSide
    });
  clone.name = material.name;
  clone.color?.set(0xc98268);
  clone.roughness = 0.52;
  clone.metalness = 0;
  clone.clearcoat = 0.08;
  clone.clearcoatRoughness = 0.32;
  // The tiny authored meshes are closed but some exporter normals are reversed
  // on the palm-facing strips. Double-sided shading keeps the hand visible in
  // both mirrored handedness orientations without changing draw count.
  clone.side = THREE.DoubleSide;
  clone.sheen = 0.1;
  clone.sheenColor.set(0xe6a086);
  return clone;
}

function targetHandBasis(role: AuthoredHandRole, handedness: GuitarHandedness): HandBasis {
  const basis = role === "picking" ? AUTHORED_HAND_TARGET_BASIS.picking : handedness === "left" ? AUTHORED_HAND_TARGET_BASIS.frettingLeft : AUTHORED_HAND_TARGET_BASIS.frettingRight;
  targetForward.fromArray(basis.forward);
  targetLateral.fromArray(basis.lateral);
  targetNormal.fromArray(basis.normal).normalize();
  return { forward: targetForward.clone(), lateral: targetLateral.clone(), normal: targetNormal.clone() };
}

function orientationFromBasis(source: HandBasis, target: HandBasis, roll = 0) {
  sourceFrame.makeBasis(source.lateral, source.normal, source.forward);
  targetFrame.makeBasis(target.lateral, target.normal, target.forward);
  frameMapping.copy(targetFrame).multiply(sourceFrame.clone().invert());
  authoredOrientation.setFromRotationMatrix(frameMapping);
  if (roll) {
    authoredRollOrientation.setFromAxisAngle(target.forward, roll);
    authoredOrientation.premultiply(authoredRollOrientation);
  }
  return authoredOrientation;
}

export async function loadAuthoredHand(side: AuthoredHandSide): Promise<AuthoredHandRig> {
  const source = await loadTemplate(side);
  const root = SkeletonUtils.clone(source) as THREE.Group;
  const bones = new Map<string, THREE.Bone>();
  root.traverse((object) => { if (object instanceof THREE.Bone) bones.set(object.name, object); });
  const missing = requiredNames.filter((name) => !bones.has(name));
  if (missing.length) throw new Error(`Authored ${side} hand is missing joints: ${missing.join(", ")}`);

  root.updateMatrixWorld(true);
  const wrist = bones.get("wrist")!;
  const middleTip = bones.get("middle-finger-tip")!;
  wrist.getWorldPosition(scratchWrist);
  middleTip.getWorldPosition(scratchMiddleTip);
  const sourceLength = scratchWrist.distanceTo(scratchMiddleTip);
  sourceLateral.subVectors(
    bones.get("pinky-finger-metacarpal")!.getWorldPosition(new THREE.Vector3()),
    bones.get("index-finger-metacarpal")!.getWorldPosition(new THREE.Vector3())
  ).normalize();
  scratchTargetDirection.subVectors(scratchMiddleTip, scratchWrist).normalize();
  sourceNormal.copy(scratchTargetDirection).cross(sourceLateral).normalize();
  const sourceBasis: HandBasis = {
    forward: scratchTargetDirection.clone().normalize(),
    lateral: sourceLateral.clone(),
    normal: sourceNormal.clone()
  };
  const scale = targetHandLength / Math.max(sourceLength, 0.0001);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const bind = new Map<string, BindTransform>();
  bones.forEach((bone, name) => bind.set(name, { position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }));
  let drawableSkinnedMeshCount = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const positionCount = object.geometry.getAttribute("position")?.count ?? 0;
    const indexCount = object.geometry.index?.count ?? 0;
    if (!authoredMeshDrawableState({
      isSkinnedMesh: true,
      hasMaterial: materials.length > 0 && materials.every(Boolean),
      materialCount: materials.length,
      groupCount: object.geometry.groups.length,
      positionCount,
      indexCount
    })) return;
    drawableSkinnedMeshCount += 1;
    // Imported hands can be larger than the scene bounds before their first
    // camera render. Disable per-mesh culling; the rig root remains cullable.
    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
    // Preserve material cardinality. Three.js only draws material arrays when
    // geometry groups address them; these hand GLBs intentionally have one
    // material and zero groups, so array-wrapping the clone makes them vanish.
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
    // SkeletonUtils shares source geometry; clone it so this live instance owns disposal.
    object.geometry = object.geometry.clone();
  });
  if (drawableSkinnedMeshCount === 0) throw new Error(`Authored ${side} hand has no drawable skinned mesh`);
  const tips = new Map<string, THREE.Bone>();
  fingerNames.forEach((name) => tips.set(name, bones.get(`${name}-tip`)!));
  const millimetersToWorld = (millimeters: number) => millimeters / 25.4 * INCH_TO_WORLD;
  const pickWidth = millimetersToWorld(AUTHORED_PICK_DIMENSIONS_MM.width);
  const pickHeight = millimetersToWorld(AUTHORED_PICK_DIMENSIONS_MM.height);
  const pickThickness = millimetersToWorld(AUTHORED_PICK_DIMENSIONS_MM.thickness);
  const pickShape = new THREE.Shape();
  pickShape.moveTo(0, -pickHeight / 2);
  pickShape.quadraticCurveTo(pickWidth * 0.48, -pickHeight * 0.42, pickWidth / 2, -pickHeight * 0.08);
  pickShape.quadraticCurveTo(pickWidth * 0.42, pickHeight * 0.42, 0, pickHeight / 2);
  pickShape.quadraticCurveTo(-pickWidth * 0.42, pickHeight * 0.42, -pickWidth / 2, -pickHeight * 0.08);
  pickShape.quadraticCurveTo(-pickWidth * 0.48, -pickHeight * 0.42, 0, -pickHeight / 2);
  const pickGeometry = new THREE.ExtrudeGeometry(pickShape, { depth: pickThickness, bevelEnabled: true, bevelSegments: 2, bevelSize: pickThickness * 0.5, bevelThickness: pickThickness * 0.5 });
  pickGeometry.rotateX(Math.PI / 2);
  const pick = new THREE.Mesh(pickGeometry, new THREE.MeshPhysicalMaterial({ color: 0xf0442d, roughness: 0.3, clearcoat: 0.45, side: THREE.DoubleSide }));
  // Pick dimensions are already converted to world units. The authored hand
  // root is scaled from its source GLB, so cancel that parent scale to keep
  // the final pick at a physical 30 x 25 x 2 mm.
  pick.scale.setScalar(1 / Math.max(scale, 0.0001));
  pick.visible = false;
  root.add(pick);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const ready = authoredHandReadyState({
    drawable: drawableSkinnedMeshCount > 0,
    bounds: { min: [bounds.min.x, bounds.min.y, bounds.min.z], max: [bounds.max.x, bounds.max.y, bounds.max.z] },
    // The loader gate is intentionally broad; role-specific camera presets
    // tighten the region after the wrist anchor is applied.
    sceneRegion: { min: [-5, -1, -5], max: [5, 4, 10] }
  });
  if (!ready) throw new Error(`Authored ${side} hand has non-finite or out-of-scene posed bounds`);
  return { root, bones, tips, bind, sourceLength, scale, tipError: 0, pick, sourceBasis };
}

function chainFor(rig: AuthoredHandRig, name: string) {
  return fingerJointNames(name as typeof fingerNames[number])
    .map((joint) => rig.bones.get(joint))
    .filter((joint): joint is THREE.Bone => Boolean(joint));
}

export function resetAuthoredRig(rig: AuthoredHandRig) {
  rig.bind.forEach((transform, name) => {
    const bone = rig.bones.get(name);
    if (!bone) return;
    bone.position.copy(transform.position);
    bone.quaternion.copy(transform.quaternion);
    bone.scale.copy(transform.scale);
  });
  rig.root.updateMatrixWorld(true);
  rig.tipError = 0;
}

function resetChain(rig: AuthoredHandRig, name: string) {
  chainFor(rig, name).forEach((bone) => {
    const transform = rig.bind.get(bone.name);
    if (!transform) return;
    bone.position.copy(transform.position);
    bone.quaternion.copy(transform.quaternion);
    bone.scale.copy(transform.scale);
  });
  rig.root.updateMatrixWorld(true);
}

const jointLimitFor = (name: string) => name.includes("metacarpal") ? AUTHORED_HAND_POSE_LIMITS.metacarpal : name.includes("proximal") ? AUTHORED_HAND_POSE_LIMITS.proximal : name.includes("intermediate") ? AUTHORED_HAND_POSE_LIMITS.intermediate : AUTHORED_HAND_POSE_LIMITS.distal;
function clampJointToAnatomy(rig: AuthoredHandRig, bone: THREE.Bone) {
  const bind = rig.bind.get(bone.name);
  if (!bind) return;
  scratchRelative.copy(bind.quaternion).invert().multiply(bone.quaternion);
  scratchLimitEuler.setFromQuaternion(scratchRelative, "XYZ");
  const limit = jointLimitFor(bone.name);
  scratchLimitEuler.x = THREE.MathUtils.clamp(scratchLimitEuler.x, -limit, limit);
  scratchLimitEuler.y = THREE.MathUtils.clamp(scratchLimitEuler.y, -limit * 0.72, limit * 0.72);
  scratchLimitEuler.z = THREE.MathUtils.clamp(scratchLimitEuler.z, -limit * 0.72, limit * 0.72);
  scratchRelative.setFromEuler(scratchLimitEuler);
  bone.quaternion.copy(bind.quaternion).multiply(scratchRelative);
}

/** Adds a conservative, bind-relative fan so inactive picking fingers remain distinguishable. */
export function splayAuthoredFingers(rig: AuthoredHandRig) {
  const names = ["index-finger", "middle-finger", "ring-finger", "pinky-finger"] as const;
  names.forEach((name, index) => {
    const bone = rig.bones.get(`${name}-metacarpal`);
    const bind = rig.bind.get(`${name}-metacarpal`);
    if (!bone || !bind) return;
    const angle = THREE.MathUtils.clamp(authoredFingerSplayRadians[index], -AUTHORED_HAND_POSE_LIMITS.metacarpal, AUTHORED_HAND_POSE_LIMITS.metacarpal);
    scratchRelative.setFromAxisAngle(splayAxis, angle);
    bone.quaternion.copy(bind.quaternion).multiply(scratchRelative);
    clampJointToAnatomy(rig, bone);
  });
  rig.root.updateMatrixWorld(true);
}

function rotateJointTowardTarget(rig: AuthoredHandRig, bone: THREE.Bone, tip: THREE.Bone, target: THREE.Vector3) {
  bone.getWorldPosition(scratchBone);
  tip.getWorldPosition(scratchTip);
  scratchCurrentDirection.subVectors(scratchTip, scratchBone);
  scratchTargetDirection.subVectors(target, scratchBone);
  if (scratchCurrentDirection.lengthSq() < 1e-8 || scratchTargetDirection.lengthSq() < 1e-8) return;
  scratchCurrentDirection.normalize();
  scratchTargetDirection.normalize();
  scratchDelta.setFromUnitVectors(scratchCurrentDirection, scratchTargetDirection);
  bone.getWorldQuaternion(scratchBoneWorld);
  scratchDesiredWorld.copy(scratchDelta).multiply(scratchBoneWorld);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(scratchParentWorld);
    scratchParentInverse.copy(scratchParentWorld).invert();
    bone.quaternion.copy(scratchParentInverse).multiply(scratchDesiredWorld);
  } else {
    bone.quaternion.copy(scratchDesiredWorld);
  }
  clampJointToAnatomy(rig, bone);
  rig.root.updateMatrixWorld(true);
}

/** CCD retargeting in world space; returns the measured fingertip error. */
export function poseAuthoredFinger(rig: AuthoredHandRig, name: string, target: FingerChainPoint) {
  const tip = rig.tips.get(name);
  const chain = chainFor(rig, name);
  if (!tip || !chain.length) return Number.POSITIVE_INFINITY;
  resetChain(rig, name);
  scratchTarget.set(target.x, target.y, target.z);
  // The imported bind pose is already a relaxed, anatomically credible hand.
  // Use only a small contact correction so unreachable targets never produce
  // the old contorted CCD pose.
  rig.bones.get("wrist")?.getWorldPosition(scratchWrist);
  const chainReach = chain.reduce((sum, bone) => sum + (bone.children[0]?.position.length() ?? 0), 0);
  const distanceToTarget = scratchWrist.distanceTo(scratchTarget);
  if (distanceToTarget > chainReach + 0.22) {
    tip.getWorldPosition(scratchTip);
    rig.tipError = scratchTip.distanceTo(scratchTarget);
    return rig.tipError;
  }
  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let index = chain.length - 1; index >= 0; index -= 1) rotateJointTowardTarget(rig, chain[index], tip, scratchTarget);
    tip.getWorldPosition(scratchTip);
    if (scratchTip.distanceTo(scratchTarget) <= 0.02) break;
  }
  tip.getWorldPosition(scratchTip);
  rig.tipError = scratchTip.distanceTo(scratchTarget);
  return rig.tipError;
}

/** Rolls the index chain toward the middle of a barre while keeping its side toward the span. */
export function poseAuthoredBarre(rig: AuthoredHandRig, span: { start: FingerChainPoint; end: FingerChainPoint }) {
  const midpoint = scratchTarget.set((span.start.x + span.end.x) * 0.5, span.start.y, span.start.z);
  const error = poseAuthoredFinger(rig, "index-finger", midpoint);
  const distal = rig.bones.get("index-finger-phalanx-distal");
  if (distal) {
    scratchTargetDirection.set(span.end.x - span.start.x, 0, span.end.z - span.start.z).normalize();
    scratchDelta.setFromUnitVectors(scratchAxis, scratchTargetDirection);
    scratchDesiredWorld.copy(scratchDelta);
    if (distal.parent) {
      distal.parent.getWorldQuaternion(scratchParentWorld);
      scratchParentInverse.copy(scratchParentWorld).invert();
      distal.quaternion.copy(scratchParentInverse).multiply(scratchDesiredWorld);
    }
    clampJointToAnatomy(rig, distal);
    rig.root.updateMatrixWorld(true);
  }
  return error;
}

export function authoredHandOrientation(role: AuthoredHandRole, handedness: GuitarHandedness, roll = 0) {
  authoredForward.set(...authoredHandForward(role, handedness)).normalize();
  const source: HandBasis = {
    forward: sourceFingerForward,
    lateral: new THREE.Vector3(1, 0, 0),
    normal: new THREE.Vector3(0, 0, 1)
  };
  return orientationFromBasis(source, targetHandBasis(role, handedness), roll);
}

export function positionAuthoredHand(rig: AuthoredHandRig, position: FingerChainPoint, rotationOrOptions: number | { role?: AuthoredHandRole; handedness?: GuitarHandedness; roll?: number } = 0, role: AuthoredHandRole = "fretting", handedness: GuitarHandedness = "right") {
  const options = typeof rotationOrOptions === "number" ? { role, handedness, roll: rotationOrOptions } : rotationOrOptions;
  // The GLB scene root is an exporter/armature origin, not the anatomical
  // wrist. Anchor by the wrist after scale/orientation so every pose contacts
  // the same physical fretboard points on both authored hand assets.
  rig.root.position.set(0, 0, 0);
  rig.root.quaternion.copy(orientationFromBasis(rig.sourceBasis, targetHandBasis(options.role ?? "fretting", options.handedness ?? "right"), options.roll ?? 0));
  rig.root.updateMatrixWorld(true);
  const wrist = rig.bones.get("wrist");
  if (wrist) {
    wrist.getWorldPosition(scratchWrist);
    rig.root.position.set(position.x - scratchWrist.x, position.y - scratchWrist.y, position.z - scratchWrist.z);
  } else {
    rig.root.position.set(position.x, position.y, position.z);
  }
  rig.root.updateMatrixWorld(true);
}

export function authoredHandCalibration() {
  return {
    targetHandLengthInches: AUTHORED_HAND_LENGTH_INCHES,
    targetHandLengthWorld: targetHandLength,
    sourceMeasurement: "wrist-to-middle-finger-tip world distance",
    scaleFromWorldLength: true,
    scaleLengthInches: GUITAR_SCALE_INCHES
  } as const;
}
