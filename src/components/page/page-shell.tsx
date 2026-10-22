"use client";

import { useMemo, useState } from "react";
import { ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import type { AccountOrg, PagePost, PageStats } from "@/lib/types";
import { CHART_COLORS, MEDIA_LABELS } from "@/lib/constants";
import { deltaPercent } from "@/lib/kpi";
import { BarList, Badge, Card, CardHeader, EmptyState, InfoTip } from "@/components/ui/primitives";
import { TimeSeriesChart } from "./time-series-chart";
import { addDaysIso, cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";

function sumBetween<T extends { date: string }>(rows: T[], start: string, end: string, pick: (r: T) => number): number {
  return rows.filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + pick(r), 0);
}

export function PageShell({ stats, accountOrg, dataEnd }: { stats: PageStats; accountOrg?: AccountOrg; dataEnd: string }) {
  const [postSort, setPostSort] = useState<"date" | "impressions" | "engagement">("date");

  const end = dataEnd || stats.shares.series.at(-1)?.date || new Date().toISOString().slice(0, 10);
  const start30 = addDaysIso(end, -29);
  const prevEnd = addDaysIso(start30, -1);
  const prevStart = addDaysIso(prevEnd, -29);

  const k = useMemo(() => {
    const gains = (s: string, e: string) => sumBetween(stats.followers.gains, s, e, (g) => g.organic + g.paid);
    const views = (s: string, e: string) => sumBetween(stats.pageViews.series, s, e, (r) => r.views);
    const unique = (s: string, e: string) => sumBetween(stats.pageViews.series, s, e, (r) => r.unique);
    const impr = (s: string, e: string) => sumBetween(stats.shares.series, s, e, (r) => r.impressions);
    const inter = (s: string, e: string) => sumBetween(stats.shares.series, s, e, (r) => r.clicks + r.likes + r.comments + r.shares);
    const posts = (s: string, e: string) => stats.posts.filter((p) => p.publishedAt.slice(0, 10) >= s && p.publishedAt.slice(0, 10) <= e).length;
    const cur = { gains: gains(start30, end), views: views(start30, end), unique: unique(start30, end), impr: impr(start30, end), inter: inter(start30, end), posts: posts(start30, end) };
    const prev = { gains: gains(prevStart, prevEnd), views: views(prevStart, prevEnd), unique: unique(prevStart, prevEnd), impr: impr(prevStart, prevEnd), inter: inter(prevStart, prevEnd), posts: posts(prevStart, prevEnd) };
    return { cur, prev, rate: cur.impr > 0 ? (cur.inter / cur.impr) * 100 : 0, prevRate: prev.impr > 0 ? (prev.inter / prev.impr) * 100 : 0 };
  }, [stats, start30, end, prevStart, prevEnd]);

  const followersTotal = accountOrg?.followerCount || stats.followers.total;

  const sortedPosts = useMemo(() => {
    const list = [...stats.posts];
    if (postSort === "impressions") list.sort((a, b) => b.impressions - a.impressions);
    else if (postSort === "engagement") list.sort((a, b) => b.engagement - a.engagement);
    else list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return list;
  }, [stats.posts, postSort]);

  if (!stats.available) {
    return (
      <Card>
        <EmptyState
          title="Statistiques de la page indisponibles"
          text="Elles exigent le droit « r_organization_admin » sur l'application LinkedIn et un jeton obtenu par un administrateur de la page Quarkslab. Relancer `npm run auth` avec ce compte, puis `npm run fetch-data`."
        />
        {stats.errors.length > 0 && (
          <ul className="px-6 pb-6 text-xs text-muted-foreground list-disc ml-5">
            {stats.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">
          Page LinkedIn {accountOrg?.name || "Quarkslab"}
          {accountOrg?.vanityName && (
            <a href={`https://www.linkedin.com/company/${accountOrg.vanityName}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm font-normal text-primary inline-flex items-center gap-1 hover:underline">
              ouvrir <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          30 derniers jours ({formatDate(start30)} au {formatDate(end)}), comparés aux 30 jours précédents
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Abonnés" value={formatNumber(followersTotal)} tip="Nombre total d'abonnés de la page à la date de mise à jour." />
        <Stat label="Nouveaux abonnés" value={`${k.cur.gains >= 0 ? "+" : ""}${formatNumber(k.cur.gains)}`} delta={deltaPercent(k.cur.gains, k.prev.gains)} tip="Abonnés gagnés sur 30 jours, organiques et payants." />
        <Stat label="Visiteurs uniques" value={formatNumber(k.cur.unique)} delta={deltaPercent(k.cur.unique, k.prev.unique)} tip="Membres distincts ayant consulté la page sur 30 jours." />
        <Stat label="Impressions des publications" value={formatNumber(k.cur.impr)} delta={deltaPercent(k.cur.impr, k.prev.impr)} tip="Affichages des publications de la page (organiques et sponsorisées) sur 30 jours." />
        <Stat label="Taux d'interaction" value={formatPercent(k.rate)} delta={deltaPercent(k.rate, k.prevRate)} tip="Clics, réactions, commentaires et partages divisés par les impressions, sur 30 jours." />
        <Stat label="Publications" value={formatNumber(k.cur.posts)} delta={deltaPercent(k.cur.posts, k.prev.posts)} tip="Publications de la page sur 30 jours, parmi les 30 dernières." />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card>
          <CardHeader title="Nouveaux abonnés par jour" subtitle="90 derniers jours" />
          <div className="px-4 pb-4">
            <TimeSeriesChart
              type="bar"
              stacked
              data={stats.followers.gains}
              series={[
                { key: "organic", label: "Organiques", color: CHART_COLORS.organic },
                { key: "paid", label: "Via publicités", color: CHART_COLORS.paid },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Visites de la page" subtitle="90 derniers jours" />
          <div className="px-4 pb-4">
            <TimeSeriesChart
              data={stats.pageViews.series}
              series={[
                { key: "views", label: "Pages vues", color: CHART_COLORS.impressions },
                { key: "unique", label: "Visiteurs uniques", color: CHART_COLORS.unique },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Impressions des publications" subtitle="90 derniers jours" />
          <div className="px-4 pb-4">
            <TimeSeriesChart data={stats.shares.series} series={[{ key: "impressions", label: "Impressions", color: CHART_COLORS.impressions }]} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Qui suit la page" subtitle="Répartition de l'ensemble des abonnés" tip="Données déclaratives des membres LinkedIn, agrégées par LinkedIn." />
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Fonctions</h3>
            <BarList rows={stats.followers.byFunction.map((r) => ({ label: r.label, value: r.organic + r.paid }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Niveaux hiérarchiques</h3>
            <BarList rows={stats.followers.bySeniority.map((r) => ({ label: r.label, value: r.organic + r.paid }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Tailles d'entreprise</h3>
            <BarList rows={stats.followers.byStaffCountRange.map((r) => ({ label: r.label, value: r.organic + r.paid }))} max={9} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Secteurs</h3>
            <BarList rows={stats.followers.byIndustry.map((r) => ({ label: r.label, value: r.organic + r.paid }))} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Dernières publications"
          subtitle="Statistiques cumulées depuis la publication"
          action={
            <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
              Trier par
              <select id="posts-sort" value={postSort} onChange={(e) => setPostSort(e.target.value as typeof postSort)} className="bg-card border border-border rounded-md px-2 py-1.5 text-sm text-foreground">
                <option value="date">Date</option>
                <option value="impressions">Impressions</option>
                <option value="engagement">Taux d'interaction</option>
              </select>
            </label>
          }
        />
        <div className="px-2 pb-3 overflow-x-auto">
          {sortedPosts.length === 0 ? (
            <EmptyState title="Aucune publication récente" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 font-medium">Publication</th>
                  <th className="py-2.5 px-3 font-medium text-right">Impressions</th>
                  <th className="py-2.5 px-3 font-medium text-right">Clics</th>
                  <th className="py-2.5 px-3 font-medium text-right">Réactions</th>
                  <th className="py-2.5 px-3 font-medium text-right">Commentaires</th>
                  <th className="py-2.5 px-3 font-medium text-right">Partages</th>
                  <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Taux d'interaction</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, delta, tip }: { label: string; value: string; delta?: number | null; tip: string }) {
  const good = delta !== null && delta !== undefined && delta > 0;
  const bad = delta !== null && delta !== undefined && delta < 0;
  return (
    <div className="bg-card rounded-lg border border-border px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
        <InfoTip text={tip} />
      </div>
      <div className="text-2xl font-semibold tnum mt-1.5">{value}</div>
      <div className="h-5 mt-1 text-xs">
        {delta !== null && delta !== undefined && (
          <span className={cn("inline-flex items-center gap-1 font-medium tnum", good ? "text-positive" : bad ? "text-negative" : "text-muted-foreground")}>
            {good ? <TrendingUp className="w-3.5 h-3.5" /> : bad ? <TrendingDown className="w-3.5 h-3.5" /> : null}
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}&nbsp;%
          </span>
        )}
      </div>
    </div>
  );
}

function PostRow({ post }: { post: PagePost }) {
  return (
    <tr className="border-b border-border/60 hover:bg-muted/40 transition-colors align-top">
      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground tnum">{formatDate(post.publishedAt, { day: "2-digit", month: "short", year: "2-digit" })}</td>
      <td className="py-2.5 px-3 min-w-[280px] max-w-[520px]">
        <div className="flex items-start gap-2">
          <Badge className="bg-muted text-muted-foreground shrink-0 mt-0.5">{MEDIA_LABELS[post.mediaType]}</Badge>
          <p className="line-clamp-2 text-foreground">{post.text || "(sans texte)"}</p>
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0 mt-0.5" aria-label="Ouvrir la publication">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </td>
      <td className="py-2.5 px-3 text-right tnum">{formatNumber(post.impressions)}</td>
      <td className="py-2.5 px-3 text-right tnum">{post.clicks || "–"}</td>
      <td className="py-2.5 px-3 text-right tnum">{post.likes || "–"}</td>
      <td className="py-2.5 px-3 text-right tnum">{post.comments || "–"}</td>
      <td className="py-2.5 px-3 text-right tnum">{post.shares || "–"}</td>
      <td className="py-2.5 px-3 text-right tnum">{post.impressions ? formatPercent(post.engagement * 100, 1) : "–"}</td>
    </tr>
  );
}
