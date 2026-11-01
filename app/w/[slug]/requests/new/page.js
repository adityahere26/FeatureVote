import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestForm } from "@/components/requests/request-form";
import { SiteHeader } from "@/components/site-header";
import { requireUserId } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspaces";
import { submitRequest } from "../actions";

export const metadata = { title: "New request · FeatureVote" };

export default async function NewRequestPage({ params }) {
  const { slug } = await params;
  await requireUserId(`/w/${slug}/requests/new`);

  const workspace = await getWorkspace(slug);
  if (!workspace) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link href={`/w/${slug}`} className="text-sm">
          {workspace.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New request</h1>
        <RequestForm
          action={submitRequest}
          slug={slug}
          hiddenFields={{ workspaceId: workspace.id }}
          submitLabel="Submit request"
        />
      </main>
    </>
  );
}
