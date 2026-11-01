import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ROADMAP_ITEMS_PER_STATUS, STATUS_LABELS } from "@/lib/request-params";
import { listRoadmap } from "@/lib/requests";
import { getWorkspace } from "@/lib/workspaces";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  return { title: `${workspace?.name ?? "Workspace"} roadmap · FeatureVote` };
}

export default async function RoadmapPage({ params }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) {
    notFound();
  }
  const columns = await listRoadmap(workspace.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link href={`/w/${slug}`} className="text-sm">
          {workspace.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Roadmap</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {columns.map(({ status, requests, total }) => (
            <section key={status} data-testid={`roadmap-${status}`} aria-labelledby={`status-${status}`}>
              <h2 id={`status-${status}`} className="flex justify-between text-sm font-semibold">
                {STATUS_LABELS[status]}
                <span className="font-normal text-neutral-600 dark:text-neutral-400">{total}</span>
              </h2>
              {requests.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Nothing here yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {requests.map((request) => (
                    <li key={request.id}>
                      <Link
                        href={`/w/${slug}/requests/${request.id}`}
                        className="block rounded-md border border-neutral-200 p-2 text-sm break-words dark:border-neutral-800"
                      >
                        {request.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {total > ROADMAP_ITEMS_PER_STATUS && (
                <Link href={`/w/${slug}?status=${status}`} className="mt-2 block text-sm">
                  View all {total}
                </Link>
              )}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
