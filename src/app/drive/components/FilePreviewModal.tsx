"use client";

import { useState, useEffect } from "react";
import {
  FaTimes,
  FaDownload,
  FaCopy,
  FaFileAlt,
  FaFilePdf,
  FaFileArchive,
  FaFileCode,
  FaExpand,
  FaCompress,
  FaCheck,
} from "react-icons/fa";
import { DriveFileItem } from "../types";
import { formatBytes } from "@/lib/driveUtils";

interface FilePreviewModalProps {
  file: DriveFileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export default function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onToast,
}: FilePreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent(null);
      setIsLoadingText(false);
      return;
    }

    if (file.category === "code" || file.mimeType.startsWith("text/")) {
      setIsLoadingText(true);
      fetch(`/api/drive/files/${file.id}/download`)
        .then((res) => res.text())
        .then((text) => {
          setTextContent(text.slice(0, 100000)); // cap preview at 100k chars
        })
        .catch(() => setTextContent("Failed to load text preview."))
        .finally(() => setIsLoadingText(false));
    } else {
      setTextContent(null);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const downloadUrl = `/api/drive/files/${file.id}/download?download=true`;
  const streamUrl = `/api/drive/files/${file.id}/download`;

  const handleCopyLink = async () => {
    const fullUrl = `${window.location.origin}${streamUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    onToast("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#090f19] shadow-2xl transition-all duration-200 ${
          isFullscreen ? "fixed inset-2 z-50" : "w-full max-w-5xl h-[85vh]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#060a12] px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1 pr-4">
            <h3 className="truncate text-sm font-medium text-white sm:text-base">
              {file.name}
            </h3>
            <p className="text-xs text-slate-400">
              {formatBytes(file.size)} • Uploaded {new Date(file.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Copy Link"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              {copied ? <FaCheck className="h-3.5 w-3.5 text-emerald-400" /> : <FaCopy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
            </button>

            <a
              href={downloadUrl}
              download={file.name}
              className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-sky-400 transition"
            >
              <FaDownload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="hidden sm:flex rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              {isFullscreen ? <FaCompress className="h-3.5 w-3.5" /> : <FaExpand className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="relative flex-1 overflow-auto bg-[#03060a] p-4 flex items-center justify-center">
          {file.category === "image" && (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-2">
              <img
                src={streamUrl}
                alt={file.name}
                className="max-h-full max-w-full rounded-lg object-contain shadow-xl"
              />
            </div>
          )}

          {file.category === "video" && (
            <div className="flex h-full w-full items-center justify-center p-2">
              <video
                src={streamUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-lg shadow-xl"
              />
            </div>
          )}

          {file.category === "audio" && (
            <div className="flex flex-col items-center justify-center gap-6 p-8">
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                <FaFileAlt className="h-12 w-12" />
              </div>
              <p className="text-base font-semibold text-white">{file.name}</p>
              <audio src={streamUrl} controls className="w-full max-w-md" />
            </div>
          )}

          {file.mimeType.includes("pdf") && (
            <iframe
              src={streamUrl}
              title={file.name}
              className="h-full w-full rounded-lg border border-slate-800 bg-white"
            />
          )}

          {(file.category === "code" || file.mimeType.startsWith("text/")) && !file.mimeType.includes("pdf") && (
            <div className="h-full w-full overflow-auto rounded-lg border border-slate-800 bg-[#0a0f18] p-4 font-mono text-xs text-slate-200">
              {isLoadingText ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  Loading preview...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap">{textContent}</pre>
              )}
            </div>
          )}

          {file.category === "archive" && (
            <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
                <FaFileArchive className="h-12 w-12" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Compressed archive ({formatBytes(file.size)})
                </p>
              </div>
              <a
                href={downloadUrl}
                download={file.name}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-medium text-white shadow hover:bg-sky-400 transition"
              >
                <FaDownload /> Download Archive
              </a>
            </div>
          )}

          {file.category === "other" && !file.mimeType.includes("pdf") && (
            <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-800 text-slate-400 ring-1 ring-slate-700">
                <FaFileAlt className="h-12 w-12" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  No preview available for this file type ({file.mimeType})
                </p>
              </div>
              <a
                href={downloadUrl}
                download={file.name}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-medium text-white shadow hover:bg-sky-400 transition"
              >
                <FaDownload /> Download File ({formatBytes(file.size)})
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
