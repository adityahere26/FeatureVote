"use client";

import { useActionState } from "react";
import { createInvite } from "@/app/w/[slug]/settings/actions";
import { inputClass, primaryButtonClass } from "./styles";

export function InvitePanel({ workspaceId, slug, canInviteAdmins }) {
  const [state, action, pending] = useActionState(createInvite, {});

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="slug" value={slug} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Role
          <select name="role" className={inputClass} defaultValue="member">
            <option value="member">Member</option>
            {canInviteAdmins && <option value="admin">Admin</option>}
          </select>
        </label>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          Create invite link
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.link && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Copy this link now. It works once, expires in 7 days, and won&apos;t be shown again.
          <input readOnly value={state.link} aria-label="Invite link" className={inputClass} />
        </label>
      )}
    </div>
  );
}
