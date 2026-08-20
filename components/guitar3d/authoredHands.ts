import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { GUITAR_SCALE_INCHES, INCH_TO_WORLD, type FingerChainPoint } from "../../lib/guitarTechnique3d";

export type AuthoredHandSide = "left" | "right";
type BindTransform = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 };
export type AuthoredHandRig = {
  root: THREE.Group;
  bones: Map<string, THREE.Bone>;
  tips: Map<string, THREE.Bone>;
  bind: Map<string, BindTransform>;
  sourceLength: number;
  scale: number;
  tipError: number;
  pick: THREE.Mesh;
};

const urls: Record<AuthoredHandSide, string> = {
  left: "/models/guitar-technique/left.glb",
  right: "/models/guitar-technique/right.glb"
};
const templates = new Map<AuthoredHandSide, Promise<THREE.Group>>();
const targetHandLength = 7.55 * INCH_TO_WORLD;
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

function loadTemplate(side: AuthoredHandSide) {
  const cached = templates.get(side);
  if (cached) return cached;
  const promise = new GLTFLoader().loadAsync(urls[side]).then((gltf) => gltf.scene as THREE.Group);
  templates.set(side, promise);
  return promise;
}

const fingerNames = ["thumb", "index-finger", "middle-finger", "ring-finger", "pinky-finger"];
const requiredNames = ["wrist", ...fingerNames.flatMap((name) => [`${name}-metacarpal`, `${name}-phalanx-proximal`, `${name}-phalanx-intermediate`, `${name}-phalanx-distal`, `${name}-tip`])];

function cloneMaterial(material: THREE.Material) {
  const clone = material.clone() as THREE.MeshPhysicalMaterial;
  clone.color?.set(0xc98268);
  clone.roughness = 0.52;
  clone.metalness = 0;
  if ("sheen" in clone) {
    clone.sheen = 0.18;
    clone.sheenColor?.set(0xe6a086);
  }
  return clone;
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
  const scale = targetHandLength / Math.max(sourceLength, 0.0001);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const bind = new Map<string, BindTransform>();
  bones.forEach((bone, name) => bind.set(name, { position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }));
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.material = materials.map(cloneMaterial);
    // SkeletonUtils shares source geometry; clone it so this live instance owns disposal.
    object.geometry = object.geometry.clone();
  });
  const tips = new Map<string, THREE.Bone>();
  fingerNames.forEach((name) => tips.set(name, bones.get(`${name}-tip`)!));
  const pick = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 3), new THREE.MeshPhysicalMaterial({ color: 0xd84c38, roughness: 0.27, clearcoat: 0.65 }));
  pick.rotation.x = Math.PI / 2;
  pick.visible = false;
  root.add(pick);
  return { root, bones, tips, bind, sourceLength, scale, tipError: 0, pick };
}

function chainFor(rig: AuthoredHandRig, name: string) {
  return [`${name}-metacarpal`, `${name}-phalanx-proximal`, `${name}-phalanx-intermediate`, `${name}-phalanx-distal`]
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
  rig.root.updateMatrixWorld(true);
}

/** CCD retargeting in world space; returns the measured fingertip error. */
export function poseAuthoredFinger(rig: AuthoredHandRig, name: string, target: FingerChainPoint) {
  const tip = rig.tips.get(name);
  const chain = chainFor(rig, name);
  if (!tip || !chain.length) return Number.POSITIVE_INFINITY;
  resetChain(rig, name);
  scratchTarget.set(target.x, target.y, target.z);
  for (let iteration = 0; iteration < 8; iteration += 1) {
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
    rig.root.updateMatrixWorld(true);
  }
  return error;
}

export function positionAuthoredHand(rig: AuthoredHandRig, position: FingerChainPoint, rotationZ = 0) {
  rig.root.position.set(position.x, position.y, position.z);
  rig.root.rotation.set(0, 0, rotationZ);
  rig.root.updateMatrixWorld(true);
}

export function authoredHandCalibration() {
  return {
    targetHandLengthInches: 7.55,
    targetHandLengthWorld: targetHandLength,
    sourceMeasurement: "wrist-to-middle-finger-tip world distance",
    scaleFromWorldLength: true,
    scaleLengthInches: GUITAR_SCALE_INCHES
  } as const;
}
