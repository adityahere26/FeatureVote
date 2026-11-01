"use server";

import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/validation";

export async function signInWithGoogle(formData) {
  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=auth");
  }
  redirect(data.url);
}

export async function submitPassword(_previousState, formData) {
  if (!authOptions.password) {
    return { error: "Password sign-in is not available." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } =
    formData.get("intent") === "sign-up"
      ? await supabase.auth.signUp(parsed.data)
      : await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Those details didn't work. Please try again." };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
