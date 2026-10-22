export type BuilderTake = {
  id: string;
  songId: string;
  name: string;
  notes: string;
  createdAt: string;
  offset: number;
  signature: string;
  blob: Blob;
};
const database = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("chord-hero-builder-takes", 1); request.onupgradeneeded = () => { const store = request.result.createObjectStore("takes", { keyPath: "id" }); store.createIndex("songId", "songId"); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
export async function listBuilderTakes(songId: string): Promise<BuilderTake[]> {
  const db = await database(); try {
    return await new Promise((resolve, reject) => { const request = db.transaction("takes").objectStore("takes").index("songId").getAll(songId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  }
    finally {
    db.close();
  }
}
export async function saveBuilderTake(take: BuilderTake) {
  const db = await database(); try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction("takes", "readwrite"); tx.objectStore("takes").put(take); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  }
    finally {
    db.close();
  }
}
export async function deleteBuilderTake(id: string) {
  const db = await database(); try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction("takes", "readwrite"); tx.objectStore("takes").delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  }
    finally {
    db.close();
  }
}
