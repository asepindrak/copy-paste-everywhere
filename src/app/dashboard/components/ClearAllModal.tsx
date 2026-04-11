"use client";

import { FaTimes } from "react-icons/fa";

interface ClearAllModalProps {
  clearAllConfirmation: string;
  isClearingAll: boolean;
  onClose: () => void;
  onConfirmationChange: (value: string) => void;
  onConfirm: () => void;
}

export default function ClearAllModal({
  clearAllConfirmation,
  isClearingAll,
  onClose,
  onConfirmationChange,
  onConfirm,
}: ClearAllModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Clear personal clipboard
            </h2>
            <p className="text-sm text-slate-400">
              This will permanently delete all items from your personal
              clipboard.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Workspace items are not affected.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-6 p-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-sm text-slate-300">
              Type <span className="font-semibold text-white">clear all</span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={clearAllConfirmation}
              onChange={(event) => onConfirmationChange(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Type clear all to confirm"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-400">
              Once confirmed, your personal clipboard data will be deleted
              immediately.
            </div>
            <button
              type="button"
              onClick={onConfirm}
              disabled={clearAllConfirmation !== "clear all" || isClearingAll}
              className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClearingAll ? "Clearing..." : "Confirm Clear All"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
