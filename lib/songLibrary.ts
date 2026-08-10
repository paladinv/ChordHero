export type SongTechnique = "strumming" | "fingerpicking" | "plectrum";

export type SongBlock = {
  type: "lyrics" | "chords" | "tab" | "annotation";
  text?: string;
  chords?: string[];
  lines?: string[];
};

export type SongSection = { id: string; title: string; blocks: SongBlock[] };

export type SongInstrument = "guitar" | "ukulele" | "bass";

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
  instrument?: SongInstrument;
  tuningLabel?: string;
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
  archivedAt?: string;
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
  targetDurationMinutes?: number;
  isSetlist?: boolean;
};

export type SongAnnotation = {
  id: string;
  songId: string;
  sectionId: string;
  marker?: { chord?: string; measure?: number };
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type SongSetlistEntry = {
  songId: string;
  variationId?: string;
  capo?: number;
  tuningId?: string;
  changeNotes?: string;
  breakAfterSeconds?: number;
};

export type SongSetlist = {
  id: string;
  name: string;
  targetDurationMinutes: number;
  entries: SongSetlistEntry[];
  createdAt: string;
  updatedAt: string;
  transitionBreakSeconds?: number;
  archivedAt?: string;
};

export type SongCollaboratorComment = {
  id: string;
  songId: string;
  sectionId?: string;
  body: string;
  authorId: string;
  role: SongLibraryRole;
  createdAt: string;
};

export type SongQueueHistory = { id: string; queueId: string; songIds: string[]; completedAt: string; lastSongId?: string };
export type SongResumePoint = { queueId: string; songId: string; variationId?: string; updatedAt: string };
export type WeeklyPracticeGoal = { weekStart: string; targetSessions: number; completedSessions: number };
export type SongRecordingMeta = { id: string; songId: string; sectionId?: string; durationMs: number; mimeType: string; createdAt: string; waveform?: number[]; trimStartMs?: number; trimEndMs?: number; tempoDriftPercent?: number; timingConsistencyPercent?: number; analysisNote?: string; archivedAt?: string };
export type SongSourceHealth = { url: string; status: "online" | "offline" | "unknown"; checkedAt: string; providerReliability?: number; freshnessScore?: number };
export type SongPracticeSession = { id: string; songId: string; startedAt: string; durationMs: number; masteryDelta: number };

export type SongVideoReference = {
  id: string;
  songId: string;
  sectionId?: string;
  title: string;
  url?: string;
  source: "source-link" | "local-reference";
  localFileName?: string;
  localMimeType?: string;
  localSizeBytes?: number;
  createdAt: string;
};

export type SongPracticePathStage = { id: string; title: string; description: string; eligibleSongIds: string[]; completedSongIds: string[] };
export type SongPracticePath = { id: string; templateId: string; name: string; description: string; stages: SongPracticePathStage[]; createdAt: string; updatedAt: string };
export type SongScheduledItem = { id: string; kind: "song" | "queue"; resourceId: string; dueAt: string; note?: string; notificationOptIn: boolean; createdAt: string };
export type SongPendingSyncOperation = { id: string; kind: "local-change" | "import" | "practice" | "archive" | "schedule"; description: string; createdAt: string };
export type SongAdaptiveOverride = { variationId: string; tempo: number; sectionId?: string; simplifyMode: boolean; updatedAt: string };
export type SongBenchmarkSummary = { sessions: number; songsPracticed: number; averageMastery: number; practiceMinutes: number; generatedAt: string };

export type SongLibraryState = {
  version: 3;
  collections: SongLibraryCollection[];
  songs: LibrarySong[];
  archivedSongIds: string[];
  favorites: string[];
  recentSongIds: string[];
  practiceProgress: SongPracticeProgress[];
  practiceQueues: SongPracticeQueue[];
  preferences: { largePrint: boolean; handsFree: boolean; simplifyMode: boolean; benchmarkOptIn: boolean; localRole: SongLibraryRole };
  queueHistory: SongQueueHistory[];
  resumePoint?: SongResumePoint;
  weeklyGoal: WeeklyPracticeGoal;
  recordings: SongRecordingMeta[];
  sourceHealth: SongSourceHealth[];
  accountSync?: { providerId: string; encrypted: boolean; lastSyncedAt?: string };
  sharedAccess: SongLibraryShareAccess[];
  resourceAccess: SongResourceShareAccess[];
  practiceSessions: SongPracticeSession[];
  annotations: SongAnnotation[];
  setlists: SongSetlist[];
  comments: SongCollaboratorComment[];
  appliedTranspositions: Record<string, number>;
  adaptiveOverrides: Record<string, SongAdaptiveOverride>;
  videoReferences: SongVideoReference[];
  practicePaths: SongPracticePath[];
  scheduledItems: SongScheduledItem[];
  pendingSyncOps: SongPendingSyncOperation[];
};

export type SongLibraryRole = "owner" | "editor" | "viewer" | "commenter" | "arranger" | "setlist-manager";
export type SongLibraryShareAccess = { libraryId: string; accountId: string; role: SongLibraryRole; invitedAt: string };
export type SongResourceShareAccess = { resourceType: "song" | "queue"; resourceId: string; accountId: string; role: Exclude<SongLibraryRole, "owner">; invitedAt: string };

export const SONG_LIBRARY_STORAGE_KEY = "chord-hero-song-library-v1";

export function emptySongLibraryState(): SongLibraryState {
  return { version: 3, collections: [], songs: [], archivedSongIds: [], favorites: [], recentSongIds: [], practiceProgress: [], practiceQueues: [], preferences: { largePrint: false, handsFree: false, simplifyMode: false, benchmarkOptIn: false, localRole: "owner" }, queueHistory: [], weeklyGoal: { weekStart: getWeekStart(), targetSessions: 3, completedSessions: 0 }, recordings: [], sourceHealth: [], sharedAccess: [], resourceAccess: [], practiceSessions: [], annotations: [], setlists: [], comments: [], appliedTranspositions: {}, adaptiveOverrides: {}, videoReferences: [], practicePaths: [], scheduledItems: [], pendingSyncOps: [] };
}

const STATE_LIMITS = { collections: 100, songs: 500, favorites: 500, practiceProgress: 500, practiceQueues: 100, queueHistory: 50, recordings: 500, sourceHealth: 200, sharedAccess: 500, resourceAccess: 500, practiceSessions: 500, annotations: 500, setlists: 100, comments: 500, videoReferences: 500, practicePaths: 50, scheduledItems: 200, pendingSyncOps: 200 } as const;
const bounded = <T>(value: unknown, limit: number): T[] => Array.isArray(value) ? value.slice(0, limit) as T[] : [];
const boundedRecord = <T>(value: unknown, limit: number): Record<string, T> => value && typeof value === "object" ? Object.fromEntries(Object.entries(value).slice(0, limit)) as Record<string, T> : {};

/** Additive v1/v2/v3 reader used by local storage, plain backups, and encrypted backups. */
export function migrateSongLibraryState(input: unknown): SongLibraryState {
  const parsed = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const defaults = emptySongLibraryState();
  if (![1, 2, 3].includes(Number(parsed.version)) || !Array.isArray(parsed.collections) || !Array.isArray(parsed.songs)) return defaults;
  const preferences = { ...defaults.preferences, ...(parsed.preferences && typeof parsed.preferences === "object" ? parsed.preferences : {}) } as SongLibraryState["preferences"];
  return {
    ...defaults,
    ...parsed,
    version: 3,
    collections: bounded<SongLibraryCollection>(parsed.collections, STATE_LIMITS.collections).map((collection) => ({ ...collection, songIds: bounded<string>(collection.songIds, STATE_LIMITS.songs) })),
    songs: bounded<LibrarySong>(parsed.songs, STATE_LIMITS.songs),
    archivedSongIds: bounded<string>(parsed.archivedSongIds, STATE_LIMITS.songs),
    favorites: bounded<string>(parsed.favorites, STATE_LIMITS.favorites),
    recentSongIds: bounded<string>(parsed.recentSongIds, 12),
    practiceProgress: bounded<SongPracticeProgress>(parsed.practiceProgress, STATE_LIMITS.practiceProgress),
    practiceQueues: bounded<SongPracticeQueue>(parsed.practiceQueues, STATE_LIMITS.practiceQueues).map((queue) => ({ ...queue, songIds: bounded<string>(queue.songIds, STATE_LIMITS.songs) })),
    preferences,
    queueHistory: bounded<SongQueueHistory>(parsed.queueHistory, STATE_LIMITS.queueHistory),
    resumePoint: parsed.resumePoint as SongResumePoint | undefined,
    weeklyGoal: { ...defaults.weeklyGoal, ...(parsed.weeklyGoal && typeof parsed.weeklyGoal === "object" ? parsed.weeklyGoal : {}) },
    recordings: bounded<SongRecordingMeta>(parsed.recordings, STATE_LIMITS.recordings),
    sourceHealth: bounded<SongSourceHealth>(parsed.sourceHealth, STATE_LIMITS.sourceHealth),
    accountSync: parsed.accountSync as SongLibraryState["accountSync"],
    sharedAccess: bounded<SongLibraryShareAccess>(parsed.sharedAccess, STATE_LIMITS.sharedAccess),
    resourceAccess: bounded<SongResourceShareAccess>(parsed.resourceAccess, STATE_LIMITS.resourceAccess),
    practiceSessions: bounded<SongPracticeSession>(parsed.practiceSessions, STATE_LIMITS.practiceSessions),
    annotations: bounded<SongAnnotation>(parsed.annotations, STATE_LIMITS.annotations),
    setlists: bounded<SongSetlist>(parsed.setlists, STATE_LIMITS.setlists).map((setlist) => ({ ...setlist, entries: bounded<SongSetlist["entries"][number]>(setlist.entries, STATE_LIMITS.songs) })),
    comments: bounded<SongCollaboratorComment>(parsed.comments, STATE_LIMITS.comments),
    appliedTranspositions: boundedRecord<number>(parsed.appliedTranspositions, STATE_LIMITS.songs),
    adaptiveOverrides: boundedRecord<SongAdaptiveOverride>(parsed.adaptiveOverrides, STATE_LIMITS.songs),
    videoReferences: bounded<SongVideoReference>(parsed.videoReferences, STATE_LIMITS.videoReferences),
    practicePaths: bounded<SongPracticePath>(parsed.practicePaths, STATE_LIMITS.practicePaths),
    scheduledItems: bounded<SongScheduledItem>(parsed.scheduledItems, STATE_LIMITS.scheduledItems),
    pendingSyncOps: bounded<SongPendingSyncOperation>(parsed.pendingSyncOps, STATE_LIMITS.pendingSyncOps),
  };
}

export function readSongLibraryState(): SongLibraryState {
  if (typeof window === "undefined") return emptySongLibraryState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SONG_LIBRARY_STORAGE_KEY) ?? "null");
    return migrateSongLibraryState(parsed);
  } catch {
    // Treat malformed local data as an empty library; the bundled catalogue remains available.
  }
  return emptySongLibraryState();
}

export function writeSongLibraryState(state: SongLibraryState) {
  if (typeof window !== "undefined") window.localStorage.setItem(SONG_LIBRARY_STORAGE_KEY, JSON.stringify(migrateSongLibraryState(state)));
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

export function weeklyRecap(state: SongLibraryState, songs: LibrarySong[], weekStart = getWeekStart()) {
  const sessions = state.practiceSessions.filter((session) => session.startedAt.slice(0, 10) >= weekStart);
  const completedSongs = [...new Set(sessions.filter((session) => session.masteryDelta >= 0).map((session) => session.songId))].map((id) => songs.find((song) => song.id === id)).filter((song): song is LibrarySong => Boolean(song));
  const improvingSections = state.practiceProgress.flatMap((progress) => Object.entries(progress.sectionMastery ?? {}).filter(([, value]) => value > 0 && value < 100).map(([sectionId, mastery]) => ({ songId: progress.songId, sectionId, mastery }))).sort((a, b) => b.mastery - a.mastery).slice(0, 5);
  return { ...weeklyPracticeStats(state, weekStart), completedSongs, improvingSections };
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
  filters: { query: string; difficulty: string; key: string; meter: string; technique: string; libraryId: string; instrument?: string },
  collections: SongLibraryCollection[],
) {
  const query = filters.query.trim().toLocaleLowerCase();
  const haystack = [song.title, song.artist, song.source, song.license, song.key, song.timeSignature, ...song.tags, songText(song)].join(" ").toLocaleLowerCase();
  if (query && !haystack.includes(query)) return false;
  if (filters.difficulty !== "All" && song.difficulty !== filters.difficulty) return false;
  if (filters.key !== "All" && song.key !== filters.key && !song.variations.some((variation) => variation.key === filters.key)) return false;
  if (filters.meter !== "All" && song.timeSignature !== filters.meter && !song.variations.some((variation) => variation.timeSignature === filters.meter)) return false;
  if (filters.technique !== "All" && !song.variations.some((variation) => variation.technique === filters.technique)) return false;
  if (filters.instrument && filters.instrument !== "All" && !song.variations.some((variation) => (variation.instrument ?? "guitar") === filters.instrument)) return false;
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

export function addSongAnnotation(state: SongLibraryState, input: Omit<SongAnnotation, "id" | "createdAt" | "updatedAt">): SongLibraryState {
  const now = new Date().toISOString();
  return { ...state, annotations: [{ ...input, id: `annotation-${crypto.randomUUID()}`, createdAt: now, updatedAt: now }, ...state.annotations].slice(0, 500) };
}

export function addCollaboratorComment(state: SongLibraryState, input: Omit<SongCollaboratorComment, "id" | "createdAt">): SongLibraryState {
  return { ...state, comments: [{ ...input, id: `comment-${crypto.randomUUID()}`, createdAt: new Date().toISOString() }, ...state.comments].slice(0, 500) };
}

export function sourceFreshnessScore(health?: SongSourceHealth, now = Date.now()): number {
  if (!health) return 0;
  const ageDays = Math.max(0, (now - Date.parse(health.checkedAt)) / 86400000);
  const ageScore = Math.max(0, 40 - Math.round(ageDays * 2));
  const linkScore = health.status === "online" ? 40 : health.status === "unknown" ? 15 : 0;
  return Math.max(0, Math.min(100, linkScore + ageScore + Math.round((health.providerReliability ?? 0.5) * 20)));
}

export type SongAdaptiveRecommendation = {
  tempo: number;
  variationId: string;
  sectionId?: string;
  simplifyMode: boolean;
  reason: string;
};

/** Pure, conservative practice guidance. It only returns an override; source variations stay intact. */
export function recommendAdaptiveDifficulty(song: LibrarySong, variation: SongVariation, progress?: SongPracticeProgress, recordings: SongRecordingMeta[] = []): SongAdaptiveRecommendation {
  const mastery = Object.values(progress?.sectionMastery ?? {});
  const averageMastery = mastery.length ? mastery.reduce((sum, value) => sum + value, 0) / mastery.length : 0;
  const weakest = mastery.length ? Math.min(...mastery) : 0;
  const recentFeedback = recordings.filter((record) => record.songId === song.id).slice(0, 3);
  const timing = recentFeedback.length ? recentFeedback.reduce((sum, record) => sum + (record.timingConsistencyPercent ?? 70), 0) / recentFeedback.length : 70;
  const practiceCount = progress?.practiceCount ?? 0;
  const simplifyMode = averageMastery < 55 || timing < 58 || practiceCount < 2;
  const tempoFactor = simplifyMode ? (timing < 58 ? 0.65 : 0.75) : averageMastery >= 85 && timing >= 78 ? 1 : 0.9;
  const tempo = Math.max(40, Math.min(240, Math.round(variation.bpm * tempoFactor)));
  const sectionId = song.sections.find((section) => (progress?.sectionMastery?.[section.id] ?? 0) === weakest)?.id;
  const reason = sectionId ? `Loop ${song.sections.find((section) => section.id === sectionId)?.title ?? "the weakest section"} at ${tempo} BPM; recent timing is ${Math.round(timing)}%.` : `Start at ${tempo} BPM while your timing stabilizes, then revisit the original ${variation.bpm} BPM variation.`;
  return { tempo, variationId: variation.id, sectionId, simplifyMode, reason };
}

export function applyAdaptiveRecommendation(state: SongLibraryState, songId: string, recommendation: SongAdaptiveRecommendation): SongLibraryState {
  return { ...state, adaptiveOverrides: { ...state.adaptiveOverrides, [songId]: { ...recommendation, updatedAt: new Date().toISOString() } } };
}

export const PRACTICE_PATH_TEMPLATES = [
  { id: "first-gig", name: "First gig", description: "Build a short, reliable set with repeatable transitions." },
  { id: "fingerpicking-foundations", name: "Fingerpicking foundations", description: "Move from steady patterns into clean section changes." },
  { id: "genre-folk", name: "Genre · folk", description: "Explore folk-tagged and traditional songs with a consistent groove." },
] as const;

export function createPracticePath(templateId: string, songs: LibrarySong[]): SongPracticePath {
  const template = PRACTICE_PATH_TEMPLATES.find((item) => item.id === templateId) ?? PRACTICE_PATH_TEMPLATES[0];
  const eligible = songs.filter((song) => templateId === "fingerpicking-foundations" ? song.variations.some((variation) => variation.technique === "fingerpicking") : templateId === "genre-folk" ? song.tags.some((tag) => /folk|traditional/i.test(tag)) : true).slice(0, 24).map((song) => song.id);
  const stages = [0, 1, 2].map((index) => ({ id: `${template.id}-stage-${index + 1}`, title: ["Start steady", "Build confidence", "Ready to share"][index], description: ["Choose two songs and learn the easiest variation.", "Practice the weakest sections and record one pass.", "Complete a short queue without stopping."][index], eligibleSongIds: eligible.slice(index * 8, (index + 1) * 8), completedSongIds: [] }));
  const now = new Date().toISOString();
  return { id: `path-${template.id}`, templateId: template.id, name: template.name, description: template.description, stages, createdAt: now, updatedAt: now };
}

export function startPracticePath(path: SongPracticePath): SongPracticeQueue {
  const stage = path.stages.find((item) => item.completedSongIds.length < item.eligibleSongIds.length) ?? path.stages[0];
  const songIds = stage?.eligibleSongIds.slice(0, 8) ?? [];
  const now = new Date().toISOString();
  return { id: `queue-path-${path.templateId}-${Date.now()}`, name: `${path.name} · ${stage?.title ?? "practice"}`, songIds, createdAt: now, updatedAt: now, targetDurationMinutes: Math.max(10, songIds.length * 8) };
}

export function recordPracticePathProgress(state: SongLibraryState, templateId: string, songIds: string[]): SongLibraryState {
  return { ...state, practicePaths: state.practicePaths.map((path) => { if (path.templateId !== templateId) return path; let advanced = false; const stages = path.stages.map((stage) => { if (advanced || stage.eligibleSongIds.length === 0 || stage.completedSongIds.length >= stage.eligibleSongIds.length) return stage; advanced = true; return { ...stage, completedSongIds: [...new Set([...stage.completedSongIds, ...songIds.filter((songId) => stage.eligibleSongIds.includes(songId))])].slice(0, stage.eligibleSongIds.length) }; }); return { ...path, stages, updatedAt: new Date().toISOString() }; }) };
}

export type SetlistTimelineItem = { songId: string; title: string; startMinute: number; durationMinutes: number; breakAfterSeconds: number; change: boolean };
export function estimateSetlistTimeline(setlist: SongSetlist, songs: LibrarySong[], defaultBreakSeconds = 30): { totalMinutes: number; songMinutes: number; breakMinutes: number; items: SetlistTimelineItem[] } {
  let cursor = 0;
  const items = setlist.entries.slice(0, 100).map((entry, index) => {
    const song = songs.find((item) => item.id === entry.songId);
    const variation = song?.variations.find((item) => item.id === entry.variationId) ?? song?.variations[0];
    const durationMinutes = Math.max(2, Math.min(15, song ? song.sections.length * 1.8 + (variation?.bpm ?? song.bpm) / 120 : 4));
    const previous = setlist.entries[index - 1];
    const change = Boolean(previous && (previous.tuningId !== entry.tuningId || previous.capo !== entry.capo));
    const breakAfterSeconds = index < setlist.entries.length - 1 ? Math.max(0, entry.breakAfterSeconds ?? (change ? setlist.transitionBreakSeconds ?? defaultBreakSeconds : 0)) : 0;
    const item = { songId: entry.songId, title: song?.title ?? "Missing song", startMinute: Math.round(cursor * 10) / 10, durationMinutes: Math.round(durationMinutes * 10) / 10, breakAfterSeconds, change };
    cursor += durationMinutes + breakAfterSeconds / 60;
    return item;
  });
  const songMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  return { totalMinutes: Math.round(cursor * 10) / 10, songMinutes: Math.round(songMinutes * 10) / 10, breakMinutes: Math.round((cursor - songMinutes) * 10) / 10, items };
}

export type SongProficiencyBadge = { id: string; title: string; description: string; earned: boolean };
export function deriveProficiencyBadges(song: LibrarySong, progress?: SongPracticeProgress, targetTempo?: number): SongProficiencyBadge[] {
  const mastery = Object.values(progress?.sectionMastery ?? {});
  const average = mastery.length ? mastery.reduce((sum, value) => sum + value, 0) / mastery.length : 0;
  const completed = song.sections.length > 0 && song.sections.every((section) => (progress?.sectionMastery?.[section.id] ?? 0) >= 100);
  const tempo = targetTempo ?? song.bpm;
  return [
    { id: "steady-start", title: "Steady start", description: "Practiced this song at least twice.", earned: (progress?.practiceCount ?? 0) >= 2 },
    { id: "section-builder", title: "Section builder", description: "Average section mastery reached 70%.", earned: average >= 70 },
    { id: "tempo-ready", title: "Tempo ready", description: `Mastery is strong at the ${tempo} BPM target.`, earned: average >= 85 && (progress?.practiceCount ?? 0) >= 3 && tempo >= Math.round(song.bpm * 0.8) },
    { id: "rehearsal-ready", title: "Rehearsal ready", description: "Every section is marked complete.", earned: completed },
  ];
}

export type ChordTransitionHeatmapItem = { from: string; to: string; count: number; difficulty: number; label: string };
export function computeChordTransitionHeatmap(song: LibrarySong, progress?: SongPracticeProgress, recordings: SongRecordingMeta[] = []): ChordTransitionHeatmapItem[] {
  const transitions = new Map<string, ChordTransitionHeatmapItem>();
  const feedbackPenalty = recordings.filter((record) => record.songId === song.id).slice(0, 3).reduce((sum, record) => sum + (100 - (record.timingConsistencyPercent ?? 70)) / 3, 0);
  song.sections.forEach((section) => {
    const masteryPenalty = 100 - (progress?.sectionMastery?.[section.id] ?? 0);
    const chords = section.blocks.flatMap((block) => block.type === "chords" ? block.chords ?? [] : []);
    for (let index = 0; index < chords.length - 1; index += 1) {
      const from = chords[index]; const to = chords[index + 1]; if (!from || !to || from === to) continue;
      const key = `${from}→${to}`; const previous = transitions.get(key);
      transitions.set(key, { from, to, count: (previous?.count ?? 0) + 1, difficulty: Math.min(100, Math.round((previous?.difficulty ?? 0) + masteryPenalty / 2 + feedbackPenalty)), label: `${from} to ${to}` });
    }
  });
  return [...transitions.values()].sort((a, b) => b.difficulty - a.difficulty).slice(0, 24);
}

export function deriveProficiencyBenchmark(state: SongLibraryState): SongBenchmarkSummary | null {
  if (!state.preferences.benchmarkOptIn) return null;
  const values = state.practiceProgress.flatMap((progress) => Object.values(progress.sectionMastery ?? {}));
  return { sessions: state.practiceSessions.length, songsPracticed: new Set(state.practiceSessions.map((session) => session.songId)).size, averageMastery: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0, practiceMinutes: Math.round(state.practiceSessions.reduce((sum, session) => sum + session.durationMs, 0) / 60000), generatedAt: new Date().toISOString() };
}

export function rolePermissions(role: SongLibraryRole): { canEditSongs: boolean; canComment: boolean; canArrange: boolean; canManageSetlists: boolean; canSchedule: boolean } {
  return { canEditSongs: role === "owner" || role === "editor" || role === "arranger", canComment: role !== "viewer", canArrange: role === "owner" || role === "editor" || role === "arranger", canManageSetlists: role === "owner" || role === "editor" || role === "setlist-manager", canSchedule: role === "owner" || role === "editor" || role === "setlist-manager" };
}

export function enqueuePendingSync(state: SongLibraryState, description: string, kind: SongPendingSyncOperation["kind"] = "local-change"): SongLibraryState {
  const item = { id: `pending-${crypto.randomUUID()}`, kind, description: description.slice(0, 160), createdAt: new Date().toISOString() };
  return { ...state, pendingSyncOps: [item, ...state.pendingSyncOps].slice(0, STATE_LIMITS.pendingSyncOps) };
}

export function pendingSyncSummary(state: SongLibraryState): string {
  const count = state.pendingSyncOps.length;
  return count === 0 ? "No local changes are waiting for sync." : `${count} local change${count === 1 ? "" : "s"} waiting for review before sync.`;
}

export function clearPendingSyncOperations(state: SongLibraryState): SongLibraryState { return { ...state, pendingSyncOps: [] }; }

export function archiveSong(state: SongLibraryState, songId: string, archived: boolean): SongLibraryState {
  const archivedSongIds = archived ? [...new Set([...state.archivedSongIds, songId])] : state.archivedSongIds.filter((id) => id !== songId);
  return { ...state, archivedSongIds, songs: state.songs.map((song) => song.id === songId ? { ...song, archivedAt: archived ? new Date().toISOString() : undefined } : song), recordings: state.recordings.map((record) => record.songId === songId ? { ...record, archivedAt: archived ? new Date().toISOString() : undefined } : record) };
}

export function archiveSetlist(state: SongLibraryState, setlistId: string, archived: boolean): SongLibraryState { return { ...state, setlists: state.setlists.map((setlist) => setlist.id === setlistId ? { ...setlist, archivedAt: archived ? new Date().toISOString() : undefined } : setlist) }; }

export function addVideoReference(state: SongLibraryState, reference: Omit<SongVideoReference, "id" | "createdAt">): SongLibraryState { return { ...state, videoReferences: [{ ...reference, id: `video-${crypto.randomUUID()}`, createdAt: new Date().toISOString() }, ...state.videoReferences].slice(0, STATE_LIMITS.videoReferences) }; }

export function scheduleLocalItem(state: SongLibraryState, item: Omit<SongScheduledItem, "id" | "createdAt">): SongLibraryState { return { ...state, scheduledItems: [{ ...item, id: `scheduled-${crypto.randomUUID()}`, createdAt: new Date().toISOString() }, ...state.scheduledItems].slice(0, STATE_LIMITS.scheduledItems) }; }

export function dueScheduledItems(state: SongLibraryState, now = Date.now()): SongScheduledItem[] { return state.scheduledItems.filter((item) => Date.parse(item.dueAt) <= now).slice(0, 20); }

export function simplifyVariation(variation: SongVariation): SongVariation {
  return { ...variation, id: `${variation.id}-simplified`, name: `${variation.name} · Simplified`, bpm: Math.max(40, Math.round(variation.bpm * 0.75)), pattern: variation.pattern.replace(/\s+/g, " ").split(" ").filter((step) => step === "D" || step === "U" || step === "-" || step === "d").filter((_, index) => index % 2 === 0).join(" ") || "D - D -", feel: "Reduced BPM and fewer subdivisions for a steadier first pass." };
}

export function simplifyChord(chord: string): string {
  const substitutions: Record<string, string> = { F: "C", "F#": "C", Bb: "F", B: "G", Bm: "G", "B7": "G", E: "Am", "E7": "Am", Dm: "C" };
  return substitutions[chord] ?? chord;
}

export function buildSmartPracticePlan(state: SongLibraryState, songs: LibrarySong[], planName = "Smart practice plan"): SongPracticeQueue {
  const now = Date.now();
  const scored = songs.map((song) => {
    const progress = state.practiceProgress.find((item) => item.songId === song.id);
    const masteryValues = Object.values(progress?.sectionMastery ?? {});
    const weak = masteryValues.length ? 100 - Math.min(...masteryValues) : 65;
    const unpracticed = progress ? 0 : 35;
    const reviewDue = progress?.lastPracticedAt ? Math.min(30, Math.round((now - Date.parse(progress.lastPracticedAt)) / 86400000) * 2) : 25;
    const nextReview = progress?.lastPracticedAt ? Date.parse(progress.lastPracticedAt) + Math.max(1, Math.min(14, (progress.streakDays ?? 1) * 2)) * 86400000 : 0;
    return { song, score: weak * 0.5 + unpracticed * 0.3 + reviewDue * 0.2, nextReview };
  }).sort((a, b) => b.score - a.score);
  const picked: typeof scored = [];
  const buckets = [scored.filter((item) => item.score >= 40), scored.filter((item) => !state.practiceProgress.some((progress) => progress.songId === item.song.id)), scored.filter((item) => item.nextReview > 0 && item.nextReview <= now)];
  buckets.forEach((bucket) => bucket.slice(0, 3).forEach((item) => { if (!picked.some((candidate) => candidate.song.id === item.song.id)) picked.push(item); }));
  scored.forEach((item) => { if (picked.length < 8 && !picked.some((candidate) => candidate.song.id === item.song.id)) picked.push(item); });
  return { id: `queue-smart-${Date.now()}`, name: planName, songIds: picked.slice(0, 8).map((item) => item.song.id), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), targetDurationMinutes: Math.max(10, Math.min(120, picked.length * 8)) };
}

export function serializeSongPreset(song: LibrarySong, format: "chordpro" | "plain-tab" | "musicxml", licensed = false): string {
  if (format === "musicxml") {
    if (!licensed) throw new Error("MusicXML export requires confirmation that the source is licensed.");
    const measures = song.sections.flatMap((section) => section.blocks.filter((block) => block.type === "chords").flatMap((block) => block.chords ?? [])).map((chord, index) => `<measure number="${index + 1}"><harmony><root><root-step>${chord.replace(/[^A-G].*$/, "")}</root-step></root></harmony></measure>`).join("");
    return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>${song.title}</work-title></work><identification><creator type="composer">${song.artist}</creator><rights>Licensed source confirmed by user</rights></identification><part-list><score-part id="P1" name="Guitar"/></part-list><part id="P1">${measures}</part></score-partwise>`;
  }
  if (format === "chordpro") return [`{title: ${song.title}}`, `{artist: ${song.artist}}`, ...song.sections.flatMap((section) => ["", `{comment: ${section.title}}`, ...section.blocks.map((block) => block.type === "lyrics" ? (block.text ?? "") : block.type === "chords" ? (block.chords ?? []).map((chord) => `[${chord}]`).join("") : block.type === "tab" ? (block.lines ?? []).join("\n") : `# ${block.text ?? ""}`)])].join("\n");
  return [`Title: ${song.title}`, `Artist: ${song.artist}`, ...song.sections.flatMap((section) => ["", `[${section.title}]`, ...section.blocks.flatMap((block) => block.type === "chords" ? [`Chords: ${(block.chords ?? []).join(" ")}`] : block.type === "tab" ? (block.lines ?? []) : block.type === "lyrics" ? [block.text ?? ""] : [])])].join("\n");
}

export function parseSongPreset(text: string, format: "chordpro" | "plain-tab", source = "Imported preset"): Pick<LibrarySong, "title" | "artist" | "sections" | "source" | "license"> {
  const title = text.match(/^\{title:\s*([^}]+)\}/im)?.[1]?.trim() ?? text.match(/^Title:\s*(.+)$/im)?.[1]?.trim() ?? "Imported preset";
  const artist = text.match(/^\{artist:\s*([^}]+)\}/im)?.[1]?.trim() ?? text.match(/^Artist:\s*(.+)$/im)?.[1]?.trim() ?? "Unknown artist";
  const lines = text.split(/\r?\n/); const sections: SongSection[] = []; let current: SongSection = { id: `section-${crypto.randomUUID()}`, title: "Main section", blocks: [] };
  lines.forEach((line) => { const heading = format === "chordpro" ? line.match(/^\{comment:\s*([^}]+)\}/i)?.[1] : line.match(/^\[([^\]]+)\]$/)?.[1]; if (heading) { if (current.blocks.length) sections.push(current); current = { id: `section-${crypto.randomUUID()}`, title: heading, blocks: [] }; return; } const chords = format === "chordpro" ? [...line.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]) : line.match(/^Chords:\s*(.*)$/i)?.[1]?.split(/\s+/).filter(Boolean); if (chords?.length) current.blocks.push({ type: "chords", chords }); else if (line.trim() && !/^\{(title|artist):/i.test(line) && !/^Artist:|^Title:/i.test(line)) current.blocks.push({ type: format === "plain-tab" && line.includes("|") ? "tab" : "lyrics", ...(format === "plain-tab" && line.includes("|") ? { lines: [line] } : { text: line }) }); }); if (current.blocks.length || !sections.length) sections.push(current);
  return { title, artist, sections, source, license: "User-imported preset; verify rights before sharing" };
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
  const providerReliability = /ultimate-guitar\.com/i.test(url) ? 0.75 : /\.edu|\.gov|imslp|musescore/i.test(url) ? 0.9 : 0.55;
  if (typeof navigator !== "undefined" && !navigator.onLine) return { url, status: "offline", checkedAt, providerReliability, freshnessScore: 0 };
  try { await fetch(url, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(5000) }); return { url, status: "online", checkedAt, providerReliability, freshnessScore: sourceFreshnessScore({ url, status: "online", checkedAt, providerReliability }) }; } catch { return { url, status: "offline", checkedAt, providerReliability, freshnessScore: sourceFreshnessScore({ url, status: "offline", checkedAt, providerReliability }) }; }
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
