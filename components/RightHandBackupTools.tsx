"use client";
import { useState } from "react";
import { PRACTICE_STORAGE_KEY, readPracticePlatformState, writePracticePlatformState } from "../lib/practicePlatform";
import { createRightHandBackup, mergeRightHandBackup, parseRightHandBackup, RIGHT_HAND_BACKUP_LIMIT, RIGHT_HAND_RESTORE_FLAG, type RightHandBackup } from "../lib/rightHandBackup";

export default function RightHandBackupTools() {
  const [preview, setPreview] = useState<RightHandBackup | null>(null);
  const [applyPreferences, setApplyPreferences] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const exportBackup = () => {
    try {
      const snapshot = createRightHandBackup(localStorage, readPracticePlatformState());
      const json = JSON.stringify(snapshot, null, 2);
      if (new TextEncoder().encode(json).byteLength > RIGHT_HAND_BACKUP_LIMIT) throw new Error("Practice backup is larger than 1 MB.");
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "chord-hero-right-hand-backup.json"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup exported. It contains practice summaries and preferences, with no recording audio or recording IDs.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create a backup."); }
  };
  const choose = async (file?: File) => {
    setPreview(null); setMessage("");
    if (!file || file.size > RIGHT_HAND_BACKUP_LIMIT) { setMessage("Choose a Right Hand JSON backup no larger than 1 MB."); return; }
    setBusy(true);
    try { setPreview(parseRightHandBackup(await file.text())); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Backup could not be read."); }
    finally { setBusy(false); }
  };
  const restore = () => {
    if (!preview) return;
    const previous = new Map<string, string | null>();
    try {
      const state = readPracticePlatformState();
      const changes = mergeRightHandBackup(preview, createRightHandBackup(localStorage, state), state, applyPreferences);
      for (const key of [...Object.keys(changes.storage), PRACTICE_STORAGE_KEY]) previous.set(key, localStorage.getItem(key));
      // Stop the mounted studio's pagehide persistence from replacing imported values.
      sessionStorage.setItem(RIGHT_HAND_RESTORE_FLAG, "1");
      window.dispatchEvent(new CustomEvent("chord-hero:right-hand-quick-control", { detail: { action: "cancel" } }));
      for (const [key, value] of Object.entries(changes.storage)) localStorage.setItem(key, value);
      writePracticePlatformState(changes.state);
      const url = new URL(location.href); url.searchParams.delete("exercise");
      location.replace(`${url.pathname}${url.search}`);
    } catch (error) {
      for (const [key, value] of previous) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* The error below remains visible if storage is unavailable. */ } }
      try { sessionStorage.removeItem(RIGHT_HAND_RESTORE_FLAG); } catch { /* Optional session guard. */ }
      setMessage(error instanceof Error ? `Import was not applied: ${error.message}` : "Import was not applied. Check available browser storage.");
    }
  };
  return <section className="learning-card right-hand-backup"><h3>Move your practice to another device</h3><p>Export a local JSON backup of Right Hand progress, playlists, notes, custom routines, and practice history. This is a manual transfer, not account sync. Audio, recording IDs, microphone calibration and teacher identity labels are excluded. Imported scores are summaries and cannot establish recorded mastery.</p><div className="learning-actions"><button type="button" onClick={exportBackup}>Export practice backup</button><label>Preview backup to import<input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} /></label></div>{preview ? <div className="backup-preview"><strong>Review before import</strong><p>Exported {new Date(preview.exportedAt).toLocaleString()} · {Object.keys(preview.progress).length} drills · {preview.history.length} history entries · {preview.library.playlists.length} playlists · {preview.routines.length} routines.</p><p>Existing history is deduplicated by practice-event ID, cumulative progress uses the higher saved totals, and existing playlists/notes win matching IDs. Chord and song records are preserved. The studio reloads after import and never starts audio.</p><label><input type="checkbox" checked={applyPreferences} onChange={(event) => setApplyPreferences(event.target.checked)} /> Apply saved Right Hand preferences and selected drill</label><div className="learning-actions"><button type="button" onClick={restore}>Confirm merge & reload studio</button><button type="button" onClick={() => setPreview(null)}>Cancel import</button></div></div> : null}<p role="status">{busy ? "Reading backup…" : message}</p></section>;
}
