import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ImeiCheckDto } from "@dscims/shared";
import { ApiError, api } from "@/lib/api";

// Used by the purchase form while the IMEI is typed.
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await api<ImeiCheckDto>("/devices/imei-check", { query: { imei: request.nextUrl.searchParams.get("imei") } }));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status || 502 });
    throw err;
  }
}
