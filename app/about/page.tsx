"use client";

export default function AboutPage() {
  return (
    <main className="page about focused-page">
      <section className="studio-heading about-hero">
        <div>
          <span className="tag">About</span>
          <h1>Built to make chord changes feel effortless.</h1>
          <p>
            Chord Hero is a focused practice companion for guitarists who want to switch chords
            faster, cleaner, and with more confidence. The trainer keeps you on a tight clock while
            the library and song coach help you explore voicings and musical context.
          </p>
        </div>
        <div className="studio-session-note">
          <span className="label">The method</span>
          <strong>See it · shape it · hear it</strong>
          <span>Short loops turn deliberate movement into dependable muscle memory.</span>
        </div>
      </section>

      <section className="about-method" aria-label="How Chord Hero works">
        {["Start a focused drill", "Review the hard changes", "Use the shape in a song"].map((step, index) => (
          <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></div>
        ))}
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
        <div className="about-card">
          <h3>Recorded audio</h3>
          <p>
            Guitar previews use D. Smolken&apos;s CC0 Emilyguitar recordings. Practice clicks use
            Joseph Sardin&apos;s CC0 studio-recorded hi-hat from BigSoundBank. Both are bundled for
            reliable offline playback.
          </p>
        </div>
      </section>
    </main>
  );
}
