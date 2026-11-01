"use client";

import Link from "next/link";
import { useActionState } from "react";
import { toggleVote } from "@/app/w/[slug]/requests/actions";

const buttonClass =
  "flex w-14 shrink-0 flex-col items-center rounded-md border px-2 py-1 text-sm font-semibold disabled:opacity-50";

export function VoteButton({ slug, requestId, count, voted, signedIn }) {
  const [state, action, pending] = useActionState(toggleVote, {});
  const noun = count === 1 ? "vote" : "votes";

  if (!signedIn) {
    const next = encodeURIComponent(`/w/${slug}/requests/${requestId}`);
    return (
      <Link
        href={`/login?next=${next}`}
        aria-label={`Sign in to vote, ${count} ${noun}`}
        className={`${buttonClass} border-neutral-300 dark:border-neutral-700`}
      >
        <span aria-hidden="true">▲</span>
        {count}
      </Link>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="intent" value={voted ? "remove" : "add"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={voted}
        aria-label={`${voted ? "Remove your vote" : "Vote"}, ${count} ${noun}`}
        className={`${buttonClass} ${
          voted
            ? "border-foreground bg-foreground text-background"
            : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <span aria-hidden="true">▲</span>
        {count}
      </button>
      {state.error && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
