import Link from "next/link";

const dashboardCards = [
  {
    href: "/trainer",
    eyebrow: "Timed practice",
    title: "Trainer",
    symbol: "01",
    description: "Run 10-chord rounds with 3-second flashes, level progression, and quick review.",
    meta: ["3s flashes", "10 chords", "Auto levels"]
  },
  {
    href: "/right-hand",
    eyebrow: "Technique lab",
    title: "Right-Hand Studio",
    symbol: "02",
    description: "Follow animated strumming, plectrum, and fingerpicking drills at your own speed.",
    meta: ["30 exercises", "40–180 BPM", "3 skill levels"]
  },
  {
    href: "/songs",
    eyebrow: "Play-along",
    title: "Song Coach",
    symbol: "03",
    description: "Loop public-domain progressions with tempo controls, count-in, and chord tips.",
    meta: ["Tempo slider", "Metronome", "Chord tips"]
  },
  {
    href: "/library",
    eyebrow: "Explore",
    title: "Chord Library",
    symbol: "04",
    description: "Search voicings, compare shapes, save favorites, schedule reviews, and preview audio.",
    meta: ["Filters", "Compare", "Ear training"]
  },
  {
    href: "/chords",
    eyebrow: "Reference",
    title: "Chord Chart",
    symbol: "05",
    description: "Browse and print chord diagrams by level and root for music-stand reference.",
    meta: ["Printable", "By level", "By root"]
  },
  {
    href: "/about",
    eyebrow: "Project",
    title: "About",
    symbol: "06",
    description: "Read the practice philosophy, project notes, and GPL license summary.",
    meta: ["Purpose", "License", "Method"]
  }
];

export default function HomePage() {
  return (
    <main className="page dashboard-page">
      <section className="dashboard-hero studio-heading">
        <div>
          <span className="tag">Chord Hero</span>
          <h1>Pick one practice mode and get straight to work.</h1>
          <p>
            The app is now arranged as focused tools instead of one long scroll. Choose the page
            that matches today&apos;s session.
          </p>
        </div>
        <Link className="dashboard-primary studio-session-note" href="/trainer">
          <span className="label">Start here</span>
          <strong>Open Trainer</strong>
          <span>Fast chord changes with level progression.</span>
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Chord Hero tools">
        {dashboardCards.map((card) => (
          <Link key={card.href} href={card.href} className="dashboard-card">
            <span className="dashboard-card-symbol" aria-hidden="true">{card.symbol}</span>
            <div className="dashboard-card-copy">
              <span className="label">{card.eyebrow}</span>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
              <div className="dashboard-card-meta">
                {card.meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            <span className="dashboard-card-arrow" aria-hidden="true">›</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
