export type SearchParams = Record<string, string | string[] | undefined>;

export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

/** Builds a link that keeps the current filters and changes only what is passed. Null removes a key. */
export function href(path: string, params: SearchParams, change: Record<string, string | number | null> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = one(v);
    if (value !== undefined) q.set(k, value);
  }
  for (const [k, v] of Object.entries(change)) {
    if (v === null || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export const num = (v: string | string[] | undefined, fallback: number): number => {
  const n = Number(one(v));
  return Number.isInteger(n) && n > 0 ? n : fallback;
};
