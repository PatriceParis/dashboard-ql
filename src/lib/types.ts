// Types partagés entre le pipeline (scripts/) et l'interface (src/).

export interface CampaignGroup {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  campaignGroupId: string;
  campaignGroupName?: string;
  objective?: string;
  format?: string;
  costType?: string;
  dailyBudget?: number;
  totalBudget?: number;
  startDate?: string;
  endDate?: string;
}

// Métriques communes à toutes les lignes d'analytics (campagne, jour, créative).
export interface Metrics {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number; // formulaires LinkedIn (oneClickLeads) + conversions site
  formOpens: number;
  landingPageClicks: number;
  engagements: number; // totalEngagements LinkedIn (clics + réactions + commentaires + partages + abonnements)
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  videoViews: number;
  videoQ1: number;
  videoMid: number;
  videoQ3: number;
  videoCompletions: number;
  dwellWeighted: number; // temps d'exposition moyen (s) × impressions, pour une moyenne pondérée
}

export interface CampaignAnalytics extends Metrics {
  campaignId: string;
}

// Portée (membres uniques) par fenêtre : non additive, lue en granularité ALL.
export type ReachWindow = "7d" | "30d" | "90d" | "all";

export interface ReachWindowData {
  start: string;
  end: string;
  total: number; // dédoublonné sur toutes les campagnes de la fenêtre
  byCampaign: Record<string, number>;
  audienceSize?: number; // taille cumulée des audiences ciblées, si l'API l'expose
  audienceByCampaign?: Record<string, number>;
}

export interface ReachData {
  windows: Record<ReachWindow, ReachWindowData>;
}

export interface DailyAnalytics extends Metrics {
  campaignId: string;
  date: string; // AAAA-MM-JJ
}

export type MediaType = "image" | "video" | "carousel" | "document" | "text" | "unknown";

export interface Creative {
  id: string; // creative_<id>
  campaignId: string;
  name: string;
  status: string;
  adText: string;
  headline?: string;
  authorName?: string;
  authorPersonId?: string;
  mediaType: MediaType;
  localMediaPath: string | null;
  videoUrl?: string;
  landingPageUrl?: string;
  reference?: string; // urn:li:share:... ou urn:li:ugcPost:...
  postUrl?: string;
  // Analytics 90 jours (pivot CREATIVE)
  impressions?: number;
  clicks?: number;
  spend?: number;
  leads?: number;
  engagements?: number;
  videoViews?: number;
}

export interface AccountOrg {
  orgId: string;
  name: string;
  vanityName?: string;
  website?: string;
  followerCount: number;
  logoPath?: string;
  tagline?: string;
}

export interface CompanyMetrics {
  orgId: string;
  impressions: number;
  clicks: number;
  engagements: number;
  leads: number;
  landingPageClicks: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  videoViews: number;
  spend: number;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  vanityName?: string;
  website?: string;
  staffCountRange?: string; // SIZE_201_TO_500
  industry?: string; // non fourni par l'API pour les tiers, conservé pour compatibilité
  organizationType?: string; // PUBLIC_COMPANY, PRIVATELY_HELD, GOVERNMENT_AGENCY...
  country?: string; // FR
}

export type CompanyWindow = "7d" | "30d" | "90d" | "31-60";
export type CampaignWindow = "30d" | "90d";

export interface CompaniesData {
  windows: Record<CompanyWindow, CompanyMetrics[]>;
  byCampaign: Record<CampaignWindow, Record<string, CompanyMetrics[]>>;
  organizations: Record<string, OrganizationInfo>;
}

export interface DemographicRow {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  engagements: number;
  leads: number;
}

export type DemographicPivot = "industry" | "function" | "seniority" | "companySize";

export interface DemographicsData {
  windows: Record<CampaignWindow, Record<DemographicPivot, DemographicRow[]>>;
}

export interface Breakdown {
  key: string;
  label: string;
  organic: number;
  paid: number;
}

export interface ShareTotals {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number; // taux renvoyé par LinkedIn (0.012 = 1,2 %)
}

export interface PagePost {
  id: string;
  url: string;
  text: string;
  publishedAt: string;
  mediaType: MediaType;
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
}

export interface PageStats {
  available: boolean;
  followers: {
    total: number;
    gains: Array<{ date: string; organic: number; paid: number }>;
    byStaffCountRange: Breakdown[];
    byFunction: Breakdown[];
    bySeniority: Breakdown[];
    byIndustry: Breakdown[];
  };
  pageViews: {
    lifetime: number;
    series: Array<{ date: string; views: number; unique: number }>;
  };
  shares: {
    lifetime: ShareTotals;
    series: Array<{ date: string } & ShareTotals>;
  };
  posts: PagePost[];
  errors: string[];
}

export interface Summary {
  text: string;
  method: "claude" | "rules";
  generatedAt: string;
  window: string;
  topAdSet: { id: string; name: string; highlyEngaged: number; companiesReached: number } | null;
}

export interface Meta {
  lastUpdated: string;
  apiVersion?: string; // version LinkedIn utilisée (AAAAMM), retirée douze mois après sa sortie
  currency: string;
  dataPeriod: { start: string; end: string }; // fenêtre des analytics journalières
  accountId: string;
  accountName: string;
  errors: string[];
}

export interface DashboardData {
  meta: Meta;
  accountOrg?: AccountOrg;
  campaignGroups: CampaignGroup[];
  campaigns: Campaign[];
  analytics: CampaignAnalytics[]; // depuis le début du compte
  dailyAnalytics: DailyAnalytics[];
  creatives: Creative[];
  reach: ReachData;
}

export interface ComputedKPIs extends Metrics {
  cpm: number;
  ctr: number;
  cpc: number;
  cpl: number;
  engagementRate: number;
  dwellTime: number; // secondes, moyenne pondérée par les impressions
  reach: number | null; // null hors fenêtres standard
  costPer1kReached: number | null;
  audiencePenetration: number | null; // % de l'audience ciblée atteinte
}
