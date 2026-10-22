"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/localeClient";

type PinnedChart = { id: string; name: string; selectedIds?: unknown[]; pinned?: boolean };
const CHART_STORAGE_KEY = "chord-hero:chart-builder:v1";
const dashboardTranslations = {
  "/practice": ["dailyPlan", "dailyPlanDescription"],
  "/trainer": ["trainer", "trainerDescription"],
  "/right-hand": ["rightHand", "rightHandDescription"],
  "/songs": ["songs", "songCoachDescription"],
  "/song-builder": ["songBuilder", "songBuilderDescription"],
  "/library": ["library", "libraryDescription"],
  "/chords": ["chordChart", "chordChartDescription"],
  "/about": ["about", "aboutDescription"]
} as const;

const dashboardCards = [
  { href: "/practice", symbol: "00" }, { href: "/trainer", symbol: "01" },
  { href: "/right-hand", symbol: "02" }, { href: "/songs", symbol: "03" },
  { href: "/song-builder", symbol: "04" }, { href: "/library", symbol: "05" },
  { href: "/chords", symbol: "06" }, { href: "/about", symbol: "07" }
];

export default function HomePage() {
  const { t } = useLocale();
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
          <h1>{t("homeHeadline")}</h1>
          <p>
            {t("homeIntro")}
          </p>
        </div>
        <Link className="dashboard-primary studio-session-note" href="/trainer">
          <span className="label">{t("homeStart")}</span>
          <strong>{t("homeOpenTrainer")}</strong>
          <span>{t("homeTrainerSummary")}</span>
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Chord Hero tools">
        {dashboardCards.map((card) => {
          const [titleKey, descriptionKey] = dashboardTranslations[card.href as keyof typeof dashboardTranslations];
          return <Link key={card.href} href={card.href} className="dashboard-card">
            <span className="dashboard-card-symbol" aria-hidden="true">{card.symbol}</span>
            <div className="dashboard-card-copy">
              <h2>{t(titleKey)}</h2>
              <p>{t(descriptionKey)}</p>
            </div>
            <span className="dashboard-card-arrow" aria-hidden="true">›</span>
          </Link>;
        })}
      </section>
      {pinnedCharts.length ? <section className="dashboard-pinned-charts" aria-label="Pinned chord charts"><div><span className="label">Quick rehearsal</span><h2>Pinned chord charts</h2><p>Saved locally in this browser for one-tap access.</p></div><div className="dashboard-pinned-list">{pinnedCharts.map((chart) => <Link key={chart.id} className="dashboard-pinned-card" href={`/chords?chart=${encodeURIComponent(chart.id)}`}><strong>{chart.name}</strong><span>{chart.selectedIds?.length ?? 0} selected cards</span><span aria-hidden="true">›</span></Link>)}</div></section> : null}
    </main>
  );
}
