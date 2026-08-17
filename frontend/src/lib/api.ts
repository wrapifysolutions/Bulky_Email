/** Resolve API base URL at request time (fixes Vercel prod calling localhost). */
function getApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const isLocalhostUrl =
    !!configured &&
    (configured.includes("127.0.0.1") || configured.includes("localhost"));

  // In the browser on a deployed site, always use same-origin unless a real remote API is set.
  if (typeof window !== "undefined") {
    const onLocalDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (onLocalDev) {
      return configured && !isLocalhostUrl
        ? configured.replace(/\/$/, "")
        : "http://127.0.0.1:8000";
    }
    if (configured && !isLocalhostUrl) {
      return configured.replace(/\/$/, "");
    }
    return "";
  }

  // Server-side (SSR/build)
  if (configured && !isLocalhostUrl) {
    return configured.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://127.0.0.1:8000";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ")
          : res.status === 500
            ? "Server error — try again in a moment"
            : "Request failed";
    throw new Error(message || "Request failed");
  }
  return res.json();
}

export interface DashboardStats {
  total_mailboxes: number;
  active_mailboxes: number;
  emails_sent_today: number;
  emails_remaining: number;
  campaigns_running: number;
  csv_uploaded: number;
  total_leads: number;
  valid_emails: number;
  failed_emails: number;
  bounce_rate: number;
  total_sent_all_time?: number;
  daily_capacity?: number;
  mailbox_usage?: {
    id: number;
    email: string;
    sent_today: number;
    daily_limit: number;
    remaining_today: number;
    status: string;
    health_score: number;
  }[];
  lead_breakdown?: { name: string; count: number }[];
  campaign_breakdown?: { name: string; count: number }[];
}

export interface Mailbox {
  id: number;
  email: string;
  smtp_host: string;
  smtp_port: number;
  daily_limit: number;
  sent_today: number;
  status: string;
  health_score: number;
  warmup_status: string;
}

export interface Lead {
  id: number;
  company: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  website: string | null;
  phone: string | null;
  country: string | null;
  status: string;
  created_at: string;
}

export interface CampaignMailboxInfo {
  id: number;
  email: string;
  daily_limit: number;
  sent_today: number;
  remaining_today: number;
  status: string;
}

export interface Campaign {
  id: number;
  name: string;
  template_id: number;
  status: string;
  total_leads: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  duplicate_count: number;
  bounce_count: number;
  created_at: string;
  mailboxes?: CampaignMailboxInfo[];
  remaining_leads?: number;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  category: string | null;
}

export interface ActivityLog {
  id: number;
  log_type: string;
  message: string;
  details: string | null;
  created_at: string;
}

export const api = {
  dashboard: () => request<DashboardStats>("/api/dashboard"),
  mailboxes: {
    list: () => request<Mailbox[]>("/api/mailboxes"),
    create: (data: Record<string, unknown>) =>
      request<Mailbox>("/api/mailboxes", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request(`/api/mailboxes/${id}`, { method: "DELETE" }),
  },
  leads: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return request<Lead[]>(`/api/leads${qs}`);
    },
    create: (data: Record<string, unknown>) =>
      request<Lead>("/api/leads", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request(`/api/leads/${id}`, { method: "DELETE" }),
    generate: (urls: string[]) =>
      request<Lead[]>("/api/leads/generate", {
        method: "POST",
        body: JSON.stringify({ urls }),
      }),
    upload: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${getApiUrl()}/api/leads/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const detail = err.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ")
              : "Upload failed";
        throw new Error(message || "Upload failed");
      }
      return res.json();
    },
  },
  campaigns: {
    list: () => request<Campaign[]>("/api/campaigns"),
    create: (data: Record<string, unknown>) =>
      request<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify(data) }),
    start: (id: number) =>
      request<Campaign>(`/api/campaigns/${id}/start`, { method: "POST" }),
    stop: (id: number) =>
      request<Campaign>(`/api/campaigns/${id}/stop`, { method: "POST" }),
    abort: (id: number) =>
      request<Campaign>(`/api/campaigns/${id}/abort`, { method: "POST" }),
    setMailboxes: (id: number, mailbox_ids: number[]) =>
      request<Campaign>(`/api/campaigns/${id}/mailboxes`, {
        method: "PUT",
        body: JSON.stringify({ mailbox_ids }),
      }),
    delete: (id: number) =>
      request(`/api/campaigns/${id}`, { method: "DELETE" }),
    report: (id: number) => request(`/api/campaigns/${id}/report`),
  },
  templates: {
    list: () => request<EmailTemplate[]>("/api/templates"),
    create: (data: Record<string, unknown>) =>
      request<EmailTemplate>("/api/templates", { method: "POST", body: JSON.stringify(data) }),
  },
  logs: () => request<ActivityLog[]>("/api/logs"),
};
