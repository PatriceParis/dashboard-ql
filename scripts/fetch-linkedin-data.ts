// Pipeline exécuté au build (Vercel) ou à la main (`npm run fetch-data`).
// Lit l'API LinkedIn et écrit des JSON dans data/ lus par Next.js au pré-rendu.
//
//  1.  Compte publicitaire (pointé par LINKEDIN_AD_ACCOUNT_ID, sinon l'unique compte accessible)
//  1b. Page LinkedIn propriétaire (nom, abonnés, logo)
//  2.  Groupes de campagnes          3. Campagnes
//  4.  Analytics par campagne depuis le début du compte
//  5.  Analytics journalières (180 jours)
//  6.  Créatives + workflow Thought Leader Ads      6b. Analytics par créative (90 jours)
//  7.  Entreprises touchées : fenêtres 7 / 30 / 90 jours et 31 à 60 jours, puis ventilation par campagne
//  7b. Profil de l'audience (secteur, fonction, niveau, taille)
//  8.  Fiches des organisations (nom, taille, secteur, pays)
//  9.  Statistiques de la page LinkedIn (abonnés, visites, posts)
// 10.  meta.json
//
// Chaque étape est isolée : une erreur est consignée dans meta.errors et le
// build continue. Si rien n'est joignable, des fichiers vides sont écrits et le
// script sort en 0 pour ne pas casser `next build`.
import fs from "fs";
import path from "path";
import { LinkedInAPIClient, chunk, toDateParts, sleep, type DateParts } from "./api-client";
import type {
  AccountOrg,
  Campaign,
  CampaignAnalytics,
  CampaignGroup,
  CampaignWindow,
  CompaniesData,
  CompanyMetrics,
  CompanyWindow,
  Creative,
  DailyAnalytics,
  DemographicPivot,
  DemographicRow,
  DemographicsData,
  MediaType,
  Meta,
  Metrics,
  OrganizationInfo,
  PagePost,
  PageStats,
  ShareTotals,
  Breakdown,
  ReachData,
  ReachWindow,
  ReachWindowData,
} from "../src/lib/types";
import { functionLabel, industryLabel, seniorityLabel, staffCountLabel } from "../src/lib/linkedin-taxonomy";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const CREATIVES_DIR = path.join(PUBLIC_DIR, "creatives"); // régénéré à chaque build
const TLA_DIR = path.join(PUBLIC_DIR, "tla"); // versionné : les ghost posts ne sont pas toujours relisibles
const ORG_DIR = path.join(PUBLIC_DIR, "org");
const TLA_AUTHORS_FILE = path.join(ROOT, "tla-authors.json");

const DAILY_DAYS = 180;
const ANALYTICS_SINCE: DateParts = { year: 2024, month: 1, day: 1 };
// Compte publicitaire Quarkslab, verrouillé : le jeton peut voir d'autres comptes
// (autres clients), on ne lit jamais autre chose que celui-ci.
const QUARKSLAB_ACCOUNT_ID = "504032658";
// Périmètre de la mission : seuls les groupes de campagnes (« campagnes » dans
// Campaign Manager) dont le nom contient ce mot sont lus, ainsi que les campagnes
// (« ensembles de publicités ») qui le portent dans leur propre nom.
const CAMPAIGN_NAME_FILTER = (process.env.CAMPAIGN_NAME_FILTER || "ABX").toLowerCase();
const errors: string[] = [];

type Json = any;

// ── utilitaires ───────────────────────────────────────────────────────────
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(filename: string, data: unknown) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
  console.log(`  → data/${filename}`);
}

function hasJSON(filename: string) {
  return fs.existsSync(path.join(DATA_DIR, filename));
}

function fail(step: string, err: unknown) {
  const msg = `${step} : ${(err as Error)?.message || String(err)}`;
  errors.push(msg.slice(0, 300));
  console.warn(`  ! ${msg.slice(0, 400)}`);
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function partsToIso(p: { year: number; month: number; day: number }): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function emptyMetrics(): Metrics {
  return {
    impressions: 0, clicks: 0, spend: 0, leads: 0, formOpens: 0, landingPageClicks: 0, engagements: 0,
    likes: 0, comments: 0, shares: 0, follows: 0, videoViews: 0, videoQ1: 0, videoMid: 0, videoQ3: 0, videoCompletions: 0,
    dwellWeighted: 0,
  };
}

function metricsFromRow(row: Json): Metrics {
  return {
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    spend: num(row.costInLocalCurrency),
    leads: num(row.oneClickLeads) + num(row.externalWebsiteConversions),
    formOpens: num(row.oneClickLeadFormOpens),
    landingPageClicks: num(row.landingPageClicks),
    engagements: num(row.totalEngagements),
    likes: num(row.likes),
    comments: num(row.comments),
    shares: num(row.shares),
    follows: num(row.follows),
    videoViews: num(row.videoViews),
    videoQ1: num(row.videoFirstQuartileCompletions),
    videoMid: num(row.videoMidpointCompletions),
    videoQ3: num(row.videoThirdQuartileCompletions),
    videoCompletions: num(row.videoCompletions),
    dwellWeighted: num(row.averageDwellTime) * num(row.impressions),
  };
}

function addMetrics(a: Metrics, b: Metrics): Metrics {
  const out = { ...a };
  for (const k of Object.keys(b) as Array<keyof Metrics>) out[k] += b[k];
  return out;
}

function pivotOf(row: Json): string {
  return String(row.pivotValues?.[0] || row.pivotValue || "");
}

const stripUrn = (urn: string) => urn.replace(/^urn:li:[a-zA-Z]+:/, "");

async function downloadFile(url: string, dir: string, filename: string): Promise<string> {
  ensureDir(dir);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(path.join(dir, filename), Buffer.from(await res.arrayBuffer()));
    return `/${path.basename(dir)}/${filename}`;
  } catch (err) {
    console.warn(`  ! téléchargement ${filename} : ${(err as Error).message}`);
    return "";
  }
}

function findTlaImageByConvention(creativeId: string): string {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    if (fs.existsSync(path.join(TLA_DIR, `${creativeId}${ext}`))) return `/tla/${creativeId}${ext}`;
  }
  return "";
}

function postUrlFromReference(reference?: string): string | undefined {
  if (!reference) return undefined;
  const m = reference.match(/^urn:li:(share|ugcPost):(\d+)$/);
  if (m) return `https://www.linkedin.com/feed/update/urn:li:ugcPost:${m[2]}`;
  if (reference.startsWith("urn:li:activity:")) return `https://www.linkedin.com/feed/update/${reference}`;
  return undefined;
}

function writeFallbackIfMissing() {
  const empties: Array<[string, unknown]> = [
    ["campaign-groups.json", []],
    ["campaigns.json", []],
    ["analytics.json", []],
    ["daily-analytics.json", []],
    ["creatives.json", []],
    ["reach.json", { windows: {} }],
    ["companies.json", { windows: { "7d": [], "30d": [], "90d": [], "31-60": [] }, byCampaign: { "30d": {}, "90d": {} }, organizations: {} }],
    ["demographics.json", { windows: { "30d": emptyDemographics(), "90d": emptyDemographics() } }],
    ["page-stats.json", emptyPageStats()],
  ];
  for (const [file, payload] of empties) if (!hasJSON(file)) writeJSON(file, payload);
}

function emptyDemographics(): Record<DemographicPivot, DemographicRow[]> {
  return { industry: [], function: [], seniority: [], companySize: [] };
}

function emptyPageStats(): PageStats {
  return {
    available: false,
    followers: { total: 0, gains: [], byStaffCountRange: [], byFunction: [], bySeniority: [], byIndustry: [] },
    pageViews: { lifetime: 0, series: [] },
    shares: { lifetime: emptyShareTotals(), series: [] },
    posts: [],
    errors: [],
  };
}

function emptyShareTotals(): ShareTotals {
  return { impressions: 0, uniqueImpressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, engagement: 0 };
}

function shareTotalsFrom(t: Json): ShareTotals {
  return {
    impressions: num(t?.impressionCount),
    uniqueImpressions: num(t?.uniqueImpressionsCount),
    clicks: num(t?.clickCount),
    likes: num(t?.likeCount),
    comments: num(t?.commentCount),
    shares: num(t?.shareCount),
    engagement: num(t?.engagement),
  };
}

// ── pipeline ──────────────────────────────────────────────────────────────
async function main() {
  console.log("\n=== Récupération des données LinkedIn (Quarkslab) ===");
  console.log(`  Node ${process.version}, jeton ${process.env.LINKEDIN_ACCESS_TOKEN ? "présent" : "ABSENT"}`);

  let client: LinkedInAPIClient;
  try {
    client = new LinkedInAPIClient();
  } catch (err) {
    fail("Jeton", err);
    writeFallbackIfMissing();
    writeMeta("", "", "EUR");
    return;
  }

  const today = new Date();
  const end = addDays(today, -1); // J-1 : la journée en cours est partielle
  const endParts = toDateParts(end);

  // 1. Compte publicitaire
  console.log("\n1. Compte publicitaire");
  const envAccountId = (process.env.LINKEDIN_AD_ACCOUNT_ID || "").replace(/\D/g, "");
  if (envAccountId && envAccountId !== QUARKSLAB_ACCOUNT_ID) {
    console.warn(`  ! LINKEDIN_AD_ACCOUNT_ID=${envAccountId} ignoré : ce projet est verrouillé sur le compte Quarkslab ${QUARKSLAB_ACCOUNT_ID}`);
  }
  const accountId = QUARKSLAB_ACCOUNT_ID;
  let accountName = "";
  let currency = "EUR";
  let orgId = (process.env.LINKEDIN_ORG_ID || "").replace(/\D/g, "");
  try {
    const accounts = await client.getAdAccounts();
    if (!accounts.some((a) => String(a.id) === accountId)) {
      throw new Error(`le jeton n'a pas accès au compte Quarkslab ${accountId} (comptes visibles : ${accounts.map((a) => a.id).join(", ") || "aucun"})`);
    }
    const account = await client.getAdAccount(accountId);
    accountName = account.name || "";
    currency = account.currency || "EUR";
    const m = (account.reference || "").match(/urn:li:organization:(\d+)/);
    if (!orgId && m) orgId = m[1];
    console.log(`  compte ${accountId} « ${accountName} » (${currency}), page ${orgId || "inconnue"}`);
  } catch (err) {
    fail("Compte publicitaire", err);
    writeFallbackIfMissing();
    writeMeta(accountId, accountName, currency);
    return;
  }

  // 1b. Page propriétaire
  console.log("\n1b. Page LinkedIn propriétaire");
  let accountOrg: AccountOrg | undefined;
  if (orgId) {
    try {
      const lookup = await client.getOrganizationsLookup([orgId]);
      const org = lookup.get(orgId) || {};
      const followerCount = await client.getFollowerCount(orgId);
      accountOrg = {
        orgId,
        name: org.localizedName || accountName || "Quarkslab",
        vanityName: org.vanityName,
        website: org.localizedWebsite,
        followerCount,
      };
      const logoUrl = await client.getOrganizationLogoUrl(orgId);
      if (logoUrl) accountOrg.logoPath = (await downloadFile(logoUrl, ORG_DIR, "logo.jpg")) || undefined;
      if (accountOrg.vanityName) {
        const full = await client.getOrganizationByVanity(accountOrg.vanityName);
        if (full?.localizedDescription) accountOrg.tagline = String(full.localizedDescription).slice(0, 220);
      }
      console.log(`  ${accountOrg.name}, ${followerCount.toLocaleString("fr-FR")} abonnés${accountOrg.logoPath ? ", logo récupéré" : ""}`);
      writeJSON("account-org.json", accountOrg);
    } catch (err) {
      fail("Page propriétaire", err);
    }
  }

  // 2. Groupes de campagnes
  console.log("\n2. Groupes de campagnes");
  let campaignGroups: CampaignGroup[] = [];
  try {
    const raw = await client.getCampaignGroups(accountId);
    campaignGroups = raw.map((g) => ({
      id: String(g.id),
      name: g.name,
      status: g.status,
      startDate: g.runSchedule?.start ? msToIso(g.runSchedule.start) : undefined,
      endDate: g.runSchedule?.end ? msToIso(g.runSchedule.end) : undefined,
    }));
    console.log(`  ${campaignGroups.length} groupes sur le compte : ${campaignGroups.map((g) => `${g.name} [${g.status}]`).join(" ; ")}`);
    campaignGroups = campaignGroups.filter((g) => g.name.toLowerCase().includes(CAMPAIGN_NAME_FILTER));
    console.log(`  ${campaignGroups.length} groupes retenus (nom contenant « ${CAMPAIGN_NAME_FILTER} »)`);
    if (campaignGroups.length === 0) errors.push(`Aucun groupe de campagnes dont le nom contient « ${CAMPAIGN_NAME_FILTER} »`);
    writeJSON("campaign-groups.json", campaignGroups);
  } catch (err) {
    fail("Groupes de campagnes", err);
  }
  const groupName = new Map(campaignGroups.map((g) => [g.id, g.name]));

  // 3. Campagnes
  console.log("\n3. Campagnes");
  let campaigns: Campaign[] = [];
  const targetingByCampaign = new Map<string, Json>();
  try {
    const raw = await client.getCampaigns(accountId);
    const total = raw.length;
    const kept = raw.filter((c) => groupName.has(stripUrn(c.campaignGroup || "")) || c.name.toLowerCase().includes(CAMPAIGN_NAME_FILTER));
    console.log(`  ${kept.length} campagnes retenues sur ${total} (groupes « ${CAMPAIGN_NAME_FILTER} » ou nom contenant « ${CAMPAIGN_NAME_FILTER} »)`);
    for (const c of kept) if ((c as Json).targetingCriteria) targetingByCampaign.set(String(c.id), (c as Json).targetingCriteria);
    campaigns = kept.map((c) => {
      const gid = stripUrn(c.campaignGroup || "");
      return {
        id: String(c.id),
        name: c.name,
        status: c.status,
        campaignGroupId: gid,
        campaignGroupName: groupName.get(gid),
        objective: c.objectiveType,
        format: c.format,
        costType: c.costType,
        dailyBudget: c.dailyBudget ? num(c.dailyBudget.amount) : undefined,
        totalBudget: c.totalBudget ? num(c.totalBudget.amount) : undefined,
        startDate: c.runSchedule?.start ? msToIso(c.runSchedule.start) : undefined,
        endDate: c.runSchedule?.end ? msToIso(c.runSchedule.end) : undefined,
      };
    });
    console.log(`  ${campaigns.length} campagnes`);
    writeJSON("campaigns.json", campaigns);
  } catch (err) {
    fail("Campagnes", err);
  }
  const campaignUrns = campaigns.map((c) => `urn:li:sponsoredCampaign:${c.id}`);
  const batches = chunk(campaignUrns, 20);

  // 4. Analytics depuis le début
  console.log("\n4. Analytics par campagne depuis le début");
  const analytics: CampaignAnalytics[] = [];
  for (const [i, batch] of batches.entries()) {
    try {
      const rows = await client.getAnalytics(batch, ANALYTICS_SINCE, endParts, "ALL");
      for (const row of rows) {
        const id = stripUrn(pivotOf(row));
        if (!id) continue;
        analytics.push({ campaignId: id, ...metricsFromRow(row) });
      }
    } catch (err) {
      fail(`Analytics lot ${i + 1}`, err);
    }
  }
  console.log(`  ${analytics.length} lignes`);
  writeJSON("analytics.json", analytics);

  // 5. Analytics journalières
  console.log(`\n5. Analytics journalières (${DAILY_DAYS} jours)`);
  const dailyStart = addDays(end, -(DAILY_DAYS - 1));
  const dailyMap = new Map<string, DailyAnalytics>();
  for (const [i, batch] of batches.entries()) {
    try {
      const rows = await client.getAnalytics(batch, toDateParts(dailyStart), endParts, "DAILY");
      for (const row of rows) {
        if (!row.dateRange?.start) continue;
        const date = partsToIso(row.dateRange.start);
        const id = stripUrn(pivotOf(row));
        const key = `${date}_${id}`;
        const existing = dailyMap.get(key) || { campaignId: id, date, ...emptyMetrics() };
        dailyMap.set(key, { ...existing, ...addMetrics(existing, metricsFromRow(row)) });
      }
    } catch (err) {
      fail(`Analytics journalières lot ${i + 1}`, err);
    }
  }
  const dailyAnalytics = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  console.log(`  ${dailyAnalytics.length} points`);
  writeJSON("daily-analytics.json", dailyAnalytics);

  // 5b. Portée (membres uniques) et taille d'audience par fenêtre standard.
  // La portée n'est pas additive : elle est lue en granularité ALL sur chaque fenêtre,
  // dédoublonnée au niveau du compte (pivot ACCOUNT) et détaillée par campagne.
  console.log("\n5b. Portée et taille d'audience");
  const audienceByCampaign = new Map<string, number>();
  const audienceBySignature = new Map<string, number>();
  for (const [cid, tc] of targetingByCampaign) {
    const signature = JSON.stringify(tc);
    if (!audienceBySignature.has(signature)) {
      const n = await client.getAudienceCount(tc);
      audienceBySignature.set(signature, n ?? 0);
      await sleep(150);
    }
    audienceByCampaign.set(cid, audienceBySignature.get(signature) || 0);
  }
  console.log(`  ${audienceBySignature.size} audiences distinctes pour ${audienceByCampaign.size} campagnes`);
  const reach: ReachData = { windows: {} as ReachData["windows"] };
  // « all » part du premier jour de diffusion connu : LinkedIn renvoie une portée
  // nulle sur les plages trop longues (180 jours), pas sur l'historique réel.
  const firstDelivery = dailyAnalytics.find((d) => d.impressions > 0)?.date;
  const allStart = firstDelivery ? new Date(`${firstDelivery}T00:00:00`) : dailyStart;
  const reachWindows: Array<{ key: ReachWindow; start: Date }> = [
    { key: "7d", start: addDays(end, -6) },
    { key: "30d", start: addDays(end, -29) },
    { key: "90d", start: addDays(end, -89) },
    { key: "all", start: allStart },
  ];
  for (const w of reachWindows) {
    const s = isoDate(w.start), e = isoDate(end);
    const activeIds = new Set(dailyAnalytics.filter((d) => d.date >= s && d.date <= e && d.impressions > 0).map((d) => d.campaignId));
    const urns = campaigns.filter((c) => activeIds.has(c.id)).map((c) => `urn:li:sponsoredCampaign:${c.id}`);
    const data: ReachWindowData = { start: s, end: e, total: 0, byCampaign: {}, audienceByCampaign: {} };
    try {
      for (const batch of chunk(urns, 20)) {
        for (const row of await client.getReach(batch, toDateParts(w.start), endParts, "CAMPAIGN")) {
          const id = stripUrn(pivotOf(row));
          if (id) data.byCampaign[id] = num(row.approximateMemberReach);
        }
      }
      if (urns.length > 0) {
        const rows = await client.getReach(urns, toDateParts(w.start), endParts, "ACCOUNT");
        data.total = rows.reduce((sum, r) => sum + num(r.approximateMemberReach), 0);
      }
      // Taille d'audience : somme des audiences distinctes des campagnes actives.
      const seen = new Set<string>();
      let size = 0;
      for (const id of activeIds) {
        const sig = JSON.stringify(targetingByCampaign.get(id) || null);
        data.audienceByCampaign![id] = audienceByCampaign.get(id) || 0;
        if (!seen.has(sig)) {
          seen.add(sig);
          size += audienceByCampaign.get(id) || 0;
        }
      }
      if (size > 0) data.audienceSize = size;
      console.log(`  ${w.key} : ${data.total} membres atteints, audience ciblée ${data.audienceSize ?? "inconnue"} (${urns.length} campagnes)`);
    } catch (err) {
      fail(`Portée ${w.key}`, err);
    }
    reach.windows[w.key] = data;
  }
  writeJSON("reach.json", reach);

  // 6. Créatives
  console.log("\n6. Créatives");
  let creatives: Creative[] = [];
  try {
    creatives = await processCreatives(client, campaigns);
  } catch (err) {
    fail("Créatives", err);
  }

  // 6b. Analytics par créative (90 jours)
  console.log("\n6b. Analytics par créative (90 jours)");
  try {
    const start90 = toDateParts(addDays(end, -89));
    const byCreative = new Map<string, Metrics>();
    for (const batch of batches) {
      const rows = await client.getCreativeAnalytics(batch, start90, endParts);
      for (const row of rows) {
        const id = `creative_${stripUrn(pivotOf(row))}`;
        byCreative.set(id, addMetrics(byCreative.get(id) || emptyMetrics(), metricsFromRow(row)));
      }
    }
    let enriched = 0;
    for (const cr of creatives) {
      const m = byCreative.get(cr.id);
      if (!m) continue;
      cr.impressions = m.impressions;
      cr.clicks = m.clicks;
      cr.spend = m.spend;
      cr.leads = m.leads;
      cr.engagements = m.engagements;
      cr.videoViews = m.videoViews;
      enriched++;
    }
    console.log(`  ${enriched}/${creatives.length} créatives avec des statistiques`);
  } catch (err) {
    fail("Analytics par créative", err);
  }
  writeJSON("creatives.json", creatives);

  // 7. Entreprises touchées
  console.log("\n7. Entreprises touchées");
  const companies: CompaniesData = { windows: { "7d": [], "30d": [], "90d": [], "31-60": [] }, byCampaign: { "30d": {}, "90d": {} }, organizations: {} };
  const orgIds = new Set<string>();
  const windowDefs: Array<{ key: CompanyWindow; start: Date; end: Date }> = [
    { key: "7d", start: addDays(end, -6), end },
    { key: "30d", start: addDays(end, -29), end },
    { key: "90d", start: addDays(end, -89), end },
    { key: "31-60", start: addDays(end, -59), end: addDays(end, -30) },
  ];
  const activeCampaignsIn = (start: Date, stop: Date) => {
    const s = isoDate(start), e = isoDate(stop);
    const ids = new Set(dailyAnalytics.filter((d) => d.date >= s && d.date <= e && d.impressions > 0).map((d) => d.campaignId));
    return campaigns.filter((c) => ids.has(c.id)).map((c) => `urn:li:sponsoredCampaign:${c.id}`);
  };
  // Vue « toutes campagnes » = compte publicitaire entier (demande de Patrice du 22/10),
  // la ventilation par campagne reste limitée au périmètre « ABX ».
  for (const w of windowDefs) {
    const agg = new Map<string, CompanyMetrics>();
    try {
      const rows = await client.getCompanyAnalyticsForAccount(accountId, toDateParts(w.start), toDateParts(w.end));
      for (const row of rows) {
        const id = stripUrn(pivotOf(row));
        if (!pivotOf(row).includes("organization") || !id) continue;
        orgIds.add(id);
        agg.set(id, mergeCompany(agg.get(id), id, row));
      }
    } catch (err) {
      fail(`Entreprises ${w.key}`, err);
    }
    companies.windows[w.key] = Array.from(agg.values()).sort((a, b) => b.impressions - a.impressions);
    console.log(`  ${w.key} : ${companies.windows[w.key].length} entreprises (compte entier)`);
  }
  for (const key of ["30d", "90d"] as CampaignWindow[]) {
    const w = windowDefs.find((d) => d.key === key)!;
    const urns = activeCampaignsIn(w.start, w.end);
    const perCampaign = new Map<string, Map<string, CompanyMetrics>>();
    for (const [i, batch] of chunk(urns, 20).entries()) {
      try {
        const rows = await client.getCompanyAnalyticsByCampaign(batch, toDateParts(w.start), toDateParts(w.end));
        for (const { campaignUrn, row } of rows) {
          const cid = stripUrn(campaignUrn);
          const oid = stripUrn(pivotOf(row));
          if (!oid) continue;
          orgIds.add(oid);
          const m = perCampaign.get(cid) || new Map<string, CompanyMetrics>();
          m.set(oid, mergeCompany(m.get(oid), oid, row));
          perCampaign.set(cid, m);
        }
      } catch (err) {
        fail(`Entreprises par campagne ${key} lot ${i + 1}`, err);
      }
    }
    for (const [cid, m] of perCampaign) companies.byCampaign[key][cid] = Array.from(m.values()).sort((a, b) => b.impressions - a.impressions);
    console.log(`  ${key} par campagne : ${perCampaign.size} campagnes ventilées`);
  }

  // 7b. Profil de l'audience
  console.log("\n7b. Profil de l'audience touchée");
  const demographics: DemographicsData = { windows: { "30d": emptyDemographics(), "90d": emptyDemographics() } };
  const pivots: Array<{ key: DemographicPivot; pivot: string; label: (v: string) => string }> = [
    { key: "industry", pivot: "MEMBER_INDUSTRY", label: industryLabel },
    { key: "function", pivot: "MEMBER_JOB_FUNCTION", label: functionLabel },
    { key: "seniority", pivot: "MEMBER_SENIORITY", label: seniorityLabel },
    { key: "companySize", pivot: "MEMBER_COMPANY_SIZE", label: (v) => staffCountLabel(v.split(":").pop()) },
  ];
  for (const key of ["30d", "90d"] as CampaignWindow[]) {
    const w = windowDefs.find((d) => d.key === key)!;
    for (const p of pivots) {
      const agg = new Map<string, DemographicRow>();
      try {
        const rows = await client.getDemographicAnalyticsForAccount(p.pivot, accountId, toDateParts(w.start), toDateParts(w.end));
        for (const row of rows) {
          const v = pivotOf(row);
          if (!v) continue;
          const cur = agg.get(v) || { key: v, label: p.label(v), impressions: 0, clicks: 0, engagements: 0, leads: 0 };
          cur.impressions += num(row.impressions);
          cur.clicks += num(row.clicks);
          cur.engagements += num(row.totalEngagements);
          cur.leads += num(row.oneClickLeads);
          agg.set(v, cur);
        }
      } catch (err) {
        fail(`Audience ${p.key} ${key}`, err);
      }
      demographics.windows[key][p.key] = Array.from(agg.values()).sort((a, b) => b.impressions - a.impressions);
    }
    console.log(`  ${key} : ${pivots.map((p) => `${p.key} ${demographics.windows[key][p.key].length}`).join(", ")}`);
  }
  writeJSON("demographics.json", demographics);

  // 8. Fiches des organisations
  console.log(`\n8. Fiches des organisations (${orgIds.size})`);
  try {
    const lookup = await client.getOrganizationsLookup(Array.from(orgIds));
    for (const id of orgIds) {
      const org = lookup.get(id);
      const info: OrganizationInfo = { id, name: org?.localizedName || `Organisation ${id}` };
      if (org) {
        info.vanityName = org.vanityName;
        info.website = org.localizedWebsite;
        const locs: Json[] = org.locations || [];
        const hq = locs.find((l) => l.locationType === "HEADQUARTERS") || locs[0];
        if (hq?.address?.country) info.country = hq.address.country;
      }
      companies.organizations[id] = info;
    }
    console.log(`  ${lookup.size} fiches résolues`);
    // Taille et type : un appel par organisation via le finder vanityName (le lookup
    // groupé ne les expose pas). Priorité aux entreprises qui ont interagi.
    const ranked = Object.values(companies.organizations)
      .filter((o) => o.vanityName)
      .sort((a, b) => {
        const score = (id: string) => Math.max(...(["90d", "30d"] as CompanyWindow[]).map((w) => companies.windows[w].find((c) => c.orgId === id)?.engagements || 0));
        return score(b.id) - score(a.id);
      });
    let sized = 0;
    for (const o of ranked) {
      const full = await client.getOrganizationByVanity(o.vanityName!);
      if (full) {
        if (full.staffCountRange) o.staffCountRange = full.staffCountRange;
        if (full.organizationType) o.organizationType = full.organizationType;
        sized++;
      }
      await sleep(120);
    }
    console.log(`  ${sized}/${ranked.length} fiches complétées (taille, type)`);
  } catch (err) {
    fail("Fiches des organisations", err);
    for (const id of orgIds) companies.organizations[id] = { id, name: `Organisation ${id}` };
  }
  writeJSON("companies.json", companies);

  // 9. Statistiques de la page
  console.log("\n9. Statistiques de la page LinkedIn");
  const pageStats = emptyPageStats();
  if (orgId) {
    const dayMs = 86400000;
    const endUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()); // minuit UTC du jour : la veille est le dernier jour complet
    const startUtc = endUtc - 90 * dayMs;
    pageStats.followers.total = accountOrg?.followerCount || 0;
    const bd = (rows: Json[], keyField: string, label: (v: string) => string): Breakdown[] =>
      (rows || [])
        .map((r) => ({ key: String(r[keyField] || ""), label: label(String(r[keyField] || "")), organic: num(r.followerCounts?.organicFollowerCount), paid: num(r.followerCounts?.paidFollowerCount) }))
        .filter((r) => r.organic + r.paid > 0)
        .sort((a, b) => b.organic + b.paid - (a.organic + a.paid));
    try {
      const [life] = await client.getFollowerStatistics(orgId);
      pageStats.followers.byStaffCountRange = bd(life?.followerCountsByStaffCountRange, "staffCountRange", staffCountLabel);
      pageStats.followers.byFunction = bd(life?.followerCountsByFunction, "function", functionLabel);
      pageStats.followers.bySeniority = bd(life?.followerCountsBySeniority, "seniority", seniorityLabel);
      pageStats.followers.byIndustry = bd(life?.followerCountsByIndustry, "industry", industryLabel);
      pageStats.available = true;
      console.log(`  abonnés : ${pageStats.followers.byFunction.length} fonctions, ${pageStats.followers.byIndustry.length} secteurs`);
    } catch (err) {
      fail("Abonnés (répartition)", err);
      pageStats.errors.push("répartition des abonnés");
    }
    try {
      const rows = await client.getFollowerStatistics(orgId, { startMs: startUtc, endMs: endUtc });
      pageStats.followers.gains = rows
        .filter((r) => r.timeRange?.start)
        .map((r) => ({ date: msToIso(r.timeRange.start), organic: num(r.followerGains?.organicFollowerGain), paid: num(r.followerGains?.paidFollowerGain) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      pageStats.available = true;
      console.log(`  gains d'abonnés : ${pageStats.followers.gains.length} jours`);
    } catch (err) {
      fail("Abonnés (évolution)", err);
      pageStats.errors.push("évolution des abonnés");
    }
    try {
      const [life] = await client.getPageStatistics(orgId);
      pageStats.pageViews.lifetime = num(life?.totalPageStatistics?.views?.allPageViews?.pageViews);
      const rows = await client.getPageStatistics(orgId, { startMs: startUtc, endMs: endUtc });
      pageStats.pageViews.series = rows
        .filter((r) => r.timeRange?.start)
        .map((r) => ({
          date: msToIso(r.timeRange.start),
          views: num(r.totalPageStatistics?.views?.allPageViews?.pageViews),
          unique: num(r.totalPageStatistics?.views?.allPageViews?.uniquePageViews),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      pageStats.available = true;
      console.log(`  visites : ${pageStats.pageViews.series.length} jours, ${pageStats.pageViews.lifetime} vues au total`);
    } catch (err) {
      fail("Visites de la page", err);
      pageStats.errors.push("visites de la page");
    }
    try {
      const [life] = await client.getShareStatistics(orgId);
      pageStats.shares.lifetime = shareTotalsFrom(life?.totalShareStatistics);
      const rows = await client.getShareStatistics(orgId, { interval: { startMs: startUtc, endMs: endUtc } });
      pageStats.shares.series = rows
        .filter((r) => r.timeRange?.start)
        .map((r) => ({ date: msToIso(r.timeRange.start), ...shareTotalsFrom(r.totalShareStatistics) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      pageStats.available = true;
      console.log(`  publications : ${pageStats.shares.series.length} jours`);
    } catch (err) {
      fail("Statistiques des publications", err);
      pageStats.errors.push("statistiques des publications");
    }
    try {
      const raw = await client.getPostsByAuthor(`urn:li:organization:${orgId}`, 3, 20);
      const published = raw
        .filter((p) => (p.lifecycleState || "PUBLISHED") === "PUBLISHED" && !p.adContext?.isDsc && !p.isReshareOnly)
        .sort((a, b) => num(b.publishedAt) - num(a.publishedAt))
        .slice(0, 30);
      const posts: PagePost[] = published.map((p) => ({
        id: p.id,
        url: `https://www.linkedin.com/feed/update/${p.id}`,
        text: String(p.commentary || "").slice(0, 600),
        publishedAt: p.publishedAt ? new Date(num(p.publishedAt)).toISOString() : "",
        mediaType: postMediaType(p),
        impressions: 0, uniqueImpressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, engagement: 0,
      }));
      const byId = new Map(posts.map((p) => [p.id, p]));
      const shareIds = posts.map((p) => p.id).filter((id) => id.startsWith("urn:li:share:"));
      const ugcIds = posts.map((p) => p.id).filter((id) => id.startsWith("urn:li:ugcPost:"));
      for (const [kind, ids] of [["shares", shareIds], ["ugcPosts", ugcIds]] as const) {
        for (const batch of chunk(ids, 10)) {
          try {
            const rows = await client.getShareStatistics(orgId, { [kind]: batch } as Json);
            for (const r of rows) {
              const id = r.share || r.ugcPost;
              const post = id ? byId.get(id) : undefined;
              if (post) Object.assign(post, shareTotalsFrom(r.totalShareStatistics));
            }
          } catch (err) {
            fail(`Statistiques des posts (${kind})`, err);
          }
          await sleep(200);
        }
      }
      pageStats.posts = posts;
      pageStats.available = true;
      console.log(`  ${posts.length} publications récentes`);
    } catch (err) {
      fail("Publications de la page", err);
      pageStats.errors.push("liste des publications");
    }
  } else {
    pageStats.errors.push("page LinkedIn non identifiée (LINKEDIN_ORG_ID)");
  }
  writeJSON("page-stats.json", pageStats);

  // 10. meta
  writeMeta(accountId, accountName, currency, { start: isoDate(dailyStart), end: isoDate(end) }, client.version);
  console.log(`\nTerminé${errors.length ? ` avec ${errors.length} avertissement(s)` : ""} (API LinkedIn ${client.version}).\n`);
}

function writeMeta(accountId: string, accountName: string, currency: string, dataPeriod?: { start: string; end: string }, apiVersion?: string) {
  const meta: Meta = {
    lastUpdated: new Date().toISOString(),
    apiVersion,
    currency,
    dataPeriod: dataPeriod || { start: "", end: "" },
    accountId,
    accountName,
    errors,
  };
  writeJSON("meta.json", meta);
}

function mergeCompany(existing: CompanyMetrics | undefined, orgId: string, row: Json): CompanyMetrics {
  const cur = existing || { orgId, impressions: 0, clicks: 0, engagements: 0, leads: 0, landingPageClicks: 0, likes: 0, comments: 0, shares: 0, follows: 0, videoViews: 0, spend: 0 };
  cur.impressions += num(row.impressions);
  cur.clicks += num(row.clicks);
  cur.engagements += num(row.totalEngagements);
  cur.leads += num(row.oneClickLeads) + num(row.externalWebsiteConversions);
  cur.landingPageClicks += num(row.landingPageClicks);
  cur.likes += num(row.likes);
  cur.comments += num(row.comments);
  cur.shares += num(row.shares);
  cur.follows += num(row.follows);
  cur.videoViews += num(row.videoViews);
  cur.spend += num(row.costInLocalCurrency);
  return cur;
}

function postMediaType(p: Json): MediaType {
  const id: string = p.content?.media?.id || "";
  if (id.includes(":video:")) return "video";
  if (id.includes(":document:")) return "document";
  if (id.includes(":image:") || id.includes(":digitalmediaAsset:")) return "image";
  if (p.content?.multiImage) return "carousel";
  if (p.content?.article) return "image";
  return "text";
}

// ── Créatives et Thought Leader Ads ───────────────────────────────────────
async function processCreatives(client: LinkedInAPIClient, campaigns: Campaign[]): Promise<Creative[]> {
  type TlaEntry = { authorName?: string; adText?: string; imagePath?: string };
  type TlaFile = { _comment?: string; authors: Record<string, string>; creatives: Record<string, TlaEntry> };
  let tla: TlaFile = { authors: {}, creatives: {} };
  try {
    if (fs.existsSync(TLA_AUTHORS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TLA_AUTHORS_FILE, "utf-8"));
      tla = { _comment: parsed._comment, authors: parsed.authors || {}, creatives: parsed.creatives || {} };
    }
  } catch {
    console.warn("  ! tla-authors.json illisible");
  }
  let tlaChanged = false;
  const rememberAuthor = (personId: string, name: string) => {
    if (!personId) return;
    if (tla.authors[personId] !== name) {
      tla.authors[personId] = name;
      tlaChanged = true;
    }
  };
  const rememberCreative = (creativeId: string, patch: TlaEntry) => {
    const cur = tla.creatives[creativeId] || {};
    let changed = false;
    for (const [k, v] of Object.entries(patch) as Array<[keyof TlaEntry, string | undefined]>) {
      if (v && !cur[k]) {
        cur[k] = v;
        changed = true;
      }
    }
    if (changed) {
      tla.creatives[creativeId] = cur;
      tlaChanged = true;
    }
  };

  const me = await client.getMe();
  if (me) console.log(`  authentifié : ${me.firstName} ${me.lastName}`);
  const memberPostsCache = new Map<string, Json[]>();

  const resolveAuthor = async (personUrn: string): Promise<string> => {
    const personId = personUrn.replace("urn:li:person:", "");
    if (me && personId === me.id) return `${me.firstName} ${me.lastName}`;
    if (tla.authors[personId]) return tla.authors[personId];
    const name = await client.getPersonName(personUrn);
    if (name) rememberAuthor(personId, name);
    else if (!(personId in tla.authors)) {
      tla.authors[personId] = "";
      tlaChanged = true;
    }
    return name || "";
  };

  const memberUrnFromVariables = (raw: Json): string => {
    const data = raw?.variables?.data;
    if (!data) return "";
    const content = data[Object.keys(data)[0]];
    const ca = content?.contentAuthor;
    if (typeof ca === "string" && ca.startsWith("urn:li:member:")) return ca;
    if (ca && typeof ca.member === "string") return ca.member;
    const deep = (o: Json): string => {
      if (!o) return "";
      if (typeof o === "string") return o.startsWith("urn:li:member:") ? o : "";
      if (Array.isArray(o)) for (const x of o) { const h = deep(x); if (h) return h; }
      else if (typeof o === "object") for (const x of Object.values(o)) { const h = deep(x); if (h) return h; }
      return "";
    };
    return deep(content);
  };

  const creatives: Creative[] = [];
  const inbox: Array<{ id: string; author: string; hasVisual: boolean }> = [];

  for (const campaign of campaigns) {
    let raws: Json[] = [];
    try {
      raws = await client.getCreativesForCampaign(campaign.id);
    } catch (err) {
      console.warn(`  ! créatives de ${campaign.id} : ${(err as Error).message.slice(0, 100)}`);
    }
    for (const rc of raws) {
      const creativeId = String(rc.id);
      const reference: string | undefined = rc.reference;
      let adText = "", headline = "", landingPageUrl = "", mediaPath = "", videoUrl = "", authorName = "", personId = "";
      let mediaType: MediaType = "unknown";
      if (rc.type?.includes("DOCUMENT")) mediaType = "document";
      else if (rc.type?.includes("VIDEO")) mediaType = "video";
      if (rc.callToAction?.target && !String(rc.callToAction.target).startsWith("urn:")) landingPageUrl = rc.callToAction.target;

      if (reference) {
        try {
          const post = await client.getPost(reference);
          adText = post.commentary || "";
          if (post.author?.includes(":person:")) {
            personId = post.author.replace("urn:li:person:", "");
            authorName = await resolveAuthor(post.author);
          }
          headline = post.content?.article?.title || post.content?.document?.title || post.content?.media?.title || "";
          if (post.content?.document?.title && mediaType === "unknown") mediaType = "document";
          const mediaId = post.content?.media?.id;
          if (mediaId) {
            if (mediaId.includes(":document:")) {
              if (mediaType === "unknown") mediaType = "document";
            } else if (mediaId.includes(":video:")) {
              mediaType = "video";
              const v = await client.getVideo(mediaId);
              if (v?.downloadUrl) videoUrl = v.downloadUrl;
            } else if (mediaType === "unknown") mediaType = "image";
            if (!mediaId.includes(":video:")) {
              try {
                const imgs = await client.getImages([mediaId]);
                const url = Object.values(imgs.results || {})[0]?.downloadUrl;
                if (url) mediaPath = await downloadFile(url, CREATIVES_DIR, `${mediaId.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`);
              } catch {}
            }
          } else if (post.content?.multiImage) {
            mediaType = "carousel";
            const first = post.content.multiImage.images?.[0]?.id;
            if (first) {
              try {
                const imgs = await client.getImages([first]);
                const url = Object.values(imgs.results || {})[0]?.downloadUrl;
                if (url) mediaPath = await downloadFile(url, CREATIVES_DIR, `${first.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`);
              } catch {}
            }
          }
          if (!landingPageUrl && post.content?.article?.source && !post.content.article.source.startsWith("urn:")) landingPageUrl = post.content.article.source;
        } catch {
          // Ghost post (Thought Leader Ad ou contenu sponsorisé direct) : on passe par
          // l'auteur membre déclaré dans variables.data et la liste de ses posts.
          let memberUrn = memberUrnFromVariables(rc);
          if (!memberUrn) {
            const full = await client.getCreativeById(creativeId);
            if (full) memberUrn = memberUrnFromVariables(full);
          }
          if (memberUrn) {
            let posts = memberPostsCache.get(memberUrn);
            if (!posts) {
              posts = await client.getPostsByAuthor(memberUrn, 30);
              memberPostsCache.set(memberUrn, posts);
              console.log(`  ${memberUrn} : ${posts.length} posts lus`);
            }
            const n = reference.replace(/^urn:li:(share|ugcPost):/, "");
            const post = posts.find((p) => p.id === `urn:li:share:${n}` || p.id === `urn:li:ugcPost:${n}`);
            if (post) {
              adText = post.commentary || adText;
              if (typeof post.author === "string" && post.author.includes(":person:")) {
                personId = post.author.replace("urn:li:person:", "");
                authorName = await resolveAuthor(post.author);
              }
              const mediaId: string | undefined = post.content?.media?.id;
              if (mediaId?.includes(":video:")) {
                mediaType = "video";
                const v = await client.getVideo(mediaId);
                if (v?.downloadUrl) videoUrl = v.downloadUrl;
              } else {
                const imgUrn = mediaId && (mediaId.includes(":image:") || mediaId.includes(":digitalmediaAsset:")) ? mediaId : post.content?.multiImage?.images?.[0]?.id;
                if (imgUrn) {
                  if (mediaType === "unknown") mediaType = post.content?.multiImage ? "carousel" : "image";
                  try {
                    const imgs = await client.getImages([imgUrn]);
                    const url = Object.values(imgs.results || {})[0]?.downloadUrl;
                    if (url) mediaPath = await downloadFile(url, TLA_DIR, `creative_${creativeId}.jpg`);
                  } catch {}
                }
              }
            } else {
              console.log(`  ! ${reference} absent des ${posts.length} posts de ${memberUrn}`);
            }
          }
          // Repli : texte et image portés par variables.data
          const data = rc.variables?.data;
          const content = data ? data[Object.keys(data)[0]] : null;
          if (content) {
            if (!adText && content.introText) adText = content.introText;
            if (!headline && content.title) headline = content.title;
            if (!mediaPath && !videoUrl) {
              const urns: string[] = [];
              const collect = (o: Json) => {
                if (!o) return;
                if (typeof o === "string") {
                  if (/^urn:li:(image|digitalmediaAsset):/.test(o)) urns.push(o);
                } else if (Array.isArray(o)) o.forEach(collect);
                else if (typeof o === "object") Object.values(o).forEach(collect);
              };
              collect(content);
              for (const u of urns) {
                try {
                  const imgs = await client.getImages([u]);
                  const url = Object.values(imgs.results || {})[0]?.downloadUrl;
                  if (url) {
                    mediaPath = await downloadFile(url, TLA_DIR, `creative_${creativeId}.jpg`);
                    if (mediaType === "unknown") mediaType = "image";
                    break;
                  }
                } catch {}
              }
            }
          }
          // Repli : saisie manuelle dans tla-authors.json
          const manual = tla.creatives[creativeId];
          if (manual) {
            if (!authorName && manual.authorName) authorName = manual.authorName;
            if (!adText && manual.adText) adText = manual.adText;
            if (!mediaPath && manual.imagePath && fs.existsSync(path.join(PUBLIC_DIR, manual.imagePath.replace(/^\//, "")))) {
              mediaPath = manual.imagePath;
              if (mediaType === "unknown") mediaType = "image";
            }
          }
          if (personId || authorName || adText || mediaPath) {
            rememberCreative(creativeId, { authorName: authorName || undefined, adText: adText || undefined, imagePath: mediaPath.startsWith("/tla/") ? mediaPath : undefined });
          }
        }
      }

      const isTla = !!authorName || !!personId || !!tla.creatives[creativeId];
      if (isTla && !mediaPath && !videoUrl) {
        const conv = findTlaImageByConvention(creativeId);
        if (conv) {
          mediaPath = conv;
          if (mediaType === "unknown") mediaType = "image";
        }
      }
      if (isTla) inbox.push({ id: creativeId, author: authorName || (personId ? `personId ${personId}` : "auteur inconnu"), hasVisual: !!mediaPath || !!videoUrl });
      if (mediaType === "unknown" && adText && !mediaPath && !videoUrl) mediaType = "text";

      creatives.push({
        id: `creative_${creativeId}`,
        campaignId: campaign.id,
        name: rc.name || `Créative ${creativeId}`,
        status: rc.status || "ACTIVE",
        adText,
        headline: headline || undefined,
        authorName: authorName || undefined,
        authorPersonId: personId || undefined,
        mediaType,
        localMediaPath: mediaPath || null,
        videoUrl: videoUrl || undefined,
        landingPageUrl: landingPageUrl || undefined,
        reference,
        postUrl: postUrlFromReference(reference),
      });
    }
  }
  console.log(`  ${creatives.length} créatives (${creatives.filter((c) => c.localMediaPath || c.videoUrl).length} avec visuel, ${inbox.length} Thought Leader Ads)`);

  if (tlaChanged) {
    try {
      fs.writeFileSync(TLA_AUTHORS_FILE, JSON.stringify(tla, null, 2) + "\n");
      console.log("  tla-authors.json mis à jour (à committer pour persister sur Vercel)");
    } catch {}
  }
  const missing = inbox.filter((t) => !t.hasVisual);
  const unresolved = Object.entries(tla.authors).filter(([, n]) => !n);
  if (missing.length || unresolved.length) {
    console.log("\n  === À faire (Thought Leader Ads) ===");
    for (const t of missing) console.log(`  • créative ${t.id} (${t.author}) sans visuel : déposer public/tla/${t.id}.jpg`);
    for (const [id] of unresolved) console.log(`  • auteur ${id} sans nom : compléter tla-authors.json → authors["${id}"]`);
  }
  return creatives;
}

main().catch((err) => {
  fail("Pipeline", err);
  writeFallbackIfMissing();
  writeMeta("", "", "EUR");
  process.exit(0);
});
