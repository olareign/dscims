"use server";

import { redirect } from "next/navigation";
import { sellerInput } from "@dscims/shared";
import type { SellerDto } from "@dscims/shared";
import { api } from "@/lib/api";
import { apiFail, text, valuesOf, zodFail } from "@/lib/action";
import type { FormAction } from "@/lib/action";
import { requireBuyer } from "@/lib/session";

// NIN and BVN are never put back into the form after an error: they are not kept in `values`.
export const createSeller: FormAction = async (_prev, fd) => {
  await requireBuyer();
  const values = valuesOf(fd, ["name", "phone", "address"]);
  const parsed = sellerInput.safeParse({ name: text(fd, "name"), phone: text(fd, "phone"), address: text(fd, "address"), nin: text(fd, "nin"), bvn: text(fd, "bvn"), idFileId: text(fd, "idFileId") || null });
  if (!parsed.success) return zodFail(parsed.error, values);
  let seller: SellerDto;
  try {
    seller = await api<SellerDto>("/sellers", { method: "POST", body: parsed.data });
  } catch (err) {
    return apiFail(err, values);
  }
  // Only ever return to a page inside this app.
  const next = text(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? `${next}${next.includes("?") ? "&" : "?"}seller=${seller.id}` : `/sellers/${seller.id}?added=1`);
};
