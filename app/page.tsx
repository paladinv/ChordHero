import Link from "next/link";

const dashboardCards = [
  {
    href: "/trainer",
    eyebrow: "Timed practice",
    title: "Trainer",
    description: "Run 10-chord rounds with 3-second flashes, level progression, and quick review.",
    meta: ["3s flashes", "10 chords", "Auto levels"]
  },
  {
    href: "/right-hand",
    eyebrow: "Technique lab",
    title: "Right-Hand Studio",
    description: "Follow animated strumming, plectrum, and fingerpicking drills at your own speed.",
    meta: ["30 exercises", "40–180 BPM", "3 skill levels"]
  },
  {
    href: "/songs",
    eyebrow: "Play-along",
    title: "Song Coach",
    description: "Loop public-domain progressions with tempo controls, count-in, and chord tips.",
    meta: ["Tempo slider", "Metronome", "Chord tips"]
  },
  {
    href: "/library",
    eyebrow: "Explore",
    title: "Chord Library",
    description: "Search voicings, compare shapes, save favorites, schedule reviews, and preview audio.",
    meta: ["Filters", "Compare", "Ear training"]
  },
  {
    href: "/chords",
    eyebrow: "Reference",
    title: "Chord Chart",
    description: "Browse and print chord diagrams by level and root for music-stand reference.",
    meta: ["Printable", "By level", "By root"]
  },
  {
    href: "/about",
    eyebrow: "Project",
    title: "About",
    description: "Read the practice philosophy, project notes, and GPL license summary.",
    meta: ["Purpose", "License", "Method"]
  }
];

export default function HomePage() {
  return (
    <main className="page dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="tag">Chord Hero</span>
          <h1>Pick one practice mode and get straight to work.</h1>
          <p>
            The app is now arranged as focused tools instead of one long scroll. Choose the page
            that matches today&apos;s session.
          </p>
        </div>
        <Link className="dashboard-primary" href="/trainer">
          <span className="label">Start here</span>
          <strong>Open Trainer</strong>
          <span>Fast chord changes with level progression.</span>
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Chord Hero tools">
        {dashboardCards.map((card) => (
          <Link key={card.href} href={card.href} className="dashboard-card">
            <span className="label">{card.eyebrow}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <div className="dashboard-card-meta">
              {card.meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
