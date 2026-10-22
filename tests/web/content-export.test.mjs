import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readComponentLiteral } from "../../scripts/read-component-literal.mjs";

const root = process.cwd();
const settings = JSON.parse(readFileSync("shared/content/v1/settings.json", "utf8"));
assert.deepEqual(readComponentLiteral(root, "components/ChordLibraryExplorer.tsx", "TUNINGS"), settings.tunings, "exported tuning settings follow the component's TUNINGS literal");
assert.deepEqual(readComponentLiteral(root, "components/ChordLibraryExplorer.tsx", "SAMPLE_VOICES"), settings.sampleVoices, "exported sample voices follow the component's SAMPLE_VOICES literal");
assert.deepEqual(readComponentLiteral(root, "components/ChordLibraryExplorer.tsx", "RIGHT_HAND_PATTERNS"), settings.rightHandPatterns, "exported patterns follow the component's RIGHT_HAND_PATTERNS literal");

execFileSync(process.execPath, ["scripts/export-shared-content.mjs", "--check"], { cwd: root, stdio: "inherit" });
console.log("Shared content exporter regression checks passed without writing generated files.");
