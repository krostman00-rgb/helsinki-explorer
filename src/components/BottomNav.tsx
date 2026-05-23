"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Hide the nav on fullscreen editorial screens
const HIDDEN_ON = ["/", "/onboarding"];

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/trips",
    label: "Trips",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M7 3h8a1 1 0 011 1v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM9 7h4M9 11h4M9 15h2"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/map",
    label: "Map",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M8 3L3 5.5v13L8 16l6 3 5-2.5v-13L14 6 8 3zM8 3v13M14 6v13"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Pass",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3.5" y="5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.5}/>
        <path d="M3.5 9h15M8 3v4M14 3v4" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
        <circle cx="11" cy="13.5" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--hh-linen-50)", borderTop: "0.5px solid var(--hh-linen-300)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <ul style={{ display: "flex", height: 68, alignItems: "stretch", margin: 0, padding: 0, listStyle: "none" }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <li key={label} style={{ flex: 1, display: "flex" }}>
              <Link
                href={href}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textDecoration: "none", color: isActive ? "var(--hh-ink-900)" : "var(--hh-stone-500)", transition: "color 0.15s" }}
              >
                {icon(isActive)}
                <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 10, fontWeight: isActive ? 500 : 400, letterSpacing: "0.04em" }}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
