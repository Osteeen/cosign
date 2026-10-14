"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The owner's main places, one click from anywhere.
const LINKS = [
  { href: "/", label: "Agents", match: (p: string) => p === "/" || p.startsWith("/agents") || p.startsWith("/approvals") },
  { href: "/spending", label: "Spending", match: (p: string) => p.startsWith("/spending") },
  { href: "/activity", label: "Activity", match: (p: string) => p.startsWith("/activity") },
  { href: "/addresses", label: "Addresses", match: (p: string) => p.startsWith("/addresses") },
];

export function MainNav() {
  const path = usePathname();
  return (
    <nav className="main-nav" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="main-nav-link" aria-current={l.match(path) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
