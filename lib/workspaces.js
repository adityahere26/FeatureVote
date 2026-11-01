import { cache } from "react";
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Null when the workspace doesn't exist or RLS hides it from this viewer.
export const getWorkspace = cache(async (slug) => {
  const supabase = await createClient();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, name, slug, is_public")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load workspace");
  }
  if (!workspace) {
    return null;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { ...workspace, userId: null, role: null };
  }

  const { data: membership } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .maybeSingle();

  return { ...workspace, userId, role: membership?.role ?? null };
});
