"use server";

import { redirect } from "next/navigation";
import { acceptInviteInput, forgotPasswordInput, loginInput, resetPasswordInput } from "@dscims/shared";
import { api } from "@/lib/api";
import { apiFail, text, zodFail } from "@/lib/action";
import type { FormAction } from "@/lib/action";
import { setSession } from "@/lib/session";

const password = (fd: FormData, key = "password") => String(fd.get(key) ?? "");

export const login: FormAction = async (_prev, fd) => {
  const values = { email: text(fd, "email") };
  const parsed = loginInput.safeParse({ ...values, password: password(fd) });
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    const res = await api<{ token: string }>("/auth/login", { method: "POST", body: parsed.data, scope: "none" });
    await setSession(res.token);
  } catch (err) {
    return apiFail(err, values);
  }
  redirect("/");
};

export const forgotPassword: FormAction = async (_prev, fd) => {
  const values = { email: text(fd, "email") };
  const parsed = forgotPasswordInput.safeParse(values);
  if (!parsed.success) return zodFail(parsed.error, values);
  try {
    await api("/auth/forgot-password", { method: "POST", body: parsed.data, scope: "none" });
  } catch (err) {
    return apiFail(err, values);
  }
  return { ok: true, message: "If that email has an account, a reset link is on its way. It works for 30 minutes.", values };
};

function matchOrFail(fd: FormData) {
  return password(fd) === password(fd, "confirm") ? null : { fieldErrors: { confirm: "The two passwords do not match" } };
}

export const resetPassword: FormAction = async (_prev, fd) => {
  const mismatch = matchOrFail(fd);
  if (mismatch) return mismatch;
  const parsed = resetPasswordInput.safeParse({ token: text(fd, "token"), password: password(fd) });
  if (!parsed.success) return zodFail(parsed.error, {});
  try {
    await api("/auth/reset-password", { method: "POST", body: parsed.data, scope: "none" });
  } catch (err) {
    return apiFail(err);
  }
  redirect("/login?reset=1");
};

export const acceptInvite: FormAction = async (_prev, fd) => {
  const mismatch = matchOrFail(fd);
  if (mismatch) return mismatch;
  const parsed = acceptInviteInput.safeParse({ token: text(fd, "token"), password: password(fd) });
  if (!parsed.success) return zodFail(parsed.error, {});
  try {
    const res = await api<{ token: string }>("/auth/accept-invite", { method: "POST", body: parsed.data, scope: "none" });
    await setSession(res.token);
  } catch (err) {
    return apiFail(err);
  }
  redirect("/");
};
