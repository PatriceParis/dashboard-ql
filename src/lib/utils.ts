import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Interface en anglais britannique (demande Quarkslab) : formats en-GB.
const LOCALE = "en-GB";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "EUR", maxDigits = 0): string {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: maxDigits }).format(value);
}

export function formatCurrencyPrecise(value: number, currency = "EUR"): string {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatNumber(value: number): string {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat(LOCALE).format(Math.round(value));
}

export function formatCompact(value: number): string {
  if (!isFinite(value)) return "–";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 0 })}k`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}k`;
  return formatNumber(value);
}

export function formatPercent(value: number, digits = 2): string {
  if (!isFinite(value)) return "–";
  return `${value.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatSeconds(value: number): string {
  if (!isFinite(value)) return "–";
  return `${value.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "–";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return "–";
  return d.toLocaleDateString(LOCALE, opts);
}

export function formatDateShort(iso: string): string {
  return formatDate(iso, { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "–";
  return d.toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" });
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00`).getTime();
  const b = new Date(`${endIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : pluralForm || `${singular}s`;
}
