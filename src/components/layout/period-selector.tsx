"use client";

import { CalendarDays } from "lucide-react";
import { usePeriod, type PeriodPreset } from "@/lib/period-context";
import { formatDate, daysBetween } from "@/lib/utils";
import { previousRange } from "@/lib/kpi";
import { cn } from "@/lib/utils";

const PRESETS: Array<{ key: Exclude<PeriodPreset, "custom">; label: string }> = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "all", label: "Full history" },
];

export function PeriodSelector() {
  const { start, end, preset, bounds, setPreset, setCustom } = usePeriod();
  const prev = previousRange(start, end);
  const days = daysBetween(start, end);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="inline-flex bg-muted p-1 rounded-md gap-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              "px-3 py-1.5 rounded-[6px] text-sm font-medium transition-colors",
              preset === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <input
          id="period-start"
          type="date"
          value={start}
          min={bounds.start}
          max={end}
          onChange={(e) => e.target.value && setCustom(e.target.value, end)}
          className="bg-card border border-border rounded-md px-2 py-1 text-sm"
          aria-label="Period start"
        />
        <span className="text-muted-foreground">to</span>
        <input
          id="period-end"
          type="date"
          value={end}
          min={start}
          max={bounds.end}
          onChange={(e) => e.target.value && setCustom(start, e.target.value)}
          className="bg-card border border-border rounded-md px-2 py-1 text-sm"
          aria-label="Period end"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {days} {days === 1 ? "day" : "days"}, compared with {formatDate(prev.start)} to {formatDate(prev.end)}
      </p>
    </div>
  );
}
