"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  MailCheck,
  Send,
  Users,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  DistributionBars,
  KpiCard,
  MailboxUsageChart,
  RingGauge,
  SparkBars,
} from "@/components/StatsWidgets";
import { api, DashboardStats } from "@/lib/api";

export default function StatsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.dashboard()
      .then(setStats)
      .catch((e) => setError(e.message));

    const id = setInterval(() => {
      api.dashboard().then(setStats).catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="page">
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page space-y-4">
        <div className="h-8 w-56 skeleton" />
        <div className="h-64 skeleton" />
      </div>
    );
  }

  const capacity = stats.daily_capacity ?? stats.emails_sent_today + stats.emails_remaining;
  const usedPct =
    capacity > 0 ? Math.min(100, Math.round((stats.emails_sent_today / capacity) * 100)) : 0;
  const healthAvg =
    stats.mailbox_usage && stats.mailbox_usage.length
      ? Math.round(
          stats.mailbox_usage.reduce((s, m) => s + m.health_score, 0) /
            stats.mailbox_usage.length
        )
      : 100;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Analytics"
        title="Statistics"
        description="Advanced analytics for sending volume, inbox health, and lead quality — auto-refreshes every 8s."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Lifetime sends"
          value={stats.total_sent_all_time ?? 0}
          icon={Send}
          tone="brand"
          delay={40}
        />
        <KpiCard
          label="Daily capacity"
          value={capacity}
          hint={`${usedPct}% used today`}
          icon={Activity}
          tone="neutral"
          delay={80}
        />
        <KpiCard
          label="Avg mailbox health"
          value={`${healthAvg}%`}
          icon={MailCheck}
          tone={healthAvg >= 80 ? "success" : "warn"}
          delay={120}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RingGauge
          label="Capacity used"
          percent={usedPct}
          value={`${usedPct}%`}
          sub="today"
          delay={40}
        />
        <RingGauge
          label="Remaining window"
          percent={capacity ? Math.round((stats.emails_remaining / capacity) * 100) : 0}
          value={String(stats.emails_remaining)}
          sub="emails left"
          color="#0ea5e9"
          delay={80}
        />
        <RingGauge
          label="Valid lead ratio"
          percent={
            stats.total_leads
              ? Math.round((stats.valid_emails / stats.total_leads) * 100)
              : 0
          }
          value={`${
            stats.total_leads
              ? Math.round((stats.valid_emails / stats.total_leads) * 100)
              : 0
          }%`}
          sub="of database"
          color="#10b981"
          delay={120}
        />
        <RingGauge
          label="Bounce rate"
          percent={Math.min(100, stats.bounce_rate)}
          value={`${stats.bounce_rate}%`}
          sub="risk score"
          color={stats.bounce_rate > 5 ? "#f43f5e" : "#f59e0b"}
          delay={160}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MailboxUsageChart items={stats.mailbox_usage || []} />
        <div className="space-y-4">
          <DistributionBars
            title="Leads by status"
            items={stats.lead_breakdown || []}
            colors={["#1a837c", "#10b981", "#f59e0b", "#f43f5e"]}
          />
          <DistributionBars
            title="Campaigns by status"
            items={stats.campaign_breakdown || []}
            colors={["#64748b", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e", "#6366f1"]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total leads" value={stats.total_leads} icon={Users} tone="neutral" delay={40} />
        <KpiCard label="Valid emails" value={stats.valid_emails} icon={MailCheck} tone="success" delay={80} />
        <KpiCard label="Invalid / failed" value={stats.failed_emails} icon={AlertTriangle} tone="danger" delay={120} />
        <KpiCard label="Active inboxes" value={stats.active_mailboxes} icon={Inbox} tone="brand" delay={160} />
      </div>

      <div className="mt-6">
        <SparkBars
          title="Per-mailbox volume today"
          values={
            stats.mailbox_usage?.length
              ? stats.mailbox_usage.map((m) => m.sent_today)
              : [0, 0, 0, 0, 0, 0]
          }
          labels={stats.mailbox_usage?.map((m) => m.email.split("@")[0])}
        />
      </div>
    </div>
  );
}
