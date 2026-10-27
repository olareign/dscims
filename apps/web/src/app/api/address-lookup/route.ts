import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ApiError, api } from "@/lib/api";

// Used by the "Use my location" button. The browser asks us; we ask the API (which holds the geocoder settings).
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");
  try {
    return NextResponse.json(await api<{ address: string }>("/shops/address-lookup", { query: { lat, lng } }));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status || 502 });
    throw err;
  }
}
