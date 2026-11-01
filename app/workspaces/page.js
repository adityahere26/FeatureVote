import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { primaryButtonClass } from "@/components/workspace/styles";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Workspaces · FeatureVote" };

export default async function WorkspacesPage() {
  const userId = await requireUserId("/workspaces");
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("workspace_memberships")
    .select("role, workspaces (id, name, slug)")
    .eq("user_id", userId)
    .order("created_at");

  if (error) {
    throw new Error("Could not load workspaces");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Your workspaces</h1>
          <Link href="/workspaces/new" className={primaryButtonClass}>
            New workspace
          </Link>
        </div>
        {memberships.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            You aren&apos;t in any workspaces yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {memberships.map(({ role, workspaces: workspace }) => (
              <li key={workspace.id}>
                <Link
                  href={`/w/${workspace.slug}`}
                  className="flex justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                >
                  <span>{workspace.name}</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{role}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
