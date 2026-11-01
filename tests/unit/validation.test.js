import { describe, expect, it } from "vitest";
import {
  commentSchema,
  featureRequestSchema,
  statusUpdateSchema,
  workspaceSchema,
} from "@/lib/validation";

const id = "20000000-0000-4000-8000-00000000000a";

describe("workspaceSchema", () => {
  it("normalises the slug", () => {
    const { slug } = workspaceSchema.parse({ name: "Acme", slug: "  ACME-board " });
    expect(slug).toBe("acme-board");
  });

  it.each(["ab", "-acme", "acme-", "acme board", "a".repeat(49)])(
    "rejects the slug %s",
    (slug) => {
      expect(workspaceSchema.safeParse({ name: "Acme", slug }).success).toBe(false);
    },
  );

  it("is private unless asked otherwise", () => {
    expect(workspaceSchema.parse({ name: "Acme", slug: "acme" }).isPublic).toBe(false);
  });
});

describe("featureRequestSchema", () => {
  it("rejects titles that are only whitespace", () => {
    const input = { workspaceId: id, title: "     " };
    expect(featureRequestSchema.safeParse(input).success).toBe(false);
  });

  it("enforces the database length limits", () => {
    const long = { workspaceId: id, title: "x".repeat(121) };
    expect(featureRequestSchema.safeParse(long).success).toBe(false);
    const body = { workspaceId: id, title: "Dark mode", body: "x".repeat(5001) };
    expect(featureRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("commentSchema", () => {
  it("rejects empty comments", () => {
    const input = { workspaceId: id, requestId: id, body: "  " };
    expect(commentSchema.safeParse(input).success).toBe(false);
  });
});

describe("statusUpdateSchema", () => {
  it("accepts every roadmap status", () => {
    for (const status of ["under_review", "planned", "in_progress", "released", "declined"]) {
      expect(statusUpdateSchema.safeParse({ requestId: id, status }).success).toBe(true);
    }
  });

  it("rejects unknown statuses", () => {
    expect(statusUpdateSchema.safeParse({ requestId: id, status: "done" }).success).toBe(false);
  });
});
