import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chord Hero",
  description: "Focused guitar chord practice tools for fast changes, songs, and voicing study."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand-link">
            <Image
              src="/chord-hero-logo.svg"
              alt="Chord Hero logo"
              className="logo"
              width={92}
              height={92}
            />
            <span>Chord Hero</span>
          </Link>
          <nav className="site-nav">
            <Link href="/">Home</Link>
            <Link href="/trainer">Trainer</Link>
            <Link href="/right-hand">Right Hand</Link>
            <Link href="/songs">Songs</Link>
            <Link href="/library">Library</Link>
            <Link href="/chords">Chord Chart</Link>
            <Link href="/about">About</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <strong>License:</strong> GNU GPL v3.0. You are free to share and adapt this project
          under the terms of the GPL-3.0 license.
        </footer>
      </body>
    </html>
  );
}
