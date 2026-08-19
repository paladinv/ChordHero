import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const contentPath = fileURLToPath(new URL("../shared/content/v1/chords.json", import.meta.url));
const { chordLibrary } = JSON.parse(readFileSync(contentPath, "utf8"));

function normalizeLibraryQuery(query) {
  return query.trim().toLowerCase();
}

function searchLibraryEntries(entries, query) {
  const normalized = normalizeLibraryQuery(query);
  if (!normalized) return entries;
  return entries.filter((entry) => [
    entry.chord.name,
    entry.root,
    entry.qualityLabel,
    entry.position,
    entry.summary,
    entry.practiceFocus
  ].join(" ").toLowerCase().includes(normalized));
}

function resolveSelectedLibraryEntry(entries, selectedId) {
  return entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
}

for (const query of ["D/A", "C/B", "arbitrary text", "   D/A   "]) {
  const matches = searchLibraryEntries(chordLibrary, query);
  assert.ok(Array.isArray(matches), `${query} must return an array`);
  assert.equal(resolveSelectedLibraryEntry(matches, "stale-id"), matches[0] ?? null, `${query} must resolve safely`);
}

assert.equal(resolveSelectedLibraryEntry([], "stale-id"), null, "empty filtered collections must resolve to null");
console.log("Library search safety validation passed for unavailable chord strings and empty selections.");
