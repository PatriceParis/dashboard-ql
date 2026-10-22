"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyAnalytics, Metrics } from "@/lib/types";
import { aggregateByDate } from "@/lib/kpi";
import { CHART_COLORS } from "@/lib/constants";
import { formatCompact, formatCurrency, formatDate, formatDateShort, formatNumber, cn } from "@/lib/utils";

type Secondary = "clicks" | "engagements" | "leads" | "spend";

const SECONDARY: Array<{ key: Secondary; label: string; color: string }> = [
  { key: "clicks", label: "Clicks", color: CHART_COLORS.clicks },
  { key: "engagements", label: "Engagements", color: CHART_COLORS.engagements },
  { key: "leads", label: "Leads", color: CHART_COLORS.leads },
  { key: "spend", label: "Spend", color: CHART_COLORS.spend },
];

export function PerformanceChart({ rows, currency }: { rows: DailyAnalytics[]; currency: string }) {
  const [secondary, setSecondary] = useState<Secondary>("clicks");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => aggregateByDate(rows).map((d) => ({ ...d, label: formatDateShort(d.date) })), [rows]);
  const sec = SECONDARY.find((s) => s.key === secondary)!;
  const fmtSecondary = (v: number) => (secondary === "spend" ? formatCurrency(v, currency) : formatNumber(v));

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No ad delivery over this period.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.impressions }} />
          Impressions
        </span>
        <span className="text-muted-foreground">Compare with:</span>
        <div className="inline-flex gap-1">
          {SECONDARY.map((s) => (
            <button
              key={s.key}
              onClick={() => setSecondary(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors",
                secondary === s.key ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[300px]">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradImpr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.impressions} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_COLORS.impressions} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ef" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5f6783" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#5f6783" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={48} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#5f6783" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={44} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Metrics & { date: string };
                  return (
                    <div className="bg-card border border-border rounded-md shadow-lg px-3 py-2 text-xs">
                      <p className="font-medium mb-1">{formatDate(p.date)}</p>
                      <p>Impressions: <span className="tnum font-medium">{formatNumber(p.impressions)}</span></p>
                      <p>{sec.label}: <span className="tnum font-medium">{fmtSecondary(p[secondary])}</span></p>
                    </div>
                  );
                }}
              />
              <Area yAxisId="left" type="monotone" dataKey="impressions" stroke={CHART_COLORS.impressions} strokeWidth={2} fill="url(#gradImpr)" dot={false} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey={secondary} stroke={sec.color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
