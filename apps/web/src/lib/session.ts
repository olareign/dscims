import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MeDto } from "@dscims/shared";
import { ApiError, PLATFORM_COOKIE, SHOP_COOKIE, USER_COOKIE, api } from "./api";

const SESSION_DAYS = Number(process.env.SESSION_DAYS ?? 14);
const secure = process.env.NODE_ENV === "production";

export async function setSession(token: string) {
  (await cookies()).set(USER_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(USER_COOKIE);
  store.delete(SHOP_COOKIE);
}

export async function setPlatformSession(token: string) {
  (await cookies()).set(PLATFORM_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 12 * 3600 });
}

const getMe = cache(() => api<MeDto>("/auth/me"));

/** The signed-in person, or a redirect that explains why they are not. Checked on the server on every page. */
export async function requireMe(): Promise<MeDto> {
  let me: MeDto;
  try {
    me = await getMe();
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect(`/session/end?reason=${err.code === "ACCESS_ENDED" ? "ended" : "expired"}`);
      if (err.code === "TENANT_LOCKED") redirect("/locked");
    }
    throw err;
  }
  if (me.tenant.status === "locked") redirect("/locked");
  return me;
}

export async function requireOwner(): Promise<MeDto> {
  const me = await requireMe();
  if (me.user.role !== "owner") redirect("/");
  return me;
}

/** The shop the owner picked in the switcher; managers and staff are fixed to their own. */
export async function currentShopId(me: MeDto): Promise<string | null> {
  if (me.user.role !== "owner") return me.user.shopId;
  const picked = (await cookies()).get(SHOP_COOKIE)?.value;
  return picked && me.shops.some((s) => s.id === picked) ? picked : null;
}
