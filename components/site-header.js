import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getCurrentUserId } from "@/lib/auth";

export async function SiteHeader() {
  const userId = await getCurrentUserId();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">
          FeatureVote
        </Link>
        {userId ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/workspaces">Workspaces</Link>
            <Link href="/account">Account</Link>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </nav>
        ) : (
          <Link href="/login" className="text-sm">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
