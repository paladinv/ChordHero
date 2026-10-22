import { useEffect, useRef, useState } from "react";
import { deleteRecording, loadRecording, saveRecording } from "./songRecording";
import type { RecordingAnalysis } from "./songRecordingAnalysis";
import type { SavedRightHandTake } from "../components/RightHandRecordingResults";

const KEY = "chord-hero:right-hand:recording-history:v2";
export function readRightHandTakes() { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, SavedRightHandTake[]>; } catch { return {}; } }
const read = readRightHandTakes;
export async function removeRightHandTakes(ids: string[]) {
  const selected = new Set(ids);
  await Promise.all(ids.map(deleteRecording));
  const all = read();
  Object.keys(all).forEach((key) => { all[key] = all[key].filter((take) => !selected.has(take.id)); });
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("chord-hero:right-hand-storage"));
}
export function reviewRightHandTake(id: string, reviewAccepted: boolean) {
  const all = read();
  if (!Object.values(all).some((takes) => takes.some((take) => take.id === id))) return;
  Object.keys(all).forEach((key) => { all[key] = all[key].map((take) => take.id === id ? { ...take, reviewAccepted, analysis: { ...take.analysis, reviewAccepted } } : take); });
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("chord-hero:right-hand-storage"));
}
function retainReferences(history: SavedRightHandTake[]) {
  const ordered = [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...ordered.filter((take) => take.pinned), ...ordered.filter((take) => !take.pinned).slice(0, 2)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
}
export function useRightHandTakeLibrary(exerciseId: string, setMessage: (message: string) => void) {
  const [takes, setTakes] = useState<SavedRightHandTake[]>([]);
  const [audioURLs, setAudioURLs] = useState<Record<string, string>>({});
  const active = useRef<string | null>(exerciseId); active.current = exerciseId;
  const urls = useRef(audioURLs); urls.current = audioURLs;
  const [storageRevision, setStorageRevision] = useState(0);
  useEffect(() => { const refresh = () => setStorageRevision((n) => n + 1); window.addEventListener("chord-hero:right-hand-storage", refresh); return () => window.removeEventListener("chord-hero:right-hand-storage", refresh); }, []);
  useEffect(() => {
    active.current = exerciseId;
    let cancelled = false;
    setTakes([]); setAudioURLs({});
    const all = read(); const previous = all[exerciseId] ?? [];
    const retained = retainReferences(previous);
    const retainedIds = new Set(retained.map((take) => take.id));
    if (retained.length !== previous.length) {
      all[exerciseId] = retained; localStorage.setItem(KEY, JSON.stringify(all));
      void Promise.all(previous.filter((take) => !retainedIds.has(take.id)).map((take) => deleteRecording(take.id)));
    }
    setTakes(retained);
    void Promise.all(retained.map(async (take) => ({ id: take.id, blob: await loadRecording(take.id) }))).then((items) => {
      if (cancelled) return;
      setAudioURLs(Object.fromEntries(items.filter((item) => item.blob).map((item) => [item.id, URL.createObjectURL(item.blob!)])));
    });
    return () => { cancelled = true; active.current = null; Object.values(urls.current).forEach(URL.revokeObjectURL); };
  }, [exerciseId, storageRevision]);
  const retain = async (blob: Blob, analysis: RecordingAnalysis) => {
    const capturedId = exerciseId; const id = analysis.recordingId ?? `right-hand:${capturedId}:${Date.now()}`;
    await saveRecording(id, blob);
    if (active.current !== capturedId) { await deleteRecording(id); return; }
    const all = read(); const previous = all[capturedId] ?? [];
    const retained = retainReferences([{ id, analysis, reviewAccepted: analysis.reviewAccepted ?? true, createdAt: new Date().toISOString(), mediaType: blob.type, byteSize: blob.size }, ...previous]);
    all[capturedId] = retained; localStorage.setItem(KEY, JSON.stringify(all));
    const ids = new Set(retained.map((take) => take.id));
    await Promise.all(previous.filter((take) => !ids.has(take.id)).map((take) => deleteRecording(take.id)));
    if (active.current !== capturedId) return;
    setTakes(retained); setAudioURLs((previousURLs) => { const next = Object.fromEntries(Object.entries(previousURLs).filter(([key, value]) => { if (ids.has(key)) return true; URL.revokeObjectURL(value); return false; })); return { ...next, [id]: URL.createObjectURL(blob) }; });
    window.dispatchEvent(new Event("chord-hero:right-hand-storage"));
  };
  const updateTake = async (id: string, action: "pin" | "delete") => {
    const capturedId = exerciseId; const all = read(); const current = all[capturedId]?.find((take) => take.id === id); if (!current) return;
    if (action === "pin" && !current.pinned && Object.values(all).flat().filter((take) => take.pinned).length >= 4) { setMessage("Reference limit reached. Unpin one of the four saved references first."); return; }
    const previous = all[capturedId];
    all[capturedId] = retainReferences(action === "delete" ? previous.filter((take) => take.id !== id) : previous.map((take) => take.id === id ? { ...take, pinned: !take.pinned } : take));
    const retainedIds = new Set(all[capturedId].map((take) => take.id));
    localStorage.setItem(KEY, JSON.stringify(all));
    await Promise.all(previous.filter((take) => !retainedIds.has(take.id)).map((take) => deleteRecording(take.id)));
    if (active.current !== capturedId) return;
    const latest = read()[capturedId] ?? []; const latestIds = new Set(latest.map((take) => take.id)); setTakes(latest);
    setAudioURLs((previousURLs) => Object.fromEntries(Object.entries(previousURLs).filter(([key, value]) => { if (latestIds.has(key)) return true; URL.revokeObjectURL(value); return false; })));
    window.dispatchEvent(new Event("chord-hero:right-hand-storage"));
  };
  return { takes, audioURLs, retain, updateTake };
}
