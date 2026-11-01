"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { describeDatabaseError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { displayNameSchema } from "@/lib/validation";

const DELETE_CONFIRMATION = "delete my account";

export async function updateDisplayName(_previousState, formData) {
  const userId = await requireUserId("/account");
  const name = displayNameSchema.safeParse(formData.get("displayName"));
  if (!name.success) {
    return { error: "Use a name of 1-80 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.data })
    .eq("id", userId);
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function deleteAccount(_previousState, formData) {
  const userId = await requireUserId("/account");
  if (formData.get("confirmation") !== DELETE_CONFIRMATION) {
    return { error: `Type "${DELETE_CONFIRMATION}" to confirm.` };
  }

  const supabase = await createClient();
  const { data: blockers, error: blockersError } = await supabase.rpc("account_deletion_blockers");
  if (blockersError) {
    return { error: describeDatabaseError(blockersError) };
  }
  if (blockers.length > 0) {
    const names = blockers.map((blocker) => blocker.workspace_name).join(", ");
    return { error: `Transfer or delete these workspaces first: ${names}.` };
  }

  // userId comes from the verified session, never from the form.
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) {
    return { error: "We couldn't delete your account. Please try again." };
  }

  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
