"use client";

import Image from "next/image";
import { FaImages, FaFileAlt, FaVideo, FaEye } from "react-icons/fa";
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
  setHistoryPreviewItem: (item: CopyItem | null) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  copiedHistoryId: string | null;
  copyingIds: string[];
  downloadingIds: string[];
  deletingIds: string[];
  isImageContent: (value: string) => boolean;
  isVideoContent: (value: string) => boolean;
  isRemoteFile: (value: string) => boolean;
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
  setHistoryPreviewItem,
  isLoadingMore,
  hasMore,
  loadMoreRef,
  copiedHistoryId,
  copyingIds,
  downloadingIds,
  deletingIds,
  isImageContent,
  isVideoContent,
  isRemoteFile,
  getImageSrc,
  getFileNameFromUrl,
  getFileType,
  getFileSize,
}: HistorySidebarProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  };
  return (
    <aside className="space-y-6 flex flex-col h-[600px]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl flex flex-col h-full overflow-hidden">
        <div className="mb-4">
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
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-blue-500/50 transition"
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
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
          {history.length === 0 && !isLoadingMore ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center mt-4">
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
                    className="group relative rounded-2xl border border-slate-800 bg-slate-950 p-4 transition hover:border-blue-500/30 hover:bg-slate-900/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-1 min-w-0 items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {new Date(item.createdAt).toLocaleDateString()}{" "}
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1 pl-3">
                        <button
                          onClick={() => onCopy(item.content, item.id)}
                          disabled={copyingIds.includes(item.id)}
                          className={`rounded-lg bg-blue-600/10 p-2 text-blue-400 opacity-0 transition group-hover:opacity-100 hover:bg-blue-600 hover:text-white ${copyingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
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
                            className="rounded-lg bg-slate-700/20 p-2 text-slate-200 opacity-0 transition group-hover:opacity-100 hover:bg-slate-700 hover:text-white"
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
                            className={`rounded-lg bg-slate-700/20 p-2 text-slate-200 opacity-0 transition group-hover:opacity-100 hover:bg-slate-700 hover:text-white ${downloadingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
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
                    {isImageContent(item.content) ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-2">
                        <Image
                          src={getImageSrc(item.content)}
                          alt="History image"
                          width={600}
                          height={400}
                          unoptimized
                          className="max-h-56 w-full rounded-2xl object-contain"
                        />
                        {item.fileName && (
                          <p className="mt-3 truncate text-sm text-slate-300">
                            {item.fileName}
                          </p>
                        )}
                      </div>
                    ) : isRemoteFile(item.content) ? (
                      <p className="text-sm text-slate-300 truncate break-words leading-relaxed">
                        {item.fileName ?? getFileNameFromUrl(item.content)}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-300 line-clamp-3 break-words leading-relaxed">
                        {item.content || (
                          <span className="italic text-slate-600">(Empty)</span>
                        )}
                      </p>
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
                <div className="h-4 w-4 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            ) : !hasMore && history.length > 0 ? (
              <p className="text-slate-600 text-[10px] italic uppercase tracking-widest text-center w-full">
                End of history
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </aside>
  );
}
