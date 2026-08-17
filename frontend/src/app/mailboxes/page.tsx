"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api, Mailbox } from "@/lib/api";

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: number; email: string } | null>(null);
  const [form, setForm] = useState({
    email: "",
    smtp_host: "",
    smtp_port: 587,
    password: "",
    daily_limit: 15,
  });

  const load = () => api.mailboxes.list().then(setMailboxes);
  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.mailboxes.create(form);
      setShowForm(false);
      setForm({ email: "", smtp_host: "", smtp_port: 587, password: "", daily_limit: 15 });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mailbox");
    }
  };

  const requestDelete = (id: number, email: string) => {
    setError("");
    setPendingDelete({ id, email });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError("");
    try {
      await api.mailboxes.delete(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setPendingDelete(null);
      setError(err instanceof Error ? err.message : "Failed to delete mailbox");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Mailboxes"
        description="SMTP inboxes, daily limits, and send health."
        action={
          <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={15} /> Add Mailbox
          </button>
        }
      />

      {error && <div className="alert-error mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="panel mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input
              placeholder="you@company.com"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">SMTP Host</label>
            <input
              placeholder="smtp.company.com"
              required
              value={form.smtp_host}
              onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">SMTP Port</label>
            <input
              type="number"
              value={form.smtp_port}
              onChange={(e) => setForm({ ...form, smtp_port: +e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Daily Limit</label>
            <input
              type="number"
              value={form.daily_limit}
              onChange={(e) => setForm({ ...form, daily_limit: +e.target.value })}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Save Mailbox
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>SMTP</th>
              <th>Daily Limit</th>
              <th>Sent Today</th>
              <th>Health</th>
              <th>Status</th>
              <th>Warmup</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mailboxes.map((mb) => (
              <tr key={mb.id}>
                <td className="font-medium text-ink-950">{mb.email}</td>
                <td className="text-ink-500">
                  {mb.smtp_host}:{mb.smtp_port}
                </td>
                <td className="tabular-nums">{mb.daily_limit}</td>
                <td className="tabular-nums">{mb.sent_today}</td>
                <td className="tabular-nums">{mb.health_score}%</td>
                <td>
                  <StatusBadge status={mb.status} />
                </td>
                <td className="capitalize text-ink-500">{mb.warmup_status.replace(/_/g, " ")}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => requestDelete(mb.id, mb.email)}
                    className="btn-danger !px-2 !py-1.5"
                    aria-label="Delete mailbox"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {mailboxes.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  No mailboxes configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete ? `Delete “${pendingDelete.email}”?` : "Delete mailbox?"}
        description="This removes the mailbox from Bulkyy. Campaigns using it will no longer be able to send from this inbox."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
