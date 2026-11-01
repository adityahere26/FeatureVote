import { REQUESTS_PER_PAGE, ROADMAP_ITEMS_PER_STATUS } from "@/lib/request-params";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_STATUSES } from "@/lib/validation";
import { z } from "zod";

const REQUEST_FIELDS =
  "id, workspace_id, author_id, title, body, status, vote_count, comment_count, created_at, profiles (display_name)";

export async function listRequests(workspaceId, { q, status, sort, page }) {
  const supabase = await createClient();
  const from = (page - 1) * REQUESTS_PER_PAGE;

  let query = supabase
    .from("feature_requests")
    .select(REQUEST_FIELDS, { count: "exact" })
    .eq("workspace_id", workspaceId);

  if (q) query = query.textSearch("search", q, { type: "websearch", config: "english" });
  if (status) query = query.eq("status", status);
  if (sort === "votes") query = query.order("vote_count", { ascending: false });

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + REQUESTS_PER_PAGE - 1);

  if (error?.code === "PGRST103") {
    return { requests: [], total: 0 };
  }
  if (error) {
    throw new Error("Could not load requests");
  }
  return { requests: data, total: count };
}

// Which of these requests the signed-in user has voted for.
export async function getVotedRequestIds(userId, requestIds) {
  if (!userId || requestIds.length === 0) {
    return new Set();
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("votes")
    .select("request_id")
    .eq("user_id", userId)
    .in("request_id", requestIds);
  return new Set((data ?? []).map((vote) => vote.request_id));
}

// Roadmap columns are ordered by recent activity, not by votes.
export async function listRoadmap(workspaceId) {
  const supabase = await createClient();
  const columns = await Promise.all(
    REQUEST_STATUSES.map(async (status) => {
      const { data, count, error } = await supabase
        .from("feature_requests")
        .select("id, title, vote_count", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("status", status)
        .order("updated_at", { ascending: false })
        .limit(ROADMAP_ITEMS_PER_STATUS);

      if (error) {
        throw new Error("Could not load roadmap");
      }
      return { status, requests: data, total: count };
    }),
  );
  return columns;
}

export async function getRequest(workspaceId, requestId) {
  if (!z.uuid().safeParse(requestId).success) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .select(REQUEST_FIELDS)
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load request");
  }
  return data;
}

export async function listComments(requestId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, author_id, body, created_at, profiles (display_name)")
    .eq("request_id", requestId)
    .order("created_at")
    .limit(200);

  if (error) {
    throw new Error("Could not load comments");
  }
  return data;
}

export function authorName(record) {
  return record.profiles?.display_name ?? "Deleted user";
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}
