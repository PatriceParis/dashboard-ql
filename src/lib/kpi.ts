import type { ComputedKPIs, DailyAnalytics, Metrics } from "./types";
import { addDaysIso, daysBetween } from "./utils";

export function emptyMetrics(): Metrics {
  return {
    impressions: 0, clicks: 0, spend: 0, leads: 0, formOpens: 0, landingPageClicks: 0, engagements: 0,
    likes: 0, comments: 0, shares: 0, follows: 0, videoViews: 0, videoQ1: 0, videoMid: 0, videoQ3: 0, videoCompletions: 0,
  };
}

export function sumMetrics(rows: Metrics[]): Metrics {
  const out = emptyMetrics();
  for (const r of rows) {
    for (const k of Object.keys(out) as Array<keyof Metrics>) out[k] += r[k] || 0;
  }
  return out;
}

export function computeKPIs(rows: Metrics[]): ComputedKPIs {
  const m = sumMetrics(rows);
  return {
    ...m,
    cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
    ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
    cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
    cpl: m.leads > 0 ? m.spend / m.leads : Infinity,
    engagementRate: m.impressions > 0 ? (m.engagements / m.impressions) * 100 : 0,
  };
}

export function filterDaily(daily: DailyAnalytics[], start: string, end: string, campaignIds?: Set<string>): DailyAnalytics[] {
  return daily.filter((d) => d.date >= start && d.date <= end && (!campaignIds || campaignIds.has(d.campaignId)));
}

// Période de comparaison : même durée, juste avant la période courante.
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

export function deltaPercent(current: number, previous: number): number | null {
  if (!isFinite(current) || !isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
