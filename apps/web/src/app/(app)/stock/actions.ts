"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deviceUpdateInput, flagInput, resolveFlagInput } from "@dscims/shared";
import { api } from "@/lib/api";
import { apiFail, text, valuesOf, zodFail } from "@/lib/action";
import type { ActionState, FormAction } from "@/lib/action";
import { parseNaira } from "@/lib/format";
import { requireMe } from "@/lib/session";

export const flagDevice: FormAction = async (_prev, fd) => {
  await requireMe();
  const id = text(fd, "id");
  const values = valuesOf(fd, ["type", "reference", "note"]);
  const parsed = flagInput.safeParse({ type: text(fd, "type"), reference: text(fd, "reference"), note: text(fd, "note") });
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    await api(`/devices/${id}/flag`, { method: "POST", body: parsed.data });
  } catch (err) {
    return apiFail(err, values);
  }
  revalidatePath(`/stock/${id}`);
  return { ok: true, message: "The phone is flagged and cannot be sold until the owner clears it." };
};

export const resolveFlag: FormAction = async (_prev, fd) => {
  await requireMe();
  const id = text(fd, "id");
  const values = valuesOf(fd, ["outcome", "note"]);
  const parsed = resolveFlagInput.safeParse({ outcome: text(fd, "outcome"), note: text(fd, "note") });
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    await api(`/devices/${id}/resolve-flag`, { method: "POST", body: parsed.data });
  } catch (err) {
    return apiFail(err, values);
  }
  revalidatePath(`/stock/${id}`);
  return { ok: true, message: "The flag was resolved and recorded in the phone's history." };
};

export async function approveProof(formData: FormData): Promise<void> {
  await requireMe();
  const id = String(formData.get("id") ?? "");
  await api(`/devices/${id}/approve-proof`, { method: "POST" });
  revalidatePath(`/stock/${id}`);
}

/** Called by the photo button after the file is uploaded. */
export async function addDevicePhoto(id: string, fileId: string): Promise<ActionState> {
  await requireMe();
  try {
    await api(`/devices/${id}/photos`, { method: "POST", body: { fileId } });
  } catch (err) {
    return apiFail(err);
  }
  revalidatePath(`/stock/${id}`);
  return { ok: true };
}

export const updateDevice: FormAction = async (_prev, fd) => {
  const me = await requireMe();
  const id = text(fd, "id");
  const values = valuesOf(fd, ["brand", "model", "storage", "colour", "condition", "sellingPrice", "costPrice"]);
  const selling = parseNaira(values.sellingPrice ?? "");
  const cost = values.costPrice ? parseNaira(values.costPrice) : undefined;
  const fieldErrors: Record<string, string> = {};
  if (!selling) fieldErrors.sellingPrice = "Enter the selling price in naira";
  if (values.costPrice && !cost) fieldErrors.costPrice = "Enter the buying price in naira";
  const parsed = deviceUpdateInput.safeParse({ brand: text(fd, "brand"), model: text(fd, "model"), storage: text(fd, "storage"), colour: text(fd, "colour"), condition: text(fd, "condition"), sellingKobo: selling ?? undefined, costKobo: me.user.role === "staff" ? undefined : (cost ?? undefined) });
  if (!parsed.success) return { ...zodFail(parsed.error, values), fieldErrors: { ...zodFail(parsed.error, values).fieldErrors, ...fieldErrors } };
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };
  try {
    await api(`/devices/${id}`, { method: "PATCH", body: parsed.data });
  } catch (err) {
    return apiFail(err, values);
  }
  revalidatePath(`/stock/${id}`);
  redirect(`/stock/${id}?saved=1`);
};
