import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestForm } from "@/components/requests/request-form";
import { SiteHeader } from "@/components/site-header";
import { requireUserId } from "@/lib/auth";
import { getRequest } from "@/lib/requests";
import { getWorkspace } from "@/lib/workspaces";
import { updateRequest } from "../../actions";

export const metadata = { title: "Edit request · FeatureVote" };

export default async function EditRequestPage({ params }) {
  const { slug, id } = await params;
  const userId = await requireUserId(`/w/${slug}/requests/${id}/edit`);

  const workspace = await getWorkspace(slug);
  const request = workspace && (await getRequest(workspace.id, id));
  const isAdmin = workspace?.role === "owner" || workspace?.role === "admin";
  if (!request || !(isAdmin || request.author_id === userId)) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link href={`/w/${slug}/requests/${id}`} className="text-sm">
          Back to request
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Edit request</h1>
        <RequestForm
          action={updateRequest}
          slug={slug}
          hiddenFields={{ requestId: id }}
          title={request.title}
          body={request.body}
          submitLabel="Save changes"
        />
      </main>
    </>
  );
}
