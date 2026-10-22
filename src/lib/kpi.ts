import type { ComputedKPIs, DailyAnalytics, Metrics, ReachData, ReachWindow } from "./types";
import type { PeriodPreset } from "./period-context";
import { addDaysIso, daysBetween } from "./utils";

export function emptyMetrics(): Metrics {
  return {
    impressions: 0, clicks: 0, spend: 0, leads: 0, formOpens: 0, landingPageClicks: 0, engagements: 0,
    likes: 0, comments: 0, shares: 0, follows: 0, videoViews: 0, videoQ1: 0, videoMid: 0, videoQ3: 0, videoCompletions: 0,
    dwellWeighted: 0,
  };
}

export function sumMetrics(rows: Metrics[]): Metrics {
  const out = emptyMetrics();
  for (const r of rows) {
    for (const k of Object.keys(out) as Array<keyof Metrics>) out[k] += r[k] || 0;
  }
  return out;
}

// Reach-based figures are only known for the standard windows (unique members are not additive).
export function reachWindowForPreset(preset: PeriodPreset): ReachWindow | null {
  if (preset === "7") return "7d";
  if (preset === "30") return "30d";
  if (preset === "90") return "90d";
  if (preset === "all") return "all";
  return null;
}

export function computeKPIs(rows: Metrics[], reach?: ReachData, window?: ReachWindow | null): ComputedKPIs {
  const m = sumMetrics(rows);
  const w = window && reach?.windows?.[window] ? reach.windows[window] : null;
  const reached = w && w.total > 0 ? w.total : null;
  return {
    ...m,
    cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
    ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
    cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
    cpl: m.leads > 0 ? m.spend / m.leads : Infinity,
    engagementRate: m.impressions > 0 ? (m.engagements / m.impressions) * 100 : 0,
    dwellTime: m.impressions > 0 ? m.dwellWeighted / m.impressions : 0,
    reach: reached,
    costPer1kReached: reached ? (m.spend / reached) * 1000 : null,
    audiencePenetration: reached && w?.audienceSize ? (reached / w.audienceSize) * 100 : null,
  };
}

export function filterDaily(daily: DailyAnalytics[], start: string, end: string, campaignIds?: Set<string>): DailyAnalytics[] {
  return daily.filter((d) => d.date >= start && d.date <= end && (!campaignIds || campaignIds.has(d.campaignId)));
}

// Comparison period: same length, immediately before the current one.
export function previousRange(start: string, end: string): { start: string; end: string } {
  const days = daysBetween(start, end);
  const prevEnd = addDaysIso(start, -1);
  const prevStart = addDaysIso(prevEnd, -(days - 1));
  return { start: prevStart, end: prevEnd };
}

export function aggregateByCampaign(rows: DailyAnalytics[]): Map<string, Metrics> {
  const map = new Map<string, Metrics>();
  for (const r of rows) {
    const cur = map.get(r.campaignId) || emptyMetrics();
    for (const k of Object.keys(cur) as Array<keyof Metrics>) cur[k] += r[k] || 0;
    map.set(r.campaignId, cur);
  }
  return map;
}

export function aggregateByDate(rows: DailyAnalytics[]): Array<{ date: string } & Metrics> {
  const map = new Map<string, Metrics>();
  for (const r of rows) {
    const cur = map.get(r.date) || emptyMetrics();
    for (const k of Object.keys(cur) as Array<keyof Metrics>) cur[k] += r[k] || 0;
    map.set(r.date, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, m]) => ({ date, ...m }));
}

export function deltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !isFinite(current) || !isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
