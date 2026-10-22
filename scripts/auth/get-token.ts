// Première autorisation OAuth 2.0 : ouvre le navigateur, récupère le code sur
// http://localhost:3000/callback (URL déclarée dans l'app LinkedIn) et écrit les
// jetons dans .env.local.
import http from "http";
import { URL } from "url";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || "http://localhost:3000/callback";
// r_organization_admin est nécessaire aux statistiques de la page (abonnés, visites, posts).
const SCOPES = ["r_ads", "r_ads_reporting", "r_organization_social", "r_organization_admin", "r_basicprofile"];
const ENV_FILE = path.join(process.cwd(), ".env.local");

const redirect = new URL(REDIRECT_URI);
const PORT = parseInt(redirect.port || "80", 10);

async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Échange du code refusé (${res.status}) : ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  }>;
}

export function upsertEnv(file: string, updates: Record<string, string>) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, "")}\n${line}\n`;
  }
  fs.writeFileSync(file, content);
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("LINKEDIN_CLIENT_ID ou LINKEDIN_CLIENT_SECRET manquant dans .env.local");
    process.exit(1);
  }
  const state = Math.random().toString(36).slice(2);
  const authUrl =
    `https://www.linkedin.com/oauth/v2/authorization?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}` +
    `&scope=${encodeURIComponent(SCOPES.join(" "))}`;

  console.log("\n=== Autorisation LinkedIn ===\n");
  console.log("Ouvrez cette URL (le navigateur s'ouvre automatiquement) :\n");
  console.log(authUrl);
  console.log(`\nEn attente du retour sur ${REDIRECT_URI}...\n`);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    if (url.pathname !== redirect.pathname) {
      res.writeHead(404);
      res.end();
      return;
    }
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (error || !code) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Erreur : ${error || "code absent"}</h1><p>${url.searchParams.get("error_description") || ""}</p>`);
      console.error(`Autorisation refusée : ${error || "code absent"}`);
      server.close();
      process.exit(1);
    }
    try {
      const tokenData = await exchangeCodeForToken(code);
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      upsertEnv(ENV_FILE, {
        LINKEDIN_ACCESS_TOKEN: tokenData.access_token,
        LINKEDIN_REFRESH_TOKEN: tokenData.refresh_token || "",
        LINKEDIN_TOKEN_EXPIRES_AT: expiresAt,
      });
      console.log(`Jeton obtenu, expire le ${expiresAt}`);
      console.log(`Scopes accordés : ${tokenData.scope || "(non renvoyés)"}`);
      console.log(tokenData.refresh_token ? "Jeton de rafraîchissement obtenu" : "Pas de jeton de rafraîchissement");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:50px">
        <h1 style="color:#15803d">Autorisation réussie</h1>
        <p>Le jeton est enregistré dans .env.local (expire le ${expiresAt}).</p>
        <p>Vous pouvez fermer cet onglet.</p></body></html>`);
    } catch (err) {
      console.error("Échange du code échoué :", err);
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Erreur</h1><pre>${String(err)}</pre>`);
    }
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 800);
  });

  server.listen(PORT, () => {
    console.log(`Serveur local sur le port ${PORT}`);
    // Ouverture sans passer par un shell : aucun échappement des « & » de l'URL.
    const [cmd, args] =
      process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", authUrl]]
        : process.platform === "darwin"
          ? ["open", [authUrl]]
          : ["xdg-open", [authUrl]];
    try {
      spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
    } catch {}
  });
}

main();
