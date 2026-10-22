"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import type { Campaign, CampaignGroup, CampaignWindow, CompaniesData, CompanyMetrics, CompanyWindow, DemographicsData } from "@/lib/types";
import { COMPANY_WINDOWS } from "@/lib/constants";
import { SEGMENTS, matchesSegment, type SegmentContext, type SegmentKey, companyLevel } from "@/lib/segments";
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

  const segmentCounts = useMemo(() => {
    const counts: Partial<Record<SegmentKey, number>> = {};
    for (const s of SEGMENTS) counts[s.key] = s.available ? base.filter((c) => matchesSegment(s.key, c, ctx)).length : 0;
    return counts;
  }, [base, ctx]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter((c) => (!segment || matchesSegment(segment, c, ctx)) && (!q || (orgs[c.orgId]?.name || "").toLowerCase().includes(q)));
  }, [base, segment, ctx, search, orgs]);

  const windowLabel = COMPANY_WINDOWS.find((w) => w.key === effectiveWindow)?.label.toLowerCase() || "";

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

  return (
    <div className="space-y-5">
      <Card>
        <div className="px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="text-base font-semibold tnum">
            {formatNumber(base.length)} {plural(base.length, "company", "companies")}
            <span className="text-sm font-normal text-muted-foreground ml-2">reached by the ads, {windowLabel}</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-3">
            <Segmented value={window} onChange={(w) => setWindow(w)} options={COMPANY_WINDOWS.map((w) => ({ key: w.key, label: w.label }))} />
            <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
              Campaign
              <select id="companies-campaign" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="bg-card border border-border rounded-md px-2 py-1.5 text-sm text-foreground max-w-[320px]">
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
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input id="companies-search" type="search" placeholder="Search company" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-card text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>
        {campaignFiltered && window === "7d" && <p className="px-5 pb-3 text-xs text-warning">The per-campaign breakdown exists for 30 and 90 days: showing 30 days.</p>}
        {campaignFiltered && <p className="px-5 pb-3 text-xs text-muted-foreground">Figures for the selection only. LinkedIn hides very low volumes in the per-campaign breakdown, so a campaign total can be lower than the all-campaigns view.</p>}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
        {SEGMENTS.filter((s) => s.available).map((s) => {
          const active = segment === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSegment(active ? null : s.key)}
              className={cn("text-left rounded-lg border px-3 py-2.5 transition-colors hover:border-primary/40", active ? "border-primary bg-primary-soft" : "border-border bg-card")}
              aria-pressed={active}
            >
              <div className="flex items-center gap-1 text-sm font-medium leading-tight">
                <span className="truncate">{s.label}</span>
                <InfoTip text={s.rule} />
              </div>
              <div className={cn("text-sm tnum mt-1", active ? "text-primary" : "text-muted-foreground")}>
                {formatNumber(segmentCounts[s.key] || 0)} {plural(segmentCounts[s.key] || 0, "company", "companies")}
              </div>
            </button>
          );
        })}
      </div>

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
          Source: paid impressions by company (LinkedIn Marketing API). LinkedIn's Companies hub also counts organic Page activity and website visits, and hides companies below a privacy threshold, so its totals differ.
        </p>
      </Card>

      <Card>
        <CardHeader title="Profile of the audience reached" subtitle={`Share of impressions over ${demoWindow === "30d" ? "30" : "90"} days, all campaigns`} tip="Breakdown provided by LinkedIn for the members who saw the ads, based on the members' own profile data." />
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
