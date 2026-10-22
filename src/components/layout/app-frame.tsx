"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AccountOrg, Meta } from "@/lib/types";
import { NAV_ITEMS, SITE_TITLE } from "@/lib/constants";
import { PeriodProvider } from "@/lib/period-context";
import { PeriodSelector } from "./period-selector";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const PAGES_WITH_PERIOD = new Set(["/", "/publicites"]);

export function AppFrame({ meta, accountOrg, children }: { meta: Meta; accountOrg?: AccountOrg; children: ReactNode }) {
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
                <p className="text-sm font-semibold leading-tight">Reporting LinkedIn</p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {accountOrg?.name || "Quarkslab"} · publicités et page entreprise
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right leading-relaxed">
              {meta.dataPeriod?.end ? (
                <>
                  Données arrêtées au <span className="text-foreground font-medium">{formatDate(meta.dataPeriod.end)}</span>
                  <br />
                  Mise à jour {formatDateTime(meta.lastUpdated)}
                </>
              ) : (
                "Données non encore récupérées"
              )}
            </div>
          </div>
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
      <footer className="max-w-[1360px] mx-auto px-4 sm:px-6 pb-8 pt-2 text-xs text-muted-foreground">
        {SITE_TITLE}. Source : LinkedIn Marketing API, données arrêtées à la veille. Flow Ops.
      </footer>
    </PeriodProvider>
  );
}
