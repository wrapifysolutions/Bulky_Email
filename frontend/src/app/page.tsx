"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileSpreadsheet,
  Inbox,
  MailCheck,
  Send,
  Users,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { LiveType3D } from "@/components/LiveType3D";
import {
  DistributionBars,
  KpiCard,
  MailboxUsageChart,
  RingGauge,
  SparkBars,
} from "@/components/StatsWidgets";
import { api, DashboardStats } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.dashboard()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="page">
        <div className="alert-error">
          Failed to load dashboard. Is the backend running? ({error})
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page space-y-4">
        <div className="h-28 skeleton" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 skeleton" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="h-56 skeleton lg:col-span-2" />
          <div className="h-56 skeleton" />
        </div>
      </div>
    );
  }

  const capacity = stats.daily_capacity ?? stats.emails_sent_today + stats.emails_remaining;
  const usedPct =
    capacity > 0 ? Math.min(100, Math.round((stats.emails_sent_today / capacity) * 100)) : 0;
  const validPct =
    stats.total_leads > 0 ? Math.round((stats.valid_emails / stats.total_leads) * 100) : 0;
  const spark = (stats.mailbox_usage || []).map((m) => m.sent_today);
  const sparkValues = spark.length ? spark : [0, 0, 0, 0, 0, 0, 0];
  const sparkLabels = (stats.mailbox_usage || []).map((m) => m.email.split("@")[0]);

  return (
    <div className="page">
      <div className="hero-banner">
        <div
          className="live-orbit"
          style={{ right: "8%", top: "12%", animationDelay: "0s" }}
        />
        <div
          className="live-orbit"
          style={{
            right: "18%",
            bottom: "8%",
            width: 70,
            height: 70,
            animationDelay: "1.2s",
            opacity: 0.7,
          }}
        />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              <Zap size={12} /> Live workspace
            </p>
            <LiveType3D />
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-500">
              Capacity, pipeline quality, and campaigns — updated as you work.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/stats" className="btn-secondary">
              Full statistics
            </Link>
            <Link href="/campaigns" className="btn-primary">
              Campaigns <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="relative z-10 mt-6 grid grid-cols-3 gap-3 border-t border-ink-100/80 pt-5 sm:max-w-md">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Sent</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-950">
              {stats.emails_sent_today}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Left</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-950">
              {stats.emails_remaining}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Running</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-ink-950">
              {stats.campaigns_running}
            </p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Dashboard"
        description="Live statistics for capacity, pipeline quality, and campaign performance."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sent today"
          value={stats.emails_sent_today}
          hint={`${stats.emails_remaining} left today`}
          icon={Send}
          tone="brand"
          delay={40}
        />
        <KpiCard
          label="Active mailboxes"
          value={stats.active_mailboxes}
          hint={`${stats.total_mailboxes} total`}
          icon={Inbox}
          tone="success"
          delay={80}
        />
        <KpiCard
          label="Total leads"
          value={stats.total_leads}
          hint={`${stats.valid_emails} valid`}
          icon={Users}
          tone="neutral"
          delay={120}
        />
        <KpiCard
          label="Campaigns running"
          value={stats.campaigns_running}
          hint={`${stats.total_sent_all_time ?? 0} lifetime sends`}
          icon={Activity}
          tone="warn"
          delay={160}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RingGauge
          label="Daily capacity used"
          percent={usedPct}
          value={`${usedPct}%`}
          sub={`${stats.emails_sent_today} / ${capacity}`}
          delay={40}
        />
        <RingGauge
          label="Lead quality"
          percent={validPct}
          value={`${validPct}%`}
          sub="valid emails"
          color="#10b981"
          delay={100}
        />
        <RingGauge
          label="Bounce rate"
          percent={Math.min(100, stats.bounce_rate)}
          value={`${stats.bounce_rate}%`}
          sub="delivery risk"
          color={stats.bounce_rate > 5 ? "#f43f5e" : "#f59e0b"}
          delay={160}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MailboxUsageChart items={stats.mailbox_usage || []} />
        <DistributionBars
          title="Lead status mix"
          items={stats.lead_breakdown || []}
          colors={["#1a837c", "#10b981", "#f59e0b", "#f43f5e"]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SparkBars
          title="Sends by mailbox (today)"
          values={sparkValues}
          labels={sparkLabels.length ? sparkLabels : undefined}
        />
        <DistributionBars
          title="Campaign status"
          items={stats.campaign_breakdown || []}
          colors={["#64748b", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e"]}
        />
        <div className="grid gap-4">
          <KpiCard
            label="Valid emails"
            value={stats.valid_emails}
            icon={MailCheck}
            tone="success"
            delay={40}
          />
          <KpiCard
            label="Failed / invalid"
            value={stats.failed_emails}
            icon={AlertTriangle}
            tone="danger"
            delay={80}
          />
          <KpiCard
            label="CSV uploads"
            value={stats.csv_uploaded}
            icon={FileSpreadsheet}
            tone="neutral"
            delay={120}
          />
        </div>
      </div>
    </div>
  );
}
