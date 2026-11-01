import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getWorkspace } from "@/lib/workspaces";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  return { title: `${workspace?.name ?? "Workspace"} · FeatureVote` };
}

export default async function WorkspacePage({ params }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{workspace.name}</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {workspace.is_public ? "Public board" : "Private board"}
            </p>
          </div>
          {workspace.role && (
            <Link href={`/w/${workspace.slug}/settings`} className="text-sm">
              Settings
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
