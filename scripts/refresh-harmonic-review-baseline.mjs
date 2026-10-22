import fs from "node:fs";
import path from "node:path";
import { validateChordQualityDefinitions, validateHarmonicNotes } from "./validate-harmonic-notes.mjs";

if (!process.argv.includes("--confirm-review-required")) {
  console.error("Refusing to refresh review baseline without --confirm-review-required. Review every new/worsened gap first.");
  process.exit(2);
}

const root = process.cwd();
const contentDirectory = path.join(root, "shared/content/v1");
const chords = JSON.parse(fs.readFileSync(path.join(contentDirectory, "chords.json"), "utf8"));
const qualityDefinitions = JSON.parse(fs.readFileSync(path.join(contentDirectory, "chord-qualities.json"), "utf8"));
validateChordQualityDefinitions(qualityDefinitions);
const report = validateHarmonicNotes(chords.chordLibrary, qualityDefinitions, () => {});
if (report.malformed.length || report.bassWarnings) {
  throw new Error(`Cannot refresh baseline while malformed charts (${report.malformed.length}) or slash-bass errors (${report.bassWarnings}) exist.`);
}
const baseline = {
  schemaVersion: 1,
  policy: "review-required-unresolved",
  updatePolicy: "Regenerate only after reviewing each changed chart; entries are unresolved gaps, never intentional omissions or expert approvals.",
  entries: report.partialNotes.map((item) => ({
    id: item.id,
    missingIntervals: [...item.missing].sort((a, b) => a - b),
    reviewRequired: true,
    status: "unresolved"
  })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
};
const output = path.join(contentDirectory, "harmonic-review-baseline.json");
fs.writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Wrote ${baseline.entries.length} explicitly review-required unresolved records to ${path.relative(root, output)}.`);
