"use server";

import { redirect } from "next/navigation";
import { purchaseInput } from "@dscims/shared";
import type { PurchaseDto, PurchaseInput } from "@dscims/shared";
import { api } from "@/lib/api";
import { apiFail, zodFail } from "@/lib/action";
import type { ActionState } from "@/lib/action";
import { requireBuyer } from "@/lib/session";

/** What the purchase form sends. The API checks it again with the same shared schema. */
export type PurchasePayload = Omit<PurchaseInput, "declaration"> & { declaration: boolean };

export async function submitPurchase(payload: PurchasePayload, idempotencyKey: string): Promise<ActionState> {
  await requireBuyer();
  const parsed = purchaseInput.safeParse(payload);
  if (!parsed.success) return zodFail(parsed.error, {});
  let purchase: PurchaseDto;
  try {
    // The key is made when the form opens, so a double tap or a retry records the purchase once.
    purchase = await api<PurchaseDto>("/purchases", { method: "POST", body: parsed.data, idempotencyKey: idempotencyKey.slice(0, 120) });
  } catch (err) {
    return apiFail(err);
  }
  redirect(`/stock/buy/done/${purchase.id}`);
}
