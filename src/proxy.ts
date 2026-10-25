import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

// Toutes les pages et les visuels passent par ici ; sans session valide, renvoi vers /login.
// Sans DASHBOARD_PASSWORD, le site reste ouvert.
export async function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value || "";
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Exclus : la page et l'API de connexion, les fichiers techniques de Next.js, le logo.
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|icon.svg|quarkslab-logo.svg|robots.txt).*)"],
};
