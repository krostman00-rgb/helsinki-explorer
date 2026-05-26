"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const HIDDEN_ON = ["/", "/onboarding", "/discover"];

// Lucide Luggage icon (exact paths from lucide-luggage-icon)
function LuggageIcon({ active }: { active: boolean }) {
  const w = active ? 2 : 1.5;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2" stroke="currentColor" strokeWidth={w}/>
      <path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" stroke="currentColor" strokeWidth={w}/>
      <path d="M10 20h4" stroke="currentColor" strokeWidth={w}/>
      <circle cx="16" cy="20" r="2" stroke="currentColor" strokeWidth={w}/>
      <circle cx="8" cy="20" r="2" stroke="currentColor" strokeWidth={w}/>
    </svg>
  );
}

const NAV_ITEMS = [
  {
    href: "/trips",
    label: "Trips",
    icon: (active: boolean) => <LuggageIcon active={active}/>,
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
  {
    href: "/me",
    label: "Me",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth={active ? 2 : 1.5}/>
        <path d="M3.5 19c0-3.5 3.4-6.5 7.5-6.5s7.5 3 7.5 6.5"
          stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round"/>
      </svg>
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  // Prefetch all nav destinations on mount so tab switches are instant
  useEffect(() => {
    NAV_ITEMS.forEach(item => router.prefetch(item.href));
  }, [router]);

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(250,247,241,0.95)",
      borderTop: "0.5px solid rgba(180,165,145,0.3)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    }}>
      <ul style={{ display: "flex", height: 68, alignItems: "stretch", margin: 0, padding: "0 12px", listStyle: "none" }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <li key={label} style={{ flex: 1, display: "flex" }}>
              <Link
                href={href}
                prefetch
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 3, textDecoration: "none",
                  color: isActive ? "var(--hh-ink-900)" : "var(--hh-stone-500)",
                  transition: "color 0.18s ease",
                  position: "relative",
                }}
              >
                <span style={{ transition: "transform 0.18s ease", transform: isActive ? "scale(1)" : "scale(0.92)" }}>
                  {icon(isActive)}
                </span>
                <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 10, fontWeight: isActive ? 500 : 400, letterSpacing: "0.04em", transition: "opacity 0.18s ease", opacity: isActive ? 1 : 0.7 }}>
                  {label}
                </span>
                {isActive && (
                  <span style={{ position: "absolute", bottom: 6, width: 4, height: 4, borderRadius: "50%", background: "#C96E48", animation: "hh-dot-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}/>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
