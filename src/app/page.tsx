import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

// HelloHel wordmark — circle + dot + "hello·hel"
function HhMark({ color = "currentColor" }: { color?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color }}>
      <svg width="13" height="13" viewBox="0 0 14 14" style={{ flex: "0 0 auto" }}>
        <circle cx="7" cy="7" r="6.25" fill="none" stroke={color} strokeWidth="1.25"/>
        <circle cx="7" cy="7" r="2" fill={color}/>
      </svg>
      <span>hello<span style={{ opacity: 0.55 }}>·</span>hel</span>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div style={{ width: "100%", height: "calc(100dvh - 0px)", position: "relative", overflow: "hidden", background: "#F4EFE5" }}>
      {/* Full-bleed hero — Helsinki Cathedral alley, golden hour */}
      <div style={{ position: "absolute", inset: 0 }}>
        <Image
          src="/assets/helsinki-cathedral-alley.jpg"
          alt="Helsinki Cathedral golden hour"
          fill
          className="object-cover"
          priority
        />
        {/* bottom dark gradient — headline reads against it */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,31,51,0) 0%, rgba(10,31,51,0) 40%, rgba(10,31,51,0.45) 72%, rgba(10,31,51,0.88) 100%)" }}/>
        {/* top scrim — wordmark stays legible against bright sky */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, background: "linear-gradient(180deg, rgba(10,15,25,0.35) 0%, rgba(10,15,25,0) 100%)" }}/>
      </div>

      {/* Top bar: wordmark + EN pill */}
      <div style={{ position: "absolute", top: 64, left: 24, right: 24, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <HhMark color="#FAF7F1"/>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(250,247,241,0.14)", border: "0.5px solid rgba(250,247,241,0.35)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "#FAF7F1", fontSize: 11, letterSpacing: "0.04em" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><circle cx="7" cy="7" r="5.5" stroke="#FAF7F1" strokeWidth="1.2"/><path d="M1.5 7h11M7 1.5c1.7 2 1.7 9 0 11M7 1.5c-1.7 2-1.7 9 0 11" stroke="#FAF7F1" strokeWidth="1.2"/></svg>
          <span>EN</span>
        </div>
      </div>

      {/* Editorial caption */}
      <div style={{ position: "absolute", top: 120, left: 24, right: 24, zIndex: 2, color: "rgba(250,247,241,0.78)", fontFamily: "var(--font-geist-mono)", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
        <span>N° 01 · A field guide</span>
        <span>60.169° N</span>
      </div>

      {/* Serif headline — anchored low */}
      <div style={{ position: "absolute", left: 24, right: 24, bottom: 180, zIndex: 2, color: "#FAF7F1" }}>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 72, lineHeight: 0.94, letterSpacing: "-0.025em", fontWeight: 400 }}>
          Hei,<br/>
          <span style={{ fontStyle: "italic" }}>Helsinki.</span>
        </div>
        <p style={{ marginTop: 18, fontSize: 15.5, lineHeight: 1.45, maxWidth: 300, color: "rgba(250,247,241,0.86)", fontWeight: 350 }}>
          A city guide shaped to your days — saunas, sea, design and the in-between.
        </p>
      </div>

      {/* CTAs */}
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 56, zIndex: 2, display: "flex", flexDirection: "column", gap: 0 }}>
        <Link
          href="/onboarding"
          style={{ width: "100%", height: 60, borderRadius: 28, border: "none", background: "var(--hh-copper-600)", color: "#FAF7F1", fontFamily: "var(--font-geist-sans)", fontSize: 16, fontWeight: 500, letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 8px 24px rgba(182,90,55,0.35), inset 0 1px 0 rgba(255,255,255,0.18)", textDecoration: "none" }}
        >
          Plan my Helsinki <ArrowRight size={18} strokeWidth={1.8}/>
        </Link>
        <div style={{ marginTop: 16, textAlign: "center", color: "rgba(250,247,241,0.72)", fontSize: 13.5 }}>
          Returning?{" "}
          <Link href="/trips" style={{ color: "#FAF7F1", textDecoration: "underline", textDecorationColor: "rgba(250,247,241,0.4)", textUnderlineOffset: 4 }}>Open my trips</Link>
        </div>
      </div>
    </div>
  );
}
