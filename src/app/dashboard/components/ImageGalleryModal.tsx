"use client";

import type { RefObject } from "react";
import Image from "next/image";
import {
  FaTimes,
  FaCopy,
  FaDownload,
  FaTrash,
  FaFileImage,
} from "react-icons/fa";
import type { CopyItem } from "../../../types/dashboard";

interface ImageGalleryModalProps {
  isOpen: boolean;
  searchValue: string;
  items: CopyItem[];
  previewImageIndex: number | null;
  copyingIds: string[];
  downloadingIds: string[];
  deletingIds: string[];
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onPreviewImageIndexChange: (index: number | null) => void;
  onCopy: (content: string, id?: string) => Promise<void>;
  onDownload: (
    content: string,
    fileName?: string | null,
    itemId?: string,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  getFileNameFromUrl: (url: string) => string;
  getFileType: (value: string) => string | null;
  getFileSize: (value: string) => string | null;
  getImageSrc: (src: string) => string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

export default function ImageGalleryModal({
  isOpen,
  searchValue,
  items,
  previewImageIndex,
  copyingIds,
  downloadingIds,
  deletingIds,
  isLoadingMore,
  hasMore,
  loadMoreRef,
  onClose,
  onSearchChange,
  onPreviewImageIndexChange,
  onCopy,
  onDownload,
  onDelete,
  getFileNameFromUrl,
  getFileType,
  getFileSize,
  getImageSrc,
}: ImageGalleryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[95vh] overflow-hidden rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-4 border-b border-slate-800 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Image Gallery
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Browse your copied images in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 sm:h-10 w-8 sm:w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white flex-shrink-0"
            aria-label="Close image gallery"
          >
            <FaTimes className="h-3 sm:h-4 w-3 sm:h-4" />
          </button>
        </div>

        <div className="border-b border-slate-800 bg-slate-950/80 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search images..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-200 outline-none transition focus:border-blue-500/50 focus:ring-blue-500/10"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid gap-3 sm:gap-4 p-3 sm:p-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center text-slate-400 col-span-full">
                No images match your search.
              </div>
            ) : (
              <>
                {items.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-950 p-2 sm:p-4 w-full overflow-hidden"
                  >
                    {(() => {
                      const fileType = getFileType(item.content);
                      return (
                        <div className="mb-2 sm:mb-3 flex items-start gap-2 sm:gap-3 min-w-0">
                          <div className="flex h-8 sm:h-10 w-8 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-blue-600/10 text-blue-400">
                            <FaFileImage className="h-4 sm:h-5 w-4 sm:w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs sm:text-sm font-semibold text-white">
                              {item.fileName ??
                                getFileNameFromUrl(item.content)}
                            </p>
                            <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                              {item.user
                                ? item.user.name || item.user.email
                                : "Unknown user"}
                            </p>
                            <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">
                              {(fileType || "IMAGE") + " · "}
                              {item.fileSize != null
                                ? formatFileSize(item.fileSize)
                                : "Unknown size"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="overflow-hidden rounded-lg sm:rounded-2xl border border-slate-800 bg-slate-900 w-full">
                      <button
                        type="button"
                        onClick={() => onPreviewImageIndexChange(index)}
                        className="group block h-32 sm:h-48 w-full overflow-hidden"
                        title="Preview image"
                      >
                        <Image
                          src={getImageSrc(item.content)}
                          alt={item.fileName ?? "Gallery image"}
                          width={600}
                          height={400}
                          unoptimized
                          className="h-full w-full object-contain transition duration-150 ease-in-out group-hover:scale-[1.01]"
                        />
                      </button>
                    </div>
                    <div className="mt-2 sm:mt-4 flex items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => onCopy(item.content, item.id)}
                        disabled={copyingIds.includes(item.id)}
                        className={`inline-flex h-8 sm:h-10 w-8 sm:w-10 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500 ${copyingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                        title={
                          copyingIds.includes(item.id)
                            ? "Copying..."
                            : "Copy image"
                        }
                        aria-label="Copy image"
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
                            <circle
                              cx="12"
                              cy="12"
                              r="8"
                              className="opacity-25"
                            />
                            <path d="M12 4v4" />
                          </svg>
                        ) : (
                          <FaCopy className="h-3 sm:h-4 w-3 sm:w-4" />
                        )}
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
                        className={`inline-flex h-8 sm:h-10 w-8 sm:w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-200 transition hover:bg-slate-900 ${downloadingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                        title={
                          downloadingIds.includes(item.id)
                            ? "Downloading..."
                            : "Download image"
                        }
                        aria-label="Download image"
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
                            <circle
                              cx="12"
                              cy="12"
                              r="8"
                              className="opacity-25"
                            />
                            <path d="M12 4v4" />
                          </svg>
                        ) : (
                          <FaDownload className="h-3 sm:h-4 w-3 sm:w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        disabled={deletingIds.includes(item.id)}
                        className={`inline-flex h-8 sm:h-10 w-8 sm:w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-300 transition hover:bg-red-600/10 hover:text-white ${deletingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                        title={
                          deletingIds.includes(item.id)
                            ? "Deleting..."
                            : "Delete image"
                        }
                        aria-label="Delete image"
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
                            <path d="M12 4v4" />
                          </svg>
                        ) : (
                          <FaTrash className="h-3 sm:h-4 w-3 sm:w-4 text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div ref={loadMoreRef} className="py-3 sm:py-4 flex justify-center">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
                <div className="h-4 w-4 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
                Loading more images...
              </div>
            ) : hasMore ? (
              <p className="text-slate-500 text-xs sm:text-sm">
                Scroll to load more images.
              </p>
            ) : (
              <p className="text-slate-500 text-xs sm:text-sm">
                End of image gallery.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
