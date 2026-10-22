// Client LinkedIn Marketing API (Advertising API + Community Management API).
// Bearer auth, version 202509, retry sur 429/503. Toutes les méthodes renvoient
// des structures brutes ; le pipeline fetch-linkedin-data.ts les met en forme.
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const BASE_URL = "https://api.linkedin.com";
// Les versions LinkedIn (AAAAMM) sont retirées douze mois après leur sortie
// (avis du 22/10/2026 : 202511 retirée le 16/11/2026, dernière version 202610).
// On part de la version configurée ou du mois courant et, sur 426
// NONEXISTENT_VERSION, on remonte mois par mois jusqu'à une version active.
const CONFIGURED_VERSION = process.env.LINKEDIN_API_VERSION || "";

function candidateVersions(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i <= 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export class LinkedInApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, url: string) {
    super(`LinkedIn ${status} sur ${url.replace(BASE_URL, "").slice(0, 160)} : ${body.slice(0, 300)}`);
    this.name = "LinkedInApiError";
    this.status = status;
    this.body = body;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function toDateParts(d: Date): DateParts {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function dateRangeParam(start: DateParts, end: DateParts): string {
  return `(start:(year:${start.year},month:${start.month},day:${start.day}),end:(year:${end.year},month:${end.month},day:${end.day}))`;
}

// Liste Rest.li : List(urn%3Ali%3A...,urn%3Ali%3A...) ; les deux-points des URN
// sont encodés, le List(...) et les virgules restent littéraux.
export function listParam(values: string[]): string {
  return `List(${values.map((v) => v.replace(/:/g, "%3A")).join(",")})`;
}

// Encodage Rest.li 2.0 d'une structure JSON (critères de ciblage) en paramètre d'URL.
export function restliEncode(value: unknown): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/\(/g, "%28").replace(/\)/g, "%29");
  if (Array.isArray(value)) return `List(${value.map(restliEncode).join(",")})`;
  if (value && typeof value === "object") return `(${Object.entries(value as Record<string, unknown>).map(([k, v]) => `${enc(k)}:${restliEncode(v)}`).join(",")})`;
  return enc(String(value));
}

export function timeIntervalsParam(startMs: number, endMs: number, granularity: "DAY" | "MONTH" = "DAY"): string {
  return `(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:${granularity})`;
}

type Json = any;

export class LinkedInAPIClient {
  private accessToken: string;
  version: string;
  private versionResolved = false;

  constructor() {
    this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || "";
    if (!this.accessToken) throw new Error("LINKEDIN_ACCESS_TOKEN absent : lancer `npm run auth`.");
    this.version = CONFIGURED_VERSION || candidateVersions()[0];
  }

  private headers(legacy = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      Accept: "application/json",
    };
    if (!legacy) h["LinkedIn-Version"] = this.version;
    return h;
  }

  // Cherche la version d'API la plus récente acceptée par LinkedIn.
  private async resolveVersion(): Promise<void> {
    for (const v of candidateVersions()) {
      const res = await fetch(`${BASE_URL}/rest/adAccounts?q=search&count=1`, { headers: { ...this.headers(), "LinkedIn-Version": v } });
      if (res.status !== 426) {
        console.log(`  [api] version LinkedIn active : ${v}${v !== this.version ? ` (configurée : ${this.version})` : ""}`);
        this.version = v;
        return;
      }
    }
    throw new Error("aucune version d'API LinkedIn active sur les 14 derniers mois");
  }

  // GET brut : l'URL est construite par l'appelant pour préserver la syntaxe Rest.li.
  async getRaw<T = Json>(pathWithQuery: string, opts: { legacy?: boolean } = {}): Promise<T> {
    const url = pathWithQuery.startsWith("http") ? pathWithQuery : `${BASE_URL}${pathWithQuery}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url, { headers: this.headers(opts.legacy) });
      if (res.status === 426 && !this.versionResolved) {
        this.versionResolved = true;
        await this.resolveVersion();
        continue;
      }
      if (res.status === 429 || res.status === 503) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
        const wait = Math.min(60, Number.isFinite(retryAfter) ? retryAfter : 5);
        console.warn(`  [api] ${res.status}, nouvel essai dans ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      if (res.status === 401) throw new LinkedInApiError(401, "jeton invalide ou expiré, lancer `npm run auth`", url);
      if (!res.ok) throw new LinkedInApiError(res.status, await res.text(), url);
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }
    throw new Error(`Trop de tentatives sur ${url}`);
  }

  async fetchAllPages<T = Json>(pathWithQuery: string, maxPages = 10, count = 100): Promise<T[]> {
    const all: T[] = [];
    const sep = pathWithQuery.includes("?") ? "&" : "?";
    let start = 0;
    for (let page = 0; page < maxPages; page++) {
      const data = await this.getRaw<{ elements?: T[]; paging?: { total?: number } }>(`${pathWithQuery}${sep}start=${start}&count=${count}`);
      const elements = data.elements || [];
      all.push(...elements);
      if (elements.length < count) break;
      start += count;
    }
    return all;
  }

  // ── Comptes publicitaires ──────────────────────────────────────────────
  async getAdAccounts() {
    const data = await this.getRaw<{ elements: Array<{ id: number; name: string; status: string; currency: string; reference?: string }> }>(
      "/rest/adAccounts?q=search"
    );
    return data.elements || [];
  }

  async getAdAccount(accountId: number | string) {
    return this.getRaw<{ id: number; name: string; status: string; currency: string; reference?: string }>(`/rest/adAccounts/${accountId}`);
  }

  async getCampaignGroups(accountId: number | string) {
    return this.fetchAllPages<{ id: number; name: string; status: string; runSchedule?: { start?: number; end?: number } }>(
      `/rest/adAccounts/${accountId}/adCampaignGroups?q=search&search=(status:(values:List(ACTIVE,PAUSED,ARCHIVED,DRAFT,CANCELED)))`
    );
  }

  async getCampaigns(accountId: number | string) {
    return this.fetchAllPages<{
      id: number;
      name: string;
      status: string;
      campaignGroup: string;
      type?: string;
      objectiveType?: string;
      format?: string;
      dailyBudget?: { amount: string; currencyCode: string };
      totalBudget?: { amount: string; currencyCode: string };
      costType?: string;
      runSchedule?: { start?: number; end?: number };
    }>(`/rest/adAccounts/${accountId}/adCampaigns?q=search&search=(status:(values:List(ACTIVE,PAUSED,COMPLETED,ARCHIVED,DRAFT,CANCELED)))`);
  }

  // ── Analytics publicitaires ───────────────────────────────────────────
  private static CAMPAIGN_FIELDS = [
    "pivotValues",
    "dateRange",
    "impressions",
    "clicks",
    "costInLocalCurrency",
    "externalWebsiteConversions",
    "oneClickLeads",
    "oneClickLeadFormOpens",
    "landingPageClicks",
    "totalEngagements",
    "likes",
    "comments",
    "shares",
    "follows",
    "videoViews",
    "videoFirstQuartileCompletions",
    "videoMidpointCompletions",
    "videoThirdQuartileCompletions",
    "videoCompletions",
    "averageDwellTime",
  ].join(",");

  // Taille estimée de l'audience ciblée par des critères de campagne (champ `total`).
  async getAudienceCount(targetingCriteria: unknown): Promise<number | null> {
    try {
      const d = await this.getRaw<{ elements: Array<{ total?: number; active?: number }> }>(
        `/rest/audienceCounts?q=targetingCriteriaV2&targetingCriteria=${restliEncode(targetingCriteria)}`
      );
      const total = d.elements?.[0]?.total;
      return typeof total === "number" ? total : null;
    } catch (err) {
      console.warn(`  [api] audienceCounts : ${(err as Error).message.slice(0, 120)}`);
      return null;
    }
  }

  // Portée approximative (membres uniques) : fiable en granularité ALL seulement.
  // pivot ACCOUNT = total dédoublonné sur les campagnes listées ; pivot CAMPAIGN = par campagne.
  async getReach(campaignUrns: string[], start: DateParts, end: DateParts, pivot: "CAMPAIGN" | "ACCOUNT" = "CAMPAIGN") {
    if (campaignUrns.length === 0) return [] as Json[];
    const data = await this.getRaw<{ elements: Json[] }>(
      `/rest/adAnalytics?q=analytics&pivot=${pivot}&timeGranularity=ALL&dateRange=${dateRangeParam(start, end)}&campaigns=${listParam(campaignUrns)}&fields=pivotValues,impressions,approximateMemberReach,costInLocalCurrency`
    );
    return data.elements || [];
  }

  async getAnalytics(campaignUrns: string[], start: DateParts, end: DateParts, granularity: "ALL" | "DAILY" = "ALL", pivot = "CAMPAIGN") {
    if (campaignUrns.length === 0) return [] as Json[];
    const data = await this.getRaw<{ elements: Json[] }>(
      `/rest/adAnalytics?q=analytics&pivot=${pivot}&timeGranularity=${granularity}&dateRange=${dateRangeParam(start, end)}&campaigns=${listParam(campaignUrns)}&fields=${LinkedInAPIClient.CAMPAIGN_FIELDS}`
    );
    return data.elements || [];
  }

  async getCreativeAnalytics(campaignUrns: string[], start: DateParts, end: DateParts) {
    if (campaignUrns.length === 0) return [] as Json[];
    const fields = "pivotValues,impressions,clicks,costInLocalCurrency,oneClickLeads,totalEngagements,likes,comments,shares,videoViews";
    const data = await this.getRaw<{ elements: Json[] }>(
      `/rest/adAnalytics?q=analytics&pivot=CREATIVE&timeGranularity=ALL&dateRange=${dateRangeParam(start, end)}&campaigns=${listParam(campaignUrns)}&fields=${fields}`
    );
    return data.elements || [];
  }

  // Pivot MEMBER_COMPANY : granularité ALL obligatoire (DAILY renvoie 0 clic).
  private static COMPANY_FIELDS = "pivotValues,impressions,clicks,totalEngagements,oneClickLeads,externalWebsiteConversions,landingPageClicks,likes,comments,shares,follows,videoViews,costInLocalCurrency";

  async getCompanyAnalytics(campaignUrns: string[], start: DateParts, end: DateParts) {
    if (campaignUrns.length === 0) return [] as Json[];
    const data = await this.getRaw<{ elements: Json[] }>(
      `/rest/adAnalytics?q=analytics&pivot=MEMBER_COMPANY&timeGranularity=ALL&dateRange=${dateRangeParam(start, end)}&campaigns=${listParam(campaignUrns)}&fields=${LinkedInAPIClient.COMPANY_FIELDS}`
    );
    return data.elements || [];
  }

  // Même pivot au niveau du compte entier (toutes campagnes, tous groupes).
  async getCompanyAnalyticsForAccount(accountId: string | number, start: DateParts, end: DateParts) {
    const data = await this.getRaw<{ elements: Json[] }>(
      `/rest/adAnalytics?q=analytics&pivot=MEMBER_COMPANY&timeGranularity=ALL&dateRange=${dateRangeParam(start, end)}&accounts=${listParam([`urn:li:sponsoredAccount:${accountId}`])}&fields=${LinkedInAPIClient.COMPANY_FIELDS}`
    );
    return data.elements || [];
  }

  async getDemographicAnalyticsForAccount(pivot: string, accountId: string | number, start: DateParts, end: DateParts) {
    const data = await this.getRaw<{ elements: Json[] }>(
      `/rest/adAnalytics?q=analytics&pivot=${pivot}&timeGranularity=ALL&dateRange=${dateRangeParam(start, end)}&accounts=${listParam([`urn:li:sponsoredAccount:${accountId}`])}&fields=pivotValues,impressions,clicks,totalEngagements,oneClickLeads`
    );
    return data.elements || [];
  }

  // Ventilation entreprise × campagne. Le finder `statistics` accepte deux pivots ;
  // s'il refuse, on retombe sur un appel MEMBER_COMPANY par campagne.
  private statisticsFinderRefused = false;

  async getCompanyAnalyticsByCampaign(campaignUrns: string[], start: DateParts, end: DateParts): Promise<Array<{ campaignUrn: string; row: Json }>> {
    if (campaignUrns.length === 0) return [];
    if (this.statisticsFinderRefused) return this.companyAnalyticsPerCampaign(campaignUrns, start, end);
    try {
      const data = await this.getRaw<{ elements: Json[] }>(
        `/rest/adAnalytics?q=statistics&pivots=List(CAMPAIGN,MEMBER_COMPANY)&timeGranularity=ALL&dateRange=${dateRangeParam(start, end)}&campaigns=${listParam(campaignUrns)}&fields=${LinkedInAPIClient.COMPANY_FIELDS}`
      );
      const out: Array<{ campaignUrn: string; row: Json }> = [];
      for (const row of data.elements || []) {
        const pv: string[] = row.pivotValues || [];
        const campaignUrn = pv.find((v) => v.includes("sponsoredCampaign")) || "";
        const orgUrn = pv.find((v) => v.includes("organization")) || "";
        if (!campaignUrn || !orgUrn) continue;
        out.push({ campaignUrn, row: { ...row, pivotValues: [orgUrn] } });
      }
      return out;
    } catch (err) {
      this.statisticsFinderRefused = true;
      console.warn(`  [api] statistics à deux pivots refusé (${(err as Error).message.slice(0, 120)}), repli campagne par campagne`);
      return this.companyAnalyticsPerCampaign(campaignUrns, start, end);
    }
  }

  private async companyAnalyticsPerCampaign(campaignUrns: string[], start: DateParts, end: DateParts): Promise<Array<{ campaignUrn: string; row: Json }>> {
    const out: Array<{ campaignUrn: string; row: Json }> = [];
    for (const urn of campaignUrns) {
      try {
        const rows = await this.getCompanyAnalytics([urn], start, end);
        for (const row of rows) out.push({ campaignUrn: urn, row });
      } catch (e) {
        console.warn(`  [api] ${urn} : ${(e as Error).message.slice(0, 120)}`);
      }
      await sleep(200);
    }
    return out;
  }

  // Logo de la page : le /rest/organizationsLookup ne renvoie qu'un URN digitalmediaAsset,
  // inutilisable avec /rest/images ; l'API v2 avec décoration `~` donne les URL.
  async getOrganizationLogoUrl(orgId: string | number): Promise<string | null> {
    try {
      const res = await fetch(`${BASE_URL}/v2/organizations/${orgId}?projection=(id,logoV2(original~:playableStreams))`, {
        headers: { Authorization: `Bearer ${this.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
      });
      if (!res.ok) return null;
      const d = (await res.json()) as Json;
      const elements: Json[] = d?.logoV2?.["original~"]?.elements || [];
      const best = elements.sort((a, b) => (b.data?.["com.linkedin.digitalmedia.mediaartifact.StillImage"]?.storageSize?.width || 0) - (a.data?.["com.linkedin.digitalmedia.mediaartifact.StillImage"]?.storageSize?.width || 0))[0];
      return best?.identifiers?.[0]?.identifier || null;
    } catch {
      return null;
    }
  }

  // Pivots démographiques (MEMBER_INDUSTRY, MEMBER_JOB_FUNCTION, MEMBER_SENIORITY, MEMBER_COMPANY_SIZE).
  async getDemographicAnalytics(pivot: string, campaignUrns: string[], start: DateParts, end: DateParts) {
    if (campaignUrns.length === 0) return [] as Json[];
    const data = await this.getRaw<{ elements: Json[] }>(
      `/rest/adAnalytics?q=analytics&pivot=${pivot}&timeGranularity=ALL&dateRange=${dateRangeParam(start, end)}&campaigns=${listParam(campaignUrns)}&fields=pivotValues,impressions,clicks,totalEngagements,oneClickLeads`
    );
    return data.elements || [];
  }

  // ── Créatives (API v2 legacy, la seule qui renvoie variables.data) ─────
  async getCreativesForCampaign(campaignId: string | number) {
    const urn = encodeURIComponent(`urn:li:sponsoredCampaign:${campaignId}`);
    const res = await fetch(`${BASE_URL}/v2/adCreativesV2?q=search&search.campaign.values[0]=${urn}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) return [] as Json[];
    const data = (await res.json()) as { elements?: Json[] };
    return data.elements || [];
  }

  async getCreativeById(creativeId: string | number): Promise<Json | null> {
    try {
      const res = await fetch(`${BASE_URL}/v2/adCreativesV2/${creativeId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  // ── Posts ─────────────────────────────────────────────────────────────
  async getPost(postUrn: string): Promise<{
    author?: string;
    commentary?: string;
    publishedAt?: number;
    content?: {
      media?: { id: string; title?: string };
      multiImage?: { images: Array<{ id: string }> };
      article?: { title?: string; description?: string; source?: string };
      document?: { title?: string };
    };
  }> {
    try {
      return await this.getRaw(`/rest/posts/${encodeURIComponent(postUrn)}`);
    } catch {
      // Repli v2 ugcPosts, puis conversion share → ugcPost (même identifiant numérique).
      const candidates = [postUrn];
      if (postUrn.includes(":share:")) candidates.push(postUrn.replace(/^urn:li:share:/, "urn:li:ugcPost:"));
      for (const urn of candidates) {
        try {
          const res = await fetch(`${BASE_URL}/v2/ugcPosts/${encodeURIComponent(urn)}`, {
            headers: { Authorization: `Bearer ${this.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
          });
          if (res.ok) {
            const data = (await res.json()) as Json;
            const sc = data.specificContent?.["com.linkedin.ugc.ShareContent"];
            const m = sc?.media?.[0];
            return {
              author: data.author,
              commentary: sc?.shareCommentary?.text || "",
              content: { media: m ? { id: m.media || "", title: m.title?.text } : undefined },
            };
          }
        } catch {}
        if (urn !== postUrn) {
          try {
            return await this.getRaw(`/rest/posts/${encodeURIComponent(urn)}`);
          } catch {}
        }
      }
      throw new Error(`post introuvable : ${postUrn}`);
    }
  }

  async getPostsByAuthor(authorUrn: string, maxPages = 30, count = 20): Promise<Json[]> {
    const all: Json[] = [];
    let start = 0;
    for (let page = 0; page < maxPages; page++) {
      try {
        const data = await this.getRaw<{ elements: Json[]; paging?: { total?: number } }>(
          `/rest/posts?q=author&author=${encodeURIComponent(authorUrn)}&count=${count}&start=${start}&sortBy=LAST_MODIFIED`
        );
        const elements = data.elements || [];
        all.push(...elements);
        if (elements.length < count) break;
        if (data.paging?.total && all.length >= data.paging.total) break;
        start += count;
      } catch (err) {
        console.warn(`  [api] posts de ${authorUrn} page ${page} : ${(err as Error).message.slice(0, 120)}`);
        break;
      }
    }
    return all;
  }

  async getMe(): Promise<{ id: string; firstName: string; lastName: string } | null> {
    try {
      const res = await fetch(`${BASE_URL}/v2/me`, { headers: { Authorization: `Bearer ${this.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } });
      if (!res.ok) return null;
      const d = (await res.json()) as Json;
      return d.id && d.localizedFirstName ? { id: d.id, firstName: d.localizedFirstName, lastName: d.localizedLastName || "" } : null;
    } catch {
      return null;
    }
  }

  async getPersonName(personUrn: string): Promise<string | null> {
    const id = personUrn.replace("urn:li:person:", "");
    const pick = (f: Json): string | null => {
      if (typeof f === "string") return f;
      if (f?.localized) {
        const k = Object.keys(f.localized)[0];
        return k ? f.localized[k] : null;
      }
      return null;
    };
    try {
      const d = await this.getRaw<Json>(`/rest/people/(id:${id})?fields=firstName,lastName`);
      const a = pick(d?.firstName), b = pick(d?.lastName);
      if (a && b) return `${a} ${b}`;
      if (d?.localizedFirstName && d?.localizedLastName) return `${d.localizedFirstName} ${d.localizedLastName}`;
    } catch {}
    try {
      const res = await fetch(`${BASE_URL}/v2/people/(id:${id})?projection=(firstName,lastName)`, {
        headers: { Authorization: `Bearer ${this.accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
      });
      if (res.ok) {
        const d = (await res.json()) as Json;
        const a = pick(d?.firstName), b = pick(d?.lastName);
        if (a && b) return `${a} ${b}`;
      }
    } catch {}
    return null;
  }

  async getImages(imageUrns: string[]) {
    if (imageUrns.length === 0) return { results: {} as Record<string, { downloadUrl?: string }> };
    return this.getRaw<{ results: Record<string, { downloadUrl?: string }> }>(`/rest/images?ids=${listParam(imageUrns)}`);
  }

  async getVideo(videoUrn: string): Promise<{ downloadUrl?: string; thumbnail?: string } | null> {
    try {
      return await this.getRaw(`/rest/videos/${encodeURIComponent(videoUrn)}`);
    } catch {
      return null;
    }
  }

  // ── Organisations ─────────────────────────────────────────────────────
  // organizationsLookup : identifiants numériques, pas de `projection`.
  async getOrganizationsLookup(orgIds: Array<number | string>) {
    const out = new Map<string, Json>();
    for (const batch of chunk(orgIds.map(String), 50)) {
      try {
        const data = await this.getRaw<{ results: Record<string, Json>; statuses: Record<string, number> }>(
          `/rest/organizationsLookup?ids=List(${batch.join(",")})`
        );
        for (const [key, org] of Object.entries(data.results || {})) {
          const id = key.includes(":") ? key.split(":").pop()! : key;
          if ((data.statuses?.[key] ?? 200) === 200) out.set(id, org);
        }
      } catch (err) {
        console.warn(`  [api] organizationsLookup : ${(err as Error).message.slice(0, 140)}`);
      }
      await sleep(300);
    }
    return out;
  }

  // Le finder par vanityName est le seul accès, sans rôle administrateur, à la taille
  // (staffCountRange), au type et à la description d'une organisation tierce.
  async getOrganizationByVanity(vanityName: string): Promise<Json | null> {
    try {
      const d = await this.getRaw<{ elements: Json[] }>(`/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityName)}`);
      return d.elements?.[0] || null;
    } catch {
      return null;
    }
  }

  async getOrganization(orgId: string | number): Promise<Json | null> {
    try {
      return await this.getRaw(`/rest/organizations/${orgId}`);
    } catch (err) {
      console.warn(`  [api] organizations/${orgId} : ${(err as Error).message.slice(0, 120)}`);
      return null;
    }
  }

  async getFollowerCount(orgId: string | number): Promise<number> {
    try {
      const d = await this.getRaw<{ firstDegreeSize?: number }>(
        `/rest/networkSizes/${encodeURIComponent(`urn:li:organization:${orgId}`)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`
      );
      return d.firstDegreeSize || 0;
    } catch (err) {
      console.warn(`  [api] networkSizes : ${(err as Error).message.slice(0, 120)}`);
      return 0;
    }
  }

  // ── Statistiques de page (Community Management, scope r_organization_admin) ──
  async getFollowerStatistics(orgId: string | number, interval?: { startMs: number; endMs: number; granularity?: "DAY" | "MONTH" }) {
    const entity = encodeURIComponent(`urn:li:organization:${orgId}`);
    const ti = interval ? `&timeIntervals=${timeIntervalsParam(interval.startMs, interval.endMs, interval.granularity || "DAY")}` : "";
    const d = await this.getRaw<{ elements: Json[] }>(`/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${entity}${ti}`);
    return d.elements || [];
  }

  async getPageStatistics(orgId: string | number, interval?: { startMs: number; endMs: number; granularity?: "DAY" | "MONTH" }) {
    const entity = encodeURIComponent(`urn:li:organization:${orgId}`);
    const ti = interval ? `&timeIntervals=${timeIntervalsParam(interval.startMs, interval.endMs, interval.granularity || "DAY")}` : "";
    const d = await this.getRaw<{ elements: Json[] }>(`/rest/organizationPageStatistics?q=organization&organization=${entity}${ti}`);
    return d.elements || [];
  }

  async getShareStatistics(
    orgId: string | number,
    opts: { interval?: { startMs: number; endMs: number; granularity?: "DAY" | "MONTH" }; shares?: string[]; ugcPosts?: string[] } = {}
  ) {
    const entity = encodeURIComponent(`urn:li:organization:${orgId}`);
    let q = `/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${entity}`;
    if (opts.interval) q += `&timeIntervals=${timeIntervalsParam(opts.interval.startMs, opts.interval.endMs, opts.interval.granularity || "DAY")}`;
    if (opts.shares?.length) q += `&shares=${listParam(opts.shares)}`;
    if (opts.ugcPosts?.length) q += `&ugcPosts=${listParam(opts.ugcPosts)}`;
    const d = await this.getRaw<{ elements: Json[] }>(q);
    return d.elements || [];
  }
}
