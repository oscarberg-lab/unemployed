import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job matches",
  description: "Daily job search, graded against your CV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <nav>
            <Link href="/" className="brand">Job matches</Link>
            <Link href="/tracker">Tracker</Link>
            <Link href="/insights">Skill gaps</Link>
            <Link href="/profile">CV &amp; preferences</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
