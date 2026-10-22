import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTRUMENT_TUNINGS,
  CHORD_FAMILY_QUALITIES,
  buildSyntheticStrumPlan,
  analyzeVoicingCoverage,
  analyzeVoicingBass,
  chartShapeEvidence,
  chordFamilyDifferential,
  compareChartVersions,
  explainVoicingChoice,
  explainOpenStringResonance,
  generateInstrumentVoicings,
  mapShapeContacts,
  mapIdentityVoicings,
  neckChordTones,
} from "../../lib/chordChartDeepTools.ts";

const item = (id, root, quality, position, frets) => ({ id, root, quality, position, chord: { name: root, frets }, practiceFocus: "Keep it relaxed." });
const pitch = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

test("alternate-instrument generator returns only complete chord-formula voicings", () => {
  for (const instrument of ["ukulele", "baritone-guitar", "seven-string"]) {
    const results = generateInstrumentVoicings("C", "major", instrument, 5);
    assert(results.length > 0 && results.length <= 5, `${instrument} should have bounded results`);
    for (const result of results) {
      const actual = new Set(result.notes.filter((note) => note !== "×").map((note) => pitch[note]));
      assert.deepEqual([...actual].sort((a, b) => a - b), [0, 4, 7]);
      assert.equal(result.frets.length, INSTRUMENT_TUNINGS[instrument].notes.length);
      assert.deepEqual(result.coverage, ["R", "3", "5"]);
    }
  }
});

test("synthetic strum plan applies direction, articulation, alternating strokes, and tone", () => {
  const down = buildSyntheticStrumPlan([40, 45, 50], { direction: "down", articulation: "ring", tone: "triangle" });
  assert.deepEqual(down.map((event) => event.midi), [40, 45, 50]);
  assert.equal(down[0].duration, 1.35);
  assert.equal(down[0].oscillator, "triangle");
  const alternateUp = buildSyntheticStrumPlan([40, 45, 50], { direction: "alternate", articulation: "muted", tone: "sawtooth" }, 1);
  assert.deepEqual(alternateUp.map((event) => event.midi), [50, 45, 40]);
  assert.equal(alternateUp[0].duration, 0.28);
  assert.equal(alternateUp[0].oscillator, "sawtooth");
  assert(alternateUp[1].offset > alternateUp[0].offset);
});

test("interval coverage identifies doubled and missing formula tones", () => {
  const complete = analyzeVoicingCoverage([-1, 3, 2, 0, 1, 0], ["E", "A", "D", "G", "B", "E"], "C", "major");
  assert.deepEqual(complete.missing, []);
  assert.match(complete.summary, /R×2/);
  const partial = analyzeVoicingCoverage([-1, 3, -1, -1, -1, -1], ["E", "A", "D", "G", "B", "E"], "C", "major");
  assert.deepEqual(partial.missing, ["3", "5"]);
});

test("neck view is bounded and marks roots", () => {
  const tones = neckChordTones("C", "major", ["E", "A", "D", "G", "B", "E"], 12);
  assert(tones.some((tone) => tone.root && tone.fret === 8 && tone.string === 0));
  assert(tones.every((tone) => tone.fret >= 0 && tone.fret <= 12));
  const capoTones = neckChordTones("C", "major", ["E", "A", "D", "G", "B", "E"], 12, 2);
  assert(capoTones.every((tone) => tone.fret >= 2));
  assert(capoTones.some((tone) => tone.root));
});

test("identity map links matching quality and respects explicit CAGED metadata", () => {
  const open = item("open", "C", "major", "Open shape", [-1, 3, 2, 0, 1, 0]);
  const barre = item("barre", "C", "major", "A-shape barre", [-1, 3, 5, 5, 5, 3]);
  const wrong = item("minor", "C", "minor", "Open shape", [-1, 3, 1, 0, 1, -1]);
  const mapped = mapIdentityVoicings([open, barre, wrong], open);
  assert.deepEqual(mapped.map((entry) => entry.id), [open.id, barre.id]);
  assert.equal(mapped[1].form, "A-form");
});

test("family differential reports formula changes from major and selectable extensions", () => {
  const family = chordFamilyDifferential("C", ["major", "minor", "dominant7"]);
  assert.deepEqual(family[0].formula, ["R", "3", "5"]);
  assert.deepEqual(family[1].added, ["♭3"]);
  assert.deepEqual(family[1].removed, ["3"]);
  assert.deepEqual(family[2].added, ["♭7"]);
  const extended = chordFamilyDifferential("C", ["major", "major9", "dominant9", "minor9", "add11"], "major");
  assert.deepEqual(extended.find((item) => item.quality === "major9").added, ["7", "2/9"]);
  assert.deepEqual(extended.find((item) => item.quality === "dominant9").added, ["♭7", "2/9"]);
  assert.deepEqual(extended.find((item) => item.quality === "add11").added, ["4/11"]);
  assert(CHORD_FAMILY_QUALITIES.includes("halfDiminished7"));
  assert.equal(chordFamilyDifferential("C", ["major", "minor"], "minor")[0].added.includes("3"), true);
});

test("voicing explanation uses observable shape and pitch facts", () => {
  const open = { ...item("c", "C", "major", "Open shape", [-1, 3, 2, 0, 1, 0]), difficultyTags: ["beginner"] };
  const reasons = explainVoicingChoice(open, "match");
  assert(reasons.some((reason) => /Open-position.*2 open strings/.test(reason)));
  assert(reasons.some((reason) => /span 3 frets/.test(reason)));
  assert(reasons.some((reason) => /beginner/.test(reason)));
  assert(reasons.some((reason) => /All required chord tones match/.test(reason)));
  assert.match(explainVoicingChoice(open, "mismatch").at(-1), /Review the pitch warning/);
});

test("source evidence and bass degree reflect tuning and capo pitches", () => {
  assert.equal(chartShapeEvidence(true), "Library · pitch match");
  assert.equal(chartShapeEvidence(false, true), "Library · partial");
  assert.equal(chartShapeEvidence(false), "Library · check notes");
  const rootBass = analyzeVoicingBass([-1, 3, 2, 0, 1, 0], ["E", "A", "D", "G", "B", "E"], "C", "major");
  assert.equal(rootBass?.note, "C3");
  assert.equal(rootBass?.degree, "root position");
  const firstInversion = analyzeVoicingBass([-1, 7, 5, 5, 5, -1], ["E", "A", "D", "G", "B", "E"], "C", "major", 1);
  assert.equal(firstInversion?.note, "F3");
  assert.equal(firstInversion?.degree, "3rd in bass");
  const wrongBass = analyzeVoicingBass([1, -1, -1, -1, -1, -1], ["E", "A", "D", "G", "B", "E"], "C", "major");
  assert.equal(wrongBass?.isChordTone, false);
  assert.equal(wrongBass?.degree, "non-chord bass tone");
});

test("shape contact map is bounded and distinguishes played contacts", () => {
  const contacts = mapShapeContacts([-1, 3, 2, 0, 1, 0], ["E", "A", "D", "G", "B", "E"], "C");
  assert.equal(contacts.length, 5);
  assert(contacts.some((contact) => contact.root));
  assert(contacts.every((contact) => contact.fret <= 12));
  assert.deepEqual(mapShapeContacts([20], ["E"], "C").map((item) => item.fret), []);
});

test("open-string resonance explanation names the conflicting pitch", () => {
  const conflicts = explainOpenStringResonance([0, -1, -1, -1, -1, -1], ["E", "A", "D", "G", "B", "E"], "D", "major");
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0].reason, /sounds E.*outside/i);
  assert.deepEqual(explainOpenStringResonance([-1, -1, 0, -1, -1, -1], ["E", "A", "D", "G", "B", "E"], "D", "major", 2), []);
});

test("visual version diff reports cards, order, settings, tags, and notes", () => {
  const diff = compareChartVersions(
    { selectedIds: ["c", "g"], practiceBpm: 80, rhythmPattern: "D D", flashcards: "off", annotations: { notes: "old" }, tags: ["verse"] },
    { selectedIds: ["g", "am"], practiceBpm: 92, rhythmPattern: "D U", flashcards: "front", annotations: { notes: "new" }, tags: ["chorus"] },
  );
  assert.deepEqual(diff.added, ["am"]);
  assert.deepEqual(diff.removed, ["c"]);
  assert.deepEqual(diff.moved, [{ id: "g", from: 2, to: 1 }]);
  assert.equal(diff.changedSettings.length, 3);
  assert.equal(diff.notesChanged, true);
  assert.deepEqual(diff.tagAdded, ["chorus"]);
  const settingsDiff = compareChartVersions(
    { selectedIds: ["c"], settings: { capo: 0, tuning: "standard", layout: "full" } },
    { selectedIds: ["c"], settings: { capo: 2, tuning: "drop-d", layout: "compact" } },
  );
  assert.deepEqual(settingsDiff.changedSettings.map((item) => item.key), ["capo", "tuning", "layout"]);
});
