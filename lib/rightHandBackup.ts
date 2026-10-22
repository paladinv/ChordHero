import { RIGHT_HAND_EXERCISES, type RightHandTechnique } from "./rightHandExercises";
import { validRightHandPattern } from "./rightHandPracticeRuntime";
import type { ExerciseProgress } from "./rightHandPracticeRuntime";
import type { CustomRightHandRoutine, PracticePlatformState, PracticeResult } from "./practicePlatform";

export const RIGHT_HAND_BACKUP_LIMIT = 1_000_000;
export const RIGHT_HAND_RESTORE_FLAG = "chord-hero:right-hand:restore-pending";
export const RIGHT_HAND_BACKUP_KEYS = {
  progress: "chord-hero:right-hand:progress", library: "chord-hero:right-hand:personal-library:v1",
  layout: "chord-hero:right-hand:layout:v1", settings: "chord-hero:right-hand:settings",
  modes: "chord-hero:right-hand:practice-modes:v1", setup: "chord-hero:right-hand:guitar-setup:v1",
  session: "chord-hero:right-hand:session:v1"
} as const;
type Playlist = { id: string; name: string; exerciseIds: string[] };
type Library = { bookmarks: string[]; playlists: Playlist[]; notes: Record<string, string> };
type Preferences = { layout?: "beginner" | "advanced"; settings?: Record<string, string | number | boolean>; modes?: Record<string, string | number | boolean>; setup?: Record<string, string | number>; session?: { version: 1; exerciseId: string; bpm: number; loop: null; lessonStep: number } };
export type RightHandBackup = { schema: "chord-hero-right-hand-backup-v1"; exportedAt: string; progress: Record<string, ExerciseProgress>; library: Library; routines: CustomRightHandRoutine[]; history: PracticeResult[]; preferences: Preferences };
const exerciseIds = new Set(RIGHT_HAND_EXERCISES.map((exercise) => exercise.id));
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max ? value : undefined;
const date = (value: unknown) => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : undefined;
const list = (value: unknown, max: number): unknown[] => { if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid or oversized list (maximum ${max}).`); return value; };
const enumValue = (value: unknown, allowed: readonly unknown[]) => allowed.includes(value) ? value as string | number | boolean : undefined;
function selectedFields(value: unknown, fields: Record<string, readonly unknown[]>, ranges: Record<string, readonly [number, number]> = {}) {
  const source = object(value); const result: Record<string, string | number | boolean> = {};
  for (const [key, allowed] of Object.entries(fields)) {
    const clean = enumValue(source[key], allowed);
    if (clean !== undefined) result[key] = clean;
  }
  for (const [key, [min, max]] of Object.entries(ranges)) { const clean = number(source[key], min, max); if (clean !== undefined) result[key] = clean; }
  return result;
}
function preferences(value: unknown): Preferences {
  const source = object(value); const result: Preferences = {};
  if (source.layout === "beginner" || source.layout === "advanced") result.layout = source.layout;
  const settings = selectedFields(source.settings, { roundSeconds: [0, 30, 60, 120, 180], soundMode: ["click", "guitar", "both", "silent"], progressionId: ["off", "gcd", "pop-g", "pop-c", "blues-a", "custom"], stylePreset: ["neutral", "reggae", "funk", "shuffle", "bluegrass", "bossa", "travis"], autoRamp: [true, false], rampAmount: [2, 4, 6], clickFeel: ["straight", "swing"], accentMode: ["downbeat", "two-four", "pattern"], silentEvery: [0, 4, 8], ladderRequiredRounds: [2, 3, 4], challengeMode: ["standard", "sustain", "ladder", "silent", "random"] });
  const custom = object(source.settings).customProgression;
  if (typeof custom === "string" && custom.length <= 120 && /^[A-Ga-g0-9#bmijansup,\s-]*$/.test(custom)) settings.customProgression = custom;
  if (Object.keys(settings).length) result.settings = settings;
  const modes = selectedFields(source.modes, { targetSound: ["acoustic-strum", "muted-funk", "fingerstyle", "clean-electric"], demoSpeed: [1, .75, .5], noLook: [true, false], performanceMode: [true, false], focus: ["rhythm", "strings", "muting"], dynamics: ["even", "accent-map", "backbeat", "crescendo"], ghostStrum: [true, false], anticipation: ["full", "adaptive", "hidden"] }, { clickMix: [0, 100], guitarMix: [0, 100], contextMix: [0, 100] });
  if (Object.keys(modes).length) result.modes = modes;
  const setup = selectedFields(source.setup, { pick: ["fingers", "thin", "medium", "heavy"], strings: [6, 7, 12], tuning: ["standard", "drop-d", "dadgad"], guitar: ["acoustic", "electric"] });
  if (Object.keys(setup).length) result.setup = setup as Record<string, string | number>;
  const session = object(source.session);
  if (session.version === 1 && typeof session.exerciseId === "string" && exerciseIds.has(session.exerciseId) && number(session.bpm, 40, 180) !== undefined) result.session = { version: 1, exerciseId: session.exerciseId, bpm: Math.round(session.bpm as number), loop: null, lessonStep: 0 };
  return result;
}
function progress(value: unknown) {
  const source = object(value); if (Object.keys(source).length > RIGHT_HAND_EXERCISES.length) throw new Error("Too many exercise progress entries.");
  const result: Record<string, ExerciseProgress> = {};
  for (const [id, raw] of Object.entries(source)) {
    if (!exerciseIds.has(id)) throw new Error(`Unknown exercise: ${id.slice(0, 80)}.`);
    const item = object(raw); const core = [number(item.bestBpm, 0, 180), number(item.sessions, 0, 1_000_000), number(item.cleanSessions, 0, 1_000_000), number(item.totalSeconds, 0, 1_000_000_000)];
    if (core.some((field) => field === undefined) || typeof item.lastPracticed !== "string" || item.lastPracticed.length > 40) throw new Error("Invalid exercise progress.");
    const entry: ExerciseProgress = { bestBpm: core[0]!, sessions: Math.floor(core[1]!), cleanSessions: Math.min(Math.floor(core[1]!), Math.floor(core[2]!)), totalSeconds: Math.floor(core[3]!), lastPracticed: date(item.lastPracticed) ?? "" };
    const ranges = { cleanStreak: [0, 1_000_000], bestTimingScore: [0, 100], goalTargetBpm: [40, 180], goalRequiredRounds: [1, 100], goalRoundsAtTarget: [0, 100], goalTimingScore: [50, 100], goalPracticeMinutes: [1, 120], ladderStage: [0, 1_000_000] } as const;
    for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) { const [min, max] = ranges[key]; const clean = number(item[key], min, max); if (clean !== undefined) entry[key] = clean; }
    if (Array.isArray(item.recentMisses)) entry.recentMisses = item.recentMisses.filter((step): step is number => number(step, 0, 63) !== undefined).slice(0, 8);
    result[id] = entry;
  }
  return result;
}
function library(value: unknown): Library {
  const source = object(value);
  const bookmarks = list(source.bookmarks ?? [], 80).filter((id): id is string => typeof id === "string" && exerciseIds.has(id));
  const playlists = list(source.playlists ?? [], 12).map((raw) => {
    const item = object(raw); const id = text(item.id, 80), name = text(item.name, 48);
    if (!id || !name?.trim()) throw new Error("Invalid playlist.");
    return { id, name, exerciseIds: list(item.exerciseIds, 24).filter((exerciseId): exerciseId is string => typeof exerciseId === "string" && exerciseIds.has(exerciseId)) };
  });
  const notes = Object.fromEntries(Object.entries(object(source.notes)).filter(([id, note]) => exerciseIds.has(id) && text(note, 240) !== undefined)) as Record<string, string>;
  return { bookmarks: [...new Set(bookmarks)], playlists, notes };
}
function routines(value: unknown): CustomRightHandRoutine[] {
  return list(value, 80).map((raw) => {
    const item = object(raw); const id = text(item.id, 80), title = text(item.title, 80), createdAt = date(item.createdAt), bpm = number(item.bpm, 40, 180);
    if (!id || !title?.trim() || !createdAt || bpm === undefined || !["strumming", "plectrum", "fingerpicking"].includes(String(item.technique))) throw new Error("Invalid saved routine.");
    const pattern = list(item.pattern, 32);
    const technique = item.technique as RightHandTechnique;
    if (!pattern.every((token): token is string => typeof token === "string") || !validRightHandPattern(pattern as string[], technique)) throw new Error("Invalid routine pattern tokens.");
    return { id, title, createdAt, bpm, technique, pattern: pattern as string[] };
  });
}
function history(value: unknown): PracticeResult[] {
  return list(value, 500).map((raw) => {
    const item = object(raw); const id = text(item.id, 100), itemId = text(item.itemId, 80), practisedAt = date(item.practisedAt), seconds = number(item.seconds, 0, 86400);
    if (!id || !itemId || !exerciseIds.has(itemId) || !practisedAt || seconds === undefined || item.area !== "rightHand") throw new Error("Invalid Right Hand practice history.");
    const exercise = RIGHT_HAND_EXERCISES.find((entry) => entry.id === itemId)!;
    const result: PracticeResult = { id, area: "rightHand", itemId, title: exercise.title, practisedAt, seconds, note: "Imported practice summary; original recordings stay on the source device." };
    const score = number(item.score, 0, 100), tempo = number(item.tempo, 40, 180), misses = number(item.misses, 0, 10000);
    if (score !== undefined) result.score = score;
    if (tempo !== undefined) result.tempo = tempo;
    if (misses !== undefined) result.misses = misses;
    if (typeof item.reviewAccepted === "boolean") result.reviewAccepted = item.reviewAccepted;
    return result;
  });
}
export function validateRightHandBackup(value: unknown): RightHandBackup {
  const source = object(value);
  if (source.schema !== "chord-hero-right-hand-backup-v1" || !date(source.exportedAt)) throw new Error("Choose a Chord Hero Right Hand v1 backup.");
  return { schema: source.schema, exportedAt: source.exportedAt as string, progress: progress(source.progress), library: library(source.library), routines: routines(source.routines), history: history(source.history), preferences: preferences(source.preferences) };
}
export function parseRightHandBackup(json: string) {
  if (new TextEncoder().encode(json).byteLength > RIGHT_HAND_BACKUP_LIMIT) throw new Error("Backup exceeds the 1 MB limit.");
  return validateRightHandBackup(JSON.parse(json));
}
export function createRightHandBackup(storage: Pick<Storage, "getItem">, state: PracticePlatformState): RightHandBackup {
  const read = (key: string, fallback: unknown) => { try { return JSON.parse(storage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } };
  return validateRightHandBackup({ schema: "chord-hero-right-hand-backup-v1", exportedAt: new Date().toISOString(), progress: read(RIGHT_HAND_BACKUP_KEYS.progress, {}), library: read(RIGHT_HAND_BACKUP_KEYS.library, {}), routines: state.customRoutines, history: state.events.filter((event) => event.area === "rightHand"), preferences: { layout: storage.getItem(RIGHT_HAND_BACKUP_KEYS.layout), settings: read(RIGHT_HAND_BACKUP_KEYS.settings, {}), modes: read(RIGHT_HAND_BACKUP_KEYS.modes, {}), setup: read(RIGHT_HAND_BACKUP_KEYS.setup, {}), session: read(RIGHT_HAND_BACKUP_KEYS.session, {}) } });
}
export function mergeRightHandBackup(backup: RightHandBackup, local: RightHandBackup, state: PracticePlatformState, applyPreferences: boolean) {
  const mergedProgress = { ...local.progress };
  for (const [id, incoming] of Object.entries(backup.progress)) {
    const existing = mergedProgress[id];
    if (!existing) { mergedProgress[id] = incoming; continue; }
    const newer = Date.parse(incoming.lastPracticed) > Date.parse(existing.lastPracticed) ? incoming : existing;
    mergedProgress[id] = { ...existing, ...newer, bestBpm: Math.max(existing.bestBpm, incoming.bestBpm), sessions: Math.max(existing.sessions, incoming.sessions), cleanSessions: Math.max(existing.cleanSessions, incoming.cleanSessions), totalSeconds: Math.max(existing.totalSeconds, incoming.totalSeconds), bestTimingScore: Math.max(existing.bestTimingScore ?? 0, incoming.bestTimingScore ?? 0) || undefined };
  }
  const mergeById = <T extends { id: string }>(incoming: T[], existing: T[]) => { const ids = new Set(existing.map((item) => item.id)); const result = [...existing]; for (const item of incoming) if (!ids.has(item.id)) { result.push(item); ids.add(item.id); } return result; };
  const outside = state.events.filter((event) => event.area !== "rightHand");
  const outsideIds = new Set(outside.map((event) => event.id));
  const capacity = Math.max(0, 500 - outside.length);
  const rightHand = capacity ? mergeById(backup.history.filter((event) => !outsideIds.has(event.id)), state.events.filter((event) => event.area === "rightHand")).sort((a, b) => a.practisedAt.localeCompare(b.practisedAt)).slice(-capacity) : [];
  const playlistMap = mergeById(backup.library.playlists, local.library.playlists).slice(0, 12);
  return {
    storage: { [RIGHT_HAND_BACKUP_KEYS.progress]: JSON.stringify(mergedProgress), [RIGHT_HAND_BACKUP_KEYS.library]: JSON.stringify({ bookmarks: [...new Set([...local.library.bookmarks, ...backup.library.bookmarks])].slice(0, 80), playlists: playlistMap, notes: { ...backup.library.notes, ...local.library.notes } }), ...(applyPreferences ? Object.fromEntries(Object.entries(backup.preferences).map(([key, value]) => [RIGHT_HAND_BACKUP_KEYS[key as keyof Preferences], typeof value === "string" ? value : JSON.stringify(value)])) : {}) } as Record<string, string>,
    state: { ...state, events: [...outside, ...rightHand].sort((a, b) => a.practisedAt.localeCompare(b.practisedAt)), customRoutines: mergeById(backup.routines, state.customRoutines).slice(0, 80) }
  };
}
