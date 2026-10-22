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
  /** A low-poly PBR forearm, parented to the calibrated hand root so it
   * follows the same handedness/orientation without per-frame work. */
  forearm: THREE.Object3D;
  bones: Map<string, THREE.Bone>;
  tips: Map<string, THREE.Bone>;
  bind: Map<string, BindTransform>;
  sourceLength: number;
  scale: number;
  tipError: number;
  pick: THREE.Mesh;
  sourceBasis: HandBasis;
  role?: AuthoredHandRole;
  handedness?: GuitarHandedness;
  sourceQuality?: "cc0" | "innerscene" | "generic";
  poseLocked?: boolean;
  /** Connected anatomical overlay used because the source GLB skin has broad,
   * non-articulating distal weights.  The GLB is still loaded/calibrated
   * lazily, but its unstable visible skin is kept out of the contact pose. */
  overlay: HandOverlay;
};

type OverlayFinger = {
  base: THREE.Vector3;
  segments: THREE.Mesh[];
  joints: THREE.Mesh[];
  loft: THREE.Mesh;
  pad: THREE.Mesh;
  nail: THREE.Mesh;
};
type HandOverlay = {
  group: THREE.Group;
  palm: THREE.Mesh;
  wrist: THREE.Mesh;
  fingers: Map<string, OverlayFinger>;
  thumb: OverlayFinger;
};

const urls: Record<AuthoredHandSide, string> = {
  // Primary runtime assets are exported from the local CC0 bilateral rig by
  // scripts/author-chord-hand-assets.py. The second candidate keeps local
  // development usable before Blender export has been run; its state remains
  // visible as a fallback in the component status text.
  left: "/models/guitar-technique/cc0-left.glb",
  right: "/models/guitar-technique/cc0-right.glb"
};
const fallbackUrls: Record<AuthoredHandSide, string> = {
  left: "/models/guitar-technique/hand-posable.glb",
  right: "/models/guitar-technique/hand-posable.glb"
};
const templates = new Map<AuthoredHandSide, Promise<THREE.Group>>();
const targetHandLength = AUTHORED_HAND_LENGTH_INCHES * INCH_TO_WORLD;
const scratchWrist = new THREE.Vector3();
const scratchMiddleTip = new THREE.Vector3();
const scratchBone = new THREE.Vector3();
const scratchTip = new THREE.Vector3();
const scratchChild = new THREE.Vector3();
const scratchFlatBase = new THREE.Vector3();
const scratchFlatPoint = new THREE.Vector3();
const scratchFlatNext = new THREE.Vector3();
const scratchFlatDirection = new THREE.Vector3();
const scratchFlatAxis = new THREE.Vector3();
const scratchFlatPole = new THREE.Vector3();
const scratchFlatCurrent = new THREE.Vector3();
const scratchFlatLengths = [0, 0, 0, 0];
const scratchFlatPoints = Array.from({ length: 5 }, () => new THREE.Vector3());
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
const flexionAxis = new THREE.Vector3(1, 0, 0);
const authoredFingerSplayRadians = [-0.16, -0.05, 0.06, 0.15] as const;
const overlayWorldBase = new THREE.Vector3();
const overlayWorldTarget = new THREE.Vector3();
const overlayWorldPoint = new THREE.Vector3();
const overlayLocalPoint = new THREE.Vector3();
const overlayLocalNext = new THREE.Vector3();
const overlayPoints = Array.from({ length: 4 }, () => new THREE.Vector3());
const overlayFingerRadii = [0.17, 0.15, 0.125, 0.10] as const;
const overlayThumbRadii = [0.19, 0.155, 0.125, 0.10] as const;
const loftTangent = new THREE.Vector3();
const loftSide = new THREE.Vector3();
const loftBinormal = new THREE.Vector3();
const loftReference = new THREE.Vector3();
const loftOffset = new THREE.Vector3();

function makeTaperedForearmGeometry(scale: number) {
  const worldProfile: Array<[number, number]> = [
    [0.27, -0.72], [0.285, -0.4], [0.30, 0.08], [0.32, 1.1],
    [0.315, 1.75], [0.30, 2.25], [0.27, 2.6], [0.24, 2.82],
    [0.24, 3.4], [0.24, 4.1], [0.23, 5.0], [0.22, 6.0],
    [0.21, 7.0], [0.20, 8.0], [0.19, 9.0], [0.18, 10.2]
  ];
  return new THREE.LatheGeometry(worldProfile.map(([radius, y]) => new THREE.Vector2(radius / scale, y / scale)), 16);
}

function loadTemplate(side: AuthoredHandSide) {
  const cached = templates.get(side);
  if (cached) return cached;
  const loader = new GLTFLoader();
  const promise = loader.loadAsync(urls[side])
    .catch((error) => {
      if (process.env.NODE_ENV !== "production") console.warn(`[ChordHero] CC0 ${side} hand asset failed; trying fallback`, error);
      return loader.loadAsync(fallbackUrls[side]);
    })
    .then((gltf) => gltf.scene as THREE.Group);
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
      color: source.color?.clone() ?? new THREE.Color(0xb66b56),
      map: source.map ?? null,
      normalMap: source.normalMap ?? null,
      roughness: source.roughness ?? 0.52,
      metalness: source.metalness ?? 0,
      transparent: material.transparent,
      opacity: material.opacity,
      side: THREE.DoubleSide
    });
  clone.name = material.name;
  // Keep the source's natural skin albedo.  Earlier authored placeholders
  // forced a saturated coral color, which flattened the anatomical model.
  clone.color?.set(0xb26752);
  clone.roughness = Math.min(0.64, Math.max(0.38, source.roughness ?? 0.46));
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

/**
 * The supplied hand exports keep every phalanx as a sibling of the armature,
 * which means rotating a knuckle cannot carry the following phalanges with
 * it. Rebuild the anatomical parent chain once, at load time. attach() keeps
 * each joint's bind-pose world matrix unchanged; recalculating the cloned
 * skeleton inverses afterwards makes that preserved pose the new skin bind
 * pose. No objects are allocated from the render/gesture path.
 */
function rebuildFingerHierarchy(root: THREE.Group, bones: Map<string, THREE.Bone>) {
  const chains = [
    ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"],
    ["index-finger-metacarpal", "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip"],
    ["middle-finger-metacarpal", "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip"],
    ["ring-finger-metacarpal", "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip"],
    ["pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip"]
  ];
  root.updateMatrixWorld(true);
  chains.forEach((chain) => {
    for (let index = 1; index < chain.length; index += 1) {
      const parent = bones.get(chain[index - 1]);
      const child = bones.get(chain[index]);
      if (parent && child && child.parent !== parent) parent.attach(child);
    }
  });
  root.updateMatrixWorld(true);
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  });
  skeletons.forEach((skeleton) => {
    skeleton.calculateInverses();
    skeleton.update();
  });
  root.updateMatrixWorld(true);
}

/**
 * Normalize the compact Innerscene rig to the engine's descriptive joint
 * names.  The source has three deforming joints per digit; a lightweight tip
 * bone gives the existing contact solver a stable endpoint without adding
 * another skinned mesh or render cost.
 */
function normalizeInnersceneBones(root: THREE.Group, bones: Map<string, THREE.Bone>) {
  const source = (name: string) => bones.get(name);
  const aliases: Record<string, THREE.Bone | undefined> = {
    wrist: source("hand_r"),
    "index-finger-metacarpal": source("index_01_r"),
    "index-finger-phalanx-proximal": source("index_02_r"),
    "index-finger-phalanx-intermediate": source("index_03_r"),
    "index-finger-phalanx-distal": source("index_03_r"),
    "middle-finger-metacarpal": source("middle_01_r"),
    "middle-finger-phalanx-proximal": source("middle_02_r"),
    "middle-finger-phalanx-intermediate": source("middle_03_r"),
    "middle-finger-phalanx-distal": source("middle_03_r"),
    "ring-finger-metacarpal": source("ring_01_r"),
    "ring-finger-phalanx-proximal": source("ring_02_r"),
    "ring-finger-phalanx-intermediate": source("ring_03_r"),
    "ring-finger-phalanx-distal": source("ring_03_r"),
    "pinky-finger-metacarpal": source("pinky_01_r"),
    "pinky-finger-phalanx-proximal": source("pinky_02_r"),
    "pinky-finger-phalanx-intermediate": source("pinky_03_r"),
    "pinky-finger-phalanx-distal": source("pinky_03_r"),
    "thumb-metacarpal": source("thumb_01_r"),
    "thumb-phalanx-proximal": source("thumb_02_r"),
    "thumb-phalanx-distal": source("thumb_03_r")
  };
  Object.entries(aliases).forEach(([name, bone]) => {
    if (bone) {
      bone.userData.chordHeroCanonicalName = name;
      bones.set(name, bone);
    }
  });
  const tips: Array<[string, string]> = [
    ["index-finger-tip", "index_03_r"], ["middle-finger-tip", "middle_03_r"],
    ["ring-finger-tip", "ring_03_r"], ["pinky-finger-tip", "pinky_03_r"],
    ["thumb-tip", "thumb_03_r"]
  ];
  tips.forEach(([name, sourceName]) => {
    const parent = source(sourceName);
    if (!parent) return;
    const tip = new THREE.Bone();
    tip.name = name;
    // Distal source bones point down local +Y; this matches the source bind
    // pose and keeps the endpoint inside the rendered fingertip pad.
    tip.position.set(0, 0.018, 0);
    parent.add(tip);
    bones.set(name, tip);
  });
  return Boolean(aliases.wrist && tips.every(([name]) => bones.has(name)));
}

/**
 * Map the bilateral CC0 source rig to the canonical retargeting names. The
 * source already has a native deforming hierarchy and inverse-bind matrices;
 * keep both intact. Exported Blender tail-marker nodes provide the real bone
 * endpoints for the solver without adding weighted joints to the skin.
 */
function normalizeCc0Bones(root: THREE.Group, bones: Map<string, THREE.Bone>) {
  // GLTFLoader sanitizes Blender node names by removing punctuation, so
  // `Bone.016` commonly arrives as `Bone016`. Accept both forms while
  // retaining the Blender names in the source/export documentation.
  const source = (name: string) => bones.get(name) ?? bones.get(name.replace(/\./g, ""));
  const aliases: Record<string, THREE.Bone | undefined> = {
    wrist: source("Bone.016"),
    "index-finger-metacarpal": source("Bone.012"),
    "index-finger-phalanx-proximal": source("Bone"),
    "index-finger-phalanx-intermediate": source("Bone.001"),
    "index-finger-phalanx-distal": source("Bone.002"),
    "middle-finger-metacarpal": source("Bone.013"),
    "middle-finger-phalanx-proximal": source("Bone.003"),
    "middle-finger-phalanx-intermediate": source("Bone.004"),
    "middle-finger-phalanx-distal": source("Bone.005"),
    "ring-finger-metacarpal": source("Bone.014"),
    "ring-finger-phalanx-proximal": source("Bone.006"),
    "ring-finger-phalanx-intermediate": source("Bone.007"),
    "ring-finger-phalanx-distal": source("Bone.008"),
    "pinky-finger-metacarpal": source("Bone.015"),
    "pinky-finger-phalanx-proximal": source("Bone.009"),
    "pinky-finger-phalanx-intermediate": source("Bone.010"),
    "pinky-finger-phalanx-distal": source("Bone.011"),
    "thumb-metacarpal": source("Bone.021"),
    "thumb-phalanx-proximal": source("Bone.017"),
    "thumb-phalanx-distal": source("Bone.018"),
    // The source has a fourth thumb bone. Keep it as the endpoint so the
    // thumb remains independently posed all the way through its distal pad.
    "thumb-tip-source": source("Bone.019")
  };
  Object.entries(aliases).forEach(([name, bone]) => {
    if (bone) {
      bone.userData.chordHeroCanonicalName = name;
      bones.set(name, bone);
    }
  });
  const tipParents: Array<[string, string]> = [
    ["index-finger-tip", "index-finger-phalanx-distal"],
    ["middle-finger-tip", "middle-finger-phalanx-distal"],
    ["ring-finger-tip", "ring-finger-phalanx-distal"],
    ["pinky-finger-tip", "pinky-finger-phalanx-distal"],
    ["thumb-tip", "thumb-tip-source"]
  ];
  const tailLengthFallback: Record<string, number> = {
    "index-finger-tip": 0.0898237,
    "middle-finger-tip": 0.0939168,
    "ring-finger-tip": 0.0952935,
    "pinky-finger-tip": 0.0734914,
    "thumb-tip": 0.0901595,
  };
  const tailMarker = (tipName: string) => {
    const finger = tipName.replace(/-tip$/, "");
    let marker: THREE.Object3D | undefined;
    root.traverse((object) => {
      if (!marker && object.name.includes("tail") && object.name.includes(finger)) marker = object;
    });
    return marker;
  };
  root.updateMatrixWorld(true);
  tipParents.forEach(([name, parentName]) => {
    const parent = bones.get(parentName);
    if (!parent) return;
    const existing = bones.get(name);
    if (existing) return;
    const tip = new THREE.Bone();
    tip.name = name;
    const marker = tailMarker(name);
    if (marker) {
      // The marker is parented at the exact Blender bone tail. Convert its
      // world position into the live distal-bone frame before attaching our
      // non-skinned endpoint, so source tail orientation and length survive
      // glTF's bone representation.
      marker.getWorldPosition(scratchTip);
      parent.worldToLocal(scratchTip);
      tip.position.copy(scratchTip);
    } else {
      // Older locally cached CC0 exports lack markers. Their measured source
      // tail lengths are still anatomically correct and avoid a generic
      // .026-unit endpoint while the current asset is fetched.
      tip.position.set(0, tailLengthFallback[name] ?? 0.09, 0);
    }
    parent.add(tip);
    bones.set(name, tip);
  });
  return Boolean(aliases.wrist && tipParents.every(([name]) => bones.has(name)));
}

function orientOverlaySegment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, radius: number, calibrationScale = 1) {
  overlayWorldPoint.subVectors(to, from);
  const length = Math.max(0.035, overlayWorldPoint.length());
  overlayWorldPoint.normalize();
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  // CapsuleGeometry is created with radius .12 and cylindrical length 1.0;
  // its total Y extent is 1.24.  Scaling only the local axes keeps the joint
  // caps round while allowing every phalanx to follow its target.
  // Positions are stored in root-local units (divided by the calibrated root
  // scale), so restore that scale on the capsule's longitudinal axis too.
  mesh.scale.set(radius / 0.12, length * calibrationScale * 1.08 / 1.24, radius / 0.12);
  mesh.quaternion.setFromUnitVectors(scratchAxis, overlayWorldPoint);
}

function makeOverlayFinger(group: THREE.Group, scale: number, base: THREE.Vector3, skin: THREE.Material, padMaterial: THREE.Material, nailMaterial: THREE.Material): OverlayFinger {
  const segments = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12 / scale, 1 / scale, 6, 12), skin);
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  });
  const joints = [0, 1].map(() => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.125 / scale, 12, 8), skin);
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  });
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.14 / scale, 14, 10), padMaterial);
  pad.visible = false;
  pad.scale.set(1.1, 0.54, 1.12);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(0.085 / scale, 12, 8), nailMaterial);
  nail.scale.set(0.95, 0.3, 0.78);
  group.add(pad, nail);
  const initialPoints = [base.clone(), base.clone(), base.clone(), base.clone()];
  initialPoints[1].y -= 0.22 / scale;
  initialPoints[2].y -= 0.40 / scale;
  initialPoints[3].y -= 0.54 / scale;
  const loft = new THREE.Mesh(makeLoftGeometry(initialPoints, [0.17, 0.15, 0.125, 0.10], scale, 16), skin);
  loft.castShadow = false;
  loft.receiveShadow = false;
  group.add(loft);
  return { base: base.clone(), segments, joints, loft, pad, nail };
}

function setOverlayLocalSegment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, radius: number, calibrationScale = 1) {
  overlayLocalPoint.copy(from);
  overlayLocalNext.copy(to);
  orientOverlaySegment(mesh, overlayLocalPoint, overlayLocalNext, radius, calibrationScale);
}

/**
 * Creates a smooth, variable-radius loft along a local centerline.  Unlike a
 * collection of phalanx capsules this has one continuous vertex surface and
 * one normal field, so the wrist, finger joints, and forearm read as skin.
 * The centerline is stored in calibrated root-local units; radii remain in
 * world units and are converted once at setup/update time.
 */
function makeLoftGeometry(points: readonly THREE.Vector3[], radii: readonly number[], scale: number, radialSegments = 16) {
  const ringCount = points.length;
  const positions = new Float32Array(ringCount * radialSegments * 3);
  const indices: number[] = [];
  const writeRing = (ring: number, output: Float32Array) => {
    const center = points[ring];
    const previous = points[Math.max(0, ring - 1)];
    const next = points[Math.min(ringCount - 1, ring + 1)];
    loftTangent.subVectors(next, previous).normalize();
    loftReference.set(0, 0, 1);
    if (Math.abs(loftTangent.dot(loftReference)) > 0.92) loftReference.set(1, 0, 0);
    loftSide.crossVectors(loftTangent, loftReference).normalize();
    loftBinormal.crossVectors(loftTangent, loftSide).normalize();
    const radius = radii[ring] / scale;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      loftOffset.copy(loftSide).multiplyScalar(Math.cos(angle) * radius).addScaledVector(loftBinormal, Math.sin(angle) * radius);
      const index = (ring * radialSegments + segment) * 3;
      output[index] = center.x + loftOffset.x;
      output[index + 1] = center.y + loftOffset.y;
      output[index + 2] = center.z + loftOffset.z;
    }
  };
  for (let ring = 0; ring < ringCount; ring += 1) writeRing(ring, positions);
  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      const a = ring * radialSegments + segment;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + next;
      const d = (ring + 1) * radialSegments + segment;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function updateLoftGeometry(mesh: THREE.Mesh, points: readonly THREE.Vector3[], radii: readonly number[], scale: number) {
  const attribute = mesh.geometry.getAttribute("position");
  if (!(attribute instanceof THREE.BufferAttribute)) return;
  const radialSegments = attribute.count / points.length;
  const positions = attribute.array as Float32Array;
  for (let ring = 0; ring < points.length; ring += 1) {
    const center = points[ring];
    const previous = points[Math.max(0, ring - 1)];
    const next = points[Math.min(points.length - 1, ring + 1)];
    loftTangent.subVectors(next, previous).normalize();
    loftReference.set(0, 0, 1);
    if (Math.abs(loftTangent.dot(loftReference)) > 0.92) loftReference.set(1, 0, 0);
    loftSide.crossVectors(loftTangent, loftReference).normalize();
    loftBinormal.crossVectors(loftTangent, loftSide).normalize();
    const radius = radii[ring] / scale;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      loftOffset.copy(loftSide).multiplyScalar(Math.cos(angle) * radius).addScaledVector(loftBinormal, Math.sin(angle) * radius);
      const index = (ring * radialSegments + segment) * 3;
      positions[index] = center.x + loftOffset.x;
      positions[index + 1] = center.y + loftOffset.y;
      positions[index + 2] = center.z + loftOffset.z;
    }
  }
  attribute.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
}

function makeHandOverlay(root: THREE.Group, wristLocal: THREE.Vector3, scale: number): HandOverlay {
  const group = new THREE.Group();
  group.position.copy(wristLocal);
  root.add(group);
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xc98268, roughness: 0.5, sheen: 0.12, sheenColor: 0xe6a086, clearcoat: 0.08, clearcoatRoughness: 0.3 });
  const padMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb96b5b, roughness: 0.54, sheen: 0.14, sheenColor: 0xd88976 });
  const nailMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf4c3ad, roughness: 0.32, clearcoat: 0.22 });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1 / scale, 24, 16), skin);
  palm.position.set(0, -0.02 / scale, 0);
  palm.scale.set(0.48, 0.34, 0.63);
  group.add(palm);
  // A short capsule and the palm overlap the first forearm section.  This is
  // deliberately fuller than the exporter wrist so the transition remains
  // continuous when the arm bends away from the instrument.
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.27 / scale, 0.46 / scale, 8, 14), skin);
  wrist.position.set(0, 0.23 / scale, 0);
  group.add(wrist);
  const bases = [
    [-0.29, -0.30, 0.02],
    [-0.11, -0.39, 0.02],
    [0.08, -0.38, 0.02],
    [0.25, -0.33, 0.03]
  ].map(([x, y, z]) => new THREE.Vector3(x / scale, y / scale, z / scale));
  const fingers = new Map<string, OverlayFinger>();
  ["index-finger", "middle-finger", "ring-finger", "pinky-finger"].forEach((name, index) => fingers.set(name, makeOverlayFinger(group, scale, bases[index], skin, padMaterial, nailMaterial)));
  const thumb = makeOverlayFinger(group, scale, new THREE.Vector3(-0.37 / scale, -0.13 / scale, 0.12 / scale), skin, padMaterial, nailMaterial);
  const overlay: HandOverlay = { group, palm, wrist, fingers, thumb };
  resetOverlayPose(overlay, scale);
  return overlay;
}

function resetOverlayFingerPose(overlay: HandOverlay, finger: OverlayFinger, scale: number, thumb = false) {
  overlayPoints[0].copy(finger.base);
  // A relaxed hand has a soft hook rather than four parallel rods.  The
  // target is local to the wrist group, so this remains stable as the whole
  // hand is reoriented between fretting and picking roles.
  overlayPoints[1].copy(finger.base); overlayPoints[1].x += (thumb ? 0.16 : 0) / scale; overlayPoints[1].y -= 0.22 / scale; overlayPoints[1].z += (thumb ? 0.12 : -0.03) / scale;
  overlayPoints[2].copy(finger.base); overlayPoints[2].x += (thumb ? 0.27 : 0) / scale; overlayPoints[2].y -= 0.40 / scale; overlayPoints[2].z += (thumb ? 0.10 : -0.08) / scale;
  overlayPoints[3].copy(finger.base); overlayPoints[3].x += (thumb ? 0.34 : 0) / scale; overlayPoints[3].y -= 0.54 / scale; overlayPoints[3].z += (thumb ? 0.04 : -0.04) / scale;
  setOverlayLocalSegment(finger.segments[0], overlayPoints[0], overlayPoints[1], thumb ? 0.145 : 0.12, scale);
  setOverlayLocalSegment(finger.segments[1], overlayPoints[1], overlayPoints[2], thumb ? 0.13 : 0.105, scale);
  setOverlayLocalSegment(finger.segments[2], overlayPoints[2], overlayPoints[3], thumb ? 0.115 : 0.09, scale);
  finger.joints[0].position.copy(overlayPoints[1]);
  finger.joints[1].position.copy(overlayPoints[2]);
  finger.pad.position.copy(overlayPoints[3]);
  finger.nail.position.copy(overlayPoints[3]); finger.nail.position.y -= 0.012 / scale; finger.nail.position.z += (thumb ? 0.045 : -0.018) / scale;
  finger.nail.quaternion.copy(finger.segments[2].quaternion);
  updateLoftGeometry(finger.loft, overlayPoints, thumb ? overlayThumbRadii : overlayFingerRadii, scale);
}

function resetOverlayPose(overlay: HandOverlay, scale: number) {
  overlay.fingers.forEach((finger) => resetOverlayFingerPose(overlay, finger, scale));
  resetOverlayFingerPose(overlay, overlay.thumb, scale, true);
}

function poseOverlayFinger(rig: AuthoredHandRig, name: string, target: THREE.Vector3) {
  const finger = name === "thumb" ? rig.overlay.thumb : rig.overlay.fingers.get(name);
  if (!finger) return;
  rig.overlay.group.localToWorld(overlayWorldBase.copy(finger.base));
  overlayPoints[0].copy(overlayWorldBase);
  overlayPoints[3].copy(target);
  overlayPoints[1].lerpVectors(overlayPoints[0], overlayPoints[3], 0.34);
  overlayPoints[2].lerpVectors(overlayPoints[0], overlayPoints[3], 0.69);
  // Curl toward the palm before the final pad contact.  Y is the physical
  // string/fret normal in the scene, and the small lift avoids rigid rods.
  overlayPoints[1].y += name === "thumb" ? 0.16 : 0.24;
  overlayPoints[2].y += name === "thumb" ? 0.08 : 0.14;
  for (let index = 0; index < 4; index += 1) {
    rig.overlay.group.worldToLocal(overlayLocalPoint.copy(overlayPoints[index]));
    overlayPoints[index].copy(overlayLocalPoint);
  }
  for (let index = 0; index < 3; index += 1) setOverlayLocalSegment(finger.segments[index], overlayPoints[index], overlayPoints[index + 1], name === "thumb" ? [0.145, 0.13, 0.115][index] : [0.12, 0.105, 0.09][index], rig.scale);
  rig.overlay.group.worldToLocal(overlayLocalPoint.copy(overlayPoints[1])); finger.joints[0].position.copy(overlayLocalPoint);
  rig.overlay.group.worldToLocal(overlayLocalPoint.copy(overlayPoints[2])); finger.joints[1].position.copy(overlayLocalPoint);
  rig.overlay.group.worldToLocal(overlayLocalPoint.copy(overlayPoints[3])); finger.pad.position.copy(overlayLocalPoint); finger.nail.position.copy(overlayLocalPoint);
  finger.nail.quaternion.copy(finger.segments[2].quaternion);
  updateLoftGeometry(finger.loft, overlayPoints, name === "thumb" ? overlayThumbRadii : overlayFingerRadii, rig.scale);
}

export async function loadAuthoredHand(side: AuthoredHandSide): Promise<AuthoredHandRig> {
  const source = await loadTemplate(side);
  const root = SkeletonUtils.clone(source) as THREE.Group;
  const bones = new Map<string, THREE.Bone>();
  root.traverse((object) => { if (object instanceof THREE.Bone) bones.set(object.name, object); });
  const hasCc0Bone = (name: string) => bones.has(name) || bones.has(name.replace(/\./g, ""));
  const isCc0 = bones.has("Hand_Right") || bones.has("Hand_Left") || (hasCc0Bone("Bone.016") && hasCc0Bone("Bone.012") && hasCc0Bone("Bone.021"));
  const isInnerscene = !isCc0 && bones.has("hand_r") && bones.has("index_03_r") && bones.has("thumb_03_r");
  if (isCc0) normalizeCc0Bones(root, bones);
  else if (isInnerscene) normalizeInnersceneBones(root, bones);
  else rebuildFingerHierarchy(root, bones);
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
  );
  scratchTargetDirection.subVectors(scratchMiddleTip, scratchWrist).normalize();
  // The source mesh's bilateral metacarpal span is only approximately
  // perpendicular to the wrist-to-middle-fingertip vector. Orthogonalize it
  // before constructing the frame so native CC0 rotations do not inherit a
  // shear-like roll from the raw measurement.
  sourceLateral.addScaledVector(scratchTargetDirection, -sourceLateral.dot(scratchTargetDirection)).normalize();
  sourceNormal.copy(scratchTargetDirection).cross(sourceLateral).normalize();
  const sourceBasis: HandBasis = {
    forward: scratchTargetDirection.clone().normalize(),
    lateral: sourceLateral.clone(),
    normal: sourceNormal.clone()
  };
  const scale = targetHandLength / Math.max(sourceLength, 0.0001);
  // The target hand basis carries the left/right orientation. Keep the source
  // scale positive so a second X mirror cannot turn the left palm away from
  // the fretboard; this also preserves stable skin normals.
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
  const pick = new THREE.Mesh(pickGeometry, new THREE.MeshPhysicalMaterial({ color: 0xf0442d, emissive: 0x7f1008, emissiveIntensity: 0.35, roughness: 0.3, clearcoat: 0.45, side: THREE.DoubleSide }));
  pick.renderOrder = 4;
  (pick.material as THREE.Material).depthTest = false;
  // Pick dimensions are already converted to world units. The authored hand
  // root is scaled from its source GLB, so cancel that parent scale to keep
  // the final pick at a physical 30 x 25 x 2 mm.
  pick.scale.setScalar(1 / Math.max(scale, 0.0001));
  pick.visible = false;
  root.add(pick);
  wrist.getWorldPosition(scratchWrist);
  root.worldToLocal(scratchWrist);
  const overlay = makeHandOverlay(root, scratchWrist, scale);
  // The imported anatomical mesh is the visible surface. Keep the procedural
  // overlay available for fallback rigs, but hidden for this validated source
  // so it cannot double the silhouette.
  overlay.group.visible = !isInnerscene && !isCc0;
  let importedForearm: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (!importedForearm && /forearm/i.test(object.name) && object !== root) importedForearm = object;
  });
  const forearmMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb26752, roughness: 0.48, sheen: 0.12, sheenColor: 0xd8907a, clearcoat: 0.08, clearcoatRoughness: 0.3 });
  // TypeScript cannot observe assignment performed inside Object3D.traverse;
  // retain the explicit nullable type for the measured imported branch.
  const importedForearmObject: THREE.Object3D | null = importedForearm as THREE.Object3D | null;
  const forearm = importedForearmObject ?? new THREE.Group();
  // Imported CC0 forearms already inherit the wrist bone's bind transform.
  // Procedural routing is only for generated fallback lofts; mutating this
  // local rotation would detach the authored forearm from the wrist.
  forearm.userData.chordHeroImportedForearm = Boolean(importedForearmObject);
  if (importedForearmObject) {
    importedForearmObject.traverse((object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.frustumCulled = false;
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
    });
  }
  if (!importedForearmObject) {
    forearm.position.copy(scratchWrist);
    root.add(forearm);
  }
  // A gently bowed, tapered lower arm reads as an anatomical continuation of
  // the wrist and leaves the camera through the frame edge. One variable-
  // radius loft avoids seams, gaps, and the old sausage-like capsule chain.
  const armPath = [
    new THREE.Vector3(0, 0.08 / scale, 0),
    new THREE.Vector3(0.01 / scale, 0.52 / scale, 0.01 / scale),
    new THREE.Vector3(0.02 / scale, 0.96 / scale, 0.012 / scale),
    new THREE.Vector3(0.05 / scale, 1.4 / scale, 0.016 / scale),
    new THREE.Vector3(0.1 / scale, 1.84 / scale, 0.02 / scale),
    new THREE.Vector3(0.18 / scale, 2.28 / scale, 0.024 / scale),
    new THREE.Vector3(0.29 / scale, 2.72 / scale, 0.03 / scale),
    new THREE.Vector3(0.43 / scale, 3.16 / scale, 0.034 / scale),
    new THREE.Vector3(0.61 / scale, 3.62 / scale, 0.04 / scale),
    new THREE.Vector3(0.91 / scale, 4.1 / scale, 0.05 / scale),
    // Continue beyond the teaching frame so the visible arm has no artificial
    // cut-off; the shallow bow keeps it clear of the soundboard.
    new THREE.Vector3(1.52 / scale, 4.52 / scale, 0.06 / scale),
    new THREE.Vector3(7.5 / scale, 6.5 / scale, 0.08 / scale)
  ];
  const armRadii = [0.27, 0.27, 0.265, 0.26, 0.255, 0.245, 0.235, 0.225, 0.215, 0.205, 0.19, 0.16];
  if (!importedForearmObject) {
    const armLoft = new THREE.Mesh(makeLoftGeometry(armPath, armRadii, scale, 20), forearmMaterial);
    armLoft.castShadow = false;
    armLoft.receiveShadow = false;
    forearm.add(armLoft);
  }
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const ready = authoredHandReadyState({
    drawable: drawableSkinnedMeshCount > 0,
    bounds: { min: [bounds.min.x, bounds.min.y, bounds.min.z], max: [bounds.max.x, bounds.max.y, bounds.max.z] },
    // The loader gate is intentionally broad; role-specific camera presets
    // tighten the region after the wrist anchor is applied.
    sceneRegion: { min: [-10, -5, -10], max: [10, 12, 10] }
  });
  if (!ready) throw new Error(`Authored ${side} hand has non-finite or out-of-scene posed bounds`);
  return { root, forearm, bones, tips, bind, sourceLength, scale, tipError: 0, pick, sourceBasis, role: undefined, handedness: undefined, sourceQuality: isCc0 ? "cc0" : isInnerscene ? "innerscene" : "generic", poseLocked: false, overlay };
}

function chainFor(rig: AuthoredHandRig, name: string) {
  const seen = new Set<THREE.Bone>();
  const chain: THREE.Bone[] = [];
  fingerJointNames(name as typeof fingerNames[number]).forEach((jointName) => {
    const joint = rig.bones.get(jointName);
    if (!joint || seen.has(joint)) return;
    seen.add(joint);
    chain.push(joint);
  });
  return chain;
}

export function resetAuthoredRig(rig: AuthoredHandRig) {
  rig.bind.forEach((transform, name) => {
    const bone = rig.bones.get(name);
    if (!bone) return;
    bone.position.copy(transform.position);
    bone.quaternion.copy(transform.quaternion);
    bone.scale.copy(transform.scale);
  });
  rig.poseLocked = false;
  rig.root.updateMatrixWorld(true);
  // Establish a relaxed baseline before any contact IK. Active contacts are
  // posed afterwards, so their fingertips remain exact while inactive digits
  // retain a natural curl instead of the flat authored bind pose.
  splayAuthoredFingers(rig);
  // CC0's native skinned surface is the visible hand. The procedural overlay
  // is only for generic fallback rigs; skip its geometry updates entirely for
  // authored assets so reset remains allocation-free and cheap.
  if (rig.overlay.group.visible) resetOverlayPose(rig.overlay, rig.scale);
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
  const limit = jointLimitFor((bone.userData.chordHeroCanonicalName as string | undefined) ?? bone.name) * (rig.role === "picking" ? 1 : 1);
  scratchLimitEuler.x = THREE.MathUtils.clamp(scratchLimitEuler.x, -limit, limit);
  scratchLimitEuler.y = THREE.MathUtils.clamp(scratchLimitEuler.y, -limit * 0.72, limit * 0.72);
  scratchLimitEuler.z = THREE.MathUtils.clamp(scratchLimitEuler.z, -limit * 0.72, limit * 0.72);
  scratchRelative.setFromEuler(scratchLimitEuler);
  bone.quaternion.copy(bind.quaternion).multiply(scratchRelative);
}

/** Adds a conservative, bind-relative fan so inactive picking fingers remain distinguishable. */
export function splayAuthoredFingers(rig: AuthoredHandRig) {
  if (rig.poseLocked) return;
  const names = ["index-finger", "middle-finger", "ring-finger", "pinky-finger"] as const;
  names.forEach((name, index) => {
    const bone = rig.bones.get(`${name}-metacarpal`);
    const bind = rig.bind.get(`${name}-metacarpal`);
    if (!bone || !bind) return;
    const angle = THREE.MathUtils.clamp(authoredFingerSplayRadians[index], -AUTHORED_HAND_POSE_LIMITS.metacarpal, AUTHORED_HAND_POSE_LIMITS.metacarpal);
    scratchRelative.setFromAxisAngle(splayAxis, angle);
    bone.quaternion.copy(bind.quaternion).multiply(scratchRelative);
    clampJointToAnatomy(rig, bone);
    // Let the non-index fingers rest in a small natural curl. The index is
    // the active contact for plectrum/strum poses, so leaving it untouched
    // preserves exact pick/string placement while the other fingers stop
    // reading as four parallel, fully extended rods.
    if (index > 0) {
      const proximal = rig.bones.get(`${name}-phalanx-proximal`);
      const intermediate = rig.bones.get(`${name}-phalanx-intermediate`);
      const distal = rig.bones.get(`${name}-phalanx-distal`);
      [proximal, intermediate, distal].forEach((joint, jointIndex) => {
        if (!joint) return;
        const jointBind = rig.bind.get(joint.name);
        if (!jointBind) return;
        scratchRelative.setFromAxisAngle(flexionAxis, [0.22, 0.38, 0.28][jointIndex]);
        joint.quaternion.copy(jointBind.quaternion).multiply(scratchRelative);
        clampJointToAnatomy(rig, joint);
      });
    }
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

/**
 * The supplied GLBs use a flat sibling list for their skin bones rather than
 * a parented phalanx hierarchy. CCD can rotate those siblings but cannot move
 * their descendants, so it silently leaves the hand in its bind pose. Place
 * the flat chain explicitly in a shallow anatomical arc, then orient each
 * bone toward the next joint. This keeps contacts exact while preserving the
 * authored mesh and lazy asset path.
 */
function poseFlatAuthoredFinger(rig: AuthoredHandRig, chain: THREE.Bone[], tip: THREE.Bone, target: THREE.Vector3) {
  const parent = chain[0]?.parent;
  if (!parent || !chain.every((bone) => bone.parent === parent) || tip.parent !== parent) return false;
  rig.root.updateMatrixWorld(true);
  chain[0].getWorldPosition(scratchFlatBase);
  scratchFlatPoints[0].copy(scratchFlatBase);
  let total = 0;
  for (let index = 0; index < chain.length; index += 1) {
    const next = index + 1 < chain.length ? chain[index + 1] : tip;
    chain[index].getWorldPosition(scratchBone);
    next.getWorldPosition(scratchChild);
    scratchFlatLengths[index] = scratchBone.distanceTo(scratchChild);
    total += scratchFlatLengths[index];
  }
  if (total < 1e-5) return false;
  scratchFlatDirection.subVectors(target, scratchFlatBase);
  const distance = scratchFlatDirection.length();
  if (distance < 1e-5) return false;
  scratchFlatDirection.normalize();
  scratchFlatAxis.copy(scratchFlatDirection);
  // Start with a shallow arc, then solve the chain with FABRIK so each
  // phalanx keeps its authored length. Compressing every link toward the
  // fingertip was the source of the webbed/folded appearance.
  scratchFlatPole.set(0, 1, 0);
  if (Math.abs(scratchFlatPole.dot(scratchFlatAxis)) > 0.92) scratchFlatPole.set(0, 0, 1);
  scratchFlatPole.addScaledVector(scratchFlatAxis, -scratchFlatPole.dot(scratchFlatAxis)).normalize();
  const bend = Math.min(0.18, distance * 0.18);
  let travelled = 0;
  scratchFlatPoints[4].copy(target);
  for (let index = 1; index < scratchFlatPoints.length - 1; index += 1) {
    travelled += scratchFlatLengths[index - 1];
    const fraction = Math.min(1, travelled / total);
    scratchFlatPoints[index].copy(scratchFlatBase).addScaledVector(scratchFlatAxis, distance * fraction);
    scratchFlatPoints[index].addScaledVector(scratchFlatPole, Math.sin(Math.PI * fraction) * bend);
  }
  for (let iteration = 0; iteration < 10; iteration += 1) {
    scratchFlatPoints[4].copy(target);
    for (let index = 3; index >= 0; index -= 1) {
      scratchFlatDirection.subVectors(scratchFlatPoints[index], scratchFlatPoints[index + 1]).normalize();
      scratchFlatPoints[index].copy(scratchFlatPoints[index + 1]).addScaledVector(scratchFlatDirection, scratchFlatLengths[index]);
    }
    scratchFlatPoints[0].copy(scratchFlatBase);
    for (let index = 0; index < 4; index += 1) {
      scratchFlatDirection.subVectors(scratchFlatPoints[index + 1], scratchFlatPoints[index]).normalize();
      scratchFlatPoints[index + 1].copy(scratchFlatPoints[index]).addScaledVector(scratchFlatDirection, scratchFlatLengths[index]);
    }
  }
  const parentInverse = parent.getWorldQuaternion(scratchParentWorld).invert();
  for (let index = 0; index < chain.length; index += 1) {
    scratchFlatPoint.copy(scratchFlatPoints[index]);
    scratchFlatNext.copy(scratchFlatPoints[index + 1]);
    parent.worldToLocal(scratchFlatPoint);
    chain[index].position.copy(scratchFlatPoint);
    chain[index].getWorldQuaternion(scratchBoneWorld);
    scratchFlatCurrent.copy(sourceFingerForward).applyQuaternion(scratchBoneWorld).normalize();
    scratchFlatDirection.subVectors(scratchFlatNext, scratchFlatPoints[index]).normalize();
    scratchDelta.setFromUnitVectors(scratchFlatCurrent, scratchFlatDirection);
    scratchDesiredWorld.copy(scratchDelta).multiply(scratchBoneWorld);
    chain[index].quaternion.copy(parentInverse).multiply(scratchDesiredWorld);
  }
  parent.worldToLocal(scratchFlatPoint.copy(scratchFlatPoints[4]));
  tip.position.copy(scratchFlatPoint);
  rig.root.updateMatrixWorld(true);
  return true;
}

/** CCD retargeting in world space; returns the measured fingertip error. */
export function poseAuthoredFinger(rig: AuthoredHandRig, name: string, target: FingerChainPoint) {
  const tip = rig.tips.get(name);
  const chain = chainFor(rig, name);
  if (!tip || !chain.length) return Number.POSITIVE_INFINITY;
  // Lock the baseline as soon as a contact pass begins. updateAuthoredRight
  // still supports older callers that invoke splay() after posing; keeping
  // this guard set before the reachability test prevents that legacy call
  // from undoing even a deliberately skipped/unreachable contact.
  rig.poseLocked = true;
  resetChain(rig, name);
  scratchTarget.set(target.x, target.y, target.z);
  // The imported GLB's hidden skin needs a lateral calibration bias, but the
  // rendered loft should land on the actual physical fret/string point.
  overlayWorldTarget.copy(scratchTarget);
  // The GLB skin's distal vertices sit slightly toward the lateral edge of
  // each authored chain. Bias the fretting solve across that offset so the
  // visible fingertip pad, rather than only the hidden tip joint, lands on
  // the string line.
  // The generic hand needed a lateral correction for its broad weighted
  // fingertips. The anatomical source is calibrated at the actual joint line
  // and must not inherit that offset, or its fingers bunch on one fret.
  if (rig.sourceQuality === "generic" && rig.role === "fretting" && name !== "thumb") scratchTarget.x -= name === "index-finger" ? 0.72 : 0.34;
  // Drive the visible articulated surface from the same physical target as
  // the calibrated joint solver.  This keeps every rendered fingertip on the
  // string even when the source GLB's broad skin weights cannot follow.
  if (rig.role === "picking") {
    overlayWorldTarget.y += 0.06;
    // Keep the thumb and index visibly distinct around the shared pick point
    // instead of stacking two identical rods on the selected string.
    const pinchSide = rig.handedness === "left" ? -1 : 1;
    if (name === "thumb") overlayWorldTarget.x += pinchSide * 0.13;
    if (name === "index-finger") overlayWorldTarget.x -= pinchSide * 0.13;
  }
  if (rig.overlay.group.visible) poseOverlayFinger(rig, name, overlayWorldTarget);
  // The imported bind pose is already a relaxed, anatomically credible hand.
  // Use only a small contact correction so unreachable targets never produce
  // the old contorted CCD pose.
  rig.bones.get("wrist")?.getWorldPosition(scratchWrist);
  // Child offsets are authored in armature-local units while targets are in
  // world space. Measure the actual world-space links so scaled GLBs do not
  // incorrectly reject reachable string contacts and fall back to the flat
  // bind pose.
  const chainReach = chain.reduce((sum, bone) => {
    const child = bone.children[0];
    if (!(child instanceof THREE.Object3D)) return sum;
    bone.getWorldPosition(scratchBone);
    child.getWorldPosition(scratchChild);
    return sum + scratchBone.distanceTo(scratchChild);
  }, 0);
  // Reachability is a property of the active digit chain, not of the wrist:
  // the wrist-to-knuckle span varies substantially across the native CC0 rig
  // and was causing valid picking contacts to be rejected as unreachable.
  chain[0].getWorldPosition(scratchBone);
  const distanceToTarget = scratchBone.distanceTo(scratchTarget);
  if (poseFlatAuthoredFinger(rig, chain, tip, scratchTarget)) {
    tip.getWorldPosition(scratchTip);
    rig.tipError = scratchTip.distanceTo(scratchTarget);
    return rig.tipError;
  }
  if (distanceToTarget > chainReach + 0.22) {
    tip.getWorldPosition(scratchTip);
    rig.tipError = scratchTip.distanceTo(scratchTarget);
    return rig.tipError;
  }
  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (let index = chain.length - 1; index >= 0; index -= 1) rotateJointTowardTarget(rig, chain[index], tip, scratchTarget);
    tip.getWorldPosition(scratchTip);
    if (scratchTip.distanceTo(scratchTarget) <= 0.02) break;
  }
  // Add a modest anatomical knuckle curl after the direct CCD solve, then
  // make one final contact correction. This keeps the fingertip on the string
  // while preventing the authored chain from reading as a rigid straight rod.
  chain.forEach((bone, index) => {
    scratchRelative.setFromAxisAngle(flexionAxis, [0.045, 0.085, 0.06][index] ?? 0.05);
    bone.quaternion.multiply(scratchRelative);
    clampJointToAnatomy(rig, bone);
  });
  for (let index = chain.length - 1; index >= 0; index -= 1) rotateJointTowardTarget(rig, chain[index], tip, scratchTarget);
  // Keep the native CC0 contact solve intact. Blending joints back toward the
  // bind pose after convergence visibly lifts real fingertips off the strings.
  rig.root.updateMatrixWorld(true);
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
  const activeRole = options.role ?? "fretting";
  const activeHandedness = options.handedness ?? "right";
  // A physical 7.55-inch hand needs room to arch into its contacts. Place the
  // fretting wrist outside the neck edge and the picking wrist behind the
  // bridge instead of shrinking the imported anatomy to fit a too-near anchor.
  const effectivePosition = activeRole === "picking"
    // The picking caller already supplies the calibrated wrist anchor beside
    // the string fan. Older offsets (+.62 x / +.8 z) put a real 7.55-inch
    // CC0 hand too far toward the lower bout, making every string target
    // falsely unreachable.
    ? { ...position }
    : { ...position, x: activeHandedness === "left" ? 1.85 : -1.85, y: 0.82 };
  rig.role = options.role ?? "fretting";
  rig.handedness = options.handedness ?? "right";
  // The GLB scene root is an exporter/armature origin, not the anatomical
  // wrist. Anchor by the wrist after scale/orientation so every pose contacts
  // the same physical fretboard points on both authored hand assets.
  rig.root.position.set(0, 0, 0);
  rig.root.quaternion.copy(orientationFromBasis(rig.sourceBasis, targetHandBasis(options.role ?? "fretting", options.handedness ?? "right"), options.roll ?? 0));
  // Picking forearms approach the soundhole from the lower bout at a slight
  // lateral angle, keeping the elbow/arm off the string plane instead of
  // reading as a straight tube laid directly across the rosette.
  // Keep the elbow on the near-side lower bout. The old negative roll sent
  // the arm diagonally across the rosette; mirror the approach for left-hand
  // layouts so the soundhole remains visible and the wrist reads connected.
  // A shallow roll lets the curved arm leave the frame naturally without
  // sweeping a straight tube across the soundhole.
  // Route both forearms sideways out of the teaching composition. Fretting
  // used to rise vertically into a hooked tube above the neck; this lateral
  // approach keeps the wrist connected without dominating the hand view.
  if (!rig.forearm.userData.chordHeroImportedForearm) {
    rig.forearm.rotation.z = options.role === "picking"
      ? (options.handedness === "left" ? 1.15 : -1.15)
      : (options.handedness === "left" ? -0.92 : 0.92);
    rig.forearm.rotation.x = options.role === "picking" ? 0.38 : -0.18;
  }
  rig.root.updateMatrixWorld(true);
  const wrist = rig.bones.get("wrist");
  if (wrist) {
    wrist.getWorldPosition(scratchWrist);
    // Keep the picking palm just to the outside of the string fan. This
    // leaves the sound hole visible while the lofted fingers still reach the
    // selected strings from a believable wrist angle.
    const anchorX = effectivePosition.x;
    rig.root.position.set(anchorX - scratchWrist.x, effectivePosition.y - scratchWrist.y, effectivePosition.z - scratchWrist.z);
  } else {
    rig.root.position.set(effectivePosition.x, effectivePosition.y, effectivePosition.z);
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
