import "./globals.css";
import type { Metadata } from "next";
import LocalizedSiteShell from "../components/LocalizedSiteShell";

export const metadata: Metadata = {
  title: "Chord Hero",
  description: "Focused guitar chord practice tools for fast changes, songs, and voicing study.",
  manifest: "/manifest.webmanifest",
  themeColor: "#1f7a74",
  appleWebApp: { capable: true, title: "Chord Hero", statusBarStyle: "default" }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
      <html lang="en" suppressHydrationWarning>
        <body>
          <LocalizedSiteShell>{children}</LocalizedSiteShell>
      </body>
    </html>
  );
}
