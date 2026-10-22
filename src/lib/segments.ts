import type { CompanyMetrics, OrganizationInfo } from "./types";
import { staffCountMin } from "./linkedin-taxonomy";

// Segments calculés sur les données publicitaires (impressions, clics,
// interactions, leads) et la fiche de l'organisation. Ils s'inspirent des
// filtres du rapport Entreprises de LinkedIn Campaign Manager mais restent
// explicables : chaque règle est affichée dans l'interface.
export type SegmentKey = "all" | "highly" | "engaged" | "prospects" | "large" | "aware" | "new" | "recent";

export interface SegmentDef {
  key: SegmentKey;
  label: string;
  rule: string;
}

export const SEGMENTS: SegmentDef[] = [
  { key: "all", label: "Toutes", rule: "Toutes les entreprises ayant vu au moins une publicité sur la période." },
  { key: "highly", label: "Fortement engagées", rule: "Au moins 5 interactions, ou 1 lead, ou un taux d'interaction d'au moins 2 % avec 2 interactions." },
  { key: "engaged", label: "Engagées", rule: "Au moins une interaction : clic, réaction, commentaire, partage ou abonnement." },
  { key: "prospects", label: "Prospects", rule: "Au moins un lead (formulaire ou conversion) ou deux clics vers le site." },
  { key: "large", label: "Grandes entreprises engagées", rule: "Plus de 200 salariés (cible de la mission) et au moins une interaction." },
  { key: "aware", label: "Vues sans réaction", rule: "Au moins 20 impressions et aucune interaction : notoriété seule." },
  { key: "new", label: "Nouvelles", rule: "Touchées sur les 30 derniers jours mais pas entre le 31e et le 60e jour." },
  { key: "recent", label: "Engagées cette semaine", rule: "Au moins une interaction au cours des 7 derniers jours." },
];

export type CompanyLevel = "fort" | "engage" | "vu";

export interface SegmentContext {
  organizations: Record<string, OrganizationInfo>;
  recentEngagedIds: Set<string>; // interactions sur 7 jours
  previousIds: Set<string> | null; // entreprises des jours 31 à 60 (null si la fenêtre ne le permet pas)
}

export function engagementRate(c: CompanyMetrics): number {
  return c.impressions > 0 ? (c.engagements / c.impressions) * 100 : 0;
}

export function isHighlyEngaged(c: CompanyMetrics): boolean {
  return c.engagements >= 5 || c.leads >= 1 || (c.engagements >= 2 && engagementRate(c) >= 2);
}

export function companyLevel(c: CompanyMetrics): CompanyLevel {
  if (isHighlyEngaged(c)) return "fort";
  if (c.engagements >= 1) return "engage";
  return "vu";
}

export const LEVEL_LABELS: Record<CompanyLevel, string> = {
  fort: "Fort",
  engage: "Engagée",
  vu: "Vue",
};

export function matchesSegment(key: SegmentKey, c: CompanyMetrics, ctx: SegmentContext): boolean {
  switch (key) {
    case "all":
      return true;
    case "highly":
      return isHighlyEngaged(c);
    case "engaged":
      return c.engagements >= 1;
    case "prospects":
      return c.leads >= 1 || c.landingPageClicks >= 2;
    case "large":
      return staffCountMin(ctx.organizations[c.orgId]?.staffCountRange) >= 201 && c.engagements >= 1;
    case "aware":
      return c.impressions >= 20 && c.engagements === 0;
    case "new":
      return ctx.previousIds ? !ctx.previousIds.has(c.orgId) : false;
    case "recent":
      return ctx.recentEngagedIds.has(c.orgId);
  }
}
