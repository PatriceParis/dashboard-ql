"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AccountOrg, Meta, Summary } from "@/lib/types";
import { Sparkles } from "lucide-react";
import { NAV_ITEMS, SITE_TITLE } from "@/lib/constants";
import { PeriodProvider } from "@/lib/period-context";
import { PeriodSelector } from "./period-selector";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const PAGES_WITH_PERIOD = new Set(["/", "/publicites"]);

export function AppFrame({ meta, accountOrg, summary, children }: { meta: Meta; accountOrg?: AccountOrg; summary?: Summary; children: ReactNode }) {
  const pathname = usePathname() || "/";
  const showPeriod = PAGES_WITH_PERIOD.has(pathname);

  return (
    <PeriodProvider dataPeriod={meta.dataPeriod}>
      <header className="bg-card border-b border-border">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4 min-w-0">
              <img src="/quarkslab-logo.svg" alt="Quarkslab" className="h-7 w-auto" />
              <span className="hidden sm:block h-6 w-px bg-border" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">LinkedIn reporting</p>
                <p className="text-xs text-muted-foreground leading-tight">{accountOrg?.name || "Quarkslab"} · ABX campaigns and company Page</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right leading-relaxed">
              {meta.dataPeriod?.end ? (
                <>
                  Data up to <span className="text-foreground font-medium">{formatDate(meta.dataPeriod.end)}</span>
                  <br />
                  Updated {formatDateTime(meta.lastUpdated)}
                </>
              ) : (
                "Data not retrieved yet"
              )}
            </div>
          </div>
          {summary?.text && (
            <div className="flex items-start gap-2.5 rounded-lg bg-primary-soft/70 border border-primary/15 px-4 py-3 mb-4 max-w-[980px]">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-foreground">{summary.text}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Summary {summary.method === "claude" ? "written by Claude" : "generated"} from the data, {summary.window}, refreshed with each update.
                </p>
              </div>
            </div>
          )}
          <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Sections">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {showPeriod && (
        <div className="bg-card/80 backdrop-blur border-b border-border">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-3">
            <PeriodSelector />
          </div>
        </div>
      )}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6">{children}</main>
      <footer className="max-w-[1360px] mx-auto px-4 sm:px-6 pb-8 pt-2 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>
          {SITE_TITLE}. Source: LinkedIn Marketing API{meta.apiVersion ? ` (version ${meta.apiVersion})` : ""}, data up to the previous day.
        </span>
        <a href="https://flow-ops.pro/" target="_blank" rel="noopener noreferrer" className="font-bold text-foreground hover:text-primary">
          Powered by Flow Ops
        </a>
      </footer>
    </PeriodProvider>
  );
}
