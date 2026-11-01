import { STATUS_LABELS } from "@/lib/request-params";

export function StatusBadge({ status }) {
  return (
    <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs dark:border-neutral-700">
      {STATUS_LABELS[status]}
    </span>
  );
}
