import { ActionForm } from "@/components/action-form";
import { SiteHeader } from "@/components/site-header";
import { inputClass, primaryButtonClass } from "@/components/workspace/styles";
import { requireUserId } from "@/lib/auth";
import { createWorkspace } from "../actions";

export const metadata = { title: "New workspace · FeatureVote" };

export default async function NewWorkspacePage() {
  await requireUserId("/workspaces/new");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold">New workspace</h1>
        <ActionForm action={createWorkspace} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name
            <input name="name" required minLength={2} maxLength={80} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            URL
            <input
              name="slug"
              required
              minLength={3}
              maxLength={48}
              pattern="[a-z0-9][a-z0-9\-]+[a-z0-9]"
              placeholder="acme"
              className={inputClass}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input name="isPublic" type="checkbox" className="mt-0.5" />
            <span>Public: anyone can read this board, and anyone signed in can take part.</span>
          </label>
          <button type="submit" className={primaryButtonClass}>
            Create workspace
          </button>
        </ActionForm>
      </main>
    </>
  );
}
