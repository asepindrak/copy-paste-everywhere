"use client";

import { useState, useEffect } from "react";
import { FaFolder, FaTimes, FaHome, FaChevronRight } from "react-icons/fa";
import { DriveFolderItem, DriveFileItem } from "../types";

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DriveFolderItem | DriveFileItem | null;
  itemType: "folder" | "file";
  workspaceId: string | null;
  onMove: (targetFolderId: string | null) => Promise<void>;
}

export default function MoveItemModal({
  isOpen,
  onClose,
  item,
  itemType,
  workspaceId,
  onMove,
}: MoveItemModalProps) {
  const [folders, setFolders] = useState<{ id: string; name: string; parentId: string | null; color: string | null }[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);
    setSelectedFolderId(null);

    const query = new URLSearchParams({
      all: "true",
      ...(workspaceId ? { workspaceId } : {}),
    });

    fetch(`/api/drive/folders?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.folders) {
          setFolders(data.folders);
        }
      })
      .catch(() => setError("Failed to load folder list"))
      .finally(() => setIsLoading(false));
  }, [isOpen, workspaceId]);

  if (!isOpen || !item) return null;

  // If moving a folder, filter out the folder itself and its descendants
  const isInvalidTarget = (targetId: string | null) => {
    if (itemType === "folder") {
      if (targetId === item.id) return true;
    }
    return false;
  };

  const handleConfirm = async () => {
    if (isInvalidTarget(selectedFolderId)) {
      setError("Cannot move folder into itself");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onMove(selectedFolderId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to move item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1320] shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">
              Move &quot;{item.name}&quot; to...
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Select a destination folder:
          </p>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 p-2 space-y-1">
            {/* Root item */}
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                selectedFolderId === null
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FaHome className="h-4 w-4 text-sky-400" />
              <span>{workspaceId ? "Workspace Drive (Root)" : "My Drive (Root)"}</span>
            </button>

            {isLoading ? (
              <div className="py-4 text-center text-xs text-slate-500">Loading folders...</div>
            ) : folders.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">No subfolders created yet.</div>
            ) : (
              folders.map((f) => {
                const disabled = isInvalidTarget(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedFolderId(f.id)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                      disabled
                        ? "opacity-30 cursor-not-allowed"
                        : selectedFolderId === f.id
                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FaFolder
                        className="h-3.5 w-3.5 flex-shrink-0"
                        style={{ color: f.color || "#3b82f6" }}
                      />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <FaChevronRight className="h-3 w-3 text-slate-600 flex-shrink-0" />
                  </button>
                );
              })
            )}
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
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-medium text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 disabled:opacity-50 transition"
            >
              {isSubmitting ? "Moving..." : "Move Here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
