import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateChordQualityDefinitions, validateHarmonicNotes, validateHarmonicReviewBaseline } from "../../scripts/validate-harmonic-notes.mjs";

const document = JSON.parse(readFileSync("shared/content/v1/chords.json", "utf8"));
const catalog = JSON.parse(readFileSync("shared/content/v1/chord-qualities.json", "utf8"));
const baseline = JSON.parse(readFileSync("shared/content/v1/harmonic-review-baseline.json", "utf8"));
assert.deepEqual(document.qualityDefinitions, catalog, "exported native content mirrors the canonical quality registry");
assert.equal(validateChordQualityDefinitions(catalog).length, catalog.length);
assert.equal(validateHarmonicReviewBaseline(baseline).length, 156, "the current legacy partial-tone set is explicitly review-required");

const messages = [];
const report = validateHarmonicNotes(document.chordLibrary, catalog, (message) => messages.push(message), baseline);
assert.equal(report.coverage.length, 12 * catalog.length, "coverage includes every chromatic root and canonical quality");
assert.equal(report.missingCombinations.length, report.coverage.filter((cell) => cell.count === 0).length);
assert.ok(report.missingCombinations.length > 0, "uncovered families remain visible instead of being fabricated");
assert.equal(report.malformed.length, 0, "existing chart shapes are structurally valid");
assert.equal(report.bassWarnings, 0, "existing slash-bass labels match their sounding bass");
assert.deepEqual(report.unreviewedPartialNotes, [], "current partial charts are covered by explicit unresolved review baseline records");
assert.ok(report.partialNotes.length > 0, "partial-tone voicings are separately reviewable");
assert.ok(report.partialNotes.every((item) => Array.isArray(item.essentialMissing) && Array.isArray(item.optionalMissing)));
assert.ok(messages.some((message) => message.startsWith("Review-required legacy gap (unresolved):")));

const quality = catalog.find((item) => item.id === "major");
const makeShape = (overrides = {}) => ({
  id: "fixture", root: "C", quality: "major", inversion: "standard",
  chord: { name: "C", frets: [-1, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null] },
  ...overrides,
});
const bassMismatch = validateHarmonicNotes([makeShape({ inversion: "inverted", chord: { ...makeShape().chord, name: "C/E" } })], catalog, () => {});
assert.equal(bassMismatch.bassWarnings, 1, "wrong slash bass is classified as fatal-quality input");
const malformed = validateHarmonicNotes([makeShape({ chord: { ...makeShape().chord, frets: [0, 0] } })], catalog, () => {});
assert.deepEqual(malformed.malformed, ["fixture"], "malformed fret arrays are detected");
const missingFinger = validateHarmonicNotes([makeShape({ chord: { ...makeShape().chord, fingers: [null, null, 2, null, 1, null] } })], catalog, () => {});
assert.deepEqual(missingFinger.malformed, ["fixture"], "a fretted note without a finger assignment is malformed");
assert.throws(() => validateChordQualityDefinitions([{ ...quality, intervals: [0, 4, 7], essential: [0, 4], optional: [] }]), /partition/, "formula components must account for every interval");
assert.throws(
  () => validateChordQualityDefinitions([{ ...quality, intervals: [0, 4, 7], essential: [4, 7], optional: [0] }]),
  /root interval 0 as essential/,
  "the root interval cannot be classified as optional",
);
assert.ok(messages.some((message) => message.startsWith("Review-required legacy gap (unresolved):")), "partial tone diagnostics remain distinct and actionable");

const newPartial = makeShape({ id: "new-partial", chord: { name: "C", frets: [-1, -1, -1, -1, -1, 0], fingers: Array(6).fill(null) } });
const unreviewed = validateHarmonicNotes([newPartial], catalog, () => {}, baseline);
assert.deepEqual(unreviewed.unreviewedPartialNotes.map((item) => item.id), ["new-partial"], "new partial charts fail the legacy review baseline");
const knownGapFixedInPart = makeShape({ id: "legacy-gap", chord: { name: "C", frets: [-1, -1, -1, -1, -1, 0], fingers: Array(6).fill(null) } });
const subsetBaseline = { schemaVersion: 1, policy: "review-required-unresolved", entries: [{ id: "legacy-gap", missingIntervals: [0, 4, 7], reviewRequired: true, status: "unresolved" }] };
const improvement = validateHarmonicNotes([knownGapFixedInPart], catalog, () => {}, subsetBaseline);
assert.deepEqual(improvement.unreviewedPartialNotes, [], "reducing a known gap's missing intervals is allowed");
const worsened = makeShape({ ...knownGapFixedInPart, chord: { name: "C", frets: [-1, -1, -1, -1, -1, 5], fingers: [null, null, null, null, null, 1] } });
const worseningBaseline = { ...subsetBaseline, entries: [{ ...subsetBaseline.entries[0], missingIntervals: [0, 7] }] };
const worsening = validateHarmonicNotes([worsened], catalog, () => {}, worseningBaseline);
assert.deepEqual(worsening.unreviewedPartialNotes[0].newIntervals, [4], "newly missing intervals on an existing chart fail review");

console.log(`Chord quality catalog validation passed (${report.coverage.length} roadmap cells, ${report.missingCombinations.length} uncovered combinations, ${report.partial} partial-tone charts).`);
