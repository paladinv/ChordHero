"use client";

import { useEffect, useRef, useState } from "react";
import { mergeLibraryStates } from "@/lib/songSync";
import { createSongSyncClient } from "@/lib/songSyncClient";
import { migrateSongLibraryState, type SongLibraryState } from "@/lib/songLibrary";

type Props = { library: SongLibraryState; onApply: (state: SongLibraryState) => void; onMessage: (message: string) => void };
type SyncConflict = { accountId: string; revision: number; updatedAt: string; state: SongLibraryState; permissions?: Record<string, "viewer" | "editor">; accessRole?: "owner" | "editor" | "viewer" };
const STORAGE_KEY = "chord-builder-sync-settings";
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export default function SongBuilderSync({ library, onApply, onMessage }: Props) {
  const [url, setUrl] = useState("");
  const [libraryId, setLibraryId] = useState("chord-hero-songs");
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [memberAccountId, setMemberAccountId] = useState("");
  const [memberRole, setMemberRole] = useState<"viewer" | "editor">("editor");
  const [permissions, setPermissions] = useState<Record<string, "viewer" | "editor">>({});
  const [accessRole, setAccessRole] = useState<"owner" | "editor" | "viewer" | "">("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState("Cloud sync is off until you configure a server.");
  const revisionRef = useRef(0);
  const libraryRef = useRef(library);
  const onApplyRef = useRef(onApply);
  const lastRemoteSignature = useRef("");
  libraryRef.current = library;
  onApplyRef.current = onApply;
  const currentSignature = stable(migrateSongLibraryState(library));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { url?: string; libraryId?: string; accountId?: string } | null;
      if (saved) { setUrl(saved.url ?? ""); setLibraryId(saved.libraryId ?? "chord-hero-songs"); setAccountId(saved.accountId ?? ""); setStatus("Saved sync settings are ready. Nothing uploads until you press Sync now."); }
    } catch { /* ignore a malformed optional sync preference */ }
  }, []);

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: url.trim(), libraryId: libraryId.trim(), accountId: accountId.trim() })); }
    catch { setStatus("Sync settings could not be saved in this browser."); }
  }

  async function syncNow(): Promise<boolean> {
    const normalizedUrl = url.trim().replace(/\/$/, "");
    const id = libraryId.trim();
    const account = accountId.trim();
    if (!normalizedUrl || !id || !account || !accessToken) { setStatus("Enter a sync URL, shared library ID, account ID, and account access token."); return false; }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(account)) { setStatus("Use account and library IDs with letters, numbers, dots, underscores, or hyphens."); return false; }
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Enter a server URL without credentials, query parameters, or a fragment.");
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") throw new Error("Use HTTPS for remote sync servers. HTTP is allowed only on localhost.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Enter a valid sync URL."); return false; }
    saveSettings();
    setBusy(true);
    setStatus("Connecting to the configured sync server…");
    const client = createSongSyncClient(normalizedUrl, id, account, accessToken);
    try {
      let remote: SyncConflict;
      try { remote = await client.pull(); }
      catch (error) {
        if (error instanceof Error && error.message.includes("404")) {
          const created = await client.push(library, 0);
          setPermissions(created.permissions ?? {});
          setAccessRole(created.accessRole ?? "owner");
          revisionRef.current = created.revision;
          lastRemoteSignature.current = stable(migrateSongLibraryState(created.state));
          onApply(migrateSongLibraryState(created.state));
          setStatus(`Created the shared library and uploaded ${created.state.songs.length} songs.`);
          return true;
        }
        throw error;
      }
      let merged = mergeLibraryStates(library, migrateSongLibraryState(remote.state));
      setPermissions(remote.permissions ?? {});
      setAccessRole(remote.accessRole ?? "");
      if (remote.accessRole === "viewer") {
        const readOnlyState = migrateSongLibraryState(remote.state);
        onApplyRef.current(readOnlyState);
        revisionRef.current = remote.revision;
        lastRemoteSignature.current = stable(readOnlyState);
        setStatus(`Loaded ${readOnlyState.songs.length} shared songs with view-only access · revision ${remote.revision}.`);
        return true;
      }
      if (stable(migrateSongLibraryState(merged)) !== stable(migrateSongLibraryState(remote.state))) {
        try { remote = await client.push(merged, remote.revision); }
        catch (error) {
          const conflict = (error as Error & { conflict?: SyncConflict }).conflict;
          if (!conflict) throw error;
          merged = mergeLibraryStates(merged, migrateSongLibraryState(conflict.state));
          remote = await client.push(merged, conflict.revision);
        }
        merged = migrateSongLibraryState(remote.state);
      } else merged = migrateSongLibraryState(remote.state);
      onApplyRef.current(merged);
      revisionRef.current = remote.revision;
      lastRemoteSignature.current = stable(merged);
      const direction = stable(migrateSongLibraryState(library)) === stable(merged) ? "Synced" : "Merged and synced";
      setStatus(`${direction} ${merged.songs.length} songs · server revision ${remote.revision} · ${new Date(remote.updatedAt).toLocaleString()}.`);
      onMessage("Song library sync completed.");
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed. Check the server URL and account permission.");
      return false;
    } finally { setBusy(false); }
  }

  async function startLive() {
    const synchronized = await syncNow();
    if (synchronized) {
      setLive(true);
      setStatus("Live collaboration is on. Song Library changes sync while this page stays open.");
    }
  }

  useEffect(() => {
    if (!live) return;
    const normalizedUrl = url.trim().replace(/\/$/, "");
    const id = libraryId.trim();
    const account = accountId.trim();
    if (!normalizedUrl || !id || !account || !accessToken) return;
    const client = createSongSyncClient(normalizedUrl, id, account, accessToken);
    const unsubscribe = client.subscribe((envelope) => {
      if (envelope.revision < revisionRef.current || envelope.revision === revisionRef.current && envelope.accessRole === accessRole) return;
      const remote = migrateSongLibraryState(envelope.state);
      const merged = envelope.accessRole === "viewer" ? remote : mergeLibraryStates(libraryRef.current, remote);
      revisionRef.current = envelope.revision;
      lastRemoteSignature.current = stable(merged);
      setPermissions(envelope.permissions ?? {});
      setAccessRole(envelope.accessRole ?? "");
      onApplyRef.current(merged);
      setStatus(`Live update received · revision ${envelope.revision} · ${new Date(envelope.updatedAt).toLocaleTimeString()}.`);
    });
    return unsubscribe;
  }, [live, url, libraryId, accountId, accessToken, accessRole]);

  useEffect(() => {
    if (!live || accessRole === "viewer" || !revisionRef.current || currentSignature === lastRemoteSignature.current) return;
    const normalizedUrl = url.trim().replace(/\/$/, "");
    const id = libraryId.trim();
    const account = accountId.trim();
    if (!normalizedUrl || !id || !account || !accessToken) return;
    const timer = window.setTimeout(async () => {
      const client = createSongSyncClient(normalizedUrl, id, account, accessToken);
      try {
        let result: SyncConflict;
        try { result = await client.push(library, revisionRef.current); }
        catch (error) {
          const conflict = (error as Error & { conflict?: SyncConflict }).conflict;
          if (!conflict) throw error;
          const merged = mergeLibraryStates(libraryRef.current, migrateSongLibraryState(conflict.state));
          result = await client.push(merged, conflict.revision);
        }
        revisionRef.current = result.revision;
        const state = migrateSongLibraryState(result.state);
        lastRemoteSignature.current = stable(state);
        onApplyRef.current(state);
        setStatus(`Live update sent · revision ${result.revision} · ${new Date(result.updatedAt).toLocaleTimeString()}.`);
      } catch (error) {
        setStatus(error instanceof Error ? `Live sync paused: ${error.message}` : "Live sync could not send this change.");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [live, accessRole, currentSignature, library, url, libraryId, accountId, accessToken]);

  async function updateMemberAccess(memberID: string, role: "viewer" | "editor" | null) {
    const normalizedUrl = url.trim().replace(/\/$/, "");
    if (!normalizedUrl || !libraryId.trim() || !accountId.trim() || !accessToken) { setStatus("Sync the library with an authenticated owner account before managing access."); return; }
    setBusy(true);
    try {
      const client = createSongSyncClient(normalizedUrl, libraryId.trim(), accountId.trim(), accessToken);
      setPermissions(await client.setAccess(memberID, role));
      setStatus(role ? `${memberID} now has ${role} access.` : `${memberID} access was removed.`);
      setMemberAccountId("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not update collaborator access."); }
    finally { setBusy(false); }
  }

  return <details className="builder-sync-panel">
    <summary>Optional cloud sync{accessRole ? ` · ${accessRole} access` : ""}</summary>
    <p>Sync sends the Song Library to your configured server. The server authenticates account IDs with access tokens from its private environment configuration. This token stays in memory on this page and is not saved to browser storage.</p>
    <div className="song-builder-fields">
      <label>Sync server URL<input type="url" inputMode="url" maxLength={400} value={url} onChange={(event) => { setUrl(event.target.value); setPermissions({}); }} placeholder="https://your-server.example" /></label>
      <label>Shared library ID<input maxLength={100} value={libraryId} onChange={(event) => { setLibraryId(event.target.value); setPermissions({}); setAccessRole(""); }} /></label>
      <label>Account ID<input maxLength={100} value={accountId} onChange={(event) => { setAccountId(event.target.value); setPermissions({}); setAccessRole(""); }} autoComplete="username" /></label>
      <label>Account access token<input type="password" maxLength={500} value={accessToken} onChange={(event) => setAccessToken(event.target.value)} autoComplete="off" /></label>
      <button className="btn primary" type="button" disabled={busy} onClick={() => void syncNow()}>{busy ? "Syncing…" : "Save settings and sync"}</button>
    </div>
    <details className="builder-sync-access"><summary>Collaborator access · {Object.keys(permissions).length}</summary><p>Only the library owner can grant access. Collaborator account IDs must also be configured on the sync server.</p>
      <div className="song-builder-fields"><label>Collaborator account ID<input maxLength={100} value={memberAccountId} onChange={(event) => setMemberAccountId(event.target.value)} autoComplete="off" /></label><label>Permission<select value={memberRole} onChange={(event) => setMemberRole(event.target.value as "viewer" | "editor")}><option value="editor">Can edit</option><option value="viewer">Can view</option></select></label><button className="btn" type="button" disabled={!memberAccountId.trim() || busy || accessRole === "viewer"} onClick={() => void updateMemberAccess(memberAccountId.trim(), memberRole)}>Grant access</button></div>
      {Object.entries(permissions).length ? <ul>{Object.entries(permissions).map(([member, role]) => <li key={member}><strong>{member}</strong> · {role}<button className="text-button" type="button" disabled={busy || accessRole === "viewer"} onClick={() => void updateMemberAccess(member, null)}>Remove access</button></li>)}</ul> : <p>No collaborators have access yet.</p>}
    </details>
    <div className="builder-inline-actions"><button className={`btn ${live ? "primary" : ""}`} type="button" disabled={busy} aria-pressed={live} onClick={() => live ? setLive(false) : void startLive()}>{live ? "Stop live collaboration" : "Start live collaboration"}</button><span className="song-builder-muted">Live mode shares this library with the configured sync server until you stop it or leave the page.</span></div>
    <p className="song-builder-muted" role="status" aria-live="polite">{status}</p>
  </details>;
}
