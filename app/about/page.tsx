"use client";

export default function AboutPage() {
  return (
    <main className="page about">
      <section className="about-hero">
        <div>
          <p className="eyebrow">About</p>
          <h1>Built to make chord changes feel effortless.</h1>
          <p>
            Chord Hero is a focused practice companion for guitarists who want to switch chords
            faster, cleaner, and with more confidence. The trainer keeps you on a tight clock while
            the library and song coach help you explore voicings and musical context.
          </p>
        </div>
        <div className="about-card">
          <h2>How it works</h2>
          <ol>
            <li>Start a timed round and watch the chord flashes.</li>
            <li>Use the history panel to review tricky changes.</li>
            <li>Jump into the library to explore new voicings.</li>
            <li>Play along with public-domain songs in the coach.</li>
          </ol>
        </div>
      </section>

      <section className="about-details">
        <div className="about-card">
          <h3>Practice philosophy</h3>
          <p>
            Short, focused bursts build muscle memory fast. The 3-second cadence trains your hands
            to anticipate shapes rather than react to them.
          </p>
        </div>
        <div className="about-card">
          <h3>Made for every level</h3>
          <p>
            Start with open chords, add spice with sus and dominant shapes, then climb into barre
            grips and inversions when you are ready.
          </p>
        </div>
        <div className="about-card">
          <h3>License</h3>
          <p>
            Chord Hero is released under the GNU GPL v3.0 license. You are welcome to share and
            remix it, as long as derivative work remains open under GPL-3.0 terms.
          </p>
        </div>
      </section>
    </main>
  );
}
