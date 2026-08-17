"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, OctagonX, Pause, Play, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api, Campaign, EmailTemplate, Mailbox } from "@/lib/api";

type PendingConfirm = {
  kind: "delete" | "abort";
  id: number;
  name: string;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"start" | "stop" | "abort" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ name: "", template_id: 0, mailbox_ids: [] as number[] });
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [editMailboxesId, setEditMailboxesId] = useState<number | null>(null);
  const [editMailboxIds, setEditMailboxIds] = useState<number[]>([]);
  const [savingMailboxes, setSavingMailboxes] = useState(false);

  const load = useCallback(() => {
    api.campaigns.list().then(setCampaigns);
    api.mailboxes.list().then(setMailboxes);
    api.templates.list().then(setTemplates);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

    const activeMailboxes = mailboxes.filter(
      (mb) => String(mb.status).toLowerCase() === "active"
    );

  const openCreateForm = () => {
    setShowForm((v) => {
      const next = !v;
      if (next) {
        // Pre-select ALL active mailboxes so rotation works by default
        const actives = mailboxes.filter(
          (m) => String(m.status).toLowerCase() === "active"
        );
        setForm((f) => ({
          ...f,
          mailbox_ids: actives.map((m) => m.id),
        }));
      }
      return next;
    });
  };

  useEffect(() => {
    const hasRunning = campaigns.some((c) => c.status === "running");
    if (!hasRunning) return;

    const interval = setInterval(() => {
      api.campaigns.list().then(setCampaigns);
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.template_id) {
      setError("Select a template.");
      return;
    }
    if (form.mailbox_ids.length < 2) {
      setError(
        "Select at least 2 mailboxes. With only 1 mailbox, auto-rotation cannot switch when the daily limit is hit."
      );
      return;
    }

    try {
      await api.campaigns.create(form);
      setShowForm(false);
      setForm({ name: "", template_id: 0, mailbox_ids: [] });
      setSuccess("Campaign created with mailbox auto-rotation.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create campaign.");
    }
  };

  const openEditMailboxes = (c: Campaign) => {
    setEditMailboxesId(c.id);
    setEditMailboxIds((c.mailboxes || []).map((m) => m.id));
    setError("");
  };

  const saveMailboxes = async (campaignId: number) => {
    if (editMailboxIds.length < 2) {
      setError("Select at least 2 mailboxes for auto-rotation.");
      return;
    }
    setSavingMailboxes(true);
    setError("");
    try {
      await api.campaigns.setMailboxes(campaignId, editMailboxIds);
      setEditMailboxesId(null);
      setSuccess("Mailboxes updated — Resume to continue with auto-rotation.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update mailboxes.");
    } finally {
      setSavingMailboxes(false);
    }
  };

  const runAction = async (
    id: number,
    type: "start" | "stop" | "abort" | "delete",
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setActionId(id);
    setActionType(type);
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(successMessage);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${type} campaign.`);
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleStart = (id: number) =>
    runAction(
      id,
      "start",
      () => api.campaigns.start(id),
      "Sending continued — when one mailbox hits its daily limit, the next starts automatically."
    );

  const handleStop = (id: number) =>
    runAction(
      id,
      "stop",
      () => api.campaigns.stop(id),
      "Campaign stopped. You can resume it later with Start."
    );

  const handleAbort = (id: number, name: string) => {
    setPendingConfirm({ kind: "abort", id, name });
  };

  const handleDelete = (id: number, name: string) => {
    setPendingConfirm({ kind: "delete", id, name });
  };

  const executePendingConfirm = async () => {
    if (!pendingConfirm) return;
    const { kind, id, name } = pendingConfirm;

    if (kind === "abort") {
      await runAction(
        id,
        "abort",
        () => api.campaigns.abort(id),
        "Campaign aborted. Remaining emails were skipped."
      );
    } else {
      await runAction(
        id,
        "delete",
        () => api.campaigns.delete(id),
        `Campaign "${name}" deleted.`
      );
    }
    setPendingConfirm(null);
  };

  const toggleMailbox = (id: number) => {
    setForm((prev) => ({
      ...prev,
      mailbox_ids: prev.mailbox_ids.includes(id)
        ? prev.mailbox_ids.filter((m) => m !== id)
        : [...prev.mailbox_ids, id],
    }));
  };

  const toggleEditMailbox = (id: number) => {
    setEditMailboxIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const isBusy = (id: number, type: "start" | "stop" | "abort" | "delete") =>
    actionId === id && actionType === type;

  return (
    <div className="page">
      <PageHeader
        title="Campaigns"
        description="Send from rotating mailboxes. When one inbox is full for today, the next continues pending leads."
        action={
          <button type="button" onClick={openCreateForm} className="btn-primary">
            <Plus size={15} /> New Campaign
          </button>
        }
      />

      <div className="alert-info mb-6">
        <strong>Mailbox auto-rotate:</strong> Select <em>2 or more</em> mailboxes on the campaign.
        Mailbox 1 sends until its daily limit is full → Mailbox 2 starts <em>immediately</em> and
        keeps sending until <em>its</em> daily limit is full → then Mailbox 3, and so on.
        <br />
        No Resume click between mailboxes. Pause only when <strong>all</strong> selected mailboxes
        are full for today.
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}
      {success && <div className="alert-success mb-4">{success}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="panel mb-6 space-y-4 p-5">
          <div>
            <label className="label">Campaign Name</label>
            <input
              placeholder="Q1 Construction Outreach"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Template</label>
            {templates.length === 0 ? (
              <div className="alert-warn">
                No saved templates yet. Go to{" "}
                <a href="/templates" className="font-semibold underline underline-offset-2">
                  Templates
                </a>
                , click <strong>New Template</strong>, then <strong>Save Unicode Template</strong>.
                After that, come back here and it will appear in this list.
              </div>
            ) : (
              <select
                required
                value={form.template_id}
                onChange={(e) => setForm({ ...form, template_id: +e.target.value })}
                className="input"
              >
                <option value={0}>Select Template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <p className="label">Select ALL mailboxes to use (required for auto-switch)</p>
            {activeMailboxes.length === 0 ? (
              <p className="alert-warn">
                No active mailboxes. Activate mailboxes on the Mailboxes page, then select them all here.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-ink-500">
                  Tick every inbox you want in this campaign (e.g. 2 or 3). After one hits 15/day,
                  the next ticked inbox continues automatically — same campaign, remaining leads only.
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeMailboxes.map((mb) => {
                    const selected = form.mailbox_ids.includes(mb.id);
                    return (
                      <label
                        key={mb.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                          selected
                            ? "border-brand-500 bg-brand-50 text-brand-900"
                            : "border-ink-200 bg-white hover:bg-ink-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={selected}
                          onChange={() => toggleMailbox(mb.id)}
                        />
                        {mb.email}
                        <span className="text-ink-400">({mb.sent_today}/{mb.daily_limit} today)</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button
            type="submit"
            disabled={activeMailboxes.length < 2}
            className="btn-primary"
          >
            Create Campaign
          </button>
          {activeMailboxes.length < 2 && (
            <p className="text-[12px] text-amber-700">
              Add at least 2 active mailboxes on the Mailboxes page first — rotation needs 2+.
            </p>
          )}
        </form>
      )}

      <div className="space-y-3">
        {campaigns.map((c, index) => (
          <div
            key={c.id}
            className="panel p-5 animate-fade-up"
            style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
          >            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink-950">
                    {c.name}
                  </h3>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-[13px] tabular-nums text-ink-500">
                  Sent {c.sent_count}/{c.total_leads}
                  {typeof c.remaining_leads === "number" ? ` · ${c.remaining_leads} pending` : ""}
                  {c.duplicate_count ? ` · ${c.duplicate_count} duplicates` : ""}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1">
                {(c.status === "draft" || c.status === "paused") && (
                  <button
                    type="button"
                    onClick={() => handleStart(c.id)}
                    disabled={actionId === c.id}
                    className="btn-secondary !py-1.5"
                  >
                    {isBusy(c.id, "start") ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Play size={14} /> {c.status === "paused" ? "Resume" : "Start"}
                      </>
                    )}
                  </button>
                )}

                {c.status === "running" && (
                  <>
                    <span className="inline-flex items-center gap-1 px-2 text-[12px] text-sky-700">
                      <Loader2 size={13} className="animate-spin" /> Running
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStart(c.id)}
                      disabled={actionId === c.id}
                      className="btn-secondary !py-1.5"
                      title="If sending stopped, click to continue"
                    >
                      {isBusy(c.id, "start") ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Play size={14} /> Continue
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStop(c.id)}
                      disabled={actionId === c.id}
                      className="btn-warn !py-1.5"
                    >
                      {isBusy(c.id, "stop") ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Pause size={14} /> Stop
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAbort(c.id, c.name)}
                      disabled={actionId === c.id}
                      className="btn-danger !py-1.5"
                    >
                      {isBusy(c.id, "abort") ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <OctagonX size={14} /> Abort
                        </>
                      )}
                    </button>
                  </>
                )}

                {c.status === "paused" && (
                  <button
                    type="button"
                    onClick={() => handleAbort(c.id, c.name)}
                    disabled={actionId === c.id}
                    className="btn-danger !py-1.5"
                  >
                    {isBusy(c.id, "abort") ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <OctagonX size={14} /> Abort
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.name)}
                  disabled={actionId === c.id}
                  className="btn-danger !py-1.5"
                  aria-label={`Delete ${c.name}`}
                >
                  {isBusy(c.id, "delete") ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-ink-100 pt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                  Mailboxes
                </p>
                {(c.status === "draft" || c.status === "paused") && (
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-brand-700 hover:underline"
                    onClick={() =>
                      editMailboxesId === c.id ? setEditMailboxesId(null) : openEditMailboxes(c)
                    }
                  >
                    {editMailboxesId === c.id ? "Cancel" : "Edit mailboxes"}
                  </button>
                )}
              </div>

              {(c.mailboxes?.length ?? 0) < 2 && (
                <div className="alert-warn mb-3 text-[12px]">
                  Only {c.mailboxes?.length ?? 0} mailbox linked — auto-rotation needs{" "}
                  <strong>2+</strong>. Click <strong>Edit mailboxes</strong>, select both inboxes,
                  save, then Resume.
                </div>
              )}

              {editMailboxesId === c.id ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {activeMailboxes.map((mb) => {
                      const selected = editMailboxIds.includes(mb.id);
                      return (
                        <label
                          key={mb.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                            selected
                              ? "border-brand-500 bg-brand-50 text-brand-900"
                              : "border-ink-200 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-brand-600"
                            checked={selected}
                            onChange={() => toggleEditMailbox(mb.id)}
                          />
                          {mb.email}
                          <span className="text-ink-400">
                            ({mb.sent_today}/{mb.daily_limit})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={savingMailboxes || editMailboxIds.length < 2}
                    onClick={() => saveMailboxes(c.id)}
                  >
                    {savingMailboxes ? "Saving..." : "Save mailboxes (min 2)"}
                  </button>
                </div>
              ) : (c.mailboxes?.length ?? 0) === 0 ? (
                <p className="text-[13px] text-ink-400">None linked</p>
              ) : (
                <div className="space-y-2">
                  {c.mailboxes!.map((mb, index) => {
                    const pct = mb.daily_limit
                      ? Math.min(100, Math.round((mb.sent_today / mb.daily_limit) * 100))
                      : 0;
                    const full = mb.remaining_today <= 0;
                    return (
                      <div key={mb.id} className="flex items-center gap-3">
                        <p className="min-w-0 flex-1 truncate text-[13px] text-ink-800" title={mb.email}>
                          {index + 1}. {mb.email}
                        </p>
                        <span
                          className={`shrink-0 text-[12px] tabular-nums ${
                            full ? "font-medium text-amber-700" : "text-ink-500"
                          }`}
                        >
                          {mb.sent_today}/{mb.daily_limit}
                          {full ? " full" : ""}
                        </span>
                        <div className="h-1 w-20 shrink-0 overflow-hidden rounded bg-ink-100 sm:w-28">
                          <div
                            className={`h-full origin-left transition-all duration-500 ${
                              full ? "bg-amber-500" : "bg-brand-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {campaigns.length === 0 && <div className="panel empty">No campaigns yet</div>}
      </div>

      <ConfirmDialog
        open={!!pendingConfirm}
        title={
          pendingConfirm?.kind === "abort"
            ? `Abort “${pendingConfirm.name}”?`
            : `Delete “${pendingConfirm?.name ?? ""}”?`
        }
        description={
          pendingConfirm?.kind === "abort"
            ? "This stops the campaign for good. Remaining queued emails will be skipped and cannot be resumed."
            : "This removes the campaign card and its queue. Sent emails stay in your history."
        }
        confirmLabel={pendingConfirm?.kind === "abort" ? "Abort" : "Delete"}
        cancelLabel="Cancel"
        tone={pendingConfirm?.kind === "abort" ? "warn" : "danger"}
        loading={
          !!pendingConfirm &&
          actionId === pendingConfirm.id &&
          (actionType === "delete" || actionType === "abort")
        }
        onCancel={() => setPendingConfirm(null)}
        onConfirm={executePendingConfirm}
      />
    </div>
  );
}
