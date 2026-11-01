"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDatabaseError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  inviteSchema,
  memberRoleSchema,
  workspaceSettingsSchema,
} from "@/lib/validation";

// Permissions are enforced by RLS and the database functions, not here.

function refresh(formData) {
  revalidatePath(`/w/${formData.get("slug")}`, "layout");
}

export async function updateWorkspace(_previousState, formData) {
  const parsed = workspaceSettingsSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return { error: "Use a name of 2-80 characters." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name, is_public: parsed.data.isPublic }, { count: "exact" })
    .eq("id", parsed.data.workspaceId);

  if (error) {
    return { error: describeDatabaseError(error) };
  }
  if (count !== 1) {
    return { error: "You don't have permission to do that." };
  }
  refresh(formData);
  return { message: "Saved." };
}

export async function createInvite(_previousState, formData) {
  const parsed = inviteSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: "Choose a role." };
  }

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invite", {
    p_workspace_id: parsed.data.workspaceId,
    p_role: parsed.data.role,
  });
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(formData);
  return { link: `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${token}` };
}

export async function revokeInvite(_previousState, formData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", {
    p_invite_id: formData.get("inviteId"),
  });
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(formData);
  return {};
}

export async function changeMemberRole(_previousState, formData) {
  const parsed = memberRoleSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: "Choose a role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_role", {
    p_workspace_id: parsed.data.workspaceId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(formData);
  return {};
}

export async function removeMember(_previousState, formData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_workspace_id: formData.get("workspaceId"),
    p_user_id: formData.get("userId"),
  });
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  refresh(formData);
  if (formData.get("leaving") === "true") {
    redirect("/workspaces");
  }
  return {};
}

export async function deleteWorkspace(_previousState, formData) {
  if (formData.get("confirmation") !== formData.get("slug")) {
    return { error: "Type the workspace URL exactly to confirm." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("workspaces")
    .delete({ count: "exact" })
    .eq("id", formData.get("workspaceId"));

  if (error) {
    return { error: describeDatabaseError(error) };
  }
  if (count !== 1) {
    return { error: "You don't have permission to do that." };
  }
  redirect("/workspaces");
}
