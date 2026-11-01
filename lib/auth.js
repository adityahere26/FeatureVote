import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const authOptions = {
  google: process.env.NEXT_PUBLIC_GOOGLE_AUTH !== "false",
  // Local development and tests only. Production signs in with Google.
  password: process.env.NEXT_PUBLIC_PASSWORD_AUTH === "true",
};

export async function getCurrentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

export async function requireUserId(returnTo) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return userId;
}
