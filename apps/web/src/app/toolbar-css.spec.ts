import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const rule = (selector: string) => css.split("\n").flatMap((l) => l.split("}")).find((r) => r.trim().startsWith(selector + "{")) ?? "";

describe("list toolbar alignment", () => {
  it("bottom-aligns the toolbar row so search and labelled filters share a baseline", () => {
    expect(rule(".toolbar")).toContain("align-items:flex-end");
  });

  it("gives the search box, filter toggle, inputs and buttons the same control height", () => {
    expect(rule(".srx")).toContain("height:var(--ctl-h)");
    expect(rule(".fbtn")).toContain("min-height:var(--ctl-h)");
    expect(css).toContain(".fpanel .inp{height:var(--ctl-h)}");
    expect(css).toContain(".fpanel .btn{min-height:var(--ctl-h)}");
  });

  it("does not hard-code a pixel height on toolbar controls", () => {
    expect(rule(".srx")).not.toMatch(/(?<!-)height:\d+px/);
    expect(rule(".fbtn")).not.toMatch(/min-height:\d+px/);
  });
});
