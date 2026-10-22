import { CreativesShell } from "@/components/creatives/creatives-shell";
import { loadDashboardData } from "@/lib/data-loader";

export const dynamic = "force-static";

export default function CreativesPage() {
  const data = loadDashboardData();
  return <CreativesShell data={data} />;
}
