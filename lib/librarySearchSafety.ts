import type { ChordLibraryItem } from "./chords";

export function normalizeLibraryQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesLibrarySearch(entry: ChordLibraryItem, query: string): boolean {
  const normalized = normalizeLibraryQuery(query);
  if (!normalized) return true;
  return [
    entry.chord.name,
    entry.root,
    entry.qualityLabel,
    entry.position,
    entry.summary,
    entry.practiceFocus
  ].join(" ").toLowerCase().includes(normalized);
}

export function searchLibraryEntries(entries: ChordLibraryItem[], query: string): ChordLibraryItem[] {
  const normalized = normalizeLibraryQuery(query);
  return normalized ? entries.filter((entry) => matchesLibrarySearch(entry, normalized)) : entries;
}

export function resolveSelectedLibraryEntry(
  entries: ChordLibraryItem[],
  selectedId: string
): ChordLibraryItem | null {
  return entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
}
