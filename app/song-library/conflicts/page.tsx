"use client";

import { useState } from "react";
import { SongLibraryConflictPanel } from "../../../components/SongLibraryConflictPanel";
import { emptySongLibraryState, readSongLibraryState, writeSongLibraryState, type SongLibraryState } from "../../../lib/songLibrary";

export default function SongLibraryConflictsPage() {
  const [local, setLocal] = useState<SongLibraryState>(() => readSongLibraryState());
  const [remote] = useState<SongLibraryState>(() => emptySongLibraryState());
  const [message, setMessage] = useState("");
  return <main className="page focused-page"><section className="studio-heading"><div><span className="tag">Song Library</span><h1>Resolve sync changes</h1><p>When an account sync reports a revision conflict, this screen lets you choose or merge safely.</p></div></section><SongLibraryConflictPanel local={local} remote={remote} onResolve={(next) => { writeSongLibraryState(next); setLocal(next); setMessage("Conflict resolved locally. The next sync will publish this revision."); }} />{message && <p className="toast-message" role="status">{message}</p>}</main>;
}
