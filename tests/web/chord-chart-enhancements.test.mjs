import assert from "node:assert/strict";
import test from "node:test";
import { analyzeChordChartHealth, chordStringMidiNotes, createSetlistTransposeCopies, optimizeChordProgression, previewSetlistTranspose, spellChordForKey, validateCustomChordShape } from "../../lib/chordChartEnhancements.ts";

const item = (id, root, quality, frets, fingers = [null, null, null, null, null, null]) => ({ id, root, quality, qualityLabel: quality, inversion: "standard", position: "Open shape", chord: { name: root, frets, fingers }, difficultyTags: [], summary: "", recommendedVariant: "", alternateFingerings: [], functionContexts: [], mutingNotes: [], avoidStrings: [], nearbyAlternatives: [], practiceFocus: "" });

test("optimizer chooses a bounded low-movement progression", () => {
  const c = item("c", "C", "major", [-1, 3, 2, 0, 1, 0]);
  const g = item("g", "G", "major", [3, 2, 0, 0, 0, 3]);
  const map = new Map([["C:major", [c]], ["G:major", [g]]]);
  const result = optimizeChordProgression([c, g], map);
  assert.deepEqual(result.entries.map((entry) => entry.id), ["c", "g"]);
});

test("spelling follows the requested key", () => {
  assert.equal(spellChordForKey("A#", "F"), "Bb");
  assert.equal(spellChordForKey("Bb", "B"), "A#");
});

test("A/B MIDI helper uses standard open-string registers and skips muted strings", () => {
  assert.deepEqual(chordStringMidiNotes([-1, 0, 0, 0, 0, 0], ["E", "A", "D", "G", "B", "E"]), [null, 45, 50, 55, 59, 64]);
  assert.deepEqual(chordStringMidiNotes([0, 0, 0, 0, 0, 0], ["E", "A", "D", "G", "B", "E"], 2), [42, 47, 52, 57, 61, 66]);
});

test("A/B MIDI helper follows Drop D and half-step-down tuning", () => {
  assert.deepEqual(chordStringMidiNotes([0, 0, 0, 0, 0, 0], ["D", "A", "D", "G", "B", "E"]), [38, 45, 50, 55, 59, 64]);
  assert.deepEqual(chordStringMidiNotes([0, 0, 0, 0, 0, 0], ["Eb", "Ab", "Db", "Gb", "Bb", "Eb"]), [39, 44, 49, 54, 58, 63]);
});

test("A/B MIDI helper supports custom tuning pitch classes", () => {
  assert.deepEqual(chordStringMidiNotes([0, 0, 0, 0, 0, 0], ["F#", "B", "E", "A", "C#", "F#"]), [42, 47, 52, 57, 61, 66]);
});

test("custom shape validation catches contradictory notes", () => {
  const result = validateCustomChordShape({ name: "bad", frets: [0, 2, 2, 1, 0, 0] }, ["D", "A", "D", "G", "B", "E"], [4, 8, 11]);
  assert.equal(result.valid, false);
  assert(result.errors.length > 0);
});

test("custom shape validation rejects incomplete identity tones and bad input arrays", () => {
  const result = validateCustomChordShape({ name: "muted", frets: [-1, -1, -1, -1, -1, -1], fingers: [null, null, null, null, null, null] }, ["E", "A", "D", "G", "B", "E"], [0, 4, 7]);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => /missing required/i.test(error)));
  const malformed = validateCustomChordShape({ name: "bad", frets: [0, 0], fingers: [5] }, ["E", "A", "D", "G", "B", "E"], [0, 4, 7]);
  assert.equal(malformed.valid, false);
  assert(malformed.errors.some((error) => /exactly 6|finger/i.test(error)));
});

test("chart health reports duplicate shapes", () => {
  const first = item("one", "C", "major", [-1, 3, 2, 0, 1, 0]);
  const second = item("two", "C", "major", [-1, 3, 2, 0, 1, 0]);
  const issues = analyzeChordChartHealth([first, second], new Map());
  assert(issues.some((issue) => issue.kind === "duplicate"));
});

test("setlist transpose preview is non-mutating and reports missing target shapes", () => {
  const charts = [{ id: "song", name: "Song", filters: { key: "C" }, settings: { capo: 2 }, arrangement: { progression: [{ played: "C" }, { played: "G" }] } }];
  const preview = previewSetlistTranspose(charts, "D", { C: 0, D: 2, G: 7 }, (symbol) => symbol === "D");
  assert.equal(preview[0].delta, 2);
  assert.equal(preview[0].originalName, "Song");
  assert.deepEqual(preview[0].missingShapes, ["A"]);
  assert.match(preview[0].setupWarning, /capo/i);
});

test("setlist transpose copies preserve originals and receive fresh IDs", () => {
  const source = { id: "song", name: "Song", filters: { key: "C", root: "all" }, arrangement: { key: "C", progression: [{ played: "C", sounded: "C" }] } };
  const preview = [{ id: "song", originalName: "Song", targetName: "Song · D", delta: 2, targetSymbols: ["D"], missingShapes: [] }];
  const copies = createSetlistTransposeCopies([source], preview, "D", (chart) => `${chart.id}-copy`);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].id, "song-copy");
  assert.equal(copies[0].filters.key, "D");
  assert.equal(copies[0].arrangement.progression[0].played, "D");
  assert.equal(source.id, "song");
  assert.equal(source.filters.key, "C");
  assert.equal(source.arrangement.progression[0].played, "C");
});
