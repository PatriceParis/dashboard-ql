import { TrendingDown, TrendingUp } from "lucide-react";
import type { ComputedKPIs } from "@/lib/types";
import { KPI_CONFIG, type KpiFormat } from "@/lib/constants";
import { deltaPercent } from "@/lib/kpi";
import { formatCurrency, formatCurrencyPrecise, formatNumber, formatPercent, formatSeconds, cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/primitives";

function formatValue(value: number | null, format: KpiFormat, currency: string): string {
  if (value === null) return "–";
  switch (format) {
    case "currency":
      return formatCurrency(value, currency);
    case "currency2":
      return formatCurrencyPrecise(value, currency);
    case "percent":
      return formatPercent(value);
    case "seconds":
      return formatSeconds(value);
    default:
      return formatNumber(value);
  }
}

export function KPIGrid({ kpis, previous, currency, reachAvailable }: { kpis: ComputedKPIs; previous?: ComputedKPIs; currency: string; reachAvailable: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {KPI_CONFIG.map((k) => {
        const value = kpis[k.key as keyof ComputedKPIs] as number | null;
        const prev = previous ? (previous[k.key as keyof ComputedKPIs] as number | null) : null;
        const delta = deltaPercent(value, prev);
        const good = delta !== null && (k.lowerIsBetter ? delta < 0 : delta > 0);
        const bad = delta !== null && delta !== 0 && !good;
        const unavailable = k.reachBased && !reachAvailable;
        return (
          <div key={k.key} className="bg-card rounded-lg border border-border px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="truncate">{k.label}</span>
              <InfoTip text={k.tip} />
            </div>
            <div className="text-2xl font-semibold tnum mt-1.5 text-foreground">{unavailable ? "–" : formatValue(value, k.format, currency)}</div>
            <div className="h-5 mt-1 flex items-center text-xs">
              {unavailable ? (
                <span className="text-muted-foreground">standard periods only</span>
              ) : k.key === "costPer1kReached" && kpis.reach ? (
                <span className="text-muted-foreground tnum">{formatNumber(kpis.reach)} members reached</span>
              ) : delta !== null ? (
                <span className={cn("inline-flex items-center gap-1 font-medium tnum", good ? "text-positive" : bad ? "text-negative" : "text-muted-foreground")}>
                  {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  {delta > 0 ? "+" : ""}
                  {delta.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%
                  <span className="text-muted-foreground font-normal">vs previous period</span>
                </span>
              ) : (
                <span className="text-muted-foreground">no comparison</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
