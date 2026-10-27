"use server";

import { changePasswordInput } from "@dscims/shared";
import { api } from "@/lib/api";
import { apiFail, zodFail } from "@/lib/action";
import type { FormAction } from "@/lib/action";

const field = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export const changePassword: FormAction = async (_prev, fd) => {
  if (field(fd, "password") !== field(fd, "confirm")) return { fieldErrors: { confirm: "The two passwords do not match" } };
  const parsed = changePasswordInput.safeParse({ currentPassword: field(fd, "currentPassword"), password: field(fd, "password") });
  if (!parsed.success) return zodFail(parsed.error, {});
  try {
    await api("/auth/change-password", { method: "POST", body: parsed.data });
  } catch (err) {
    return apiFail(err);
  }
  return { ok: true, message: "Password changed. Your other devices were signed out." };
};
