"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Trash2, Upload, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api, Lead } from "@/lib/api";

const emptyForm = {
  email: "",
  company: "",
  first_name: "",
  last_name: "",
  phone: "",
  website: "",
  country: "",
  industry: "",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; label: string } | null>(null);

  const load = (params?: Record<string, string>) => api.leads.list(params).then(setLeads);

  useEffect(() => {
    load();
  }, []);

  const handleSearch = () => load(search ? { search } : undefined);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(false);
    try {
      const result = await api.leads.upload(file);
      setUploadResult(
        `Imported: ${result.valid_rows} rows, ${result.duplicate_rows} duplicates, ${result.invalid_rows} empty skipped`
      );
      load();
    } catch (err) {
      setUploadError(true);
      setUploadResult(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() || null])
      );
      await api.leads.create(payload);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add lead");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (id: number, label: string) => {
    setPendingDelete({ id, label });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setDeletingId(id);
    try {
      await api.leads.delete(id);
      setPendingDelete(null);
      load(search ? { search } : undefined);
    } catch (err) {
      setUploadError(true);
      setUploadResult(err instanceof Error ? err.message : "Delete failed");
      setPendingDelete(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Leads"
        description="Import Excel sheets and manage contacts for outreach."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowForm(!showForm)} className="btn-secondary">
              <Plus size={15} /> Add Lead
            </button>
            <label className="btn-primary cursor-pointer">
              <Upload size={15} />
              {uploading ? "Uploading..." : "Upload Excel / CSV"}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </div>
        }
      />

      {uploadResult && (
        <div
          className={`mb-4 flex items-start justify-between gap-3 ${
            uploadError ? "alert-error" : "alert-success"
          }`}
        >
          <span>{uploadResult}</span>
          <button
            type="button"
            onClick={() => setUploadResult(null)}
            className={
              uploadError
                ? "text-red-700/70 hover:text-red-900"
                : "text-emerald-700/70 hover:text-emerald-900"
            }
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="alert-info mb-6 text-sm">
        Your Excel can use columns like <strong>Phone Number</strong>, <strong>Country</strong>,{" "}
        <strong>Category</strong>, <strong>Notes / Source</strong>, <strong>Remarks</strong>. If an
        email is inside notes, it will be picked up. For campaigns, rows with a real email send;
        phone-only rows are saved as <strong>no email</strong>.
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel mb-6 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              placeholder="+92..."
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Company</label>
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Category / Industry</label>
            <input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">First Name</label>
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Country</label>
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Website</label>
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="input"
            />
          </div>
          {formError && <div className="alert-error sm:col-span-2">{formError}</div>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save Lead"}
            </button>
          </div>
        </form>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-lg flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            placeholder="Search company, email, phone, website..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSearch} className="btn-secondary">
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              load();
            }}
            className="btn-ghost"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Country</th>
              <th>Status</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const label = lead.email || lead.phone || lead.company || `#${lead.id}`;
              const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
              return (
                <tr key={lead.id}>
                  <td className="font-medium text-ink-950">{lead.company || "—"}</td>
                  <td className="text-ink-600">{name || "—"}</td>
                  <td className="text-ink-700">{lead.email || "—"}</td>
                  <td className="tabular-nums text-ink-600">{lead.phone || "—"}</td>
                  <td className="text-ink-600">{lead.country || "—"}</td>
                  <td>
                    <StatusBadge status={lead.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => requestDelete(lead.id, label)}
                      disabled={deletingId === lead.id}
                      className="btn-danger !px-2 !py-1"
                      aria-label={`Delete ${label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No leads yet. Upload your Excel or add one manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete ? `Delete “${pendingDelete.label}”?` : "Delete lead?"}
        description="This permanently removes the lead from your list. You can always import it again later."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={!!pendingDelete && deletingId === pendingDelete.id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
