import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Paginated, SellerDto } from "@dscims/shared";
import { ApiError, api } from "@/lib/api";

// Used by the seller picker in the purchase form.
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await api<Paginated<SellerDto>>("/sellers", { query: { search: request.nextUrl.searchParams.get("search"), pageSize: 5, sort: "recent" } }));
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ message: err.message }, { status: err.status || 502 });
    throw err;
  }
}
