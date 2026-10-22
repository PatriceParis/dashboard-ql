import type { CompanyMetrics, OrganizationInfo } from "./types";
import { staffCountMin } from "./linkedin-taxonomy";

// The six presets of LinkedIn's Companies hub, approximated from the data the
// Marketing API exposes (paid impressions, clicks, engagements, leads, company
// size). LinkedIn's own engagement level is benchmarked across advertisers and
// blends organic activity, which the API does not expose per company.
export type SegmentKey = "highly" | "brandAware" | "prospects" | "highReach" | "large" | "recent";

export interface SegmentDef {
  key: SegmentKey;
  label: string;
  rule: string;
  available: boolean;
}

export const SEGMENTS: SegmentDef[] = [
  { key: "highly", label: "Highly engaged", available: true, rule: "At least 5 engagements, or a lead, or an engagement rate of 2% or more with at least 2 engagements, over the selected period." },
  { key: "brandAware", label: "Brand-aware", available: false, rule: "Companies that engaged with the Page's organic content without being reached by ads. LinkedIn does not expose organic engagement by company through its API, so this segment cannot be computed here." },
  { key: "prospects", label: "Engaged prospects", available: true, rule: "Engaged with the ads over the selected period without converting into a lead." },
  { key: "highReach", label: "High reach, no response", available: true, rule: "At least 100 impressions over the selected period and no engagement at all." },
  { key: "large", label: "Engaged large companies", available: true, rule: "More than 1,000 employees and at least one engagement over the selected period." },
  { key: "recent", label: "Recently engaged", available: true, rule: "At least one engagement in the last 30 days." },
];

export type CompanyLevel = "high" | "engaged" | "reached";

export interface SegmentContext {
  organizations: Record<string, OrganizationInfo>;
  recentEngagedIds: Set<string>; // engagements over the last 30 days
}

export function engagementRate(c: CompanyMetrics): number {
  return c.impressions > 0 ? (c.engagements / c.impressions) * 100 : 0;
}

export function isHighlyEngaged(c: CompanyMetrics): boolean {
  return c.engagements >= 5 || c.leads >= 1 || (c.engagements >= 2 && engagementRate(c) >= 2);
}

export function companyLevel(c: CompanyMetrics): CompanyLevel {
  if (isHighlyEngaged(c)) return "high";
  if (c.engagements >= 1) return "engaged";
  return "reached";
}

export const LEVEL_LABELS: Record<CompanyLevel, string> = {
  high: "High",
  engaged: "Engaged",
  reached: "Reached",
};

export function matchesSegment(key: SegmentKey, c: CompanyMetrics, ctx: SegmentContext): boolean {
  switch (key) {
    case "highly":
      return isHighlyEngaged(c);
    case "brandAware":
      return false;
    case "prospects":
      return c.engagements >= 1 && c.leads === 0;
    case "highReach":
      return c.impressions >= 100 && c.engagements === 0;
    case "large":
      return staffCountMin(ctx.organizations[c.orgId]?.staffCountRange) >= 1001 && c.engagements >= 1;
    case "recent":
      return ctx.recentEngagedIds.has(c.orgId);
  }
}
