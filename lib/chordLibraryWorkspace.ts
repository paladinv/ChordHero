import { CHORD_DIFFICULTY_TAGS, CHORD_LIBRARY, CHORD_LIBRARY_ROOTS, CHORD_QUALITY_OPTIONS } from "./chords";
import { HARMONY_NOTES, getFunctionOptions } from "./harmony";

export type LibraryFilters = {
  root: string; quality: string; inversion: string; tag: string; functionKey: string;
  mode: string; event: string; role: string; search: string; fret: string; strings: string;
  collection: string; packId: string;
};
export type FilterSnapshot = { filters: LibraryFilters; selectedId: string };
const text = (v: unknown, max = 120) => typeof v === "string" ? v.slice(0, max) : "";
export function validateLibraryFilters(value: unknown, knownPackIds: readonly string[] = []) : LibraryFilters | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const one = (key: string, allowed: readonly string[], fallback: string) => { const s = text(v[key]); return allowed.includes(s) ? s : fallback; };
  const roles = ["any",...new Set([...getFunctionOptions("major"),...getFunctionOptions("minor"),...getFunctionOptions("major","secondary-dominant")])];
  const events = ["all","diatonic","borrowed","secondary-dominant","tonicization","cadence"];
  const qualities = CHORD_QUALITY_OPTIONS.map(q => q.value);
  const inversions = ["all", ...CHORD_LIBRARY.map(entry => entry.id)];
  const allowedValues: Record<string, readonly string[]> = { root:["any",...CHORD_LIBRARY_ROOTS], quality:["any",...qualities], inversion:inversions, tag:["all",...CHORD_DIFFICULTY_TAGS], functionKey:["any",...HARMONY_NOTES], mode:["major","minor"], event:events, role:roles, fret:["all","4","7","8","12"], strings:["all","open","partial","full"], collection:["all","favorites","recent"] };
  for (const [key, allowed] of Object.entries(allowedValues)) if (key in v && (typeof v[key] !== "string" || !allowed.includes(v[key] as string))) return null;
  return {
    root: one("root", ["any", ...CHORD_LIBRARY_ROOTS], "any"), quality: one("quality", ["any", ...qualities], "any"), inversion: one("inversion", inversions, "all"), tag: one("tag", ["all", ...CHORD_DIFFICULTY_TAGS], "all"),
    functionKey: one("functionKey", ["any", ...HARMONY_NOTES], "any"), mode: one("mode", ["major", "minor"], "major"), event: one("event", events, "all"), role: one("role", roles, "any"),
    search: text(v.search, 160), fret: one("fret", ["all", "4", "7", "8", "12"], "all"),
    strings: one("strings", ["all", "open", "partial", "full"], "all"),
    collection: one("collection", ["all", "favorites", "recent"], "all"),
    packId: one("packId", ["all", ...knownPackIds], "all")
  };
}
export function validateFilterSnapshot(value: unknown, knownPackIds: readonly string[] = []): FilterSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>, filters = validateLibraryFilters(v.filters, knownPackIds);
  if (!filters || typeof v.selectedId !== "string" || v.selectedId.length > 160 || (v.selectedId && !CHORD_LIBRARY.some(entry => entry.id === v.selectedId))) return null;
  return { filters, selectedId: v.selectedId };
}
export function validateSavedSearches(value: unknown, knownPackIds: readonly string[] = []) {
  if (!Array.isArray(value)) return [] as Array<{ id: string; name: string; filters: LibraryFilters }>;
  const seen = new Set<string>();
  return value.slice(0, 20).flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const v = raw as Record<string, unknown>, filters = validateLibraryFilters(v.filters, knownPackIds), name = text(v.name, 48).trim();
    const id=text(v.id,80)||name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40);
    if (!filters || !name || seen.has(id)) return [];
    seen.add(id); return [{ id, name, filters }];
  });
}
