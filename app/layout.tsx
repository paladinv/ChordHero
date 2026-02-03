import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chord Hero",
  description: "Practice fast chord changes with timed chord flashes and level progression."
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
            <img
              src="/chord-hero-logo.svg"
              alt="Chord Hero logo"
              className="logo"
            />
            <span>Chord Hero</span>
          </Link>
          <nav className="site-nav">
            <Link href="/">Trainer</Link>
            <Link href="/chords">Chord Chart</Link>
            <Link href="/about">About</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
