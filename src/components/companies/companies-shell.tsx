"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import type { Campaign, CampaignGroup, CampaignWindow, CompaniesData, CompanyMetrics, CompanyWindow, DemographicsData } from "@/lib/types";
import { COMPANY_WINDOWS } from "@/lib/constants";
import { SEGMENTS, matchesSegment, type SegmentContext, type SegmentKey, companyLevel } from "@/lib/segments";
import { countryLabel, industryLabel, staffCountLabel, staffCountMin, STAFF_COUNT_ORDER } from "@/lib/linkedin-taxonomy";
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
  const [window, setWindow] = useState<Window>("30d");
  const [segment, setSegment] = useState<SegmentKey>("all");
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>("all"); // all | group:<id> | <campaignId>
  const [country, setCountry] = useState<"all" | "FR">("all");
  const [size, setSize] = useState<"all" | "201">("all");

  const orgs = companies.organizations;
  const campaignFiltered = campaignFilter !== "all";
  // La ventilation par campagne n'existe que sur 30 et 90 jours.
  const effectiveWindow: CompanyWindow = campaignFiltered && window === "7d" ? "30d" : window;

  // Campagnes ventilées (celles qui ont diffusé dans la fenêtre), groupées pour le sélecteur.
  const campaignOptions = useMemo(() => {
    const available = new Set([...Object.keys(companies.byCampaign["30d"]), ...Object.keys(companies.byCampaign["90d"])]);
    const byGroup = new Map<string, { group: CampaignGroup | undefined; items: Campaign[] }>();
    for (const c of campaigns) {
      if (!available.has(c.id)) continue;
      const gid = c.campaignGroupId || "none";
      if (!byGroup.has(gid)) byGroup.set(gid, { group: campaignGroups.find((g) => g.id === gid), items: [] });
      byGroup.get(gid)!.items.push(c);
    }
    return Array.from(byGroup.entries()).map(([gid, v]) => ({ gid, name: v.group?.name || "Sans groupe", items: v.items }));
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
      recentEngagedIds: new Set(companies.windows["7d"].filter((c) => c.engagements >= 1).map((c) => c.orgId)),
      previousIds: effectiveWindow === "30d" && !campaignFiltered ? new Set(companies.windows["31-60"].map((c) => c.orgId)) : null,
    }),
    [orgs, companies.windows, effectiveWindow, campaignFiltered]
  );

  const prefiltered = useMemo(
    () =>
      base.filter((c) => {
        const o = orgs[c.orgId];
        if (country === "FR" && o?.country !== "FR") return false;
        if (size === "201" && staffCountMin(o?.staffCountRange) < 201) return false;
        return true;
      }),
    [base, orgs, country, size]
  );

  const segmentCounts = useMemo(() => {
    const counts: Partial<Record<SegmentKey, number>> = {};
    for (const s of SEGMENTS) counts[s.key] = prefiltered.filter((c) => matchesSegment(s.key, c, ctx)).length;
    return counts;
  }, [prefiltered, ctx]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prefiltered.filter((c) => matchesSegment(segment, c, ctx) && (!q || (orgs[c.orgId]?.name || "").toLowerCase().includes(q)));
  }, [prefiltered, segment, ctx, search, orgs]);

  const visibleSegments = SEGMENTS.filter((s) => s.key !== "new" || ctx.previousIds !== null);

  const exportCsv = () => {
    const header = ["Entreprise", "Site", "LinkedIn", "Secteur", "Effectif", "Pays", "Impressions", "Clics", "Interactions", "Leads", "Clics vers le site", "Niveau"];
    const lines = rows.map((c) => {
      const o = orgs[c.orgId];
      return [
        o?.name || c.orgId,
        o?.website || "",
        o?.vanityName ? `https://www.linkedin.com/company/${o.vanityName}` : "",
        industryLabel(o?.industry),
        staffCountLabel(o?.staffCountRange),
        countryLabel(o?.country),
        c.impressions,
        c.clicks,
        c.engagements,
        c.leads,
        c.landingPageClicks,
        companyLevel(c),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";");
    });
    const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `entreprises-linkedin-${effectiveWindow}-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <Segmented value={window} onChange={(w) => setWindow(w)} options={COMPANY_WINDOWS.map((w) => ({ key: w.key, label: w.label }))} />
          <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
            Campagne
            <select
              id="companies-campaign"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="bg-card border border-border rounded-md px-2 py-1.5 text-sm text-foreground max-w-[320px]"
            >
              <option value="all">Toutes les campagnes</option>
              {campaignOptions.map((g) => (
                <optgroup key={g.gid} label={g.name}>
                  {g.items.length > 1 && <option value={`group:${g.gid}`}>Tout le groupe « {g.name} »</option>}
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <input id="companies-fr" type="checkbox" checked={country === "FR"} onChange={(e) => setCountry(e.target.checked ? "FR" : "all")} className="accent-primary" />
            France seulement
          </label>
          <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <input id="companies-size" type="checkbox" checked={size === "201"} onChange={(e) => setSize(e.target.checked ? "201" : "all")} className="accent-primary" />
            Plus de 200 salariés
          </label>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="companies-search"
              type="search"
              placeholder="Rechercher une entreprise"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-card text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        {campaignFiltered && window === "7d" && <p className="px-5 pb-3 text-xs text-warning">La ventilation par campagne existe sur 30 et 90 jours : affichage sur 30 jours.</p>}
        {campaignFiltered && <p className="px-5 pb-3 text-xs text-muted-foreground">Chiffres propres à la sélection. LinkedIn masque les entreprises à très faible volume dans la ventilation par campagne : le total par campagne peut être inférieur à la vue « toutes les campagnes ».</p>}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {visibleSegments.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={cn(
              "text-left rounded-lg border px-3 py-2.5 transition-colors",
              segment === s.key ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40"
            )}
            aria-pressed={segment === s.key}
          >
            <div className="flex items-center gap-1 text-xs text-muted-foreground leading-tight min-h-[2rem]">
              <span>{s.label}</span>
              <InfoTip text={s.rule} />
            </div>
            <div className={cn("text-xl font-semibold tnum mt-1", segment === s.key ? "text-primary" : "text-foreground")}>{formatNumber(segmentCounts[s.key] || 0)}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${formatNumber(rows.length)} ${plural(rows.length, "entreprise")}`}
          subtitle={`${SEGMENTS.find((s) => s.key === segment)?.label}, ${COMPANY_WINDOWS.find((w) => w.key === effectiveWindow)?.label.toLowerCase()}${campaignFiltered ? ", sélection de campagne" : ""}`}
          action={
            <button onClick={exportCsv} disabled={rows.length === 0} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50">
              <Download className="w-4 h-4" /> Exporter en CSV
            </button>
          }
        />
        <div className="px-2 pb-3">
          {rows.length === 0 ? <EmptyState title="Aucune entreprise" text="Modifier le segment, la fenêtre ou la campagne." /> : <CompanyTable rows={rows} organizations={orgs} />}
        </div>
      </Card>

      <Card>
        <CardHeader title="Profil de l'audience touchée" subtitle={`Répartition des impressions sur ${demoWindow === "30d" ? "30" : "90"} jours, toutes campagnes confondues`} tip="Ventilation fournie par LinkedIn sur les membres ayant vu les publicités. Les secteurs sont ceux déclarés par les membres." />
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Fonctions</h3>
            <BarList rows={(demo?.function || []).map((r) => ({ label: r.label, value: r.impressions }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Niveaux hiérarchiques</h3>
            <BarList rows={(demo?.seniority || []).map((r) => ({ label: r.label, value: r.impressions }))} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Tailles d'entreprise</h3>
            <BarList rows={sizeRows.map((r) => ({ label: r.label, value: r.impressions }))} max={9} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Secteurs</h3>
            <BarList rows={(demo?.industry || []).map((r) => ({ label: r.label, value: r.impressions }))} />
          </div>
        </div>
      </Card>
    </div>
  );
}
