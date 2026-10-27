import "server-only";
import type { ZodError } from "zod";
import { ApiError } from "./api";

export interface ActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Values to put back in the form after an error. Never holds passwords. */
  values?: Record<string, string>;
  message?: string;
  /** A link the owner can share by hand when email could not be sent. */
  link?: string;
}

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export function valuesOf(fd: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));
}

export function zodFail(error: ZodError, values: Record<string, string>): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { fieldErrors, values };
}

/** Turns an API error into form state. Anything else (including redirects) is rethrown. */
export function apiFail(err: unknown, values: Record<string, string> = {}): ActionState {
  if (!(err instanceof ApiError)) throw err;
  if (err.errors.length) {
    const fieldErrors: Record<string, string> = {};
    for (const e of err.errors) fieldErrors[e.path] ??= e.message;
    return { fieldErrors, values };
  }
  return { error: err.message, values };
}
