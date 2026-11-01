"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inviteTokenSchema } from "@/lib/validation";

const INVALID = { error: "This invite is invalid, already used, or expired." };

export async function acceptInvite(_previousState, formData) {
  const token = inviteTokenSchema.safeParse(formData.get("token"));
  if (!token.success) {
    return INVALID;
  }

  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc("accept_invite", {
    p_token: token.data,
  });
  if (error) {
    return INVALID;
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();
  redirect(`/w/${workspace.slug}`);
}
