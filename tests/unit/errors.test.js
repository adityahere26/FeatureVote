import { describe, expect, it } from "vitest";
import { describeDatabaseError } from "@/lib/errors";

describe("describeDatabaseError", () => {
  it("explains rate limits and last-owner protection", () => {
    expect(describeDatabaseError({ code: "P0001", hint: "rate_limited" })).toContain("too often");
    expect(describeDatabaseError({ code: "P0001", hint: "last_owner" })).toContain("one owner");
  });

  it("never passes raw database messages through", () => {
    const message = describeDatabaseError({ code: "XX000", message: "relation secret_table" });
    expect(message).not.toContain("secret_table");
  });
});
