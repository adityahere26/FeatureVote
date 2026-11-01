import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-path";

describe("safeNextPath", () => {
  it("keeps same-site paths and their query", () => {
    expect(safeNextPath("/w/acme?tab=roadmap")).toBe("/w/acme?tab=roadmap");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ])("falls back for %s", (value) => {
    expect(safeNextPath(value)).toBe("/workspaces");
  });
});
