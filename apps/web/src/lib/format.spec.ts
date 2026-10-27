import { describe, expect, it } from "vitest";
import { naira, nairaInputValue, parseNaira } from "./format";

describe("naira helpers", () => {
  it("reads amounts the way dealers type them", () => {
    expect(parseNaira("520,000")).toBe(52_000_000);
    expect(parseNaira("₦ 640000")).toBe(64_000_000);
    expect(parseNaira("1250.50")).toBe(125_050);
  });
  it("rejects anything that is not an amount", () => {
    for (const bad of ["", "abc", "0", "-5", "1.234", "12,5,0x"]) expect(parseNaira(bad)).toBeNull();
  });
  it("shows kobo as whole naira when there are no kobo", () => {
    expect(naira(64_000_000)).toBe("₦640,000");
    expect(naira(125_050)).toBe("₦1,250.50");
    expect(nairaInputValue(52_000_000)).toBe("520000");
    expect(nairaInputValue(null)).toBe("");
  });
});
