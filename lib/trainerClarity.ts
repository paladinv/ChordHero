export type ClarityRating = "clean" | "missed" | "needsWork";

export type ComparableRoundContext = {
  shapeSignature: string;
  sequence: string[];
  pace: number | "manual";
  assistance: string;
  assistanceTrail: string;
  challenge: string;
  diagram: string;
  diagramVisibility: string;
  preview: boolean;
  landing: boolean;
  warmUp: boolean;
  adaptive: boolean;
  adaptivePace: string;
  rhythm: boolean;
  bpm: number | null;
  tuning: string;
  capo: number;
};

export type ComparableRound = {
  date: string;
  sessionId?: string;
  sequence?: string[];
  shapeIds?: string[];
  pace: number | "manual";
  context?: Partial<ComparableRoundContext>;
  clarity?: Partial<ComparableRoundContext>;
  ratedCoverage?: number;
};

type ShapeLike = string | { name?: string; frets?: number[]; fingers?: Array<number | null> };

/** A stable, bounded signature for comparison and migration from legacy rounds. */
export function shapeSignature(sequence: ShapeLike[] = [], shapeIds: string[] = []) {
  const boundedSequence = sequence.slice(0, 40);
  const boundedIds = shapeIds.slice(0, 40);
  if (boundedSequence.length && boundedIds.length !== boundedSequence.length) return "";
  if (boundedIds.length && boundedIds.every(Boolean)) return boundedIds.join("|");
  const physical = boundedSequence.map((shape) => {
    if (typeof shape === "string") return `name:${shape}`;
    return `shape:${shape.name ?? ""}:${(shape.frets ?? []).slice(0, 6).join(",")}:${(shape.fingers ?? []).slice(0, 6).map((finger) => finger ?? "-").join(",")}`;
  });
  return physical.length ? `${boundedSequence.every((shape) => typeof shape === "string") ? "legacy" : "physical"}:${physical.join("|")}`.slice(0, 8192) : "";
}

export function comparableRoundContext(input: Partial<ComparableRoundContext> & { sequence?: string[]; shapeIds?: string[] }): ComparableRoundContext {
  return {
    shapeSignature: input.shapeSignature || shapeSignature(input.sequence, input.shapeIds),
    sequence: (input.sequence ?? []).slice(0, 40),
    pace: input.pace ?? "manual",
    assistance: input.assistance ?? "unknown",
    assistanceTrail: typeof input.assistanceTrail === "string" ? input.assistanceTrail.slice(0, 2400) : "",
    challenge: input.challenge ?? "standard",
    diagram: input.diagram ?? "full",
    diagramVisibility: input.diagramVisibility ?? "visible",
    preview: input.preview === true,
    landing: input.landing === true,
    warmUp: input.warmUp === true,
    adaptive: input.adaptive === true,
    adaptivePace: typeof input.adaptivePace === "string" ? input.adaptivePace.slice(0, 160) : "",
    rhythm: input.rhythm === true,
    bpm: typeof input.bpm === "number" ? input.bpm : null,
    tuning: input.tuning ?? "standard",
    capo: typeof input.capo === "number" ? input.capo : 0
  };
}

export function compareRoundContexts(left: ComparableRound, right: ComparableRound) {
  const leftContext = left.context ?? left.clarity;
  const rightContext = right.context ?? right.clarity;
  if (!leftContext || !rightContext || left.ratedCoverage === undefined || right.ratedCoverage === undefined || left.ratedCoverage < 80 || right.ratedCoverage < 80) return false;
  const a = comparableRoundContext({ ...leftContext, sequence: left.sequence, shapeIds: left.shapeIds, pace: left.pace });
  const b = comparableRoundContext({ ...rightContext, sequence: right.sequence, shapeIds: right.shapeIds, pace: right.pace });
  if (!a.shapeSignature || !b.shapeSignature || a.shapeSignature.startsWith("legacy:") || b.shapeSignature.startsWith("legacy:") || a.shapeSignature !== b.shapeSignature || a.assistance === "unknown" || b.assistance === "unknown" || a.assistance === "legacy" || b.assistance === "legacy" || !a.assistanceTrail || !b.assistanceTrail || a.assistanceTrail.startsWith("legacy:") || b.assistanceTrail.startsWith("legacy:")) return false;
  return a.pace === b.pace && a.assistance === b.assistance && a.assistanceTrail === b.assistanceTrail && a.challenge === b.challenge && a.diagram === b.diagram && a.diagramVisibility === b.diagramVisibility && a.preview === b.preview && a.landing === b.landing && a.warmUp === b.warmUp && a.adaptive === b.adaptive && a.adaptivePace === b.adaptivePace && a.rhythm === b.rhythm && a.bpm === b.bpm && a.tuning === b.tuning && a.capo === b.capo;
}

export function evidenceLabel(rated: number, total: number, clean: number, pace: number | "manual") {
  if (rated <= 0 || total <= 0) return "Insufficient samples — no accuracy claim yet.";
  const coverage = Math.round((rated / total) * 100);
  const accuracy = Math.round((clean / rated) * 100);
  const paceText = pace === "manual" ? "manual pace" : `${pace}s planned pace`;
  return `${accuracy}% self-rated clean across ${rated}/${total} changes (${coverage}% coverage) at ${paceText}. This is not microphone timing.`;
}

export function assistanceStage(cleanChanges: number, misses: number, enabled: boolean) {
  if (!enabled) return 0;
  if (misses > 0) return 0;
  if (cleanChanges >= 6) return 2;
  if (cleanChanges >= 3) return 1;
  return 0;
}

export function uniqueSuggestedDrill<T>(items: T[], key: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [key(item), item])).values()).slice(0, 1)[0] ?? null;
}
