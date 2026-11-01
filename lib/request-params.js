import { REQUEST_STATUSES } from "@/lib/validation";

export const REQUESTS_PER_PAGE = 25;

export const STATUS_LABELS = {
  under_review: "Under Review",
  planned: "Planned",
  in_progress: "In Progress",
  released: "Released",
  declined: "Declined",
};

// Votes show demand from people who chose to vote, not business value, so
// this label stays literal rather than "Top" or "Priority".
export const SORT_LABELS = {
  votes: "Most voted",
  newest: "Newest",
};

// Query strings are user input: anything unexpected falls back to the default.
export function parseBoardParams({ q, status, sort, page } = {}) {
  const pageNumber = Number.parseInt(page, 10);
  return {
    q: typeof q === "string" ? q.trim().slice(0, 200) : "",
    status: REQUEST_STATUSES.includes(status) ? status : "",
    sort: Object.hasOwn(SORT_LABELS, sort ?? "") ? sort : "votes",
    page: pageNumber > 0 ? pageNumber : 1,
  };
}

export function boardHref(slug, params, overrides = {}) {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();
  if (merged.q) query.set("q", merged.q);
  if (merged.status) query.set("status", merged.status);
  if (merged.sort && merged.sort !== "votes") query.set("sort", merged.sort);
  if (merged.page > 1) query.set("page", merged.page);
  const suffix = query.toString();
  return suffix ? `/w/${slug}?${suffix}` : `/w/${slug}`;
}
