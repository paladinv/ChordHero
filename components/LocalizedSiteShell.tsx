"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import AppEnhancements from "./AppEnhancements";
import { LocaleProvider, useLocale } from "../lib/localeClient";
import LocalizedDocumentText from "./LocalizedDocumentText";

function SiteChrome({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const links = [
    ["/", t("home")], ["/practice", t("dailyPlan")], ["/trainer", t("trainer")], ["/right-hand", t("rightHand")],
    ["/songs", t("songs")], ["/song-builder", t("songBuilder")], ["/song-library", t("songLibrary")],
    ["/library", t("library")], ["/chords", t("chordChart")], ["/about", t("about")]
  ];
  return <>
    <header className="site-header">
      <Link href="/" className="brand-link">
        <Image src="/chord-hero-logo.svg" alt="" className="logo" width={64} height={64} priority />
        <span className="brand-copy"><strong className="brand-name">Chord <em>Hero</em></strong><small>Practice Studio</small></span>
      </Link>
      <nav className="site-nav">{links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav>
    </header>
    {children}
    <AppEnhancements />
    <LocalizedDocumentText />
    <footer className="site-footer"><strong>{t("license")}</strong> GNU GPL v3.0. You are free to share and adapt this project under the terms of the GPL-3.0 license.</footer>
  </>;
}

export default function LocalizedSiteShell({ children }: { children: ReactNode }) {
  return <LocaleProvider><SiteChrome>{children}</SiteChrome></LocaleProvider>;
}
