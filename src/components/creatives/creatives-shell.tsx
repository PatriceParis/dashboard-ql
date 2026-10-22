"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { DashboardData } from "@/lib/types";
import { usePeriod } from "@/lib/period-context";
import { filterDaily, aggregateByCampaign } from "@/lib/kpi";
import { CreativeCard } from "./creative-card";
import { Card, CardHeader, EmptyState, Segmented } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type SortKey = "ctr" | "impressions" | "engagements" | "leads";
type Scope = "period" | "all";
type StatusFilter = "active" | "all";

export function CreativesShell({ data }: { data: DashboardData }) {
  const { start, end } = usePeriod();
  const [scope, setScope] = useState<Scope>("period");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [group, setGroup] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("impressions");

  const campaignById = useMemo(() => new Map(data.campaigns.map((c) => [c.id, c])), [data.campaigns]);

  const periodCampaignIds = useMemo(() => {
    const agg = aggregateByCampaign(filterDaily(data.dailyAnalytics, start, end));
    return new Set(Array.from(agg.entries()).filter(([, m]) => m.impressions > 0).map(([id]) => id));
  }, [data.dailyAnalytics, start, end]);

  const base = useMemo(() => {
    return data.creatives.filter((c) => {
      if (scope === "period" && !periodCampaignIds.has(c.campaignId)) return false;
      if (status === "active" && c.status !== "ACTIVE") return false;
      return true;
    });
  }, [data.creatives, scope, status, periodCampaignIds]);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; impressions: number }>();
    for (const c of base) {
      const camp = campaignById.get(c.campaignId);
      const id = camp?.campaignGroupId || "none";
      const name = camp?.campaignGroupName || "No campaign";
      const g = map.get(id) || { id, name, count: 0, impressions: 0 };
      g.count++;
      g.impressions += c.impressions || 0;
      map.set(id, g);
    }
    return Array.from(map.values()).sort((a, b) => b.impressions - a.impressions);
  }, [base, campaignById]);

  const shown = useMemo(() => {
    const list = base.filter((c) => group === "all" || (campaignById.get(c.campaignId)?.campaignGroupId || "none") === group);
    const ctr = (c: (typeof list)[number]) => (c.impressions ? (c.clicks || 0) / c.impressions : -1);
    return list.sort((a, b) => {
      if (sort === "ctr") return ctr(b) - ctr(a);
      return (b[sort] || 0) - (a[sort] || 0);
    });
  }, [base, group, sort, campaignById]);

  // Une même publication peut tourner dans plusieurs ad sets (un par secteur cible).
  const repeatedPosts = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of shown) {
      const key = c.reference || c.adText.slice(0, 120);
      if (key) count.set(key, (count.get(key) || 0) + 1);
    }
    return Array.from(count.values()).filter((n) => n > 1).length;
  }, [shown]);

  const links = useMemo(() => shown.map((c) => c.postUrl).filter((u): u is string => !!u), [shown]);
  const tlaLinks = useMemo(() => shown.filter((c) => c.authorName || c.authorPersonId).map((c) => c.postUrl).filter((u): u is string => !!u), [shown]);

  return (
    <div className="space-y-5">
      <Card>
        <div className="px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { key: "period", label: "Delivered over the period" },
              { key: "all", label: "All" },
            ]}
          />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { key: "active", label: "Active" },
              { key: "all", label: "All statuses" },
            ]}
          />
          <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
            Sort by
            <select id="creatives-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-card border border-border rounded-md px-2 py-1.5 text-sm text-foreground">
              <option value="impressions">Impressions</option>
              <option value="ctr">Click-through rate</option>
              <option value="engagements">Engagements</option>
              <option value="leads">Leads</option>
            </select>
          </label>
          <span className="text-xs text-muted-foreground ml-auto">Per-ad statistics over the last 90 days</span>
        </div>
        {groups.length > 1 && (
          <div className="px-5 pb-4 flex flex-wrap gap-2">
            <button onClick={() => setGroup("all")} className={cn("px-3 py-1.5 rounded-md text-sm font-medium border transition-colors", group === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
              All campaigns <span className="opacity-70 tnum">({base.length})</span>
            </button>
            {groups.map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium border transition-colors", group === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                {g.name} <span className="opacity-70 tnum">({g.count})</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {repeatedPosts > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-foreground">
          The same post is often shown several times below: it runs in several ad sets, one per target sector (Defence, Finance, Hardware, Telecom, Software, Automotive, Industry). Each card shows the ad set at the top and its own results for that audience.
        </div>
      )}

      {shown.length === 0 ? (
        <Card>
          <EmptyState title="No ads match these filters" text="Widen the period or show all statuses." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map((c) => (
            <CreativeCard key={c.id} creative={c} accountOrg={data.accountOrg} campaignName={campaignById.get(c.campaignId)?.name} />
          ))}
        </div>
      )}

      {links.length > 0 && (
        <Card>
          <CardHeader title="Sponsored post links" subtitle="Comma-separated list, ready to paste into the engagement tracking tools" />
          <div className="px-5 pb-5 space-y-4">
            <LinkBlock label={`All ads shown (${links.length})`} links={links} />
            {tlaLinks.length > 0 && tlaLinks.length !== links.length && <LinkBlock label={`Thought Leader Ads only (${tlaLinks.length})`} links={tlaLinks} />}
          </div>
        </Card>
      )}
    </div>
  );
}

function LinkBlock({ label, links }: { label: string; links: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = Array.from(new Set(links)).join(",");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-sm font-medium">{label}</p>
        <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <textarea readOnly value={text} rows={3} className="w-full text-xs font-mono bg-muted border border-border rounded-md p-2 text-muted-foreground" />
    </div>
  );
}
