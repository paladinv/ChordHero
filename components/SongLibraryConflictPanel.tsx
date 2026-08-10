"use client";

import { clearPendingSyncOperations, pendingSyncSummary, type SongLibraryState } from "../lib/songLibrary";

type ConflictPanelProps = { local: SongLibraryState; remote: SongLibraryState; onResolve: (state: SongLibraryState) => void };

export function SongLibraryConflictPanel({ local, remote, onResolve }: ConflictPanelProps) {
  const localCount = local.songs.length + local.collections.length;
  const remoteCount = remote.songs.length + remote.collections.length;
  return <section className="library-management-card conflict-panel" aria-labelledby="conflict-title"><span className="label">Offline sync queue</span><h2 id="conflict-title">Choose which changes to keep</h2><p className="muted">Nothing syncs silently. {pendingSyncSummary(local)} Review the operation list and resolve deliberately.</p>{local.pendingSyncOps.length > 0 && <details><summary>Pending operations ({local.pendingSyncOps.length})</summary><ul>{local.pendingSyncOps.slice(0, 12).map((operation) => <li key={operation.id}>{operation.description} · {new Date(operation.createdAt).toLocaleString()}</li>)}</ul><button className="text-button" type="button" onClick={() => onResolve(clearPendingSyncOperations(local))}>Mark queue reviewed locally</button></details>}<div className="conflict-columns"><div><strong>This device</strong><span>{localCount} songs and collections</span><span>{local.practiceProgress.length} practice records</span><button className="btn" type="button" onClick={() => onResolve(local)}>Keep device version</button></div><div><strong>Cloud revision</strong><span>{remoteCount} songs and collections</span><span>{remote.practiceProgress.length} practice records</span><button className="btn" type="button" onClick={() => onResolve(remote)}>Keep cloud version</button></div></div><button className="btn primary" type="button" onClick={() => onResolve({ ...local, songs: [...local.songs, ...remote.songs.filter((song) => !local.songs.some((existing) => existing.id === song.id))], collections: [...local.collections, ...remote.collections.filter((collection) => !local.collections.some((existing) => existing.id === collection.id))] })}>Merge non-conflicting items</button></section>;
}
