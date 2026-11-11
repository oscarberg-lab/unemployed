import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job matches",
  description: "A calm daily look at the jobs that fit you, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Nav />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
