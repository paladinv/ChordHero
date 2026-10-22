import type { LibrarySong, SongLibraryState } from "./songLibrary";

export type SongCare = { songId: string; fields: Record<string, string>; locked: boolean; vocalLow?: number; vocalHigh?: number; privateNote: string; sharedNote: string; updatedAt: string };
export type LibraryCareEvent = { id: string; kind: "rehearsal" | "gig"; date: string; title: string; note?: string };
export type LibraryHealthAcknowledgement = { songId: string; issue: string; note: string; acknowledgedAt: string };
export type LibraryCare = { songs: SongCare[]; attendance: { id: string; date: string; name: string; present: boolean }[]; changes: { id: string; songId: string; date: string; summary: string }[]; events: LibraryCareEvent[]; healthAcknowledgements: LibraryHealthAcknowledgement[] };
export const emptyLibraryCare = (): LibraryCare => ({ songs: [], attendance: [], changes: [], events: [], healthAcknowledgements: [] });
const text = (value: unknown, max = 800) => typeof value === "string" ? value.slice(0, max) : "";
export function normalizeLibraryCare(value: unknown): LibraryCare {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<LibraryCare>;
  return {
    songs: (Array.isArray(raw.songs) ? raw.songs : []).filter(Boolean).slice(0, 500).map(s => ({ songId: text(s.songId, 160), fields: Object.fromEntries(Object.entries(s.fields ?? {}).slice(0, 20).map(([k,v]) => [k.slice(0, 60), text(v, 240)])), locked: s.locked === true, vocalLow: Number.isFinite(s.vocalLow) ? s.vocalLow : undefined, vocalHigh: Number.isFinite(s.vocalHigh) ? s.vocalHigh : undefined, privateNote: text(s.privateNote), sharedNote: text(s.sharedNote), updatedAt: text(s.updatedAt, 40) })),
    attendance: (Array.isArray(raw.attendance) ? raw.attendance : []).filter(Boolean).slice(0, 500).map(a => ({ id: text(a.id, 100), date: text(a.date, 40), name: text(a.name, 100), present: a.present === true })),
    changes: (Array.isArray(raw.changes) ? raw.changes : []).filter(Boolean).slice(0, 300).map(c => ({ id: text(c.id,100), songId: text(c.songId,160), date: text(c.date,40), summary: text(c.summary,400) })),
    events: (Array.isArray(raw.events) ? raw.events : []).filter(Boolean).slice(0, 200).flatMap(event => ["rehearsal", "gig"].includes(event.kind) && !Number.isNaN(Date.parse(event.date)) ? [{ id: text(event.id,100), kind: event.kind as LibraryCareEvent["kind"], date: text(event.date,40), title: text(event.title,160), note: text(event.note,240) }] : []),
    healthAcknowledgements: (Array.isArray(raw.healthAcknowledgements) ? raw.healthAcknowledgements : []).filter(Boolean).slice(0, 500).map(item => ({ songId: text(item.songId,160), issue: text(item.issue,240), note: text(item.note,240), acknowledgedAt: text(item.acknowledgedAt,40) })),
  };
}
export function updateSongCare(state: SongLibraryState, songId: string, patch: Partial<SongCare>, summary: string): SongLibraryState {
  const care = normalizeLibraryCare(state.libraryCare); const now = new Date().toISOString();
  const old = care.songs.find(s => s.songId === songId) ?? { songId, fields: {}, locked: false, privateNote: "", sharedNote: "", updatedAt: now };
  return { ...state, libraryCare: normalizeLibraryCare({ ...care, songs: [{ ...old, ...patch, songId, updatedAt: now }, ...care.songs.filter(s => s.songId !== songId)], changes: [{ id: crypto.randomUUID(), songId, date: now, summary }, ...care.changes] }) };
}
export function duplicatePairs(songs: LibrarySong[]): [LibrarySong, LibrarySong][] {
  const seen = new Map<string, LibrarySong>(); const pairs: [LibrarySong, LibrarySong][] = [];
  for (const song of songs) { const key = [song.title,song.artist].map(value=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")).join("|"); const first = seen.get(key); if (first) pairs.push([first, song]); else seen.set(key, song); } return pairs.slice(0, 50);
}
export function duplicateMergeCarryover(keep: LibrarySong, remove: LibrarySong, state: SongLibraryState) {
  const sections = remove.sections.filter(section => !keep.sections.some(existing => existing.id === section.id));
  const variations = remove.variations.filter(variation => !keep.variations.some(existing => existing.id === variation.id));
  const retainedCare=state.libraryCare?.songs.find(item=>item.songId===keep.id);const removedCare=state.libraryCare?.songs.find(item=>item.songId===remove.id);
  const addedFields=Object.entries(removedCare?.fields??{}).filter(([key])=>!Object.prototype.hasOwnProperty.call(retainedCare?.fields??{},key)).map(([key,value])=>key+": "+value);
  const records = [
    ["Recordings", state.recordings.filter(item => item.songId === remove.id).length],
    ["Annotations", state.annotations.filter(item => item.songId === remove.id).length],
    ["Bookmarks", state.sectionBookmarks.filter(item => item.songId === remove.id).length],
    ["Collaborator comments", state.comments.filter(item => item.songId === remove.id).length],
    ["Reference links", state.referenceLinks.filter(item => item.songId === remove.id).length],
    ["Video references", state.videoReferences.filter(item => item.songId === remove.id).length],
    ["Practice sessions", state.practiceSessions.filter(item => item.songId === remove.id).length],
    ["Journal entries", state.journalEntries.filter(item => item.songId === remove.id).length],
    ["Schedule items", state.scheduledItems.filter(item => item.kind === "song" && item.resourceId === remove.id).length],
    ["Setlist entries", state.setlists.reduce((count, setlist) => count + setlist.entries.filter(entry => entry.songId === remove.id).length, 0)],
    ["Queue memberships", state.practiceQueues.reduce((count, queue) => count + queue.songIds.filter(id => id === remove.id).length, 0)],
    ["Intentional health acknowledgements", state.libraryCare?.healthAcknowledgements.filter(item=>item.songId===remove.id).length??0],
  ] as const;
  return {
    sections,
    variations,
    addedTags: remove.tags.filter(tag => !keep.tags.includes(tag)),
    records,
    practiceCount: state.practiceProgress.filter(progress => progress.songId === remove.id).reduce((total, progress) => total + progress.practiceCount, 0),
    importedNotes: Boolean(remove.notes?.trim()),
    personalNotes: { private: Boolean(removedCare?.privateNote.trim()), shared: Boolean(removedCare?.sharedNote.trim()) },
    addedFields,
    compositionFrom: keep.composition ? keep.id : remove.composition ? remove.id : undefined,
    sourceKept: keep.sourceUrl || keep.source ? keep.sourceUrl ?? keep.source : remove.sourceUrl ?? remove.source,
    licenseKept: keep.license || remove.license,
  };
}
/** Keep media IDs intact; redirect references to the retained song. */
export function mergeDuplicateSongs(state: SongLibraryState, keep: LibrarySong, remove: LibrarySong): SongLibraryState {
  if (keep.id === remove.id) return state;
  if (state.libraryCare?.songs.some(s => s.locked && [keep.id, remove.id].includes(s.songId))) throw new Error("Unlock both arrangements before merging.");
  for (const section of remove.sections) { const existing = keep.sections.find(s => s.id === section.id); if (existing && JSON.stringify(existing) !== JSON.stringify(section)) throw new Error("Section IDs overlap with different content. Rename the conflicting section before merging."); }
  for (const variation of remove.variations) { const existing = keep.variations.find(v => v.id === variation.id); if (existing && JSON.stringify(existing) !== JSON.stringify(variation)) throw new Error("Arrangement IDs overlap with different content. Save a separately named arrangement before merging."); }
  if (keep.composition && remove.composition && JSON.stringify(keep.composition) !== JSON.stringify(remove.composition)) throw new Error("Both songs contain different compositions. Export or reconcile them before merging.");
  if (new Set([...keep.sections,...remove.sections].map(s=>s.id)).size > 64 || new Set([...keep.variations,...remove.variations].map(v=>v.id)).size > 16) throw new Error("Combined song exceeds section or variation limits. Archive or export arrangements before merging.");
  const id = (v: string | undefined) => v === remove.id ? keep.id : v ?? "";
  const ids = (v: string[]) => [...new Set(v.map(id))];
  const merged = { ...keep, variations: [...keep.variations, ...remove.variations.filter(v => !keep.variations.some(k => k.id === v.id))], sections: [...keep.sections, ...remove.sections.filter(s => !keep.sections.some(k => k.id === s.id))], tags: [...new Set([...keep.tags, ...remove.tags])], updatedAt: new Date().toISOString() };
  const next = { ...state, songs: [merged, ...state.songs.filter(s => s.id !== remove.id && s.id !== keep.id)] };
  merged.composition = keep.composition ?? remove.composition;
  merged.notes = [keep.notes, remove.notes].filter(Boolean).join("\n").slice(0,4000);
  // Redirect every songId-bearing record, including future metadata collections.
  for (const [key, value] of Object.entries(next)) if (Array.isArray(value) && key !== "songs") (next as unknown as Record<string, unknown>)[key] = value.map(item => item && typeof item === "object" ? { ...item, ...("songId" in item ? { songId: id(item.songId) } : {}), ...("songIds" in item ? { songIds: ids(item.songIds) } : {}), ...("entries" in item ? { entries: item.entries.map((e: {songId: string}) => ({...e, songId: id(e.songId)})) } : {}) } : typeof item === "string" ? id(item) : item);
  const progress = next.practiceProgress.filter(p => p.songId === keep.id);
  next.practiceProgress = [...next.practiceProgress.filter(p => p.songId !== keep.id), ...(progress.length ? [{ ...progress[0], practiceCount: progress.reduce((n,p) => n + p.practiceCount,0), sectionsCompleted: [...new Set(progress.flatMap(p => p.sectionsCompleted))], sectionMastery: Object.assign({}, ...progress.map(p => p.sectionMastery)), sectionReviews: Object.assign({}, ...progress.map(p => p.sectionReviews)) }] : [])];
  const retainedCare = state.libraryCare?.songs.find(s => s.songId === keep.id); const removedCare = state.libraryCare?.songs.find(s => s.songId === remove.id);
  next.libraryCare = normalizeLibraryCare({ ...state.libraryCare, songs: [...(state.libraryCare?.songs.filter(s => ![keep.id,remove.id].includes(s.songId)) ?? []), ...([retainedCare ?? removedCare].filter(Boolean).map(s => ({ ...s!, songId: keep.id, fields: {...removedCare?.fields,...retainedCare?.fields}, privateNote: [retainedCare?.privateNote,removedCare?.privateNote].filter(Boolean).join("\n"), sharedNote: [retainedCare?.sharedNote,removedCare?.sharedNote].filter(Boolean).join("\n") })))], changes: state.libraryCare?.changes.map(c => ({...c, songId: id(c.songId)})), healthAcknowledgements: state.libraryCare?.healthAcknowledgements.map(item => ({ ...item, songId: id(item.songId) })) });
  next.rehearsalAssignments = next.rehearsalAssignments.map(a => a.resourceType === "song" ? {...a,resourceId:id(a.resourceId)} : a);
  next.resourceAccess = next.resourceAccess.map(a => a.resourceType === "song" ? {...a,resourceId:id(a.resourceId)} : a);
  next.scheduledItems = next.scheduledItems.map(a => a.kind === "song" ? {...a,resourceId:id(a.resourceId)} : a);
  next.queueHistory = next.queueHistory.map(h => ({...h,lastSongId:h.lastSongId ? id(h.lastSongId) : undefined}));
  next.practicePaths = next.practicePaths.map(p => ({...p,stages:p.stages.map(s=>({...s,eligibleSongIds:ids(s.eligibleSongIds),completedSongIds:ids(s.completedSongIds)}))}));
  if (next.resumePoint) next.resumePoint = { ...next.resumePoint, songId: id(next.resumePoint.songId) };
  next.appliedTranspositions = { ...next.appliedTranspositions }; delete next.appliedTranspositions[remove.id];
  next.adaptiveOverrides = { ...next.adaptiveOverrides }; delete next.adaptiveOverrides[remove.id];
  return next;
}
export function inspectBackup(input: unknown): string[] {
  if (!input || typeof input !== "object") return ["Backup must be an object."];
  const b = input as Partial<SongLibraryState>; const issues: string[] = [];
  if (!Number.isInteger(b.version) || Number(b.version) < 1 || Number(b.version) > 11) issues.push("Unsupported backup version.");
  if (!Array.isArray(b.songs) || !Array.isArray(b.collections)) return [...issues, "Missing songs or collections."];
  const ids = new Set(b.songs.map(s => s.id)); if (ids.size !== b.songs.length) issues.push("Duplicate song IDs.");
  if (b.songs.some(s => !s.id || !s.title || !Array.isArray(s.sections) || !Array.isArray(s.variations))) issues.push("Incomplete song records.");
  if (b.collections.some(c => !Array.isArray(c.songIds))) issues.push("Invalid collection membership.");
  return issues;
}

const BACKUP_FIELDS = new Set(["version", "libraryCare", "collections", "songs", "archivedSongIds", "favorites", "recentSongIds", "practiceProgress", "practiceQueues", "preferences", "queueHistory", "resumePoint", "weeklyGoal", "recordings", "sourceHealth", "accountSync", "sharedAccess", "resourceAccess", "practiceSessions", "annotations", "setlists", "comments", "appliedTranspositions", "adaptiveOverrides", "videoReferences", "practicePaths", "scheduledItems", "pendingSyncOps", "readinessHistory", "drafts", "journalEntries", "assignments", "assignmentComments", "tempoRamps", "rehearsalChecklists", "checklistProgress", "transitionGoals", "songFamilies", "sectionBookmarks", "recallAttempts", "backingTracks", "voicingPreferences", "equipmentNotes", "recordingTargets", "auditionSessions", "rehearsalRoles", "rehearsalAssignments", "rehearsalEvents", "arrangementSnapshots", "stageCues", "referenceLinks", "concertOverrides", "practicePresets"]);
const PREFERENCE_FIELDS = new Set(["largePrint", "handsFree", "simplifyMode", "benchmarkOptIn", "localRole", "stage", "playabilityProfile", "chordSpelling", "previewMuted", "voiceCommandsEnabled", "learningToolsTourCompleted", "songDisplays", "familiarChords", "dashboardCards", "onboarding"]);

/** Return a bounded compatibility summary before a backup is normalized or merged. */
export function inspectBackupCompatibility(input: unknown): { sourceVersion?: number; unsupportedFields: string[]; audioMetadataCount: number; localVideoReferenceCount: number } {
  if (!input || typeof input !== "object") return { unsupportedFields: [], audioMetadataCount: 0, localVideoReferenceCount: 0 };
  const state = input as Record<string, unknown>;
  const unsupportedFields = Object.keys(state).filter((key) => !BACKUP_FIELDS.has(key)).map((key) => `Library: ${key}`);
  const preferences = state.preferences && typeof state.preferences === "object" ? state.preferences as Record<string, unknown> : {};
  unsupportedFields.push(...Object.keys(preferences).filter((key) => !PREFERENCE_FIELDS.has(key)).map((key) => `Preferences: ${key}`));
  return {
    sourceVersion: typeof state.version === "number" ? state.version : undefined,
    unsupportedFields: unsupportedFields.slice(0, 24),
    audioMetadataCount: Array.isArray(state.backingTracks) ? state.backingTracks.length : 0,
    localVideoReferenceCount: Array.isArray(state.videoReferences) ? state.videoReferences.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).source === "local-reference").length : 0,
  };
}

type IntegrityBackup = { format: "chord-hero-library-backup"; algorithm: "SHA-256"; checksum: string; payload: SongLibraryState };
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => JSON.stringify(key) + ":" + stableJson(item)).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function createIntegrityBackup(state: SongLibraryState): Promise<string> {
  const checksum = await sha256(stableJson(state));
  return JSON.stringify({ format: "chord-hero-library-backup", algorithm: "SHA-256", checksum, payload: state } satisfies IntegrityBackup, null, 2);
}
export async function readIntegrityBackup(input: unknown): Promise<{ state: unknown; integrity: "verified" | "legacy" }> {
  if (input && typeof input === "object" && (input as Partial<IntegrityBackup>).format === "chord-hero-library-backup") {
    const backup = input as Partial<IntegrityBackup>;
    if (backup.algorithm !== "SHA-256" || typeof backup.checksum !== "string" || !backup.payload) throw new Error("Backup integrity information is incomplete.");
    if (await sha256(stableJson(backup.payload)) !== backup.checksum) throw new Error("Backup checksum mismatch. The file may have changed or been damaged.");
    return { state: backup.payload, integrity: "verified" };
  }
  return { state: input, integrity: "legacy" };
}
export function mergeRestoredLibrary(current: SongLibraryState, restored: SongLibraryState): SongLibraryState {
  const result = { ...restored, ...current } as SongLibraryState;
  const keyOf = (name: string, item: unknown): string => {
    if (typeof item !== "object" || item === null) return String(item);
    const value = item as Record<string, unknown>;
    if (name === "songs") return String(value.title ?? "").trim().toLocaleLowerCase() + "|" + String(value.artist ?? "").trim().toLocaleLowerCase();
    if (name === "practiceProgress") return String(value.songId ?? "");
    if (name === "sourceHealth") return String(value.url ?? "");
    if (name === "voicingPreferences" || name === "recordingTargets") return String(value.songId ?? "") + ":" + String(value.variationId ?? "");
    if (name === "checklistProgress") return String(value.checklistId ?? "") + ":" + String(value.setlistId ?? "") + ":" + String(value.sessionId ?? "");
    if (name === "rehearsalAssignments") return String(value.roleId ?? "") + ":" + String(value.resourceType ?? "") + ":" + String(value.resourceId ?? "");
    return String(value.id ?? value.songId ?? JSON.stringify(value));
  };
  for (const name of Object.keys(current) as (keyof SongLibraryState)[]) {
    const left = current[name]; const right = restored[name];
    if (!Array.isArray(left) || !Array.isArray(right)) continue;
    if (name === "songs") {
      const currentSongs = left as LibrarySong[]; const restoredSongs = right as LibrarySong[];
      const currentIds = new Set(currentSongs.map(song => song.id));
      const titleArtistKey = (song: LibrarySong) => song.title.normalize("NFKC").trim().toLocaleLowerCase() + "|" + song.artist.normalize("NFKC").trim().toLocaleLowerCase();
      const currentTitles = new Set(currentSongs.map(titleArtistKey));
      const additions = restoredSongs.filter(song => { const key=titleArtistKey(song);if(currentIds.has(song.id)||currentTitles.has(key))return false;currentIds.add(song.id);currentTitles.add(key);return true; });
      (result as unknown as Record<string, unknown>)[name] = [...currentSongs, ...additions];
      continue;
    }
    const map = new Map<string, unknown>();
    for (const item of right) map.set(keyOf(String(name), item), item);
    for (const item of left) map.set(keyOf(String(name), item), item);
    (result as unknown as Record<string, unknown>)[name] = [...map.values()];
  }
  result.favorites = [...new Set([...restored.favorites, ...current.favorites])];
  result.archivedSongIds = [...new Set([...restored.archivedSongIds, ...current.archivedSongIds])];
  result.recentSongIds = [...new Set([...current.recentSongIds, ...restored.recentSongIds])].slice(0, 12);
  result.appliedTranspositions = { ...restored.appliedTranspositions, ...current.appliedTranspositions };
  result.adaptiveOverrides = { ...restored.adaptiveOverrides, ...current.adaptiveOverrides };
  const currentCare = normalizeLibraryCare(current.libraryCare); const restoredCare = normalizeLibraryCare(restored.libraryCare);
  const mergeCareList = <T,>(left:T[],right:T[],keyOf:(item:T)=>string) => { const values=new Map<string,T>();for(const item of left)values.set(keyOf(item),item);for(const item of right)values.set(keyOf(item),item);return [...values.values()]; };
  result.libraryCare = normalizeLibraryCare({
    songs: mergeCareList(restoredCare.songs,currentCare.songs,item=>item.songId),
    attendance: mergeCareList(restoredCare.attendance,currentCare.attendance,item=>item.id),
    changes: mergeCareList(restoredCare.changes,currentCare.changes,item=>item.id),
    events: mergeCareList(restoredCare.events,currentCare.events,item=>item.id),
    healthAcknowledgements: mergeCareList(restoredCare.healthAcknowledgements,currentCare.healthAcknowledgements,item=>item.songId+":"+item.issue),
  });
  return result;
}
export function libraryHealth(songs: LibrarySong[], knownChords: Set<string>, now = Date.now()) {
  return songs.map(s => ({ songId: s.id, title: s.title, issues: [s.origin === "imported" && !s.sourceUrl ? "Missing source link" : "", !s.sections.some(sec => sec.blocks.some(b => b.type === "lyrics" && b.text?.trim())) ? "No lyrics" : "", s.sections.some(sec => sec.blocks.some(b => b.chords?.some(c => !knownChords.has(c)))) ? "Unresolved chord" : "", s.updatedAt && now - Date.parse(s.updatedAt) > 180 * 86400000 ? "Arrangement needs review" : ""].filter(Boolean) })).filter(s => s.issues.length);
}
const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function recommendKey(song: LibrarySong, neighbor?: LibrarySong) { const target = neighbor?.key ?? song.key; const original = KEYS.indexOf(song.key); const dest = KEYS.indexOf(target); const capo = original < 0 || dest < 0 ? song.variations[0]?.capo ?? 0 : (dest - original + 12) % 12; return { key: target, capo, semitones: original < 0 || dest < 0 ? 0 : dest - original }; }
