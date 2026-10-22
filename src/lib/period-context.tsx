"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { addDaysIso } from "./utils";

export type PeriodPreset = "7" | "30" | "90" | "all" | "custom";

interface PeriodValue {
  start: string;
  end: string;
  preset: PeriodPreset;
  bounds: { start: string; end: string };
  setPreset: (p: Exclude<PeriodPreset, "custom">) => void;
  setCustom: (start: string, end: string) => void;
}

const PeriodContext = createContext<PeriodValue | null>(null);

function clamp(iso: string, bounds: { start: string; end: string }): string {
  if (bounds.start && iso < bounds.start) return bounds.start;
  if (bounds.end && iso > bounds.end) return bounds.end;
  return iso;
}

export function PeriodProvider({ dataPeriod, children }: { dataPeriod: { start: string; end: string }; children: ReactNode }) {
  const bounds = useMemo(() => {
    const end = dataPeriod.end || new Date().toISOString().slice(0, 10);
    const start = dataPeriod.start || addDaysIso(end, -179);
    return { start, end };
  }, [dataPeriod.start, dataPeriod.end]);

  // 90 jours par défaut : les campagnes se diffusent par vagues, une fenêtre plus courte est souvent vide.
  const [preset, setPresetState] = useState<PeriodPreset>("90");
  const [custom, setCustomState] = useState<{ start: string; end: string }>({ start: addDaysIso(bounds.end, -29), end: bounds.end });

  const value = useMemo<PeriodValue>(() => {
    let start = custom.start;
    let end = custom.end;
    if (preset === "all") {
      start = bounds.start;
      end = bounds.end;
    } else if (preset !== "custom") {
      end = bounds.end;
      start = clamp(addDaysIso(end, -(parseInt(preset, 10) - 1)), bounds);
    }
    return {
      start,
      end,
      preset,
      bounds,
      setPreset: (p) => setPresetState(p),
      setCustom: (s, e) => {
        const cs = clamp(s, bounds);
        const ce = clamp(e, bounds);
        if (!cs || !ce || cs > ce) return;
        setCustomState({ start: cs, end: ce });
        setPresetState("custom");
      },
    };
  }, [preset, custom, bounds]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used inside PeriodProvider");
  return ctx;
}
