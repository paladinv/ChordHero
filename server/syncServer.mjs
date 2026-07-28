import http from "node:http";
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const port = Number(process.env.CHORD_HERO_SYNC_PORT ?? 8787);
const storePath = resolve(process.env.CHORD_HERO_SYNC_STORE ?? resolve(dirname(fileURLToPath(import.meta.url)), "sync-store.json"));
const libraries = new Map();
const clients = new Map();

async function loadStore() { try { const parsed = JSON.parse(await readFile(storePath, "utf8")); Object.entries(parsed).forEach(([id, value]) => libraries.set(id, value)); } catch { /* first start */ } }
async function persist() { const data = JSON.stringify(Object.fromEntries(libraries), null, 2); const temporary = `${storePath}.tmp`; await writeFile(temporary, data); await rename(temporary, storePath); }
function account(request) { return request.headers.get ? request.headers.get("x-account-id") : request.headers["x-account-id"]; }
function roleFor(record, accountID) { if (!accountID) return null; if (record.ownerId === accountID) return "owner"; return record.permissions?.[accountID] ?? null; }
function canWrite(role) { return role === "owner" || role === "editor"; }
function json(response, status, body) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(body)); }
async function body(request) { const chunks = []; for await (const chunk of request) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
function broadcast(libraryID, message) { (clients.get(libraryID) ?? new Set()).forEach((socket) => { if (socket.readyState === 1) socket.send(JSON.stringify(message)); }); }

const server = http.createServer(async (request, response) => {
  const match = request.url?.match(/^\/sync\/([^/?]+)$/); if (!match) return json(response, 404, { error: "Not found" });
  const libraryID = decodeURIComponent(match[1]); let record = libraries.get(libraryID); const accountID = account(request);
  if (request.method === "GET") { if (!record) return json(response, 404, { error: "Library not found" }); if (!roleFor(record, accountID)) return json(response, 403, { error: "Permission denied" }); return json(response, 200, record); }
  if (request.method === "POST") {
    const payload = await body(request); if (!record) { if (!accountID) return json(response, 401, { error: "Account required" }); record = { libraryID, ownerId: accountID, revision: 0, updatedAt: new Date().toISOString(), permissions: {}, state: payload.state }; }
    const role = roleFor(record, accountID); if (!canWrite(role)) return json(response, 403, { error: "Editor permission required" });
    if (Number(payload.baseRevision) !== Number(record.revision)) return json(response, 409, { error: "Revision conflict", current: record });
    record = { ...record, revision: record.revision + 1, updatedAt: new Date().toISOString(), state: payload.state }; libraries.set(libraryID, record); await persist(); broadcast(libraryID, { type: "library.updated", ...record }); return json(response, 200, record);
  }
  return json(response, 405, { error: "Method not allowed" });
});

const websocket = new WebSocketServer({ noServer: true });
websocket.on("connection", (socket, request, context) => { const set = clients.get(context.libraryID) ?? new Set(); set.add(socket); clients.set(context.libraryID, set); socket.send(JSON.stringify({ type: "library.snapshot", ...libraries.get(context.libraryID) })); socket.on("close", () => set.delete(socket)); });
server.on("upgrade", (request, socket, head) => { const match = request.url?.match(/^\/sync\/([^/?]+)\/events\?account=([^&]+)/); if (!match) return socket.destroy(); const libraryID = decodeURIComponent(match[1]); const record = libraries.get(libraryID); if (!record || !roleFor(record, decodeURIComponent(match[2]))) return socket.destroy(); websocket.handleUpgrade(request, socket, head, (client) => websocket.emit("connection", client, request, { libraryID })); });

await loadStore(); server.listen(port, () => console.log(`Chord Hero sync server listening on http://localhost:${port}`));
