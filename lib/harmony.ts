export const HARMONY_NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

export type HarmonyNote = (typeof HARMONY_NOTES)[number];
export type HarmonyMode = "major" | "minor";
export type HarmonicEvent = "diatonic" | "borrowed" | "secondary-dominant" | "tonicization" | "cadence";
export type MajorDiatonicRole = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii°";
export type MinorDiatonicRole = "i" | "ii°" | "III" | "iv" | "v" | "VI" | "VII";
export type BorrowedRole = "bIII" | "bVI" | "bVII" | "iv" | "i";
export type CadenceRole = "ii–V–I" | "deceptive cadence";
export type SecondaryDominantRole = `V/${string}`;
export type HarmonicRole = MajorDiatonicRole | MinorDiatonicRole | BorrowedRole | CadenceRole | SecondaryDominantRole;

export type HarmonicFunction = {
  key: HarmonyNote;
  mode: HarmonyMode;
  role: HarmonicRole;
  root: HarmonyNote;
  quality: string;
  event: HarmonicEvent;
  available: boolean;
  label: string;
  explanation: string;
  tendencyTones: string[];
  suggestedResolution: string;
  nextRoles: HarmonicRole[];
};

export type ChordShapeLike = {
  frets: number[];
  fingers?: Array<number | null>;
  barre?: { fret: number; from: number; to: number };
};

export type TransitionCost = {
  score: number;
  sharedFingers: number;
  fretMovement: number;
  stringChanges: number;
  bassMovement: number;
  barreDifficulty: number;
  explanation: string;
};

export type CirclePoint = {
  note: HarmonyNote;
  degree: string;
  role: HarmonicRole;
  likelyResolution: string;
};

export type ProgressionAnalysis = {
  input: string;
  key: HarmonyNote;
  mode: HarmonyMode;
  items: Array<{
    symbol: string;
    root: HarmonyNote;
    quality: string;
    function: HarmonicFunction | null;
    substitutions: string[];
    simplerAlternatives: string[];
    notes: string;
  }>;
  summary: string;
};

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10] as const;
const MAJOR_ROLES: MajorDiatonicRole[] = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
// Keep natural-minor roles aligned one-to-one with the seven scale degrees.
// The raised-third harmonic-minor dominant is exposed separately as V.
const MINOR_ROLES: MinorDiatonicRole[] = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
const ROLE_NEXT: Partial<Record<HarmonicRole, HarmonicRole[]>> = {
  I: ["IV", "V", "vi"],
  ii: ["V", "vii°"],
  iii: ["vi", "IV"],
  IV: ["V", "I"],
  V: ["I", "vi"],
  vi: ["ii", "IV"],
  "vii°": ["I"],
  i: ["iv", "V", "VI"],
  "ii°": ["V", "v"],
  III: ["iv", "VI"],
  iv: ["V", "i"],
  v: ["i", "VI"],
  VI: ["VII", "iv"],
  VII: ["i", "III"],
  bIII: ["iv", "bVI"],
  bVI: ["bVII", "V"],
  bVII: ["I", "iv"],
  "ii–V–I": ["I"],
  "deceptive cadence": ["vi"],
};

const normalizeNote = (note: string): HarmonyNote => {
  const cleaned = note.trim().replace(/♯/g, "#").replace(/♭/g, "b");
  const aliases: Record<string, HarmonyNote> = { Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" };
  return aliases[cleaned] ?? (HARMONY_NOTES.includes(cleaned as HarmonyNote) ? cleaned as HarmonyNote : "C");
};

const noteIndex = (note: string) => HARMONY_NOTES.indexOf(normalizeNote(note));
const noteAt = (index: number): HarmonyNote => HARMONY_NOTES[((index % 12) + 12) % 12];
const prettyRole = (role: HarmonicRole) => role.replace("–", " - ");

export const getScale = (key: string, mode: HarmonyMode): HarmonyNote[] => {
  const steps = mode === "major" ? MAJOR_STEPS : MINOR_STEPS;
  const start = noteIndex(key);
  return steps.map((step) => noteAt(start + step));
};

const qualityForRole = (role: HarmonicRole, mode: HarmonyMode): string => {
  if (role === "vii°" || role === "ii°") return "diminished";
  if (role.startsWith("V/")) return "dominant7";
  if (role === "V") return "dominant7";
  if (["ii", "iii", "vi", "i", "iv", "v"].includes(role)) return "minor";
  if (role === "ii–V–I" || role === "deceptive cadence") return "progression";
  return "major";
};

const isQualityCompatible = (expected: string, actual: string): boolean => {
  if (expected === "progression") return true;
  if (expected === actual) return true;
  if (expected === "major") return ["major", "major7", "add9", "sus2", "sus4"].includes(actual);
  if (expected === "minor") return ["minor", "minor7"].includes(actual);
  return expected === "dominant7" && ["dominant7", "major", "sus4"].includes(actual);
};

const roleAtDegree = (degree: number, mode: HarmonyMode): HarmonicRole =>
  (mode === "major" ? MAJOR_ROLES : MINOR_ROLES)[degree] ?? (mode === "major" ? "I" : "i");

const roleOffset = (role: HarmonicRole, mode: HarmonyMode): number | null => {
  if (role === "V") return 7;
  const roles = mode === "major" ? MAJOR_ROLES : MINOR_ROLES;
  const index = roles.indexOf(role as never);
  if (index >= 0) return (mode === "major" ? MAJOR_STEPS : MINOR_STEPS)[index] ?? null;
  const borrowedOffsets: Record<string, number> = { bIII: 3, bVI: 8, bVII: 10, iv: 5, i: 0 };
  return borrowedOffsets[role] ?? null;
};

const rootForRole = (key: string, role: HarmonicRole, mode: HarmonyMode): HarmonyNote => {
  const tonic = noteIndex(key);
  if (role.startsWith("V/")) {
    const target = role.slice(2);
    const targetRoot = rootForRole(key, target as HarmonicRole, mode);
    return noteAt(noteIndex(targetRoot) + 7);
  }
  return noteAt(tonic + (roleOffset(role, mode) ?? 0));
};

const functionExplanation = (key: HarmonyNote, mode: HarmonyMode, role: HarmonicRole, root: HarmonyNote, quality: string) => {
  if (role.startsWith("V/")) {
    const target = role.slice(2);
    return `${root} is ${role} in ${key} because its dominant seventh creates a temporary pull toward ${target}.`;
  }
  if (role === "ii–V–I") return `The ii - V - I cadence moves predominant to dominant to tonic in ${key}.`;
  if (role === "deceptive cadence") return `The dominant avoids tonic and resolves deceptively to vi in ${key}.`;
  if (["bIII", "bVI", "bVII"].includes(role)) return `${root} is a borrowed ${role} from the parallel ${mode === "major" ? "minor" : "major"} color of ${key}.`;
  const target = mode === "major" && role === "V" ? key : role === "vii°" ? key : role === "ii" ? "V" : role === "IV" ? "V or I" : role === "V" ? "i" : "the tonic";
  const triad = quality === "minor" ? `${root} - ${noteAt(noteIndex(root) + 3)} - ${noteAt(noteIndex(root) + 7)}` : `${root} - ${noteAt(noteIndex(root) + 4)} - ${noteAt(noteIndex(root) + 7)}`;
  return `${root} is ${role} in ${key} because ${triad} is the ${prettyRole(role)} chord of the ${mode} scale and resolves toward ${target}.`;
};

const tendencyForRole = (role: HarmonicRole, key: HarmonyNote, root: HarmonyNote): { tones: string[]; resolution: string } => {
  if (role === "V" || role.startsWith("V/")) return { tones: [noteAt(noteIndex(root) + 4), noteAt(noteIndex(root) + 10)], resolution: `${noteAt(noteIndex(root) + 4)} rises by semitone and the seventh falls by step toward the target.` };
  if (role === "vii°" || role === "ii°") return { tones: [noteAt(noteIndex(root) + 6)], resolution: `The diminished tendency tone resolves upward into ${key}.` };
  if (role === "ii" || role === "iv") return { tones: [root], resolution: "The predominant bass and third move smoothly into a dominant or tonic chord." };
  if (role === "deceptive cadence") return { tones: [noteAt(noteIndex(key) + 11)], resolution: "The leading tone still points to the tonic, but the bass redirects the resolution to vi." };
  return { tones: [], resolution: "Use the next-chord suggestions to hear the most idiomatic resolution." };
};

export const getNextRoles = (role: HarmonicRole): HarmonicRole[] => ROLE_NEXT[role] ?? ["I", "V"];

export const getFunctionOptions = (mode: HarmonyMode, event: HarmonicEvent | "all" = "all"): HarmonicRole[] => {
  const diatonic = mode === "major" ? [...MAJOR_ROLES] : [...MINOR_ROLES, "V" as const];
  if (event === "diatonic") return diatonic;
  if (event === "borrowed") return ["i", "bIII", "iv", "bVI", "bVII"];
  if (event === "secondary-dominant" || event === "tonicization") return ["V/ii", "V/iii", "V/IV", "V/V", "V/vi"];
  if (event === "cadence") return ["ii–V–I", "deceptive cadence"];
  return [...diatonic, "bIII", "bVI", "bVII", "V/ii", "V/IV", "V/V", "V/vi", "ii–V–I", "deceptive cadence"];
};

export const analyzeChordFunction = (args: {
  key: string;
  mode: HarmonyMode;
  root: string;
  quality: string;
  requestedRole?: HarmonicRole | "any";
  event?: HarmonicEvent | "all";
}): HarmonicFunction[] => {
  const key = normalizeNote(args.key);
  const root = normalizeNote(args.root);
  const roles = getFunctionOptions(args.mode, args.event ?? "all");
  const matches = roles.filter((role) => rootForRole(key, role, args.mode) === root && (args.requestedRole === undefined || args.requestedRole === "any" || role === args.requestedRole));
  const functions = matches.map((role) => {
    const expectedQuality = qualityForRole(role, args.mode);
    const qualityCompatible = isQualityCompatible(expectedQuality, args.quality);
    const tendency = tendencyForRole(role, key, root);
    return {
      key,
      mode: args.mode,
      role,
      root,
      quality: args.quality,
      event: (role.startsWith("V/") ? "secondary-dominant" : ["bIII", "bVI", "bVII"].includes(role) ? "borrowed" : role.includes("–") || role.includes("cadence") ? "cadence" : "diatonic") as HarmonicEvent,
      available: qualityCompatible,
      label: `${role} in ${key} ${args.mode}`,
      explanation: functionExplanation(key, args.mode, role, root, args.quality),
      tendencyTones: tendency.tones,
      suggestedResolution: tendency.resolution,
      nextRoles: getNextRoles(role)
    };
  });

  // A dominant-quality chord is strong evidence of tonicization. Keep an
  // ordinary major triad's diatonic interpretation first, but prioritize a
  // playable secondary dominant over an incompatible diatonic role.
  return functions.sort((left, right) => {
    if (left.available !== right.available) return Number(right.available) - Number(left.available);
    if (args.quality === "dominant7") {
      const leftSecondary = left.role.startsWith("V/");
      const rightSecondary = right.role.startsWith("V/");
      if (leftSecondary !== rightSecondary) return Number(rightSecondary) - Number(leftSecondary);
    }
    return 0;
  });
};

export const explainFunction = (fn: HarmonicFunction): string => fn.explanation;

export const getCircleOfFifths = (key: string, mode: HarmonyMode): CirclePoint[] => {
  const tonic = noteIndex(key);
  const offsets = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  return offsets.map((offset) => {
    const note = noteAt(tonic + offset);
    const scaleIndex = getScale(key, mode).indexOf(note);
    const role = scaleIndex >= 0 ? roleAtDegree(scaleIndex, mode) : (offset === 5 ? "IV" : "V");
    return { note, degree: scaleIndex >= 0 ? `${scaleIndex + 1}` : "chromatic", role, likelyResolution: getNextRoles(role)[0] ?? "I" };
  });
};

export const scoreTransition = (from: ChordShapeLike, to: ChordShapeLike): TransitionCost => {
  const fromFingers = from.fingers;
  const toFingers = to.fingers;
  const sharedFingers = fromFingers && toFingers ? fromFingers.reduce<number>((total, finger, index) => total + (finger !== null && finger === toFingers[index] && from.frets[index] === to.frets[index] ? 1 : 0), 0) : 0;
  const movingFrets = from.frets.map((fret, index) => ({ from: fret, to: to.frets[index] })).filter(({ from: left, to: right }) => left >= 0 && right >= 0);
  const fretMovement = movingFrets.length ? movingFrets.reduce((sum, item) => sum + Math.abs(item.from - item.to), 0) / movingFrets.length : 4;
  const stringChanges = from.frets.reduce((sum, fret, index) => sum + (fret < 0 !== to.frets[index] < 0 ? 1 : 0), 0);
  const bass = (shape: ChordShapeLike) => shape.frets.find((fret) => fret >= 0) ?? 0;
  const bassMovement = Math.abs(bass(from) - bass(to));
  const barreDifficulty = (to.barre ? Math.min(4, to.barre.to - to.barre.from + 1) : 0) + (from.barre ? 1 : 0);
  const raw = fretMovement * 2 + stringChanges * 1.5 + bassMovement * 0.8 + barreDifficulty * 1.2 - sharedFingers * 2;
  const score = Math.max(0, Math.min(100, Math.round(raw * 5)));
  return { score, sharedFingers, fretMovement: Number(fretMovement.toFixed(1)), stringChanges, bassMovement, barreDifficulty, explanation: `${sharedFingers} shared finger${sharedFingers === 1 ? "" : "s"}, ${fretMovement.toFixed(1)} average fret movement, ${stringChanges} string changes, ${bassMovement} fret bass movement, and barre load ${barreDifficulty}.` };
};

export const getConfusableRoles = (role: HarmonicRole, mode: HarmonyMode, misses: Record<string, number> = {}): HarmonicRole[] => {
  const groups: Record<string, HarmonicRole[]> = {
    predominant: ["ii", "IV", "iv", "ii°"],
    dominant: ["V", "vii°", "V/V"],
    tonic: ["I", "vi", "i", "III"],
    borrowed: ["iv", "bVI", "bVII"]
  };
  const group = Object.values(groups).find((items) => items.includes(role)) ?? getFunctionOptions(mode, "diatonic");
  return [...group].filter((candidate) => candidate !== role).sort((left, right) => (misses[right] ?? 0) - (misses[left] ?? 0)).slice(0, 3);
};

const parseChordSymbol = (symbol: string): { root: HarmonyNote; quality: string } | null => {
  const match = symbol.trim().match(/^([A-G](?:#|b)?)(.*)$/i);
  if (!match) return null;
  const suffix = match[2].toLowerCase();
  const quality = suffix.includes("dim") || suffix.includes("°") ? "diminished" : suffix.startsWith("m") && !suffix.startsWith("maj") ? "minor" : suffix.includes("7") ? "dominant7" : "major";
  return { root: normalizeNote(match[1]), quality };
};

export const analyzeProgression = (input: string, key: string, mode: HarmonyMode): ProgressionAnalysis => {
  const tokens = input.split(/[|,\s]+/).map((token) => token.trim()).filter(Boolean).slice(0, 24);
  const items = tokens.map((symbol) => {
    const parsed = parseChordSymbol(symbol);
    if (!parsed) return { symbol, root: "C" as HarmonyNote, quality: "unknown", function: null, substitutions: [], simplerAlternatives: [], notes: "This chord symbol is not recognized; try a symbol such as G, D7, or Am." };
    const fn = analyzeChordFunction({ key, mode, root: parsed.root, quality: parsed.quality })[0] ?? null;
    return { symbol, root: parsed.root, quality: parsed.quality, function: fn, substitutions: fn?.role === "V" ? ["vii°", "V/vi"] : fn?.role === "IV" ? ["ii", "iv"] : fn?.role === "ii" ? ["IV", "ii°"] : ["sus2", "sus4"], simplerAlternatives: parsed.quality === "dominant7" ? [parsed.root] : [parsed.root + (parsed.quality === "minor" ? "m" : "")], notes: fn?.explanation ?? `${parsed.root} is available as a chord identity, but its function is not in the selected ${mode} scale.` };
  });
  const roles = items.map((item) => item.function?.role).filter(Boolean);
  const summary = roles.join(" - ") || "No supported functions recognized yet.";
  return { input, key: normalizeNote(key), mode, items, summary };
};
