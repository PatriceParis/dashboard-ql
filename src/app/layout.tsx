import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/layout/app-frame";
import { loadAccountOrg, loadMeta } from "@/lib/data-loader";
import { SITE_TITLE } from "@/lib/constants";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: "Suivi des campagnes LinkedIn Ads et de la page LinkedIn de Quarkslab",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = loadMeta();
  const accountOrg = loadAccountOrg();
  return (
    <html lang="fr" className={dmSans.variable}>
      <body className="min-h-screen">
        <AppFrame meta={meta} accountOrg={accountOrg}>
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
