"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { apiFail, text } from "@/lib/action";
import type { FormAction } from "@/lib/action";
import { readShop } from "@/lib/shop-form";
import { requireOwner } from "@/lib/session";

export const createShop: FormAction = async (_prev, fd) => {
  await requireOwner();
  const shop = readShop(fd);
  if (!shop.ok) return shop.state;
  try {
    await api("/shops", { method: "POST", body: shop.input, idempotencyKey: text(fd, "key") || randomUUID() });
  } catch (err) {
    return apiFail(err, shop.values);
  }
  redirect("/shops?added=1");
};

export const updateShop: FormAction = async (_prev, fd) => {
  await requireOwner();
  const shop = readShop(fd);
  if (!shop.ok) return shop.state;
  try {
    await api(`/shops/${text(fd, "id")}`, { method: "PATCH", body: shop.input });
  } catch (err) {
    return apiFail(err, shop.values);
  }
  return { ok: true, message: "Saved.", values: shop.values };
};
