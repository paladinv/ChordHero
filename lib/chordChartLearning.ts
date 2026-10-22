import type { ChordLibraryItem } from "./chords";

const identity = (entry: Pick<ChordLibraryItem, "root" | "quality">) => `${entry.root}:${entry.quality}`;

/**
 * Return a short, local next-step path. Beginner-friendly voicings are always
 * ordered ahead of harder alternatives; nearby alternatives and matching
 * chord identities break ties without network or generated content.
 */
export function rankLearnNext(entries: readonly ChordLibraryItem[], currentIds: readonly string[], limit = 6) {
  const current = entries.filter((entry) => currentIds.includes(entry.id));
  const currentSet = new Set(currentIds);
  const nearbyIds = new Set(current.flatMap((entry) => entry.nearbyAlternatives.flatMap((alternative) => alternative.targetId ? [alternative.targetId] : [])));
  const identities = new Set(current.map(identity));
  return entries.filter((entry) => !currentSet.has(entry.id)).sort((a, b) => {
    const beginnerA = a.difficultyTags.includes("beginner") ? 0 : 1;
    const beginnerB = b.difficultyTags.includes("beginner") ? 0 : 1;
    const relationA = nearbyIds.has(a.id) ? 0 : identities.has(identity(a)) ? 1 : 2;
    const relationB = nearbyIds.has(b.id) ? 0 : identities.has(identity(b)) ? 1 : 2;
    const burdenA = (a.chord.barre ? 4 : 0) + (a.difficultyTags.includes("stretch") ? 3 : 0) + (a.inversion === "inverted" ? 2 : 0);
    const burdenB = (b.chord.barre ? 4 : 0) + (b.difficultyTags.includes("stretch") ? 3 : 0) + (b.inversion === "inverted" ? 2 : 0);
    return beginnerA - beginnerB || relationA - relationB || burdenA - burdenB || a.id.localeCompare(b.id);
  }).slice(0, Math.max(0, Math.min(12, limit)));
}

