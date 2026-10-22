import assert from "node:assert/strict";
import test from "node:test";
import {
  beatsPerBar,
  deserializeArrangement,
  expandArrangementSequence,
  normalizeArrangement,
  normalizeMeter,
  serializeArrangement,
} from "../../lib/chordChartArrangement.ts";

test("normalizes meters and derives beats per bar", () => {
  assert.equal(normalizeMeter(" 6 / 8 "), "6/8");
  assert.equal(normalizeMeter("9/3"), "9/4", "unsupported denominators use quarter-note fallback");
  assert.equal(normalizeMeter("not a meter"), "4/4");
  assert.equal(beatsPerBar("6/8"), 6, "beat counts stay in the written meter unit");
  assert.equal(beatsPerBar("3/4"), 3);
});

test("normalizes legacy chord arrays and bounds section playback settings", () => {
  const arrangement = normalizeArrangement({
    songId: "  song-1 ",
    songTitle: "  Rehearsal ",
    key: " D ",
    sections: [{
      title: "Verse",
      meter: "6/8",
      bpm: 999,
      repeats: 99,
      chords: ["D", "A"],
      beatDurations: [1.5, 2],
    }],
  });
  assert.equal(arrangement.songId, "song-1");
  assert.equal(arrangement.sections[0].meter, "6/8");
  assert.equal(arrangement.sections[0].bpm, 300);
  assert.equal(arrangement.sections[0].repeats, 8);
  assert.deepEqual(arrangement.sections[0].occurrences.map(({ chord, beats }) => ({ chord, beats })), [
    { chord: "D", beats: 1.5 },
    { chord: "A", beats: 2 },
  ]);
});

test("expands legacy string chord occurrences instead of filtering them out", () => {
  const sequence = expandArrangementSequence({ sections: [{ title: "Verse", chords: ["C", "G"] }] });
  assert.deepEqual(sequence.map(({ chord }) => chord), ["C", "G"]);
});

test("normalization is idempotent for legacy and normalized arrangements", () => {
  const legacy = { songId: " song ", songTitle: " Grace ", key: "C", sections: [{ title: "Verse", chords: ["C", "G"], meter: "4/4", bpm: 80 }] };
  const normalized = normalizeArrangement(legacy);
  assert.deepEqual(normalizeArrangement(normalized), normalized);
  assert.deepEqual(normalizeArrangement(JSON.parse(JSON.stringify(normalized))), normalized);
});

test("expands repeated sections with first and second endings", () => {
  const sequence = expandArrangementSequence({
    sections: [{
      id: "verse",
      title: "Verse",
      meter: "4/4",
      bpm: 120,
      repeats: 2,
      occurrences: [{ chord: "A", beats: 1 }, { chord: "B", beats: 2 }],
      firstEnding: [{ chord: "C", beats: 0.5 }],
      secondEnding: [{ chord: "D", beats: 1.5 }],
    }],
  });
  assert.deepEqual(sequence.map(({ chord, repeat }) => `${chord}:${repeat}`), [
    "A:1", "B:1", "C:1", "A:2", "B:2", "D:2",
  ]);
  assert.equal(sequence[2].repeat, 1, "first ending is appended to the first pass");
  assert.equal(sequence[5].repeat, 2, "second ending is appended to the final pass");
  assert.equal(sequence[0].startBeat, 0);
  assert.equal(sequence[2].startBeat, 3);
  assert.equal(sequence[3].startBeat, 3.5);
  assert.equal(sequence[5].endBeat, 8);
  assert.equal(sequence[0].startMs, 0);
  assert.equal(sequence[0].endMs, 500);
});

test("filters occurrence-level ending markers to the matching pass", () => {
  const sequence = expandArrangementSequence({ sections: [{
    title: "Marked endings",
    meter: "4/4",
    bpm: 120,
    repeats: 2,
    occurrences: [
      { chord: "C", beats: 1 },
      { chord: "F", beats: 1, ending: "first" },
      { chord: "G", beats: 1, ending: "second" },
    ],
  }] });
  assert.deepEqual(sequence.map(({ chord, repeat }) => `${chord}:${repeat}`), [
    "C:1", "F:1", "C:2", "G:2",
  ]);
});

test("converts written eighth-note beats to quarter-note timing", () => {
  const sequence = expandArrangementSequence({ sections: [{
    title: "Compound meter", meter: "6/8", bpm: 120, repeats: 1,
    occurrences: [{ chord: "C", beats: 6 }],
  }] });
  assert.equal(sequence[0].durationQuarterBeats, 3);
  assert.equal(sequence[0].endMs, 1500, "six eighth notes at quarter BPM 120 last 1.5 seconds");
});

test("sets the exact expansion cap and reports only real truncation", () => {
  const section = (title, count) => ({
    title, meter: "4/4", bpm: 120, repeats: 1,
    occurrences: Array.from({ length: count }, (_, index) => ({ chord: `C${index}`, beats: 1 })),
  });
  const belowCap = expandArrangementSequence({ sections: [section("one", 150), section("two", 150)] });
  assert.equal(belowCap.length, 300);
  assert.equal(belowCap.truncated, undefined);
  const exactlyAtCap = expandArrangementSequence({ sections: [section("one", 170), section("two", 170), section("three", 172)] });
  assert.equal(exactlyAtCap.length, 512);
  assert.equal(exactlyAtCap.truncated, undefined, "filling the cap exactly is not truncation");
  const overCap = expandArrangementSequence({ sections: [section("one", 200), section("two", 200), section("three", 200)] });
  assert.equal(overCap.length, 512);
  assert.equal(overCap.truncated, true);
});

test("bounds malformed numeric input and preserves legacy defaults", () => {
  const arrangement = normalizeArrangement({ sections: [{
    title: "Malformed", meter: "99/99", bpm: -Infinity, repeats: -20,
    occurrences: ["C", { chord: "D", beats: Number.POSITIVE_INFINITY }, { chord: "E", beats: Number.NaN }],
  }] });
  const section = arrangement.sections[0];
  assert.equal(section.meter, "16/4");
  assert.equal(section.bpm, 80, "non-finite BPM falls back to the legacy default");
  assert.equal(section.repeats, 1);
  assert.deepEqual(section.occurrences.map(({ chord, beats }) => ({ chord, beats })), [
    { chord: "C", beats: 16 }, { chord: "D", beats: 16 }, { chord: "E", beats: 16 },
  ]);
});

test("keeps a continuous millisecond timeline when BPM changes", () => {
  const sequence = expandArrangementSequence({ sections: [
    { title: "Slow", meter: "4/4", bpm: 60, repeats: 1, occurrences: [{ chord: "C", beats: 4 }] },
    { title: "Fast", meter: "4/4", bpm: 120, repeats: 1, occurrences: [{ chord: "G", beats: 2 }] },
  ] });
  assert.equal(sequence[0].endMs, 4000);
  assert.equal(sequence[1].startMs, 4000);
  assert.equal(sequence[1].endMs, 5000);
  assert.equal(sequence[1].startBeat, 4);
});

test("serializes valid arrangements and safely recovers malformed input", () => {
  const input = { songId: "song", songTitle: "Song", key: "C", sections: [] };
  assert.deepEqual(deserializeArrangement(serializeArrangement(input)), normalizeArrangement(input));
  const recovered = deserializeArrangement("{not-json");
  assert.equal(recovered.songId, "local-chart");
  assert.equal(recovered.songTitle, "Untitled chart");
  assert.deepEqual(recovered.sections, []);
});

