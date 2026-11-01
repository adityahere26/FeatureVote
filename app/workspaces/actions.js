"use server";

import { redirect } from "next/navigation";
import { describeDatabaseError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { workspaceSchema } from "@/lib/validation";

export async function createWorkspace(_previousState, formData) {
  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return { error: "Use a name of 2-80 characters and a URL of 3-48 letters, numbers or hyphens." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_is_public: parsed.data.isPublic,
  });
  if (error) {
    return { error: describeDatabaseError(error) };
  }
  redirect(`/w/${parsed.data.slug}`);
}
