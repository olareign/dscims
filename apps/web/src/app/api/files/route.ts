import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiRaw } from "@/lib/api";

// The browser sends a photo or PDF here; we pass it to the API with the signed-in cookie. The token never reaches the browser.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const res = await apiRaw("/files", { method: "POST", body: form });
  return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
