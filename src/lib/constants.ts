export const SITE_TITLE = "Quarkslab, reporting LinkedIn";

export const NAV_ITEMS = [
  { href: "/", label: "Vue d'ensemble" },
  { href: "/publicites", label: "Publicités" },
  { href: "/entreprises", label: "Entreprises" },
  { href: "/page-linkedin", label: "Page LinkedIn" },
] as const;

export const KPI_CONFIG = [
  { key: "spend", label: "Dépenses", format: "currency", tip: "Montant facturé par LinkedIn sur la période." },
  { key: "impressions", label: "Impressions", format: "number", tip: "Nombre d'affichages des publicités dans le fil LinkedIn." },
  { key: "clicks", label: "Clics", format: "number", tip: "Clics sur une publicité : lien, visuel, vidéo ou page de l'annonceur." },
  { key: "ctr", label: "Taux de clic", format: "percent", tip: "Clics divisés par impressions." },
  { key: "cpm", label: "CPM", format: "currency2", tip: "Coût pour 1 000 impressions." },
  { key: "engagements", label: "Interactions", format: "number", tip: "Clics, réactions, commentaires, partages et abonnements générés par les publicités (total des engagements LinkedIn)." },
  { key: "leads", label: "Leads", format: "number", tip: "Formulaires LinkedIn remplis et conversions mesurées sur le site." },
  { key: "cpl", label: "Coût par lead", format: "currency", tip: "Dépenses divisées par le nombre de leads." },
] as const;

export const OBJECTIVE_LABELS: Record<string, string> = {
  BRAND_AWARENESS: "Notoriété",
  WEBSITE_VISIT: "Visites du site",
  ENGAGEMENT: "Interactions",
  VIDEO_VIEW: "Vues vidéo",
  LEAD_GENERATION: "Leads",
  WEBSITE_CONVERSION: "Conversions",
  JOB_APPLICANT: "Candidatures",
  TALENT_LEAD: "Talents",
  CREATIVE_ENGAGEMENT: "Interactions",
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "En pause",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
  DRAFT: "Brouillon",
  CANCELED: "Annulée",
  PENDING_DELETION: "Supprimée",
};

export const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: "bg-positive-soft text-positive",
  PAUSED: "bg-warning-soft text-warning",
  COMPLETED: "bg-muted text-muted-foreground",
  ARCHIVED: "bg-muted text-muted-foreground",
  DRAFT: "bg-info-soft text-primary",
  CANCELED: "bg-muted text-muted-foreground",
};

export const FORMAT_LABELS: Record<string, string> = {
  SINGLE_VIDEO: "Vidéo",
  STANDARD_UPDATE: "Image ou texte",
  CAROUSEL: "Carrousel",
  TEXT_AD: "Annonce texte",
  SPONSORED_INMAILS: "Message",
  SPONSORED_MESSAGE: "Message",
  CONVERSATION: "Conversation",
  EVENT: "Événement",
  DOCUMENT: "Document",
  SPOTLIGHT: "Spotlight",
  FOLLOW_COMPANY: "Abonnement",
  JOBS: "Emplois",
  THOUGHT_LEADER: "Thought Leader Ad",
};

export const MEDIA_LABELS: Record<string, string> = {
  image: "Image",
  video: "Vidéo",
  carousel: "Carrousel",
  document: "Document",
  text: "Texte",
  unknown: "Publicité",
};

export const COMPANY_WINDOWS = [
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "90d", label: "90 jours" },
] as const;

export const CHART_COLORS = {
  impressions: "#4f4bd9",
  clicks: "#2f9e5b",
  engagements: "#e46a12",
  spend: "#222a4d",
  leads: "#c0392b",
  organic: "#4f4bd9",
  paid: "#9b98ee",
  unique: "#2f9e5b",
};
