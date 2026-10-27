import { formatNaira, nairaToKobo } from "@dscims/shared";

/** Naira the way dealers write it: no trailing .00. */
export const naira = (kobo: number) => formatNaira(kobo).replace(/\.00$/, "");

/** Reads what a person typed ("520,000", "₦520000", "520000.50") as kobo. Null when it is not an amount. */
export function parseNaira(text: string): number | null {
  const clean = text.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const kobo = nairaToKobo(clean);
  return kobo > 0 ? kobo : null;
}

/** For a form field that already holds kobo: "520000" not "520,000.00". */
export const nairaInputValue = (kobo: number | null | undefined) => (kobo ? String(kobo / 100) : "");
