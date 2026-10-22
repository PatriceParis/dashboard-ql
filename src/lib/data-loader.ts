import fs from "fs";
import path from "path";
import type { AccountOrg, CompaniesData, DashboardData, DemographicsData, Meta, PageStats, ReachData, Summary } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJSON<T>(filename: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function loadMeta(): Meta {
  return readJSON<Meta>("meta.json", { lastUpdated: "", currency: "EUR", dataPeriod: { start: "", end: "" }, accountId: "", accountName: "", errors: [] });
}

export function loadSummary(): Summary | undefined {
  return readJSON<Summary | null>("summary.json", null) || undefined;
}

export function loadAccountOrg(): AccountOrg | undefined {
  return readJSON<AccountOrg | null>("account-org.json", null) || undefined;
}

export function loadDashboardData(): DashboardData {
  return {
    meta: loadMeta(),
    accountOrg: loadAccountOrg(),
    campaignGroups: readJSON("campaign-groups.json", []),
    campaigns: readJSON("campaigns.json", []),
    analytics: readJSON("analytics.json", []),
    dailyAnalytics: readJSON("daily-analytics.json", []),
    creatives: readJSON("creatives.json", []),
    reach: readJSON<ReachData>("reach.json", { windows: {} as ReachData["windows"] }),
  };
}

export function loadCompanies(): CompaniesData {
  return readJSON<CompaniesData>("companies.json", {
    windows: { "7d": [], "30d": [], "90d": [], "31-60": [] },
    byCampaign: { "30d": {}, "90d": {} },
    organizations: {},
  });
}

export function loadDemographics(): DemographicsData {
  const empty = { industry: [], function: [], seniority: [], companySize: [] };
  return readJSON<DemographicsData>("demographics.json", { windows: { "30d": empty, "90d": empty } });
}

export function loadPageStats(): PageStats {
  return readJSON<PageStats>("page-stats.json", {
    available: false,
    followers: { total: 0, gains: [], byStaffCountRange: [], byFunction: [], bySeniority: [], byIndustry: [] },
    pageViews: { lifetime: 0, series: [] },
    shares: { lifetime: { impressions: 0, uniqueImpressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, engagement: 0 }, series: [] },
    posts: [],
    errors: [],
  });
}
