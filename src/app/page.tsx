import { OverviewShell } from "@/components/dashboard/overview-shell";
import { loadCompanies, loadDashboardData, loadPageStats } from "@/lib/data-loader";
import { isHighlyEngaged } from "@/lib/segments";
import { addDaysIso } from "@/lib/utils";

export const dynamic = "force-static";

export default function OverviewPage() {
  const data = loadDashboardData();
  const companies = loadCompanies();
  const page = loadPageStats();
  const since30 = data.meta.dataPeriod?.end ? addDaysIso(data.meta.dataPeriod.end, -29) : "";
  const gains30 = page.followers.gains.filter((g) => g.date >= since30).reduce((s, g) => s + g.organic + g.paid, 0);
  const summary = {
    companies30: companies.windows["30d"].length,
    highlyEngaged30: companies.windows["30d"].filter(isHighlyEngaged).length,
    followers: data.accountOrg?.followerCount || page.followers.total,
    followerGains30: gains30,
    pageAvailable: page.available,
  };
  return <OverviewShell data={data} summary={summary} />;
}
