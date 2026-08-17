"use client";

import { useEffect, useId, useMemo, useState } from "react";
import clsx from "clsx";
import { LucideIcon } from "lucide-react";
import { TiltCard } from "@/components/TiltCard";

type Tone = "brand" | "success" | "warn" | "danger" | "neutral";

const toneMap: Record<Tone, { icon: string; wash: string; bar: string }> = {
  brand: {
    icon: "bg-brand-50 text-brand-700",
    wash: "from-brand-500/10 to-transparent",
    bar: "bg-brand-500",
  },
  success: {
    icon: "bg-emerald-50 text-emerald-700",
    wash: "from-emerald-500/10 to-transparent",
    bar: "bg-emerald-500",
  },
  warn: {
    icon: "bg-amber-50 text-amber-700",
    wash: "from-amber-500/10 to-transparent",
    bar: "bg-amber-500",
  },
  danger: {
    icon: "bg-rose-50 text-rose-600",
    wash: "from-rose-500/10 to-transparent",
    bar: "bg-rose-500",
  },
  neutral: {
    icon: "bg-sky-50 text-sky-700",
    wash: "from-sky-500/10 to-transparent",
    bar: "bg-sky-500",
  },
};

/** Modern chart palette — distinct hues, soft enough to feel on-brand */
export const BRAND_CHART = {
  primary: "#1a837c",
  light: "#2dd4bf",
  soft: "#99f6e4",
  deep: "#0f766e",
  deeper: "#115e59",
  mist: "#ccfbf1",
  ink: "#64748b",
  track: "#e8eef5",
} as const;

const DEFAULT_PALETTE = [
  "#1a837c", // teal
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#64748b", // slate
];

const RING_GRADIENTS: Record<string, [string, string, string]> = {
  "#1a837c": ["#99f6e4", "#1a837c", "#0f766e"],
  "#0ea5e9": ["#bae6fd", "#0ea5e9", "#0369a1"],
  "#10b981": ["#a7f3d0", "#10b981", "#047857"],
  "#f59e0b": ["#fde68a", "#f59e0b", "#b45309"],
  "#6366f1": ["#c7d2fe", "#6366f1", "#4338ca"],
  "#f43f5e": ["#fecdd3", "#f43f5e", "#be123c"],
};

function useCountUp(target: number, duration = 900, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setValue(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setValue(target);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, enabled]);
  return value;
}

function useMounted(delay = 40) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ready;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  delay = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  delay?: number;
}) {
  const numeric = typeof value === "number";
  const counted = useCountUp(numeric ? value : 0, 800);
  const display = numeric ? Math.round(counted) : value;
  const t = toneMap[tone];

  return (
    <TiltCard
      className="group overflow-hidden p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
      intensity={7}
    >
      <div
        className={clsx(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-80",
          t.wash
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            {label}
          </p>
          <p className="mt-2 font-display text-[1.95rem] font-semibold tracking-tight text-ink-950 tabular-nums">
            {display}
          </p>
          {hint && <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>}
        </div>
        <div
          className={clsx(
            "rounded-xl p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
            t.icon
          )}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
      </div>
      <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className={clsx("h-full w-2/3 rounded-full animate-bar-grow", t.bar)}
          style={{ animationDelay: `${delay + 120}ms` }}
        />
      </div>
    </TiltCard>
  );
}

export function RingGauge({
  percent,
  label,
  value,
  sub,
  color = "#1a837c",
  delay = 0,
}: {
  percent: number;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  delay?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const ready = useMounted(delay);
  const p = Math.max(0, Math.min(100, percent));
  const animated = useCountUp(p, 1100, ready);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (animated / 100) * c;
  const displayNum = Math.round(animated);
  const gradient = RING_GRADIENTS[color] || [BRAND_CHART.mist, color, BRAND_CHART.deep];

  return (
    <TiltCard
      className="flex flex-col items-center justify-center p-6 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
      intensity={6}
    >
      <p className="mb-4 self-start text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </p>
      <div className="relative h-44 w-44">
        <div
          className="absolute inset-5 rounded-full blur-2xl chart-ring-glow"
          style={{ background: color, opacity: 0.22 }}
        />
        <svg className="-rotate-90" viewBox="0 0 140 140" width="176" height="176">
          <defs>
            <linearGradient id={`ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradient[0]} stopOpacity="0.95" />
              <stop offset="50%" stopColor={gradient[1]} stopOpacity="1" />
              <stop offset="100%" stopColor={gradient[2]} stopOpacity="1" />
            </linearGradient>
            <filter id={`glow-${uid}`}>
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#e8eef5" strokeWidth="12" />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={`url(#ring-${uid})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            filter={`url(#glow-${uid})`}
            style={{ transition: "stroke-dashoffset 40ms linear" }}
          />
          {/* moving tip highlight */}
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`8 ${c}`}
            strokeDashoffset={offset}
            className="chart-ring-spark"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-[1.85rem] font-semibold tabular-nums text-ink-950">
            {value.includes("%") ? `${displayNum}%` : value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>}
        </div>
      </div>
    </TiltCard>
  );
}

export function DistributionBars({
  title,
  items,
  colors,
}: {
  title: string;
  items: { name: string; count: number }[];
  colors?: string[];
}) {
  const ready = useMounted(80);
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  const palette = colors || DEFAULT_PALETTE;
  const uid = useId().replace(/:/g, "");
  const animatedTotal = Math.round(useCountUp(total, 900, ready));

  const size = 148;
  const thickness = 20;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    let cursor = 0;
    return items.map((item, i) => {
      const pct = item.count / total;
      const dash = pct * circ;
      const gap = circ - dash;
      const offset = -cursor * circ;
      cursor += pct;
      return { ...item, pct, dash, gap, offset, color: palette[i % palette.length], i };
    });
  }, [items, total, circ, palette]);

  const progress = useCountUp(1, 1000, ready);

  return (
    <TiltCard className="p-5 sm:p-6 animate-fade-up" intensity={5}>
      <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-400">No data yet</p>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto shrink-0">
            <div className="absolute inset-3 rounded-full bg-brand-100/40 blur-md chart-ring-glow" />
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#eef2f7"
                strokeWidth={thickness}
              />
              {segments.map((seg) => {
                const visibleDash = seg.dash * progress;
                return (
                  <circle
                    key={seg.name}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${visibleDash} ${circ}`}
                    strokeDashoffset={seg.offset}
                    strokeLinecap="butt"
                    style={{
                      filter: `drop-shadow(0 2px 6px ${seg.color}44)`,
                      transition: "stroke-dasharray 40ms linear",
                    }}
                  />
                );
              })}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius - thickness / 2 - 3}
                fill="white"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display text-2xl font-semibold tabular-nums text-ink-950">
                {animatedTotal}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-ink-400">total</p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3.5">
            {segments.map((seg) => {
              const pct = Math.round(seg.pct * 100);
              const width = ready ? pct * progress : 0;
              return (
                <div key={seg.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2 capitalize text-ink-700">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm"
                        style={{ background: seg.color }}
                      />
                      <span className="truncate">{seg.name.replace(/_/g, " ")}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-500">
                      {seg.count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="chart-bar-fill relative h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        background: `linear-gradient(90deg, ${seg.color}, ${seg.color}bb)`,
                        boxShadow: `0 0 12px ${seg.color}33`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <span className="sr-only">{uid}</span>
        </div>
      )}
    </TiltCard>
  );
}

export function MailboxUsageChart({
  items,
}: {
  items: {
    email: string;
    sent_today: number;
    daily_limit: number;
    remaining_today: number;
  }[];
}) {
  const ready = useMounted(100);
  const progress = useCountUp(1, 1100, ready);

  return (
    <TiltCard className="p-5 sm:p-6 animate-fade-up" intensity={5}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          Mailbox utilization today
        </p>
        <span className="badge-brand animate-pulse-soft">Live</span>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-400">No mailboxes configured</p>
      ) : (
        <div className="space-y-5">
          {items.map((mb, i) => {
            const pct = mb.daily_limit
              ? Math.min(100, Math.round((mb.sent_today / mb.daily_limit) * 100))
              : 0;
            const full = mb.remaining_today <= 0;
            const width = pct * progress;
            return (
              <div
                key={mb.email}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[13px] font-medium text-ink-800">{mb.email}</p>
                  <p
                    className={clsx(
                      "shrink-0 rounded-lg px-2 py-0.5 text-[12px] tabular-nums",
                      full
                        ? "bg-amber-50 font-semibold text-amber-700"
                        : "bg-ink-50 text-ink-500"
                    )}
                  >
                    {mb.sent_today}/{mb.daily_limit}
                  </p>
                </div>
                <div className="relative h-3.5 overflow-hidden rounded-full bg-ink-100 shadow-inner">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full chart-bar-fill"
                    style={{
                      width: `${width}%`,
                      background: full
                        ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                        : "linear-gradient(90deg, #2dd4bf, #1a837c)",
                      boxShadow: full
                        ? "0 0 14px rgba(245,158,11,0.28)"
                        : "0 0 14px rgba(26,131,124,0.28)",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 chart-shimmer" />
                </div>
                <p className="mt-1.5 text-[11px] text-ink-400">
                  {full ? "Daily limit reached" : `${mb.remaining_today} remaining`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </TiltCard>
  );
}

export function SparkBars({
  title,
  values,
  labels,
}: {
  title: string;
  values: number[];
  labels?: string[];
}) {
  const ready = useMounted(60);
  const progress = useCountUp(1, 900, ready);
  const max = Math.max(...values, 1);
  const uid = useId().replace(/:/g, "");

  // SVG line across bar tops
  const w = 280;
  const h = 112;
  const pad = 8;
  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2) * progress;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <TiltCard className="p-5 animate-fade-up" intensity={5}>
      <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {title}
      </p>
      <div className="relative">
        <svg
          className="pointer-events-none absolute inset-x-0 top-0 h-28 w-full opacity-70"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a837c" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#1a837c" stopOpacity="0" />
            </linearGradient>
          </defs>
          {values.length > 1 && (
            <>
              <polyline
                fill="none"
                stroke="#1a837c"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className="chart-line-draw"
              />
              <polygon
                fill={`url(#area-${uid})`}
                points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`}
              />
            </>
          )}
        </svg>

        <div className="relative z-10 flex h-28 items-end gap-2">
          {values.map((v, i) => {
            const hPct = Math.max(8, (v / max) * 100 * progress);
            const barColor = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
            return (
              <div key={i} className="group relative flex flex-1 flex-col items-center gap-2">
                <div className="pointer-events-none absolute -top-8 rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-hover:-translate-y-1">
                  {v}
                </div>
                <div className="flex h-28 w-full items-end justify-center">
                  <div
                    className="chart-bar w-[70%] max-w-[36px] rounded-t-lg transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-x-105"
                    style={{
                      height: `${hPct}%`,
                      animationDelay: `${i * 70}ms`,
                      background: `linear-gradient(180deg, ${barColor}cc 0%, ${barColor} 100%)`,
                      boxShadow: `0 10px 20px -8px ${barColor}88`,
                    }}
                    title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {labels && labels.length > 0 && (
        <div className="mt-2 flex gap-2">
          {labels.map((label, i) => (
            <span key={i} className="flex-1 truncate text-center text-[9px] text-ink-400">
              {label}
            </span>
          ))}
        </div>
      )}
    </TiltCard>
  );
}
