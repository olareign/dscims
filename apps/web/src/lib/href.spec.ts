import { describe, expect, it } from "vitest";
import { href, num, one } from "./href";

describe("href", () => {
  it("keeps current filters and changes only what is asked", () => {
    expect(href("/users", { role: "staff", page: "3" }, { page: 1 })).toBe("/users?role=staff&page=1");
  });
  it("removes a key when given null or an empty value", () => {
    expect(href("/users", { role: "staff", q: "ada" }, { role: null, q: "" })).toBe("/users");
  });
  it("uses the first value when a param repeats and ignores empty ones", () => {
    expect(one(["a", "b"])).toBe("a");
    expect(one("")).toBeUndefined();
    expect(href("/x", { a: ["1", "2"], b: undefined })).toBe("/x?a=1");
  });
  it("encodes values safely", () => {
    expect(href("/audit", {}, { q: "a&b=c" })).toBe("/audit?q=a%26b%3Dc");
  });
});

describe("num", () => {
  it("accepts positive integers and falls back otherwise", () => {
    expect(num("4", 1)).toBe(4);
    for (const bad of ["0", "-2", "1.5", "abc", undefined, ""]) expect(num(bad, 7)).toBe(7);
  });
});
