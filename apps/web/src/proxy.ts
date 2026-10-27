import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic check only: a missing cookie goes to the sign-in page. Every page and API call
// still verifies the session on the server (see lib/session.ts).
const PUBLIC = ["/login", "/forgot-password", "/reset-password", "/invite", "/session", "/offline", "/access-ended", "/locked", "/platform/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPlatform = pathname === "/platform" || pathname.startsWith("/platform/");
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const has = (name: string) => Boolean(request.cookies.get(name)?.value);

  if (isPlatform && !isPublic && !has("dscims_platform")) return NextResponse.redirect(new URL("/platform/login", request.url));
  if (!isPlatform && !isPublic && !has("dscims_session")) return NextResponse.redirect(new URL("/login", request.url));
  if (pathname === "/login" && has("dscims_session")) return NextResponse.redirect(new URL("/", request.url));

  const response = NextResponse.next();
  // Pages with accounts and links must never be cached or indexed.
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/|icons/|manifest.webmanifest|sw.js|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
