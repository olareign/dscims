import type { DeviceStatus } from "@dscims/shared";

/** Colour of a device's status in lists and on the detail page (the `.st` and `.badge` tones). */
export const STATUS_TONE: Record<DeviceStatus, "ok" | "warn" | "bad" | "off"> = {
  in_stock: "ok", under_review: "warn", flagged: "bad", sold: "off", returned: "warn", reserved: "warn", written_off: "off",
};
