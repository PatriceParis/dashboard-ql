// Régénère data/summary.json à partir des JSON déjà présents (sans relire l'API).
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { buildSummary } from "./summary";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
const D = path.join(process.cwd(), "data");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(D, f), "utf-8"));

async function main() {
  const meta = read("meta.json");
  const summary = await buildSummary({
    campaigns: read("campaigns.json"),
    dailyAnalytics: read("daily-analytics.json"),
    reach: read("reach.json"),
    companies: read("companies.json"),
    pageStats: read("page-stats.json"),
    currency: meta.currency || "EUR",
    endDate: meta.dataPeriod?.end || new Date().toISOString().slice(0, 10),
  });
  fs.writeFileSync(path.join(D, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`${summary.method} : ${summary.text}`);
}

main();
