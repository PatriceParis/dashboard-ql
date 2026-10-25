"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Megaphone, Users } from "lucide-react";
import type { CompanyMetrics, CompanyWindow, Creative, DashboardData } from "@/lib/types";
import { usePeriod } from "@/lib/period-context";
import { aggregateByCampaign, computeKPIs, filterDaily, previousRange, reachWindowForPreset } from "@/lib/kpi";
import { isHighlyEngaged } from "@/lib/segments";
import { KPIGrid } from "./kpi-grid";
import { PerformanceChart } from "./performance-chart";
import { CampaignTable } from "./campaign-table";
import { Card, CardHeader } from "@/components/ui/primitives";
import { formatNumber, formatPercent, cn } from "@/lib/utils";

interface Summary {
  companyWindows: Record<CompanyWindow, CompanyMetrics[]>;
  followers: number;
  followerGains30: number;
  pageAvailable: boolean;
}

export function OverviewShell({ data, summary }: { data: DashboardData; summary: Summary }) {
  const { start, end, preset } = usePeriod();
  const currency = data.meta.currency || "EUR";
  const reachWindow = reachWindowForPreset(preset);

  const { kpis, previousKpis, periodRows, byCampaign } = useMemo(() => {
    const rows = filterDaily(data.dailyAnalytics, start, end);
    const prev = previousRange(start, end);
    const prevRows = filterDaily(data.dailyAnalytics, prev.start, prev.end);
    return {
      kpis: computeKPIs(rows, data.reach, reachWindow),
      previousKpis: computeKPIs(prevRows),
      periodRows: rows,
      byCampaign: aggregateByCampaign(rows),
    };
  }, [data.dailyAnalytics, data.reach, start, end, reachWindow]);

  const activeCampaigns = useMemo(() => Array.from(byCampaign.values()).filter((m) => m.impressions > 0).length, [byCampaign]);
  const reachByCampaign = reachWindow && data.reach.windows?.[reachWindow] ? data.reach.windows[reachWindow].byCampaign : null;

  // Companies card follows the selected period (7, 30 or 90-day company windows).
  const companyWindow: CompanyWindow = preset === "7" ? "7d" : preset === "30" ? "30d" : "90d";
  const companies = summary.companyWindows[companyWindow] || [];
  const companyCaption = companyWindow === "7d" ? "last 7 days" : companyWindow === "30d" ? "last 30 days" : "last 90 days";

  // Best-performing ads over 90 days (creative-level statistics), 1,000 impressions minimum.
  const topCreatives = useMemo(() => {
    // Click ranking: video ads are judged on views, so they are left out.
    const eligible = data.creatives.filter((c) => (c.impressions || 0) >= 1000 && c.mediaType !== "video");
    return eligible.sort((a, b) => (b.clicks || 0) / (b.impressions || 1) - (a.clicks || 0) / (a.impressions || 1)).slice(0, 3);
  }, [data.creatives]);

  const noData = data.dailyAnalytics.length === 0;

  return (
    <div className="space-y-5">
      {noData && (
        <div className="bg-warning-soft text-warning border border-warning/20 rounded-lg px-4 py-3 text-sm">
          LinkedIn data has not been retrieved yet. Run <code className="font-mono">npm run fetch-data</code> or wait for the next deployment.
        </div>
      )}

      <KPIGrid kpis={kpis} previous={previousKpis} currency={currency} reachAvailable={reachWindow !== null && kpis.reach !== null} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Daily delivery" subtitle={`${activeCampaigns} ad ${activeCampaigns === 1 ? "set" : "sets"} delivered over the period`} />
          <div className="px-5 pb-5">
            <PerformanceChart rows={periodRows} currency={currency} />
          </div>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
          <SummaryCard
            href="/entreprises"
            icon={<Building2 className="w-4 h-4" />}
            title="Companies reached by ads"
            caption={companyCaption}
            value={formatNumber(companies.length)}
            detail={`${formatNumber(companies.filter(isHighlyEngaged).length)} highly engaged`}
          />
          <SummaryCard
            href="/page-linkedin"
            icon={<Users className="w-4 h-4" />}
            title="Page followers"
            caption={summary.pageAvailable ? "last 30 days" : "page statistics unavailable"}
            value={formatNumber(summary.followers)}
            detail={summary.pageAvailable && summary.followerGains30 > 0 ? `+${formatNumber(summary.followerGains30)} new followers` : "see the Page"}
          />
        </div>
      </div>

      <Card>
        <CardHeader title="Campaigns" subtitle="Ad sets grouped by campaign, over the selected period. Members reached are shown for the standard periods." />
        <div className="px-2 pb-3">
          <CampaignTable campaigns={data.campaigns} metricsByCampaign={byCampaign} reachByCampaign={reachByCampaign} currency={currency} />
        </div>
      </Card>

      {topCreatives.length > 0 && (
        <Card>
          <CardHeader
            title="Most clicked ads"
            subtitle="Click-through rate over the last 90 days, 1,000 impressions minimum"
            action={
              <Link href="/publicites" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All ads <ArrowRight className="w-4 h-4" />
              </Link>
            }
          />
          <ul className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {topCreatives.map((c) => (
              <TopCreative key={c.id} creative={c} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ href, icon, title, caption, value, detail }: { href: string; icon: React.ReactNode; title: string; caption: string; value: string; detail: string }) {
  return (
    <Link href={href} className="bg-card rounded-lg border border-border px-5 py-4 flex flex-col gap-1 hover:border-primary/40 transition-colors group">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
      </div>
      <div className="text-2xl font-semibold tnum">{value}</div>
      <div className="text-sm text-muted-foreground">{detail}</div>
      <div className="text-xs text-muted-foreground/80">{caption}</div>
    </Link>
  );
}

function TopCreative({ creative }: { creative: Creative }) {
  const ctr = ((creative.clicks || 0) / (creative.impressions || 1)) * 100;
  return (
    <li className="flex gap-3 rounded-md border border-border p-3">
      <div className={cn("w-16 h-16 rounded-md shrink-0 bg-muted overflow-hidden flex items-center justify-center")}>
        {creative.localMediaPath ? <img src={creative.localMediaPath} alt="" className="w-full h-full object-cover" /> : <Megaphone className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium truncate">{creative.authorName || creative.headline || creative.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{creative.adText || creative.headline || "No text"}</p>
        <p className="text-xs mt-1 tnum">
          <span className="font-semibold text-positive">{formatPercent(ctr)}</span>
          <span className="text-muted-foreground"> CTR · {formatNumber(creative.impressions || 0)} impressions</span>
        </p>
      </div>
    </li>
  );
}
