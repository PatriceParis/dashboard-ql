import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("bg-card rounded-lg border border-border", className)}>{children}</section>;
}

export function CardHeader({ title, subtitle, action, tip }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; tip?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
          {title}
          {tip && <InfoTip text={tip} />}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("tip inline-flex", className)} tabIndex={0} aria-label={text}>
      <Info className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-foreground" />
      <span className="tip-body" role="tooltip">
        {text}
      </span>
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", className)}>{children}</span>;
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="text-center py-12 px-6">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {text && <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{text}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: Array<{ key: T; label: string; count?: number }>; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex bg-muted p-1 rounded-md gap-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-[6px] font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 text-xs opacity-70 tnum">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function BarList({ rows, total, formatValue, max = 8 }: { rows: Array<{ label: string; value: number; secondary?: string }>; total?: number; formatValue?: (v: number) => string; max?: number }) {
  const sum = total ?? rows.reduce((s, r) => s + r.value, 0);
  const top = rows.slice(0, max);
  const rest = rows.slice(max).reduce((s, r) => s + r.value, 0);
  const maxValue = Math.max(...top.map((r) => r.value), 1);
  const fmt = formatValue || ((v: number) => v.toLocaleString("fr-FR"));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4">Aucune donnée.</p>;
  return (
    <ul className="space-y-2">
      {top.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="truncate text-foreground">{r.label}</span>
            <span className="tnum text-muted-foreground shrink-0">
              {fmt(r.value)}
              {sum > 0 && <span className="ml-1.5 text-xs">({Math.round((r.value / sum) * 100)}&nbsp;%)</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (r.value / maxValue) * 100)}%` }} />
          </div>
        </li>
      ))}
      {rest > 0 && (
        <li className="text-xs text-muted-foreground pt-1">
          Autres : {fmt(rest)} ({Math.round((rest / sum) * 100)}&nbsp;%)
        </li>
      )}
    </ul>
  );
}
