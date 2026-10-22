"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatDate, formatDateShort, formatNumber } from "@/lib/utils";

interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export function TimeSeriesChart({ data, series, type = "area", height = 240, stacked = false }: { data: ReadonlyArray<{ date: string } & object>; series: SeriesDef[]; type?: "area" | "bar"; height?: number; stacked?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rows = data.map((d) => ({ ...(d as Record<string, number | string>), label: formatDateShort(String(d.date)) }));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnée sur la période.</p>;

  const tooltip = (
    <Tooltip
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const p = payload[0].payload as Record<string, number | string>;
        return (
          <div className="bg-card border border-border rounded-md shadow-lg px-3 py-2 text-xs">
            <p className="font-medium mb-1">{formatDate(String(p.date))}</p>
            {series.map((s) => (
              <p key={s.key}>
                <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: s.color }} />
                {s.label} : <span className="tnum font-medium">{formatNumber(Number(p[s.key] || 0))}</span>
              </p>
            ))}
          </div>
        );
      }}
    />
  );

  return (
    <div style={{ height }}>
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ef" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5f6783" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: "#5f6783" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={40} allowDecimals={false} />
              {tooltip}
              {series.length > 1 && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? "a" : undefined} radius={stacked ? undefined : [3, 3, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          ) : (
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ef" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5f6783" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: "#5f6783" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={40} allowDecimals={false} />
              {tooltip}
              {series.length > 1 && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
              {series.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} dot={false} isAnimationActive={false} />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
