import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/requests/status-badge";
import { VoteButton } from "@/components/requests/vote-button";
import { SiteHeader } from "@/components/site-header";
import {
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/workspace/styles";
import { STATUS_LABELS } from "@/lib/request-params";
import {
  authorName,
  formatDate,
  getRequest,
  getVotedRequestIds,
  listComments,
} from "@/lib/requests";
import { getWorkspace } from "@/lib/workspaces";
import { addComment, deleteComment, deleteRequest, updateStatus } from "../actions";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  const workspace = await getWorkspace(slug);
  const request = workspace && (await getRequest(workspace.id, id));
  return { title: `${request?.title ?? "Request"} · FeatureVote` };
}

export default async function RequestPage({ params }) {
  const { slug, id } = await params;
  const workspace = await getWorkspace(slug);
  const request = workspace && (await getRequest(workspace.id, id));
  if (!request) {
    notFound();
  }

  const { userId } = workspace;
  const isAdmin = workspace.role === "owner" || workspace.role === "admin";
  const isAuthor = Boolean(userId) && request.author_id === userId;
  const [comments, voted] = await Promise.all([
    listComments(request.id),
    getVotedRequestIds(userId, [request.id]),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <Link href={`/w/${slug}`} className="text-sm">
          {workspace.name}
        </Link>

        <article className="flex items-start gap-3">
          <VoteButton
            slug={slug}
            requestId={request.id}
            count={request.vote_count}
            voted={voted.has(request.id)}
            signedIn={Boolean(userId)}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold break-words">{request.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <StatusBadge status={request.status} />
              <span>
                {authorName(request)}, {formatDate(request.created_at)}
              </span>
            </p>
            {request.body && (
              <p className="mt-4 text-sm break-words whitespace-pre-wrap">{request.body}</p>
            )}
          </div>
        </article>

        {isAdmin && (
          <ActionForm action={updateStatus} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="requestId" value={request.id} />
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <select name="status" defaultValue={request.status} className={inputClass}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={secondaryButtonClass}>
              Update status
            </button>
          </ActionForm>
        )}

        {(isAdmin || isAuthor) && (
          <div className="flex flex-wrap items-start gap-4 text-sm">
            <Link href={`/w/${slug}/requests/${request.id}/edit`}>Edit request</Link>
            <details>
              <summary className="cursor-pointer">Delete request</summary>
              <ActionForm action={deleteRequest} className="mt-2 flex flex-col items-start gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="requestId" value={request.id} />
                <p>This also deletes its votes and comments.</p>
                <button type="submit" className={dangerButtonClass}>
                  Confirm delete
                </button>
              </ActionForm>
            </details>
          </div>
        )}

        <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Comments</h2>
          {comments.length === 0 && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">No comments yet.</p>
          )}
          <ul className="flex flex-col gap-2">
            {comments.map((comment) => (
              <li
                key={comment.id}
                data-testid="comment"
                className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <p className="break-words whitespace-pre-wrap">{comment.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <span>
                    {authorName(comment)}, {formatDate(comment.created_at)}
                  </span>
                  {(isAdmin || (userId && comment.author_id === userId)) && (
                    <ActionForm action={deleteComment}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="commentId" value={comment.id} />
                      <button type="submit">Delete comment</button>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {userId ? (
            <ActionForm action={addComment} className="flex flex-col items-start gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="requestId" value={request.id} />
              <label className="flex w-full flex-col gap-1 text-sm font-medium">
                Add a comment
                <textarea
                  name="body"
                  required
                  rows={3}
                  maxLength={2000}
                  className={inputClass}
                />
              </label>
              <button type="submit" className={primaryButtonClass}>
                Post comment
              </button>
            </ActionForm>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/w/${slug}/requests/${request.id}`)}`}
              className="text-sm"
            >
              Sign in to comment
            </Link>
          )}
        </section>
      </main>
    </>
  );
}
