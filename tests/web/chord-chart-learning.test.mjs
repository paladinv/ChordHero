import assert from "node:assert/strict";
import test from "node:test";
import { rankLearnNext } from "../../lib/chordChartLearning.ts";

const item = (id, root, quality, difficultyTags, nearbyAlternatives = [], options = {}) => ({ id, root, quality, qualityLabel: quality, inversion: options.inversion ?? "standard", position: options.position ?? "Open shape", chord: { name: root, frets: options.frets ?? [0, 0, 0, 0, 0, 0], barre: options.barre }, difficultyTags, summary: "", recommendedVariant: "", alternateFingerings: [], functionContexts: [], mutingNotes: [], avoidStrings: [], nearbyAlternatives, practiceFocus: "" });

test("learn-next excludes current cards and prioritizes beginner local steps", () => {
  const current = item("c", "C", "major", ["beginner"], [{ targetId: "g", label: "G", description: "nearby" }]);
  const nearbyHard = item("g", "G", "major", ["barre"], [], { barre: { fret: 3, from: 1, to: 6 } });
  const beginnerOther = item("am", "A", "minor", ["beginner"]);
  const advanced = item("f", "F", "major", ["stretch"]);
  const result = rankLearnNext([current, nearbyHard, beginnerOther, advanced], ["c"], 3);
  assert.deepEqual(result.map((entry) => entry.id), ["am", "g", "f"]);
  assert(!result.some((entry) => entry.id === "c"));
});

