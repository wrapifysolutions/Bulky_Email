import clsx from "clsx";

const statusMap: Record<string, { badge: string; dot: string }> = {
  active: { badge: "badge-success", dot: "bg-emerald-500" },
  inactive: { badge: "badge-neutral", dot: "bg-ink-400" },
  failed: { badge: "badge-danger", dot: "bg-red-500" },
  warming: { badge: "badge-warn", dot: "bg-amber-500" },
  draft: { badge: "badge-neutral", dot: "bg-ink-400" },
  running: { badge: "badge-info", dot: "bg-sky-500" },
  paused: { badge: "badge-warn", dot: "bg-amber-500" },
  completed: { badge: "badge-success", dot: "bg-emerald-500" },
  aborted: { badge: "badge-danger", dot: "bg-red-500" },
  valid: { badge: "badge-success", dot: "bg-emerald-500" },
  new: { badge: "badge-brand", dot: "bg-brand-600" },
  invalid: { badge: "badge-danger", dot: "bg-red-500" },
  no_email: { badge: "badge-warn", dot: "bg-amber-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const mapped = statusMap[status] || { badge: "badge-neutral", dot: "bg-ink-400" };
  return (
    <span className={clsx(mapped.badge)}>
      <span className={clsx("badge-dot", mapped.dot)} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
