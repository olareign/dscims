"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createDealerInput, loginInput } from "@dscims/shared";
import { PLATFORM_COOKIE, api } from "@/lib/api";
import { apiFail, text, valuesOf, zodFail } from "@/lib/action";
import type { FormAction } from "@/lib/action";
import { setPlatformSession } from "@/lib/session";

export const platformLogin: FormAction = async (_prev, fd) => {
  const values = { email: text(fd, "email") };
  const parsed = loginInput.safeParse({ ...values, password: String(fd.get("password") ?? "") });
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    const res = await api<{ token: string }>("/platform/auth/login", { method: "POST", body: parsed.data, scope: "none" });
    await setPlatformSession(res.token);
  } catch (err) {
    return apiFail(err, values);
  }
  redirect("/platform");
};

export async function platformSignOut() {
  (await cookies()).delete(PLATFORM_COOKIE);
  redirect("/platform/login");
}

export const createDealer: FormAction = async (_prev, fd) => {
  const values = valuesOf(fd, ["businessName", "ownerName", "ownerEmail", "shopName"]);
  const parsed = createDealerInput.safeParse({ businessName: text(fd, "businessName"), ownerName: text(fd, "ownerName"), ownerEmail: text(fd, "ownerEmail"), shopName: text(fd, "shopName") });
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    const res = await api<{ dealer: { name: string }; inviteUrl: string | null }>("/platform/dealers", { method: "POST", body: parsed.data, scope: "platform" });
    if (res.inviteUrl) return { ok: true, message: `${res.dealer.name} was created.`, link: res.inviteUrl };
  } catch (err) {
    return apiFail(err, values);
  }
  redirect(`/platform?created=${encodeURIComponent(parsed.data.businessName)}`);
};

async function change(fd: FormData, action: "suspend" | "reactivate") {
  try {
    await api(`/platform/dealers/${text(fd, "id")}/${action}`, { method: "POST", scope: "platform" });
  } catch (err) {
    return apiFail(err);
  }
  redirect("/platform");
}

export const suspendDealer: FormAction = async (_prev, fd) => change(fd, "suspend");
export const reactivateDealer: FormAction = async (_prev, fd) => change(fd, "reactivate");
