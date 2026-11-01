import { z } from "zod";

// These mirror the CHECK constraints in supabase/migrations. The database is the
// real boundary; this layer exists to give people readable errors.

export const REQUEST_STATUSES = [
  "under_review",
  "planned",
  "in_progress",
  "released",
  "declined",
];

export const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/,
      "Use 3-48 lowercase letters, numbers or hyphens",
    ),
  isPublic: z.boolean().default(false),
});

export const featureRequestSchema = z.object({
  workspaceId: z.uuid(),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(5000).default(""),
});

export const commentSchema = z.object({
  workspaceId: z.uuid(),
  requestId: z.uuid(),
  body: z.string().trim().min(1).max(2000),
});

export const statusUpdateSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(REQUEST_STATUSES),
});

export const displayNameSchema = z.string().trim().min(1).max(80);

export const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(72),
});
