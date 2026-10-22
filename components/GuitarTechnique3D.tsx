"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AUTHORED_HAND_WRIST_TARGET_Y, AUTHORED_PICK_DIMENSIONS_MM, INCH_TO_WORLD, barreContactSpan, chooseManualFinger, chordToLeftHandTargets, guitarFretContactZ, guitarStringContactPoint, guitarStringXAt, guitarPresetForMode, GUITAR_CAMERA_PRESETS, GUITAR_FINGER_BONE_LENGTHS, GUITAR_TECHNIQUE_CLOSEUPS, normalizeGuitarChord, rightHandTokenToMotionPlan, solveFingerChain, techniqueMotionContacts, techniqueToMotionPlan, type GuitarChordShape, type GuitarHandedness, type RightHandTechnique, type TechniqueMotion } from "../lib/guitarTechnique3d";
import { createProfessionalAcousticGuitar } from "./guitar3d/professionalAcousticGuitar";

export type GuitarContact = { string: number; fret: number };

export type GuitarTechnique3DProps = {
  chord?: GuitarChordShape | null;
  /** Optional previous shape used by the teaching transition cue. */
  transitionFrom?: GuitarChordShape | null;
  handedness?: GuitarHandedness;
  technique?: RightHandTechnique;
  activePatternStep?: number;
  activeStrings?: readonly number[];
  /** Exact written motion. When supplied, it replaces the legacy inferred plan. */
  motionPlan?: TechniqueMotion;
  /** Convenience notation input used only when motionPlan is omitted. */
  token?: string;
  /** A stable 0–1 pose. Supplying it freezes the renderer at that phase. */
  manualPhase?: number | null;
  /** Contact shared with a chord diagram. This only highlights the real contact; it never moves the fretting hand. */
  selectedContact?: GuitarContact | null;
  /** Controlled 0–1 teaching transition. While set, the existing from→to pose is held with no transition RAF. */
  transitionPhase?: number | null;
  /** When true, diagram-linked selection is output-only and never drives the legacy manual target pose. */
  selectionOnly?: boolean;
  playbackRate?: number;
  mode?: "left-hand" | "right-hand" | "both";
  labels?: boolean;
  gestureKey?: string | number;
  autoPlay?: boolean;
  className?: string;
  onTargetChange?: (target: { string: number; fret: number }) => void;
  onGesture?: (kind: RightHandTechnique) => void;
};

type Segment = { mesh: THREE.Mesh; joint: THREE.Mesh; pad: THREE.Mesh; nail: THREE.Mesh; boneLength: number };
type FingerVisual = { segments: Segment[]; accent: THREE.Mesh };
type HandVisual = { group: THREE.Group; palm: THREE.Mesh; wrist: THREE.Mesh; forearm: THREE.Mesh; fingers: FingerVisual[]; thumb: Segment[]; pick?: THREE.Mesh };
type PresetName = keyof typeof GUITAR_CAMERA_PRESETS | keyof typeof GUITAR_TECHNIQUE_CLOSEUPS;

const STRING_X = (string: number, z = -3.3) => guitarStringXAt(string, z);
const direction = new THREE.Vector3();
const segmentStart = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);
const authoredThumbTipPosition = new THREE.Vector3();
const authoredIndexTipPosition = new THREE.Vector3();

function setSegment(segment: Segment, from: THREE.Vector3, to: THREE.Vector3, width = 1, lengthOverride?: number) {
  direction.subVectors(to, from);
  if (direction.lengthSq() < 0.0001) direction.set(0, -1, 0);
  direction.normalize();
  const boneLength = lengthOverride ?? segment.boneLength;
  segmentStart.copy(to).addScaledVector(direction, -boneLength);
  segment.mesh.position.copy(segmentStart).add(to).multiplyScalar(0.5);
  // Slightly fuller phalanges read as skin rather than wire rods at the
  // close-up teaching scale while preserving exact endpoint contact.
  const visualWidth = width * 1.18;
  segment.mesh.scale.set(visualWidth, boneLength, visualWidth);
  segment.mesh.quaternion.setFromUnitVectors(upAxis, direction);
  segment.joint.position.copy(to); segment.pad.position.copy(to); segment.nail.position.copy(to); segment.nail.quaternion.copy(segment.mesh.quaternion);
}

function makeSegment(group: THREE.Group, geometry: THREE.BufferGeometry, jointGeometry: THREE.BufferGeometry, nailGeometry: THREE.BufferGeometry, material: THREE.Material, padMaterial: THREE.Material, nailMaterial: THREE.Material, boneLength: number): Segment {
  const mesh = new THREE.Mesh(geometry, material); const joint = new THREE.Mesh(jointGeometry, material); const pad = new THREE.Mesh(jointGeometry, padMaterial); const nail = new THREE.Mesh(nailGeometry, nailMaterial);
  mesh.scale.setScalar(0.13); joint.scale.setScalar(0.1); pad.scale.setScalar(0.075); nail.scale.set(0.06, 0.03, 0.035);
  group.add(mesh, joint, pad, nail); return { mesh, joint, pad, nail, boneLength };
}

function makePhysicalPickGeometry() {
  const toWorld = (millimeters: number) => millimeters / 25.4 * INCH_TO_WORLD;
  const width = toWorld(AUTHORED_PICK_DIMENSIONS_MM.width);
  const height = toWorld(AUTHORED_PICK_DIMENSIONS_MM.height);
  const thickness = toWorld(AUTHORED_PICK_DIMENSIONS_MM.thickness);
  const shape = new THREE.Shape();
  shape.moveTo(0, -height / 2);
  shape.quadraticCurveTo(width * 0.48, -height * 0.42, width / 2, -height * 0.08);
  shape.quadraticCurveTo(width * 0.42, height * 0.42, 0, height / 2);
  shape.quadraticCurveTo(-width * 0.42, height * 0.42, -width / 2, -height * 0.08);
  shape.quadraticCurveTo(-width * 0.48, -height * 0.42, 0, -height / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 2, bevelSize: thickness * 0.5, bevelThickness: thickness * 0.5 });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function makeFallbackForearmGeometry() {
  return new THREE.LatheGeometry([
    new THREE.Vector2(0.27, -0.72), new THREE.Vector2(0.285, -0.4),
    new THREE.Vector2(0.30, 0.08), new THREE.Vector2(0.32, 1.1),
    new THREE.Vector2(0.315, 1.75), new THREE.Vector2(0.30, 2.25),
    new THREE.Vector2(0.27, 2.6), new THREE.Vector2(0.23, 2.78)
  ], 16);
}

function makeHand(side: "left" | "right", shared: { segment: THREE.BufferGeometry; joint: THREE.BufferGeometry; nailGeometry: THREE.BufferGeometry; skin: THREE.Material; skinLight: THREE.Material; nail: THREE.Material; accent: THREE.Material; pick: THREE.Material }): HandVisual {
  const group = new THREE.Group(); const palm = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), shared.skin); palm.scale.set(0.45, 0.3, 0.58); group.add(palm);
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.42, 8, 12), shared.skin); wrist.rotation.x = Math.PI / 2; group.add(wrist);
  const wristBlend = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), shared.skin); wristBlend.scale.set(1.15, 1.05, 1.15); wrist.add(wristBlend);
  // Keep the fallback anatomically readable when a GLB is unavailable: the
  // forearm overlaps the wrist capsule and uses a rounded shoulder rather
  // than ending in the old floating primitive hand.
  const forearm = new THREE.Mesh(makeFallbackForearmGeometry(), shared.skin);
  // Parent the arm to the moving wrist so fallback rigs remain connected at
  // every fret/gesture update instead of using stale scene coordinates.
  wrist.add(forearm);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), shared.skin);
  elbow.position.set(0, 2.78, 0);
  elbow.scale.set(1, 0.9, 1);
  forearm.add(elbow);
  const fingerLengths = [[0.52, 0.39, 0.29], [0.56, 0.43, 0.32], [0.54, 0.41, 0.31], [0.46, 0.35, 0.26]];
  const fingers = Array.from({ length: 4 }, (_, index) => ({ segments: Array.from({ length: 3 }, (_, segmentIndex) => makeSegment(group, shared.segment, shared.joint, shared.nailGeometry, shared.skinLight, shared.skin, shared.nail, fingerLengths[index][segmentIndex])), accent: (() => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), shared.accent); mesh.scale.set(0.14, 0.06, 0.14); mesh.visible = false; group.add(mesh); return mesh; })() }));
  const thumb = [makeSegment(group, shared.segment, shared.joint, shared.nailGeometry, shared.skin, shared.skinLight, shared.nail, 0.38), makeSegment(group, shared.segment, shared.joint, shared.nailGeometry, shared.skin, shared.skinLight, shared.nail, 0.3)];
  // Default placement mirrors the two physical roles; the authored GLBs take
  // over when available, while this fallback still reads as a connected arm.
  forearm.position.set(0, 0, 0);
  if (side === "left") forearm.rotation.z = Math.PI / 2;
  else forearm.rotation.set(0, 0, -0.34);
  const pick = side === "right" ? new THREE.Mesh(makePhysicalPickGeometry(), shared.pick) : undefined; if (pick) { pick.visible = false; group.add(pick); }
  return { group, palm, wrist, forearm, fingers, thumb, pick };
}

function disposeObjectResources(root: THREE.Object3D) { const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>(); root.traverse((object) => { if (!(object instanceof THREE.Mesh)) return; geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => { materials.add(material); const textured = material as THREE.MeshStandardMaterial; [textured.map, textured.normalMap, textured.roughnessMap, textured.metalnessMap, textured.emissiveMap, textured.aoMap, textured.alphaMap].forEach((texture) => { if (texture) textures.add(texture); }); }); }); geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); textures.forEach((texture) => texture.dispose()); }
function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer) { disposeObjectResources(scene); renderer.dispose(); }

const FINGER_LABELS = ["Index", "Middle", "Ring", "Pinky"] as const;
const EMPTY_ACTIVE_STRINGS: readonly number[] = [];

function chordShapesDiffer(from: GuitarChordShape | null | undefined, to: GuitarChordShape | null | undefined) {
  const previous = normalizeGuitarChord(from);
  const next = normalizeGuitarChord(to);
  return previous.frets.some((fret, string) => fret !== next.frets[string])
    || previous.fingers?.some((finger, string) => finger !== next.fingers?.[string]) === true
    || JSON.stringify(previous.barre ?? null) !== JSON.stringify(next.barre ?? null);
}

function sharedFingerTargets(from: GuitarChordShape | null | undefined, to: GuitarChordShape | null | undefined) {
  const previous = chordToLeftHandTargets(from);
  const next = chordToLeftHandTargets(to);
  return next.filter((target) => previous.some((candidate) => candidate.finger === target.finger && candidate.string === target.string && candidate.fret === target.fret));
}

/** Offline, asset-free studio guitar. Static resources are shared and the renderer is event-driven. */
export default function GuitarTechnique3D({ chord, transitionFrom, handedness = "right", technique = "strumming", activePatternStep = 0, activeStrings = EMPTY_ACTIVE_STRINGS, motionPlan, token, manualPhase, selectedContact = null, transitionPhase, selectionOnly = false, playbackRate = 1, mode = "both", labels = true, className, gestureKey, autoPlay = false, onTargetChange, onGesture }: GuitarTechnique3DProps) {
  const initialPresetRef = useRef<PresetName>(guitarPresetForMode(mode)); const hostRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null); const chordRef = useRef(normalizeGuitarChord(chord)); const transitionFromRef = useRef(normalizeGuitarChord(transitionFrom)); const configRef = useRef({ technique, activePatternStep, activeStrings: [...activeStrings], motionPlan, token, manualPhase, selectedContact, transitionPhase, selectionOnly, playbackRate, handedness, mode }); const initialHandednessRef = useRef(handedness); const initialModeRef = useRef(mode); const onGestureRef = useRef(onGesture); const targetRef = useRef({ string: 0, fret: 1 }); const handsRef = useRef<{ left: HandVisual | null; right: HandVisual | null }>({ left: null, right: null }); const refreshRef = useRef<(() => void) | null>(null); const gestureRef = useRef<(() => void) | null>(null); const cameraPresetRef = useRef<(name: PresetName) => void>(() => {}); const cameraActionRef = useRef<(action: "rotate-left" | "rotate-right" | "zoom-in" | "zoom-out" | "reset") => void>(() => {}); const transitionPlayRef = useRef<(() => void) | null>(null); const requestedPresetRef = useRef<PresetName>(initialPresetRef.current); const lastGestureKeyRef = useRef<string | number | undefined>(); const rafRef = useRef<number | null>(null); const [fallback, setFallback] = useState(false); const [target, setTarget] = useState(targetRef.current); const [preset, setPreset] = useState<PresetName>(initialPresetRef.current); const [showLabels, setShowLabels] = useState(labels); const [transitionPlaying, setTransitionPlaying] = useState(false);
  const transitionCancelRef = useRef<() => void>(() => {});
  const selectedContactRef = useRef<GuitarContact | null>(selectedContact);
  selectedContactRef.current = selectedContact;
  const authoredRef = useRef<{ left: import("./guitar3d/authoredHands").AuthoredHandRig | null; right: import("./guitar3d/authoredHands").AuthoredHandRig | null }>({ left: null, right: null }); const authoredStateRef = useRef<{ left: "loading" | "ready" | "fallback"; right: "loading" | "ready" | "fallback"; guitar: "loading" | "ready" | "fallback" }>({ left: "loading", right: "loading", guitar: "loading" }); const [authoredStatus, setAuthoredStatus] = useState("Loading Blender-authored guitar and detailed fretting/picking hands…");
  const authoredFnsRef = useRef<{ position: typeof import("./guitar3d/authoredHands").positionAuthoredHand; pose: typeof import("./guitar3d/authoredHands").poseAuthoredFinger; reset: typeof import("./guitar3d/authoredHands").resetAuthoredRig; barre: typeof import("./guitar3d/authoredHands").poseAuthoredBarre; splay: typeof import("./guitar3d/authoredHands").splayAuthoredFingers } | null>(null);
  useEffect(() => { transitionCancelRef.current(); chordRef.current = normalizeGuitarChord(chord); refreshRef.current?.(); }, [chord]);
  useEffect(() => { transitionCancelRef.current(); transitionFromRef.current = normalizeGuitarChord(transitionFrom); refreshRef.current?.(); }, [transitionFrom]);
  useEffect(() => { setShowLabels(labels); }, [labels]);
  useEffect(() => { onGestureRef.current = onGesture; }, [onGesture]);
  const activeStringsKey = activeStrings.join(",");
  const selectedContactKey = selectedContact ? `${selectedContact.string}:${selectedContact.fret}` : "";
  useEffect(() => { transitionCancelRef.current(); const nextActiveStrings = activeStringsKey.split(",").filter(Boolean).map(Number).filter(Number.isFinite); configRef.current = { technique, activePatternStep, activeStrings: nextActiveStrings, motionPlan, token, manualPhase, selectedContact: selectedContactRef.current, transitionPhase, selectionOnly, playbackRate, handedness, mode }; const { left, right } = handsRef.current; if (left) left.group.visible = mode === "left-hand" || mode === "both"; if (right) right.group.visible = mode === "right-hand" || mode === "both"; refreshRef.current?.(); }, [activePatternStep, activeStringsKey, handedness, manualPhase, mode, motionPlan, playbackRate, selectedContactKey, selectionOnly, technique, token, transitionPhase]);
  useEffect(() => {
    const host = hostRef.current; const canvas = canvasRef.current; if (!host || !canvas) return; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" }); } catch { setFallback(true); return; }
    setFallback(false); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x20282a); const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100); const initialView = GUITAR_CAMERA_PRESETS[guitarPresetForMode(initialModeRef.current)]; camera.position.set(...initialView.position); camera.lookAt(...initialView.target);
    scene.add(new THREE.HemisphereLight(0xe9f1ed, 0x6b5244, 1.9)); const key = new THREE.DirectionalLight(0xffe4c2, 2.25); key.position.set(-5, 9, 7); scene.add(key); const fill = new THREE.DirectionalLight(0x9fc7e4, 1.8); fill.position.set(6, 4, 1); scene.add(fill); const rim = new THREE.DirectionalLight(0xd0e8dc, 1.6); rim.position.set(0, 5, -8); scene.add(rim);
    const guitar = createProfessionalAcousticGuitar(renderer);
    const sharedSegment = new THREE.CylinderGeometry(0.5, 0.62, 1, 10);
    const sharedJoint = new THREE.SphereGeometry(1, 10, 8);
    const sharedNail = new THREE.SphereGeometry(1, 8, 6);
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xb96858, roughness: 0.56, sheen: 0.16, sheenColor: 0xd98272 });
    const skinLight = new THREE.MeshPhysicalMaterial({ color: 0xc97b68, roughness: 0.52, sheen: 0.18, sheenColor: 0xe8a18e });
    const nail = new THREE.MeshPhysicalMaterial({ color: 0xffd5bd, roughness: 0.33, clearcoat: 0.22 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xf4b350, emissive: 0x7a3206, emissiveIntensity: 0.48, roughness: 0.34 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x68d4d0, emissive: 0x073a3b, emissiveIntensity: 0.45 });
    const pickMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd98b4a, roughness: 0.3, clearcoat: 0.45 });
    const contact = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: 0.92 }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = -1.22; contact.position.z = 2.4;
    scene.add(contact, guitar);
    const shared = { segment: sharedSegment, joint: sharedJoint, nailGeometry: sharedNail, skin, skinLight, nail, accent: skinLight, pick: pickMaterial }; const left = makeHand("left", shared); left.group.visible = initialModeRef.current === "left-hand" || initialModeRef.current === "both"; scene.add(left.group); const right = makeHand("right", shared); right.group.visible = initialModeRef.current === "right-hand" || initialModeRef.current === "both"; scene.add(right.group); handsRef.current = { left, right };
    const markers = Array.from({ length: 6 }, () => { const marker = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), accent); marker.visible = false; scene.add(marker); return marker; }); const transitionMarkers = Array.from({ length: 4 }, () => { const marker = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), cyan); marker.visible = false; scene.add(marker); return marker; }); const targetMarker = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), accent); targetMarker.rotation.x = Math.PI / 2; const selectedContactMarker = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 24), cyan); selectedContactMarker.rotation.x = Math.PI / 2; scene.add(targetMarker, selectedContactMarker); const motion: { current: { started: number; duration: number; direction: "up" | "down" | "neutral" } | null } = { current: null }; const transitionMotion: { current: { started: number; duration: number; from: ReturnType<typeof normalizeGuitarChord>; to: ReturnType<typeof normalizeGuitarChord> } | null } = { current: null }; const reducedMotion = (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false) || document.documentElement.dataset.reducedMotion === "true"; const developmentDiagnostics = process.env.NODE_ENV !== "production"; let renderCount = 0; let inViewport = true; let documentVisible = document.visibilityState === "visible"; let disposed = false; let resumeAnimation: (() => void) | null = null;
    transitionCancelRef.current = () => { transitionMotion.current = null; if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } transitionMarkers.forEach((marker) => { marker.visible = false; }); setTransitionPlaying(false); };
    const disposeAuthoredRig = (rig: import("./guitar3d/authoredHands").AuthoredHandRig) => { rig.root.traverse((object) => { if (!(object instanceof THREE.Mesh)) return; object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose()); }); };
    const updateAuthoredStatus = () => { const state = authoredStateRef.current; const label = (side: "left" | "right") => state[side] === "ready" ? "detailed" : state[side] === "fallback" ? "simplified fallback" : "loading"; const guitarLabel = state.guitar === "ready" ? "Blender-authored" : state.guitar === "fallback" ? "procedural fallback" : "loading"; setAuthoredStatus(`Guitar asset: ${guitarLabel}; left hand: ${label("left")}; right hand: ${label("right")}`); };
    const loadOneAuthoredHand = async (side: "left" | "right", position: { x: number; y: number; z: number }, load: typeof import("./guitar3d/authoredHands").loadAuthoredHand, positionAuthoredHand: typeof import("./guitar3d/authoredHands").positionAuthoredHand) => { try { const rig = await load(side); if (disposed) { disposeAuthoredRig(rig); return; } authoredRef.current[side] = rig; authoredStateRef.current[side] = rig.sourceQuality === "cc0" ? "ready" : "fallback"; scene.add(rig.root); rig.root.visible = false; positionAuthoredHand(rig, position, { role: side === (configRef.current.handedness === "left" ? "right" : "left") ? "fretting" : "picking", handedness: configRef.current.handedness }); rig.root.remove(rig.pick); rig.pick.scale.setScalar(1); rig.pick.position.set(0, 0, 0); rig.pick.quaternion.identity(); scene.add(rig.pick); rig.pick.visible = false; updateAuthoredStatus(); refreshRef.current?.(); } catch (error) { if (process.env.NODE_ENV !== "production") console.warn(`[ChordHero] authored ${side} hand setup failed`, error); if (!disposed) { authoredStateRef.current[side] = "fallback"; updateAuthoredStatus(); refreshRef.current?.(); } } };
    void import("./guitar3d/authoredHands").then(({ loadAuthoredHand, positionAuthoredHand, poseAuthoredFinger, resetAuthoredRig, poseAuthoredBarre, splayAuthoredFingers }) => { authoredFnsRef.current = { position: positionAuthoredHand, pose: poseAuthoredFinger, reset: resetAuthoredRig, barre: poseAuthoredBarre, splay: splayAuthoredFingers }; void Promise.all([loadOneAuthoredHand("left", { x: -0.82, y: 1.08, z: -1.1 }, loadAuthoredHand, positionAuthoredHand), loadOneAuthoredHand("right", { x: 0.2, y: 1.05, z: 6.0 }, loadAuthoredHand, positionAuthoredHand)]); }).catch(() => { if (!disposed) { authoredStateRef.current.left = "fallback"; authoredStateRef.current.right = "fallback"; updateAuthoredStatus(); refreshRef.current?.(); } });
    void import("./guitar3d/authoredAcousticGuitar").then(({ loadAuthoredAcousticGuitar }) => loadAuthoredAcousticGuitar()).then((authoredGuitar) => { if (disposed) { disposeObjectResources(authoredGuitar); return; } scene.remove(guitar); disposeObjectResources(guitar); scene.add(authoredGuitar); authoredStateRef.current.guitar = "ready"; updateAuthoredStatus(); render(); }).catch(() => { if (!disposed) { authoredStateRef.current.guitar = "fallback"; updateAuthoredStatus(); render(); } }); const render = () => { if (!disposed && inViewport && documentVisible) { renderer.render(scene, camera); renderCount += 1; if (developmentDiagnostics) { const errors = [authoredRef.current.left?.tipError, authoredRef.current.right?.tipError].filter((value): value is number => Number.isFinite(value)); canvas.dataset.chordHeroDiagnostics = JSON.stringify({ renderCount, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, authored: authoredStateRef.current, maxContactError: errors.length ? Math.max(...errors) : null }); } } };
    const updateAuthoredLeft = () => { const transition = transitionMotion.current; const transitionProgress = transition ? (typeof configRef.current.transitionPhase === "number" ? THREE.MathUtils.clamp(configRef.current.transitionPhase, 0, 1) : (reducedMotion ? 1 : Math.min(1, (performance.now() - transition.started) / transition.duration))) : 1; const rigs = authoredRef.current; const fns = authoredFnsRef.current; if (!rigs || !fns) return; const rig = configRef.current.handedness === "left" ? rigs.right : rigs.left; const other = configRef.current.handedness === "left" ? rigs.left : rigs.right; const frettingVisible = configRef.current.mode === "left-hand" || configRef.current.mode === "both"; const pickingVisible = configRef.current.mode === "right-hand" || configRef.current.mode === "both"; if (handsRef.current.left) handsRef.current.left.group.visible = frettingVisible && !rig; if (handsRef.current.right) handsRef.current.right.group.visible = pickingVisible && !other; if (rig) rig.root.visible = frettingVisible; if (other) other.root.visible = pickingVisible; if (!rig) return; const targets = chordToLeftHandTargets(chordRef.current); const manual = chooseManualFinger(targets, targetRef.current.string, targetRef.current.fret); const averageFrets = targets.map((item) => item.fret); if (!configRef.current.selectionOnly && targetRef.current.fret > 0 && (!manual.owned || manual.override)) averageFrets.push(targetRef.current.fret); const averageFret = averageFrets.length ? averageFrets.reduce((sum, fret) => sum + fret, 0) / averageFrets.length : 2; fns.position(rig, { x: configRef.current.handedness === "left" ? 0.82 : -0.82, y: AUTHORED_HAND_WRIST_TARGET_Y.fretting, z: guitarFretContactZ(averageFret) - 0.34 }, { role: "fretting", handedness: configRef.current.handedness }); fns.reset(rig); const byFinger = new Map<number, typeof targets>(); targets.forEach((item) => { if (!item.barre) byFinger.set(item.finger, [...(byFinger.get(item.finger) ?? []), item]); }); const names = ["index-finger", "middle-finger", "ring-finger", "pinky-finger"]; if (chordRef.current.barre && !transition) fns.barre(rig, barreContactSpan(chordRef.current.barre.fret, chordRef.current.barre.from, chordRef.current.barre.to)); names.forEach((name, index) => { const finger = index + 1; const item = byFinger.get(finger)?.[0]; const manualTarget = !configRef.current.selectionOnly && manual.finger === finger && !transition && !manual.owned && targetRef.current.fret > 0 ? guitarStringContactPoint(targetRef.current.string, targetRef.current.fret, 0.58) : null; const target = manualTarget ?? (item ? (() => { const destination = guitarStringContactPoint(item.string, item.fret, 0.58); if (!transition) return destination; const source = chordToLeftHandTargets(transition.from).find((candidate) => candidate.finger === item.finger && candidate.string === item.string) ?? chordToLeftHandTargets(transition.from).find((candidate) => candidate.finger === item.finger); if (!source) return destination; const start = guitarStringContactPoint(source.string, source.fret, 0.58); return { x: start.x + (destination.x - start.x) * transitionProgress, y: start.y + (destination.y - start.y) * transitionProgress, z: start.z + (destination.z - start.z) * transitionProgress }; })() : null); if (target && !(chordRef.current.barre?.finger === finger && item?.barre && !transition)) fns.pose(rig, name, target); }); }; const leftPoints = Array.from({ length: 4 }, () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]); const updateLeft = () => { const shape = chordRef.current; const transition = transitionMotion.current; const transitionProgress = transition ? (typeof configRef.current.transitionPhase === "number" ? THREE.MathUtils.clamp(configRef.current.transitionPhase, 0, 1) : (reducedMotion ? 1 : Math.min(1, (performance.now() - transition.started) / transition.duration))) : 1; const targets = chordToLeftHandTargets(shape); const byFinger = new Map<number, typeof targets>(); targets.forEach((item) => byFinger.set(item.finger, [...(byFinger.get(item.finger) ?? []), item])); const manualOwned = (configRef.current.selectionOnly || Boolean(transition)) ? true : targets.some((item) => item.string === targetRef.current.string && item.fret === targetRef.current.fret); const used = new Set(targets.map((item) => item.finger)); const manualFinger = !manualOwned ? ([1, 2, 3, 4].find((finger) => !used.has(finger)) ?? 4) : 0; const allFretValues = targets.map((item) => item.fret); if (!manualOwned && targetRef.current.fret > 0) allFretValues.push(targetRef.current.fret); const averageFret = allFretValues.length ? allFretValues.reduce((sum, fret) => sum + fret, 0) / allFretValues.length : 2; const palmZ = guitarFretContactZ(averageFret) - 0.34; const handSign = configRef.current.handedness === "left" ? -1 : 1; left.palm.position.set(handSign * -0.82, 1.12, palmZ); left.wrist.position.set(handSign * -0.82, 0.88, palmZ - 0.62); left.wrist.rotation.x = Math.PI / 2; left.fingers.forEach((finger, index) => { const fingerNumber = index + 1; const fingerTargets = !manualOwned && fingerNumber === manualFinger ? [] : byFinger.get(fingerNumber) ?? []; const barre = Boolean(fingerNumber === (shape.barre?.finger ?? 1) && shape.barre && fingerTargets.some((item) => item.barre) && !transition); const base = leftPoints[index][0].set(handSign * (-1.3 + index * 0.3), 0.92 + Math.abs(index - 1.5) * 0.025, palmZ - 0.18 + index * 0.035); let end: THREE.Vector3; if (barre) { const span = barreContactSpan(shape.barre!.fret, shape.barre!.from, shape.barre!.to); const start = span.start; const finish = span.end; const points = leftPoints[index]; points[1].set(start.x, 0.7, start.z); points[2].set(finish.x, 0.59, finish.z); points[3].set(finish.x, 0.56, finish.z); setSegment(finger.segments[0], points[0], points[1], 0.17); setSegment(finger.segments[1], points[1], points[2], 0.145, Math.abs(finish.x - start.x)); setSegment(finger.segments[2], points[2], points[3], 0.12); finger.accent.position.set((start.x + finish.x) / 2, 0.57, start.z); finger.accent.scale.set(Math.max(1, Math.abs(finish.x - start.x) / 0.14), 0.42, 0.72); finger.accent.visible = true; return; } const target = fingerTargets[0] ?? (fingerNumber === manualFinger ? { string: targetRef.current.string, fret: targetRef.current.fret } : null); if (!target || target.fret <= 0) { finger.segments.forEach((segment) => { segment.mesh.visible = false; segment.joint.visible = false; segment.pad.visible = false; segment.nail.visible = false; }); finger.accent.visible = false; return; } const contact = (() => { const destination = guitarStringContactPoint(target.string, target.fret, 0.58); if (!transition) return destination; const source = chordToLeftHandTargets(transition.from).find((candidate) => candidate.finger === target.finger && candidate.string === target.string) ?? chordToLeftHandTargets(transition.from).find((candidate) => candidate.finger === target.finger); if (!source) return destination; const start = guitarStringContactPoint(source.string, source.fret, 0.58); return { x: start.x + (destination.x - start.x) * transitionProgress, y: start.y + (destination.y - start.y) * transitionProgress, z: start.z + (destination.z - start.z) * transitionProgress }; })(); const points = leftPoints[index]; const boneKey = index === 0 ? "index" : index === 1 ? "middle" : index === 2 ? "ring" : "little"; const solved = solveFingerChain({ x: base.x, y: base.y, z: base.z }, contact, GUITAR_FINGER_BONE_LENGTHS[boneKey], index % 2 === 0 ? 1 : -1); points.forEach((point, pointIndex) => point.set(solved.points[pointIndex].x, solved.points[pointIndex].y, solved.points[pointIndex].z)); setSegment(finger.segments[0], points[0], points[1], 0.17); setSegment(finger.segments[1], points[1], points[2], 0.145); setSegment(finger.segments[2], points[2], points[3], 0.12); finger.segments.forEach((segment) => { segment.mesh.visible = true; segment.joint.visible = true; segment.pad.visible = true; segment.nail.visible = true; }); finger.accent.scale.setScalar(1); finger.accent.position.copy(points[3]); finger.accent.visible = true; }); const thumbPoints = [new THREE.Vector3(handSign * -0.45, 0.84, palmZ - 0.18), new THREE.Vector3(handSign * 0.08, 0.68, palmZ - 0.34), new THREE.Vector3(handSign * 0.5, 0.62, palmZ - 0.28)]; left.thumb.forEach((segment, index) => setSegment(segment, thumbPoints[index], thumbPoints[index + 1], index ? 0.15 : 0.18)); markers.forEach((marker, string) => { const fret = shape.frets[string]; marker.visible = fret > 0; const contact = guitarStringContactPoint(string, fret > 0 ? fret : 0, 0.6); marker.position.set(contact.x, 0.61, contact.z); }); const manualContact = guitarStringContactPoint(targetRef.current.string, targetRef.current.fret, 0.62); targetMarker.position.set(manualContact.x, manualContact.y, manualContact.z); targetMarker.visible = configRef.current.mode !== "right-hand" && !configRef.current.selectionOnly; };
    const resolveRightPlan = () => configRef.current.motionPlan ?? (configRef.current.token !== undefined ? rightHandTokenToMotionPlan(configRef.current.token, configRef.current.technique) : techniqueToMotionPlan(configRef.current.technique, configRef.current.activePatternStep, configRef.current.activeStrings));
    const motionPhase = (progress: number) => typeof configRef.current.manualPhase === "number" ? THREE.MathUtils.clamp(configRef.current.manualPhase, 0, 1) : motion.current ? Math.min(1, progress) : 0;
    const isContactPose = () => !rightPlanRef.current.rest && (Boolean(motion.current) || typeof configRef.current.manualPhase === "number");
    const contactString = (plan: TechniqueMotion, phase: number) => { const contacts = techniqueMotionContacts(plan); return contacts[Math.min(contacts.length - 1, Math.floor(Math.min(0.9999, Math.max(0, phase)) * contacts.length))] ?? plan.strings[0] ?? 0; };
    const contactLift = (plan: TechniqueMotion, phase: number) => Math.abs((plan.kind === "strum" ? (phase * Math.max(1, plan.strings.length)) % 1 : phase) - 0.5) * 0.3;
    const strumContactX = (plan: TechniqueMotion, phase: number, z: number) => {
      const contacts = techniqueMotionContacts(plan);
      if (!contacts.length) return 0;
      const position = THREE.MathUtils.clamp(phase * contacts.length - 0.5, 0, contacts.length - 1);
      const first = Math.floor(position);
      return THREE.MathUtils.lerp(guitarStringXAt(contacts[first], z), guitarStringXAt(contacts[Math.min(first + 1, contacts.length - 1)], z), position - first);
    };
    const authoredPickPosition = new THREE.Vector3(); const updateAuthoredRight = (progress = 0) => { const rigs = authoredRef.current; const fns = authoredFnsRef.current; if (!rigs || !fns) return; if (rigs.left?.pick) rigs.left.pick.visible = false; if (rigs.right?.pick) rigs.right.pick.visible = false; const rig = configRef.current.handedness === "left" ? rigs.left : rigs.right; if (!rig) return; const plan = rightPlanRef.current; const active = isContactPose(); const phase = motionPhase(progress); const handSign = configRef.current.handedness === "left" ? -1 : 1; const pickingVisible = configRef.current.mode === "right-hand" || configRef.current.mode === "both"; const strumZ = plan.mute ? 7.0 : 5.72; fns.position(rig, { x: handSign * 0.2, y: AUTHORED_HAND_WRIST_TARGET_Y.picking, z: plan.mute ? 7.35 : 6.25 }, { role: "picking", handedness: configRef.current.handedness, roll: active && plan.kind === "strum" ? (plan.direction === "up" ? -0.18 : plan.direction === "down" ? 0.18 : 0) : 0 }); fns.reset(rig); fns.splay(rig); const pose = (name: string, string: number, dip: number) => fns.pose(rig, name, { x: plan.kind === "strum" ? strumContactX(plan, phase, strumZ) : guitarStringXAt(string, strumZ), y: 0.58 - dip, z: strumZ }); if (!plan.rest && plan.kind === "fingerpick") { const assignments = plan.fingerAssignments ?? []; if (assignments.length) assignments.forEach((assignment) => pose(assignment.finger === "thumb" ? "thumb" : `${assignment.finger}-finger`, assignment.string, active ? -contactLift(plan, phase) : -0.15)); else { const thumbString = plan.strings[0] ?? 0; pose("thumb", thumbString, active ? -contactLift(plan, phase) : -0.15); plan.strings.slice(1, 5).forEach((string, index) => pose(["index-finger", "middle-finger", "ring-finger", "pinky-finger"][index], string, active ? -contactLift(plan, phase) : -0.15)); } } else if (!plan.rest) { const string = contactString(plan, phase); pose("index-finger", string, active ? -contactLift(plan, phase) : -0.15); if (plan.kind === "pick") pose("thumb", string, active ? -contactLift(plan, phase) : -0.15); } const thumbTip = rig.tips.get("thumb"); const indexTip = rig.tips.get("index-finger"); if (rig.pick) { rig.pick.visible = pickingVisible && plan.kind === "pick" && Boolean(thumbTip && indexTip); if (plan.rest) rig.pick.visible = false; if (rig.pick.visible && thumbTip && indexTip) { thumbTip.getWorldPosition(authoredThumbTipPosition); indexTip.getWorldPosition(authoredIndexTipPosition); authoredPickPosition.copy(authoredThumbTipPosition).add(authoredIndexTipPosition).multiplyScalar(0.5); authoredPickPosition.x -= handSign * 0.12; authoredPickPosition.y += 0.1; authoredPickPosition.z += 0.04; rig.pick.position.copy(authoredPickPosition); rig.pick.rotation.set(0, handSign * (active && plan.direction === "up" ? -0.3 : 0.3), 0); } } }; const rightPoints = Array.from({ length: 4 }, () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]); const rightThumbPoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; const rightPlanRef = { current: resolveRightPlan() }; const updateRight = (progress = 0) => { updateAuthoredRight(progress); const plan = rightPlanRef.current; const active = isContactPose(); const phase = motionPhase(progress); const handSign = configRef.current.handedness === "left" ? -1 : 1; const strumZ = plan.mute ? 7.0 : 5.72; const selectedContact = contactString(plan, phase); right.palm.position.set(handSign * 0.2, plan.mute ? 0.67 : 1.03, strumZ + 0.28); right.wrist.position.set(handSign * 0.2, plan.mute ? 0.76 : 0.82, strumZ + 0.86); right.wrist.rotation.x = Math.PI / 2; right.wrist.rotation.z = active && plan.kind === "strum" ? (plan.direction === "up" ? -0.22 : plan.direction === "down" ? 0.22 : 0) : 0; right.fingers.forEach((finger, index) => { const namedAssignment = plan.fingerAssignments?.find((assignment) => assignment.finger === ["index", "middle", "ring", "pinky"][index]); const string = plan.kind === "strum" ? selectedContact : namedAssignment?.string ?? plan.strings[index % Math.max(1, plan.strings.length)] ?? index; const isActive = !plan.rest && (plan.kind === "fingerpick" ? (plan.fingerAssignments?.length ? Boolean(namedAssignment) : plan.strings.includes(string)) : plan.kind === "pick" ? index === 0 : index === 0); const anchor = rightPoints[index][0].set(handSign * (-0.5 + index * 0.27), 0.84 + index * 0.025, strumZ + 0.5 + index * 0.04); const contactX = plan.kind === "strum" ? strumContactX(plan, phase, strumZ) : STRING_X(string, strumZ); const dip = active && isActive ? -contactLift(plan, phase) : -0.15; const end = rightPoints[index][3].set(contactX, 0.58 - dip, strumZ); const points = rightPoints[index]; points[1].lerpVectors(anchor, end, 0.34); points[1].y += plan.kind === "fingerpick" ? 0.18 : 0.24; points[2].lerpVectors(anchor, end, 0.68); points[2].y += 0.1; setSegment(finger.segments[0], points[0], points[1], 0.16); setSegment(finger.segments[1], points[1], points[2], 0.135); setSegment(finger.segments[2], points[2], points[3], 0.11); finger.segments.forEach((segment) => { segment.mesh.visible = true; segment.joint.visible = true; segment.pad.visible = true; segment.nail.visible = true; }); finger.accent.position.copy(end); finger.accent.visible = active && isActive; }); const thumbAssignment = plan.fingerAssignments?.find((assignment) => assignment.finger === "thumb"); const thumbString = thumbAssignment?.string; rightThumbPoints[0].set(handSign * 0.52, 0.86, strumZ + 0.38); rightThumbPoints[1].set(handSign * 0.34, 0.7, strumZ + 0.08); rightThumbPoints[2].set(thumbString === undefined ? handSign * 0.16 : STRING_X(thumbString, strumZ), thumbString === undefined ? 0.61 : 0.58 - (active ? -contactLift(plan, phase) : -0.15), strumZ); right.thumb.forEach((segment, index) => setSegment(segment, rightThumbPoints[index], rightThumbPoints[index + 1], index ? 0.14 : 0.17)); if (right.pick) { right.pick.visible = !plan.rest && plan.kind === "pick"; const selectedString = plan.strings[0] ?? configRef.current.activePatternStep % 6; right.pick.position.set(STRING_X(selectedString, strumZ), 0.72 - (active ? Math.sin(Math.PI * phase) * 0.08 : 0), strumZ + 0.5); right.pick.rotation.set(Math.PI / 2, 0, active ? (plan.direction === "up" ? -0.3 : plan.direction === "down" ? 0.3 : 0) : 0); } };
    const updateTransitionMarkers = (progress: number) => {
      const active = transitionMotion.current;
      if (!active || configRef.current.mode === "right-hand") { transitionMarkers.forEach((marker) => { marker.visible = false; }); return; }
      const destinationTargets = chordToLeftHandTargets(active.to);
      const planted = sharedFingerTargets(active.from, active.to);
      destinationTargets.slice(0, transitionMarkers.length).forEach((target, index) => {
        const marker = transitionMarkers[index];
        const source = chordToLeftHandTargets(active.from).find((candidate) => candidate.finger === target.finger && candidate.string === target.string)
          ?? chordToLeftHandTargets(active.from).find((candidate) => candidate.finger === target.finger);
        const from = source ? guitarStringContactPoint(source.string, source.fret, 0.61) : guitarStringContactPoint(target.string, target.fret, 0.61);
        const to = guitarStringContactPoint(target.string, target.fret, 0.61);
        marker.position.set(from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress, from.z + (to.z - from.z) * progress);
        marker.scale.setScalar(planted.some((candidate) => candidate.finger === target.finger && candidate.string === target.string && candidate.fret === target.fret) ? 1.55 : 0.9);
        marker.visible = true;
      });
      transitionMarkers.slice(destinationTargets.length).forEach((marker) => { marker.visible = false; });
    };
    const ensureControlledTransition = () => {
      if (typeof configRef.current.transitionPhase !== "number") return;
      const from = transitionFromRef.current;
      const to = chordRef.current;
      if (!chordShapesDiffer(from, to)) { transitionMotion.current = null; return; }
      const active = transitionMotion.current;
      if (!active || active.from !== from || active.to !== to) {
        transitionMotion.current = { started: performance.now(), duration: 900, from, to };
      }
    };
    const updateSelectedContactMarker = () => {
      const contact = configRef.current.selectedContact;
      const valid = Boolean(contact && Number.isInteger(contact.string) && contact.string >= 0 && contact.string < 6 && Number.isFinite(contact.fret) && contact.fret >= 0);
      selectedContactMarker.visible = valid && configRef.current.mode !== "right-hand";
      if (valid && contact) {
        const point = guitarStringContactPoint(contact.string, contact.fret, 0.62);
        selectedContactMarker.position.set(point.x, point.y, point.z);
      }
    };
    const animateTransition = () => {
      const active = transitionMotion.current;
      if (disposed || !active || !inViewport || !documentVisible || typeof configRef.current.transitionPhase === "number") { rafRef.current = null; return; }
      const progress = reducedMotion ? 1 : Math.min(1, (performance.now() - active.started) / active.duration);
      // Repose the hand on every transition frame using physical contact
      // points rather than rounding fractional frets.
      updateLeft(); updateAuthoredLeft();
      left.group.position.z = 0;
      const authoredRig = authoredRef.current[configRef.current.handedness === "left" ? "right" : "left"];
      updateTransitionMarkers(progress); render();
      if (progress < 1) rafRef.current = requestAnimationFrame(animateTransition);
      else { rafRef.current = null; transitionMotion.current = null; left.group.position.z = 0; updateLeft(); updateAuthoredLeft(); transitionMarkers.forEach((marker) => { marker.visible = false; }); setTransitionPlaying(false); render(); }
    };
    const refresh = () => { ensureControlledTransition(); updateSelectedContactMarker(); if (typeof configRef.current.manualPhase === "number" && motion.current) { motion.current = null; if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; } /* transition markers are updated by the dedicated cue loop */ rightPlanRef.current = resolveRightPlan(); updateLeft(); updateAuthoredLeft(); updateRight(configRef.current.manualPhase ?? 0); updateTransitionMarkers(typeof configRef.current.transitionPhase === "number" ? THREE.MathUtils.clamp(configRef.current.transitionPhase, 0, 1) : 1); render(); }; const animate = () => { if (disposed || !motion.current || !inViewport || !documentVisible) { rafRef.current = null; return; } const active = motion.current; const progress = reducedMotion ? 1 : Math.min(1, (performance.now() - active.started) / active.duration); updateRight(progress); render(); if (progress < 1) rafRef.current = requestAnimationFrame(animate); else { rafRef.current = null; motion.current = null; updateRight(); render(); } }; resumeAnimation = animate; gestureRef.current = () => { transitionCancelRef.current(); const plan = resolveRightPlan(); rightPlanRef.current = plan; if (plan.rest) { motion.current = null; updateRight(0); render(); onGestureRef.current?.(configRef.current.technique); return; } motion.current = { started: performance.now(), duration: plan.durationMs / Math.max(0.1, configRef.current.playbackRate), direction: plan.direction }; if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } animate(); onGestureRef.current?.(configRef.current.technique); }; transitionPlayRef.current = () => { const from = transitionFromRef.current; const to = chordRef.current; if (!chordShapesDiffer(from, to)) return; transitionMotion.current = { started: performance.now(), duration: 900, from: normalizeGuitarChord(from), to: normalizeGuitarChord(to) }; motion.current = null; setTransitionPlaying(true); if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } updateTransitionMarkers(0); animateTransition(); }; refreshRef.current = refresh;
    const resize = () => { if (disposed) return; const width = Math.max(280, host.clientWidth); const height = Math.max(260, Math.min(520, host.clientHeight || width * 0.58)); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render(); }; const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); const intersection = new IntersectionObserver(([entry]) => { inViewport = Boolean(entry?.isIntersecting); if (!inViewport && rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } else if (inViewport && documentVisible) { if (motion.current) resumeAnimation?.(); else if (transitionMotion.current) animateTransition(); else render(); } }); intersection.observe(host); const onVisibility = () => { documentVisible = document.visibilityState === "visible"; if (!documentVisible && rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } else if (documentVisible && inViewport) { if (motion.current) resumeAnimation?.(); else if (transitionMotion.current) animateTransition(); else render(); } }; document.addEventListener("visibilitychange", onVisibility);
    let controls: import("three/examples/jsm/controls/ArcballControls.js").ArcballControls | null = null; let controlsDisposed = false;
    const cameraView = (name: PresetName) => name in GUITAR_TECHNIQUE_CLOSEUPS ? GUITAR_TECHNIQUE_CLOSEUPS[name as keyof typeof GUITAR_TECHNIQUE_CLOSEUPS] : GUITAR_CAMERA_PRESETS[name as keyof typeof GUITAR_CAMERA_PRESETS];
    const applyCameraPreset = (name: PresetName) => { const view = cameraView(name) ?? GUITAR_CAMERA_PRESETS.overview; camera.position.set(...view.position); camera.lookAt(...view.target); if (controls) { (controls as unknown as { target: THREE.Vector3 }).target.set(...view.target); controls.update(); } render(); };
    cameraPresetRef.current = (name) => { requestedPresetRef.current = name; applyCameraPreset(name); };
    cameraActionRef.current = (action) => { if (action === "reset") { setPreset(initialPresetRef.current); requestedPresetRef.current = initialPresetRef.current; applyCameraPreset(initialPresetRef.current); return; } const viewTarget = controls ? (controls as unknown as { target: THREE.Vector3 }).target : new THREE.Vector3(...cameraView(requestedPresetRef.current).target); const offset = camera.position.clone().sub(viewTarget); if (action === "rotate-left" || action === "rotate-right") offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), action === "rotate-left" ? -0.28 : 0.28); else { const distance = THREE.MathUtils.clamp(offset.length() * (action === "zoom-in" ? 0.82 : 1.22), 2.4, 24); offset.setLength(distance); } camera.position.copy(viewTarget).add(offset); camera.lookAt(viewTarget); controls?.update(); render(); };
    const setupControls = async () => { try { const controlsModule = await import("three/examples/jsm/controls/ArcballControls.js"); if (disposed) return; controls = new controlsModule.ArcballControls(camera, canvas, scene); (controls as unknown as { target: THREE.Vector3 }).target.set(...cameraView(requestedPresetRef.current).target); controls.enableAnimations = false; controls.enablePan = true; controls.enableRotate = true; controls.enableZoom = true; controls.enableFocus = false; controls.adjustNearFar = true; controls.minDistance = 2.4; controls.maxDistance = 24; controls.setGizmosVisible(false); controls.setMouseAction("PAN", 0, "SHIFT"); controls.addEventListener("change", render); applyCameraPreset(requestedPresetRef.current); render(); } catch { render(); } }; void setupControls(); refresh(); resize();
    return () => { disposed = true; if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } resizeObserver.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", onVisibility); if (controls && !controlsDisposed) { controlsDisposed = true; controls.removeEventListener("change", render); controls.dispose(); } cameraPresetRef.current = () => {}; transitionCancelRef.current = () => {}; transitionPlayRef.current = null; resumeAnimation = null; refreshRef.current = null; gestureRef.current = null; handsRef.current = { left: null, right: null }; disposeScene(scene, renderer); };
  }, []);
  useEffect(() => {
    const fretting = handsRef.current.left;
    if (fretting) fretting.forearm.rotation.z = handedness === "left" ? -Math.PI / 2 : Math.PI / 2;
  }, [handedness]);
  useEffect(() => { if (autoPlay && gestureKey !== undefined && lastGestureKeyRef.current !== gestureKey) { lastGestureKeyRef.current = gestureKey; if (mode === "right-hand" || mode === "both") gestureRef.current?.(); } }, [autoPlay, gestureKey, mode]);
  const updateTarget = (string: number, fret: number) => { const shape = normalizeGuitarChord(chordRef.current); if (configRef.current.selectionOnly) { if (string < 0 || string >= shape.frets.length || fret < 0 || shape.frets[string] !== fret) return; onTargetChange?.({ string, fret }); return; } const next = { string, fret }; targetRef.current = next; setTarget(next); refreshRef.current?.(); onTargetChange?.(next); }; const cycleFret = () => updateTarget(target.string, target.fret >= 5 ? 0 : target.fret + 1); const selectPreset = (name: PresetName) => { setPreset(name); requestedPresetRef.current = name; cameraPresetRef.current(name); };
  const sharedPositions = sharedFingerTargets(transitionFrom, chord);
  const transitionAvailable = Boolean(transitionFrom && chord && chordShapesDiffer(transitionFrom, chord));
  const rightPlanForControls = motionPlan ?? (token !== undefined ? rightHandTokenToMotionPlan(token, technique) : techniqueToMotionPlan(technique, activePatternStep, activeStrings));
  const displayTarget = selectionOnly && selectedContact ? selectedContact : target;
  const selectableContacts = selectionOnly ? normalizeGuitarChord(chord).frets.map((fret, string) => ({ string, fret })).filter((contact) => contact.fret >= 0) : [];
  if (fallback) return <div className={className} role="status">3D guitar preview is unavailable in this browser. The technique controls remain available.</div>;
  return <section className={className ?? "guitar-technique-3d"} aria-label="Interactive 3D guitar technique lesson">
    <div className="guitar-technique-3d__stage" ref={hostRef}>
      <canvas ref={canvasRef} aria-label="Interactive high-resolution 3D guitar, fretboard, sound hole, frets, and hands" tabIndex={0} />
      <p className="guitar-technique-3d__hint">Drag to orbit · Shift-drag to pan · wheel or pinch to zoom</p>
    </div>
    <p className="guitar-technique-3d__authored-status" role="status" aria-live="polite">{authoredStatus}</p>
    {showLabels && <p className="guitar-technique-3d__status" aria-live="polite">Target: string {displayTarget.string + 1}, {displayTarget.fret === 0 ? "open" : `fret ${displayTarget.fret}`} · {technique}</p>}
    {showLabels && <div className="guitar-technique-3d__finger-legend" role="group" aria-label="Fretting finger legend">
      {FINGER_LABELS.map((name, index) => <span key={name} aria-label={`${name} finger`}>{index + 1} {name}</span>)}
      {sharedPositions.length > 0 && <span aria-live="polite">Planted: {sharedPositions.map((position) => `${FINGER_LABELS[position.finger - 1] ?? "Finger"} · string ${position.string + 1}, fret ${position.fret}`).join(" · ")}</span>}
    </div>}
    <div className="guitar-technique-3d__controls" aria-label="3D guitar controls">
      <div className="guitar-technique-3d__camera" aria-label="Camera views">
        <button type="button" aria-pressed={preset === "overview"} onClick={() => selectPreset("overview")}>Overview</button>
        <button type="button" aria-pressed={preset === "fretting"} onClick={() => selectPreset("fretting")}>Fretting hand</button>
        <button type="button" aria-pressed={preset === "picking"} onClick={() => selectPreset("picking")}>Picking hand</button>
        {(mode === "right-hand" || mode === "both") && <>
          <button type="button" aria-pressed={preset === "pick-grip"} onClick={() => selectPreset("pick-grip")}>Pick grip close-up</button>
          <button type="button" aria-pressed={preset === "thumb-independence"} onClick={() => selectPreset("thumb-independence")}>Thumb independence</button>
          <button type="button" aria-pressed={preset === "palm-mute"} onClick={() => selectPreset("palm-mute")}>Palm mute</button>
        </>}
        <button type="button" aria-label="Rotate 3D guitar left" onClick={() => cameraActionRef.current("rotate-left")}>Rotate left</button>
        <button type="button" aria-label="Rotate 3D guitar right" onClick={() => cameraActionRef.current("rotate-right")}>Rotate right</button>
        <button type="button" aria-label="Zoom in on 3D guitar" onClick={() => cameraActionRef.current("zoom-in")}>Zoom in</button>
        <button type="button" aria-label="Zoom out on 3D guitar" onClick={() => cameraActionRef.current("zoom-out")}>Zoom out</button>
        <button type="button" aria-label="Reset 3D guitar camera" onClick={() => cameraActionRef.current("reset")}>Reset camera</button>
        <button type="button" aria-pressed={showLabels} aria-label={showLabels ? "Hide finger labels" : "Show finger labels"} onClick={() => setShowLabels((visible) => !visible)}>{showLabels ? "Hide labels" : "Show labels"}</button>
      </div>
      {selectionOnly && selectableContacts.length > 0 && <div className="guitar-technique-3d__contact-controls" role="group" aria-label="Select a fretting contact">
        {selectableContacts.map((contact) => <button key={`${contact.string}-${contact.fret}`} type="button" aria-pressed={selectedContact?.string === contact.string && selectedContact.fret === contact.fret} onClick={() => updateTarget(contact.string, contact.fret)}>String {contact.string + 1} · {contact.fret === 0 ? "Open" : `Fret ${contact.fret}`}</button>)}
      </div>}
      {!selectionOnly && (mode === "left-hand" || mode === "both") && <><label>Target string<select aria-label="Target string" value={target.string} onChange={(event) => updateTarget(Number(event.target.value), target.fret)}>{Array.from({ length: 6 }, (_, string) => <option key={string} value={string}>String {string + 1}</option>)}</select></label><label>Target fret<select aria-label="Target fret" value={target.fret} onChange={(event) => updateTarget(target.string, Number(event.target.value))}>{Array.from({ length: 6 }, (_, fret) => <option key={fret} value={fret}>{fret === 0 ? "Open" : `Fret ${fret}`}</option>)}</select></label><button type="button" onClick={cycleFret}>Choose next fret</button></>}
      {transitionAvailable && (mode === "left-hand" || mode === "both") && <button type="button" disabled={transitionPlaying || typeof transitionPhase === "number"} onClick={() => transitionPlayRef.current?.()} aria-label="Play chord transition">{typeof transitionPhase === "number" ? "Step-controlled transition" : transitionPlaying ? "Moving fingers…" : "Play transition"}</button>}
      {(mode === "right-hand" || mode === "both") && <button type="button" disabled={Boolean(rightPlanForControls.rest)} onClick={() => gestureRef.current?.()}>{rightPlanForControls.rest ? "Rest — no contact" : `Play ${technique === "fingerpicking" ? "fingerpick" : technique === "plectrum" ? "pick" : rightPlanForControls.mute ? "mute" : "strum"}`}</button>}
    </div>
  </section>;
}
