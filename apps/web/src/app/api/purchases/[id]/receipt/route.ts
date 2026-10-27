import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiRaw } from "@/lib/api";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await apiRaw(`/purchases/${encodeURIComponent(id)}/receipt`);
  if (!res.ok) return new NextResponse(null, { status: res.status === 403 || res.status === 404 ? res.status : 502 });
  return new NextResponse(res.body, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": res.headers.get("content-disposition") ?? "inline", "Cache-Control": "no-store" } });
}
