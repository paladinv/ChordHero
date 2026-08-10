import { buildSmartPracticePlan, migrateSongLibraryState, type LibrarySong, type SongLibraryRole, type SongLibraryState, type SongPracticeProgress, type SongPracticeQueue } from "./songLibrary";

export type SongSyncEnvelope = { accountId: string; revision: number; updatedAt: string; state: SongLibraryState };

function latestBy<T>(left: T[], right: T[], keyOf: (item: T) => string): T[] {
  const map = new Map<string, T>(); [...left, ...right].forEach((item) => { const key = keyOf(item); const previous = map.get(key); const leftTime = (item as T & { updatedAt?: string; lastPracticedAt?: string; createdAt?: string; checkedAt?: string }).updatedAt ?? (item as T & { lastPracticedAt?: string }).lastPracticedAt ?? (item as T & { createdAt?: string }).createdAt ?? (item as T & { checkedAt?: string }).checkedAt ?? ""; const previousTime = previous ? ((previous as T & { updatedAt?: string; lastPracticedAt?: string; createdAt?: string; checkedAt?: string }).updatedAt ?? (previous as T & { lastPracticedAt?: string }).lastPracticedAt ?? (previous as T & { createdAt?: string }).createdAt ?? (previous as T & { checkedAt?: string }).checkedAt ?? "") : ""; if (!previous || leftTime >= previousTime) map.set(key, item); }); return [...map.values()];
}

export function mergeLibraryStates(local: SongLibraryState, remote: SongLibraryState): SongLibraryState {
  const merged = migrateSongLibraryState({ ...local, ...remote, version: 3, songs: latestBy<LibrarySong>(local.songs, remote.songs, (item) => item.id), collections: latestBy(local.collections, remote.collections, (item) => item.id), practiceProgress: latestBy<SongPracticeProgress>(local.practiceProgress, remote.practiceProgress, (item) => item.songId), practiceQueues: latestBy<SongPracticeQueue>(local.practiceQueues, remote.practiceQueues, (item) => item.id), recordings: latestBy(local.recordings, remote.recordings, (item) => item.id), queueHistory: [...local.queueHistory, ...remote.queueHistory].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 20), favorites: [...new Set([...local.favorites, ...remote.favorites])], recentSongIds: [...new Set([...local.recentSongIds, ...remote.recentSongIds])].slice(0, 12), sourceHealth: latestBy(local.sourceHealth, remote.sourceHealth, (item) => item.url), sharedAccess: latestBy(local.sharedAccess, remote.sharedAccess, (item) => `${item.libraryId}:${item.accountId}`), resourceAccess: latestBy(local.resourceAccess, remote.resourceAccess, (item) => `${item.resourceType}:${item.resourceId}:${item.accountId}`), annotations: latestBy(local.annotations ?? [], remote.annotations ?? [], (item) => item.id), setlists: latestBy(local.setlists ?? [], remote.setlists ?? [], (item) => item.id), comments: latestBy(local.comments ?? [], remote.comments ?? [], (item) => item.id), videoReferences: latestBy(local.videoReferences ?? [], remote.videoReferences ?? [], (item) => item.id), practicePaths: latestBy(local.practicePaths ?? [], remote.practicePaths ?? [], (item) => item.id), scheduledItems: latestBy(local.scheduledItems ?? [], remote.scheduledItems ?? [], (item) => item.id), pendingSyncOps: [...(local.pendingSyncOps ?? []), ...(remote.pendingSyncOps ?? [])], appliedTranspositions: { ...(local.appliedTranspositions ?? {}), ...(remote.appliedTranspositions ?? {}) }, adaptiveOverrides: { ...(local.adaptiveOverrides ?? {}), ...(remote.adaptiveOverrides ?? {}) } });
  const localLast = local.accountSync?.lastSyncedAt ?? ""; const remoteLast = remote.accountSync?.lastSyncedAt ?? "";
  return { ...merged, weeklyGoal: local.weeklyGoal.weekStart >= remote.weeklyGoal.weekStart ? local.weeklyGoal : remote.weeklyGoal, resumePoint: (local.resumePoint?.updatedAt ?? "") >= (remote.resumePoint?.updatedAt ?? "") ? local.resumePoint : remote.resumePoint, accountSync: { providerId: remote.accountSync?.providerId ?? local.accountSync?.providerId ?? "account-sync", encrypted: true, lastSyncedAt: localLast >= remoteLast ? localLast : remoteLast } };
}

export function recommendQueue(state: SongLibraryState, queueName = "Recommended next"): SongPracticeQueue {
  return buildSmartPracticePlan(state, state.songs, queueName);
}

export function setLibraryPermission(state: SongLibraryState, libraryId: string, accountId: string, role: Exclude<SongLibraryRole, "owner">): SongLibraryState {
  const access = state.sharedAccess.filter((item) => !(item.libraryId === libraryId && item.accountId === accountId)); return { ...state, sharedAccess: [...access, { libraryId, accountId, role, invitedAt: new Date().toISOString() }] };
}

export function setResourcePermission(state: SongLibraryState, resourceType: "song" | "queue", resourceId: string, accountId: string, role: Exclude<SongLibraryRole, "owner">): SongLibraryState {
  const access = state.resourceAccess.filter((item) => !(item.resourceType === resourceType && item.resourceId === resourceId && item.accountId === accountId));
  return { ...state, resourceAccess: [...access, { resourceType, resourceId, accountId, role, invitedAt: new Date().toISOString() }] };
}
