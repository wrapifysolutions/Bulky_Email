"use client";

import { useState } from "react";
import { CheckCircle2, Globe, Loader2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api, Lead } from "@/lib/api";

interface GenerationError {
  url: string;
  message: string;
}

export default function LeadGeneratorPage() {
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Lead[]>([]);
  const [errors, setErrors] = useState<GenerationError[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const validCount = results.filter((lead) => lead.email).length;

  const parseUrls = () =>
    Array.from(
      new Set(
        urls
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean)
      )
    );

  const handleGenerate = async () => {
    const urlList = parseUrls();
    if (!urlList.length) return;

    setLoading(true);
    setResults([]);
    setErrors([]);
    setCompleted(0);
    setTotal(urlList.length);
    setCurrentUrl(urlList[0]);

    const generated: Lead[] = [];
    const failed: GenerationError[] = [];

    for (const url of urlList) {
      setCurrentUrl(url);
      try {
        const leads = await api.leads.generate([url]);
        generated.push(...leads);
        setResults([...generated]);
      } catch (e) {
        failed.push({
          url,
          message: e instanceof Error ? e.message : "Failed to extract this website",
        });
        setErrors([...failed]);
      }

      setCompleted((value) => value + 1);
    }

    setCurrentUrl("");
    setLoading(false);
  };

  return (
    <div className="page">
      <PageHeader
        title="Lead Generator"
        description="Paste websites and extract company details plus contact emails."
      />

      <div className="panel mb-6 p-6">
        <label className="label">Website URLs (one per line)</label>
        <textarea
          rows={6}
          placeholder={"company1.com\ncompany2.com\ncompany3.com"}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          className="input font-mono"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary mt-4"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
          {loading ? "Crawling..." : "Generate Leads"}
        </button>
      </div>

      {(loading || total > 0) && (
        <div className="panel mb-6 p-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-950">Extraction Progress</h3>
              <p className="mt-1 text-sm text-ink-500">
                {loading
                  ? `Processing ${completed + 1 > total ? total : completed + 1} of ${total}`
                  : `Completed ${completed} of ${total}`}
              </p>
            </div>
            <div className="font-display text-4xl font-semibold tabular-nums text-brand-700">
              {progress}%
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-lg bg-ink-100">
            <div
              className="h-full rounded-lg bg-brand-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-ink-200 bg-ink-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Processed</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink-950">
                {completed}/{total}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Emails Found</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-emerald-900">
                {validCount}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Failed</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-red-900">
                {errors.length}
              </p>
            </div>
          </div>

          {currentUrl && (
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-600">
              <Loader2 size={15} className="animate-spin text-brand-600" />
              Now extracting: <span className="font-mono text-ink-900">{currentUrl}</span>
            </div>
          )}

          {!loading && total > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              Lead extraction finished.
            </div>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div className="alert-error mb-6">
          <h3 className="mb-3 font-semibold">Websites that could not be extracted</h3>
          <div className="space-y-2">
            {errors.map((error) => (
              <div key={error.url} className="flex items-start gap-2 text-sm">
                <XCircle size={15} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-mono">{error.url}</span>: {error.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="table-wrap">
          <div className="border-b border-ink-200 bg-ink-50/80 px-4 py-3 text-sm font-medium text-ink-700">
            Generated {results.length} leads
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Email</th>
                <th>Website</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((lead) => (
                <tr key={lead.id}>
                  <td className="font-medium text-ink-950">{lead.company || "—"}</td>
                  <td>{lead.email || "—"}</td>
                  <td className="text-ink-500">{lead.website || "—"}</td>
                  <td className="text-ink-500">{lead.phone || "—"}</td>
                  <td>
                    <StatusBadge status={lead.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
