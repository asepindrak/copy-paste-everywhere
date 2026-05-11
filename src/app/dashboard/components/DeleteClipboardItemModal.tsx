"use client";

import { FaSpinner, FaTimes, FaTrash } from "react-icons/fa";
import type { CopyItem } from "../../../types/dashboard";

interface DeleteClipboardItemModalProps {
  item: CopyItem | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const getTextPreview = (content: string, maxLength = 120) => {
  const text = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!text) return "(Empty)";
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 3).trimEnd()}...`
    : text;
};

export default function DeleteClipboardItemModal({
  item,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteClipboardItemModalProps) {
  if (!item) return null;

  const label =
    item.title?.trim() || item.fileName?.trim() || getTextPreview(item.content);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0b121c] shadow-[0_28px_80px_-42px_rgba(0,0,0,0.95)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Delete clipboard item
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              This item will be permanently removed from clipboard history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
            aria-label="Close delete confirmation"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Item
            </p>
            <p className="mt-2 break-words text-sm font-semibold text-slate-100">
              {label}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-2xl border border-gray-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <FaSpinner className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <FaTrash className="h-4 w-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
