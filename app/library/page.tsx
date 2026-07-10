"use client";

import dynamic from "next/dynamic";

const ChordLibraryExplorer = dynamic(() => import("../../components/ChordLibraryExplorer"), {
  ssr: false,
  loading: () => (
    <section className="library">
      <div>
        <h2>Chord library</h2>
        <p>Loading your saved chords, filters, and voicing explorer...</p>
      </div>
      <div className="library-card">
        <div className="history-empty">Preparing the library explorer...</div>
      </div>
    </section>
  )
});

export default function LibraryPage() {
  return (
    <main className="page focused-page library-page">
      <ChordLibraryExplorer />
    </main>
  );
}
