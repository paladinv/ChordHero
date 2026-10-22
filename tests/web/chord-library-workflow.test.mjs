import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const compiled = path.join(root, ".test-artifacts/chord-workflow/compiled");
mkdirSync(path.dirname(compiled), { recursive: true });
rmSync(compiled, { recursive: true, force: true });
try {
  const require = createRequire(import.meta.url);
  const compile = spawnSync(process.execPath, [
    require.resolve("typescript/bin/tsc"), "--outDir", compiled, "--noEmit", "false", "--incremental", "false",
    "--noEmitOnError", "false",
    "--module", "commonjs", "--moduleResolution", "node", "--resolveJsonModule", "true", "--jsx", "react-jsx", "--esModuleInterop", "true",
    "--skipLibCheck", "true", "--target", "es2022", "lib/chordLibraryWorkflow.ts", "lib/chordLab.ts", "lib/chordLibraryEnhancements.ts",
  ], { cwd: root, encoding: "utf8" });
  if (compile.stdout) process.stdout.write(compile.stdout);
  if (compile.stderr) process.stderr.write(compile.stderr);
  assert.ok(compile.status === 0 || compile.status === 2, "TypeScript compiler completed with diagnostics, if any");
  assert.ok(require("node:fs").existsSync(path.join(compiled, "lib/chordLibraryWorkflow.js")), "workflow test compilation emitted runnable JavaScript");
  const workflow = require(path.join(compiled, "lib/chordLibraryWorkflow.js"));
  const { reviewQueue, completenessAudit, inversionBassDegree } = require(path.join(compiled, "lib/chordLab.js"));
  const { buildChordQualityReport, chordLibraryCoverage, scoreVoicing } = require(path.join(compiled, "lib/chordLibraryEnhancements.js"));
  const { CHORD_QUALITIES } = require(path.join(compiled, "lib/chordQualities.js"));
  const chordLibrary = JSON.parse(readFileSync("shared/content/v1/chords.json", "utf8")).chordLibrary;
  const {
    buildLocalShapeReviewPacket, generatePlayableVoicings, identifyChordFromPitchClasses, parseChordIdentity, provenanceConfidence,
    validateLibraryBackup, validateLocalChordShapes, validateSoundingHarmony, validateTransitionLog,
    classifyFingerMovements, suggestVoicingCorrections,
  } = workflow;

const standard = { label: "Standard", strings: ["E", "A", "D", "G", "B", "E"], semitoneOffsets: [0, 0, 0, 0, 0, 0] };
const dropD = { label: "Drop D", strings: ["D", "A", "D", "G", "B", "E"], semitoneOffsets: [-2, 0, 0, 0, 0, 0] };
const find = (id) => chordLibrary.find((entry) => entry.id === id);
const cMajor = find("c-major-open");
assert.ok(cMajor, "curated C major fixture exists");

for (const [query, expected] of [["D/A", ["D", "major", "A"]], ["C/B", ["C", "major", "B"]], ["F#m7", ["F#", "minor7", null]], ["Bb7", ["Bb", "dominant7", null]], ["Cdim", ["C", "diminished", null]]]) {
  const parsed = parseChordIdentity(query);
  assert.ok(parsed, `${query} parses`);
  assert.deepEqual([parsed.root, parsed.quality, parsed.bass], expected, `${query} identity is correct`);
}
assert.deepEqual(CHORD_QUALITIES, JSON.parse(readFileSync("shared/content/v1/chord-qualities.json", "utf8")), "web chord formulas are consumed from the shared registry");
for (const query of ["C+", "Caug", "Cm7b5", "Cm7♭5", "Cø7", "C half-diminished", "Cdim7", "C°7", "C6", "Cm6", "C-6", "C-7", "C9", "Cm9", "Cmaj9", "C11", "Cm11", "Cmaj11", "C13", "Cm13", "Cmaj13", "C♯maj7", "C♭/E♭"]) assert.ok(parseChordIdentity(query), `${query} parses using the shared chord quality registry`);
for (const query of ["", "H", "C/E/G", "C".repeat(49), "C/Hz"]) assert.equal(parseChordIdentity(query), null, `${query} is rejected safely`);

const dOverA = generatePlayableVoicings(parseChordIdentity("D/A"), standard);
assert.ok(dOverA.length > 0 && dOverA.length <= 6, "generator returns a small bounded result set");
for (const shape of dOverA) {
  assert.equal(shape.provenance, "generated");
  assert.equal(shape.inversion, "inverted");
  assert.equal(shape.chord.frets.length, 6);
  assert.ok(shape.chord.frets.every((fret) => Number.isInteger(fret) && fret >= -1 && fret <= 7), "generated frets remain in search bounds");
  const sounding = shape.chord.frets.flatMap((fret, i) => fret < 0 ? [] : [( [40, 45, 50, 55, 59, 64][i] + fret) % 12]);
  assert.equal(sounding[0], 9, "slash chord bass is the requested A");
  assert.ok(sounding.every((pitch) => [2, 6, 9].includes(pitch)), "generated notes belong to D major");
}
assert.ok(generatePlayableVoicings(parseChordIdentity("C"), dropD).length <= 6, "alternate tuning is accepted");
assert.deepEqual(generatePlayableVoicings(parseChordIdentity("C"), { ...standard, semitoneOffsets: [0, 0] }), [], "invalid tuning shape is rejected");

const persistedShapes = validateLocalChordShapes([...dOverA, dOverA[0], { ...dOverA[0], id: "bad-id" }]);
assert.equal(persistedShapes.length, dOverA.length, "duplicate and malformed local shape records are discarded");
const tamperedShape = validateLocalChordShapes([{ ...dOverA[0], chord: { ...dOverA[0].chord, frets: [0, 0] } }]);
assert.deepEqual(tamperedShape, [], "malformed fret arrays cannot be imported");

assert.equal(validateSoundingHarmony(cMajor, standard).status, "pass", "curated C major passes standard tuning theory validation");
const wrongQuality = { ...cMajor, quality: "minor" };
assert.equal(validateSoundingHarmony(wrongQuality, standard).status, "invalid", "mismatched chord quality is flagged");
assert.equal(validateSoundingHarmony(cMajor, standard, 1).status, "pass", "capo shifts both expected and sounding pitches");
assert.equal(validateSoundingHarmony(cMajor, dropD).status, "pass", "alternate tuning is included in sounding-note validation");
const unsupported = { ...cMajor, quality: "not-a-real-quality" };
assert.equal(validateSoundingHarmony(unsupported, standard).status, "unverified", "unsupported formulas do not claim validation");
assert.equal(provenanceConfidence(cMajor, "generated", validateSoundingHarmony(cMajor, standard)).score, 63, "passing generated candidate confidence remains below curated confidence");
assert.equal(provenanceConfidence(cMajor, "generated", validateSoundingHarmony(wrongQuality, standard)).score, 15, "failed validation lowers confidence");

const c7NoFifth = { ...cMajor, quality:"dominant7", chord:{...cMajor.chord,frets:[8,7,8,9,-1,-1]} };
assert.equal(validateSoundingHarmony(c7NoFifth,standard).status,"pass","a voicing with all essential C7 tones may omit its optional fifth");
assert.deepEqual(completenessAudit(c7NoFifth,standard).optionalMissing,["G"],"omitted optional fifth is reported separately");
assert.deepEqual(completenessAudit(c7NoFifth,standard).missing,[],"optional fifth omission is not classified as an essential-tone failure");
const cOverE = { ...cMajor, inversion:"inverted", chord:{...cMajor.chord,name:"C/E",frets:[-1,7,5,5,5,-1]} };
assert.match(inversionBassDegree(cOverE,standard).label,/3rd in bass · E/,"inversion label uses actual bass degree and note");
assert.match(inversionBassDegree(cOverE,standard,1,"flats").label,/3rd in bass · F/ ,"capo flows through bass-degree labels");
assert.match(inversionBassDegree(cOverE,standard,9,"flats").label,/3rd in bass · Db/ ,"enharmonic bass labels honor the flat spelling preference");
const invalidNearby = {...cMajor,chord:{...cMajor.chord,frets:[-1,3,2,0,1,1]}};
const fixes = suggestVoicingCorrections(invalidNearby,standard);
assert.ok(fixes.length > 0 && fixes.length <= 5,"nearby single-string corrections are deterministic and bounded");
assert.equal(suggestVoicingCorrections(cMajor,standard).length,0,"valid charts do not compute correction options");
assert.ok(validateSoundingHarmony(invalidNearby,standard).stringIssues.length>0,"theory report identifies offending string and fret");
const coverage=chordLibraryCoverage([cMajor,cOverE],standard);
assert.equal(coverage.scanned,2);
assert.ok(coverage.cells.find(cell=>cell.root==="C"&&cell.quality==="major").byDegree["3rd in bass"]>0,"coverage groups actual inversion degrees");
const report=buildChordQualityReport([cMajor,wrongQuality,unsupported],standard);
assert.deepEqual(report.counts.theory,{pass:1,invalid:1,unverified:1},"export report totals pass, invalid, and unverified separately");
assert.ok(report.coverage.cells.length<=12*23,"coverage export is bounded by root and supported quality sets");
const legacyLocal=validateLocalChordShapes([{...dOverA[0],reviewStatus:undefined,reviewedAt:undefined}]);
assert.equal(legacyLocal[0].reviewStatus,"unreviewed","legacy local shapes remain import-compatible and default to review");
const approved=validateLocalChordShapes([{...dOverA[0],reviewStatus:"user-verified",reviewedAt:"2026-10-21T12:00:00Z"}]);
assert.equal(approved[0].reviewStatus,"user-verified","approved status stays local and survives validation");
const manualReviewShape = {...approved[0],id:"local-manual-review-fixture",provenance:"manual",reviewStatus:"unreviewed"};
const reviewPacket = buildLocalShapeReviewPacket([manualReviewShape, approved[0], ...dOverA], standard);
assert.equal(reviewPacket.kind,"local-chord-shape-review-packet");
assert.equal(reviewPacket.canonicalPromotion,false,"review export never promotes local shapes to canonical content");
assert.equal(reviewPacket.entries[0].provenance,"manual");
assert.equal(reviewPacket.entries[0].reviewStatus,"unreviewed");
assert.equal(reviewPacket.entries[1].provenance,"generated");
assert.equal(reviewPacket.entries[1].reviewStatus,"user-verified");
assert.equal(reviewPacket.entries[0].formula.qualityId,"major");
assert.ok(["pass","invalid","unverified"].includes(reviewPacket.entries[0].pitchValidation.status));
assert.ok(!JSON.stringify(reviewPacket).toLowerCase().includes("teacher verified"),"review packet makes no teacher endorsement claim");
const boundedPacket = buildLocalShapeReviewPacket(Array.from({length:205},(_,i)=>({...dOverA[0],id:`local-generated-review-${i}`})),standard);
assert.equal(boundedPacket.entries.length,200,"review export is capped at the local-shape import bound");
assert.equal(boundedPacket.scope.capped,true);
const baseScore=scoreVoicing(cMajor,19,25.5,"medium"), unseenScore=scoreVoicing(cMajor,19,25.5,"medium",undefined,[0,0,0,0,0,0],0,{reps:0,clean:0,misses:0});
assert.equal(baseScore.score,unseenScore.score,"unpracticed voicings have no hidden score penalty");
const practiceScore=scoreVoicing(cMajor,19,25.5,"medium",undefined,[0,0,0,0,0,0],0,{reps:10,clean:9,misses:1});
assert.ok(practiceScore.score>=baseScore.score-6&&practiceScore.score<=baseScore.score+4,"practice score remains conservatively bounded");
assert.ok(practiceScore.reasons.some(reason=>reason.includes("Practice signal")),"practice score explains the measured adjustment");
assert.ok(baseScore.reasons.some(reason=>reason.includes("No practice penalty")),"unpracticed score rationale is explicit");

const edgeFailures = [];
const edgeCase = (name, run) => {
  try { run(); console.log(`PASS edge case: ${name}`); }
  catch (error) { edgeFailures.push({ name, error }); console.error(`FAIL edge case: ${name}: ${error.message}`); }
};
edgeCase("C/B retains the non-chord slash bass and can produce a candidate", () => {
  const identity = parseChordIdentity("C/B");
  assert.equal(identity.bass, "B");
  const shapes = generatePlayableVoicings(identity, standard);
  assert.ok(shapes.length > 0, "non-chord slash bass should not be silently treated as a C-triad tone");
  for (const shape of shapes) {
    const first = shape.chord.frets.findIndex((fret) => fret >= 0);
    assert.notEqual(first, -1);
    assert.equal(([40, 45, 50, 55, 59, 64][first] + shape.chord.frets[first]) % 12, 11);
  }
});
edgeCase("inverted validation rejects a root-position bass but accepts C/E", () => {
  const rootBassMarkedInverted = { ...cMajor, inversion: "inverted" };
  assert.equal(validateSoundingHarmony(rootBassMarkedInverted, standard).status, "invalid");
  const firstInversion = { ...cMajor, inversion: "inverted", chord: { ...cMajor.chord, name: "C/E", frets: [-1, 7, 5, 5, 5, -1] } };
  assert.equal(validateSoundingHarmony(firstInversion, standard).status, "pass");
});
edgeCase("Drop D selects the lowered sixth string as the actual bass", () => {
  const dShape = { ...cMajor, root: "D", quality: "major", inversion: "standard", chord: { ...cMajor.chord, name: "D", frets: [0, -1, 0, 2, 3, 2] } };
  assert.equal(validateSoundingHarmony(dShape, dropD).status, "pass");
  assert.equal(validateSoundingHarmony(dShape, standard).status, "invalid", "the same shape must not be treated as Drop D under standard tuning");
});
edgeCase("MIDI note-off preserves a shared pitch class while another octave remains held", () => {
  const source = readFileSync("components/ChordLabPanel.tsx", "utf8");
  assert.doesNotMatch(source, /old\.filter\(n\s*=>\s*n\s*!==\s*note\s*%\s*12\)/, "MIDI state must retain active note numbers, not remove a pitch class on any octave's note-off");
  assert.match(source, /identifyChordFromPitchClasses\([^\n]*map\([^\n]*%\s*12/, "active MIDI note numbers should be reduced to pitch classes only for chord identification");
});
assert.deepEqual(identifyChordFromPitchClasses([0, 4, 7]), { root: "C", quality: "major" }, "pitch-class input identifies a major triad");
assert.deepEqual(identifyChordFromPitchClasses([9, 0, 4]), { root: "A", quality: "minor" }, "input order does not affect minor-chord recognition");
assert.deepEqual(identifyChordFromPitchClasses([0, 4, 10]), { root: "C", quality: "dominant7" }, "pitch-set matching uses the central dominant seventh formula with its optional fifth omitted");
assert.equal(identifyChordFromPitchClasses([0, 3, 6, 10]), null, "enharmonic half-diminished/minor-sixth equivalence is not guessed");
assert.equal(identifyChordFromPitchClasses([0, 4, 8]), null, "symmetrical augmented pitch sets remain unlabelled when the root is ambiguous");
assert.equal(identifyChordFromPitchClasses([]), null, "empty MIDI input has no chord identity");
assert.equal(identifyChordFromPitchClasses([0, 1, 6]), null, "unsupported pitch collections do not receive a guessed identity");

const backup = { version: 1, data: { overrides: {}, history: {}, collections: [], shapes: dOverA, transitions: [] } };
assert.equal(validateLibraryBackup(backup).ok, true, "valid local backup is accepted");
assert.equal(validateLibraryBackup({ ...backup, version: 99 }).ok, false, "unknown backup versions are rejected");
assert.equal(validateLibraryBackup({ ...backup, data: { ...backup.data, shapes: "bad" } }).ok, false, "malformed backup sections are rejected");
assert.equal(validateLibraryBackup({ version: 1, data: { ...backup.data, shapes: [...dOverA, ...dOverA] } }).data.shapes.length, dOverA.length, "backup shape imports are deduplicated and validated");
assert.equal(validateLibraryBackup({ version: 1, data: { ...backup.data, shapes: [], transitions: [] }, padding: "x".repeat(256_100) }).ok, false, "oversized backups are rejected");
const labSource = readFileSync("components/ChordLabPanel.tsx", "utf8");
assert.match(labSource, /Keep local conflicts and merge/, "import UI exposes a local-wins merge choice");
assert.match(labSource, /Use imported records/, "import UI exposes an explicit replace choice");
assert.match(labSource, /const merged=\{\.\.\.safeOverrides,\.\.\.overrides\}/, "merge policy retains local override values on ID conflicts");
assert.match(labSource, /!current\.some\(c=>c\.id===x\.id\)/, "merge policy retains existing collection, shape, and transition IDs");
assert.match(labSource,/Export JSON quality report/,"quality export is an accessible named control in the maintenance panel");
assert.match(labSource,/Suggest nearby fret or mute corrections/,"correction computation requires an explicit accessible action");
assert.match(readFileSync("components/ChordSearchFallback.tsx","utf8"),/Approve as user-verified local shape/,"generated candidate approval is explicit and local");

const moves = classifyFingerMovements(
  { name: "A", frets: [-1, 0, 2, 2, 2, 0], fingers: [null, null, 2, 3, 4, null] },
  { name: "B", frets: [-1, 2, 4, 4, 4, 2], fingers: [null, 1, 3, 3, 3, 1] },
);
assert.equal(moves.length, 6, "movement inspector describes all six strings");
assert.equal(moves[0].state, "muted both");
assert.equal(moves[2].state, "re-finger");
assert.equal(moves[4].state, "re-finger");
assert.equal(moves[5].state, "move");

const log = validateTransitionLog([
  { id: "clean", fromId: "a", toId: "b", outcome: "clean", tempo: 80.4, timestamp: "2026-10-20T12:00:00Z" },
  { id: "bad-tempo", fromId: "a", toId: "b", outcome: "missed", tempo: 999, timestamp: "2026-10-20T12:00:00Z" },
  { id: "bad-date", fromId: "a", toId: "b", outcome: "clean", tempo: 80, timestamp: "invalid" },
]);
assert.equal(log.length, 1, "invalid observed transition events are dropped");
assert.equal(log[0].tempo, 80, "observed tempo is normalized to an integer");
assert.equal(validateTransitionLog(Array.from({ length: 510 }, (_, i) => ({ id: `e${i}`, fromId: "a", toId: "b", outcome: "clean", tempo: 80, timestamp: "2026-10-20T12:00:00Z" }))).length, 500, "transition history is bounded");

const due = { ...cMajor, id: "due" }, unpracticed = { ...cMajor, id: "new" };
const queue = reviewQueue([unpracticed, due], { due: { reps: 3, misses: 2, nextReviewAt: "2026-10-20T00:00:00Z" } }, Date.parse("2026-10-21T00:00:00Z"));
assert.equal(queue[0].entry.id, "due", "due and weak items are prioritized ahead of new shapes");
assert.equal(queue[0].due, true);
assert.ok(queue.find((item) => item.entry.id === "new").reason.includes("No repetitions"), "unpracticed entries are explicitly identified");

if (edgeFailures.length) {
  throw new AggregateError(edgeFailures.map(({ name, error }) => new Error(`${name}: ${error.message}`)), `${edgeFailures.length} requested edge case(s) failed`);
}

  console.log("Chord library workflow acceptance tests passed.");
} finally {
  rmSync(compiled, { recursive: true, force: true });
}
