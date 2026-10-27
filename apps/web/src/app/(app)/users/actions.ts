"use server";

import { redirect } from "next/navigation";
import { inviteUserInput, updateUserInput } from "@dscims/shared";
import type { InviteResultDto } from "@dscims/shared";
import { api } from "@/lib/api";
import { apiFail, text, valuesOf, zodFail } from "@/lib/action";
import type { FormAction } from "@/lib/action";
import { requireOwner } from "@/lib/session";

export const inviteUser: FormAction = async (_prev, fd) => {
  await requireOwner();
  const values = valuesOf(fd, ["name", "email", "role", "shopId"]);
  const parsed = inviteUserInput.safeParse({ name: text(fd, "name"), email: text(fd, "email"), role: text(fd, "role"), shopId: text(fd, "shopId") });
  if (!parsed.success) return zodFail(parsed.error, values);
  let result: InviteResultDto;
  try {
    // The key is made when the page is drawn, so a double tap or a retry creates one invite, not two.
    result = await api<InviteResultDto>("/users", { method: "POST", body: parsed.data, idempotencyKey: text(fd, "key") || undefined });
  } catch (err) {
    return apiFail(err, values);
  }
  if (result.inviteUrl) return { ok: true, message: `${result.user.name} was added.`, link: result.inviteUrl };
  redirect(`/users?added=${encodeURIComponent(result.user.name)}`);
};

export const updateUser: FormAction = async (_prev, fd) => {
  await requireOwner();
  const id = text(fd, "id");
  const values = valuesOf(fd, ["name", "role", "shopId"]);
  const parsed = updateUserInput.safeParse({ name: text(fd, "name"), role: text(fd, "role"), shopId: text(fd, "shopId") });
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    await api(`/users/${id}`, { method: "PATCH", body: parsed.data });
  } catch (err) {
    return apiFail(err, values);
  }
  return { ok: true, message: "Saved.", values };
};

async function simple(fd: FormData, action: "deactivate" | "reactivate" | "resend-invite"): ReturnType<FormAction> {
  await requireOwner();
  const id = text(fd, "id");
  try {
    const res = await api<InviteResultDto | undefined>(`/users/${id}/${action}`, { method: "POST" });
    if (action === "resend-invite" && res && "inviteUrl" in res && res.inviteUrl) return { ok: true, message: "New invite ready.", link: res.inviteUrl };
  } catch (err) {
    return apiFail(err);
  }
  if (action === "resend-invite") return { ok: true, message: "A new invite email is on its way." };
  redirect(`/users/${id}?done=${action}`);
}

export const deactivateUser: FormAction = async (_prev, fd) => simple(fd, "deactivate");
export const reactivateUser: FormAction = async (_prev, fd) => simple(fd, "reactivate");
export const resendInvite: FormAction = async (_prev, fd) => simple(fd, "resend-invite");
