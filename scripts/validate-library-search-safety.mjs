import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesLibrarySearch, normalizeLibraryQuery, resolveSelectedLibraryEntry, searchLibraryEntries } from "../lib/librarySearchSafety.ts";

const { chordLibrary } = JSON.parse(readFileSync("shared/content/v1/chords.json", "utf8"));
const example = chordLibrary[0];
assert.ok(example, "shared chord content provides a library-search fixture");

assert.equal(normalizeLibraryQuery("  D/A  "), "d/a");
assert.equal(matchesLibrarySearch(example, "   "), true, "blank search leaves each entry eligible");
assert.ok(searchLibraryEntries(chordLibrary, example.chord.name).some((entry) => entry.id === example.id), "search finds a known chord by display name");
assert.ok(searchLibraryEntries(chordLibrary, `  ${example.root.toLowerCase()}  `).length > 0, "search trims and matches a root");
assert.deepEqual(searchLibraryEntries(chordLibrary, "query-with-no-library-match-9a4c"), [], "unmatched text returns an empty collection");

const matches = searchLibraryEntries(chordLibrary, example.chord.name);
assert.equal(resolveSelectedLibraryEntry(matches, example.id)?.id, example.id, "selection keeps a matching ID");
assert.equal(resolveSelectedLibraryEntry(matches, "stale-id"), matches[0], "stale selection falls back to a visible result");
assert.equal(resolveSelectedLibraryEntry([], "stale-id"), null, "empty filtered collections resolve safely");

console.log("Library search validation passed against production helpers.");
