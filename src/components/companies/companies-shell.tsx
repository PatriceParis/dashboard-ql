"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Download, Info, Search, Trophy } from "lucide-react";
import type { Campaign, CampaignGroup, CampaignWindow, CompaniesData, CompanyMetrics, CompanyWindow, DemographicsData } from "@/lib/types";
import { COMPANY_WINDOWS } from "@/lib/constants";
import { SEGMENTS, matchesSegment, type SegmentContext, type SegmentKey, companyLevel, isHighlyEngaged } from "@/lib/segments";
import { countryLabel, orgTypeLabel, staffCountLabel, STAFF_COUNT_ORDER } from "@/lib/linkedin-taxonomy";
import { BarList, Card, CardHeader, EmptyState, InfoTip, Segmented } from "@/components/ui/primitives";
import { CompanyTable } from "./company-table";
import { cn, formatNumber, plural } from "@/lib/utils";

type Window = (typeof COMPANY_WINDOWS)[number]["key"];

function mergeRows(lists: CompanyMetrics[][]): CompanyMetrics[] {
  const map = new Map<string, CompanyMetrics>();
  for (const list of lists) {
    for (const c of list) {
      const cur = map.get(c.orgId);
      if (!cur) {
        map.set(c.orgId, { ...c });
        continue;
      }
      for (const k of Object.keys(c) as Array<keyof CompanyMetrics>) {
        if (k !== "orgId") (cur[k] as number) += c[k] as number;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.impressions - a.impressions);
}

export function CompaniesShell({ companies, demographics, campaigns, campaignGroups }: { companies: CompaniesData; demographics: DemographicsData; campaigns: Campaign[]; campaignGroups: CampaignGroup[] }) {
  const [window, setWindow] = useState<Window>("90d");
  const [segment, setSegment] = useState<SegmentKey | null>(null);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>("all"); // all | group:<id> | <campaignId>

  const orgs = companies.organizations;
  const campaignFiltered = campaignFilter !== "all";
  // The per-campaign breakdown only exists for the 30 and 90-day windows.
  const effectiveWindow: CompanyWindow = campaignFiltered && window === "7d" ? "30d" : window;

  const campaignOptions = useMemo(() => {
    const available = new Set([...Object.keys(companies.byCampaign["30d"]), ...Object.keys(companies.byCampaign["90d"])]);
    const byGroup = new Map<string, { group: CampaignGroup | undefined; items: Campaign[] }>();
    for (const c of campaigns) {
      if (!available.has(c.id)) continue;
      const gid = c.campaignGroupId || "none";
      if (!byGroup.has(gid)) byGroup.set(gid, { group: campaignGroups.find((g) => g.id === gid), items: [] });
      byGroup.get(gid)!.items.push(c);
    }
    return Array.from(byGroup.entries()).map(([gid, v]) => ({ gid, name: v.group?.name || "No campaign", items: v.items }));
  }, [companies.byCampaign, campaigns, campaignGroups]);

  const base = useMemo<CompanyMetrics[]>(() => {
    if (!campaignFiltered) return companies.windows[effectiveWindow];
    const bc = companies.byCampaign[effectiveWindow as CampaignWindow] || {};
    if (campaignFilter.startsWith("group:")) {
      const gid = campaignFilter.slice(6);
      const ids = campaigns.filter((c) => (c.campaignGroupId || "none") === gid).map((c) => c.id);
      return mergeRows(ids.map((id) => bc[id] || []));
    }
    return bc[campaignFilter] || [];
  }, [companies, effectiveWindow, campaignFilter, campaignFiltered, campaigns]);

  const ctx = useMemo<SegmentContext>(
    () => ({
      organizations: orgs,
      recentEngagedIds: new Set(companies.windows["30d"].filter((c) => c.engagements >= 1).map((c) => c.orgId)),
    }),
    [orgs, companies.windows]
  );

  // Les cartes comptent toujours toutes les sociétés du compte sur la fenêtre,
  // quel que soit le filtre de campagne (demande de Patrice du 22/10).
  const allCompanies = companies.windows[window];
  const segmentCounts = useMemo(() => {
    const counts: Partial<Record<SegmentKey, number>> = {};
    for (const s of SEGMENTS) counts[s.key] = s.available ? allCompanies.filter((c) => matchesSegment(s.key, c, ctx)).length : 0;
    return counts;
  }, [allCompanies, ctx]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter((c) => (!segment || matchesSegment(segment, c, ctx)) && (!q || (orgs[c.orgId]?.name || "").toLowerCase().includes(q)));
  }, [base, segment, ctx, search, orgs]);

  const windowLabel = COMPANY_WINDOWS.find((w) => w.key === effectiveWindow)?.label.toLowerCase() || "";
  const cardsWindowLabel = COMPANY_WINDOWS.find((w) => w.key === window)?.label.toLowerCase() || "";

  const exportCsv = () => {
    const header = ["Company", "Website", "LinkedIn", "Company size", "Type", "Country", "Impressions", "Clicks", "Engagements", "Leads", "Website clicks", "Level"];
    const lines = rows.map((c) => {
      const o = orgs[c.orgId];
      return [
        o?.name || c.orgId,
        o?.website || "",
        o?.vanityName ? `https://www.linkedin.com/company/${o.vanityName}` : "",
        o?.staffCountRange ? staffCountLabel(o.staffCountRange) : "",
        orgTypeLabel(o?.organizationType),
        countryLabel(o?.country),
        c.impressions,
        c.clicks,
        c.engagements,
        c.leads,
        c.landingPageClicks,
        companyLevel(c),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `linkedin-companies-${effectiveWindow}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const demoWindow: CampaignWindow = effectiveWindow === "7d" ? "30d" : (effectiveWindow as CampaignWindow);
  const demo = demographics.windows[demoWindow];
  const sizeRows = [...(demo?.companySize || [])].sort((a, b) => STAFF_COUNT_ORDER.indexOf(a.key.split(":").pop() || "") - STAFF_COUNT_ORDER.indexOf(b.key.split(":").pop() || ""));

  // Focus : ad set ABX ayant généré le plus de sociétés fortement engagées sur la fenêtre.
  const focusWindow: CampaignWindow = effectiveWindow === "7d" ? "30d" : (effectiveWindow as CampaignWindow);
  const focus = useMemo(() => {
    const bc = companies.byCampaign[focusWindow] || {};
    const nameOf = new Map(campaigns.map((c) => [c.id, c]));
    return Object.entries(bc)
      .map(([id, list]) => ({ id, campaign: nameOf.get(id), highly: list.filter(isHighlyEngaged).length, engaged: list.filter((c) => c.engagements >= 1).length, reached: list.length }))
      .filter((r) => r.campaign)
      .sort((a, b) => b.highly - a.highly || b.engaged - a.engaged || b.reached - a.reached);
  }, [companies.byCampaign, focusWindow, campaigns]);
  const top = focus[0];
  // Autres ad sets classés par sociétés touchées (indicateur unique, plus parlant pour le client).
  const others = focus.slice(1).sort((a, b) => b.reached - a.reached).slice(0, 5);

  return (
    <div className="space-y-5">
      {top && (
        <Card className="border-primary/25 bg-gradient-to-br from-primary-soft via-[#f3f2fd] to-card overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="px-5 py-5 min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Trophy className="w-3.5 h-3.5" /> Best ABX ad set · {COMPANY_WINDOWS.find((w) => w.key === focusWindow)?.label.toLowerCase()}
              </p>
              <p className="text-xl font-semibold mt-2 truncate">{top.campaign!.name}</p>
              {top.campaign!.campaignGroupName && <p className="text-sm text-muted-foreground mt-0.5 truncate">Campaign: {top.campaign!.campaignGroupName}</p>}
              <div className="grid grid-cols-3 gap-2 mt-4 max-w-[460px]">
                <FocusStat value={top.highly} label="highly engaged" strong />
                <FocusStat value={top.engaged} label="engaged" />
                <FocusStat value={top.reached} label="companies reached" />
              </div>
              {top.highly === 0 && <p className="text-xs text-muted-foreground mt-2">No ad set produced a highly engaged company over this period.</p>}
              <button
                onClick={() => {
                  setCampaignFilter(top.id);
                  setSegment("highly");
                }}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-card text-primary border border-primary/30 hover:border-primary"
              >
                Show these companies <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {others.length > 0 && (
              <div className="border-t lg:border-t-0 lg:border-l border-primary/15 bg-card/60 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other ad sets</p>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left font-normal pb-1">Ad set</th>
                      <th className="text-right font-normal pb-1">Companies reached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {others.map((r) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="py-1.5 pr-2 max-w-[210px] truncate">{r.campaign!.name}</td>
                        <td className="py-1.5 text-right tnum font-medium">{formatNumber(r.reached)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="px-5 pt-5 pb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Companies reached by ads</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tnum">{formatNumber(base.length)}</span>
              <span className="text-sm text-muted-foreground">{windowLabel}{campaignFiltered ? ", selected campaign" : ", whole ad account"}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented value={window} onChange={(w) => setWindow(w)} options={COMPANY_WINDOWS.map((w) => ({ key: w.key, label: w.label.replace("Last ", "") }))} />
            <select id="companies-campaign" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} aria-label="Campaign" className="bg-card border border-border rounded-md px-2.5 py-2 text-sm text-foreground max-w-[280px]">
              <option value="all">All campaigns</option>
              {campaignOptions.map((g) => (
                <optgroup key={g.gid} label={g.name}>
                  {g.items.length > 1 && <option value={`group:${g.gid}`}>Whole campaign "{g.name}"</option>}
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input id="companies-search" type="search" placeholder="Search company" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-2 rounded-md border border-border bg-card text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
            {SEGMENTS.filter((s) => s.available).map((s) => {
              const active = segment === s.key;
              const n = segmentCounts[s.key] || 0;
              return (
                <button
                  key={s.key}
                  onClick={() => setSegment(active ? null : s.key)}
                  className={cn("text-left rounded-lg border px-3.5 py-3 transition-colors", active ? "border-primary bg-primary-soft" : "border-border bg-muted/40 hover:border-primary/40 hover:bg-card")}
                  aria-pressed={active}
                >
                  <span className={cn("block text-2xl font-semibold tnum leading-none", active ? "text-primary" : "text-foreground")}>{formatNumber(n)}</span>
                  <span className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground leading-tight">
                    <span className="truncate">{s.label}</span>
                    <InfoTip text={s.rule} />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground max-w-[960px]">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              Segments cover every company reached by the account&apos;s ads over the {cardsWindowLabel}, whatever the campaign filter. Only paid reach is counted: LinkedIn&apos;s Companies report in Campaign Manager shows more companies because it adds organic activity (Page visits, post impressions), which its API does not provide company by company.
            </span>
          </p>
          {campaignFiltered && window === "7d" && <p className="mt-2 text-xs text-warning">The per-campaign breakdown exists for 30 and 90 days: showing 30 days.</p>}
          {campaignFiltered && <p className="mt-2 text-xs text-muted-foreground">Table figures are for the selected campaign. LinkedIn hides very low volumes in the per-campaign breakdown.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`${formatNumber(rows.length)} ${plural(rows.length, "company", "companies")}`}
          subtitle={`${segment ? SEGMENTS.find((s) => s.key === segment)?.label : "All companies reached"}, ${windowLabel}${campaignFiltered ? ", campaign selection" : ""}`}
          action={
            <button onClick={exportCsv} disabled={rows.length === 0} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          }
        />
        <div className="px-2 pb-3">
          {rows.length === 0 ? <EmptyState title="No companies" text="Change the segment, the period or the campaign." /> : <CompanyTable rows={rows} organizations={orgs} />}
        </div>
        <p className="px-5 pb-4 text-xs text-muted-foreground">
          Source: paid impressions by company across the whole ad account (LinkedIn Marketing API); the campaign filter covers the ABX campaigns. LinkedIn hides companies below a privacy threshold.
        </p>
      </Card>

      <Card>
        <CardHeader title="Profile of the audience reached" subtitle={`Share of impressions over ${demoWindow === "30d" ? "30" : "90"} days, whole ad account`} tip="Breakdown provided by LinkedIn for the members who saw the ads, based on the members' own profile data." />
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Job functions</h3>
            <BarList rows={(demo?.function || []).map((r) => ({ label: r.label, value: r.impressions }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Seniority</h3>
            <BarList rows={(demo?.seniority || []).map((r) => ({ label: r.label, value: r.impressions }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Company size</h3>
            <BarList rows={sizeRows.map((r) => ({ label: r.label, value: r.impressions }))} max={9} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Industries</h3>
            <BarList rows={(demo?.industry || []).map((r) => ({ label: r.label, value: r.impressions }))} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function FocusStat({ value, label, strong = false }: { value: number; label: string; strong?: boolean }) {
  return (
    <div className="rounded-md px-3 py-2 bg-card border border-border">
      <span className={cn("block text-xl font-semibold tnum leading-none", strong ? "text-primary" : "text-foreground")}>{formatNumber(value)}</span>
      <span className="block text-xs mt-1 text-muted-foreground">{label}</span>
    </div>
  );
}
