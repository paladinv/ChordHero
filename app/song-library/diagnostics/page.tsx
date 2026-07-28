"use client";

import { useMemo, useState } from "react";
import { readSongLibraryState, writeSongLibraryState, type SongLibraryState } from "../../../lib/songLibrary";
import { retrySourceHealth } from "../../../lib/songSourceDiagnostics";

export default function SongSourceDiagnosticsPage() {
  const [state, setState] = useState<SongLibraryState>(() => readSongLibraryState());
  const [message, setMessage] = useState("");
  const imported = useMemo(() => state.songs.filter((song) => song.sourceUrl), [state.songs]);
  const retry = (url: string) => void retrySourceHealth(url).then(({ health, history }) => { const next = { ...state, sourceHealth: [...state.sourceHealth.filter((item) => item.url !== url), health] }; writeSongLibraryState(next); setState(next); setMessage(`${url}: ${health.status}; ${history.length} attempt(s).`); });
  return <main className="page focused-page"><section className="studio-heading"><div><span className="tag">Provider diagnostics</span><h1>Source health</h1><p>Review saved-source availability and retry failures without copying protected content.</p></div></section><section className="library-management-card diagnostics-card"><div className="diagnostics-summary"><strong>{imported.length}</strong><span>saved sources</span><strong>{state.sourceHealth.filter((item) => item.status === "online").length}</strong><span>available</span></div>{imported.length ? imported.map((song) => { const health = state.sourceHealth.find((item) => item.url === song.sourceUrl); return <div className="diagnostic-row" key={song.id}><span><strong>{song.title}</strong><small>{song.sourceUrl}</small></span><span className={`diagnostic-status ${health?.status ?? "unknown"}`}>{health?.status ?? "not checked"}</span><button className="text-button" type="button" onClick={() => retry(song.sourceUrl as string)}>Retry</button></div>; }) : <p className="muted">No imported sources to diagnose.</p>}</section>{message && <p className="toast-message" role="status">{message}</p>}</main>;
}
