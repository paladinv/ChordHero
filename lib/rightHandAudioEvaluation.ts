export type EvaluationSample = { file: string; device: string; browser?: string; pickup?: string; noise?: string; instrument: "acoustic" | "electric"; expectedTempoBpm: number; expectedOnsetsMs: number[]; expectedChords?: string[]; consent: { granted: true; scope: "local-evaluation"; source: string; date: string } };
export function parseEvaluationManifest(value: unknown): EvaluationSample[] {
  const manifest = value as { version?: number; samples?: EvaluationSample[] };
  if (manifest?.version !== 1 || !Array.isArray(manifest.samples) || !manifest.samples.length || manifest.samples.length > 12) throw new Error("Manifest version 1 must contain 1–12 samples.");
  for (const sample of manifest.samples) {
    if (!sample || typeof sample.file !== "string" || !sample.file || typeof sample.device !== "string" || !sample.device.trim() || !["acoustic", "electric"].includes(sample.instrument)) throw new Error("Each sample needs a filename, device label and acoustic/electric instrument label.");
    for (const key of ["browser", "pickup", "noise"] as const) if (sample[key] !== undefined && (typeof sample[key] !== "string" || !sample[key]!.trim() || sample[key]!.length > 120)) throw new Error(`${key} must be a nonempty label of at most 120 characters when supplied.`);
    if (!Number.isFinite(sample.expectedTempoBpm) || sample.expectedTempoBpm < 20 || sample.expectedTempoBpm > 300 || !Array.isArray(sample.expectedOnsetsMs) || sample.expectedOnsetsMs.length < 2 || sample.expectedOnsetsMs.length > 256 || sample.expectedOnsetsMs.some((ms, i, all) => !Number.isFinite(ms) || ms < 0 || (i > 0 && ms <= all[i - 1]))) throw new Error("Provide tempo 20–300 and 2–256 strictly increasing, nonnegative reference onset times in milliseconds.");
    if (sample.expectedChords !== undefined && (!Array.isArray(sample.expectedChords) || sample.expectedChords.some((chord) => typeof chord !== "string"))) throw new Error("expectedChords must be an array of chord labels.");
    if (sample.consent?.granted !== true || sample.consent.scope !== "local-evaluation" || typeof sample.consent.source !== "string" || !sample.consent.source.trim() || !Number.isFinite(Date.parse(sample.consent.date))) throw new Error("Every sample needs explicit local-evaluation consent with source and date. Do not import recordings without permission.");
  }
  if (new Set(manifest.samples.map((sample) => sample.file)).size !== manifest.samples.length) throw new Error("Sample filenames must be unique.");
  return manifest.samples;
}
export function compareReferenceOnsets(expected: number[], observed: number[], toleranceMs = 150) {
  const used = new Set<number>(); const offsets: number[] = [];
  for (const target of expected) {
    let closest = -1, distance = toleranceMs + 1;
    observed.forEach((actual, index) => { if (!used.has(index) && Math.abs(actual - target) < distance) { closest = index; distance = Math.abs(actual - target); } });
    if (closest >= 0 && distance <= toleranceMs) { used.add(closest); offsets.push(observed[closest] - target); }
  }
  return { toleranceMs, matched: offsets.length, expected: expected.length, observed: observed.length, absoluteErrorSumMs: offsets.reduce((sum, n) => sum + Math.abs(n), 0), signedErrorSumMs: offsets.reduce((sum, n) => sum + n, 0), coveragePercent: expected.length ? Math.round(offsets.length / expected.length * 100) : 0, precisionPercent: observed.length ? Math.round(offsets.length / observed.length * 100) : 0, meanAbsoluteErrorMs: offsets.length ? Math.round(offsets.reduce((sum, n) => sum + Math.abs(n), 0) / offsets.length) : null, signedBiasMs: offsets.length ? Math.round(offsets.reduce((sum, n) => sum + n, 0) / offsets.length) : null };
}

type CohortResult = Pick<EvaluationSample, "device" | "browser" | "pickup" | "noise" | "instrument"> & { onsetMetrics: ReturnType<typeof compareReferenceOnsets>; chordEvidenceCount: number; chordAgreementCount: number };
export function aggregateEvaluationCohorts(results: CohortResult[]) {
  const summarize = (items: CohortResult[]) => {
    const sums = items.reduce((total, item) => ({ matched: total.matched + item.onsetMetrics.matched, expected: total.expected + item.onsetMetrics.expected, observed: total.observed + item.onsetMetrics.observed, absolute: total.absolute + item.onsetMetrics.absoluteErrorSumMs, signed: total.signed + item.onsetMetrics.signedErrorSumMs, chords: total.chords + item.chordEvidenceCount, agreements: total.agreements + item.chordAgreementCount }), { matched: 0, expected: 0, observed: 0, absolute: 0, signed: 0, chords: 0, agreements: 0 });
    return { samples: items.length, matched: sums.matched, expected: sums.expected, observed: sums.observed, coveragePercent: sums.expected ? Math.round(sums.matched / sums.expected * 100) : null, precisionPercent: sums.observed ? Math.round(sums.matched / sums.observed * 100) : null, meanAbsoluteErrorMs: sums.matched ? Math.round(sums.absolute / sums.matched) : null, signedBiasMs: sums.matched ? Math.round(sums.signed / sums.matched) : null, chordEvidenceCount: sums.chords, retainedChordAgreementPercent: sums.chords ? Math.round(sums.agreements / sums.chords * 100) : null };
  };
  return { overall: summarize(results), cohorts: (["device", "browser", "instrument", "pickup", "noise"] as const).flatMap((dimension) => [...new Set(results.map((item) => item[dimension] ?? "not supplied"))].map((label) => ({ dimension, label, ...summarize(results.filter((item) => (item[dimension] ?? "not supplied") === label)) }))) };
}
