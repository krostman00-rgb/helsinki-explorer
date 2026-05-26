"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { Currency, Units } from "@/lib/settings";

// ── Context type ──────────────────────────────────────────────
type SettingsContextType = {
  currency: Currency;
  units:    Units;
  setCurrency: (c: Currency) => void;
  setUnits:    (u: Units)    => void;
};

const SettingsContext = createContext<SettingsContextType>({
  currency:    "EUR",
  units:       "metric",
  setCurrency: () => {},
  setUnits:    () => {},
});

// ── Provider ──────────────────────────────────────────────────
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("EUR");
  const [units,    setUnitsState]    = useState<Units>("metric");

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    const c = localStorage.getItem("hh_currency") as Currency | null;
    const u = localStorage.getItem("hh_units")    as Units    | null;
    if (c && ["EUR","USD","GBP","SEK"].includes(c)) setCurrencyState(c);
    if (u && ["metric","imperial"].includes(u))      setUnitsState(u);
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("hh_currency", c);
  };

  const setUnits = (u: Units) => {
    setUnitsState(u);
    localStorage.setItem("hh_units", u);
  };

  return (
    <SettingsContext.Provider value={{ currency, units, setCurrency, setUnits }}>
      {children}
    </SettingsContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────
export function useSettings(): SettingsContextType {
  return useContext(SettingsContext);
}
