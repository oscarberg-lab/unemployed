"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Matches" },
  { href: "/tracker", label: "Applications" },
  { href: "/insights", label: "Skill gaps" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/jobs") : pathname.startsWith(href));
  return (
    <nav aria-label="Main">
      <Link href="/" className="brand">Job matches</Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="nav-link" aria-current={isCurrent(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
