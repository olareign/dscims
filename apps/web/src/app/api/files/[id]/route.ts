import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiRaw } from "@/lib/api";

// Shows a private file. The API checks access, then answers with the bytes or a short-lived signed link, which we pass on.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await apiRaw(`/files/${encodeURIComponent(id)}`);
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) return NextResponse.redirect(location, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  if (!res.ok) return new NextResponse(null, { status: res.status === 403 || res.status === 404 ? res.status : 502 });
  return new NextResponse(res.body, { status: 200, headers: { "Content-Type": res.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
