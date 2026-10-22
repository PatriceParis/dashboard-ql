"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Megaphone, Users } from "lucide-react";
import type { Creative, DashboardData } from "@/lib/types";
import { usePeriod } from "@/lib/period-context";
import { aggregateByCampaign, computeKPIs, filterDaily, previousRange } from "@/lib/kpi";
import { KPIGrid } from "./kpi-grid";
import { PerformanceChart } from "./performance-chart";
import { CampaignTable } from "./campaign-table";
import { Card, CardHeader } from "@/components/ui/primitives";
import { formatNumber, formatPercent, cn } from "@/lib/utils";

interface Summary {
  companies30: number;
  highlyEngaged30: number;
  followers: number;
  followerGains30: number;
  pageAvailable: boolean;
}

export function OverviewShell({ data, summary }: { data: DashboardData; summary: Summary }) {
  const { start, end } = usePeriod();
  const currency = data.meta.currency || "EUR";

  const { kpis, previousKpis, periodRows, byCampaign } = useMemo(() => {
    const rows = filterDaily(data.dailyAnalytics, start, end);
    const prev = previousRange(start, end);
    const prevRows = filterDaily(data.dailyAnalytics, prev.start, prev.end);
    return { kpis: computeKPIs(rows), previousKpis: computeKPIs(prevRows), periodRows: rows, byCampaign: aggregateByCampaign(rows) };
  }, [data.dailyAnalytics, start, end]);

  const activeCampaigns = useMemo(() => Array.from(byCampaign.values()).filter((m) => m.impressions > 0).length, [byCampaign]);

  // Publicités les plus performantes sur 90 jours (statistiques par créative), 1 000 impressions minimum.
  const topCreatives = useMemo(() => {
    const eligible = data.creatives.filter((c) => (c.impressions || 0) >= 1000);
    return eligible.sort((a, b) => (b.clicks || 0) / (b.impressions || 1) - (a.clicks || 0) / (a.impressions || 1)).slice(0, 3);
  }, [data.creatives]);

  const noData = data.dailyAnalytics.length === 0;

  return (
    <div className="space-y-5">
      {noData && (
        <div className="bg-warning-soft text-warning border border-warning/20 rounded-lg px-4 py-3 text-sm">
          Les données LinkedIn n'ont pas encore été récupérées. Lancer <code className="font-mono">npm run fetch-data</code> ou attendre le prochain déploiement.
        </div>
      )}
      {data.meta.errors?.length > 0 && !noData && (
        <details className="bg-muted rounded-lg px-4 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">{data.meta.errors.length} avertissement(s) lors de la dernière récupération</summary>
          <ul className="list-disc ml-5 mt-1 space-y-0.5">
            {data.meta.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      <KPIGrid kpis={kpis} previous={previousKpis} currency={currency} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Diffusion jour par jour" subtitle={`${activeCampaigns} ${activeCampaigns > 1 ? "campagnes diffusées" : "campagne diffusée"} sur la période`} />
          <div className="px-5 pb-5">
            <PerformanceChart rows={periodRows} currency={currency} />
          </div>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
          <SummaryCard
            href="/entreprises"
            icon={<Building2 className="w-4 h-4" />}
            title="Entreprises touchées"
            caption="30 derniers jours"
            value={formatNumber(summary.companies30)}
            detail={`${formatNumber(summary.highlyEngaged30)} fortement engagées`}
          />
          <SummaryCard
            href="/page-linkedin"
            icon={<Users className="w-4 h-4" />}
            title="Abonnés de la page"
            caption={summary.pageAvailable ? "30 derniers jours" : "statistiques de page indisponibles"}
            value={formatNumber(summary.followers)}
            detail={summary.pageAvailable ? `${summary.followerGains30 >= 0 ? "+" : ""}${formatNumber(summary.followerGains30)} nouveaux abonnés` : "voir la page"}
          />
        </div>
      </div>

      <Card>
        <CardHeader title="Campagnes" subtitle="Regroupées par groupe de campagnes, sur la période sélectionnée" />
        <div className="px-2 pb-3">
          <CampaignTable campaigns={data.campaigns} metricsByCampaign={byCampaign} currency={currency} />
        </div>
      </Card>

      {topCreatives.length > 0 && (
        <Card>
          <CardHeader
            title="Publicités les plus cliquées"
            subtitle="Taux de clic sur les 90 derniers jours, 1 000 impressions minimum"
            action={
              <Link href="/publicites" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Toutes les publicités <ArrowRight className="w-4 h-4" />
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
  const ctr = (creative.clicks || 0) / (creative.impressions || 1) * 100;
  return (
    <li className="flex gap-3 rounded-md border border-border p-3">
      <div className={cn("w-16 h-16 rounded-md shrink-0 bg-muted overflow-hidden flex items-center justify-center")}>
        {creative.localMediaPath ? (
          <img src={creative.localMediaPath} alt="" className="w-full h-full object-cover" />
        ) : (
          <Megaphone className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium truncate">{creative.authorName || creative.headline || creative.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{creative.adText || creative.headline || "Sans texte"}</p>
        <p className="text-xs mt-1 tnum">
          <span className="font-semibold text-positive">{formatPercent(ctr)}</span>
          <span className="text-muted-foreground"> de clics · {formatNumber(creative.impressions || 0)} impressions</span>
        </p>
      </div>
    </li>
  );
}
