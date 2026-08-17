"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, Plus, Type } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { api, EmailTemplate } from "@/lib/api";

const DEFAULT_NAME = "Aussie Takeoff — Estimating Outreach";
const DEFAULT_SUBJECT = "Estimating support for {{Company}} — quick intro";
const DEFAULT_BODY = `Hi {{FirstName}},

Winning more projects often comes down to getting accurate estimates out quickly. If your team is spending too much time on takeoffs or delaying bids because of workload, we can help.

At Aussie Takeoff, we provide reliable Material Takeoffs, BOQs, and Cost Estimating for U.S. contractors, allowing your estimators to focus on pricing, client relationships, and winning more work, not measuring plans.

Why contractors choose us:
• Increase estimating capacity without hiring full-time staff
• Fast turnaround to meet bid deadlines
• Accurate quantity takeoffs that help reduce costly errors
• A dedicated team of 15+ experienced Civil Engineers working in North American time zones
• Flexible engagement with no long-term commitment

Whether you need support for a single project or ongoing estimating assistance, we can seamlessly become an extension of your team.

Would you be available for a 15-minute call this week to see if we're a good fit?

Best regards,

Hamza Ejaz
CEO | Aussie Takeoff
www.aussietakeoff.com`;

const SAMPLE = {
  FirstName: "John",
  LastName: "Carter",
  Company: "Summit Builders",
  Website: "summitbuilders.com",
  Email: "john@summitbuilders.com",
};

const UNICODE_CHIPS = [
  { label: "✅", value: "✅", title: "Check" },
  { label: "✔", value: "✔", title: "Heavy check" },
  { label: "🚀", value: "🚀", title: "Rocket" },
  { label: "★", value: "★", title: "Star" },
  { label: "•", value: "•", title: "Bullet" },
  { label: "→", value: "→", title: "Arrow" },
  { label: "—", value: "—", title: "Em dash" },
  { label: "…", value: "…", title: "Ellipsis" },
  { label: "€", value: "€", title: "Euro" },
  { label: "£", value: "£", title: "Pound" },
  { label: "©", value: "©", title: "Copyright" },
  { label: "™", value: "™", title: "Trademark" },
];

function decodeUnicodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return match;
      }
    })
    .replace(/&#(\d+);/g, (match, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return match;
      }
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

/** Strip HTML so older templates edit as plain text. */
function htmlToPlainText(html: string): string {
  return decodeUnicodeEntities(
    html
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/?(ul|ol|strong|b|em|i|a|span|p|div|h[1-6])[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Convert plain Unicode text → simple HTML for the email HTML part. */
function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

function applySampleTokens(text: string): string {
  let out = decodeUnicodeEntities(text);
  for (const [key, value] of Object.entries(SAMPLE)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

function templateBodyPlain(t: EmailTemplate): string {
  if (t.body_text?.trim()) return decodeUnicodeEntities(t.body_text);
  return htmlToPlainText(t.body_html);
}

type FieldTarget = "subject" | "body";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: DEFAULT_NAME,
    subject: DEFAULT_SUBJECT,
    body: DEFAULT_BODY,
    category: "Estimating",
  });
  const [activeField, setActiveField] = useState<FieldTarget>("body");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const resetForm = () =>
    setForm({
      name: DEFAULT_NAME,
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
      category: "Estimating",
    });

  const load = () => api.templates.list().then(setTemplates);
  useEffect(() => {
    load();
  }, []);

  const insertAtCursor = (text: string) => {
    if (activeField === "subject") {
      const el = subjectRef.current;
      if (!el) {
        setForm((f) => ({ ...f, subject: f.subject + text }));
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + text + el.value.slice(end);
      setForm((f) => ({ ...f, subject: next }));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + text.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }

    const el = bodyRef.current;
    if (!el) {
      setForm((f) => ({ ...f, body: f.body + text }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const subject = decodeUnicodeEntities(form.subject);
      const body = decodeUnicodeEntities(form.body);
      await api.templates.create({
        name: form.name,
        subject,
        body_text: body,
        body_html: plainTextToHtml(body),
        category: form.category,
      });
      setShowForm(false);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const previewSubject = applySampleTokens(form.subject);
  const previewBody = applySampleTokens(form.body);

  return (
    <div className="page">
      <PageHeader
        title="Email Templates"
        description="Write plain Unicode text — live preview on the right. No HTML needed."
        action={
          <button
            type="button"
            onClick={() => {
              if (!showForm) resetForm();
              setShowForm(!showForm);
            }}
            className="btn-primary"
          >
            <Plus size={16} /> New Template
          </button>
        }
      />

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="alert-info">
          Variables:{" "}
          {["{{FirstName}}", "{{LastName}}", "{{Company}}", "{{Website}}", "{{Email}}"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertAtCursor(v)}
              className="mr-1 mb-1 rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-xs hover:bg-white"
            >
              {v}
            </button>
          ))}
        </div>
        <div className="alert-warn">
          Preview uses sample names (John / Summit Builders). Blank lines become paragraphs when
          sent.
        </div>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="panel mb-6 space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 pb-4 text-sm font-semibold text-ink-800">
            <Type size={16} className="text-brand-600" />
            Plain text editor
          </div>

          <div>
            <p className="label">Insert Unicode</p>
            <div className="flex flex-wrap gap-1.5">
              {UNICODE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  title={chip.title}
                  onClick={() => insertAtCursor(chip.value)}
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-ink-200 bg-ink-50 text-base transition hover:border-brand-400 hover:bg-brand-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Template Name</label>
              <input
                placeholder={DEFAULT_NAME}
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <input
                placeholder="e.g. Estimating"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Subject Line</label>
            <input
              ref={subjectRef}
              placeholder={DEFAULT_SUBJECT}
              required
              value={form.subject}
              onFocus={() => setActiveField("subject")}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="input"
            />
            {previewSubject && (
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                Subject preview:{" "}
                <span className="font-medium text-ink-900">{previewSubject}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <p className="label">Body (plain text)</p>
              <textarea
                ref={bodyRef}
                rows={20}
                placeholder="Write your email in plain text…"
                required
                value={form.body}
                onFocus={() => setActiveField("body")}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="input min-h-[26rem] text-[14px] leading-7"
                spellCheck
              />
            </div>

            <div>
              <p className="label flex items-center gap-1.5">
                <Eye size={14} className="text-brand-600" />
                Live Preview
              </p>
              <div className="min-h-[26rem] overflow-auto rounded-xl border border-ink-200 bg-white px-6 py-6 shadow-soft">
                <p className="mb-5 border-b border-ink-100 pb-4 text-[15px] font-semibold leading-snug text-ink-950">
                  {previewSubject || "(No subject)"}
                </p>
                <pre className="email-preview-plain whitespace-pre-wrap font-sans text-[15px] leading-[1.85] text-ink-800">
                  {previewBody}
                </pre>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            <Check size={16} />
            {saving ? "Saving…" : "Save Template"}
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {templates.map((t, i) => (
          <div key={t.id} className="panel p-6" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-ink-950">{t.name}</h3>
              <div className="flex items-center gap-2">
                <span className="badge-brand">UTF-8</span>
                {t.category && <span className="badge-neutral">{t.category}</span>}
              </div>
            </div>
            <p className="mb-4 text-[15px] font-semibold leading-snug text-ink-900">
              {applySampleTokens(t.subject)}
            </p>
            <pre className="email-preview-plain whitespace-pre-wrap rounded-xl border border-ink-100 bg-ink-50/40 px-6 py-5 font-sans text-[15px] leading-[1.85] text-ink-800">
              {applySampleTokens(templateBodyPlain(t))}
            </pre>
          </div>
        ))}
        {templates.length === 0 && !showForm && (
          <div className="panel empty">No templates yet — click New Template to start.</div>
        )}
      </div>
    </div>
  );
}
