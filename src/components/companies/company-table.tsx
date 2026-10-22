"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { CompanyMetrics, OrganizationInfo } from "@/lib/types";
import { LEVEL_LABELS, companyLevel, engagementRate } from "@/lib/segments";
import { countryLabel, industryLabel, staffCountLabel } from "@/lib/linkedin-taxonomy";
import { Badge } from "@/components/ui/primitives";
import { cn, formatNumber, formatPercent, initials } from "@/lib/utils";

type SortKey = "name" | "impressions" | "clicks" | "engagements" | "leads" | "rate";
const PAGE = 50;

const LEVEL_CLASSES = {
  fort: "bg-positive-soft text-positive",
  engage: "bg-primary-soft text-primary",
  vu: "bg-muted text-muted-foreground",
};

export function CompanyTable({ rows, organizations }: { rows: CompanyMetrics[]; organizations: Record<string, OrganizationInfo> }) {
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortAsc, setSortAsc] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = (organizations[a.orgId]?.name || "").localeCompare(organizations[b.orgId]?.name || "");
      else if (sortKey === "rate") cmp = engagementRate(a) - engagementRate(b);
      else cmp = a[sortKey] - b[sortKey];
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [rows, organizations, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortAsc ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />) : <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-30" />;

  const numericCols: Array<{ key: SortKey; label: string }> = [
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Clics" },
    { key: "engagements", label: "Interactions" },
    { key: "leads", label: "Leads" },
    { key: "rate", label: "Taux d'interaction" },
  ];

  const visible = sorted.slice(0, limit);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
              Entreprise <SortIcon col="name" />
            </th>
            <th className="py-2.5 px-3 font-medium">Secteur</th>
            <th className="py-2.5 px-3 font-medium whitespace-nowrap">Effectif</th>
            <th className="py-2.5 px-3 font-medium">Pays</th>
            {numericCols.map((c) => (
              <th key={c.key} className="py-2.5 px-3 font-medium cursor-pointer hover:text-foreground text-right whitespace-nowrap" onClick={() => handleSort(c.key)}>
                {c.label}
                <SortIcon col={c.key} />
              </th>
            ))}
            <th className="py-2.5 px-3 font-medium">Niveau</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((c) => {
            const o = organizations[c.orgId];
            const name = o?.name || `Organisation ${c.orgId}`;
            const level = companyLevel(c);
            const linkedin = o?.vanityName ? `https://www.linkedin.com/company/${o.vanityName}` : undefined;
            return (
              <tr key={c.orgId} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2.5 min-w-[200px]">
                    <span className="w-8 h-8 rounded-md bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center shrink-0">{initials(name)}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate max-w-[260px]">{name}</span>
                        {linkedin && (
                          <a href={linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label={`Page LinkedIn de ${name}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {o?.website && <span className="block text-xs text-muted-foreground truncate max-w-[260px]">{o.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>}
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3 text-muted-foreground max-w-[180px] truncate">{industryLabel(o?.industry)}</td>
                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap tnum">{staffCountLabel(o?.staffCountRange)}</td>
                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{countryLabel(o?.country) || "–"}</td>
                <td className="py-2 px-3 text-right tnum">{formatNumber(c.impressions)}</td>
                <td className="py-2 px-3 text-right tnum">{c.clicks ? formatNumber(c.clicks) : "–"}</td>
                <td className="py-2 px-3 text-right tnum">{c.engagements ? formatNumber(c.engagements) : "–"}</td>
                <td className="py-2 px-3 text-right tnum">{c.leads ? formatNumber(c.leads) : "–"}</td>
                <td className="py-2 px-3 text-right tnum">{c.engagements ? formatPercent(engagementRate(c), 1) : "–"}</td>
                <td className="py-2 px-3">
                  <Badge className={cn(LEVEL_CLASSES[level])}>{LEVEL_LABELS[level]}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > limit && (
        <div className="text-center py-3">
          <button onClick={() => setLimit(limit + PAGE)} className="text-sm font-medium text-primary hover:underline">
            Afficher {Math.min(PAGE, sorted.length - limit)} entreprises de plus ({formatNumber(sorted.length - limit)} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
