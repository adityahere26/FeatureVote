"use client";

import { useActionState } from "react";
import { submitPassword } from "@/app/login/actions";

export function PasswordForm({ next }) {
  const [state, action, pending] = useActionState(submitPassword, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 font-normal dark:border-neutral-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 font-normal dark:border-neutral-700"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          name="intent"
          value="sign-in"
          disabled={pending}
          className="flex-1 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Sign in
        </button>
        <button
          type="submit"
          name="intent"
          value="sign-up"
          disabled={pending}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          Create account
        </button>
      </div>
    </form>
  );
}
