"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  FaImages,
  FaFileAlt,
  FaVideo,
  FaEye,
  FaEdit,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileArchive,
  FaFileCode,
  FaFileImage,
  FaFileVideo,
  FaFileAudio,
  FaFileCsv,
} from "react-icons/fa";
import type { RefObject } from "react";
import type { CopyItem } from "../../../types/dashboard";

interface HistorySidebarProps {
  history: CopyItem[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenImageGallery: () => void;
  onOpenFileGallery: () => void;
  onOpenVideoGallery: () => void;
  onCopy: (content: string, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDownload: (
    value: string,
    fileName?: string | null,
    itemId?: string,
  ) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
  updatingTitleIds: string[];
  setHistoryPreviewItem: (item: CopyItem | null) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  copiedHistoryId: string | null;
  copyingIds: string[];
  downloadingIds: string[];
  deletingIds: string[];
  isImageContent: (value: string) => boolean;
  isVideoContent: (value: string) => boolean;
  isRemoteFile: (value: string) => boolean;
  isLocalPath: (value: string) => boolean;
  getImageSrc: (src: string) => string;
  getFileNameFromUrl: (url: string) => string;
  getFileType: (value: string) => string | null;
  getFileSize: (value: string) => string | null;
}

export default function HistorySidebar({
  history,
  searchQuery,
  onSearchQueryChange,
  onOpenImageGallery,
  onOpenFileGallery,
  onOpenVideoGallery,
  onCopy,
  onDelete,
  onDownload,
  onUpdateTitle,
  updatingTitleIds,
  setHistoryPreviewItem,
  isLoadingMore,
  hasMore,
  scrollContainerRef,
  loadMoreRef,
  copiedHistoryId,
  copyingIds,
  downloadingIds,
  deletingIds,
  isImageContent,
  isVideoContent,
  isRemoteFile,
  isLocalPath,
  getImageSrc,
  getFileNameFromUrl,
  getFileType,
  getFileSize,
}: HistorySidebarProps) {
  const { data: session } = useSession();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  };

  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  const getUserLabel = (item: CopyItem) =>
    item.user?.name ||
    item.user?.email ||
    (item.userId === session?.user?.id
      ? session.user.name || session.user.email
      : "Unknown user");

  const startEditingTitle = (item: CopyItem) => {
    setEditingTitleId(item.id);
    setEditingTitleValue(item.title ?? "");
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitleValue("");
  };

  const saveTitle = async (item: CopyItem) => {
    await onUpdateTitle(item.id, editingTitleValue);
    setEditingTitleId(null);
    setEditingTitleValue("");
  };

  const getFileIcon = (content: string) => {
    const type = getFileType(content);
    if (!type) return <FaFileAlt className="h-4 w-4" />;

    const upperType = type.toUpperCase();
    if (["JPG", "JPEG", "PNG", "GIF", "WEBP", "SVG", "BMP"].includes(upperType))
      return <FaFileImage className="h-4 w-4 text-blue-400" />;
    if (["MP4", "WEBM", "OGG", "MOV", "AVI", "MKV", "M4V"].includes(upperType))
      return <FaFileVideo className="h-4 w-4 text-purple-400" />;
    if (["PDF"].includes(upperType))
      return <FaFilePdf className="h-4 w-4 text-red-400" />;
    if (["DOC", "DOCX"].includes(upperType))
      return <FaFileWord className="h-4 w-4 text-blue-500" />;
    if (["XLS", "XLSX"].includes(upperType))
      return <FaFileExcel className="h-4 w-4 text-emerald-500" />;
    if (["PPT", "PPTX"].includes(upperType))
      return <FaFilePowerpoint className="h-4 w-4 text-orange-500" />;
    if (["ZIP", "RAR", "7Z", "TAR", "GZ"].includes(upperType))
      return <FaFileArchive className="h-4 w-4 text-yellow-500" />;
    if (
      [
        "JS",
        "TS",
        "TSX",
        "JSX",
        "HTML",
        "CSS",
        "JSON",
        "PY",
        "GO",
        "RS",
      ].includes(upperType)
    )
      return <FaFileCode className="h-4 w-4 text-slate-400" />;
    if (["MP3", "WAV", "FLAC", "AAC", "M4A"].includes(upperType))
      return <FaFileAudio className="h-4 w-4 text-pink-400" />;
    if (["CSV"].includes(upperType))
      return <FaFileCsv className="h-4 w-4 text-emerald-600" />;
    if (["TXT", "MD", "RTF"].includes(upperType))
      return <FaFileAlt className="h-4 w-4 text-slate-300" />;

    return <FaFileAlt className="h-4 w-4 text-slate-400" />;
  };

  return (
    <aside className="space-y-6 flex w-full min-w-0 max-w-full flex-col min-h-[520px] h-auto">
      <section className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-[0_24px_72px_-44px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-6">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100"></div>
        <div className="relative z-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenImageGallery}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-white transition hover:bg-slate-700"
                aria-label="Open image gallery"
              >
                <FaImages className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenFileGallery}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-white transition hover:bg-slate-700"
                aria-label="Open file gallery"
              >
                <FaFileAlt className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenVideoGallery}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-white transition hover:bg-slate-700"
                aria-label="Open video gallery"
              >
                <FaVideo className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search history..."
              className="w-full bg-slate-950 border border-gray-800 rounded-2xl py-2 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-blue-500/50 transition"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 min-w-0 space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[62vh] lg:max-h-[72vh]"
          >
            {history.length === 0 && !isLoadingMore ? (
              <div className="rounded-2xl border border-dashed border-gray-800 p-8 text-center mt-4">
                <p className="text-slate-500 text-sm">
                  {searchQuery
                    ? "No matching history found."
                    : "No clipboard history yet."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mt-2">
                  {history.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="group relative min-w-0 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1422]/90 p-3 transition hover:border-slate-500 hover:bg-slate-900 sm:p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        {editingTitleId === item.id ? (
                          <div className="flex flex-1 flex-col gap-2">
                            <input
                              type="text"
                              value={editingTitleValue}
                              onChange={(e) =>
                                setEditingTitleValue(e.target.value)
                              }
                              placeholder="Enter title..."
                              className="w-full rounded-2xl border border-gray-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500/50"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveTitle(item)}
                                disabled={updatingTitleIds.includes(item.id)}
                                className="rounded-2xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updatingTitleIds.includes(item.id)
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingTitle}
                                className="rounded-2xl border border-gray-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-slate-100">
                              {item.title?.trim() || "Untitled"}
                            </p>
                            <button
                              type="button"
                              onClick={() => startEditingTitle(item)}
                              className="rounded-lg bg-slate-700/20 p-2 text-slate-200 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 hover:bg-slate-700 hover:text-white"
                              title="Edit title"
                            >
                              <FaEdit className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 mb-2 sm:flex-row sm:items-start sm:justify-between min-w-0">
                        <div className="flex flex-1 min-w-0 flex-wrap items-center gap-2">
                          {isLocalPath(item.content) && (
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-amber-300"
                              title="Local file path (Not an actual file)"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                              </svg>
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {new Date(item.createdAt).toLocaleDateString()}{" "}
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            {getUserLabel(item)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 pl-3">
                          <button
                            onClick={() => onCopy(item.content, item.id)}
                            disabled={copyingIds.includes(item.id)}
                            className={`rounded-lg bg-blue-600/10 p-2 text-blue-400 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 hover:bg-blue-600 hover:text-white ${copyingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                            title={
                              copyingIds.includes(item.id)
                                ? "Copying..."
                                : "Copy to clipboard"
                            }
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
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="opacity-25"
                                />
                                <path d="M12 4v4" />
                              </svg>
                            ) : copiedHistoryId === item.id ? (
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
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
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
                              >
                                <rect
                                  width="14"
                                  height="14"
                                  x="8"
                                  y="8"
                                  rx="2"
                                  ry="2"
                                />
                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                              </svg>
                            )}
                          </button>
                          {(isImageContent(item.content) ||
                            isVideoContent(item.content)) && (
                            <button
                              onClick={() => setHistoryPreviewItem(item)}
                              className="rounded-lg bg-slate-700/20 p-2 text-slate-200 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 hover:bg-slate-700 hover:text-white"
                              title={
                                isVideoContent(item.content)
                                  ? "Preview video"
                                  : "Preview image"
                              }
                              aria-label={
                                isVideoContent(item.content)
                                  ? "Preview video"
                                  : "Preview image"
                              }
                            >
                              <FaEye className="h-4 w-4" />
                            </button>
                          )}
                          {(isRemoteFile(item.content) ||
                            item.content.startsWith("data:")) && (
                            <button
                              onClick={() =>
                                onDownload(
                                  item.content,
                                  item.fileName ??
                                    getFileNameFromUrl(item.content),
                                  item.id,
                                )
                              }
                              disabled={downloadingIds.includes(item.id)}
                              className={`rounded-lg bg-slate-700/20 p-2 text-slate-200 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 hover:bg-slate-700 hover:text-white ${downloadingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                              title={
                                downloadingIds.includes(item.id)
                                  ? "Downloading..."
                                  : "Download file"
                              }
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
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="8"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="opacity-25"
                                  />
                                  <path d="M12 4v4" />
                                </svg>
                              ) : (
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
                                >
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <path d="M12 15V3" />
                                </svg>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(item.id)}
                            disabled={deletingIds.includes(item.id)}
                            className={`rounded-lg p-2 transition ${deletingIds.includes(item.id) ? "bg-red-600/20 text-red-200 cursor-not-allowed" : "bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white"} opacity-0 group-hover:opacity-100`}
                            title="Delete item"
                          >
                            {deletingIds.includes(item.id) ? (
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
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8"
                                  className="opacity-25"
                                />
                              </svg>
                            ) : (
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
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                <line x1="10" x2="10" y1="11" y2="17" />
                                <line x1="14" x2="14" y1="11" y2="17" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      {isVideoContent(item.content) ? (
                        <div className="w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/90 p-2">
                          <div
                            className="flex min-w-0 aspect-video w-full cursor-pointer items-center justify-center rounded-2xl bg-gray-900 transition hover:bg-slate-800 overflow-hidden"
                            onClick={() => setHistoryPreviewItem(item)}
                          >
                            <FaVideo className="h-10 w-10 text-slate-500" />
                          </div>
                          {item.fileName && (
                            <div className="mt-3 flex min-w-0 items-center gap-2 px-1 overflow-hidden">
                              {getFileIcon(item.content)}
                              <p className="min-w-0 truncate break-words text-sm text-slate-300">
                                {item.fileName}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : isImageContent(item.content) ? (
                        <div className="w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/90">
                          <div
                            className="relative aspect-video w-full cursor-pointer overflow-hidden bg-gray-900 transition hover:opacity-90"
                            onClick={() => setHistoryPreviewItem(item)}
                          >
                            <Image
                              src={getImageSrc(item.content)}
                              alt={item.fileName ?? "Clipboard image"}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                          {item.fileName && (
                            <div className="flex min-w-0 items-center gap-2 p-3 overflow-hidden border-t border-gray-800/50">
                              {getFileIcon(item.content)}
                              <p className="min-w-0 truncate break-words text-sm text-slate-300">
                                {item.fileName}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : isRemoteFile(item.content) ? (
                        <div className="w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 transition hover:bg-slate-900/80 sm:p-4">
                          <div className="flex min-w-0 items-center gap-3 overflow-hidden w-full">
                            <div className="flex h-10 w-10 shrink-0 min-w-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400">
                              {getFileIcon(item.content)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="min-w-0 truncate break-words text-sm font-medium text-slate-200">
                                {item.fileName ??
                                  getFileNameFromUrl(item.content)}
                              </p>
                              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {getFileType(item.content) ?? "FILE"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 sm:p-4">
                          <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-slate-500">
                              <FaFileAlt className="h-4 w-4" />
                            </div>
                            <p className="line-clamp-4 w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-slate-300">
                              {item.content || (
                                <span className="italic text-slate-600">
                                  (Empty)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      {(getFileType(item.content) ||
                        item.fileSize != null ||
                        getFileSize(item.content)) && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          {getFileType(item.content) && (
                            <span className="rounded-full bg-slate-800 px-2 py-1">
                              {getFileType(item.content)}
                            </span>
                          )}
                          {(item.fileSize != null ||
                            getFileSize(item.content)) && (
                            <span className="rounded-full bg-slate-800 px-2 py-1">
                              {item.fileSize != null
                                ? formatFileSize(item.fileSize)
                                : getFileSize(item.content)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <div className="h-4 w-4 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : !hasMore && history.length > 0 ? (
                <p className="text-slate-600 text-[10px] italic uppercase tracking-widest text-center w-full">
                  End of history
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}
