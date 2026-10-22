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
export type AuthoredHandRole = "fretting" | "picking";

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
  /** Present when the motion came from written notation rather than inference. */
  token?: string;
  accent?: boolean;
  rest?: boolean;
  mute?: boolean;
  fingerAssignments?: TechniqueFingerAssignment[];
};

export type TechniqueFingerName = "thumb" | "index" | "middle" | "ring" | "pinky";
export type TechniqueFingerAssignment = { finger: TechniqueFingerName; string: number };

/** Standard 25.5in guitar scale represented in the scene's world units. */
export const GUITAR_SCALE_LENGTH = 10.5;
export const GUITAR_SCALE_INCHES = 25.5;
export const INCH_TO_WORLD = GUITAR_SCALE_LENGTH / GUITAR_SCALE_INCHES;
/** Calibrated wrist-to-middle-fingertip length for the authored hand assets. */
export const AUTHORED_HAND_LENGTH_INCHES = 7.55;
/** Source GLB fingers extend down the source -Y axis. These world-space
 * directions turn that extension inward across the neck or toward the sound
 * hole while keeping the wrist/palm above the instrument. */
export const AUTHORED_HAND_ROLE_FORWARD = {
  fretting: { rightHanded: [1, 0, 0] as [number, number, number], leftHanded: [-1, 0, 0] as [number, number, number] },
  picking: [0, 0, -1] as [number, number, number]
} as const;
export const AUTHORED_HAND_WRIST_TARGET_Y = { fretting: 0.84, picking: 0.78 } as const;
/** Joint swing envelopes in radians, applied around the imported bind pose. */
export const AUTHORED_HAND_POSE_LIMITS = { metacarpal: 1.12, proximal: 1.86, intermediate: 1.62, distal: 1.34 } as const;
export const AUTHORED_HAND_TARGET_BASIS = {
  picking: { forward: [0, 0, -1] as [number, number, number], lateral: [-1, 0, 0] as [number, number, number], normal: [0, 1, 0] as [number, number, number] },
  frettingRight: { forward: [1, 0, 0] as [number, number, number], lateral: [0, 0, -1] as [number, number, number], normal: [0, 1, 0] as [number, number, number] },
  frettingLeft: { forward: [-1, 0, 0] as [number, number, number], lateral: [0, 0, 1] as [number, number, number], normal: [0, 1, 0] as [number, number, number] }
} as const;
export const AUTHORED_PICK_DIMENSIONS_MM = { width: 30, height: 25, thickness: 2 } as const;

export function authoredHandForward(role: AuthoredHandRole, handedness: GuitarHandedness) {
  if (role === "picking") return AUTHORED_HAND_ROLE_FORWARD.picking;
  return handedness === "left" ? AUTHORED_HAND_ROLE_FORWARD.fretting.leftHanded : AUTHORED_HAND_ROLE_FORWARD.fretting.rightHanded;
}
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
export type FingerChainResult = { points: [FingerChainPoint, FingerChainPoint, FingerChainPoint, FingerChainPoint]; endpointError: number; lengths: readonly number[]; reachable: boolean };

/** Camera positions are data-only so the renderer and validation can share them. */
export const GUITAR_CAMERA_PRESETS = {
  // The physical guitar spans roughly 13.5 world units along z. Keep the
  // complete neck, body, and both hands inside the first viewport at the
  // component's 32-degree lens instead of relying on an initial user zoom.
  overview: { position: [9.4, 6.1, 17.2] as [number, number, number], target: [0, 0.28, 3.1] as [number, number, number] },
  // Give the fretting wrist and its new forearm room at the nut while keeping
  // the board contact plane prominent. The wider distance avoids the old
  // close crop that clipped the active hand at the left edge.
  // Frame the fretting wrist and the first five frets at a useful teaching
  // scale. The overview preset remains the full-instrument composition.
  fretting: { position: [8.8, 7.4, 3.8] as [number, number, number], target: [0, 0.58, -1.2] as [number, number, number] },
  // Pull the string-contact close-up back enough to keep the lower bout and
  // picking forearm inside the stage while retaining a useful hand scale.
  picking: { position: [7.8, 8.6, 12.6] as [number, number, number], target: [0, 0.58, 5.2] as [number, number, number] }
} as const;

/** Right-hand teaching close-ups live separately to retain the original preset API. */
export const GUITAR_TECHNIQUE_CLOSEUPS = {
  "pick-grip": { position: [3.25, 3.05, 8.35] as [number, number, number], target: [0.04, 0.69, 5.92] as [number, number, number] },
  "thumb-independence": { position: [4.35, 4.4, 8.7] as [number, number, number], target: [0, 0.58, 5.72] as [number, number, number] },
  "palm-mute": { position: [4.6, 4.0, 10.15] as [number, number, number], target: [0, 0.55, 7.02] as [number, number, number] }
} as const;

export type GuitarDisplayMode = "left-hand" | "right-hand" | "both";

/** The first view should teach the active technique immediately. */
export function guitarPresetForMode(mode: GuitarDisplayMode): keyof typeof GUITAR_CAMERA_PRESETS {
  return mode === "right-hand" ? "picking" : mode === "left-hand" ? "fretting" : "overview";
}

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
 * Constrained three-bone IK. Reachable targets converge to an exact endpoint
 * while every returned bone retains its requested length. Unreachable targets
 * return a straight natural reach and a measurable error instead of contorting.
 */
export function solveFingerChain(anchor: FingerChainPoint, target: FingerChainPoint, boneLengths: readonly [number, number, number], bendDirection = 1): FingerChainResult {
  const lengths = boneLengths.map((length) => Math.max(0.04, length)) as [number, number, number];
  const maxReach = lengths[0] + lengths[1] + lengths[2];
  const initialDistance = pointDistance(anchor, target);
  if (initialDistance > maxReach - 0.01) {
    const naturalDirection = { x: (target.x - anchor.x) / Math.max(initialDistance, 0.0001), y: (target.y - anchor.y) / Math.max(initialDistance, 0.0001), z: (target.z - anchor.z) / Math.max(initialDistance, 0.0001) };
    const first = { x: anchor.x + naturalDirection.x * lengths[0], y: anchor.y + naturalDirection.y * lengths[0], z: anchor.z + naturalDirection.z * lengths[0] };
    const second = { x: first.x + naturalDirection.x * lengths[1], y: first.y + naturalDirection.y * lengths[1], z: first.z + naturalDirection.z * lengths[1] };
    const third = { x: second.x + naturalDirection.x * lengths[2], y: second.y + naturalDirection.y * lengths[2], z: second.z + naturalDirection.z * lengths[2] };
    return { points: [anchor, first, second, third], endpointError: pointDistance(third, target), lengths, reachable: false };
  }
  const base: FingerChainPoint = { ...anchor };
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
  return { points, endpointError: pointDistance(points[3], target), lengths, reachable: true };
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

const FINGER_NUMBER: Record<TechniqueFingerName, number> = { thumb: 0, index: 1, middle: 2, ring: 3, pinky: 4 };
const FINGER_NAME: Record<string, TechniqueFingerName> = { P: "thumb", p: "thumb", i: "index", m: "middle", a: "ring", c: "pinky" };
const DEFAULT_FINGER_STRING: Partial<Record<TechniqueFingerName, number>> = { thumb: 5, index: 2, middle: 1, ring: 0, pinky: 0 };

function writtenString(value: string | undefined) {
  const string = Number(value) - 1;
  return Number.isInteger(string) && string >= 0 && string < STRING_COUNT ? string : null;
}

/**
 * Converts one displayed exercise token into an exact renderer plan. Written
 * rests, mutes, directions, strings, and finger names win over every inferred
 * default. Unknown explicit tokens remain neutral rather than alternating.
 */
export function rightHandTokenToMotionPlan(token: string, technique: RightHandTechnique): TechniqueMotion {
  const source = String(token ?? "").trim();
  const accent = source.endsWith("!");
  const clean = source.replace(/!+$/g, "");
  const durationMs = technique === "strumming" ? 300 : technique === "plectrum" ? 220 : 280;
  if (clean === "·" || clean === "-") {
    return { kind: technique === "fingerpicking" ? "fingerpick" : technique === "plectrum" ? "pick" : "strum", direction: "neutral", strings: [], fingers: [], durationMs, token: source, accent, rest: true, mute: false, fingerAssignments: [] };
  }
  if (clean.toUpperCase() === "X") {
    return { kind: "strum", direction: "neutral", strings: [0, 1, 2, 3, 4, 5], fingers: [], durationMs: 240, token: source, accent, rest: false, mute: true, fingerAssignments: [] };
  }
  if (technique === "strumming") {
    const direction = clean.toUpperCase() === "D" ? "down" : clean.toUpperCase() === "U" ? "up" : "neutral";
    return { kind: "strum", direction, strings: [0, 1, 2, 3, 4, 5], fingers: [], durationMs, token: source, accent, rest: false, mute: false, fingerAssignments: [] };
  }
  if (technique === "plectrum") {
    const match = clean.match(/^([1-6])([DU])$/i);
    const string = writtenString(match?.[1]);
    const direction = match?.[2]?.toUpperCase() === "D" ? "down" : match?.[2]?.toUpperCase() === "U" ? "up" : "neutral";
    return { kind: "pick", direction, strings: string === null ? [] : [string], fingers: [], durationMs, token: source, accent, rest: false, mute: false, fingerAssignments: [] };
  }

  const fingerMatches = [...clean.matchAll(/[Pimac]/g)];
  const fingerLetters = fingerMatches.map((match) => match[0]);
  const digitMatches = [...clean.matchAll(/[1-6]/g)];
  const assignments: TechniqueFingerAssignment[] = [];
  const claimedDigits = new Set<number>();
  // First honor a digit immediately following its written finger (P6, i3…).
  fingerLetters.forEach((letter, index) => {
    const name = FINGER_NAME[letter];
    if (!name) return;
    const letterOffset = fingerMatches[index].index ?? -1;
    // A digit in compact im2+3 belongs to the group, rather than to m alone.
    const grouped = letterOffset > 0 && /[Pimac]/.test(clean[letterOffset - 1]);
    const direct = letterOffset >= 0 && !grouped ? clean.slice(letterOffset).match(new RegExp(`^${letter}([1-6])`, "i")) : null;
    const directString = writtenString(direct?.[1]);
    if (directString !== null) {
      assignments.push({ finger: name, string: directString });
      const digitIndex = digitMatches.findIndex((match) => Number(match[0]) - 1 === directString && !claimedDigits.has(match.index ?? -1));
      if (digitIndex >= 0) claimedDigits.add(digitMatches[digitIndex].index ?? -1);
    }
  });
  // Compact pinch notation such as im2+3 pairs remaining letters and digits.
  const remainingFingers = fingerLetters.map((letter) => FINGER_NAME[letter]).filter((name): name is TechniqueFingerName => Boolean(name) && !assignments.some((assignment) => assignment.finger === name));
  const remainingStrings = digitMatches.filter((match) => !claimedDigits.has(match.index ?? -1)).map((match) => writtenString(match[0])).filter((string): string is number => string !== null);
  remainingFingers.forEach((finger, index) => assignments.push({ finger, string: remainingStrings[index] ?? DEFAULT_FINGER_STRING[finger] ?? 0 }));
  // The common P6+ima shorthand writes the bass explicitly and relies on the
  // conventional i/m/a treble-string assignment for the compact suffix.
  const uniqueAssignments = assignments.filter((assignment, index) => assignments.findIndex((candidate) => candidate.finger === assignment.finger) === index);
  const strings = [...new Set(uniqueAssignments.map((assignment) => assignment.string))];
  return { kind: "fingerpick", direction: "neutral", strings, fingers: uniqueAssignments.map((assignment) => FINGER_NUMBER[assignment.finger]), durationMs, token: source, accent, rest: false, mute: false, fingerAssignments: uniqueAssignments };
}

/** Ordered contact strings for walkthrough pauses (0 = written string 1). */
export function techniqueMotionContacts(plan: TechniqueMotion) {
  if (plan.rest) return [];
  if (plan.kind === "fingerpick" && plan.fingerAssignments?.length) return plan.fingerAssignments.map((assignment) => assignment.string);
  const unique = [...new Set(plan.strings)];
  if (plan.kind === "strum") return [...unique].sort((a, b) => plan.direction === "up" ? a - b : plan.direction === "down" ? b - a : a - b);
  return unique;
}

/** Stable 0–1 freeze point centered on a written contact. */
export function techniqueContactPhase(plan: TechniqueMotion, contactIndex: number) {
  const contacts = techniqueMotionContacts(plan);
  if (!contacts.length) return 0;
  if (plan.kind === "fingerpick") return 0.5;
  const bounded = Math.max(0, Math.min(contacts.length - 1, integer(contactIndex, 0)));
  return (bounded + 0.5) / contacts.length;
}

export const GUITAR_STRING_COUNT = STRING_COUNT;
