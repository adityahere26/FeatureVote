import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/password-form";
import { authOptions, getCurrentUserId } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-path";
import { signInWithGoogle } from "./actions";

export const metadata = { title: "Sign in · FeatureVote" };

export default async function LoginPage({ searchParams }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);

  if (await getCurrentUserId()) {
    redirect(next);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <Link href="/" className="text-sm font-semibold">
          FeatureVote
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Signing in lets you submit requests, vote and comment.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          Sign-in didn&apos;t complete. Please try again.
        </p>
      )}

      {authOptions.google && (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            Continue with Google
          </button>
        </form>
      )}

      {authOptions.password && <PasswordForm next={next} />}
    </main>
  );
}
