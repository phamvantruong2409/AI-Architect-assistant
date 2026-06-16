"use client";

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-[90%] max-w-sm rounded-card border border-border bg-surface p-6 shadow-xl">
        <h3 className="font-display text-base">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-foreground-soft">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-card border border-border px-4 py-2 text-sm text-foreground-soft transition-colors hover:bg-surface-muted"
          >
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            className="rounded-card bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}
