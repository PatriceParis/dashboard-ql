// Résumé de synthèse affiché dans l'en-tête, régénéré à chaque build.
// Rédigé par Claude quand ANTHROPIC_API_KEY est présent, sinon par des règles
// (repères LinkedIn de la skill linkedin-ads-audit : CTR contenu sponsorisé
// 0,44 à 0,65 %, exceptionnel au-delà de 1 % ; Thought Leader Ads 1,7× le CTR standard).
import type { Campaign, CompaniesData, DailyAnalytics, PageStats, ReachData, Summary } from "../src/lib/types";

interface SummaryInputs {
  campaigns: Campaign[];
  dailyAnalytics: DailyAnalytics[];
  reach: ReachData;
  companies: CompaniesData;
  pageStats: PageStats;
  currency: string;
  endDate: string; // AAAA-MM-JJ
}

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-GB");
const fmtMoney = (n: number, c: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

function isHighlyEngaged(c: { engagements: number; leads: number; impressions: number }) {
  const rate = c.impressions > 0 ? (c.engagements / c.impressions) * 100 : 0;
  return c.engagements >= 5 || c.leads >= 1 || (c.engagements >= 2 && rate >= 2);
}

export function buildFacts(input: SummaryInputs) {
  const start = new Date(`${input.endDate}T00:00:00`);
  start.setDate(start.getDate() - 89);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startIso = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const rows = input.dailyAnalytics.filter((d) => d.date >= startIso && d.date <= input.endDate);
  const sum = (k: keyof DailyAnalytics) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const impressions = sum("impressions"), clicks = sum("clicks"), spend = sum("spend"), leads = sum("leads"), engagements = sum("engagements");
  const activeDays = Array.from(new Set(rows.filter((r) => r.impressions > 0).map((r) => r.date))).sort();
  const reach90 = input.reach.windows?.["90d"];
  const companies90 = input.companies.windows["90d"] || [];
  const highly = companies90.filter(isHighlyEngaged);
  const byCampaign = input.companies.byCampaign["90d"] || {};
  const campaignName = new Map(input.campaigns.map((c) => [c.id, c.name]));
  const ranking = Object.entries(byCampaign)
    .map(([id, list]) => ({ id, name: campaignName.get(id) || id, highly: list.filter(isHighlyEngaged).length, reached: list.length }))
    .sort((a, b) => b.highly - a.highly || b.reached - a.reached);
  const top = ranking[0];
  const since30 = (() => {
    const d = new Date(`${input.endDate}T00:00:00`);
    d.setDate(d.getDate() - 29);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const pageImpr30 = input.pageStats.shares.series.filter((r) => r.date >= since30).reduce((s, r) => s + r.impressions, 0);
  const pageUnique30 = input.pageStats.pageViews.series.filter((r) => r.date >= since30).reduce((s, r) => s + r.unique, 0);
  return {
    impressions, clicks, spend, leads, engagements,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    reach: reach90?.total || 0,
    audienceSize: reach90?.audienceSize || 0,
    penetration: reach90?.total && reach90.audienceSize ? (reach90.total / reach90.audienceSize) * 100 : 0,
    firstDelivery: activeDays[0] || "",
    lastDelivery: activeDays[activeDays.length - 1] || "",
    companiesReached: companies90.length,
    highlyEngaged: highly.length,
    topAdSet: top && top.highly > 0 ? top : null,
    pageImpr30, pageUnique30,
    followers: input.pageStats.followers.total,
  };
}

export function rulesSummary(f: ReturnType<typeof buildFacts>, currency: string): string {
  if (f.impressions === 0) return "No ad delivery over the last 90 days. The figures below cover the LinkedIn Page only.";
  const ctrNote = f.ctr >= 1 ? "an exceptional click-through rate for LinkedIn" : f.ctr >= 0.65 ? "above LinkedIn's sponsored-content benchmark of 0.44 to 0.65%" : f.ctr >= 0.44 ? "in line with LinkedIn's 0.44 to 0.65% benchmark" : "below LinkedIn's 0.44% benchmark";
  const period = f.firstDelivery && f.lastDelivery ? ` between ${fmtDate(f.firstDelivery)} and ${fmtDate(f.lastDelivery)}` : "";
  const reachPart = f.reach > 0 ? `, reaching ${fmtInt(f.reach)} members${f.penetration > 0 ? ` (${f.penetration.toFixed(1)}% of the targeted audience)` : ""}` : "";
  const first = `Over the last 90 days the ABX campaigns spent ${fmtMoney(f.spend, currency)} for ${fmtInt(f.impressions)} impressions${reachPart}${period}, with a ${f.ctr.toFixed(2)}% click-through rate, ${ctrNote}.`;
  const companiesPart = `${fmtInt(f.companiesReached)} companies saw the ads and ${fmtInt(f.highlyEngaged)} ${f.highlyEngaged === 1 ? "is" : "are"} highly engaged${f.topAdSet ? `, led by the ad set "${f.topAdSet.name}" (${f.topAdSet.highly} highly engaged ${f.topAdSet.highly === 1 ? "company" : "companies"})` : ""}.`;
  const leadsPart = f.leads > 0 ? ` ${fmtInt(f.leads)} ${f.leads === 1 ? "lead was" : "leads were"} collected.` : " No lead was collected: the campaigns ran for awareness and engagement only.";
  return `${first} ${companiesPart}${leadsPart}`;
}

async function claudeSummary(f: ReturnType<typeof buildFacts>, currency: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const prompt = `You write a two-sentence executive summary for a client dashboard (Quarkslab, French cybersecurity company, LinkedIn Ads run by their ABX consultant). British English, plain, factual, no hype, no bullet points, at most 70 words. Benchmarks: LinkedIn sponsored-content click-through rate 0.44 to 0.65% (above 1% is exceptional); Thought Leader Ads usually 1.7 times the standard CTR. Facts for the last 90 days: ${JSON.stringify({ ...f, currency })}. Mention the spend, impressions, click-through rate versus benchmark, companies reached and highly engaged, the best ad set if any, and whether leads were collected.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      console.warn(`  ! Claude ${res.status} : ${(await res.text()).slice(0, 160)}`);
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    return text || null;
  } catch (err) {
    console.warn(`  ! Claude : ${(err as Error).message.slice(0, 120)}`);
    return null;
  }
}

export async function buildSummary(input: SummaryInputs): Promise<Summary> {
  const facts = buildFacts(input);
  const ai = await claudeSummary(facts, input.currency);
  return {
    text: ai || rulesSummary(facts, input.currency),
    method: ai ? "claude" : "rules",
    generatedAt: new Date().toISOString(),
    window: "last 90 days",
    topAdSet: facts.topAdSet ? { id: facts.topAdSet.id, name: facts.topAdSet.name, highlyEngaged: facts.topAdSet.highly, companiesReached: facts.topAdSet.reached } : null,
  };
}
