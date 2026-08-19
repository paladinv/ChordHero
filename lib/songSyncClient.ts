import { mergeLibraryStates, type SongSyncEnvelope } from "./songSync";
import { prepareSongLibraryForSync, type SongLibraryState } from "./songLibrary";

export type RevisionSyncEnvelope<T> = { accountId: string; revision: number; updatedAt: string; state: T };
export type RevisionSyncClient<T> = { push: (state: T, revision: number) => Promise<RevisionSyncEnvelope<T>>; pull: () => Promise<RevisionSyncEnvelope<T>>; subscribe: (onUpdate: (envelope: RevisionSyncEnvelope<T>) => void) => () => void };

export function createRevisionSyncClient<T>(baseURL: string, libraryID: string, accountID: string): RevisionSyncClient<T> {
  const httpBase = `${baseURL.replace(/\/$/, "")}/sync/${encodeURIComponent(libraryID)}`;
  return {
    async push(state, revision) { const response = await fetch(httpBase, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-account-id": accountID }, body: JSON.stringify({ baseRevision: revision, state }) }); if (response.status === 409) { const conflict = await response.json() as { current: RevisionSyncEnvelope<T> }; throw Object.assign(new Error("Revision conflict"), { conflict: conflict.current }); } if (!response.ok) throw new Error(`Sync failed (${response.status})`); return await response.json() as RevisionSyncEnvelope<T>; },
    async pull() { const response = await fetch(httpBase, { credentials: "include", headers: { "x-account-id": accountID } }); if (!response.ok) throw new Error(`Sync failed (${response.status})`); return await response.json() as RevisionSyncEnvelope<T>; },
    subscribe(onUpdate) { if (typeof WebSocket === "undefined") return () => undefined; const websocket = new WebSocket(`${baseURL.replace(/^http/, "ws").replace(/\/$/, "")}/sync/${encodeURIComponent(libraryID)}/events?account=${encodeURIComponent(accountID)}`); websocket.onmessage = (event) => { const message = JSON.parse(event.data) as RevisionSyncEnvelope<T> & { type?: string }; if (message.state) onUpdate(message); }; return () => websocket.close(); },
  };
}

export type SongSyncClient = RevisionSyncClient<SongLibraryState>;

export function createSongSyncClient(baseURL: string, libraryID: string, accountID: string): SongSyncClient {
  const client = createRevisionSyncClient<SongLibraryState>(baseURL, libraryID, accountID);
  return { ...client, push: (state, revision) => client.push(prepareSongLibraryForSync(state), revision) };
}

export function resolveSyncConflict(local: SongLibraryState, remote: SongSyncEnvelope): SongLibraryState {
  return mergeLibraryStates(local, remote.state);
}
