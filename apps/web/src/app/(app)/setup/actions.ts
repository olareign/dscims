"use server";

import { redirect } from "next/navigation";
import { settingsInput } from "@dscims/shared";
import { api } from "@/lib/api";
import { apiFail, text, valuesOf, zodFail } from "@/lib/action";
import type { FormAction } from "@/lib/action";
import { readShop } from "@/lib/shop-form";
import { requireOwner } from "@/lib/session";

export const saveShopStep: FormAction = async (_prev, fd) => {
  const me = await requireOwner();
  const businessName = text(fd, "businessName");
  const shop = readShop(fd);
  if (!shop.ok) return { ...shop.state, values: { ...shop.state.values, businessName } };
  const parsed = settingsInput.safeParse({ businessName });
  if (!parsed.success) return zodFail(parsed.error, { ...shop.values, businessName });
  try {
    await api("/settings", { method: "PUT", body: parsed.data });
    // The main shop is always first in the owner's list.
    await api(`/shops/${me.shops[0].id}`, { method: "PATCH", body: shop.input });
  } catch (err) {
    return apiFail(err, { ...shop.values, businessName });
  }
  redirect("/setup?step=2");
};

export const saveRules: FormAction = async (_prev, fd) => {
  await requireOwner();
  const values = valuesOf(fd, ["businessName", "discountLimitPercent", "creditDueDays", "receiptText"]);
  const parsed = settingsInput.safeParse({
    businessName: fd.has("businessName") ? text(fd, "businessName") : undefined,
    discountLimitPercent: Number(text(fd, "discountLimitPercent")),
    creditDueDays: Number(text(fd, "creditDueDays")),
    receiptText: text(fd, "receiptText"),
  });
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    await api("/settings", { method: "PUT", body: parsed.data });
    if (text(fd, "finish") === "1") await api("/settings/complete-setup", { method: "POST" });
  } catch (err) {
    return apiFail(err, values);
  }
  if (text(fd, "finish") === "1") redirect("/");
  return { ok: true, message: "Saved.", values };
};
