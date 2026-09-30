"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PinnedChart = { id: string; name: string; selectedIds?: unknown[]; pinned?: boolean };
const CHART_STORAGE_KEY = "chord-hero:chart-builder:v1";

const dashboardCards = [
  {
    href: "/practice",
    eyebrow: "Recommended today",
    title: "Daily Practice Plan",
    symbol: "00",
    description: "Balance chord changes, songs, and right-hand work with adaptive local recommendations.",
    meta: ["Daily goals", "Weak-skill picks", "Shareable reports"]
  },
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
    meta: ["36 exercises", "Guided rounds", "3 skill levels"]
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
    href: "/song-builder",
    eyebrow: "Original music",
    title: "Song Builder",
    symbol: "04",
    description: "Write guitar, ukulele, and bass parts, hear the arrangement, and export notation.",
    meta: ["Tab and notation", "Play along", "PNG and PDF"]
  },
  {
    href: "/library",
    eyebrow: "Explore",
    title: "Chord Library",
    symbol: "05",
    description: "Search voicings, compare shapes, save favorites, schedule reviews, and preview audio.",
    meta: ["Filters", "Compare", "Ear training"]
  },
  {
    href: "/chords",
    eyebrow: "Reference",
    title: "Chord Chart",
    symbol: "06",
    description: "Browse and print chord diagrams by level and root for music-stand reference.",
    meta: ["Printable", "By level", "By root"]
  },
  {
    href: "/about",
    eyebrow: "Project",
    title: "About",
    symbol: "07",
    description: "Read the practice philosophy, project notes, and GPL license summary.",
    meta: ["Purpose", "License", "Method"]
  }
];

export default function HomePage() {
  const [pinnedCharts, setPinnedCharts] = useState<PinnedChart[]>([]);
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(CHART_STORAGE_KEY) ?? "[]");
      if (Array.isArray(parsed)) setPinnedCharts(parsed.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const chart = value as Partial<PinnedChart>;
        return chart.pinned === true && typeof chart.id === "string" && typeof chart.name === "string"
          ? [{ id: chart.id, name: chart.name, selectedIds: Array.isArray(chart.selectedIds) ? chart.selectedIds : [] }]
          : [];
      }).slice(0, 6));
    } catch { setPinnedCharts([]); }
  }, []);
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
      {pinnedCharts.length ? <section className="dashboard-pinned-charts" aria-label="Pinned chord charts"><div><span className="label">Quick rehearsal</span><h2>Pinned chord charts</h2><p>Saved locally in this browser for one-tap access.</p></div><div className="dashboard-pinned-list">{pinnedCharts.map((chart) => <Link key={chart.id} className="dashboard-pinned-card" href={`/chords?chart=${encodeURIComponent(chart.id)}`}><strong>{chart.name}</strong><span>{chart.selectedIds?.length ?? 0} selected cards</span><span aria-hidden="true">›</span></Link>)}</div></section> : null}
    </main>
  );
}
