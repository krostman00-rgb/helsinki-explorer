"use client";

/**
 * Brand splash screen — shown while auth/initial-data is settling.
 * Placeholder design; will be replaced with a richer one later.
 *
 * Renders fixed, fills the viewport, fades out via CSS keyframe.
 */
export function Splash() {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "#F4EFE5",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20,
        animation: "hh-fade-in 0.2s ease",
      }}
    >
      {/* HelloHel mark — circle + dot + wordmark */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        fontFamily: "var(--font-geist-sans)",
        fontSize: 18, fontWeight: 600, letterSpacing: "0.18em",
        textTransform: "uppercase", color: "#1A1611",
      }}>
        <svg width="22" height="22" viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r="6.25" fill="none" stroke="#1A1611" strokeWidth="1.25"/>
          <circle cx="7" cy="7" r="2" fill="#1A1611">
            <animate attributeName="r" values="2;2.6;2" dur="1.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.55;1" dur="1.4s" repeatCount="indefinite"/>
          </circle>
        </svg>
        <span>
          hello<span style={{ opacity: 0.55 }}>·</span>hel
        </span>
      </div>

      {/* Subtle tagline */}
      <div style={{
        fontFamily: "var(--font-geist-mono)", fontSize: 10,
        color: "#8C8170", letterSpacing: "0.18em", textTransform: "uppercase",
      }}>
        A field guide
      </div>
    </div>
  );
}
