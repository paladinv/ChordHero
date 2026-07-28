import { mergeLibraryStates, type SongSyncEnvelope } from "./songSync";
import type { SongLibraryState } from "./songLibrary";

export type SongSyncClient = { push: (state: SongLibraryState, revision: number) => Promise<SongSyncEnvelope>; pull: () => Promise<SongSyncEnvelope>; subscribe: (onUpdate: (envelope: SongSyncEnvelope) => void) => () => void };

export function createSongSyncClient(baseURL: string, libraryID: string, accountID: string): SongSyncClient {
  const httpBase = `${baseURL.replace(/\/$/, "")}/sync/${encodeURIComponent(libraryID)}`;
  return {
    async push(state, revision) { const response = await fetch(httpBase, { method: "POST", headers: { "content-type": "application/json", "x-account-id": accountID }, body: JSON.stringify({ baseRevision: revision, state }) }); if (response.status === 409) { const conflict = await response.json() as { current: SongSyncEnvelope }; throw Object.assign(new Error("Revision conflict"), { conflict: conflict.current }); } if (!response.ok) throw new Error(`Sync failed (${response.status})`); return await response.json() as SongSyncEnvelope; },
    async pull() { const response = await fetch(httpBase, { headers: { "x-account-id": accountID } }); if (!response.ok) throw new Error(`Sync failed (${response.status})`); return await response.json() as SongSyncEnvelope; },
    subscribe(onUpdate) { const websocket = new WebSocket(`${baseURL.replace(/^http/, "ws").replace(/\/$/, "")}/sync/${encodeURIComponent(libraryID)}/events?account=${encodeURIComponent(accountID)}`); websocket.onmessage = (event) => { const message = JSON.parse(event.data) as SongSyncEnvelope & { type?: string }; if (message.state) onUpdate(message); }; return () => websocket.close(); },
  };
}

export function resolveSyncConflict(local: SongLibraryState, remote: SongSyncEnvelope): SongLibraryState {
  return mergeLibraryStates(local, remote.state);
}
