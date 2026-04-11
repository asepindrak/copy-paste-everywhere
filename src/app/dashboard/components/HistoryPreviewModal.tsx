"use client";

import Image from "next/image";
import { FaTimes, FaCopy, FaDownload } from "react-icons/fa";
import type { CopyItem } from "../../../types/dashboard";

interface HistoryPreviewModalProps {
  item: CopyItem | null;
  onClose: () => void;
  onCopy: (content: string, id?: string) => Promise<void>;
  onDownload: (
    content: string,
    fileName?: string | null,
    itemId?: string,
  ) => Promise<void>;
  copyingIds: string[];
  downloadingIds: string[];
  getFileNameFromUrl: (url: string) => string;
}

const isVideoContent = (value: string) =>
  /^data:video\/[a-zA-Z]+;base64,/.test(value) ||
  /^https?:\/\/.+\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?.*)?$/i.test(value);

export default function HistoryPreviewModal({
  item,
  onClose,
  onCopy,
  onDownload,
  copyingIds,
  downloadingIds,
  getFileNameFromUrl,
}: HistoryPreviewModalProps) {
  if (!item) return null;

  const isVideo = isVideoContent(item.content);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-4 py-6"
      onClick={onClose}
    >
      <div className="absolute inset-0" />
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Preview {isVideo ? "video" : "image"}
            </h2>
            <p className="text-sm text-slate-400">
              Preview a {isVideo ? "video" : "image"} from clipboard history.
            </p>
            {item.user && (
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                {item.user.name || item.user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
            aria-label="Close preview"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">
          <div className="mx-auto max-h-[70vh] w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-4">
            {isVideo ? (
              <video
                controls
                className="mx-auto max-h-[62vh] w-full rounded-2xl bg-black object-contain"
                src={item.content}
                playsInline
              />
            ) : (
              <Image
                src={item.content}
                alt={item.fileName ?? "Preview image"}
                width={1200}
                height={900}
                unoptimized
                className="mx-auto max-h-[62vh] w-full object-contain"
              />
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onCopy(item.content, item.id)}
              disabled={copyingIds.includes(item.id)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${copyingIds.includes(item.id) ? "bg-blue-500/70 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"}`}
            >
              {copyingIds.includes(item.id) ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-spin"
                >
                  <circle cx="12" cy="12" r="8" className="opacity-25" />
                  <path d="M12 4v4" />
                </svg>
              ) : (
                <FaCopy className="h-4 w-4" />
              )}
              {copyingIds.includes(item.id) ? "Copying..." : "Copy"}
            </button>
            <button
              type="button"
              onClick={() =>
                onDownload(
                  item.content,
                  item.fileName ?? getFileNameFromUrl(item.content),
                  item.id,
                )
              }
              disabled={downloadingIds.includes(item.id)}
              className={`inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold transition ${downloadingIds.includes(item.id) ? "bg-slate-800/70 text-slate-400 cursor-not-allowed" : "bg-slate-950 text-slate-200 hover:bg-slate-900"}`}
            >
              {downloadingIds.includes(item.id) ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-spin"
                >
                  <circle cx="12" cy="12" r="8" className="opacity-25" />
                  <path d="M12 4v4" />
                </svg>
              ) : (
                <FaDownload className="h-4 w-4" />
              )}
              {downloadingIds.includes(item.id) ? "Downloading..." : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
