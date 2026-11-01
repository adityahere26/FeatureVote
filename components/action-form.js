"use client";

import { useActionState } from "react";

export function ActionForm({ action, className, children }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="w-full text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="w-full text-sm text-neutral-600 dark:text-neutral-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
