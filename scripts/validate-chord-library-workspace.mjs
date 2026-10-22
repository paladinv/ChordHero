import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const compiled = path.join(root, ".test-artifacts/library-verification/compiled");
mkdirSync(path.dirname(compiled), { recursive: true });
rmSync(compiled, { recursive: true, force: true });
try {
const require = createRequire(import.meta.url);
execFileSync(process.execPath, [
  require.resolve("typescript/bin/tsc"), "--outDir", compiled, "--noEmit", "false", "--incremental", "false",
  "--module", "commonjs", "--moduleResolution", "node", "--resolveJsonModule", "true", "--jsx", "react-jsx", "--esModuleInterop", "true",
  "--skipLibCheck", "true", "--target", "es2022", "lib/chordLibraryWorkspace.ts", "lib/chordLab.ts",
  "lib/chordLibraryEnhancements.ts", "lib/chordOverrides.ts", "lib/noteSpelling.ts",
], { cwd: root, stdio: "inherit" });
const workspace = require(path.join(compiled, "lib/chordLibraryWorkspace.js"));
const lab = require(path.join(compiled, "lib/chordLab.js"));
const enhancements = require(path.join(compiled, "lib/chordLibraryEnhancements.js"));
const overridesModule = require(path.join(compiled, "lib/chordOverrides.js"));
const spellingModule = require(path.join(compiled, "lib/noteSpelling.js"));
const harmony = require(path.join(compiled, "lib/harmony.js"));
const { validateFilterSnapshot, validateLibraryFilters, validateSavedSearches } = workspace;
const { actualChordName, completenessAudit, optimizeProgression, soundingSummary } = lab;
const { auditChordLibrary, scoreVoicing, validateChordCollections } = enhancements;
const { validateChordOverrides } = overridesModule;
const { spellPitchClass } = spellingModule;
const { scoreTransition } = harmony;

const { chordLibrary } = JSON.parse(readFileSync("shared/content/v1/chords.json", "utf8"));
const byId = (id) => chordLibrary.find((entry) => entry.id === id);
const standard = { label: "Standard", strings: ["E", "A", "D", "G", "B", "E"], semitoneOffsets: [0, 0, 0, 0, 0, 0] };
const dropD = { label: "Drop D", strings: ["D", "A", "D", "G", "B", "E"], semitoneOffsets: [-2, 0, 0, 0, 0, 0] };

const validFilters = {
  root: "C", quality: "major", inversion: "all", tag: "beginner", functionKey: "C",
  mode: "major", event: "diatonic", role: "I", search: "C open", fret: "all", strings: "all",
  collection: "all", packId: "all",
};
const savedSearch = { id: "c-major", name: "C major shapes", filters: validFilters };

assert.deepEqual(validateLibraryFilters(validFilters, ["walking-bass"]), validFilters, "valid presets round-trip unchanged");
const secondaryDominantFilters = { ...validFilters, event: "secondary-dominant", role: "V/V" };
assert.deepEqual(
  validateLibraryFilters(secondaryDominantFilters, ["walking-bass"]),
  secondaryDominantFilters,
  "valid secondary-dominant role survives preset validation",
);
assert.deepEqual(
  validateSavedSearches([{ ...savedSearch, id: "secondary-dominant", filters: secondaryDominantFilters }], ["walking-bass"])[0]?.filters,
  secondaryDominantFilters,
  "valid V/V saved preset round-trips",
);
assert.deepEqual(
  validateFilterSnapshot({ filters: validFilters, selectedId: "c-major-open" }, ["walking-bass"]),
  { filters: validFilters, selectedId: "c-major-open" },
  "undo snapshot retains every filter and selected entry",
);
assert.equal(validateFilterSnapshot({ filters: validFilters, selectedId: { injected: true } }), null, "malformed selection cannot become an object ID");
assert.equal(validateFilterSnapshot({ filters: { ...validFilters, root: "imaginary-root" } }), null, "malformed root causes all-filter fallback");
assert.equal(validateFilterSnapshot({ filters: { ...validFilters, quality: "no-such-quality" } }), null, "malformed quality causes all-filter fallback");
assert.equal(validateFilterSnapshot({ filters: { ...validFilters, functionKey: "not-a-key" } }), null, "malformed key causes all-filter fallback");
assert.equal(validateFilterSnapshot({ filters: { ...validFilters, event: "unknown-event" } }), null, "malformed event causes all-filter fallback");
assert.equal(validateFilterSnapshot({ filters: { ...validFilters, role: "unknown-role" } }), null, "malformed role causes all-filter fallback");
assert.equal(validateFilterSnapshot({ filters: { ...validFilters, tag: "unknown-tag" } }), null, "malformed tag causes all-filter fallback");
assert.deepEqual(validateSavedSearches([savedSearch], ["walking-bass"]), [savedSearch], "valid saved preset round-trips");
assert.deepEqual(validateSavedSearches([null, {}, { ...savedSearch, filters: { ...validFilters, role: "bad-role" } }]), [], "invalid stored presets are discarded rather than retained as impossible filters");
assert.equal(validateSavedSearches(Array.from({ length: 25 }, (_, i) => ({ ...savedSearch, id: `preset-${i}` }))).length, 20, "saved preset storage is bounded");

const cOpen = byId("c-major-open");
assert.ok(cOpen, "C-major fixture exists");
const standardSummary = soundingSummary(cOpen, standard);
assert.equal(standardSummary.supported, true);
assert.deepEqual(standardSummary.pitches, ["C", "E", "G"], "standard tuning pitch classes reflect actual frets");
assert.equal(actualChordName(cOpen, standard), "C");
assert.equal(actualChordName(cOpen, standard, 1), "C#", "capo changes actual chord name by one semitone");
assert.equal(actualChordName(cOpen, standard, 1, "flats"), "Db", "capo-aware chord names honor flat spelling");
assert.deepEqual(soundingSummary(cOpen, dropD).pitches, ["C", "E", "G"], "Drop D reports the actual sounding pitch set");
assert.equal(actualChordName(cOpen, dropD), "C", "alternate tuning retains the chord name when this voicing's pitches do");
assert.equal(actualChordName({ ...cOpen, root: "Db", chord: { ...cOpen.chord, frets: [-1, 4, 6, 6, 6, 4] } }, standard, 0, "flats"), "Db", "enharmonic flat root aliases are recognized for a transposed voicing");
assert.deepEqual(soundingSummary(cOpen, { ...dropD, label: "DADGAD alias" }).pitches, ["C", "E", "G"], "alternate tuning offsets, not tuning labels, determine sounding pitches");
assert.equal(spellPitchClass(1, "sharps"), "C#");
assert.equal(spellPitchClass(1, "flats"), "Db");
assert.equal(spellPitchClass(1), "C#", "default spelling remains stable");
assert.equal(spellPitchClass(-1, "sharps"), "B", "negative pitch classes wrap modulo twelve");
assert.equal(spellPitchClass(13, "flats"), "Db", "pitch classes above the octave wrap modulo twelve");

const asymmetric = { ...cOpen, chord: { ...cOpen.chord, frets: [-1, 8, 2, 4, 1, 7] } };
const asymmetricSummary = soundingSummary(asymmetric, standard, 2);
const actualMidi = [45 + 8 + 2, 50 + 2 + 2, 55 + 4 + 2, 59 + 1 + 2, 64 + 7 + 2];
assert.equal(asymmetricSummary.bass, "F#", "bass is not assumed to be the first sounding string");
assert.equal(asymmetricSummary.melody, "C#", "top voice is selected by MIDI maximum, not string array compression");
assert.equal(asymmetricSummary.bass, ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][(Math.min(...actualMidi) % 12)], "bass is the lowest actual sounding MIDI note");
assert.equal(asymmetricSummary.melody, ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][(Math.max(...actualMidi) % 12)], "melody is the highest actual sounding MIDI note");

const audit = completenessAudit(cOpen, standard);
assert.equal(audit.supported, true);
assert.deepEqual(audit.missing, [], "complete C major shape contains all expected chord tones");
assert.ok(audit.doubled.length > 0, "repeated chord tones are reported");
const incomplete = { ...cOpen, chord: { ...cOpen.chord, frets: [-1, -1, 2, 0, -1, 0] } };
assert.ok(completenessAudit(incomplete, standard).missing.length > 0, "missing chord tones are reported");

const mk = (id, frets) => ({ ...cOpen, id, chord: { ...cOpen.chord, frets } });
const groups = [
  [mk("A0", [-1, 0, 0, 0, 0, 0]), mk("A1", [6, 6, 6, 6, 6, 6])],
  [mk("B0", [5, 5, 5, 5, 5, 5]), mk("B1", [12, 12, 12, 12, 12, 12])],
  [mk("C0", [11, 11, 11, 11, 11, 11]), mk("C1", [18, 18, 18, 18, 18, 18])],
];
const openMidi = [40, 45, 50, 55, 59, 64];
const midiAtString = (entry, index) => entry.chord.frets[index] < 0 ? null : openMidi[index] + entry.chord.frets[index];
const cost = (a, b) => openMidi.reduce((sum, _open, index) => {
  const left = midiAtString(a, index), right = midiAtString(b, index);
  return sum + (left === null && right === null ? 0 : left === null || right === null ? 8 : Math.abs(left - right));
}, 0) + scoreTransition(a.chord, b.chord).score / 20;
let bruteBest = Infinity;
for (const a of groups[0]) for (const b of groups[1]) for (const c of groups[2]) bruteBest = Math.min(bruteBest, cost(a, b) + cost(b, c));
const optimized = optimizeProgression(groups, standard);
assert.ok(optimized, "valid progression has a route");
assert.ok(Math.abs(optimized.total - bruteBest) < 1e-9, "dynamic programming returns global minimum versus exhaustive search");
const greedy = [groups[0][0]];
for (const choices of groups.slice(1)) greedy.push(choices.toSorted((a, b) => cost(greedy.at(-1), a) - cost(greedy.at(-1), b))[0]);
assert.ok(greedy.reduce((sum, entry, index) => index ? sum + cost(greedy[index - 1], entry) : sum, 0) > bruteBest, "fixture distinguishes global optimization from greedy nearest-neighbor selection");
assert.equal(optimizeProgression([], standard), null, "empty progression is rejected");
assert.equal(optimizeProgression([[]], standard), null, "empty identity group is rejected");
assert.equal(optimizeProgression([[{ ...cOpen, chord: { ...cOpen.chord, frets: [0] } }]], standard), null, "unsupported voicing input is rejected");

const validOverride = {
  chord: { name: "C custom", frets: [...cOpen.chord.frets], fingers: [...cOpen.chord.fingers] },
  displayLabel: "C custom", root: "C", quality: "major", inversion: "standard", updatedAt: "2026-10-21T00:00:00.000Z",
};
const validOverrideResult = validateChordOverrides({ [cOpen.id]: validOverride });
assert.equal(validOverrideResult[cOpen.id]?.displayLabel, "C custom", "valid local chord override is retained");
assert.equal(validateChordOverrides({ [cOpen.id]: { ...validOverride, inversion: "third" } })[cOpen.id], undefined, "unsupported inversion is discarded");
assert.equal(validateChordOverrides({ [cOpen.id]: { ...validOverride, displayLabel: "<script>alert(1)</script>" } })[cOpen.id], undefined, "unsafe display labels are discarded");
assert.equal(validateChordOverrides({ [cOpen.id]: { ...validOverride, displayLabel: "C".repeat(49) } })[cOpen.id], undefined, "overlong display labels are discarded");
assert.equal(validateChordOverrides({ "unknown-chord-id": validOverride })["unknown-chord-id"], undefined, "overrides for unknown library IDs are discarded");

const collectionInput = [
  { id: "favorites", name: " Favorites ", chordIds: [cOpen.id, cOpen.id, "unknown-chord-id"], updatedAt: "x".repeat(80) },
  { id: "favorites", name: "Duplicate collection", chordIds: [cOpen.id] },
  ...Array.from({ length: 31 }, (_, index) => ({ id: `collection-${index}`, name: `Collection ${index}`, chordIds: [cOpen.id] })),
];
const collections = validateChordCollections(collectionInput);
assert.ok(collections.length <= 30, "collection count is bounded");
assert.equal(new Set(collections.map(collection => collection.id)).size, collections.length, "duplicate collection IDs are removed");
assert.equal(collections[0].name, "Favorites", "collection names are trimmed");
assert.deepEqual(collections[0].chordIds, [cOpen.id], "collection chord IDs are deduplicated and unknown IDs are removed");
assert.ok(collections[0].updatedAt.length <= 32, "collection timestamps are bounded");
const manyChordIds = [...new Set(chordLibrary.map(entry => entry.id))];
const boundedCollection = validateChordCollections([{ id: "bounded", name: "Bounded", chordIds: manyChordIds }])[0];
assert.ok(boundedCollection.chordIds.length <= 100, "chord IDs per collection are bounded");

const score = scoreVoicing(cOpen, Number.NaN, Number.POSITIVE_INFINITY, "medium", Number.POSITIVE_INFINITY, [0, 0, 0, 0, 0, 0], 99);
assert.ok(Number.isFinite(score.score) && score.score >= 0 && score.score <= 100, "invalid score inputs still produce a finite bounded total");
for (const key of ["completeness", "fingering", "fretSpan", "muting", "transition", "setup", "span"]) {
  assert.ok(Number.isFinite(score[key]), `score component ${key} is finite`);
  if (key !== "span" && key !== "muting") assert.ok(score[key] >= 0 && score[key] <= 100, `score component ${key} is bounded`);
}
assert.ok(score.reasons.some(reason => reason.includes("normalized to a safe value")), "invalid numeric preferences are disclosed");
const unsupportedScore = scoreVoicing({ ...cOpen, quality: "not-a-real-quality" }, 19, 25.5, "low");
assert.equal(unsupportedScore.completeness, null, "unsupported chord formulas do not claim tone coverage");
assert.ok(unsupportedScore.reasons.some(reason => reason.includes("unsupported quality")), "unsupported formula coverage is explained");

const qualityAudit = auditChordLibrary([
  { id: "missing-chart", root: "C", quality: "major", qualityLabel: "Major", inversion: "standard" },
  { id: "missing-chart", chord: { name: "Duplicate", frets: [0, 0, 0, 0, 0, 0] }, root: "C", quality: "major", qualityLabel: "Major", inversion: "standard" },
  { id: "missing-frets", chord: { name: "No frets", fingers: [null, null, null, null, null, null] }, root: "C", quality: "major", qualityLabel: "Major", inversion: "standard" },
  { id: "missing-fingers", chord: { name: "No fingers", frets: [0, 0, 0, 0, 0, 0] }, root: "C", quality: "major", qualityLabel: "Major", inversion: "standard" },
]);
assert.equal(qualityAudit.scanned, 4, "quality audit reports the number of inspected records");
assert.ok(qualityAudit.issues.some(issue => issue.id === "missing-chart" && issue.issue === "Missing chart data"), "missing chord chart is reported safely");
assert.ok(qualityAudit.issues.some(issue => issue.id === "missing-chart" && issue.issue === "Duplicate record ID"), "duplicate chord IDs are reported");
assert.ok(qualityAudit.issues.some(issue => issue.id === "missing-frets" && issue.issue === "Missing chart data"), "missing fret arrays are reported safely");
assert.ok(qualityAudit.issues.some(issue => issue.id === "missing-fingers" && issue.issue === "Missing or invalid fingering data"), "missing finger arrays are reported safely");

console.log("Chord library workspace/lab acceptance checks passed.");
} finally {
  rmSync(compiled, { recursive: true, force: true });
}
