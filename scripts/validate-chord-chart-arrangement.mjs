import assert from "node:assert/strict";
import { expandArrangementSequence, normalizeArrangement, serializeArrangement, deserializeArrangement } from "../lib/chordChartArrangement.ts";

const arrangement = normalizeArrangement({
  songId: "demo", songTitle: "Demo", key: "C", bpm: 120,
  sections: [{ title: "Verse", meter: "6/8", bpm: 90, repeats: 2,
    occurrences: [
      { id: "verse-a", chord: "C", beats: 3 },
      { id: "verse-b", chord: "G", beats: 3, ending: "first" },
      { id: "verse-c", chord: "Am", beats: 6, ending: "second" },
    ] }],
});
const sequence = expandArrangementSequence(arrangement);
assert.deepEqual(sequence.map((event) => event.chord), ["C", "G", "C", "Am"]);
assert.equal(sequence[0].durationQuarterBeats, 1.5);
assert.equal(sequence[0].endMs, 1000);
assert.equal(sequence[1].startMs, 1000);
assert.equal(sequence[0].sectionId, "section-1");
assert.equal(deserializeArrangement(serializeArrangement(arrangement)).sections[0].meter, "6/8");
assert.deepEqual(expandArrangementSequence({ sections: [{ title: "Legacy", chords: ["C", "G"] }] }).map((event) => event.chord), ["C", "G"]);

const bounded = expandArrangementSequence({ sections: [{ title: "Loop", repeats: 8, occurrences: Array.from({ length: 100 }, (_, i) => ({ chord: `C${i}`, beats: 1 })) }] });
assert.equal(bounded.length, 512);
assert.equal(bounded.truncated, true);
console.log("chord chart arrangement validation passed");
