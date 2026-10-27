import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearSession } from "@/lib/session";

// Signed-out landing: clears the cookie (pages cannot) and explains why.
export async function GET(request: NextRequest) {
  await clearSession();
  const reason = request.nextUrl.searchParams.get("reason");
  const target = reason === "ended" ? "/access-ended" : reason === "expired" ? "/login?expired=1" : "/login";
  return NextResponse.redirect(new URL(target, request.url));
}
