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

/** Camera positions are data-only so the renderer and validation can share them. */
export const GUITAR_CAMERA_PRESETS = {
  overview: { position: [8.6, 5.6, 11.4] as [number, number, number], target: [0, 0.25, 2.1] as [number, number, number] },
  fretting: { position: [5.2, 3.3, 3.2] as [number, number, number], target: [0, 0.3, -1.1] as [number, number, number] },
  picking: { position: [-4.4, 3.1, 9.2] as [number, number, number], target: [0, 0.35, 5.6] as [number, number, number] }
} as const;

/** Distance from the nut to a fret using the physical 12th-root-of-two spacing. */
export function guitarFretPosition(fret: number, nutPosition = -3.3, scaleLength = GUITAR_SCALE_LENGTH) {
  const bounded = Math.max(0, Math.min(24, integer(fret, 0)));
  return nutPosition + scaleLength * (1 - Math.pow(2, -bounded / 12));
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
