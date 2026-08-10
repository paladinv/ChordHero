import assert from "node:assert/strict";
import {
  analyzeChordFunction,
  analyzeProgression,
  getFunctionOptions,
  getNextRoles
} from "../lib/harmony.ts";

const available = (args, role) => analyzeChordFunction({ ...args, requestedRole: role }).find((fn) => fn.available);

const minorF = analyzeChordFunction({ key: "A", mode: "minor", root: "F", quality: "major" });
assert.equal(minorF.some((fn) => fn.role === "VI" && fn.available), true, "F must be VI in A minor");
assert.equal(minorF.some((fn) => fn.role === "V" && fn.available), false, "F must not be V in A minor");

const minorG = analyzeChordFunction({ key: "A", mode: "minor", root: "G", quality: "major" });
assert.equal(minorG.some((fn) => fn.role === "VII" && fn.available), true, "G must be VII in A minor");
assert.equal(minorG.some((fn) => fn.role === "VI" && fn.available), false, "G must not be VI in A minor");
assert.equal(available({ key: "A", mode: "minor", root: "F", quality: "major" }, "bVI")?.available, true, "bVI must be available in minor mode");
assert.equal(available({ key: "A", mode: "minor", root: "G", quality: "major" }, "bVII")?.available, true, "bVII must be available in minor mode");

assert.equal(available({ key: "G", mode: "major", root: "D", quality: "dominant7" }, "V")?.available, true, "D7 must be a valid V in G");
assert.equal(available({ key: "G", mode: "major", root: "F#", quality: "diminished" }, "vii°")?.available, true, "F# diminished must be vii° in G");

const secondary = analyzeChordFunction({ key: "G", mode: "major", root: "A", quality: "dominant7" });
assert.equal(secondary[0]?.role, "V/V", "A7 must prioritize V/V in G");
assert.equal(secondary[0]?.available, true, "A7 V/V must be available in G");
assert.equal(analyzeChordFunction({ key: "G", mode: "major", root: "A", quality: "minor" })[0]?.role, "ii", "Am must remain diatonic ii in G");

const cadenceOptions = getFunctionOptions("major", "cadence");
assert.equal(cadenceOptions.includes("ii–V–I"), true, "ii-V-I cadence label must be exposed");
assert.equal(cadenceOptions.includes("deceptive cadence"), true, "deceptive cadence label must be exposed");
assert.deepEqual(getNextRoles("deceptive cadence"), ["vi"], "deceptive cadence must resolve to vi");
assert.equal(analyzeProgression("Am D7 G", "G", "major").summary, "ii - V - I", "ii-V-I progression must analyze correctly");

console.log("Harmony theory validation passed: minor degrees, V, vii°, V/V, ii-V-I, and deceptive cadence labels.");
