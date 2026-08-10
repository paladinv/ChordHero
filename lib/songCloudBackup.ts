import { migrateSongLibraryState, type SongLibraryState } from "./songLibrary";

function bytesToBase64(bytes: Uint8Array): string { let binary = ""; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary); }
function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }

export async function encryptLibraryBackup(state: SongLibraryState, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 120000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, new TextEncoder().encode(JSON.stringify(state)) as unknown as BufferSource);
  return JSON.stringify({ version: 1, algorithm: "PBKDF2-AES-GCM", salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) });
}

export async function decryptLibraryBackup(payload: string, password: string): Promise<SongLibraryState> {
  const encrypted = JSON.parse(payload); const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: base64ToBytes(encrypted.salt) as unknown as BufferSource, iterations: 120000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(encrypted.iv) as unknown as BufferSource }, key, base64ToBytes(encrypted.ciphertext) as unknown as BufferSource);
  const state = migrateSongLibraryState(JSON.parse(new TextDecoder().decode(plaintext))); if (!state.songs.length && !state.collections.length) throw new Error("Invalid library backup"); return state;
}

/**
 * Account-backed synchronization seam. Local storage remains the default until
 * an authenticated provider is supplied by the host application.
 */
export type SongCloudBackupProvider = {
  id: string;
  label: string;
  isAvailable: () => boolean;
  upload: (state: SongLibraryState) => Promise<void>;
  download: () => Promise<SongLibraryState | null>;
};

export const futureAccountBackup: SongCloudBackupProvider = {
  id: "account-sync",
  label: "Account backup and sharing",
  isAvailable: () => false,
  upload: async () => { throw new Error("Account backup is not configured."); },
  download: async () => null,
};
