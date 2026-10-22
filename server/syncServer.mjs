import http from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const port = Number(process.env.CHORD_HERO_SYNC_PORT ?? 8787);
const host = process.env.CHORD_HERO_SYNC_HOST ?? "127.0.0.1";
const storePath = resolve(process.env.CHORD_HERO_SYNC_STORE ?? resolve(dirname(fileURLToPath(import.meta.url)), "sync-store.json"));
const libraries = new Map();
const clients = new Map();
const tickets = new Map();
let persistQueue = Promise.resolve();
const allowedOrigins = new Set((process.env.CHORD_HERO_SYNC_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean));
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const TICKET_TTL_MS = 60_000;

function digest(token) { return createHash("sha256").update(token).digest(); }
function loadCredentials() {
  let configured;
  try { configured = JSON.parse(process.env.CHORD_HERO_SYNC_ACCOUNTS ?? "{}"); }
  catch { throw new Error("CHORD_HERO_SYNC_ACCOUNTS must be a JSON object mapping account IDs to access tokens."); }
  if (!configured || typeof configured !== "object" || Array.isArray(configured)) throw new Error("CHORD_HERO_SYNC_ACCOUNTS must be a JSON object mapping account IDs to access tokens.");
  const result = new Map();
  for (const [accountID, token] of Object.entries(configured)) {
    if (!identifier.test(accountID) || typeof token !== "string" || token.length < 32) throw new Error("Each sync account needs a valid account ID and an access token at least 32 characters long.");
    const tokenDigest = digest(token);
    if ([...result.values()].some((previous) => timingSafeEqual(previous, tokenDigest))) throw new Error("Each sync account must have a unique access token.");
    result.set(accountID, tokenDigest);
  }
  if (!result.size) throw new Error("Set CHORD_HERO_SYNC_ACCOUNTS before starting the sync server. The server will not accept identifier-only access.");
  return result;
}
const credentials = loadCredentials();

async function loadStore() {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    Object.entries(parsed).forEach(([id, value]) => libraries.set(id, value));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
function persist() {
  const data = JSON.stringify(Object.fromEntries(libraries), null, 2);
  const task = persistQueue.catch(() => undefined).then(async () => {
    const temporary = `${storePath}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(temporary, data, { mode: 0o600, flag: "wx" });
    await rename(temporary, storePath);
  });
  persistQueue = task;
  return task;
}
function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(body));
}
function account(request) {
  const accountID = request.headers["x-account-id"];
  const authorization = request.headers.authorization;
  if (typeof accountID !== "string" || !identifier.test(accountID) || typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
  const expected = credentials.get(accountID);
  const supplied = authorization.slice(7);
  if (!expected || supplied.length < 32) return null;
  return timingSafeEqual(expected, digest(supplied)) ? accountID : null;
}
function roleFor(record, accountID) {
  if (!accountID) return null;
  if (record.ownerId === accountID) return "owner";
  return record.permissions?.[accountID] ?? null;
}
function canWrite(role) { return role === "owner" || role === "editor"; }
function broadcast(libraryID, message) {
  (clients.get(libraryID) ?? new Set()).forEach(({ socket, accountID }) => {
    const role = roleFor(libraries.get(libraryID) ?? {}, accountID);
    if (role && socket.readyState === 1) socket.send(JSON.stringify({ ...message, accessRole: role }));
    else socket.close(1008, "Library access revoked");
  });
}
async function body(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }); }
}
function setCors(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "Authorization, Content-Type, X-Account-Id");
    response.setHeader("vary", "Origin");
  }
}
function originAllowed(origin, request) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try { return new URL(origin).host === request.headers.host; }
  catch { return false; }
}
function newTicket(libraryID, accountID) {
  for (const [key, value] of tickets) if (value.expiresAt <= Date.now()) tickets.delete(key);
  const ticket = randomBytes(32).toString("base64url");
  tickets.set(ticket, { libraryID, accountID, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}

const server = http.createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    if (!originAllowed(request.headers.origin, request)) return json(response, 403, { error: "Origin is not allowed" });
    response.writeHead(204, { "cache-control": "no-store" });
    return response.end();
  }
  try {
    const route = request.url?.match(/^\/sync\/([^/?]+)(?:\/(ticket|access))?(?:\?.*)?$/);
    if (!route) return json(response, 404, { error: "Not found" });
    let libraryID;
    try { libraryID = decodeURIComponent(route[1]); }
    catch { return json(response, 400, { error: "Invalid library ID" }); }
    if (!identifier.test(libraryID)) return json(response, 400, { error: "Invalid library ID" });
    const operation = route[2] ?? "library";
    const record = libraries.get(libraryID);
    const accountID = account(request);
    if (!accountID) return json(response, 401, { error: "Valid account ID and access token required" });

    if (operation === "ticket" && request.method === "POST") {
      if (!record || !roleFor(record, accountID)) return json(response, 403, { error: "Permission denied" });
      return json(response, 200, { ticket: newTicket(libraryID, accountID), expiresInMs: TICKET_TTL_MS });
    }

    if (operation === "access" && request.method === "POST") {
      if (!record) return json(response, 404, { error: "Library not found" });
      if (roleFor(record, accountID) !== "owner") return json(response, 403, { error: "Only the library owner can manage access" });
      const payload = await body(request);
      const memberID = typeof payload.accountId === "string" ? payload.accountId.trim() : "";
      const role = payload.role;
      if (!identifier.test(memberID) || memberID === record.ownerId || !credentials.has(memberID)) return json(response, 400, { error: "Choose a configured collaborator account ID" });
      if (!["viewer", "editor", null].includes(role)) return json(response, 400, { error: "Role must be viewer, editor, or null to remove access" });
      const permissions = { ...(record.permissions ?? {}) };
      if (role === null) delete permissions[memberID];
      else permissions[memberID] = role;
      const updated = { ...record, permissions, updatedAt: new Date().toISOString() };
      libraries.set(libraryID, updated);
      await persist();
      broadcast(libraryID, { type: "library.access-updated", ...updated });
      return json(response, 200, { permissions: updated.permissions, updatedAt: updated.updatedAt });
    }

    if (operation !== "library") return json(response, 405, { error: "Method not allowed" });
    if (request.method === "GET") {
      if (!record) return json(response, 404, { error: "Library not found" });
      if (!roleFor(record, accountID)) return json(response, 403, { error: "Permission denied" });
      return json(response, 200, { ...record, accessRole: roleFor(record, accountID) });
    }
    if (request.method === "POST") {
      const payload = await body(request);
      if (!payload.state || typeof payload.state !== "object" || Array.isArray(payload.state)) return json(response, 400, { error: "Library state is required" });
      let nextRecord = record;
      if (!nextRecord) nextRecord = { libraryID, ownerId: accountID, revision: 0, updatedAt: new Date().toISOString(), permissions: {}, state: payload.state };
      const role = roleFor(nextRecord, accountID);
      if (!canWrite(role)) return json(response, 403, { error: "Editor permission required" });
      if (Number(payload.baseRevision) !== Number(nextRecord.revision)) return json(response, 409, { error: "Revision conflict", current: nextRecord });
      nextRecord = { ...nextRecord, revision: nextRecord.revision + 1, updatedAt: new Date().toISOString(), state: payload.state };
      libraries.set(libraryID, nextRecord);
      await persist();
      broadcast(libraryID, { type: "library.updated", ...nextRecord });
      return json(response, 200, { ...nextRecord, accessRole: roleFor(nextRecord, accountID) });
    }
    return json(response, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(response, Number(error?.statusCode) || 500, { error: Number(error?.statusCode) ? error.message : "Sync request failed" });
  }
});

const websocket = new WebSocketServer({ noServer: true, maxPayload: MAX_BODY_BYTES });
websocket.on("connection", (socket, _request, context) => {
  const set = clients.get(context.libraryID) ?? new Set();
  const client = { socket, accountID: context.accountID };
  set.add(client);
  clients.set(context.libraryID, set);
  const record = libraries.get(context.libraryID);
  socket.send(JSON.stringify({ type: "library.snapshot", ...record, accessRole: roleFor(record, context.accountID) }));
  socket.on("close", () => { set.delete(client); if (!set.size) clients.delete(context.libraryID); });
  socket.on("error", () => socket.close());
});
server.on("upgrade", (request, socket, head) => {
  let url;
  try { url = new URL(request.url ?? "/", "http://localhost"); }
  catch { return socket.destroy(); }
  const match = url.pathname.match(/^\/sync\/([^/]+)\/events$/);
  if (!match) return socket.destroy();
  const origin = request.headers.origin;
  if (!originAllowed(origin, request)) return socket.destroy();
  let libraryID;
  try { libraryID = decodeURIComponent(match[1]); }
  catch { return socket.destroy(); }
  const ticket = url.searchParams.get("ticket") ?? "";
  const grant = tickets.get(ticket);
  tickets.delete(ticket);
  const record = libraries.get(libraryID);
  if (!grant || grant.expiresAt <= Date.now() || grant.libraryID !== libraryID || !record || !roleFor(record, grant.accountID)) return socket.destroy();
  websocket.handleUpgrade(request, socket, head, (client) => websocket.emit("connection", client, request, { libraryID, accountID: grant.accountID }));
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

await loadStore();
server.listen(port, host, () => console.log(`Chord Hero authenticated sync server listening on http://${host}:${port}`));
