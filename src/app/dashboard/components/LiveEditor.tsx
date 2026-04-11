"use client";

import Image from "next/image";
import { FaEdit } from "react-icons/fa";
import { useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import type { CopyItem } from "../../../types/dashboard";

interface LiveEditorProps {
  content: string;
  contentType: "text" | "image" | "video";
  copied: boolean;
  pasted: boolean;
  cleared: boolean;
  isSaving: boolean;
  isUploading: boolean;
  uploadProgress: number;
  currentFileName: string | null;
  currentFileSize: string | null;
  isDragActive: boolean;
  onCopyAll: () => void | Promise<void>;
  onPaste: () => void | Promise<void>;
  onClear: () => void;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onPasteEvent: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
  downloadContent: (
    value: string,
    fileName?: string | null,
    itemId?: string,
  ) => Promise<void>;
  getImageSrc: (src: string) => string;
  getFileNameFromUrl: (url: string) => string;
  getFileType: (value: string) => string | null;
  isRemoteFile: (value: string) => boolean;
  isLocalPath: (value: string) => boolean;
  isVideoContent: (value: string) => boolean;
}

export default function LiveEditor({
  content,
  contentType,
  copied,
  pasted,
  cleared,
  isSaving,
  isUploading,
  uploadProgress,
  currentFileName,
  currentFileSize,
  isDragActive,
  onCopyAll,
  onPaste,
  onClear,
  onChange,
  onPasteEvent,
  onDragOver,
  onDragLeave,
  onDrop,
  downloadContent,
  getImageSrc,
  getFileNameFromUrl,
  getFileType,
  isRemoteFile,
  isLocalPath,
  isVideoContent,
}: LiveEditorProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!content || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadContent(content, currentFileName);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="lg:col-span-2 space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl min-h-[600px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FaEdit className="h-5 w-5 text-blue-400" /> Live Editor
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-950 rounded-2xl p-1 border border-slate-800 mr-2">
              <button
                onClick={onCopyAll}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${copied ? "text-emerald-400 bg-emerald-500/10" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}
                title={contentType === "image" ? "Copy image" : "Copy all text"}
              >
                {copied ? (
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
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
                {copied
                  ? "Copied!"
                  : contentType === "image"
                    ? "Copy Image"
                    : "Copy All"}
              </button>
              <div className="w-px h-4 bg-slate-800 self-center" />
              <button
                onClick={onPaste}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${pasted ? "text-emerald-400 bg-emerald-500/10" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}
                title="Paste and replace all text"
              >
                {pasted ? (
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
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  </svg>
                )}
                {pasted ? "Pasted!" : "Paste"}
              </button>
              <div className="w-px h-4 bg-slate-800 self-center" />
              <button
                onClick={onClear}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${cleared ? "text-emerald-400 bg-emerald-500/10" : "text-slate-300 hover:text-red-400 hover:bg-red-500/10"}`}
                title="Clear editor"
              >
                {cleared ? (
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
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                )}
                {cleared ? "Cleared!" : "Clear"}
              </button>
            </div>
            {isSaving && (
              <span className="text-xs text-blue-400 animate-pulse font-medium">
                Saving...
              </span>
            )}
            {isUploading && (
              <div className="ml-4 flex min-w-[180px] flex-col gap-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Uploading {uploadProgress}%
                </span>
              </div>
            )}
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
              Auto-save
            </span>
          </div>
        </div>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative min-h-[400px] w-full overflow-hidden rounded-2xl border p-6 transition ${isDragActive ? "border-blue-400 bg-slate-900" : "border-slate-800 bg-slate-950"}`}
        >
          {contentType === "image" ? (
            <div className="flex flex-col items-center justify-center text-center">
              {isLocalPath(content) ? (
                <div className="flex min-h-[340px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-yellow-200/90 shadow-inner">
                  <div className="rounded-full bg-yellow-500/20 p-4 text-yellow-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xl font-bold text-white">
                      Local file path detected
                    </p>
                    <p className="mx-auto max-w-md text-sm leading-relaxed opacity-80">
                      You pasted a file path:{" "}
                      <code className="rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-blue-300">
                        {content}
                      </code>
                    </p>
                    <p className="mx-auto max-w-md text-sm opacity-80">
                      Web browsers cannot access local files directly via path
                      strings for security reasons.
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                      <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-300 border border-blue-500/30">
                        <span>⌨️</span>
                        <span>
                          Press{" "}
                          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs">
                            Ctrl+V
                          </kbd>{" "}
                          directly on the file in your explorer
                        </span>
                      </div>
                      <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 border border-emerald-500/30">
                        <span>🖱️</span>
                        <span>Drag and drop the file here to upload it</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Image
                    src={getImageSrc(content)}
                    alt="Pasted clipboard image"
                    width={800}
                    height={600}
                    unoptimized
                    className="max-h-[340px] w-full rounded-2xl object-contain"
                  />
                  <p className="mt-4 text-sm text-slate-400">
                    Image detected. Use the Paste button to replace the image or
                    Clear to reset.
                  </p>
                  {isRemoteFile(content) && (
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDownloading ? (
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
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      )}
                      {isDownloading ? "Downloading..." : "Download Image"}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : contentType === "video" && isVideoContent(content) ? (
            <div className="flex min-h-[400px] w-full flex-col justify-center rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-300">
              {isLocalPath(content) ? (
                <div className="flex min-h-[340px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-yellow-200/90 shadow-inner">
                  <div className="rounded-full bg-yellow-500/20 p-4 text-yellow-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xl font-bold text-white">
                      Local video path detected
                    </p>
                    <p className="mx-auto max-w-md text-sm leading-relaxed opacity-80">
                      File path:{" "}
                      <code className="rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-blue-300">
                        {content}
                      </code>
                    </p>
                    <p className="mx-auto max-w-md text-sm opacity-80">
                      Please drag and drop the video file here to upload it.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    controls
                    className="max-h-[340px] w-full rounded-2xl bg-black object-contain"
                  >
                    <source src={content} />
                    Your browser does not support the video tag.
                  </video>
                  <div className="mt-4 text-sm text-slate-400">
                    Video pasted successfully. Use the Paste button to replace
                    it or Clear to reset.
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? (
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
                        className="animate-spin"
                      >
                        <circle cx="12" cy="12" r="8" className="opacity-25" />
                        <path d="M12 4v4" />
                      </svg>
                    ) : (
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
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    )}
                    {isDownloading ? "Downloading..." : "Download Video"}
                  </button>
                </>
              )}
            </div>
          ) : isRemoteFile(content) ? (
            <div className="flex min-h-[400px] w-full flex-col justify-center rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-300">
              <div className="mb-4 text-sm text-slate-400">
                File uploaded successfully.
              </div>
              <div className="mb-3 flex items-center justify-center gap-2">
                <p className="font-semibold text-white">
                  {currentFileName || getFileNameFromUrl(content)}
                </p>
                {getFileType(content) && (
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {getFileType(content)}
                  </span>
                )}
                {currentFileSize && (
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {currentFileSize}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {getFileNameFromUrl(content)}
              </p>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
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
                    className="animate-spin"
                  >
                    <circle cx="12" cy="12" r="8" className="opacity-25" />
                    <path d="M12 4v4" />
                  </svg>
                ) : (
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
                {isDownloading ? "Downloading..." : "Download File"}
              </button>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={onChange}
              onPaste={onPasteEvent}
              id="live-editor-textarea"
              placeholder="Write or paste text here, or drag & drop a file..."
              className="min-h-[400px] w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-6 text-lg text-slate-200 placeholder-slate-600 outline-none transition focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 shadow-inner custom-scrollbar"
            />
          )}
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-blue-500/20 text-blue-100 text-sm font-semibold">
              Drop file here to upload
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
