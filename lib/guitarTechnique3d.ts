/** Pure, renderer-independent mapping helpers for the guitar technique engine. */

export type GuitarFret = number; // -1 = muted, 0 = open, positive = fretted

export type GuitarChordShape = {
  name?: string;
  frets: readonly GuitarFret[];
  fingers?: readonly (number | null | undefined)[];
  barre?: { fret: number; from: number; to: number; finger?: number };
};

export type GuitarHandedness = "right" | "left";
export type RightHandTechnique = "strumming" | "plectrum" | "fingerpicking";

export type LeftHandTarget = {
  finger: number;
  string: number;
  fret: number;
  muted: boolean;
  open: boolean;
  barre: boolean;
};

export type TechniqueMotion = {
  kind: "strum" | "pick" | "fingerpick";
  direction: "down" | "up" | "neutral";
  strings: number[];
  fingers: number[];
  durationMs: number;
};

/** Standard 25.5in guitar scale represented in the scene's world units. */
export const GUITAR_SCALE_LENGTH = 10.5;
export const GUITAR_SCALE_INCHES = 25.5;
export const INCH_TO_WORLD = GUITAR_SCALE_LENGTH / GUITAR_SCALE_INCHES;
export const GUITAR_BODY_LENGTH_INCHES = 19.75;
export const GUITAR_BODY_LENGTH = GUITAR_BODY_LENGTH_INCHES * INCH_TO_WORLD;
export const GUITAR_BODY_MAX_WIDTH_INCHES = 15.5;
export const GUITAR_BODY_MAX_WIDTH = GUITAR_BODY_MAX_WIDTH_INCHES * INCH_TO_WORLD;
/** Raw symmetric Bezier envelope in bodyShape(); kept explicit for proportion QA. */
export const GUITAR_BODY_RAW_PROFILE_WIDTH = 6.76;
export const GUITAR_BODY_PROFILE_X_SCALE = GUITAR_BODY_MAX_WIDTH / GUITAR_BODY_RAW_PROFILE_WIDTH;
export const GUITAR_BODY_DEPTH_INCHES = 4.4;
export const GUITAR_BODY_DEPTH = GUITAR_BODY_DEPTH_INCHES * INCH_TO_WORLD;
export const GUITAR_VISIBLE_FRET_COUNT = 20;
export const GUITAR_NUT_OVERALL_WIDTH = 1.75 * INCH_TO_WORLD;
export const GUITAR_TWELFTH_FRET_BOARD_WIDTH = 2.14 * INCH_TO_WORLD;
export const GUITAR_SADDLE_STRING_SPREAD = 2.15 * INCH_TO_WORLD;
export const GUITAR_NUT_Z = -3.3;
export const GUITAR_SADDLE_Z = GUITAR_NUT_Z + GUITAR_SCALE_LENGTH;
export const GUITAR_BOARD_TOP_Y = 0.5;
export const GUITAR_NUT_STRING_SPREAD = 1.46 * INCH_TO_WORLD;
/** World-space aperture used by the soundboard cut and recessed cavity. */
export const GUITAR_SOUND_HOLE_RADIUS = 0.82;
export const GUITAR_SOUND_HOLE_CENTER_Z = 5.78;

export const GUITAR_FINGER_BONE_LENGTHS = {
  index: [0.45, 0.34, 0.25] as const,
  middle: [0.49, 0.38, 0.28] as const,
  ring: [0.47, 0.36, 0.27] as const,
  little: [0.39, 0.3, 0.22] as const
};
export type FingerChainPoint = { x: number; y: number; z: number };
export type FingerChainResult = { points: [FingerChainPoint, FingerChainPoint, FingerChainPoint, FingerChainPoint]; endpointError: number; lengths: readonly number[] };

/** Camera positions are data-only so the renderer and validation can share them. */
export const GUITAR_CAMERA_PRESETS = {
  // The physical guitar spans roughly 13.5 world units along z. Keep the
  // complete neck, body, and both hands inside the first viewport at the
  // component's 32-degree lens instead of relying on an initial user zoom.
  overview: { position: [10.8, 7.2, 17.8] as [number, number, number], target: [0, 0.15, 3.15] as [number, number, number] },
  fretting: { position: [6.1, 3.9, 3.7] as [number, number, number], target: [0, 0.38, -1.25] as [number, number, number] },
  picking: { position: [-5.0, 3.6, 10.4] as [number, number, number], target: [0, 0.38, 5.65] as [number, number, number] }
} as const;

/** Distance from the nut to a fret using the physical 12th-root-of-two spacing. */
export function guitarFretPosition(fret: number, nutPosition = -3.3, scaleLength = GUITAR_SCALE_LENGTH) {
  const bounded = Math.max(0, Math.min(24, integer(fret, 0)));
  return nutPosition + scaleLength * (1 - Math.pow(2, -bounded / 12));
}

/** Strings widen from nut to saddle; z is in the shared guitar world space. */
export function guitarStringXAt(string: number, z: number, nutSpread = GUITAR_NUT_STRING_SPREAD, saddleSpread = GUITAR_SADDLE_STRING_SPREAD) {
  const boundedString = Math.max(0, Math.min(5, integer(string, 0)));
  const progress = Math.max(0, Math.min(1, (z - GUITAR_NUT_Z) / (GUITAR_SADDLE_Z - GUITAR_NUT_Z)));
  const spread = nutSpread + (saddleSpread - nutSpread) * progress;
  return (boundedString - 2.5) * (spread / 5);
}

/** Contact is deliberately nut-side of the wire, inside the fret cell. */
export function guitarFretContactZ(fret: number) {
  const bounded = Math.max(0, Math.min(24, integer(fret, 0)));
  if (bounded <= 0) return GUITAR_NUT_Z + 0.12;
  const wire = guitarFretPosition(bounded, GUITAR_NUT_Z);
  const previous = guitarFretPosition(bounded - 1, GUITAR_NUT_Z);
  return wire - (wire - previous) * 0.28;
}

export function guitarStringContactPoint(string: number, fret: number, topY = GUITAR_BOARD_TOP_Y) {
  const z = guitarFretContactZ(fret);
  return { x: guitarStringXAt(string, z), y: topY, z };
}

function pointDistance(a: FingerChainPoint, b: FingerChainPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Constrained three-bone IK. The final backward pass guarantees an exact target
 * endpoint while every returned bone retains its requested length. If the base
 * is too far away, it is pulled toward the target to keep the chain reachable.
 */
export function solveFingerChain(anchor: FingerChainPoint, target: FingerChainPoint, boneLengths: readonly [number, number, number], bendDirection = 1): FingerChainResult {
  const lengths = boneLengths.map((length) => Math.max(0.04, length)) as [number, number, number];
  const maxReach = lengths[0] + lengths[1] + lengths[2];
  const initialDistance = pointDistance(anchor, target);
  const base: FingerChainPoint = { ...anchor };
  if (initialDistance > maxReach - 0.01) {
    const ratio = (maxReach - 0.01) / Math.max(initialDistance, 0.0001);
    base.x = target.x + (anchor.x - target.x) * ratio;
    base.y = target.y + (anchor.y - target.y) * ratio;
    base.z = target.z + (anchor.z - target.z) * ratio;
  }
  const points: [FingerChainPoint, FingerChainPoint, FingerChainPoint, FingerChainPoint] = [
    base,
    { x: base.x, y: base.y, z: base.z },
    { x: base.x, y: base.y, z: base.z },
    { ...target }
  ];
  const distance = pointDistance(base, target) || 0.0001;
  const bend = bendDirection >= 0 ? 1 : -1;
  points[1] = { x: base.x + (target.x - base.x) * 0.32, y: base.y + (target.y - base.y) * 0.32 + 0.12 * bend, z: base.z + (target.z - base.z) * 0.32 };
  points[2] = { x: base.x + (target.x - base.x) * 0.67, y: base.y + (target.y - base.y) * 0.67 + 0.08 * bend, z: base.z + (target.z - base.z) * 0.67 };
  if (distance < maxReach) {
    for (let iteration = 0; iteration < 18; iteration += 1) {
      points[3] = { ...target };
      for (let index = 2; index >= 0; index -= 1) {
        const next = points[index + 1]; const current = points[index]; const length = pointDistance(current, next) || 0.0001; const scale = lengths[index] / length;
        points[index] = { x: next.x + (current.x - next.x) * scale, y: next.y + (current.y - next.y) * scale, z: next.z + (current.z - next.z) * scale };
      }
      points[0] = { ...base };
      for (let index = 0; index < 3; index += 1) {
        const current = points[index]; const next = points[index + 1]; const length = pointDistance(current, next) || 0.0001; const scale = lengths[index] / length;
        points[index + 1] = { x: current.x + (next.x - current.x) * scale, y: current.y + (next.y - current.y) * scale, z: current.z + (next.z - current.z) * scale };
      }
    }
  }
  points[3] = { ...target };
  for (let index = 2; index >= 0; index -= 1) {
    const next = points[index + 1]; const current = points[index]; const length = pointDistance(current, next) || 0.0001; const scale = lengths[index] / length;
    points[index] = { x: next.x + (current.x - next.x) * scale, y: next.y + (current.y - next.y) * scale, z: next.z + (current.z - next.z) * scale };
  }
  return { points, endpointError: pointDistance(points[3], target), lengths };
}

export function barreContactSpan(fret: number, from: number, to: number) {
  const start = guitarStringContactPoint(Math.min(from, to), fret);
  const end = guitarStringContactPoint(Math.max(from, to), fret);
  return { start, end, z: start.z };
}

export function chooseManualFinger(targets: readonly LeftHandTarget[], string: number, fret: number) {
  const owned = targets.some((target) => target.string === string && target.fret === fret);
  const occupied = new Set(targets.map((target) => target.finger));
  const finger = owned ? 0 : ([1, 2, 3, 4].find((candidate) => !occupied.has(candidate)) ?? 4);
  return { finger, owned, override: !owned && occupied.size >= 4 };
}

const STRING_COUNT = 6;

function integer(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

/** Normalizes external chord data so malformed library entries cannot break the scene. */
export function normalizeGuitarChord(chord?: GuitarChordShape | null): Required<Pick<GuitarChordShape, "frets">> & GuitarChordShape {
  const frets = Array.from({ length: STRING_COUNT }, (_, string) => {
    const value = integer(chord?.frets?.[string], -1);
    return Math.max(-1, Math.min(24, value));
  });
  const fingers = Array.from({ length: STRING_COUNT }, (_, string) => {
    const value = integer(chord?.fingers?.[string], 0);
    return value > 0 && value <= 4 ? value : null;
  });
  const barre = chord?.barre && integer(chord.barre.fret, 0) > 0
    ? {
        fret: Math.max(1, Math.min(24, integer(chord.barre.fret, 1))),
        from: Math.max(0, Math.min(5, integer(chord.barre.from, 0))),
        to: Math.max(0, Math.min(5, integer(chord.barre.to, 5))),
        finger: Math.max(1, Math.min(4, integer(chord.barre.finger, 1)))
      }
    : undefined;
  return { ...chord, frets, fingers, barre };
}

/** Converts a chord shape into the fingertip targets used by the 3D left hand. */
export function chordToLeftHandTargets(chord?: GuitarChordShape | null): LeftHandTarget[] {
  const shape = normalizeGuitarChord(chord);
  const targets: LeftHandTarget[] = [];
  shape.frets.forEach((fret, string) => {
    if (fret <= 0) return;
    const barre = Boolean(shape.barre && fret === shape.barre.fret && string >= shape.barre.from && string <= shape.barre.to);
    const finger = barre ? shape.barre?.finger ?? 1 : shape.fingers?.[string] ?? 0;
    if (finger > 0) targets.push({ finger, string, fret, muted: false, open: false, barre });
  });
  return targets.sort((a, b) => a.finger - b.finger || a.string - b.string);
}

/** Returns one bounded visual gesture for a pattern step; no timers or renderer state are involved. */
export function techniqueToMotionPlan(
  technique: RightHandTechnique,
  activePatternStep = 0,
  activeStrings: readonly number[] = []
): TechniqueMotion {
  const strings = [...new Set(activeStrings.map((value) => integer(value, -1)).filter((value) => value >= 0 && value < STRING_COUNT))];
  const step = Math.max(0, integer(activePatternStep, 0));
  if (technique === "fingerpicking") {
    const selected = strings.length ? strings : [0, 2, 3, 4];
    return { kind: "fingerpick", direction: "neutral", strings: selected, fingers: selected.map((_, index) => index % 4 + 1), durationMs: 280 };
  }
  if (technique === "plectrum") {
    const selected = strings.length ? strings.slice(0, 1) : [step % STRING_COUNT];
    return { kind: "pick", direction: step % 2 ? "up" : "down", strings: selected, fingers: [], durationMs: 220 };
  }
  const selected = strings.length ? strings : [0, 1, 2, 3, 4, 5];
  return { kind: "strum", direction: step % 2 ? "up" : "down", strings: selected, fingers: [], durationMs: 300 };
}

export const GUITAR_STRING_COUNT = STRING_COUNT;
