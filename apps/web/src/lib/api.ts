import "server-only";
import { cookies } from "next/headers";

export const USER_COOKIE = "dscims_session";
export const PLATFORM_COOKIE = "dscims_platform";
export const SHOP_COOKIE = "dscims_shop";

const API_URL = process.env.API_URL ?? "http://localhost:3006";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  /** Which sign-in to send: a dealer user (default), a platform admin, or none. */
  scope?: "user" | "platform" | "none";
  idempotencyKey?: string;
}

/** The only door to the API. The token stays in an httpOnly cookie and never reaches browser JavaScript. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, query, scope = "user", idempotencyKey } = options;
  const url = new URL(path, API_URL);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (scope !== "none") {
    const token = (await cookies()).get(scope === "platform" ? PLATFORM_COOKIE : USER_COOKIE)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  } catch {
    throw new ApiError(0, "NETWORK", "We could not reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const b = (json ?? {}) as { code?: string; message?: string | string[]; errors?: { path: string; message: string }[] };
    const message = Array.isArray(b.message) ? b.message[0] : b.message;
    throw new ApiError(res.status, b.code ?? "ERROR", message ?? `Something went wrong (${res.status})`, b.errors ?? []);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
