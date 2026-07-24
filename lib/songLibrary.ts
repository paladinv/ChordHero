export type SongTechnique = "strumming" | "fingerpicking" | "plectrum";

export type SongBlock = {
  type: "lyrics" | "chords" | "tab" | "annotation";
  text?: string;
  chords?: string[];
  lines?: string[];
};

export type SongSection = { id: string; title: string; blocks: SongBlock[] };

export type SongVariation = {
  id: string;
  name: string;
  technique: SongTechnique;
  key: string;
  timeSignature: string;
  bpm: number;
  tuningId: string;
  capo: number;
  pattern: string;
  feel: string;
};

export type LibrarySong = {
  id: string;
  title: string;
  artist: string;
  source: string;
  license: string;
  difficulty: string;
  bpm: number;
  key: string;
  timeSignature: string;
  tags: string[];
  sections: SongSection[];
  variations: SongVariation[];
  origin?: "bundled" | "imported" | "manual";
  sourceUrl?: string;
  notes?: string;
  importedAt?: string;
};

export type SongLibraryCollection = {
  id: string;
  name: string;
  description: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SongLibraryState = {
  version: 1;
  collections: SongLibraryCollection[];
  songs: LibrarySong[];
};

export const SONG_LIBRARY_STORAGE_KEY = "chord-hero-song-library-v1";

export function emptySongLibraryState(): SongLibraryState {
  return { version: 1, collections: [], songs: [] };
}

export function readSongLibraryState(): SongLibraryState {
  if (typeof window === "undefined") return emptySongLibraryState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SONG_LIBRARY_STORAGE_KEY) ?? "null");
    if (parsed?.version === 1 && Array.isArray(parsed.collections) && Array.isArray(parsed.songs)) return parsed;
  } catch {
    // Treat malformed local data as an empty library; the bundled catalogue remains available.
  }
  return emptySongLibraryState();
}

export function writeSongLibraryState(state: SongLibraryState) {
  if (typeof window !== "undefined") window.localStorage.setItem(SONG_LIBRARY_STORAGE_KEY, JSON.stringify(state));
}

export function songChords(song: Pick<LibrarySong, "sections">): string[] {
  return song.sections.flatMap((section) => section.blocks.flatMap((block) => block.type === "chords" ? block.chords ?? [] : []));
}

export function songText(song: LibrarySong): string {
  return song.sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => [block.text ?? "", ...(block.lines ?? []), ...(block.chords ?? [])])]).join(" ");
}

export function matchesSongFilters(
  song: LibrarySong,
  filters: { query: string; difficulty: string; key: string; meter: string; technique: string; libraryId: string },
  collections: SongLibraryCollection[],
) {
  const query = filters.query.trim().toLocaleLowerCase();
  const haystack = [song.title, song.artist, song.source, song.license, song.key, song.timeSignature, ...song.tags, songText(song)].join(" ").toLocaleLowerCase();
  if (query && !haystack.includes(query)) return false;
  if (filters.difficulty !== "All" && song.difficulty !== filters.difficulty) return false;
  if (filters.key !== "All" && song.key !== filters.key && !song.variations.some((variation) => variation.key === filters.key)) return false;
  if (filters.meter !== "All" && song.timeSignature !== filters.meter && !song.variations.some((variation) => variation.timeSignature === filters.meter)) return false;
  if (filters.technique !== "All" && !song.variations.some((variation) => variation.technique === filters.technique)) return false;
  if (filters.libraryId !== "All" && !collections.find((collection) => collection.id === filters.libraryId)?.songIds.includes(song.id)) return false;
  return true;
}

export function normalizeImportedSong(input: { title: string; artist: string; sourceUrl: string; notes?: string }): LibrarySong {
  const now = new Date().toISOString();
  const id = `imported-${crypto.randomUUID()}`;
  return {
    id,
    title: input.title.trim() || "Imported song",
    artist: input.artist.trim() || "Unknown artist",
    source: "Ultimate Guitar source link",
    license: "External source; content remains at the original provider",
    difficulty: "custom",
    bpm: 90,
    key: "C",
    timeSignature: "4/4",
    tags: ["imported", "source-link"],
    sections: [{ id: `${id}-notes`, title: "Practice notes", blocks: input.notes?.trim() ? [{ type: "annotation", text: input.notes.trim() }] : [] }],
    variations: [{ id: `${id}-variation`, name: "Source-link practice", technique: "strumming", key: "C", timeSignature: "4/4", bpm: 90, tuningId: "standard", capo: 0, pattern: "Choose a pattern in Song Coach", feel: "Open the original source for the protected tab or lyrics." }],
    origin: "imported",
    sourceUrl: input.sourceUrl.trim(),
    notes: input.notes?.trim(),
    importedAt: now,
  };
}
