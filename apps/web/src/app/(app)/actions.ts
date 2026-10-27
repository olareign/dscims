"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, SHOP_COOKIE, api } from "@/lib/api";
import { clearSession } from "@/lib/session";

export async function signOut() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (err) {
    // A session that is already gone is fine; anything else should not be hidden.
    if (!(err instanceof ApiError) || err.status >= 500) throw err;
  }
  await clearSession();
  redirect("/login");
}

export async function switchShop(formData: FormData) {
  const id = String(formData.get("shopId") ?? "");
  const store = await cookies();
  if (id && id !== "all") store.set(SHOP_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  else store.delete(SHOP_COOKIE);
  redirect(String(formData.get("next") ?? "/"));
}
