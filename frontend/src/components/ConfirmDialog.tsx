"use client";

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "danger" | "warn";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const isDanger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
        onClick={() => !loading && onCancel()}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="relative w-full max-w-sm rounded-xl border border-ink-200 bg-white p-5 shadow-lift animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="confirm-dialog-title"
              className="font-display text-[1.1rem] font-semibold tracking-tight text-ink-950"
            >
              {title}
            </h2>
            <p id="confirm-dialog-desc" className="mt-2 text-[13px] leading-relaxed text-ink-500">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !loading && onCancel()}
            disabled={loading}
            className="rounded-md p-1 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn text-white ${
              isDanger ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Working…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
