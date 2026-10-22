import { TrendingDown, TrendingUp } from "lucide-react";
import type { ComputedKPIs } from "@/lib/types";
import { KPI_CONFIG } from "@/lib/constants";
import { deltaPercent } from "@/lib/kpi";
import { formatCurrency, formatCurrencyPrecise, formatNumber, formatPercent, cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/primitives";

function formatValue(value: number, format: string, currency: string): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, currency);
    case "currency2":
      return formatCurrencyPrecise(value, currency);
    case "percent":
      return formatPercent(value);
    default:
      return formatNumber(value);
  }
}

// Pour les coûts, une baisse est une bonne nouvelle.
const LOWER_IS_BETTER = new Set(["cpm", "cpl"]);

export function KPIGrid({ kpis, previous, currency }: { kpis: ComputedKPIs; previous?: ComputedKPIs; currency: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {KPI_CONFIG.map((k) => {
        const value = kpis[k.key];
        const prev = previous ? previous[k.key] : undefined;
        const delta = prev !== undefined ? deltaPercent(value, prev) : null;
        const good = delta !== null && (LOWER_IS_BETTER.has(k.key) ? delta < 0 : delta > 0);
        const bad = delta !== null && delta !== 0 && !good;
        return (
          <div key={k.key} className="bg-card rounded-lg border border-border px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {k.label}
              <InfoTip text={k.tip} />
            </div>
            <div className="text-2xl font-semibold tnum mt-1.5 text-foreground">{formatValue(value, k.format, currency)}</div>
            <div className="h-5 mt-1 flex items-center text-xs">
              {delta !== null ? (
                <span className={cn("inline-flex items-center gap-1 font-medium tnum", good ? "text-positive" : bad ? "text-negative" : "text-muted-foreground")}>
                  {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  {delta > 0 ? "+" : ""}
                  {delta.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}&nbsp;%
                  <span className="text-muted-foreground font-normal">vs période précédente</span>
                </span>
              ) : (
                <span className="text-muted-foreground">{prev === 0 || !isFinite(prev ?? NaN) ? "pas de comparaison" : ""}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
