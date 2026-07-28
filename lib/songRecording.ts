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
