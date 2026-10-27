import { shopInput } from "@dscims/shared";
import { text, valuesOf, zodFail } from "./action";

const SHOP_KEYS = ["name", "address", "latitude", "longitude", "phone"];

const coordinate = (v: string) => (v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Reads the shop fields shared by setup, add shop and edit shop. */
export function readShop(fd: FormData) {
  const values = valuesOf(fd, SHOP_KEYS);
  const parsed = shopInput.safeParse({
    name: text(fd, "name"), address: text(fd, "address"), latitude: coordinate(text(fd, "latitude")), longitude: coordinate(text(fd, "longitude")), phone: text(fd, "phone"),
  });
  return parsed.success ? ({ ok: true as const, input: parsed.data, values }) : ({ ok: false as const, state: zodFail(parsed.error, values) });
}
