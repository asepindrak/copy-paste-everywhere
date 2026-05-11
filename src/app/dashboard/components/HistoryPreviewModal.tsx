"use client";

import Image from "next/image";
import { useState } from "react";
import { FaTimes, FaCopy, FaDownload, FaEdit, FaSave } from "react-icons/fa";
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
  onUpdateContent: (id: string, content: string) => Promise<void>;
  copyingIds: string[];
  downloadingIds: string[];
  updatingContentIds: string[];
  getFileNameFromUrl: (url: string) => string;
}

const isVideoContent = (value: string) =>
  /^data:video\/[a-zA-Z]+;base64,/.test(value) ||
  /^https?:\/\/.+\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?.*)?$/i.test(value);

const isImageContent = (value: string) =>
  /^data:image\/[a-zA-Z]+;base64,/.test(value) ||
  /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif|svg|bmp|tiff|ico|jfif)(\?.*)?$/i.test(
    value,
  );

const isDownloadableContent = (value: string) =>
  value.startsWith("data:") || /^https?:\/\//i.test(value);

export default function HistoryPreviewModal({
  item,
  onClose,
  onCopy,
  onDownload,
  onUpdateContent,
  copyingIds,
  downloadingIds,
  updatingContentIds,
  getFileNameFromUrl,
}: HistoryPreviewModalProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState("");

  if (!item) return null;

  const isVideo = isVideoContent(item.content);
  const isImage = isImageContent(item.content);
  const previewType = isVideo ? "video" : isImage ? "image" : "text";
  const isText = previewType === "text";
  const isSavingText = updatingContentIds.includes(item.id);

  const handleSaveText = async () => {
    await onUpdateContent(item.id, editedText);
    setIsEditingText(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-2 sm:px-4 py-4 sm:py-6"
      onClick={onClose}
    >
      <div className="absolute inset-0" />
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-800 bg-black shadow-2xl flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-4 border-b border-gray-800 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Preview {previewType}
            </h2>
            {item.title ? (
              <p className="mt-1 text-xs sm:text-sm text-slate-300 truncate">
                {item.title}
              </p>
            ) : null}
            <p className="text-xs sm:text-sm text-slate-400">
              Preview {previewType} from clipboard history.
            </p>
            {item.user && (
              <p className="mt-1 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-slate-500">
                {item.user.name || item.user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 sm:h-10 w-8 sm:w-10 items-center justify-center rounded-full border border-gray-700 bg-black text-slate-300 transition hover:border-slate-600 hover:text-white flex-shrink-0"
            aria-label="Close preview"
          >
            <FaTimes className="h-3 sm:h-4 w-3 sm:w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-6">
          <div className="mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-2 sm:rounded-3xl sm:p-4">
            {isVideo ? (
              <video
                controls
                className="mx-auto max-h-full w-full rounded-lg sm:rounded-2xl bg-black object-contain"
                src={item.content}
                playsInline
              />
            ) : isImage ? (
              <Image
                src={item.content}
                alt={item.fileName ?? "Preview image"}
                width={1200}
                height={900}
                unoptimized
                className="mx-auto max-h-full w-full object-contain"
              />
            ) : (
              <div className="max-h-[56vh] overflow-y-auto rounded-xl bg-slate-950 p-4 pb-10 text-sm leading-relaxed text-slate-200 custom-scrollbar sm:max-h-[60vh] sm:p-5 sm:pb-12">
                {isEditingText ? (
                  <textarea
                    value={editedText}
                    onChange={(event) => setEditedText(event.target.value)}
                    className="min-h-[44vh] w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 pb-8 text-sm leading-relaxed text-slate-100 outline-none transition focus:border-blue-500/70 sm:min-h-[48vh]"
                    disabled={isSavingText}
                    autoFocus
                  />
                ) : (
                  <pre className="m-0 whitespace-pre-wrap break-words pb-4 [overflow-wrap:anywhere] font-sans">
                    {item.content || "(Empty)"}
                  </pre>
                )}
              </div>
            )}
          </div>
          <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {isText && isEditingText ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveText}
                  disabled={isSavingText}
                  className={`inline-flex items-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition ${isSavingText ? "cursor-not-allowed bg-emerald-500/70" : "bg-emerald-600 hover:bg-emerald-500"}`}
                >
                  {isSavingText ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
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
                    <FaSave className="h-3 sm:h-4 w-3 sm:w-4" />
                  )}
                  {isSavingText ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditedText(item.content);
                    setIsEditingText(false);
                  }}
                  disabled={isSavingText}
                  className="inline-flex items-center rounded-xl border border-gray-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm"
                >
                  Cancel
                </button>
              </>
            ) : isText ? (
              <button
                type="button"
                onClick={() => {
                  setEditedText(item.content);
                  setIsEditingText(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-gray-900 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm"
              >
                <FaEdit className="h-3 w-3 sm:h-4 sm:w-4" />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onCopy(item.content, item.id)}
              disabled={copyingIds.includes(item.id)}
              className={`inline-flex items-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition ${copyingIds.includes(item.id) ? "bg-blue-500/70 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"}`}
            >
              {copyingIds.includes(item.id) ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
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
                <FaCopy className="h-3 sm:h-4 w-3 sm:w-4" />
              )}
              <span className="hidden sm:inline">
                {copyingIds.includes(item.id) ? "Copying..." : "Copy"}
              </span>
              <span className="sm:hidden">
                {copyingIds.includes(item.id) ? "Copy..." : "Copy"}
              </span>
            </button>
            {isDownloadableContent(item.content) && (
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
                className={`inline-flex items-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl border border-gray-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${downloadingIds.includes(item.id) ? "bg-slate-800/70 text-slate-400 cursor-not-allowed" : "bg-black text-slate-200 hover:bg-gray-900"}`}
              >
                {downloadingIds.includes(item.id) ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
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
                  <FaDownload className="h-3 sm:h-4 w-3 sm:w-4" />
                )}
                <span className="hidden sm:inline">
                  {downloadingIds.includes(item.id)
                    ? "Downloading..."
                    : "Download"}
                </span>
                <span className="sm:hidden">
                  {downloadingIds.includes(item.id) ? "Down..." : "Download"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
