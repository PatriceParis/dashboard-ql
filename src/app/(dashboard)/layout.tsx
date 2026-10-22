import { AppFrame } from "@/components/layout/app-frame";
import { loadAccountOrg, loadMeta, loadSummary } from "@/lib/data-loader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const meta = loadMeta();
  const accountOrg = loadAccountOrg();
  const summary = loadSummary();
  // Lien « Sign out » affiché seulement si l'accès est protégé par mot de passe.
  const passwordProtected = !!process.env.DASHBOARD_PASSWORD;
  return (
    <AppFrame meta={meta} accountOrg={accountOrg} summary={summary} passwordProtected={passwordProtected}>
      {children}
    </AppFrame>
  );
}
