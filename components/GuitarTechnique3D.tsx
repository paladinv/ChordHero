"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  chordToLeftHandTargets,
  normalizeGuitarChord,
  techniqueToMotionPlan,
  type GuitarChordShape,
  type GuitarHandedness,
  type RightHandTechnique
} from "../lib/guitarTechnique3d";

export type GuitarTechnique3DProps = {
  chord?: GuitarChordShape | null;
  handedness?: GuitarHandedness;
  technique?: RightHandTechnique;
  activePatternStep?: number;
  activeStrings?: readonly number[];
  mode?: "left-hand" | "right-hand" | "both";
  labels?: boolean;
  /** Changes trigger a short gesture when the host advances its pattern step. */
  gestureKey?: string | number;
  autoPlay?: boolean;
  className?: string;
  onTargetChange?: (target: { string: number; fret: number }) => void;
  onGesture?: (kind: RightHandTechnique) => void;
};

type Segment = { mesh: THREE.Mesh; tip: THREE.Mesh };
type FingerVisual = { segment: Segment; accent: THREE.Mesh };

const STRING_X = (string: number) => (string - 2.5) * 0.2;
const FRET_Z = (fret: number) => -2.2 + Math.max(0, fret - 0.5) * 0.3;

function setSegment(segment: Segment, from: THREE.Vector3, to: THREE.Vector3) {
  const delta = new THREE.Vector3().subVectors(to, from);
  segment.mesh.position.copy(from).add(to).multiplyScalar(0.5);
  segment.mesh.scale.set(1, delta.length() / 1, 1);
  segment.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  segment.tip.position.copy(to);
}

function makeSegment(geometry: THREE.BufferGeometry, material: THREE.Material, group: THREE.Group): Segment {
  const mesh = new THREE.Mesh(geometry, material);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), material);
  group.add(mesh, tip);
  return { mesh, tip };
}

function makeFingerSet(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  accentMaterial: THREE.Material
): FingerVisual[] {
  return Array.from({ length: 4 }, (_, finger) => ({
    segment: makeSegment(geometry, material, group),
    accent: new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), accentMaterial)
  })).map((finger) => {
    group.add(finger.accent);
    return finger;
  });
}

function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
  renderer.dispose();
}

/**
 * A small, lazy-friendly Three.js lesson engine. It owns its renderer and scene,
 * renders only on input/tween/resize, and exposes no per-frame React state.
 */
export default function GuitarTechnique3D({
  chord,
  handedness = "right",
  technique = "strumming",
  activePatternStep = 0,
  activeStrings = [],
  mode = "both",
  labels = true,
  className,
  gestureKey,
  autoPlay = false,
  onTargetChange,
  onGesture
}: GuitarTechnique3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chordRef = useRef(normalizeGuitarChord(chord));
  const configRef = useRef({ technique, activePatternStep, activeStrings: [...activeStrings], handedness, mode });
  const targetRef = useRef({ string: 0, fret: 1 });
  const leftFingersRef = useRef<FingerVisual[]>([]);
  const rightFingersRef = useRef<FingerVisual[]>([]);
  const rightHandRef = useRef<THREE.Group | null>(null);
  const leftHandRef = useRef<THREE.Group | null>(null);
  const manualTargetRef = useRef<THREE.Mesh | null>(null);
  const lastGestureKeyRef = useRef<string | number | undefined>(undefined);
  const renderRef = useRef<(() => void) | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const animateRef = useRef<(() => void) | null>(null);
  const motionRef = useRef<{ started: number; duration: number; direction: "down" | "up" | "neutral" } | null>(null);
  const rafRef = useRef<number | null>(null);
  const [fallback, setFallback] = useState(false);
  const [target, setTarget] = useState(targetRef.current);

  useEffect(() => {
    chordRef.current = normalizeGuitarChord(chord);
    refreshRef.current?.();
  }, [chord]);

  useEffect(() => {
    configRef.current = { technique, activePatternStep, activeStrings: [...activeStrings], handedness, mode };
    if (leftHandRef.current) leftHandRef.current.scale.x = handedness === "left" ? -1 : 1;
    if (leftHandRef.current) leftHandRef.current.visible = mode === "left-hand" || mode === "both";
    if (rightHandRef.current) rightHandRef.current.visible = mode === "right-hand" || mode === "both";
    if (manualTargetRef.current) manualTargetRef.current.visible = mode === "left-hand" || mode === "both";
    refreshRef.current?.();
  }, [activePatternStep, activeStrings, handedness, mode, technique]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio <= 1.25, alpha: true, powerPreference: "low-power" });
    } catch {
      setFallback(true);
      return;
    }
    setFallback(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2ecdf);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 5.2, 10.4);
    camera.lookAt(0, 0, 2.4);
    scene.add(new THREE.HemisphereLight(0xfff8ed, 0x35585b, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-4, 8, 5);
    scene.add(key);

    const wood = new THREE.MeshStandardMaterial({ color: 0x7b4d2b, roughness: 0.8 });
    const board = new THREE.MeshStandardMaterial({ color: 0x3b2925, roughness: 0.72 });
    const fretMetal = new THREE.MeshStandardMaterial({ color: 0xd3bf9d, metalness: 0.8, roughness: 0.28 });
    const stringMetal = new THREE.MeshStandardMaterial({ color: 0xe7d8bd, metalness: 0.75, roughness: 0.3 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd88463, roughness: 0.9 });
    const skinLight = new THREE.MeshStandardMaterial({ color: 0xf0ae89, roughness: 0.86 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x16a6a0, emissive: 0x073b3d, emissiveIntensity: 0.5 });
    const activeAccent = new THREE.MeshStandardMaterial({ color: 0xffbd55, emissive: 0x7e3b0c, emissiveIntensity: 0.8 });
    const ink = new THREE.MeshStandardMaterial({ color: 0x182d30, roughness: 0.9 });

    const guitar = new THREE.Group();
    const neck = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 8), wood);
    neck.position.set(0, 0, 1.6);
    guitar.add(neck);
    const fingerboard = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.06, 7.7), board);
    fingerboard.position.set(0, 0.14, 1.6);
    guitar.add(fingerboard);
    for (let fret = 0; fret <= 24; fret += 1) {
      const fretBar = new THREE.Mesh(new THREE.BoxGeometry(1.53, 0.07, fret === 0 ? 0.08 : 0.035), fretMetal);
      fretBar.position.set(0, 0.21, fret === 0 ? -2.35 : FRET_Z(fret) + 0.15);
      guitar.add(fretBar);
    }
    for (let string = 0; string < 6; string += 1) {
      const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018 + string * 0.002, 0.018 + string * 0.002, 8, 5), stringMetal);
      stringMesh.rotation.x = Math.PI / 2;
      stringMesh.position.set(STRING_X(string), 0.27, 1.6);
      guitar.add(stringMesh);
    }
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.25, 16, 10), wood);
    body.scale.set(1, 0.17, 1.16);
    body.position.set(0, -0.01, 6.25);
    guitar.add(body);
    const soundHole = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24), ink);
    soundHole.rotation.x = Math.PI / 2;
    soundHole.position.set(0, 0.2, 6.1);
    guitar.add(soundHole);
    const rosette = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.06, 6, 24), fretMetal);
    rosette.rotation.x = Math.PI / 2;
    rosette.position.set(0, 0.25, 6.1);
    guitar.add(rosette);
    scene.add(guitar);

    const leftHand = new THREE.Group();
    leftHand.visible = mode === "left-hand" || mode === "both";
    leftHand.scale.x = handedness === "left" ? -1 : 1;
    const leftPalm = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), skin);
    leftPalm.scale.set(1.1, 0.75, 1.25);
    leftPalm.position.set(-1.65, 0.75, -0.8);
    leftHand.add(leftPalm);
    const leftThumb = makeSegment(new THREE.CylinderGeometry(0.14, 0.17, 1, 6), skinLight, leftHand);
    const leftFingerGeometry = new THREE.CylinderGeometry(0.105, 0.125, 1, 6);
    leftFingersRef.current = makeFingerSet(leftHand, leftFingerGeometry, skin, activeAccent);
    scene.add(leftHand);
    leftHandRef.current = leftHand;

    const rightHand = new THREE.Group();
    rightHand.visible = mode === "right-hand" || mode === "both";
    rightHand.position.set(0, 0.1, 0);
    const rightPalm = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), skin);
    rightPalm.scale.set(1.25, 0.7, 1.0);
    rightPalm.position.set(0, 0.8, 6.75);
    rightHand.add(rightPalm);
    const rightFingerGeometry = new THREE.CylinderGeometry(0.11, 0.13, 1, 6);
    rightFingersRef.current = makeFingerSet(rightHand, rightFingerGeometry, skinLight, accent);
    scene.add(rightHand);
    rightHandRef.current = rightHand;

    const markers = Array.from({ length: 6 }, (_, string) => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4), activeAccent);
      marker.position.set(STRING_X(string), 0.34, FRET_Z(1));
      marker.visible = false;
      scene.add(marker);
      return marker;
    });
    const manualTarget = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 16), activeAccent);
    manualTarget.rotation.x = Math.PI / 2;
    manualTarget.position.set(STRING_X(targetRef.current.string), 0.38, FRET_Z(targetRef.current.fret));
    manualTarget.visible = mode === "left-hand" || mode === "both";
    scene.add(manualTarget);
    manualTargetRef.current = manualTarget;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let visible = true;
    let disposed = false;

    const resize = () => {
      if (disposed) return;
      const width = Math.max(280, host.clientWidth);
      const height = Math.max(260, Math.min(520, host.clientHeight || width * 0.58));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const render = () => {
      if (!disposed && visible) renderer.render(scene, camera);
    };
    const updateLeftHand = () => {
      const targets = chordToLeftHandTargets(chordRef.current);
      const byFinger = new Map<number, (typeof targets)[number]>();
      targets.forEach((item) => { if (!byFinger.has(item.finger)) byFinger.set(item.finger, item); });
      leftFingersRef.current.forEach((finger, index) => {
        const target = byFinger.get(index + 1);
        const from = new THREE.Vector3(-1.65 + index * 0.12, 0.92, -0.8 + index * 0.08);
        const to = target ? new THREE.Vector3(STRING_X(target.string), 0.32, FRET_Z(target.fret)) : new THREE.Vector3(-0.7 + index * 0.18, 0.33, -1.8);
        setSegment(finger.segment, from, to);
        finger.accent.position.copy(to);
        finger.accent.visible = Boolean(target);
      });
      setSegment(leftThumb, new THREE.Vector3(-1.48, 0.78, -0.5), new THREE.Vector3(0.72, 0.26, -0.95));
      markers.forEach((marker, string) => {
        const fret = chordRef.current.frets[string];
        marker.visible = fret > 0;
        marker.position.set(STRING_X(string), 0.34, FRET_Z(fret));
      });
      manualTarget.position.set(STRING_X(targetRef.current.string), 0.39, FRET_Z(targetRef.current.fret));
    };
    const updateRightHand = (progress = 0) => {
      const config = configRef.current;
      const plan = techniqueToMotionPlan(config.technique, config.activePatternStep, config.activeStrings);
      const motion = motionRef.current;
      const phase = motion ? Math.min(1, Math.max(0, progress)) : 0;
      const sweep = plan.direction === "up" ? 0.8 - phase * 1.6 : -0.8 + phase * 1.6;
      if (rightHand) rightHand.position.x = motion && plan.kind !== "fingerpick" ? sweep : 0;
      rightFingersRef.current.forEach((finger, index) => {
        const string = plan.strings[index % Math.max(1, plan.strings.length)] ?? index;
        const isActive = plan.kind === "fingerpick" ? plan.strings.includes(string) : index === 0;
        const base = new THREE.Vector3(-0.05 + index * 0.14, 1.02, 6.65 + index * 0.05);
        const dip = motion && isActive ? Math.sin(Math.PI * phase) * (plan.kind === "fingerpick" ? 0.42 : 0.18) : 0;
        const to = new THREE.Vector3(STRING_X(string), 0.34 - dip, 6.15 + (string % 2) * 0.08);
        setSegment(finger.segment, base, to);
        finger.accent.position.copy(to);
        finger.accent.visible = isActive && Boolean(motion);
      });
    };
    updateLeftHand();
    updateRightHand();
    renderRef.current = render;
    refreshRef.current = () => { updateLeftHand(); updateRightHand(); render(); };
    animateRef.current = () => {
      if (disposed || !motionRef.current) return;
      const motion = motionRef.current;
      const elapsed = performance.now() - motion.started;
      const progress = reducedMotion ? 1 : Math.min(1, elapsed / motion.duration);
      updateRightHand(progress);
      render();
      if (progress < 1 && visible) rafRef.current = requestAnimationFrame(animateRef.current!);
      else { motionRef.current = null; updateRightHand(); render(); }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const intersection = new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); if (visible) render(); });
    intersection.observe(host);
    const onVisibility = () => { visible = document.visibilityState === "visible"; if (!visible && rafRef.current) cancelAnimationFrame(rafRef.current); else if (visible) render(); };
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    const onPointer = () => {
      const next = { string: (targetRef.current.string + 1) % 6, fret: targetRef.current.fret };
      targetRef.current = next;
      setTarget(next);
      refreshRef.current?.();
      onTargetChange?.(next);
    };
    canvas.addEventListener("pointerdown", onPointer);
    return () => {
      disposed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointer);
      renderRef.current = null;
      refreshRef.current = null;
      animateRef.current = null;
      rightHandRef.current = null;
      leftHandRef.current = null;
      manualTargetRef.current = null;
      disposeScene(scene, renderer);
    };
  }, []);

  const playGesture = () => {
    const config = configRef.current;
    const plan = techniqueToMotionPlan(config.technique, config.activePatternStep, config.activeStrings);
    motionRef.current = { started: performance.now(), duration: plan.durationMs, direction: plan.direction };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    animateRef.current?.();
    onGesture?.(config.technique);
  };
  useEffect(() => {
    if (!autoPlay || gestureKey === undefined || lastGestureKeyRef.current === gestureKey) return;
    lastGestureKeyRef.current = gestureKey;
    if (mode === "right-hand" || mode === "both") playGesture();
  }, [autoPlay, gestureKey, mode]);
  const cycleFret = () => {
    const next = { string: target.string, fret: target.fret >= 5 ? 0 : target.fret + 1 };
    targetRef.current = next;
    setTarget(next);
    refreshRef.current?.();
    onTargetChange?.(next);
  };

  const updateTarget = (string: number, fret: number) => {
    const next = { string, fret };
    targetRef.current = next;
    setTarget(next);
    refreshRef.current?.();
    onTargetChange?.(next);
  };

  if (fallback) return <div className={className} role="status">3D guitar preview is unavailable in this browser. The technique controls remain available.</div>;
  return (
    <section className={className ?? "guitar-technique-3d"} aria-label="Interactive 3D guitar technique lesson">
      <div className="guitar-technique-3d__stage" ref={hostRef}>
        <canvas ref={canvasRef} aria-label="Interactive 3D guitar, fretboard, sound hole, frets, and hands" tabIndex={0} />
      </div>
      {labels && <p className="guitar-technique-3d__status" aria-live="polite">Target: string {target.string + 1}, {target.fret === 0 ? "open" : `fret ${target.fret}`} · {technique}</p>}
      <div className="guitar-technique-3d__controls" aria-label="3D guitar controls">
        {(mode === "left-hand" || mode === "both") && <>
          <label>Target string<select aria-label="Target string" value={target.string} onChange={(event) => updateTarget(Number(event.target.value), target.fret)}>{Array.from({ length: 6 }, (_, string) => <option key={string} value={string}>String {string + 1}</option>)}</select></label>
          <label>Target fret<select aria-label="Target fret" value={target.fret} onChange={(event) => updateTarget(target.string, Number(event.target.value))}>{Array.from({ length: 6 }, (_, fret) => <option key={fret} value={fret}>{fret === 0 ? "Open" : `Fret ${fret}`}</option>)}</select></label>
          <button type="button" onClick={cycleFret}>Choose next fret</button>
        </>}
        {(mode === "right-hand" || mode === "both") && <button type="button" onClick={playGesture}>Play {technique === "fingerpicking" ? "fingerpick" : technique === "plectrum" ? "pick" : "strum"}</button>}
      </div>
    </section>
  );
}
