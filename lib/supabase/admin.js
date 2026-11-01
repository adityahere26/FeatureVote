import "server-only";
import { createClient } from "@supabase/supabase-js";

// Bypasses RLS. Use only for work a user's own session can't do, such as
// deleting their auth account, and only after checking who is asking.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
