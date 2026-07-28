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
  defaultVariationId?: string;
};

export type SongPracticeProgress = {
  songId: string;
  variationId?: string;
  sectionsCompleted: string[];
  practiceCount: number;
  lastPracticedAt?: string;
  sectionMastery?: Record<string, number>;
  streakDays?: number;
};

export type SongPracticeQueue = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SongQueueHistory = { id: string; queueId: string; songIds: string[]; completedAt: string; lastSongId?: string };
export type SongResumePoint = { queueId: string; songId: string; variationId?: string; updatedAt: string };
export type WeeklyPracticeGoal = { weekStart: string; targetSessions: number; completedSessions: number };
export type SongRecordingMeta = { id: string; songId: string; sectionId?: string; durationMs: number; mimeType: string; createdAt: string; waveform?: number[]; trimStartMs?: number; trimEndMs?: number };
export type SongSourceHealth = { url: string; status: "online" | "offline" | "unknown"; checkedAt: string };
export type SongPracticeSession = { id: string; songId: string; startedAt: string; durationMs: number; masteryDelta: number };

export type SongLibraryState = {
  version: 1;
  collections: SongLibraryCollection[];
  songs: LibrarySong[];
  favorites: string[];
  recentSongIds: string[];
  practiceProgress: SongPracticeProgress[];
  practiceQueues: SongPracticeQueue[];
  preferences: { largePrint: boolean; handsFree: boolean };
  queueHistory: SongQueueHistory[];
  resumePoint?: SongResumePoint;
  weeklyGoal: WeeklyPracticeGoal;
  recordings: SongRecordingMeta[];
  sourceHealth: SongSourceHealth[];
  accountSync?: { providerId: string; encrypted: boolean; lastSyncedAt?: string };
  sharedAccess: SongLibraryShareAccess[];
  resourceAccess: SongResourceShareAccess[];
  practiceSessions: SongPracticeSession[];
};

export type SongLibraryRole = "owner" | "editor" | "viewer";
export type SongLibraryShareAccess = { libraryId: string; accountId: string; role: SongLibraryRole; invitedAt: string };
export type SongResourceShareAccess = { resourceType: "song" | "queue"; resourceId: string; accountId: string; role: Exclude<SongLibraryRole, "owner">; invitedAt: string };

export const SONG_LIBRARY_STORAGE_KEY = "chord-hero-song-library-v1";

export function emptySongLibraryState(): SongLibraryState {
  return { version: 1, collections: [], songs: [], favorites: [], recentSongIds: [], practiceProgress: [], practiceQueues: [], preferences: { largePrint: false, handsFree: false }, queueHistory: [], weeklyGoal: { weekStart: getWeekStart(), targetSessions: 3, completedSessions: 0 }, recordings: [], sourceHealth: [], sharedAccess: [], resourceAccess: [], practiceSessions: [] };
}

export function readSongLibraryState(): SongLibraryState {
  if (typeof window === "undefined") return emptySongLibraryState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SONG_LIBRARY_STORAGE_KEY) ?? "null");
    if (parsed?.version === 1 && Array.isArray(parsed.collections) && Array.isArray(parsed.songs)) {
      return {
        ...emptySongLibraryState(),
        ...parsed,
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        recentSongIds: Array.isArray(parsed.recentSongIds) ? parsed.recentSongIds : [],
        practiceProgress: Array.isArray(parsed.practiceProgress) ? parsed.practiceProgress : [],
        practiceQueues: Array.isArray(parsed.practiceQueues) ? parsed.practiceQueues : [],
        preferences: { ...emptySongLibraryState().preferences, ...(parsed.preferences ?? {}) },
        queueHistory: Array.isArray(parsed.queueHistory) ? parsed.queueHistory : [],
        resumePoint: parsed.resumePoint,
        weeklyGoal: { ...emptySongLibraryState().weeklyGoal, ...(parsed.weeklyGoal ?? {}) },
        recordings: Array.isArray(parsed.recordings) ? parsed.recordings : [],
        sourceHealth: Array.isArray(parsed.sourceHealth) ? parsed.sourceHealth : [],
        accountSync: parsed.accountSync,
        sharedAccess: Array.isArray(parsed.sharedAccess) ? parsed.sharedAccess : [],
        resourceAccess: Array.isArray(parsed.resourceAccess) ? parsed.resourceAccess : [],
        practiceSessions: Array.isArray(parsed.practiceSessions) ? parsed.practiceSessions : [],
      };
    }
  } catch {
    // Treat malformed local data as an empty library; the bundled catalogue remains available.
  }
  return emptySongLibraryState();
}

export function writeSongLibraryState(state: SongLibraryState) {
  if (typeof window !== "undefined") window.localStorage.setItem(SONG_LIBRARY_STORAGE_KEY, JSON.stringify(state));
}

export function getWeekStart(date = new Date()): string {
  const copy = new Date(date); const day = copy.getDay(); const offset = day === 0 ? -6 : 1 - day; copy.setDate(copy.getDate() + offset); copy.setHours(0, 0, 0, 0); return copy.toISOString().slice(0, 10);
}

export function setWeeklyGoal(state: SongLibraryState, targetSessions: number): SongLibraryState {
  const weekStart = getWeekStart(); const current = state.weeklyGoal.weekStart === weekStart ? state.weeklyGoal.completedSessions : 0;
  return { ...state, weeklyGoal: { weekStart, targetSessions: Math.max(1, Math.min(30, Math.round(targetSessions))), completedSessions: current } };
}

export function completeWeeklyGoalSession(state: SongLibraryState): SongLibraryState {
  const weekStart = getWeekStart(); const current = state.weeklyGoal.weekStart === weekStart ? state.weeklyGoal : { ...state.weeklyGoal, weekStart, completedSessions: 0 };
  return { ...state, weeklyGoal: { ...current, completedSessions: Math.min(current.targetSessions, current.completedSessions + 1) } };
}

export function recordPracticeSession(state: SongLibraryState, songId: string, durationMs: number, masteryDelta = 0): SongLibraryState {
  return { ...completeWeeklyGoalSession(state), practiceSessions: [{ id: `session-${crypto.randomUUID()}`, songId, startedAt: new Date().toISOString(), durationMs: Math.max(0, durationMs), masteryDelta }, ...state.practiceSessions].slice(0, 500) };
}

export function weeklyPracticeStats(state: SongLibraryState, weekStart = getWeekStart()): { sessions: number; minutes: number; averageMasteryDelta: number; streak: number } {
  const sessions = state.practiceSessions.filter((session) => session.startedAt.slice(0, 10) >= weekStart); const minutes = Math.round(sessions.reduce((sum, session) => sum + session.durationMs, 0) / 60000); const averageMasteryDelta = sessions.length ? Math.round(sessions.reduce((sum, session) => sum + session.masteryDelta, 0) / sessions.length) : 0; const dates = new Set(sessions.map((session) => session.startedAt.slice(0, 10))); let streak = 0; const cursor = new Date(); while (dates.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setDate(cursor.getDate() - 1); } return { sessions: sessions.length, minutes, averageMasteryDelta, streak };
}

export function saveQueueResumePoint(state: SongLibraryState, point: Omit<SongResumePoint, "updatedAt">): SongLibraryState {
  return { ...state, resumePoint: { ...point, updatedAt: new Date().toISOString() } };
}

export function finishQueue(state: SongLibraryState, queue: SongPracticeQueue, lastSongId?: string): SongLibraryState {
  return { ...completeWeeklyGoalSession({ ...state, resumePoint: undefined }), queueHistory: [{ id: `history-${crypto.randomUUID()}`, queueId: queue.id, songIds: queue.songIds, completedAt: new Date().toISOString(), lastSongId }, ...state.queueHistory].slice(0, 20) };
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

export function transposeChord(chord: string, semitones: number): string {
  const match = chord.match(/^([A-G])([#b]?)(.*)$/);
  if (!match || semitones === 0) return chord;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flats: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
  const root = flats[`${match[1]}${match[2]}`] ?? `${match[1]}${match[2]}`;
  const index = names.indexOf(root);
  if (index < 0) return chord;
  return `${names[(index + semitones + 120) % 12]}${match[3]}`;
}

export function recordSongPractice(state: SongLibraryState, songId: string, variationId?: string): SongLibraryState {
  const now = new Date().toISOString();
  const existing = state.practiceProgress.find((progress) => progress.songId === songId);
  const previousDate = existing?.lastPracticedAt?.slice(0, 10);
  const today = now.slice(0, 10);
  const wasYesterday = previousDate && (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${previousDate}T00:00:00Z`)) === 86400000;
  const progress = existing
    ? { ...existing, variationId, practiceCount: existing.practiceCount + 1, lastPracticedAt: now, streakDays: previousDate === today ? (existing.streakDays ?? 1) : wasYesterday ? (existing.streakDays ?? 1) + 1 : 1 }
    : { songId, variationId, sectionsCompleted: [], practiceCount: 1, lastPracticedAt: now, sectionMastery: {}, streakDays: 1 };
  return {
    ...state,
    practiceProgress: [...state.practiceProgress.filter((item) => item.songId !== songId), progress],
    recentSongIds: [songId, ...state.recentSongIds.filter((id) => id !== songId)].slice(0, 12),
  };
}

export function setSectionMastery(state: SongLibraryState, songId: string, sectionId: string, mastery: number): SongLibraryState {
  const existing = state.practiceProgress.find((progress) => progress.songId === songId);
  const next = existing ?? { songId, sectionsCompleted: [], practiceCount: 0, sectionMastery: {} };
  const sectionMastery = { ...(next.sectionMastery ?? {}), [sectionId]: Math.max(0, Math.min(100, Math.round(mastery))) };
  const sectionsCompleted = Object.entries(sectionMastery).filter(([, value]) => value >= 100).map(([id]) => id);
  return { ...state, practiceProgress: [...state.practiceProgress.filter((item) => item.songId !== songId), { ...next, sectionMastery, sectionsCompleted }] };
}

export function canonicalizeSourceUrl(url: string): string {
  try { const parsed = new URL(url.trim()); parsed.hash = ""; parsed.search = ""; return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase(); } catch { return url.trim().toLowerCase().replace(/\/$/, ""); }
}

export function hasDuplicateSource(state: SongLibraryState, sourceUrl: string): boolean {
  const canonical = canonicalizeSourceUrl(sourceUrl);
  return state.songs.some((song) => song.sourceUrl && canonicalizeSourceUrl(song.sourceUrl) === canonical);
}

export function hasDuplicateSong(state: SongLibraryState, title: string, artist: string): boolean {
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const target = `${normalize(title)}::${normalize(artist)}`;
  return state.songs.some((song) => `${normalize(song.title)}::${normalize(song.artist)}` === target);
}

export async function checkSourceHealth(url: string): Promise<SongSourceHealth> {
  const checkedAt = new Date().toISOString();
  if (typeof navigator !== "undefined" && !navigator.onLine) return { url, status: "offline", checkedAt };
  try { await fetch(url, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(5000) }); return { url, status: "online", checkedAt }; } catch { return { url, status: "offline", checkedAt }; }
}

export function setLibraryPreference(state: SongLibraryState, preference: Partial<SongLibraryState["preferences"]>): SongLibraryState {
  return { ...state, preferences: { ...state.preferences, ...preference } };
}

export function playVariationPreview(variation: Pick<SongVariation, "pattern" | "bpm">, audioContext: AudioContext): void {
  const beatMs = 60000 / variation.bpm;
  const steps = variation.pattern.split(/\s+/).filter(Boolean).slice(0, 16);
  steps.forEach((step, index) => {
    const start = audioContext.currentTime + (index * beatMs) / 1000;
    const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
    oscillator.frequency.value = step.toUpperCase().startsWith("D") ? 180 : 420; gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + 0.09);
  });
}

export function toggleFavorite(state: SongLibraryState, songId: string): SongLibraryState {
  const favorites = state.favorites.includes(songId) ? state.favorites.filter((id) => id !== songId) : [...state.favorites, songId];
  return { ...state, favorites };
}

export function createManualSong(input: { title: string; artist: string; key: string; timeSignature: string; bpm: number; chords: string[]; lyrics?: string }): LibrarySong {
  const id = `manual-${crypto.randomUUID()}`;
  return {
    id, title: input.title.trim() || "Untitled song", artist: input.artist.trim() || "My song", source: "Created on this device", license: "User-created", difficulty: "custom", bpm: input.bpm, key: input.key, timeSignature: input.timeSignature, tags: ["custom", "manual"], origin: "manual",
    sections: [{ id: `${id}-main`, title: "Main section", blocks: [{ type: "chords", chords: input.chords }, ...(input.lyrics?.trim() ? [{ type: "lyrics" as const, text: input.lyrics.trim() }] : [])] }],
    variations: [{ id: `${id}-variation`, name: "My arrangement", technique: "strumming", key: input.key, timeSignature: input.timeSignature, bpm: input.bpm, tuningId: "standard", capo: 0, pattern: "D - D U - U D U", feel: "Adjust this arrangement to your practice goal." }],
  };
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
