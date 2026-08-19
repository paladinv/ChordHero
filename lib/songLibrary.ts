export type SongTechnique = "strumming" | "fingerpicking" | "plectrum";

export type SongBlock = {
  type: "lyrics" | "chords" | "tab" | "annotation";
  text?: string;
  chords?: string[];
  lines?: string[];
};

export type SongSectionKind = "intro" | "verse" | "chorus" | "bridge" | "solo" | "ending" | "other";
export type SongSection = { id: string; title: string; blocks: SongBlock[]; kind?: SongSectionKind };

export type SongMapNode = { sectionId: string; label: string; kind: SongSectionKind; order: number };
export type SongLyricSheet = { id: string; name: string; kind: "original" | "vocal-range" | "sing-along"; rangeLabel?: string; sections: SongSection[] };
export type SongTagGroups = { gig: string[]; genre: string[]; mood: string[]; season: string[]; audience: string[] };

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
  arrangementKind?: "original" | "simplified" | "fingerstyle" | "concert";
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
  tagGroups?: SongTagGroups;
  songMap?: SongMapNode[];
  lyricSheets?: SongLyricSheet[];
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
  sectionConfidence?: Record<string, number>;
  confidence?: number;
  sectionReviews?: Record<string, SongSectionReviewState>;
  streakDays?: number;
};

export type SongSectionReviewState = { sectionId: string; dueAt: string; intervalDays: number; repetitions: number; ease: number; lastReviewedAt?: string; lapses: number };
export type SongReviewResult = "again" | "hard" | "good" | "easy";
export type SongTempoRamp = { id: string; songId: string; variationId?: string; sectionId?: string; startBpm: number; currentBpm: number; endBpm: number; stepBpm: number; repetitions: number; successfulRepetitions: number; updatedAt: string };
export type RehearsalChecklistItem = { id: string; label: string; category: "gear" | "capo" | "tuning" | "lyrics" | "backing-tracks" | "changeovers" };
export type RehearsalChecklist = { id: string; name: string; items: RehearsalChecklistItem[]; createdAt: string; updatedAt: string };
export type RehearsalChecklistProgress = { checklistId: string; setlistId?: string; sessionId?: string; checkedItemIds: string[]; updatedAt: string };
export type SongChordTransitionGoal = { id: string; songId: string; from: string; to: string; targetRepetitions: number; completedRepetitions: number; source: "manual" | "auto"; completedAt?: string; updatedAt: string };
export type SongStagePreferences = { mode: "standard" | "compact" | "dark" | "large"; autoScroll: boolean; autoScrollSeconds: number };

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
  performance?: SongPerformanceOverride;
  changeNotes?: string;
  breakAfterSeconds?: number;
};

export type SongPerformanceOverride = {
  notes?: string;
  capo?: number;
  tuningId?: string;
  tempo?: number;
  simplifiedFallback?: boolean;
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
  threadId?: string;
  visibility?: "shared" | "teacher-only";
};

export type SongReadinessCheck = {
  id: string;
  createdAt: string;
  sleep: "rested" | "okay" | "tired";
  workload: "light" | "typical" | "heavy";
  handFatigue: "none" | "some" | "high";
  handFatigueNote?: string;
  score: number;
  suggestion: "light" | "normal" | "focused";
};

export type SongDraft = {
  id: string;
  title: string;
  artist?: string;
  idea: string;
  chordIdeas: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type SongPracticeJournalEntry = {
  id: string;
  createdAt: string;
  songId?: string;
  sectionId?: string;
  improvement: string;
  breakdown: string;
  nextStep?: string;
};

export type SongAssignment = {
  id: string;
  songId: string;
  assigneeId: string;
  assignedBy: string;
  dueAt: string;
  feedback?: string;
  visibility: "shared" | "teacher-only";
  createdAt: string;
  updatedAt: string;
};

export type SongAssignmentComment = {
  id: string;
  assignmentId: string;
  body: string;
  authorId: string;
  role: SongLibraryRole;
  visibility: "shared" | "teacher-only";
  createdAt: string;
};

export type SongQueueHistory = { id: string; queueId: string; songIds: string[]; completedAt: string; lastSongId?: string };
export type SongResumePoint = { queueId: string; songId: string; variationId?: string; updatedAt: string };
export type WeeklyPracticeGoal = { weekStart: string; targetSessions: number; completedSessions: number };
export type SongRecordingMeta = { id: string; songId: string; sectionId?: string; durationMs: number; mimeType: string; createdAt: string; waveform?: number[]; trimStartMs?: number; trimEndMs?: number; tempoBpm?: number; tempoDriftPercent?: number; timingConsistencyPercent?: number; analysisNote?: string; archivedAt?: string };
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

export type SongFamily = { id: string; name: string; description?: string; tags: string[]; songIds: string[]; createdAt: string; updatedAt: string };
export type SongBookmarkMarker = { measure?: number; chord?: string; lyric?: string };
export type SongSectionBookmark = { id: string; songId: string; sectionId: string; marker?: SongBookmarkMarker; label: string; note?: string; createdAt: string; updatedAt: string };
export type SongVoicingMode = "open" | "barre" | "partial-barre" | "simplified";
export type SongVoicingPreference = { songId: string; variationId?: string; mode: SongVoicingMode; updatedAt: string };
export type SongEquipmentNotes = { songId: string; instrument?: string; pickup?: string; effects?: string; microphone?: string; backingTrackMix?: string; updatedAt: string };
export type SongRecordingTarget = { songId: string; variationId?: string; targetBpm?: number; referenceRecordingId?: string; referenceLabel?: string; updatedAt: string };
export type SongAuditionSession = { id: string; songId: string; sectionIds: string[]; answered: number; correct: number; startedAt: string; completedAt?: string };

export type SongLibraryState = {
  version: 6;
  collections: SongLibraryCollection[];
  songs: LibrarySong[];
  archivedSongIds: string[];
  favorites: string[];
  recentSongIds: string[];
  practiceProgress: SongPracticeProgress[];
  practiceQueues: SongPracticeQueue[];
  preferences: { largePrint: boolean; handsFree: boolean; simplifyMode: boolean; benchmarkOptIn: boolean; localRole: SongLibraryRole; stage: SongStagePreferences };
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
  readinessHistory: SongReadinessCheck[];
  drafts: SongDraft[];
  journalEntries: SongPracticeJournalEntry[];
  assignments: SongAssignment[];
  assignmentComments: SongAssignmentComment[];
  tempoRamps: SongTempoRamp[];
  rehearsalChecklists: RehearsalChecklist[];
  checklistProgress: RehearsalChecklistProgress[];
  transitionGoals: SongChordTransitionGoal[];
  songFamilies: SongFamily[];
  sectionBookmarks: SongSectionBookmark[];
  voicingPreferences: SongVoicingPreference[];
  equipmentNotes: SongEquipmentNotes[];
  recordingTargets: SongRecordingTarget[];
  auditionSessions: SongAuditionSession[];
};

export type SongLibraryRole = "owner" | "editor" | "viewer" | "commenter" | "arranger" | "setlist-manager";
export type SongLibraryShareAccess = { libraryId: string; accountId: string; role: SongLibraryRole; invitedAt: string };
export type SongResourceShareAccess = { resourceType: "song" | "queue"; resourceId: string; accountId: string; role: Exclude<SongLibraryRole, "owner">; invitedAt: string };

export const SONG_LIBRARY_STORAGE_KEY = "chord-hero-song-library-v1";

export function emptySongLibraryState(): SongLibraryState {
  return { version: 6, collections: [], songs: [], archivedSongIds: [], favorites: [], recentSongIds: [], practiceProgress: [], practiceQueues: [], preferences: { largePrint: false, handsFree: false, simplifyMode: false, benchmarkOptIn: false, localRole: "owner", stage: { mode: "standard", autoScroll: false, autoScrollSeconds: 12 } }, queueHistory: [], weeklyGoal: { weekStart: getWeekStart(), targetSessions: 3, completedSessions: 0 }, recordings: [], sourceHealth: [], sharedAccess: [], resourceAccess: [], practiceSessions: [], annotations: [], setlists: [], comments: [], appliedTranspositions: {}, adaptiveOverrides: {}, videoReferences: [], practicePaths: [], scheduledItems: [], pendingSyncOps: [], readinessHistory: [], drafts: [], journalEntries: [], assignments: [], assignmentComments: [], tempoRamps: [], rehearsalChecklists: [], checklistProgress: [], transitionGoals: [], songFamilies: [], sectionBookmarks: [], voicingPreferences: [], equipmentNotes: [], recordingTargets: [], auditionSessions: [] };
}

const STATE_LIMITS = { collections: 100, songs: 500, favorites: 500, practiceProgress: 500, practiceQueues: 100, queueHistory: 50, recordings: 500, sourceHealth: 200, sharedAccess: 500, resourceAccess: 500, practiceSessions: 500, annotations: 500, setlists: 100, comments: 500, videoReferences: 500, practicePaths: 50, scheduledItems: 200, pendingSyncOps: 200, readinessHistory: 30, drafts: 100, journalEntries: 200, assignments: 200, assignmentComments: 500, tempoRamps: 200, rehearsalChecklists: 50, checklistProgress: 500, transitionGoals: 500, songFamilies: 100, sectionBookmarks: 500, voicingPreferences: 500, equipmentNotes: 500, recordingTargets: 500, auditionSessions: 100 } as const;
const bounded = <T>(value: unknown, limit: number): T[] => Array.isArray(value) ? value.slice(0, limit) as T[] : [];
const boundedRecord = <T>(value: unknown, limit: number): Record<string, T> => value && typeof value === "object" ? Object.fromEntries(Object.entries(value).slice(0, limit)) as Record<string, T> : {};

const clampPercent = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const clampTempo = (value: unknown, fallback = 90) => Math.max(40, Math.min(240, Math.round(Number(value) || fallback)));
const inferSectionKind = (title: string): SongSectionKind => { const value = title.toLowerCase(); if (/intro|opening/.test(value)) return "intro"; if (/chorus|refrain|hook/.test(value)) return "chorus"; if (/bridge|middle 8/.test(value)) return "bridge"; if (/solo|instrumental|break/.test(value)) return "solo"; if (/ending|outro|coda|tag/.test(value)) return "ending"; if (/verse|pre-chorus/.test(value)) return "verse"; return "other"; };
const defaultTagGroups = (tags: string[] = []): SongTagGroups => ({ gig: tags.filter((tag) => /gig|set|live|worship|campfire/i.test(tag)), genre: tags.filter((tag) => /folk|hymn|blues|rock|pop|country|jazz|traditional/i.test(tag)), mood: tags.filter((tag) => /upbeat|calm|sad|joy|reflective|energetic/i.test(tag)), season: tags.filter((tag) => /summer|winter|spring|fall|holiday|christmas/i.test(tag)), audience: tags.filter((tag) => /beginner|family|kids|audience|sing-along/i.test(tag)) });
const normalizeSection = (section: SongSection, index: number): SongSection => ({ ...section, id: String(section.id || `section-${index + 1}`), title: String(section.title || `Section ${index + 1}`).slice(0, 120), kind: section.kind ?? inferSectionKind(String(section.title || "")), blocks: bounded<SongBlock>(section.blocks, 24).map((block) => ({ ...block, text: typeof block.text === "string" ? block.text.slice(0, 4000) : undefined, chords: bounded<string>(block.chords, 64).map((chord) => String(chord).slice(0, 32)), lines: bounded<string>(block.lines, 32).map((line) => String(line).slice(0, 400)) })) });
const normalizeLibrarySong = (song: LibrarySong, index: number): LibrarySong => { const sections = bounded<SongSection>(song.sections, 64).map(normalizeSection); const songMap = bounded<SongMapNode>(song.songMap, 64).length ? bounded<SongMapNode>(song.songMap, 64) : sections.map((section, order) => ({ sectionId: section.id, label: section.title, kind: section.kind ?? "other", order })); const lyricSheets = bounded<SongLyricSheet>(song.lyricSheets, 4).length ? bounded<SongLyricSheet>(song.lyricSheets, 4).map((sheet) => ({ ...sheet, name: String(sheet.name || "Lyric sheet").slice(0, 80), rangeLabel: sheet.rangeLabel?.slice(0, 80), sections: bounded<SongSection>(sheet.sections, 64).map(normalizeSection) })) : [{ id: `${song.id || `song-${index + 1}`}-original`, name: "Original", kind: "original" as const, sections }]; return { ...song, id: String(song.id || `song-${index + 1}`), title: String(song.title || "Untitled song").slice(0, 160), artist: String(song.artist || "Unknown artist").slice(0, 160), tags: bounded<string>(song.tags, 32).map((tag) => String(tag).slice(0, 48)), sections, songMap, lyricSheets, tagGroups: { ...defaultTagGroups(song.tags), ...(song.tagGroups ?? {}) }, variations: bounded<SongVariation>(song.variations, 16).map((variation) => ({ ...variation, bpm: clampTempo(variation.bpm, song.bpm), capo: Math.max(0, Math.min(12, Math.round(Number(variation.capo) || 0))), arrangementKind: variation.arrangementKind ?? (/finger/i.test(variation.name) ? "fingerstyle" : /simpl/i.test(variation.name) ? "simplified" : "original") })), bpm: clampTempo(song.bpm) }; };

/** Additive v1-v6 reader used by local storage, plain backups, and encrypted backups. */
export function migrateSongLibraryState(input: unknown): SongLibraryState {
  const parsed = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const defaults = emptySongLibraryState();
  if (![1, 2, 3, 4, 5, 6].includes(Number(parsed.version)) || !Array.isArray(parsed.collections) || !Array.isArray(parsed.songs)) return defaults;
  const preferences = { ...defaults.preferences, ...(parsed.preferences && typeof parsed.preferences === "object" ? parsed.preferences : {}) } as SongLibraryState["preferences"];
  return {
    ...defaults,
    ...parsed,
    version: 6,
    collections: bounded<SongLibraryCollection>(parsed.collections, STATE_LIMITS.collections).map((collection) => ({ ...collection, songIds: bounded<string>(collection.songIds, STATE_LIMITS.songs) })),
    songs: bounded<LibrarySong>(parsed.songs, STATE_LIMITS.songs).map(normalizeLibrarySong),
    archivedSongIds: bounded<string>(parsed.archivedSongIds, STATE_LIMITS.songs),
    favorites: bounded<string>(parsed.favorites, STATE_LIMITS.favorites),
    recentSongIds: bounded<string>(parsed.recentSongIds, 12),
    practiceProgress: bounded<SongPracticeProgress>(parsed.practiceProgress, STATE_LIMITS.practiceProgress).map((progress) => ({ ...progress, sectionMastery: boundedRecord<number>(progress.sectionMastery, 64), sectionConfidence: Object.fromEntries(Object.entries(boundedRecord<number>(progress.sectionConfidence, 64)).map(([key, value]) => [key, clampPercent(value)])), confidence: clampPercent(progress.confidence), sectionReviews: Object.fromEntries(Object.entries(boundedRecord<SongSectionReviewState>(progress.sectionReviews, 64)).map(([key, review]) => [key, { ...review, sectionId: review.sectionId ?? key, intervalDays: Math.max(0.25, Math.min(365, Number(review.intervalDays) || 1)), repetitions: Math.max(0, Math.min(1000, Math.round(Number(review.repetitions) || 0))), ease: Math.max(1.3, Math.min(3, Number(review.ease) || 2.5)), lapses: Math.max(0, Math.min(1000, Math.round(Number(review.lapses) || 0))) }])) })),
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
    setlists: bounded<SongSetlist>(parsed.setlists, STATE_LIMITS.setlists).map((setlist) => ({ ...setlist, entries: bounded<SongSetlist["entries"][number]>(setlist.entries, STATE_LIMITS.songs).map((entry) => ({ ...entry, performance: entry.performance ? { ...entry.performance, notes: entry.performance.notes?.slice(0, 400), capo: typeof entry.performance.capo === "number" ? Math.max(0, Math.min(12, entry.performance.capo)) : undefined, tempo: typeof entry.performance.tempo === "number" ? Math.max(40, Math.min(240, entry.performance.tempo)) : undefined } : undefined })) })),
    comments: bounded<SongCollaboratorComment>(parsed.comments, STATE_LIMITS.comments),
    appliedTranspositions: boundedRecord<number>(parsed.appliedTranspositions, STATE_LIMITS.songs),
    adaptiveOverrides: boundedRecord<SongAdaptiveOverride>(parsed.adaptiveOverrides, STATE_LIMITS.songs),
    videoReferences: bounded<SongVideoReference>(parsed.videoReferences, STATE_LIMITS.videoReferences),
    practicePaths: bounded<SongPracticePath>(parsed.practicePaths, STATE_LIMITS.practicePaths),
    scheduledItems: bounded<SongScheduledItem>(parsed.scheduledItems, STATE_LIMITS.scheduledItems),
    pendingSyncOps: bounded<SongPendingSyncOperation>(parsed.pendingSyncOps, STATE_LIMITS.pendingSyncOps),
    readinessHistory: bounded<SongReadinessCheck>(parsed.readinessHistory, STATE_LIMITS.readinessHistory).map((item) => ({ ...item, handFatigueNote: typeof item.handFatigueNote === "string" ? item.handFatigueNote.slice(0, 240) : undefined })),
    drafts: bounded<SongDraft>(parsed.drafts, STATE_LIMITS.drafts).map((draft) => ({ ...draft, title: String(draft.title ?? "").slice(0, 120), artist: draft.artist?.slice(0, 120), idea: String(draft.idea ?? "").slice(0, 2000), chordIdeas: bounded<string>(draft.chordIdeas, 32).map((chord) => chord.slice(0, 24)) })),
    journalEntries: bounded<SongPracticeJournalEntry>(parsed.journalEntries, STATE_LIMITS.journalEntries).map((entry) => ({ ...entry, improvement: String(entry.improvement ?? "").slice(0, 1200), breakdown: String(entry.breakdown ?? "").slice(0, 1200), nextStep: entry.nextStep?.slice(0, 800) })),
    assignments: bounded<SongAssignment>(parsed.assignments, STATE_LIMITS.assignments).map((assignment) => ({ ...assignment, feedback: assignment.feedback?.slice(0, 1200) })),
    assignmentComments: bounded<SongAssignmentComment>(parsed.assignmentComments, STATE_LIMITS.assignmentComments).map((comment) => ({ ...comment, body: String(comment.body ?? "").slice(0, 1200) })),
    tempoRamps: bounded<SongTempoRamp>(parsed.tempoRamps, STATE_LIMITS.tempoRamps).map((ramp) => ({ ...ramp, startBpm: clampTempo(ramp.startBpm), currentBpm: clampTempo(ramp.currentBpm), endBpm: clampTempo(ramp.endBpm), stepBpm: Math.max(1, Math.min(20, Math.round(Number(ramp.stepBpm) || 5))), repetitions: Math.max(1, Math.min(100, Math.round(Number(ramp.repetitions) || 3))), successfulRepetitions: Math.max(0, Math.min(1000, Math.round(Number(ramp.successfulRepetitions) || 0))) })),
    rehearsalChecklists: bounded<RehearsalChecklist>(parsed.rehearsalChecklists, STATE_LIMITS.rehearsalChecklists).map((checklist) => ({ ...checklist, name: String(checklist.name ?? "Checklist").slice(0, 100), items: bounded<RehearsalChecklistItem>(checklist.items, 32).map((item, index) => ({ ...item, id: String(item.id || `item-${index + 1}`), label: String(item.label || "Checklist item").slice(0, 120) })) })),
    checklistProgress: bounded<RehearsalChecklistProgress>(parsed.checklistProgress, STATE_LIMITS.checklistProgress).map((progress) => ({ ...progress, checkedItemIds: bounded<string>(progress.checkedItemIds, 32) })),
    transitionGoals: bounded<SongChordTransitionGoal>(parsed.transitionGoals, STATE_LIMITS.transitionGoals).map((goal) => ({ ...goal, targetRepetitions: Math.max(1, Math.min(1000, Math.round(Number(goal.targetRepetitions) || 10))), completedRepetitions: Math.max(0, Math.min(1000, Math.round(Number(goal.completedRepetitions) || 0))) })),
    songFamilies: bounded<SongFamily>(parsed.songFamilies, STATE_LIMITS.songFamilies).map((family) => ({ ...family, name: String(family.name ?? "Song family").slice(0, 100), description: typeof family.description === "string" ? family.description.slice(0, 400) : undefined, tags: bounded<string>(family.tags, 12).map((tag) => String(tag).slice(0, 48)), songIds: bounded<string>(family.songIds, 100) })),
    sectionBookmarks: bounded<SongSectionBookmark>(parsed.sectionBookmarks, STATE_LIMITS.sectionBookmarks).map((bookmark) => ({ ...bookmark, label: String(bookmark.label ?? "Bookmark").slice(0, 80), note: typeof bookmark.note === "string" ? bookmark.note.slice(0, 400) : undefined, marker: bookmark.marker ? { ...bookmark.marker, measure: typeof bookmark.marker.measure === "number" ? Math.max(1, Math.min(9999, Math.round(bookmark.marker.measure))) : undefined, chord: bookmark.marker.chord?.slice(0, 32), lyric: bookmark.marker.lyric?.slice(0, 160) } : undefined })),
    voicingPreferences: bounded<SongVoicingPreference>(parsed.voicingPreferences, STATE_LIMITS.voicingPreferences).map((preference) => ({ ...preference, mode: ["open", "barre", "partial-barre", "simplified"].includes(preference.mode) ? preference.mode : "simplified" })),
    equipmentNotes: bounded<SongEquipmentNotes>(parsed.equipmentNotes, STATE_LIMITS.equipmentNotes).map((notes) => ({ ...notes, instrument: notes.instrument?.slice(0, 120), pickup: notes.pickup?.slice(0, 240), effects: notes.effects?.slice(0, 240), microphone: notes.microphone?.slice(0, 240), backingTrackMix: notes.backingTrackMix?.slice(0, 240) })),
    recordingTargets: bounded<SongRecordingTarget>(parsed.recordingTargets, STATE_LIMITS.recordingTargets).map((target) => ({ ...target, targetBpm: typeof target.targetBpm === "number" ? clampTempo(target.targetBpm) : undefined, referenceLabel: target.referenceLabel?.slice(0, 160) })),
    auditionSessions: bounded<SongAuditionSession>(parsed.auditionSessions, STATE_LIMITS.auditionSessions).map((session) => ({ ...session, sectionIds: bounded<string>(session.sectionIds, 64), answered: Math.max(0, Math.min(64, Math.round(Number(session.answered) || 0))), correct: Math.max(0, Math.min(64, Math.round(Number(session.correct) || 0))) })),
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

export function sectionKindLabel(kind: SongSectionKind): string { return kind === "other" ? "Section" : kind[0].toUpperCase() + kind.slice(1); }
export function songMapFor(song: LibrarySong): SongMapNode[] { return song.songMap?.length ? song.songMap : song.sections.map((section, order) => ({ sectionId: section.id, label: section.title, kind: section.kind ?? inferSectionKind(section.title), order })); }

export function createSectionReviewState(sectionId: string, dueAt = new Date(0).toISOString()): SongSectionReviewState { return { sectionId, dueAt, intervalDays: 0.25, repetitions: 0, ease: 2.5, lapses: 0 }; }
export function scheduleSectionReview(previous: SongSectionReviewState | undefined, result: SongReviewResult, reviewedAt: string): SongSectionReviewState {
  const current = previous ?? createSectionReviewState("unknown", reviewedAt);
  const multipliers: Record<SongReviewResult, number> = { again: 0.25, hard: 1.25, good: 2.5, easy: 4 };
  const intervalDays = result === "again" ? 0.25 : Math.max(0.25, Math.min(365, current.intervalDays * multipliers[result]));
  const repetitions = result === "again" ? 0 : current.repetitions + 1;
  const ease = Math.max(1.3, Math.min(3, current.ease + (result === "easy" ? 0.15 : result === "hard" ? -0.15 : result === "again" ? -0.25 : 0)));
  return { ...current, dueAt: new Date(Date.parse(reviewedAt) + intervalDays * 86400000).toISOString(), intervalDays, repetitions, ease, lastReviewedAt: reviewedAt, lapses: current.lapses + (result === "again" ? 1 : 0) };
}
export function dueSectionReviews(state: SongLibraryState, songs: LibrarySong[], now = Date.now()): Array<{ songId: string; sectionId: string; title: string; dueAt: string }> {
  const songById = new Map(songs.map((song) => [song.id, song]));
  return state.practiceProgress.flatMap((progress) => Object.values(progress.sectionReviews ?? {}).filter((review) => Date.parse(review.dueAt) <= now).map((review) => ({ songId: progress.songId, sectionId: review.sectionId, title: songById.get(progress.songId)?.sections.find((section) => section.id === review.sectionId)?.title ?? review.sectionId, dueAt: review.dueAt }))).sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export type SongPracticeDebtSection = { sectionId: string; title: string; score: number; overdue: boolean; inactiveDays: number; reason: string };
export type SongPracticeDebt = { songId: string; title: string; score: number; overdueReviews: number; inactiveDays: number; sections: SongPracticeDebtSection[]; reason: string };

/** Bounded, deterministic debt calculation used by the dashboard and queue explanation. */
export function derivePracticeDebt(state: SongLibraryState, songs: LibrarySong[], now = Date.now()): SongPracticeDebt[] {
  return songs.slice(0, 500).map((song) => {
    const progress = state.practiceProgress.find((item) => item.songId === song.id);
    const inactiveDays = progress?.lastPracticedAt ? Math.max(0, Math.floor((now - Date.parse(progress.lastPracticedAt)) / 86400000)) : 999;
    const sections = song.sections.slice(0, 64).map((section) => {
      const review = progress?.sectionReviews?.[section.id];
      const overdue = Boolean(review && Date.parse(review.dueAt) <= now);
      const sectionInactiveDays = progress?.lastPracticedAt ? inactiveDays : 999;
      const inactivityScore = Math.min(55, sectionInactiveDays === 999 ? 35 : Math.floor(sectionInactiveDays * 2.5));
      const score = Math.min(100, inactivityScore + (overdue ? 45 : review ? 0 : sectionInactiveDays >= 7 ? 15 : 0));
      return { sectionId: section.id, title: section.title, score, overdue, inactiveDays: sectionInactiveDays, reason: overdue ? "Review is overdue." : sectionInactiveDays >= 7 || sectionInactiveDays === 999 ? "Practice has been inactive." : "Review is current." };
    });
    const overdueReviews = sections.filter((section) => section.overdue).length;
    const score = sections.length ? Math.round(sections.reduce((sum, section) => sum + section.score, 0) / sections.length) : Math.min(100, inactiveDays === 999 ? 35 : Math.floor(inactiveDays * 2.5));
    return { songId: song.id, title: song.title, score, overdueReviews, inactiveDays, sections, reason: overdueReviews ? `${overdueReviews} overdue section review${overdueReviews === 1 ? "" : "s"}.` : inactiveDays >= 7 || inactiveDays === 999 ? "Needs a fresh practice touch." : "No urgent debt." };
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

export function practiceDebtExplanation(debt: SongPracticeDebt | undefined): string {
  if (!debt) return "Due reviews are placed first, then inactive and weak material.";
  return `${debt.reason} Score combines overdue section reviews and bounded inactivity days; it is a practice prompt, not a judgment.`;
}
export function recordSectionReview(state: SongLibraryState, songId: string, sectionId: string, result: SongReviewResult, reviewedAt = new Date().toISOString()): SongLibraryState {
  const existing = state.practiceProgress.find((progress) => progress.songId === songId);
  const review = scheduleSectionReview({ ...(existing?.sectionReviews?.[sectionId] ?? createSectionReviewState(sectionId)), sectionId }, result, reviewedAt);
  const next = existing ?? { songId, sectionsCompleted: [], practiceCount: 0, sectionMastery: {}, sectionConfidence: {}, sectionReviews: {} };
  return { ...state, practiceProgress: [...state.practiceProgress.filter((progress) => progress.songId !== songId), { ...next, sectionReviews: { ...(next.sectionReviews ?? {}), [sectionId]: review }, lastPracticedAt: reviewedAt, practiceCount: next.practiceCount + 1 }] };
}
export function setSongConfidence(state: SongLibraryState, songId: string, confidence: number, sectionId?: string): SongLibraryState {
  const existing = state.practiceProgress.find((progress) => progress.songId === songId) ?? { songId, sectionsCompleted: [], practiceCount: 0, sectionMastery: {}, sectionConfidence: {} };
  const next = sectionId ? { ...existing, sectionConfidence: { ...(existing.sectionConfidence ?? {}), [sectionId]: clampPercent(confidence) } } : { ...existing, confidence: clampPercent(confidence) };
  return { ...state, practiceProgress: [...state.practiceProgress.filter((progress) => progress.songId !== songId), next] };
}

export function clampSongTempo(value: number): number { return clampTempo(value); }
export function createTempoRamp(input: Pick<SongTempoRamp, "songId" | "variationId" | "sectionId" | "startBpm" | "endBpm" | "stepBpm" | "repetitions">, now = new Date().toISOString()): SongTempoRamp {
  const startBpm = clampTempo(input.startBpm); const endBpm = clampTempo(input.endBpm, startBpm); return { ...input, id: `ramp-${crypto.randomUUID()}`, startBpm, currentBpm: Math.min(startBpm, endBpm), endBpm: Math.max(startBpm, endBpm), stepBpm: Math.max(1, Math.min(20, Math.round(input.stepBpm))), repetitions: Math.max(1, Math.min(100, Math.round(input.repetitions))), successfulRepetitions: 0, updatedAt: now };
}
export function recordTempoRampRepetition(state: SongLibraryState, rampId: string, successful: boolean, now = new Date().toISOString()): SongLibraryState {
  return { ...state, tempoRamps: state.tempoRamps.map((ramp) => { if (ramp.id !== rampId || !successful) return ramp.id === rampId ? { ...ramp, updatedAt: now } : ramp; const repetitions = ramp.successfulRepetitions + 1; const advance = repetitions >= ramp.repetitions; return { ...ramp, successfulRepetitions: advance ? 0 : repetitions, currentBpm: advance ? Math.min(ramp.endBpm, ramp.currentBpm + ramp.stepBpm) : ramp.currentBpm, updatedAt: now }; }) };
}

export const DEFAULT_REHEARSAL_CHECKLIST_ITEMS: RehearsalChecklistItem[] = [
  { id: "gear", label: "Instrument, strap, picks, and spare strings", category: "gear" },
  { id: "capo", label: "Capo and backup capo packed", category: "capo" },
  { id: "tuning", label: "Tunings checked before the run", category: "tuning" },
  { id: "lyrics", label: "Lead sheets / lyric sheets available", category: "lyrics" },
  { id: "backing-tracks", label: "Backing tracks downloaded or cued", category: "backing-tracks" },
  { id: "changeovers", label: "Changeovers and stage positions rehearsed", category: "changeovers" },
];
export function createRehearsalChecklist(name = "Gig rehearsal checklist", now = new Date().toISOString()): RehearsalChecklist { return { id: `checklist-${crypto.randomUUID()}`, name: name.trim().slice(0, 100) || "Gig rehearsal checklist", items: DEFAULT_REHEARSAL_CHECKLIST_ITEMS.map((item) => ({ ...item })), createdAt: now, updatedAt: now }; }
export function toggleChecklistItem(state: SongLibraryState, checklistId: string, itemId: string, scope: { setlistId?: string; sessionId?: string }): SongLibraryState { const key = (item: RehearsalChecklistProgress) => `${item.checklistId}:${item.setlistId ?? ""}:${item.sessionId ?? ""}`; const current = state.checklistProgress.find((item) => key(item) === `${checklistId}:${scope.setlistId ?? ""}:${scope.sessionId ?? ""}`); const checkedItemIds = current?.checkedItemIds.includes(itemId) ? current.checkedItemIds.filter((id) => id !== itemId) : [...(current?.checkedItemIds ?? []), itemId].slice(0, 32); const next = { checklistId, ...scope, checkedItemIds, updatedAt: new Date().toISOString() }; return { ...state, checklistProgress: [...state.checklistProgress.filter((item) => key(item) !== key(next)), next].slice(0, STATE_LIMITS.checklistProgress) }; }

export function createTransitionGoal(input: Pick<SongChordTransitionGoal, "songId" | "from" | "to" | "targetRepetitions"> & Partial<Pick<SongChordTransitionGoal, "source">>, now = new Date().toISOString()): SongChordTransitionGoal { return { ...input, id: `transition-${crypto.randomUUID()}`, targetRepetitions: Math.max(1, Math.min(1000, Math.round(input.targetRepetitions))), completedRepetitions: 0, source: input.source ?? "manual", updatedAt: now }; }
export function autoTransitionGoals(song: LibrarySong, items: ChordTransitionHeatmapItem[], now = new Date().toISOString()): SongChordTransitionGoal[] { return items.slice(0, 5).map((item) => createTransitionGoal({ songId: song.id, from: item.from, to: item.to, targetRepetitions: Math.max(4, Math.min(30, Math.round(item.difficulty / 4))), source: "auto" }, now)); }
export function recordTransitionGoalRepetition(state: SongLibraryState, goalId: string, successful: boolean, now = new Date().toISOString()): SongLibraryState { return { ...state, transitionGoals: state.transitionGoals.map((goal) => { if (goal.id !== goalId) return goal; const completedRepetitions = successful ? Math.min(goal.targetRepetitions, goal.completedRepetitions + 1) : goal.completedRepetitions; return { ...goal, completedRepetitions, completedAt: completedRepetitions >= goal.targetRepetitions ? goal.completedAt ?? now : undefined, updatedAt: now }; }) }; }

export function buildLocalSharePayload(kind: "lead-sheet" | "setlist", song?: LibrarySong, setlist?: SongSetlist): string { const payload = kind === "lead-sheet" && song ? { schema: 6, kind, song: { id: song.id, title: song.title, artist: song.artist, license: song.license, sourceUrl: song.sourceUrl, map: songMapFor(song), variations: song.variations.map((variation) => ({ id: variation.id, name: variation.name, arrangementKind: variation.arrangementKind, key: variation.key, bpm: variation.bpm })) } } : { schema: 6, kind, setlist: setlist ? { id: setlist.id, name: setlist.name, entries: setlist.entries.map((entry) => ({ songId: entry.songId, variationId: entry.variationId, capo: entry.capo, tuningId: entry.tuningId })) } : undefined }; return JSON.stringify(payload);
}
export function buildLocalShareCode(payload: string): string { if (typeof btoa === "function") { const bytes = new TextEncoder().encode(payload); let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return `CHORDHERO-LOCAL-V6:${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`; } return `CHORDHERO-LOCAL-V6:${payload}`; }
export function buildLocalShareVisual(code: string, size = 21): boolean[][] { let hash = 2166136261; for (const character of code) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619); return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => { const finder = (originRow: number, originColumn: number) => row >= originRow && row < originRow + 7 && column >= originColumn && column < originColumn + 7 && (row === originRow || row === originRow + 6 || column === originColumn || column === originColumn + 6 || (row >= originRow + 2 && row <= originRow + 4 && column >= originColumn + 2 && column <= originColumn + 4)); if (finder(0, 0) || finder(0, size - 7) || finder(size - 7, 0)) return true; hash = Math.imul(hash ^ row * 31 + column, 16777619); return (hash >>> 28) % 2 === 1; })); }

/** Readiness is intentionally device-private and is never included in an account-sync payload. */
export function prepareSongLibraryForSync(state: SongLibraryState): SongLibraryState {
  return { ...migrateSongLibraryState(state), readinessHistory: [] };
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

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_TO_INDEX: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

function chordRoot(chord: string): string | undefined {
  const match = chord.trim().match(/^([A-G](?:#|b)?)/);
  return match?.[1] ? NOTE_NAMES[NOTE_TO_INDEX[match[1]] ?? -1] : undefined;
}

function chordIntervals(chord: string): number[] {
  const quality = chord.replace(/^([A-G](?:#|b)?)/, "").toLowerCase();
  if (quality.includes("dim")) return [0, 3, 6];
  if (quality.includes("sus2")) return [0, 2, 7];
  if (quality.includes("sus")) return [0, 5, 7];
  if (quality.includes("7")) return quality.includes("maj") ? [0, 4, 7, 11] : [0, 4, 7, 10];
  if (quality.includes("m") && !quality.includes("maj")) return [0, 3, 7];
  return [0, 4, 7];
}

function uniqueChordVocabulary(song: LibrarySong): Set<string> {
  return new Set(songChords(song).map((chord) => chord.trim().replace(/\/.*$/, "").toLowerCase()).filter(Boolean));
}

export type SongRelationship = { songId: string; title: string; kind: "shares chord vocabulary" | "same rhythm/feel" | "prepares for"; score: number; reason: string };

/** Deterministic catalogue relationships. No network, AI, lyric inference, or audio analysis is used. */
export function deriveSongRelationships(song: LibrarySong, songs: LibrarySong[]): SongRelationship[] {
  const sourceVocabulary = uniqueChordVocabulary(song);
  const sourceFeel = new Set(song.variations.flatMap((variation) => [variation.timeSignature, variation.feel.toLowerCase(), variation.pattern.replace(/[DU\-]/gi, "").trim()]).filter(Boolean));
  const difficultyRank = (value: string) => ({ beginner: 1, easy: 2, intermediate: 3, advanced: 4, custom: 2 }[value.toLowerCase()] ?? 2);
  return songs.filter((candidate) => candidate.id !== song.id).map((candidate) => {
    const candidateVocabulary = uniqueChordVocabulary(candidate);
    const shared = [...sourceVocabulary].filter((chord) => candidateVocabulary.has(chord));
    const union = new Set([...sourceVocabulary, ...candidateVocabulary]).size;
    const vocabularyScore = union ? Math.round((shared.length / union) * 100) : 0;
    const candidateFeel = new Set(candidate.variations.flatMap((variation) => [variation.timeSignature, variation.feel.toLowerCase(), variation.pattern.replace(/[DU\-]/gi, "").trim()]).filter(Boolean));
    const feelScore = [...sourceFeel].filter((item) => candidateFeel.has(item)).length * 35 + (song.timeSignature === candidate.timeSignature ? 25 : 0);
    const prepares = difficultyRank(candidate.difficulty) > difficultyRank(song.difficulty) && shared.length >= Math.max(1, Math.min(3, sourceVocabulary.size));
    const options: SongRelationship[] = [];
    if (vocabularyScore >= 35) options.push({ songId: candidate.id, title: candidate.title, kind: "shares chord vocabulary", score: vocabularyScore, reason: `Shares ${shared.slice(0, 4).join(", ")}${shared.length > 4 ? " and more" : ""}.` });
    if (feelScore >= 35) options.push({ songId: candidate.id, title: candidate.title, kind: "same rhythm/feel", score: Math.min(100, feelScore), reason: `Matches ${song.timeSignature === candidate.timeSignature ? candidate.timeSignature : "a related groove"} and arrangement feel metadata.` });
    if (prepares) options.push({ songId: candidate.id, title: candidate.title, kind: "prepares for", score: Math.min(100, vocabularyScore + 30), reason: `Keeps ${shared.slice(0, 3).join(", ")} familiar before adding a harder arrangement.` });
    return options;
  }).flat().sort((left, right) => right.score - left.score).slice(0, 12);
}

function songProgressionSignature(song: LibrarySong): string {
  return songChords(song).slice(0, 12).map((chord) => chord.trim().replace(/^([A-G](?:#|b)?)/, "ROOT").replace(/\s+/g, "").toLowerCase()).join("-");
}

function songGrooveSignature(song: LibrarySong): string {
  return song.variations.slice(0, 4).map((variation) => `${variation.timeSignature}|${variation.feel.trim().toLowerCase()}|${variation.pattern.replace(/[\sDU\-]/gi, "")}`).sort().join(";");
}

export type SongFamilyMatch = { songId: string; title: string; score: number; matches: string[] };
export function deriveSongFamilyMatches(song: LibrarySong, songs: LibrarySong[]): SongFamilyMatch[] {
  const sourceProgression = songProgressionSignature(song); const sourceGroove = songGrooveSignature(song); const sourceTechniques = new Set(song.variations.map((variation) => variation.technique));
  return songs.filter((candidate) => candidate.id !== song.id).slice(0, 500).map((candidate) => {
    const matches: string[] = []; let score = 0;
    if (sourceProgression && sourceProgression === songProgressionSignature(candidate)) { score += 40; matches.push("progression"); }
    if (sourceGroove && sourceGroove === songGrooveSignature(candidate)) { score += 25; matches.push("groove"); }
    if (candidate.key === song.key || candidate.variations.some((variation) => variation.key === song.key)) { score += 15; matches.push("key"); }
    if (candidate.variations.some((variation) => sourceTechniques.has(variation.technique))) { score += 10; matches.push("technique"); }
    if (candidate.tags.some((tag) => song.tags.includes(tag))) { score += 10; matches.push("tag"); }
    return { songId: candidate.id, title: candidate.title, score, matches };
  }).filter((match) => match.score >= 35).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 12);
}

export function createSongFamily(state: SongLibraryState, input: Pick<SongFamily, "name"> & Partial<Pick<SongFamily, "description" | "tags" | "songIds">>, now = new Date().toISOString()): SongLibraryState {
  const family: SongFamily = { id: `family-${crypto.randomUUID()}`, name: input.name.trim().slice(0, 100) || "Song family", description: input.description?.trim().slice(0, 400), tags: (input.tags ?? []).slice(0, 12).map((tag) => tag.trim().slice(0, 48)).filter(Boolean), songIds: [...new Set((input.songIds ?? []).slice(0, 100))], createdAt: now, updatedAt: now };
  return { ...state, songFamilies: [family, ...state.songFamilies].slice(0, STATE_LIMITS.songFamilies) };
}
export function updateSongFamily(state: SongLibraryState, familyId: string, patch: Partial<Pick<SongFamily, "name" | "description" | "tags" | "songIds">>, now = new Date().toISOString()): SongLibraryState {
  return { ...state, songFamilies: state.songFamilies.map((family) => family.id !== familyId ? family : { ...family, ...patch, name: patch.name?.trim().slice(0, 100) ?? family.name, description: patch.description?.trim().slice(0, 400) ?? family.description, tags: patch.tags ? [...new Set(patch.tags.slice(0, 12).map((tag) => tag.trim().slice(0, 48)).filter(Boolean))] : family.tags, songIds: patch.songIds ? [...new Set(patch.songIds.slice(0, 100))] : family.songIds, updatedAt: now }) };
}
export function deleteSongFamily(state: SongLibraryState, familyId: string): SongLibraryState { return { ...state, songFamilies: state.songFamilies.filter((family) => family.id !== familyId) }; }
export function setSongFamilyMembership(state: SongLibraryState, familyId: string, songId: string, included: boolean, now = new Date().toISOString()): SongLibraryState {
  const family = state.songFamilies.find((item) => item.id === familyId); if (!family) return state;
  const songIds = included ? [...new Set([...family.songIds, songId])].slice(0, 100) : family.songIds.filter((id) => id !== songId);
  return updateSongFamily(state, familyId, { songIds }, now);
}

export type SongPerformanceRiskItem = { id: "sections" | "lyrics" | "instrument" | "checklist"; label: string; status: "ready" | "watch" | "risk"; explanation: string };
export type SongPerformanceRisk = { score: number; level: "low" | "medium" | "high"; items: SongPerformanceRiskItem[]; criteria: string };
export function deriveSongPerformanceRisk(song: LibrarySong, state: SongLibraryState, setlist?: SongSetlist): SongPerformanceRisk {
  const progress = state.practiceProgress.find((item) => item.songId === song.id);
  const unknownSections = song.sections.filter((section) => (progress?.sectionConfidence?.[section.id] ?? 0) < 50).slice(0, 64);
  const lyricSections = song.sections.filter((section) => section.blocks.some((block) => block.type === "lyrics" && Boolean(block.text?.trim()))).length;
  const lyricCoverage = song.sections.length ? lyricSections / song.sections.length : 0;
  const variations = song.variations.slice(0, 16); const capoTunings = new Set(variations.map((variation) => `${variation.capo}:${variation.tuningId}`));
  const pendingChecklistItems = state.rehearsalChecklists.slice(0, 50).reduce((total, checklist) => { const progressForChecklist = state.checklistProgress.find((item) => item.checklistId === checklist.id && (!setlist || item.setlistId === setlist.id)); return total + checklist.items.slice(0, 32).filter((item) => !progressForChecklist?.checkedItemIds.includes(item.id)).length; }, 0);
  const items: SongPerformanceRiskItem[] = [
    { id: "sections", label: "Section confidence", status: unknownSections.length ? unknownSections.length >= Math.max(2, Math.ceil(song.sections.length / 2)) ? "risk" : "watch" : "ready", explanation: unknownSections.length ? `${unknownSections.length} section${unknownSections.length === 1 ? "" : "s"} unknown or below 50% confidence.` : "Every stored section is at or above 50% confidence." },
    { id: "lyrics", label: "Lyric coverage", status: lyricCoverage === 1 ? "ready" : lyricCoverage >= 0.75 ? "watch" : "risk", explanation: `${Math.round(lyricCoverage * 100)}% of stored sections include lyric text.` },
    { id: "instrument", label: "Capo / tuning changes", status: capoTunings.size <= 1 ? "ready" : capoTunings.size <= 2 ? "watch" : "risk", explanation: capoTunings.size > 1 ? `${capoTunings.size} capo/tuning combinations are stored across variations.` : "No variation-level capo or tuning change is detected." },
    { id: "checklist", label: "Pending checklist items", status: pendingChecklistItems === 0 ? "ready" : pendingChecklistItems <= 3 ? "watch" : "risk", explanation: pendingChecklistItems ? `${pendingChecklistItems} checklist item${pendingChecklistItems === 1 ? "" : "s"} remain unchecked in the local rehearsal scope.` : "No pending rehearsal checklist items in the selected scope." },
  ];
  const score = Math.min(100, items.reduce((sum, item) => sum + (item.status === "risk" ? 30 : item.status === "watch" ? 12 : 0), 0));
  return { score, level: score >= 60 ? "high" : score >= 25 ? "medium" : "low", items, criteria: "Risk is a transparent checklist from section confidence, lyric coverage, capo/tuning combinations, and pending local checklist items. It is not a prediction of performance quality." };
}

export type FretboardNote = { fret: number; note: string; tone: boolean };
export type SongFretboard = { tuningLabel: string; strings: Array<{ name: string; openNote: string; notes: FretboardNote[] }>; chordTones: string[]; scaleSuggestions: string[] };

const TUNINGS: Record<string, { label: string; notes: string[] }> = {
  standard: { label: "Standard · E A D G B E", notes: ["E", "A", "D", "G", "B", "E"] },
  "drop-d": { label: "Drop D · D A D G B E", notes: ["D", "A", "D", "G", "B", "E"] },
  "open-g": { label: "Open G · D G D G B D", notes: ["D", "G", "D", "G", "B", "D"] },
  "open-d": { label: "Open D · D A D F# A D", notes: ["D", "A", "D", "F#", "A", "D"] },
  ukulele: { label: "Ukulele · G C E A", notes: ["G", "C", "E", "A"] },
};

export function buildSongFretboard(song: LibrarySong, variation?: SongVariation): SongFretboard {
  const tuning = TUNINGS[variation?.tuningId ?? "standard"] ?? TUNINGS.standard;
  const toneIndexes = new Set(songChords(song).flatMap((chord) => {
    const root = chordRoot(chord); const rootIndex = root === undefined ? -1 : NOTE_TO_INDEX[root];
    return rootIndex < 0 ? [] : chordIntervals(chord).map((interval) => (rootIndex + interval) % 12);
  }));
  const root = NOTE_TO_INDEX[chordRoot(`${variation?.key ?? song.key}`) ?? "C"] ?? 0;
  const minorKey = /m$/i.test(variation?.key ?? song.key);
  const scaleNames = [
    `Key ${NOTE_NAMES[root]} ${minorKey ? "minor" : "major"} · ${(minorKey ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map((offset) => NOTE_NAMES[(root + offset) % 12]).join(" ")}`,
    `${NOTE_NAMES[root]} ${minorKey ? "minor" : "major"} pentatonic · ${(minorKey ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]).map((offset) => NOTE_NAMES[(root + offset) % 12]).join(" ")}`,
  ];
  return { tuningLabel: tuning.label, strings: tuning.notes.map((openNote) => ({ name: openNote, openNote, notes: Array.from({ length: 13 }, (_, fret) => { const note = NOTE_NAMES[(NOTE_TO_INDEX[openNote] + fret) % 12]; return { fret, note, tone: toneIndexes.has((NOTE_TO_INDEX[openNote] + fret) % 12) }; }) })), chordTones: [...toneIndexes].sort((left, right) => left - right).map((index) => NOTE_NAMES[index]), scaleSuggestions: scaleNames };
}

export function scoreSongReadiness(input: Pick<SongReadinessCheck, "sleep" | "workload" | "handFatigue">): Pick<SongReadinessCheck, "score" | "suggestion"> {
  const score = ({ rested: 40, okay: 28, tired: 16 }[input.sleep] ?? 16) + ({ light: 30, typical: 23, heavy: 12 }[input.workload] ?? 12) + ({ none: 30, some: 18, high: 6 }[input.handFatigue] ?? 6);
  return { score, suggestion: score < 55 ? "light" : score < 78 ? "normal" : "focused" };
}

export function addReadinessCheck(state: SongLibraryState, input: Omit<SongReadinessCheck, "id" | "createdAt" | "score" | "suggestion">): SongLibraryState {
  const result = scoreSongReadiness(input);
  const item = { ...input, ...result, id: `readiness-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), handFatigueNote: input.handFatigueNote?.slice(0, 240) };
  return { ...state, readinessHistory: [item, ...state.readinessHistory].slice(0, STATE_LIMITS.readinessHistory) };
}

export function resolveSetlistSongVersion(song: LibrarySong, entry: SongSetlistEntry): { variation: SongVariation; capo: number; tuningId: string; tempo: number; simplifiedFallback: boolean; notes?: string } {
  const variation = song.variations.find((item) => item.id === entry.variationId) ?? song.variations[0];
  const override = entry.performance ?? {};
  return { variation, capo: override.capo ?? entry.capo ?? variation.capo, tuningId: override.tuningId ?? entry.tuningId ?? variation.tuningId, tempo: override.tempo ?? variation.bpm, simplifiedFallback: override.simplifiedFallback ?? false, notes: override.notes ?? entry.changeNotes };
}

export function updateSetlistPerformance(state: SongLibraryState, setlistId: string, songId: string, performance: SongPerformanceOverride): SongLibraryState {
  const clean = Object.fromEntries(Object.entries(performance).filter(([, value]) => value !== undefined)) as SongPerformanceOverride;
  return { ...state, setlists: state.setlists.map((setlist) => setlist.id !== setlistId ? setlist : { ...setlist, updatedAt: new Date().toISOString(), entries: setlist.entries.map((entry) => entry.songId !== songId ? entry : { ...entry, performance: { ...entry.performance, ...clean, notes: clean.notes?.slice(0, 400) } }) }) };
}

export function addSectionBookmark(state: SongLibraryState, input: Omit<SongSectionBookmark, "id" | "createdAt" | "updatedAt">, now = new Date().toISOString()): SongLibraryState {
  const bookmark: SongSectionBookmark = { ...input, id: `bookmark-${crypto.randomUUID()}`, label: input.label.trim().slice(0, 80) || "Bookmark", note: input.note?.trim().slice(0, 400), marker: input.marker ? { ...input.marker, measure: input.marker.measure ? Math.max(1, Math.min(9999, Math.round(input.marker.measure))) : undefined, chord: input.marker.chord?.trim().slice(0, 32), lyric: input.marker.lyric?.trim().slice(0, 160) } : undefined, createdAt: now, updatedAt: now };
  return { ...state, sectionBookmarks: [bookmark, ...state.sectionBookmarks].slice(0, STATE_LIMITS.sectionBookmarks) };
}
export function updateSectionBookmark(state: SongLibraryState, bookmarkId: string, patch: Partial<Pick<SongSectionBookmark, "label" | "note" | "marker">>, now = new Date().toISOString()): SongLibraryState {
  return { ...state, sectionBookmarks: state.sectionBookmarks.map((bookmark) => bookmark.id !== bookmarkId ? bookmark : { ...bookmark, ...patch, label: patch.label?.trim().slice(0, 80) ?? bookmark.label, note: patch.note?.trim().slice(0, 400) ?? bookmark.note, updatedAt: now }) };
}
export function deleteSectionBookmark(state: SongLibraryState, bookmarkId: string): SongLibraryState { return { ...state, sectionBookmarks: state.sectionBookmarks.filter((bookmark) => bookmark.id !== bookmarkId) }; }
export function bookmarksForSong(state: SongLibraryState, songId: string): SongSectionBookmark[] { return state.sectionBookmarks.filter((bookmark) => bookmark.songId === songId).slice(0, 64); }

const KNOWN_SONG_VOICINGS: Record<SongVoicingMode, Set<string>> = {
  open: new Set(["C", "D", "E", "G", "A", "Am", "Dm", "Em", "E7", "A7", "D7", "G7"]),
  barre: new Set(["F", "F#", "Bb", "B", "Bm", "C#m", "Fm", "Gm"]),
  "partial-barre": new Set(["Cmaj7", "A7", "D7", "E7", "B7", "Fmaj7"]),
  simplified: new Set(["C", "D", "E", "G", "A", "Am", "Dm", "Em", "F", "B7"]),
};
export function knownSongChordVoicings(song: LibrarySong, mode: SongVoicingMode): string[] { return [...new Set(songChords(song).map((chord) => chord.trim()))].filter((chord) => KNOWN_SONG_VOICINGS[mode].has(chord)).slice(0, 24); }
export function setSongVoicingPreference(state: SongLibraryState, input: Omit<SongVoicingPreference, "updatedAt">, now = new Date().toISOString()): SongLibraryState {
  const preference = { ...input, updatedAt: now }; const key = (item: SongVoicingPreference) => `${item.songId}:${item.variationId ?? ""}`;
  return { ...state, voicingPreferences: [...state.voicingPreferences.filter((item) => key(item) !== key(preference)), preference].slice(0, STATE_LIMITS.voicingPreferences) };
}
export function getSongVoicingPreference(state: SongLibraryState, songId: string, variationId?: string): SongVoicingMode { return state.voicingPreferences.find((item) => item.songId === songId && item.variationId === variationId)?.mode ?? state.voicingPreferences.find((item) => item.songId === songId && !item.variationId)?.mode ?? "simplified"; }

export function upsertSongEquipmentNotes(state: SongLibraryState, input: Omit<SongEquipmentNotes, "updatedAt">, now = new Date().toISOString()): SongLibraryState {
  const notes = { ...input, instrument: input.instrument?.trim().slice(0, 120), pickup: input.pickup?.trim().slice(0, 240), effects: input.effects?.trim().slice(0, 240), microphone: input.microphone?.trim().slice(0, 240), backingTrackMix: input.backingTrackMix?.trim().slice(0, 240), updatedAt: now };
  return { ...state, equipmentNotes: [...state.equipmentNotes.filter((item) => item.songId !== input.songId), notes].slice(0, STATE_LIMITS.equipmentNotes) };
}

export function upsertSongRecordingTarget(state: SongLibraryState, input: Omit<SongRecordingTarget, "updatedAt">, now = new Date().toISOString()): SongLibraryState {
  const target = { ...input, targetBpm: input.targetBpm === undefined ? undefined : clampTempo(input.targetBpm), referenceLabel: input.referenceLabel?.trim().slice(0, 160), updatedAt: now };
  return { ...state, recordingTargets: [...state.recordingTargets.filter((item) => !(item.songId === input.songId && item.variationId === input.variationId)), target].slice(0, STATE_LIMITS.recordingTargets) };
}
export type SongRecordingComparison = { targetBpm?: number; observedBpm?: number; tempoDifferenceBpm?: number; timingDifferencePercent?: number; recordingId?: string; heuristic: string };
export function compareSongRecordingToTarget(state: SongLibraryState, songId: string, variationId?: string): SongRecordingComparison {
  const target = state.recordingTargets.find((item) => item.songId === songId && item.variationId === variationId) ?? state.recordingTargets.find((item) => item.songId === songId && !item.variationId);
  const recording = [...state.recordings].filter((item) => item.songId === songId && !item.archivedAt).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (!target || !recording) return { targetBpm: target?.targetBpm, recordingId: recording?.id, heuristic: "Set a target and keep a local recording with analysis metadata to compare." };
  const observedBpm = recording.tempoBpm ?? (target.targetBpm && recording.tempoDriftPercent !== undefined ? target.targetBpm * (1 + recording.tempoDriftPercent / 100) : undefined);
  return { targetBpm: target.targetBpm, observedBpm: observedBpm === undefined ? undefined : Math.round(observedBpm * 10) / 10, tempoDifferenceBpm: target.targetBpm !== undefined && observedBpm !== undefined ? Math.round((observedBpm - target.targetBpm) * 10) / 10 : undefined, timingDifferencePercent: recording.timingConsistencyPercent === undefined ? undefined : Math.round((100 - recording.timingConsistencyPercent) * 10) / 10, recordingId: recording.id, heuristic: "Heuristic: uses stored recording tempo/drift and timing-consistency metadata; it is not a waveform-to-reference match." };
}

export type SongAuditionPrompt = { songId: string; sectionId: string; title: string; answer: string; revealed: boolean };
export function createAuditionPrompt(song: LibrarySong, seed = 0): SongAuditionPrompt | undefined {
  const sections = song.sections.slice(0, 64); if (!sections.length) return undefined;
  const section = sections[Math.abs(Math.round(seed)) % sections.length]; const chords = section.blocks.flatMap((block) => block.type === "chords" ? block.chords ?? [] : []);
  return { songId: song.id, sectionId: section.id, title: section.title, answer: chords.slice(0, 8).join(" · ") || "No stored chord answer", revealed: false };
}
export function revealAuditionPrompt(prompt: SongAuditionPrompt): SongAuditionPrompt { return { ...prompt, revealed: true }; }
export function recordAuditionAnswer(state: SongLibraryState, sessionId: string, correct: boolean, now = new Date().toISOString()): SongLibraryState {
  return { ...state, auditionSessions: state.auditionSessions.map((session) => session.id !== sessionId ? session : { ...session, answered: Math.min(64, session.answered + 1), correct: Math.min(64, session.correct + (correct ? 1 : 0)), completedAt: session.answered + 1 >= session.sectionIds.length ? now : session.completedAt }) };
}

export const PRACTICE_TIME_TEMPLATES = [5, 15, 30, 60] as const;
export function buildPracticeTemplateQueue(state: SongLibraryState, songs: LibrarySong[], minutes: typeof PRACTICE_TIME_TEMPLATES[number], now = Date.now()): SongPracticeQueue {
  const limit = minutes === 5 ? 2 : minutes === 15 ? 4 : minutes === 30 ? 7 : 10; const debt = derivePracticeDebt(state, songs, now); const due = debt.filter((item) => item.overdueReviews > 0); const weak = debt.filter((item) => item.score >= 45); const fresh = songs.filter((song) => !state.practiceProgress.some((progress) => progress.songId === song.id)).slice(0, 500);
  const ordered = [...due, ...weak, ...fresh.map((song) => debt.find((item) => item.songId === song.id)).filter((item): item is SongPracticeDebt => Boolean(item)), ...debt].filter((item, index, all) => all.findIndex((candidate) => candidate.songId === item.songId) === index).slice(0, limit);
  const songIds = ordered.map((item) => item.songId); const stamp = new Date(now).toISOString();
  return { id: `queue-template-${minutes}`, name: `${minutes}-minute due-first practice`, songIds, createdAt: stamp, updatedAt: stamp, targetDurationMinutes: minutes };
}

export type PreShowSong = { index: number; title: string; stageInfo: string; checklist: string[]; arrangement: string };
export type PreShowView = { setlistId: string; name: string; totalMinutes: number; songs: PreShowSong[]; emergencyPlan: string };
export function buildPreShowView(state: SongLibraryState, setlist: SongSetlist, songs: LibrarySong[]): PreShowView {
  const timeline = estimateSetlistTimeline(setlist, songs); const setlistChecklist = state.rehearsalChecklists.slice(0, 50).flatMap((checklist) => { const progress = state.checklistProgress.find((item) => item.checklistId === checklist.id && item.setlistId === setlist.id); return checklist.items.slice(0, 32).filter((item) => !progress?.checkedItemIds.includes(item.id)).map((item) => item.label); }).slice(0, 32);
  return { setlistId: setlist.id, name: setlist.name, totalMinutes: timeline.totalMinutes, songs: setlist.entries.slice(0, 100).map((entry, index) => { const song = songs.find((item) => item.id === entry.songId); const resolved = song ? resolveSetlistSongVersion(song, entry) : undefined; return { index: index + 1, title: song?.title ?? "Missing song", stageInfo: resolved ? `${resolved.tempo} BPM · capo ${resolved.capo} · ${resolved.tuningId}${resolved.notes ? ` · ${resolved.notes}` : ""}` : "Resolve arrangement", checklist: [entry.changeNotes, resolved?.notes].filter((value): value is string => Boolean(value)).slice(0, 4), arrangement: resolved?.simplifiedFallback ? "Simplified fallback ready" : "Use selected arrangement; simplify only if needed" }; }), emergencyPlan: "If a section drops out, keep the pulse, use the simplified arrangement, and re-enter at the next marked section." };
}

export type SongWarmup = { id: string; transition: string; instruction: string; repetitions: number; tempo: number };
export function deriveTransitionWarmups(items: ChordTransitionHeatmapItem[], bpm = 60): SongWarmup[] {
  return items.slice(0, 8).map((item, index) => ({ id: `warmup-${item.from}-${item.to}-${index}`, transition: item.label, instruction: `Place ${item.from}, release gently, then land ${item.to} on a slow count. Keep the motion small.`, repetitions: Math.max(4, Math.min(12, Math.round(item.difficulty / 10))), tempo: Math.max(40, Math.min(140, Math.round(bpm * (item.difficulty > 70 ? 0.65 : 0.8)))) }));
}

export function buildRotationQueue(state: SongLibraryState, songs: LibrarySong[], queueName = "Rotation · neglected first"): { queue: SongPracticeQueue; explanation: string } {
  const now = Date.now();
  const scored = songs.map((song) => {
    const progress = state.practiceProgress.find((item) => item.songId === song.id);
    const daysSince = progress?.lastPracticedAt ? Math.max(0, (now - Date.parse(progress.lastPracticedAt)) / 86400000) : 90;
    const recentPenalty = state.recentSongIds.includes(song.id) ? 35 : 0;
    const favoritePenalty = state.favorites.includes(song.id) ? 18 : 0;
    const frequencyPenalty = Math.min(28, (progress?.practiceCount ?? 0) * 2);
    return { id: song.id, score: Math.min(100, Math.round(daysSince + 55 - recentPenalty - favoritePenalty - frequencyPenalty)) };
  }).sort((left, right) => right.score - left.score);
  const ids = scored.slice(0, 10).map((item) => item.id);
  return { queue: { id: `queue-rotation-${Date.now()}`, name: queueName, songIds: ids, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), targetDurationMinutes: Math.max(10, ids.length * 7) }, explanation: "Neglected and never-practiced songs rise to the top. Recently practiced, frequently practiced, and favorite songs are still eligible but are gently deprioritized." };
}

export type SongRetentionEstimate = { metadataBytes: number; recordingReferenceBytes: number; estimatedAudioBytes: number; videoReferenceBytes: number; archivedMetadataBytes: number; audioCount: number; videoCount: number; suggestion: string };
export function estimateSongLibraryRetention(state: SongLibraryState): SongRetentionEstimate {
  const recordingReferenceBytes = state.recordings.reduce((sum, recording) => sum + JSON.stringify(recording).length * 2, 0);
  const estimatedAudioBytes = state.recordings.reduce((sum, recording) => sum + Math.max(1000, recording.durationMs * 16), 0);
  const videoReferenceBytes = state.videoReferences.reduce((sum, reference) => sum + JSON.stringify(reference).length * 2, 0);
  const metadataBytes = JSON.stringify({ ...state, recordings: [], videoReferences: [] }).length * 2 + recordingReferenceBytes + videoReferenceBytes;
  const archivedMetadataBytes = state.recordings.filter((recording) => recording.archivedAt).reduce((sum, recording) => sum + JSON.stringify(recording).length * 2, 0) + state.videoReferences.filter((reference) => state.archivedSongIds.includes(reference.songId)).reduce((sum, reference) => sum + JSON.stringify(reference).length * 2, 0);
  return { metadataBytes, recordingReferenceBytes, estimatedAudioBytes, videoReferenceBytes, archivedMetadataBytes, audioCount: state.recordings.length, videoCount: state.videoReferences.length, suggestion: archivedMetadataBytes ? "Review archived metadata first. Deleting a reference does not delete an audio file unless you explicitly confirm that separate action." : "No archived metadata is currently eligible for cleanup." };
}

export function archiveDraft(state: SongLibraryState, draftId: string, archived = true): SongLibraryState {
  return { ...state, drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, archivedAt: archived ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() } : draft) };
}

export function deleteDraft(state: SongLibraryState, draftId: string): SongLibraryState { return { ...state, drafts: state.drafts.filter((draft) => draft.id !== draftId) }; }
export function captureSongDraft(state: SongLibraryState, input: Pick<SongDraft, "title" | "artist" | "idea" | "chordIdeas">): SongLibraryState {
  const now = new Date().toISOString();
  const draft = { ...input, id: `draft-${crypto.randomUUID()}`, title: input.title.trim().slice(0, 120), artist: input.artist?.trim().slice(0, 120), idea: input.idea.trim().slice(0, 2000), chordIdeas: input.chordIdeas.slice(0, 32).map((chord) => chord.trim().slice(0, 24)).filter(Boolean), createdAt: now, updatedAt: now };
  return { ...state, drafts: [draft, ...state.drafts].slice(0, STATE_LIMITS.drafts) };
}

export function addJournalEntry(state: SongLibraryState, input: Omit<SongPracticeJournalEntry, "id" | "createdAt">): SongLibraryState {
  const entry = { ...input, id: `journal-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), improvement: input.improvement.slice(0, 1200), breakdown: input.breakdown.slice(0, 1200), nextStep: input.nextStep?.slice(0, 800) };
  return { ...state, journalEntries: [entry, ...state.journalEntries].slice(0, STATE_LIMITS.journalEntries) };
}

export function addSongAssignment(state: SongLibraryState, input: Omit<SongAssignment, "id" | "createdAt" | "updatedAt">): SongLibraryState {
  const now = new Date().toISOString();
  const assignment = { ...input, id: `assignment-${crypto.randomUUID()}`, createdAt: now, updatedAt: now, feedback: input.feedback?.slice(0, 1200) };
  return { ...state, assignments: [assignment, ...state.assignments].slice(0, STATE_LIMITS.assignments) };
}

export function addAssignmentComment(state: SongLibraryState, input: Omit<SongAssignmentComment, "id" | "createdAt">): SongLibraryState {
  const comment = { ...input, id: `assignment-comment-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), body: input.body.slice(0, 1200) };
  return { ...state, assignmentComments: [comment, ...state.assignmentComments].slice(0, STATE_LIMITS.assignmentComments) };
}

export function visibleAssignmentComments(state: SongLibraryState, assignmentId: string, role: SongLibraryRole): SongAssignmentComment[] {
  const canSeePrivate = role === "owner" || role === "editor";
  return state.assignmentComments.filter((comment) => comment.assignmentId === assignmentId && (comment.visibility === "shared" || canSeePrivate));
}

export function formatSongLibraryBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

export function serializeSetlistExport(setlist: SongSetlist, songs: LibrarySong[], format: "setlist" | "lyrics" | "changeover"): string {
  if (format === "changeover") return [`${setlist.name} · Changeover checklist`, "", ...setlist.entries.map((entry, index) => { const song = songs.find((item) => item.id === entry.songId); const resolved = song ? resolveSetlistSongVersion(song, entry) : undefined; return `${index + 1}. ${song?.title ?? "Missing song"} — ${resolved?.tuningId ?? entry.tuningId ?? "standard"}, capo ${resolved?.capo ?? entry.capo ?? 0}${resolved?.tempo ? `, ${resolved.tempo} BPM` : ""}${resolved?.notes ? ` · ${resolved.notes}` : ""}`; })].join("\n");
  if (format === "lyrics") return setlist.entries.map((entry) => { const song = songs.find((item) => item.id === entry.songId); if (!song) return ""; const resolved = resolveSetlistSongVersion(song, entry); return [`### ${song.title} · ${song.artist}`, `Capo ${resolved.capo} · ${resolved.tuningId} · ${resolved.tempo} BPM`, ...song.sections.flatMap((section) => [``, section.title, ...section.blocks.flatMap((block) => block.type === "lyrics" ? [block.text ?? ""] : block.type === "chords" ? [`Chords: ${(block.chords ?? []).join(" ")}`] : block.type === "tab" ? (block.lines ?? []) : [])])].join("\n"); }).join("\n\n");
  return [`${setlist.name} · Setlist`, "", ...setlist.entries.map((entry, index) => { const song = songs.find((item) => item.id === entry.songId); const resolved = song ? resolveSetlistSongVersion(song, entry) : undefined; return `${index + 1}. ${song?.title ?? "Missing song"} · ${resolved?.tempo ?? song?.bpm ?? "?"} BPM · capo ${resolved?.capo ?? 0}${resolved?.tuningId ? ` · ${resolved.tuningId}` : ""}`; })].join("\n");
}

export function songText(song: LibrarySong): string {
  return song.sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => [block.text ?? "", ...(block.lines ?? []), ...(block.chords ?? [])])]).join(" ");
}

export function matchesSongFilters(
  song: LibrarySong,
  filters: { query: string; difficulty: string; key: string; meter: string; technique: string; libraryId: string; instrument?: string; tagGroup?: keyof SongTagGroups; tagValue?: string },
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
  if (filters.tagGroup && filters.tagValue && filters.tagValue !== "All" && !(song.tagGroups?.[filters.tagGroup] ?? []).includes(filters.tagValue)) return false;
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
    : { songId, variationId, sectionsCompleted: [], practiceCount: 1, lastPracticedAt: now, sectionMastery: {}, sectionConfidence: {}, confidence: 0, sectionReviews: {}, streakDays: 1 };
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

export function rolePermissions(role: SongLibraryRole): { canEditSongs: boolean; canComment: boolean; canArrange: boolean; canManageSetlists: boolean; canSchedule: boolean; canManageAssignments: boolean; canCommentAssignments: boolean; canEditAssignmentFeedback: boolean } {
  return { canEditSongs: role === "owner" || role === "editor" || role === "arranger", canComment: role !== "viewer", canArrange: role === "owner" || role === "editor" || role === "arranger", canManageSetlists: role === "owner" || role === "editor" || role === "setlist-manager", canSchedule: role === "owner" || role === "editor" || role === "setlist-manager", canManageAssignments: role === "owner" || role === "editor", canCommentAssignments: role !== "viewer", canEditAssignmentFeedback: role === "owner" || role === "editor" };
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
  const dueSongIds = [...new Set(dueSectionReviews(state, songs, now).map((item) => item.songId))];
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
  const buckets = [scored.filter((item) => dueSongIds.includes(item.song.id)), scored.filter((item) => item.score >= 40), scored.filter((item) => !state.practiceProgress.some((progress) => progress.songId === item.song.id)), scored.filter((item) => item.nextReview > 0 && item.nextReview <= now)];
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
