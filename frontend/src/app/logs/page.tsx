"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { api, ActivityLog } from "@/lib/api";

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    api.logs().then(setLogs);
  }, []);

  const typeClass = (t: string) => {
    if (t.includes("failed") || t.includes("error")) return "badge-danger";
    if (t.includes("sent") || t.includes("finished") || t.includes("connected")) return "badge-success";
    if (t.includes("started") || t.includes("uploaded") || t.includes("generated")) return "badge-info";
    return "badge-neutral";
  };

  return (
    <div className="page">
      <PageHeader
        title="Activity Logs"
        description="Chronological trail of sends, imports, crawls, and system events."
      />

      <div className="panel-flush divide-y divide-ink-100">
        {logs.map((log, i) => (
          <div
            key={log.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          >
            <div className="w-40 shrink-0 pt-0.5 text-xs tabular-nums text-ink-400">
              {new Date(log.created_at).toLocaleString()}
            </div>
            <div className="min-w-0 flex-1">
              <span className={typeClass(log.log_type)}>{log.log_type.replace(/_/g, " ")}</span>
              <p className="mt-1.5 text-sm text-ink-800">{log.message}</p>
              {log.details && <p className="mt-1 text-xs text-ink-400">{log.details}</p>}
            </div>
          </div>
        ))}
        {logs.length === 0 && <div className="empty">No activity yet</div>}
      </div>
    </div>
  );
}
