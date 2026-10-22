// Renouvelle le jeton d'accès à partir du refresh token (valable ~1 an) et met à
// jour .env.local. Après un rafraîchissement local, reporter LINKEDIN_ACCESS_TOKEN
// dans les variables d'environnement Vercel puis redéployer.
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const REFRESH_TOKEN = process.env.LINKEDIN_REFRESH_TOKEN || "";
const EXPIRES_AT = process.env.LINKEDIN_TOKEN_EXPIRES_AT || "";
const ENV_FILE = path.join(process.cwd(), ".env.local");
const FORCE = process.argv.includes("--force");

function upsertEnv(file: string, updates: Record<string, string>) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, "")}\n${line}\n`;
  }
  fs.writeFileSync(file, content);
}

async function main() {
  if (EXPIRES_AT && !FORCE) {
    const days = (new Date(EXPIRES_AT).getTime() - Date.now()) / 86400000;
    if (days > 7) {
      console.log(`Jeton encore valable ${Math.round(days)} jours (expire le ${EXPIRES_AT}). Utiliser --force pour renouveler quand même.`);
      return;
    }
    console.warn(days <= 0 ? `Jeton expiré depuis ${Math.abs(Math.round(days))} jours, renouvellement...` : `Jeton expire dans ${Math.round(days)} jours, renouvellement...`);
  }
  if (!REFRESH_TOKEN) {
    console.error("Pas de refresh token : lancer `npm run auth`.");
    process.exit(1);
  }
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: REFRESH_TOKEN,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    console.error(`Renouvellement refusé (${res.status}) : ${await res.text()}`);
    console.error("Lancer `npm run auth` pour une nouvelle autorisation.");
    process.exit(1);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  upsertEnv(ENV_FILE, {
    LINKEDIN_ACCESS_TOKEN: data.access_token,
    LINKEDIN_TOKEN_EXPIRES_AT: expiresAt,
    ...(data.refresh_token ? { LINKEDIN_REFRESH_TOKEN: data.refresh_token } : {}),
  });
  console.log(`Jeton renouvelé, expire le ${expiresAt}. Reporter LINKEDIN_ACCESS_TOKEN sur Vercel puis redéployer.`);
}

main().catch((err) => {
  console.error("Renouvellement échoué :", err);
  process.exit(1);
});
