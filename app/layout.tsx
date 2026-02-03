import "./globals.css";
import type { Metadata } from "next";

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
        {children}
      </body>
    </html>
  );
}
