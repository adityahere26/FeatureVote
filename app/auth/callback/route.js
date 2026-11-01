import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${safeNextPath(searchParams.get("next"))}`);
    }
  }
  return NextResponse.redirect(`${siteUrl}/login?error=auth`);
}
