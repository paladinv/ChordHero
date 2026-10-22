import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, ".test-artifacts/trainer-adaptive");
mkdirSync(path.dirname(output), { recursive: true });
rmSync(output, { recursive: true, force: true });
try {
  const require = createRequire(import.meta.url);
  const compile = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--outDir", output, "--rootDir", ".", "--noEmit", "false", "--module", "commonjs", "--target", "es2022", "lib/trainerAdaptive.ts"], { cwd: root, encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stdout + compile.stderr);
  const { adaptTrainerPace } = require(path.join(output, "lib/trainerAdaptive.js"));
  assert.deepEqual(adaptTrainerPace(4, 0, "missed", "comfort", 3), { pace: 5, recovery: 0 });
  assert.deepEqual(adaptTrainerPace(4, 0, "missed", "challenge", 3), { pace: 4.5, recovery: 0 });
  assert.deepEqual(adaptTrainerPace(4, 2, "clean", "comfort", 3), { pace: 3.5, recovery: 0 });
  assert.deepEqual(adaptTrainerPace(4, 1, "clean", "challenge", 3), { pace: 3.5, recovery: 0 });
  assert.deepEqual(adaptTrainerPace(8, 0, "needsWork", "comfort", 3), { pace: 8, recovery: 0 });
  assert.equal(readFileSync(path.join(root, "lib/trainerAdaptive.ts"), "utf8").includes("export function adaptTrainerPace"), true);
  console.log("Trainer adaptive preference rules passed.");
} finally {
  rmSync(output, { recursive: true, force: true });
}
