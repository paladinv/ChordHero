"use client";

export default function AboutPage() {
  return (
    <main className="page about">
      <section className="about-hero">
        <div>
          <p className="eyebrow">About</p>
          <h1>Chord Hero is a focused practice room for guitarists.</h1>
          <p>
            The goal is simple: build confident, clean chord changes with short,
            repeatable bursts of practice. Use the timer to push speed, the
            chord library to study shapes, and the song coach to make the
            transitions musical.
          </p>
        </div>
        <div className="about-card">
          <h2>How to use it</h2>
          <ol>
            <li>Start a round and keep your fretting hand relaxed.</li>
            <li>Click a chord in the history to review its shape.</li>
            <li>Pick a public domain song and loop the progression.</li>
          </ol>
        </div>
      </section>

      <section className="about-details">
        <div>
          <h2>Designed for real practice</h2>
          <p>
            We balance strict timing with enough flexibility to pause, select,
            and study any chord. Inversions are included so you can hear and
            feel how voicings change the color of familiar progressions.
          </p>
        </div>
        <div>
          <h2>Open source</h2>
          <p>
            Chord Hero is released under the GNU GPL v3.0 license. You are free
            to use, study, modify, and share it under the same terms.
          </p>
        </div>
      </section>
    </main>
  );
}
