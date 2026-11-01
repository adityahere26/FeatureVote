"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { describeDatabaseError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  commentSchema,
  featureRequestSchema,
  requestEditSchema,
  slugSchema,
  statusUpdateSchema,
} from "@/lib/validation";

// Permissions are enforced by RLS and the database functions, not here. The slug
// only decides where to go next, so it is validated but never trusted for access.

function readSlug(formData) {
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) {
    redirect("/workspaces");
  }
  return slug.data;
}

function refresh(slug) {
  revalidatePath(`/w/${slug}`, "layout");
}

export async function submitRequest(_previousState, formData) {
  const slug = readSlug(formData);
  const parsed = featureRequestSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) {
    return { error: "Use a title of 3-120 characters and details under 5,000 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .insert({
      workspace_id: parsed.data.workspaceId,
      title: parsed.data.title,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(slug);
  redirect(`/w/${slug}/requests/${data.id}`);
}

export async function updateRequest(_previousState, formData) {
  const slug = readSlug(formData);
  const parsed = requestEditSchema.safeParse({
    requestId: formData.get("requestId"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) {
    return { error: "Use a title of 3-120 characters and details under 5,000 characters." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("feature_requests")
    .update({ title: parsed.data.title, body: parsed.data.body }, { count: "exact" })
    .eq("id", parsed.data.requestId);

  if (error) {
    return { error: describeDatabaseError(error) };
  }
  if (count !== 1) {
    return { error: "You don't have permission to do that." };
  }
  refresh(slug);
  redirect(`/w/${slug}/requests/${parsed.data.requestId}`);
}

export async function deleteRequest(_previousState, formData) {
  const slug = readSlug(formData);
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("feature_requests")
    .delete({ count: "exact" })
    .eq("id", formData.get("requestId"));

  if (error) {
    return { error: describeDatabaseError(error) };
  }
  if (count !== 1) {
    return { error: "You don't have permission to do that." };
  }
  refresh(slug);
  redirect(`/w/${slug}`);
}

export async function toggleVote(_previousState, formData) {
  const slug = readSlug(formData);
  const requestId = formData.get("requestId");
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/w/${slug}/requests/${requestId}`)}`);
  }

  const supabase = await createClient();
  const { error } =
    formData.get("intent") === "remove"
      ? await supabase.from("votes").delete().eq("request_id", requestId).eq("user_id", userId)
      : await supabase.rpc("add_vote", { p_request_id: requestId });

  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(slug);
  return {};
}

export async function updateStatus(_previousState, formData) {
  const slug = readSlug(formData);
  const parsed = statusUpdateSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: "Choose a status." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_request_status", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
  });
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(slug);
  return { message: "Status updated." };
}

export async function addComment(_previousState, formData) {
  const slug = readSlug(formData);
  const parsed = commentSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    requestId: formData.get("requestId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: "Comments need 1-2,000 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    workspace_id: parsed.data.workspaceId,
    request_id: parsed.data.requestId,
    body: parsed.data.body,
  });
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(slug);
  return {};
}

export async function deleteComment(_previousState, formData) {
  const slug = readSlug(formData);
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("comments")
    .delete({ count: "exact" })
    .eq("id", formData.get("commentId"));

  if (error) {
    return { error: describeDatabaseError(error) };
  }
  if (count !== 1) {
    return { error: "You don't have permission to do that." };
  }
  refresh(slug);
  return {};
}
