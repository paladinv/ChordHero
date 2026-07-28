import { checkSourceHealth, type SongSourceHealth } from "./songLibrary";

export type SourceAttempt = { provider: string; url: string; startedAt: string; durationMs: number; ok: boolean; error?: string };

export async function retrySourceHealth(url: string, provider = "Ultimate Guitar", attempts = 3): Promise<{ health: SongSourceHealth; history: SourceAttempt[] }> {
  const history: SourceAttempt[] = [];
  for (let attempt = 0; attempt < Math.max(1, Math.min(5, attempts)); attempt += 1) {
    const started = Date.now(); const startedAt = new Date(started).toISOString();
    try { const health = await checkSourceHealth(url); history.push({ provider, url, startedAt, durationMs: Date.now() - started, ok: health.status === "online", error: health.status === "online" ? undefined : "Source unavailable" }); if (health.status === "online") return { health, history }; } catch (error) { history.push({ provider, url, startedAt, durationMs: Date.now() - started, ok: false, error: error instanceof Error ? error.message : "Unknown source error" }); }
  }
  return { health: { url, status: "offline", checkedAt: new Date().toISOString() }, history };
}
