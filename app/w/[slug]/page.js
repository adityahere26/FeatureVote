import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/requests/status-badge";
import { VoteButton } from "@/components/requests/vote-button";
import { SiteHeader } from "@/components/site-header";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/workspace/styles";
import {
  REQUESTS_PER_PAGE,
  SORT_LABELS,
  STATUS_LABELS,
  boardHref,
  parseBoardParams,
} from "@/lib/request-params";
import { authorName, formatDate, getVotedRequestIds, listRequests } from "@/lib/requests";
import { getWorkspace } from "@/lib/workspaces";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  return { title: `${workspace?.name ?? "Workspace"} · FeatureVote` };
}

export default async function WorkspacePage({ params, searchParams }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) {
    notFound();
  }

  const filters = parseBoardParams(await searchParams);
  const { requests, total } = await listRequests(workspace.id, filters);
  const voted = await getVotedRequestIds(
    workspace.userId,
    requests.map((request) => request.id),
  );

  const isFiltered = Boolean(filters.q || filters.status);
  const hasNext = filters.page * REQUESTS_PER_PAGE < total;
  const newRequestHref = workspace.userId
    ? `/w/${slug}/requests/new`
    : `/login?next=${encodeURIComponent(`/w/${slug}/requests/new`)}`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{workspace.name}</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {workspace.is_public ? "Public board" : "Private board"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/w/${slug}/roadmap`} className="text-sm">
              Roadmap
            </Link>
            {workspace.role && (
              <Link href={`/w/${slug}/settings`} className="text-sm">
                Settings
              </Link>
            )}
            <Link href={newRequestHref} className={primaryButtonClass}>
              New request
            </Link>
          </div>
        </div>

        <Form action={`/w/${slug}`} className="mt-6 flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
            Search
            <input
              name="q"
              type="search"
              maxLength={200}
              defaultValue={filters.q}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Status
            <select name="status" defaultValue={filters.status} className={inputClass}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Sort
            <select name="sort" defaultValue={filters.sort} className={inputClass}>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={secondaryButtonClass}>
            Apply
          </button>
        </Form>

        {requests.length === 0 ? (
          <p className="mt-8 text-sm text-neutral-600 dark:text-neutral-400">
            {isFiltered ? "No requests match these filters." : "No requests yet."}
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {requests.map((request) => (
              <li
                key={request.id}
                data-testid="request"
                className="flex items-start gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <VoteButton
                  slug={slug}
                  requestId={request.id}
                  count={request.vote_count}
                  voted={voted.has(request.id)}
                  signedIn={Boolean(workspace.userId)}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/w/${slug}/requests/${request.id}`}
                    className="font-medium break-words"
                  >
                    {request.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <StatusBadge status={request.status} />
                    <span>
                      {authorName(request)}, {formatDate(request.created_at)}
                    </span>
                    <span>
                      {request.comment_count}{" "}
                      {request.comment_count === 1 ? "comment" : "comments"}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(filters.page > 1 || hasNext) && (
          <nav aria-label="Pages" className="mt-6 flex justify-between text-sm">
            {filters.page > 1 ? (
              <Link href={boardHref(slug, filters, { page: filters.page - 1 })}>Previous</Link>
            ) : (
              <span />
            )}
            {hasNext && (
              <Link href={boardHref(slug, filters, { page: filters.page + 1 })}>Next</Link>
            )}
          </nav>
        )}
      </main>
    </>
  );
}
