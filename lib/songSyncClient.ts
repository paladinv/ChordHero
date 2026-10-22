import { mergeLibraryStates, type SongSyncEnvelope } from "./songSync";
import { prepareSongLibraryForSync, type SongLibraryState } from "./songLibrary";

export type RevisionSyncEnvelope<T> = { accountId: string; revision: number; updatedAt: string; state: T; permissions?: Record<string, "viewer" | "editor">; accessRole?: "owner" | "editor" | "viewer" };
export type RevisionSyncClient<T> = {
  push: (state: T, revision: number) => Promise<RevisionSyncEnvelope<T>>;
  pull: () => Promise<RevisionSyncEnvelope<T>>;
  setAccess: (accountId: string, role: "viewer" | "editor" | null) => Promise<Record<string, "viewer" | "editor">>;
  subscribe: (onUpdate: (envelope: RevisionSyncEnvelope<T>) => void) => () => void;
};

export function createRevisionSyncClient<T>(baseURL: string, libraryID: string, accountID: string, accessToken: string): RevisionSyncClient<T> {
  const httpBase = `${baseURL.replace(/\/$/, "")}/sync/${encodeURIComponent(libraryID)}`;
  const headers = () => ({ authorization: `Bearer ${accessToken}`, "x-account-id": accountID });
  return {
    async push(state, revision) {
      const response = await fetch(httpBase, { method: "POST", headers: { ...headers(), "content-type": "application/json" }, body: JSON.stringify({ baseRevision: revision, state }), cache: "no-store" });
      if (response.status === 409) { const conflict = await response.json() as { current: RevisionSyncEnvelope<T> }; throw Object.assign(new Error("Revision conflict"), { conflict: conflict.current }); }
      if (!response.ok) throw new Error(`Sync failed (${response.status})`);
      return await response.json() as RevisionSyncEnvelope<T>;
    },
    async pull() {
      const response = await fetch(httpBase, { headers: headers(), cache: "no-store" });
      if (!response.ok) throw new Error(`Sync failed (${response.status})`);
      return await response.json() as RevisionSyncEnvelope<T>;
    },
    async setAccess(memberAccountID, role) {
      const response = await fetch(`${httpBase}/access`, { method: "POST", headers: { ...headers(), "content-type": "application/json" }, body: JSON.stringify({ accountId: memberAccountID, role }), cache: "no-store" });
      const result = await response.json() as { permissions?: Record<string, "viewer" | "editor">; error?: string };
      if (!response.ok) throw new Error(result.error || `Access update failed (${response.status})`);
      return result.permissions ?? {};
    },
    subscribe(onUpdate) {
      if (typeof WebSocket === "undefined") return () => undefined;
      let closed = false;
      let retry = 0;
      let reconnectTimer: number | undefined;
      let websocket: WebSocket | undefined;
      const scheduleReconnect = () => {
        if (closed) return;
        retry += 1;
        reconnectTimer = window.setTimeout(() => void connect(), Math.min(30_000, 750 * 2 ** Math.min(6, retry - 1)));
      };
      const connect = async () => {
        if (closed) return;
        try {
          const ticketResponse = await fetch(`${httpBase}/ticket`, { method: "POST", headers: headers(), cache: "no-store" });
          if (ticketResponse.status === 401 || ticketResponse.status === 403) { closed = true; return; }
          if (!ticketResponse.ok) throw new Error("Could not authorize the live sync connection");
          const { ticket } = await ticketResponse.json() as { ticket: string };
          if (closed) return;
          const url = `${baseURL.replace(/^http/, "ws").replace(/\/$/, "")}/sync/${encodeURIComponent(libraryID)}/events?ticket=${encodeURIComponent(ticket)}`;
          websocket = new WebSocket(url);
          websocket.onopen = () => { retry = 0; };
          websocket.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data) as RevisionSyncEnvelope<T> & { type?: string };
              if (message.state && Number.isFinite(message.revision)) onUpdate(message);
            } catch { /* Ignore malformed or non-library server messages. */ }
          };
          websocket.onclose = scheduleReconnect;
          websocket.onerror = () => websocket?.close();
        } catch { scheduleReconnect(); }
      };
      void connect();
      return () => { closed = true; if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer); websocket?.close(); };
    },
  };
}

export type SongSyncClient = RevisionSyncClient<SongLibraryState>;

export function createSongSyncClient(baseURL: string, libraryID: string, accountID: string, accessToken: string): SongSyncClient {
  const client = createRevisionSyncClient<SongLibraryState>(baseURL, libraryID, accountID, accessToken);
  return { ...client, push: (state, revision) => client.push(prepareSongLibraryForSync(state), revision) };
}

export function resolveSyncConflict(local: SongLibraryState, remote: SongSyncEnvelope): SongLibraryState {
  return mergeLibraryStates(local, remote.state);
}
