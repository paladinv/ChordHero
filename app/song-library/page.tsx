"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import sharedSongContent from "../../shared/content/v1/songs.json";
import {
  emptySongLibraryState,
  matchesSongFilters,
  normalizeImportedSong,
  readSongLibraryState,
  songChords,
  type LibrarySong,
  type SongLibraryState,
  writeSongLibraryState,
} from "../../lib/songLibrary";
import { ultimateGuitarSource } from "../../lib/songSource";

const BUNDLED_SONGS = sharedSongContent.songs as unknown as LibrarySong[];
const techniqueLabels: Record<string, string> = { All: "All techniques", strumming: "Strumming", fingerpicking: "Fingerpicking", plectrum: "Plectrum" };

export default function SongLibraryPage() {
  const [state, setState] = useState<SongLibraryState>(() => readSongLibraryState());
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [key, setKey] = useState("All");
  const [meter, setMeter] = useState("All");
  const [technique, setTechnique] = useState("All");
  const [libraryId, setLibraryId] = useState("All");
  const [selectedId, setSelectedId] = useState(BUNDLED_SONGS[0]?.id ?? "");
  const [selectedVariationId, setSelectedVariationId] = useState(BUNDLED_SONGS[0]?.variations[0]?.id ?? "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceArtist, setSourceArtist] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [status, setStatus] = useState("");

  const allSongs = useMemo(() => [...BUNDLED_SONGS, ...state.songs], [state.songs]);
  const selectedSong = allSongs.find((song) => song.id === selectedId) ?? allSongs[0];
  const selectedVariation = selectedSong?.variations.find((variation) => variation.id === selectedVariationId) ?? selectedSong?.variations[0];
  const filteredSongs = useMemo(() => allSongs.filter((song) => matchesSongFilters(song, { query, difficulty, key, meter, technique, libraryId }, state.collections)), [allSongs, difficulty, key, libraryId, meter, query, state.collections, technique]);
  const keys = useMemo(() => Array.from(new Set(allSongs.flatMap((song) => [song.key, ...song.variations.map((variation) => variation.key)]))).sort(), [allSongs]);
  const meters = useMemo(() => Array.from(new Set(allSongs.flatMap((song) => [song.timeSignature, ...song.variations.map((variation) => variation.timeSignature)]))).sort(), [allSongs]);
  const difficulties = useMemo(() => Array.from(new Set(allSongs.map((song) => song.difficulty))).sort(), [allSongs]);

  const updateState = (next: SongLibraryState) => {
    setState(next);
    writeSongLibraryState(next);
  };

  const selectSong = (song: LibrarySong) => {
    setSelectedId(song.id);
    setSelectedVariationId(song.variations[0]?.id ?? "");
  };

  const createLibrary = () => {
    const name = window.prompt("Name your song library", "My practice songs")?.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const collection = { id: `library-${crypto.randomUUID()}`, name, description: "A personal song collection", songIds: [], createdAt: now, updatedAt: now };
    updateState({ ...state, collections: [...state.collections, collection] });
    setLibraryId(collection.id);
    setStatus(`Created ${name}.`);
  };

  const addToLibrary = (collectionId: string) => {
    if (!selectedSong) return;
    const now = new Date().toISOString();
    const collections = state.collections.map((collection) => collection.id === collectionId && !collection.songIds.includes(selectedSong.id)
      ? { ...collection, songIds: [...collection.songIds, selectedSong.id], updatedAt: now }
      : collection);
    updateState({ ...state, collections });
    setStatus(`Saved ${selectedSong.title} to your library.`);
  };

  const removeFromLibrary = (collectionId: string) => {
    if (!selectedSong) return;
    const collections = state.collections.map((collection) => collection.id === collectionId
      ? { ...collection, songIds: collection.songIds.filter((id) => id !== selectedSong.id), updatedAt: new Date().toISOString() }
      : collection);
    updateState({ ...state, collections });
    setStatus(`Removed ${selectedSong.title}.`);
  };

  const deleteLibrary = (collectionId: string) => {
    const collection = state.collections.find((item) => item.id === collectionId);
    if (!collection || !window.confirm(`Delete ${collection.name}? Songs will remain in the catalogue.`)) return;
    updateState({ ...state, collections: state.collections.filter((item) => item.id !== collectionId) });
    if (libraryId === collectionId) setLibraryId("All");
  };

  const renameLibrary = (collectionId: string) => {
    const collection = state.collections.find((item) => item.id === collectionId);
    const name = collection && window.prompt("Rename song library", collection.name)?.trim();
    if (!collection || !name) return;
    updateState({ ...state, collections: state.collections.map((item) => item.id === collectionId ? { ...item, name, updatedAt: new Date().toISOString() } : item) });
  };

  const saveSourceLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sourceUrl.trim()) return;
    const song = normalizeImportedSong({ title: sourceTitle, artist: sourceArtist, sourceUrl, notes: sourceNotes });
    const next = { ...state, songs: [...state.songs, song] };
    updateState(next);
    setSelectedId(song.id);
    setSelectedVariationId(song.variations[0].id);
    setSourceUrl(""); setSourceTitle(""); setSourceArtist(""); setSourceNotes("");
    setStatus("Saved the source link locally. The original page remains the source for protected tab and lyric content.");
  };

  return (
    <main className="page focused-page song-library-page">
      <section className="studio-heading">
        <div>
          <span className="tag">Song Library</span>
          <h1>Build a practice catalogue that feels like yours.</h1>
          <p>Search fifty traditional and public-domain songs, save collections, and choose the right-hand arrangement for today&apos;s practice.</p>
        </div>
        <div className="studio-session-note"><span className="label">Catalogue</span><strong>{allSongs.length} songs · {allSongs.reduce((total, song) => total + song.variations.length, 0)} variations</strong><span>Everything you save here stays on this device.</span></div>
      </section>

      <section className="song-library-layout">
        <div className="song-library-browser">
          <div className="song-library-toolbar">
            <label className="search-field"><span className="sr-only">Search songs</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, artist, lyrics, chords…" /></label>
            <button className="btn" type="button" onClick={createLibrary}>New library</button>
          </div>
          <div className="song-filter-grid">
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Difficulty"><option value="All">All difficulties</option>{difficulties.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={key} onChange={(event) => setKey(event.target.value)} aria-label="Key"><option value="All">All keys</option>{keys.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={meter} onChange={(event) => setMeter(event.target.value)} aria-label="Time signature"><option value="All">All meters</option>{meters.map((value) => <option key={value}>{value}</option>)}</select>
            <select value={technique} onChange={(event) => setTechnique(event.target.value)} aria-label="Technique">{Object.entries(techniqueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={libraryId} onChange={(event) => setLibraryId(event.target.value)} aria-label="Song library"><option value="All">All collections</option>{state.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>
          </div>
          <div className="song-library-count">{filteredSongs.length} result{filteredSongs.length === 1 ? "" : "s"}</div>
          <div className="song-library-list">
            {filteredSongs.map((song) => <button className={`song-library-row ${song.id === selectedSong?.id ? "active" : ""}`} key={song.id} type="button" onClick={() => selectSong(song)}><span><strong>{song.title}</strong><small>{song.artist} · {song.difficulty} · {song.timeSignature}</small></span><span className="song-row-tag">{song.origin === "imported" ? "Saved link" : song.tags[0] ?? "Traditional"}</span></button>)}
            {!filteredSongs.length && <div className="empty-state"><strong>No songs match those filters.</strong><span>Try a broader search or clear a filter.</span></div>}
          </div>
        </div>

        {selectedSong && <aside className="song-library-detail">
          <div className="detail-kicker">{selectedSong.origin === "imported" ? "Saved source link" : selectedSong.license}</div>
          <h2>{selectedSong.title}</h2>
          <p className="muted">{selectedSong.artist} · {selectedSong.source}</p>
          <div className="song-detail-meta"><span>{selectedSong.key}</span><span>{selectedSong.timeSignature}</span><span>{selectedSong.difficulty}</span><span>{selectedSong.bpm} BPM</span></div>
          {selectedSong.sourceUrl && <p><a href={selectedSong.sourceUrl} target="_blank" rel="noreferrer" className="source-link">Open original source ↗</a></p>}
          <div className="variation-picker"><span className="label">Practice variation</span>{selectedSong.variations.map((variation) => <button className={`variation-card ${variation.id === selectedVariation?.id ? "active" : ""}`} key={variation.id} type="button" onClick={() => setSelectedVariationId(variation.id)}><strong>{variation.name}</strong><span>{techniqueLabels[variation.technique]} · {variation.key} · {variation.timeSignature} · {variation.bpm} BPM</span><small>{variation.pattern}</small></button>)}</div>
          <div className="song-detail-actions"><Link className="btn primary" href={`/songs?songId=${encodeURIComponent(selectedSong.id)}&variationId=${encodeURIComponent(selectedVariation?.id ?? "")}`}>Open Song Coach</Link>{state.collections.map((collection) => { const saved = collection.songIds.includes(selectedSong.id); return <button className="btn" key={collection.id} type="button" onClick={() => saved ? removeFromLibrary(collection.id) : addToLibrary(collection.id)}>{saved ? `Remove from ${collection.name}` : `Save to ${collection.name}`}</button>; })}</div>
          <div className="song-detail-section"><span className="label">Chord progression</span><div className="song-chord-inline">{songChords(selectedSong).map((chord, index) => <span key={`${chord}-${index}`}>{chord}</span>)}</div></div>
          {selectedSong.sections.map((section) => <div className="song-detail-section" key={section.id}><span className="label">{section.title}</span>{section.blocks.map((block, index) => block.type === "lyrics" ? <p key={index}>{block.text}</p> : block.type === "tab" ? <pre key={index}>{block.lines?.join("\n")}</pre> : block.type === "annotation" ? <p className="muted" key={index}>{block.text}</p> : null)}</div>)}
          {selectedSong.origin === "imported" && <p className="import-notice">Full offline tab/lyric import is available only when an authorized provider is configured. This saved link does not copy protected source content.</p>}
        </aside>}
      </section>

      <section className="song-library-bottom-grid">
        <div className="library-management-card"><div className="card-heading"><div><span className="label">Your collections</span><h2>Practice libraries</h2></div><button className="btn" type="button" onClick={createLibrary}>Create</button></div>{state.collections.length ? state.collections.map((collection) => <div className="collection-row" key={collection.id}><span><strong>{collection.name}</strong><small>{collection.songIds.length} songs</small></span><span><button className="text-button" type="button" onClick={() => renameLibrary(collection.id)}>Rename</button> <button className="text-button" type="button" onClick={() => deleteLibrary(collection.id)}>Delete</button></span></div>) : <p className="muted">Create a collection to keep a focused set of songs close at hand.</p>}</div>
        <form className="library-management-card" onSubmit={saveSourceLink}><div className="card-heading"><div><span className="label">{ultimateGuitarSource.label}</span><h2>Browse and save a source</h2></div><a className="btn" href={ultimateGuitarSource.searchURL(query)} target="_blank" rel="noreferrer">Browse UG ↗</a></div><p className="muted">Search Ultimate Guitar in the original site, then save a link here. No protected tab or lyric content is copied without an authorized provider.</p><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Ultimate Guitar URL" required type="url" /><div className="two-inputs"><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Song title" /><input value={sourceArtist} onChange={(event) => setSourceArtist(event.target.value)} placeholder="Artist" /></div><textarea value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} placeholder="Your practice notes (optional)" rows={3} /><button className="btn primary" type="submit">Save source link</button></form>
      </section>
      {status && <p className="toast-message" role="status">{status}</p>}
      <p className="library-storage-note">Local library storage is versioned and device-only. <button className="text-button" type="button" onClick={() => { updateState(emptySongLibraryState()); setStatus("Local custom libraries cleared."); }}>Clear custom data</button></p>
    </main>
  );
}
