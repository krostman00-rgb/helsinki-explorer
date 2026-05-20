"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

const INTERESTS = [
  { key: "food", label: "Ruoka & Ravintolat", emoji: "🍽️" },
  { key: "nature", label: "Luonto & Puistot", emoji: "🌿" },
  { key: "museums", label: "Museot & Kulttuuri", emoji: "🏛️" },
  { key: "design", label: "Design & Arkkitehtuuri", emoji: "🎨" },
  { key: "nightlife", label: "Yöelämä & Baarit", emoji: "🍸" },
  { key: "shopping", label: "Ostokset", emoji: "🛍️" },
  { key: "sea", label: "Meri & Saaristo", emoji: "⛵" },
  { key: "history", label: "Historia", emoji: "📜" },
  { key: "sports", label: "Urheilu & Aktiviteetit", emoji: "🚴" },
  { key: "kids", label: "Perhe & Lapset", emoji: "👨‍👩‍👧" },
  { key: "wellness", label: "Hyvinvointi & Sauna", emoji: "🧖" },
  { key: "events", label: "Tapahtumat & Festivaalit", emoji: "🎭" },
] as const;

const BUDGET_OPTIONS = [
  { value: 1, label: "€", description: "Edullinen" },
  { value: 2, label: "€€", description: "Kohtuullinen" },
  { value: 3, label: "€€€", description: "Reilu" },
  { value: 4, label: "€€€€", description: "Luksus" },
] as const;

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [durationDays, setDurationDays] = useState(3);
  const [budgetLevel, setBudgetLevel] = useState<number>(2);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleInterest = (key: string) => {
    setSelectedInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        title: `Helsinki ${durationDays} päivää`,
        duration_days: durationDays,
        budget_level: budgetLevel,
        interests: selectedInterests,
        status: "planning",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create trip:", error.message);
      setIsSubmitting(false);
      return;
    }

    router.push(`/trips/${data.id}`);
  };

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] px-6 py-8">
      {/* Progress indicator */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-foreground" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Duration */}
      {step === 1 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h2 className="text-2xl font-bold">Kuinka kauan viivyt?</h2>
            <p className="text-muted-foreground mt-1">Vedä slider sopivaan päivämäärään</p>
          </div>

          <div className="flex flex-col items-center gap-4 py-8">
            <span className="text-6xl font-bold tabular-nums">{durationDays}</span>
            <span className="text-muted-foreground">
              {durationDays === 1 ? "päivä" : "päivää"}
            </span>
            <input
              type="range"
              min={1}
              max={7}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full accent-foreground"
            />
            <div className="flex justify-between w-full text-xs text-muted-foreground">
              <span>1 pv</span>
              <span>7 pv</span>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full mt-auto"
            onClick={() => setStep(2)}
          >
            Seuraava →
          </Button>
        </div>
      )}

      {/* Step 2 — Budget */}
      {step === 2 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h2 className="text-2xl font-bold">Mikä on budjettisi?</h2>
            <p className="text-muted-foreground mt-1">Valitse sinulle sopiva taso</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {BUDGET_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => setBudgetLevel(value)}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  budgetLevel === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="text-xl font-bold">{label}</div>
                <div className="text-sm mt-0.5 opacity-70">{description}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-auto">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
              ← Takaisin
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(3)}>
              Seuraava →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Interests */}
      {step === 3 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h2 className="text-2xl font-bold">Mistä pidät?</h2>
            <p className="text-muted-foreground mt-1">
              Valitse vähintään 2 kiinnostuksen kohdetta
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {INTERESTS.map(({ key, label, emoji }) => {
              const isSelected = selectedInterests.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleInterest(key)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm text-left transition-colors ${
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-medium leading-tight">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3 mt-auto">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>
              ← Takaisin
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={selectedInterests.length < 2 || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Luodaan..." : "Luo matka →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
