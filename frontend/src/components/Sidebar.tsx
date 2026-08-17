"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Mail,
  Users,
  Send,
  FileText,
  ScrollText,
  Globe,
  Menu,
  X,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/mailboxes", label: "Mailboxes", icon: Mail },
  { href: "/leads", label: "Leads", icon: Users, exact: true },
  { href: "/leads/generate", label: "Lead Generator", icon: Globe },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/logs", label: "Activity", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string, exact?: boolean) => {
    if (href === "/" || exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const Nav = (
    <>
      <div
        className="relative overflow-hidden px-5 py-6 animate-slide-in"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-3xl"
          style={{ background: "rgba(63, 191, 179, 0.28)" }}
        />
        <Link href="/" className="group relative block">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold text-white transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
              style={{
                background: "linear-gradient(135deg, #3fbfb3 0%, #186963 100%)",
                boxShadow: "0 8px 22px rgba(26,131,124,0.4)",
              }}
            >
              B
            </span>
            <div>
              <p className="font-display text-[1.3rem] font-semibold tracking-[-0.03em] text-white">
                Bulkyy
              </p>
              <p className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>
                Email outreach
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="px-4 pt-4">
        <p
          className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "#64748b" }}
        >
          Workspace
        </p>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {nav.map(({ href, label, icon: Icon, exact }, i) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 animate-fade-up"
              style={{
                animationDelay: `${50 + i * 35}ms`,
                ...(active
                  ? {
                      color: "#ffffff",
                      background: "linear-gradient(135deg, #22a399 0%, #186963 100%)",
                      boxShadow: "0 8px 20px rgba(26,131,124,0.35)",
                    }
                  : {
                      color: "#e2e8f0",
                      background: "transparent",
                    }),
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#e2e8f0";
                }
              }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
                style={{
                  background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                  color: active ? "#ffffff" : "#5eead4",
                }}
              >
                <Icon size={15} strokeWidth={1.85} />
              </span>
              <span className="truncate">{label}</span>
              {active && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "#ccfbf1",
                    boxShadow: "0 0 10px rgba(204,251,241,0.9)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          className="relative overflow-hidden rounded-xl px-3.5 py-3"
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl"
            style={{ background: "rgba(34,163,153,0.25)" }}
          />
          <div className="relative flex items-start gap-2.5">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(34,163,153,0.22)", color: "#5eead4" }}
            >
              <ShieldCheck size={14} />
            </span>
            <p className="text-[11px] font-medium leading-relaxed" style={{ color: "#cbd5e1" }}>
              Daily limits protect deliverability for every client inbox.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-800 shadow-panel lg:hidden"
      >
        <Menu size={16} />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 animate-fade-in lg:hidden"
          style={{ background: "rgba(10,15,22,0.55)", backdropFilter: "blur(2px)" }}
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col transition-transform duration-300 ease-out lg:static lg:translate-x-0 lg:shrink-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background:
            "radial-gradient(ellipse 90% 45% at 0% 0%, rgba(34,163,153,0.22), transparent 55%), radial-gradient(ellipse 70% 40% at 100% 100%, rgba(234,88,12,0.1), transparent 50%), linear-gradient(180deg, #101820 0%, #0b1219 50%, #080e14 100%)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "4px 0 28px rgba(8,14,20,0.25)",
          color: "#e2e8f0",
        }}
      >
        <div className="absolute right-2 top-3 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: "#94a3b8" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            <X size={16} />
          </button>
        </div>
        {Nav}
      </aside>
    </>
  );
}
