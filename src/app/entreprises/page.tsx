import { CompaniesShell } from "@/components/companies/companies-shell";
import { loadCompanies, loadDashboardData, loadDemographics } from "@/lib/data-loader";

export const dynamic = "force-static";

export default function CompaniesPage() {
  const data = loadDashboardData();
  const companies = loadCompanies();
  const demographics = loadDemographics();
  return <CompaniesShell companies={companies} demographics={demographics} campaigns={data.campaigns} campaignGroups={data.campaignGroups} />;
}
