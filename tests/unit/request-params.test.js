import { describe, expect, it } from "vitest";
import { boardHref, parseBoardParams } from "@/lib/request-params";

describe("parseBoardParams", () => {
  it("uses defaults when nothing is given", () => {
    expect(parseBoardParams()).toEqual({ q: "", status: "", sort: "votes", page: 1 });
  });

  it("keeps valid values", () => {
    expect(
      parseBoardParams({ q: " dark mode ", status: "planned", sort: "newest", page: "3" }),
    ).toEqual({ q: "dark mode", status: "planned", sort: "newest", page: 3 });
  });

  it("ignores unexpected input", () => {
    expect(
      parseBoardParams({ q: ["a", "b"], status: "done", sort: "toString", page: "-1" }),
    ).toEqual({ q: "", status: "", sort: "votes", page: 1 });
  });

  it("caps the search length", () => {
    expect(parseBoardParams({ q: "x".repeat(500) }).q).toHaveLength(200);
  });
});

describe("boardHref", () => {
  it("omits defaults", () => {
    expect(boardHref("acme", parseBoardParams())).toBe("/w/acme");
  });

  it("keeps filters across pages and escapes the query", () => {
    expect(boardHref("acme", { q: "a&b", status: "planned", sort: "newest", page: 1 }, { page: 2 }))
      .toBe("/w/acme?q=a%26b&status=planned&sort=newest&page=2");
  });
});
