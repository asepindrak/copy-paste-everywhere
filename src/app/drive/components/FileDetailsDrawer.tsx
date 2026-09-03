"use client";

import { useState } from "react";
import {
  FaTimes,
  FaDownload,
  FaCopy,
  FaStar,
  FaRegStar,
  FaTrash,
  FaFolder,
  FaCalendarAlt,
  FaHdd,
  FaUser,
  FaEye,
  FaCheck,
} from "react-icons/fa";
import { DriveFileItem } from "../types";
import { formatBytes } from "@/lib/driveUtils";

interface FileDetailsDrawerProps {
  file: DriveFileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPreview: (file: DriveFileItem) => void;
  onToggleStar: (file: DriveFileItem) => void;
  onTrash: (file: DriveFileItem) => void;
  onToast: (msg: string) => void;
}

export default function FileDetailsDrawer({
  file,
  isOpen,
  onClose,
  onPreview,
  onToggleStar,
  onTrash,
  onToast,
}: FileDetailsDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !file) return null;

  const downloadUrl = `/api/drive/files/${file.id}/download?download=true`;
  const streamUrl = `/api/drive/files/${file.id}/download`;

  const handleCopyLink = async () => {
    const fullUrl = `${window.location.origin}${streamUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    onToast("File link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 border-l border-slate-800/80 bg-[#0a101b]/95 backdrop-blur-xl shadow-2xl p-5 flex flex-col justify-between overflow-y-auto animate-slideLeft">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            File Details
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        {/* Thumbnail Preview Card */}
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
          {file.category === "image" ? (
            <div className="h-44 w-full overflow-hidden rounded-xl bg-black/40 flex items-center justify-center">
              <img
                src={streamUrl}
                alt={file.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-32 w-full flex items-center justify-center text-4xl text-sky-400">
              📁
            </div>
          )}
          <p className="mt-3 truncate text-sm font-semibold text-white" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => onPreview(file)}
              className="flex items-center gap-1.5 rounded-xl bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 transition"
            >
              <FaEye className="h-3 w-3" /> Preview
            </button>
            <a
              href={downloadUrl}
              download={file.name}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition"
            >
              <FaDownload className="h-3 w-3" /> Download
            </a>
          </div>
        </div>

        {/* Details List */}
        <div className="mt-6 space-y-3.5 text-xs">
          <div className="flex items-start justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2">
              <FaHdd className="text-slate-500" /> Type
            </span>
            <span className="font-mono text-slate-200 uppercase">{file.mimeType}</span>
          </div>

          <div className="flex items-start justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2">
              <FaFolder className="text-slate-500" /> Location
            </span>
            <span className="text-slate-200 truncate max-w-[180px]">
              {file.folder?.name || "Root (My Drive)"}
            </span>
          </div>

          <div className="flex items-start justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2">
              <FaCalendarAlt className="text-slate-500" /> Uploaded
            </span>
            <span className="text-slate-200">
              {new Date(file.createdAt).toLocaleString()}
            </span>
          </div>

          <div className="flex items-start justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2">
              <FaCalendarAlt className="text-slate-500" /> Modified
            </span>
            <span className="text-slate-200">
              {new Date(file.updatedAt).toLocaleString()}
            </span>
          </div>

          <div className="flex items-start justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 flex items-center gap-2">
              <FaUser className="text-slate-500" /> Owner
            </span>
            <span className="text-slate-200">
              {file.user?.name || file.user?.email || "You"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-6 space-y-2 border-t border-slate-800 pt-4">
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          {copied ? <FaCheck className="text-emerald-400" /> : <FaCopy />}
          {copied ? "Link Copied!" : "Copy Direct Link"}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleStar(file)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition ${
              file.isStarred
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {file.isStarred ? <FaStar className="text-amber-400" /> : <FaRegStar />}
            {file.isStarred ? "Starred" : "Star"}
          </button>

          <button
            onClick={() => onTrash(file)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500 hover:text-white transition"
          >
            <FaTrash />
            {file.isTrash ? "Delete" : "Move to Trash"}
          </button>
        </div>
      </div>
    </div>
  );
}
