import { describe, expect, it } from "vitest";
import { dayLabel, firstName, greeting, longDate } from "./greeting";

describe("greeting (Lagos time)", () => {
  it("follows the Lagos hour, not the server's", () => {
    expect(greeting(new Date("2026-10-27T07:30:00Z"))).toBe("Good morning"); // 8:30 AM WAT
    expect(greeting(new Date("2026-10-27T11:30:00Z"))).toBe("Good afternoon"); // 12:30 PM WAT
    expect(greeting(new Date("2026-10-27T17:00:00Z"))).toBe("Good evening"); // 6:00 PM WAT
    expect(greeting(new Date("2026-10-26T23:30:00Z"))).toBe("Good morning"); // 12:30 AM WAT
  });
  it("writes dates with the year", () => {
    expect(longDate(new Date("2026-10-27T08:00:00Z"))).toMatch(/^Tuesday,? 27 Oct 2026$/);
    expect(dayLabel("2026-10-21")).toBe("Wed 21");
  });
  it("takes the first name", () => {
    expect(firstName("Adaeze Okoro")).toBe("Adaeze");
  });
});
