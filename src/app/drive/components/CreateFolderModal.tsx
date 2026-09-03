"use client";

import { useState, useEffect } from "react";
import { FaFolder, FaTimes } from "react-icons/fa";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string | null) => Promise<void>;
  initialName?: string;
  initialColor?: string | null;
  isRename?: boolean;
}

const COLOR_PRESETS = [
  { name: "Default Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Slate", value: "#64748b" },
];

export default function CreateFolderModal({
  isOpen,
  onClose,
  onSubmit,
  initialName = "",
  initialColor = "#3b82f6",
  isRename = false,
}: CreateFolderModalProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string | null>(initialColor);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setColor(initialColor || "#3b82f6");
    setError(null);
  }, [initialName, initialColor, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Folder name cannot be empty");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim(), color);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save folder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1320] shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: color || "#3b82f6" }}
            >
              <FaFolder className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-white">
              {isRename ? "Rename Folder" : "New Folder"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
              Folder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invoices, Photos, Documents"
              autoFocus
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Color Tag
            </label>
            <div className="flex flex-wrap gap-2.5">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === preset.value
                      ? "ring-2 ring-white scale-110 shadow-lg"
                      : "opacity-80 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-medium text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 disabled:opacity-50 transition"
            >
              {isSubmitting ? "Saving..." : isRename ? "Rename" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
