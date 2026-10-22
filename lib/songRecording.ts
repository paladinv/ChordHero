const DB_NAME = "chord-hero-song-recordings";
const STORE_NAME = "audio";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecording(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => { const transaction = database.transaction(STORE_NAME, "readwrite"); transaction.objectStore(STORE_NAME).put(blob, id); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  database.close();
}

export async function loadRecording(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  const blob = await new Promise<Blob | null>((resolve, reject) => { const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(id); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); });
  database.close(); return blob;
}

export async function deleteRecording(id: string): Promise<void> {
  const database = await openDatabase(); await new Promise<void>((resolve, reject) => { const transaction = database.transaction(STORE_NAME, "readwrite"); transaction.objectStore(STORE_NAME).delete(id); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); database.close();
}

export async function inspectBackingTrackKeys(expectedIds: string[]): Promise<{ availableIds: string[]; missingIds: string[]; orphanIds: string[] }> {
  const database = await openDatabase();
  try {
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stored = new Set(keys.filter((key): key is string => typeof key === "string" && key.startsWith("backing-track:")).map((key) => key.slice("backing-track:".length)));
    const expected = new Set(expectedIds);
    return { availableIds: expectedIds.filter((id) => stored.has(id)), missingIds: expectedIds.filter((id) => !stored.has(id)), orphanIds: [...stored].filter((id) => !expected.has(id)).slice(0, 100) };
  } finally { database.close(); }
}

/** On-demand local-only audit; it reads key metadata once and never loads audio blobs. */
export async function inspectLocalMediaAvailability(recordingIds: string[], backingTrackIds: string[]): Promise<{
  recordings: { availableIds: string[]; missingIds: string[] };
  backingTracks: { availableIds: string[]; missingIds: string[]; orphanIds: string[] };
  storage: { usageBytes?: number; quotaBytes?: number };
}> {
  const database = await openDatabase();
  try {
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const localKeys = new Set(keys.filter((key): key is string => typeof key === "string"));
    const prefixedBackingTracks = new Set([...localKeys].filter((key) => key.startsWith("backing-track:")).map((key) => key.slice("backing-track:".length)));
    const expectedBackingTracks = new Set(backingTrackIds);
    const storage = await estimateBrowserStorage();
    return {
      recordings: { availableIds: recordingIds.filter((id) => localKeys.has(id)), missingIds: recordingIds.filter((id) => !localKeys.has(id)) },
      backingTracks: { availableIds: backingTrackIds.filter((id) => prefixedBackingTracks.has(id)), missingIds: backingTrackIds.filter((id) => !prefixedBackingTracks.has(id)), orphanIds: [...prefixedBackingTracks].filter((id) => !expectedBackingTracks.has(id)).slice(0, 100) },
      storage,
    };
  } finally {
    database.close();
  }
}

export async function estimateBrowserStorage(): Promise<{ usageBytes?: number; quotaBytes?: number }> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return {};
  const estimate = await navigator.storage.estimate();
  return { usageBytes: typeof estimate.usage === "number" ? estimate.usage : undefined, quotaBytes: typeof estimate.quota === "number" ? estimate.quota : undefined };
}
