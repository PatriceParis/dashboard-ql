import { PageShell } from "@/components/page/page-shell";
import { loadAccountOrg, loadMeta, loadPageStats } from "@/lib/data-loader";

export const dynamic = "force-static";

export default function LinkedInPagePage() {
  const stats = loadPageStats();
  const accountOrg = loadAccountOrg();
  const meta = loadMeta();
  return <PageShell stats={stats} accountOrg={accountOrg} dataEnd={meta.dataPeriod?.end || ""} />;
}
