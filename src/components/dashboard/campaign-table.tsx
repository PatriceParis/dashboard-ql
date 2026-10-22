"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import type { Campaign, Metrics } from "@/lib/types";
import { OBJECTIVE_LABELS, STATUS_CLASSES, STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatCurrencyPrecise, formatNumber, formatPercent, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";

type SortKey = "name" | "impressions" | "clicks" | "ctr" | "spend" | "cpm" | "engagements" | "leads" | "cpl";

interface Row {
  campaign: Campaign;
  impressions: number;
  clicks: number;
  spend: number;
  engagements: number;
  leads: number;
  ctr: number;
  cpm: number;
  cpl: number;
}

interface Group {
  id: string;
  name: string;
  rows: Row[];
  totals: Omit<Row, "campaign">;
}

function derive(m: { impressions: number; clicks: number; spend: number; engagements: number; leads: number }) {
  return {
    ...m,
    ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
    cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
    cpl: m.leads > 0 ? m.spend / m.leads : Infinity,
  };
}

export function CampaignTable({ campaigns, metricsByCampaign, currency }: { campaigns: Campaign[]; metricsByCampaign: Map<string, Metrics>; currency: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortAsc, setSortAsc] = useState(false);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const c of campaigns) {
      const m = metricsByCampaign.get(c.id);
      if (!m || m.impressions === 0) continue;
      const row: Row = { campaign: c, ...derive({ impressions: m.impressions, clicks: m.clicks, spend: m.spend, engagements: m.engagements, leads: m.leads }) };
      const gid = c.campaignGroupId || "none";
      if (!map.has(gid)) map.set(gid, { id: gid, name: c.campaignGroupName || "Sans groupe", rows: [], totals: derive({ impressions: 0, clicks: 0, spend: 0, engagements: 0, leads: 0 }) });
      map.get(gid)!.rows.push(row);
    }
    const cmp = (a: Row | Group["totals"], b: Row | Group["totals"], an: string, bn: string) => {
      if (sortKey === "name") return sortAsc ? an.localeCompare(bn) : bn.localeCompare(an);
      const va = (a as Row)[sortKey], vb = (b as Row)[sortKey];
      const fa = isFinite(va) ? va : sortAsc ? Infinity : -Infinity;
      const fb = isFinite(vb) ? vb : sortAsc ? Infinity : -Infinity;
      return sortAsc ? fa - fb : fb - fa;
    };
    for (const g of map.values()) {
      const t = { impressions: 0, clicks: 0, spend: 0, engagements: 0, leads: 0 };
      for (const r of g.rows) {
        t.impressions += r.impressions;
        t.clicks += r.clicks;
        t.spend += r.spend;
        t.engagements += r.engagements;
        t.leads += r.leads;
      }
      g.totals = derive(t);
      g.rows.sort((a, b) => cmp(a, b, a.campaign.name, b.campaign.name));
    }
    return Array.from(map.values()).sort((a, b) => cmp(a.totals, b.totals, a.name, b.name));
  }, [campaigns, metricsByCampaign, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortAsc ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />) : <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-30" />;

  const cols: Array<{ key: SortKey; label: string }> = [
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Clics" },
    { key: "ctr", label: "Taux de clic" },
    { key: "spend", label: "Dépenses" },
    { key: "cpm", label: "CPM" },
    { key: "engagements", label: "Interactions" },
    { key: "leads", label: "Leads" },
    { key: "cpl", label: "Coût / lead" },
  ];

  if (groups.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Aucune campagne diffusée sur la période.</p>;

  const cells = (r: Omit<Row, "campaign">, strong = false) => (
    <>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{formatNumber(r.impressions)}</td>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{formatNumber(r.clicks)}</td>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{formatPercent(r.ctr)}</td>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{formatCurrency(r.spend, currency)}</td>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{formatCurrencyPrecise(r.cpm, currency)}</td>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{formatNumber(r.engagements)}</td>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{formatNumber(r.leads)}</td>
      <td className={cn("py-2.5 px-3 text-right tnum", strong && "font-semibold")}>{isFinite(r.cpl) ? formatCurrency(r.cpl, currency) : "–"}</td>
    </>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
              Campagne <SortIcon col="name" />
            </th>
            <th className="py-2.5 px-3 font-medium">Statut</th>
            <th className="py-2.5 px-3 font-medium">Objectif</th>
            {cols.map((c) => (
              <th key={c.key} className="py-2.5 px-3 font-medium cursor-pointer hover:text-foreground text-right whitespace-nowrap" onClick={() => handleSort(c.key)}>
                {c.label}
                <SortIcon col={c.key} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.id} group={g} cells={cells} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group, cells }: { group: Group; cells: (r: Omit<Row, "campaign">, strong?: boolean) => React.ReactNode }) {
  const multiple = group.rows.length > 1;
  return (
    <>
      {multiple && (
        <tr className="bg-muted/60 border-t border-border">
          <td className="py-2.5 px-3 font-semibold" colSpan={3}>
            {group.name}
            <span className="text-xs text-muted-foreground font-normal ml-2">{group.rows.length} campagnes</span>
          </td>
          {cells(group.totals, true)}
        </tr>
      )}
      {group.rows.map((r) => (
        <tr key={r.campaign.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
          <td className={cn("py-2.5 px-3", multiple && "pl-7")}>
            <span className="font-medium">{multiple ? r.campaign.name : r.campaign.campaignGroupName || r.campaign.name}</span>
            {!multiple && r.campaign.campaignGroupName && r.campaign.campaignGroupName !== r.campaign.name && (
              <span className="block text-xs text-muted-foreground">{r.campaign.name}</span>
            )}
          </td>
          <td className="py-2.5 px-3">
            <Badge className={STATUS_CLASSES[r.campaign.status] || "bg-muted text-muted-foreground"}>{STATUS_LABELS[r.campaign.status] || r.campaign.status}</Badge>
          </td>
          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{r.campaign.objective ? OBJECTIVE_LABELS[r.campaign.objective] || r.campaign.objective : "–"}</td>
          {cells(r)}
        </tr>
      ))}
    </>
  );
}
