import { describe, expect, it } from "vitest";
import { nextFromConfirmParams, safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps paths on our site", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("/join/abc?x=1")).toBe("/join/abc?x=1");
  });
  it("rejects anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad)).toBe("/app");
    }
  });
});

describe("nextFromConfirmParams", () => {
  const app = "https://giftledger.app";
  it("reads next directly", () => {
    expect(nextFromConfirmParams(new URLSearchParams("next=/join/t"), app)).toBe("/join/t");
  });
  it("reads next from a same-site redirect_to", () => {
    const p = new URLSearchParams({ redirect_to: `${app}/auth/confirm?next=%2Fjoin%2Ft` });
    expect(nextFromConfirmParams(p, app)).toBe("/join/t");
  });
  it("ignores redirect_to on another site", () => {
    const p = new URLSearchParams({ redirect_to: "https://evil.com/auth/confirm?next=/app/x" });
    expect(nextFromConfirmParams(p, app)).toBe("/app");
  });
  it("falls back to the app", () => {
    expect(nextFromConfirmParams(new URLSearchParams(), app)).toBe("/app");
  });
});
