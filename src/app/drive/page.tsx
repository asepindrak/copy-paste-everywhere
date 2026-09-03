"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FaFolder,
  FaFolderPlus,
  FaFileUpload,
  FaFolderOpen,
  FaStar,
  FaRegStar,
  FaClock,
  FaTrash,
  FaHdd,
  FaThLarge,
  FaList,
  FaSortAmountDown,
  FaEllipsisV,
  FaDownload,
  FaEye,
  FaInfoCircle,
  FaChevronRight,
  FaFileAlt,
  FaFileImage,
  FaFileVideo,
  FaFileAudio,
  FaFileArchive,
  FaFileCode,
  FaPlus,
  FaRedo,
  FaCheckCircle,
  FaSpinner,
  FaArrowLeft,
  FaTimes,
  FaExchangeAlt,
} from "react-icons/fa";
import DriveNavbar from "./components/DriveNavbar";
import CreateFolderModal from "./components/CreateFolderModal";
import FilePreviewModal from "./components/FilePreviewModal";
import MoveItemModal from "./components/MoveItemModal";
import FileDetailsDrawer from "./components/FileDetailsDrawer";
import {
  DriveFolderItem,
  DriveFileItem,
  BreadcrumbItem,
  DriveStats,
  ViewMode,
  DriveFilter,
  SortBy,
  SortOrder,
  TimeGroup,
} from "./types";
import { formatBytes } from "@/lib/driveUtils";

const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  this_month: "This Month",
  older: "Earlier",
};

export default function DrivePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State: Navigation & Scoping
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "My Drive" },
  ]);

  // State: View, Filter & Sort
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<DriveFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [groupByTime, setGroupByTime] = useState(true);

  // State: Data
  const [folders, setFolders] = useState<DriveFolderItem[]>([]);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [stats, setStats] = useState<DriveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // State: Modals & Panels
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<DriveFolderItem | null>(null);
  const [activePreviewFile, setActivePreviewFile] = useState<DriveFileItem | null>(null);
  const [moveItem, setMoveItem] = useState<{
    item: DriveFolderItem | DriveFileItem;
    type: "folder" | "file";
  } | null>(null);
  const [detailsFile, setDetailsFile] = useState<DriveFileItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  // State: Upload
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check auth
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setIsNewMenuOpen(false);
      }
      setActiveMenuId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Fetch workspaces
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/workspaces")
      .then((res) => res.json())
      .then((data) => {
        if (data.workspaces) {
          setWorkspaces(data.workspaces);
        }
      })
      .catch((err) => console.error("Error fetching workspaces:", err));
  }, [status]);

  // Fetch folders and files
  const fetchData = useCallback(async () => {
    if (status !== "authenticated") return;
    setIsLoading(true);

    try {
      // 1. Fetch Folders
      const folderParams = new URLSearchParams({
        ...(selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {}),
        ...(filter === "trash" ? { isTrash: "true" } : {}),
        ...(filter === "starred" ? { isStarred: "true" } : {}),
        ...(search ? { search } : {}),
      });

      if (!search && filter !== "trash" && filter !== "starred" && filter === "all") {
        if (currentFolderId) {
          folderParams.set("parentId", currentFolderId);
        } else {
          folderParams.set("parentId", "root");
        }
      }

      const foldersRes = await fetch(`/api/drive/folders?${folderParams.toString()}`);
      const foldersData = await foldersRes.json();

      if (foldersData.folders) {
        setFolders(foldersData.folders);
        if (foldersData.breadcrumbs) {
          setBreadcrumbs(foldersData.breadcrumbs);
        }
      }

      // 2. Fetch Files
      const fileParams = new URLSearchParams({
        ...(selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {}),
        filter,
        search,
        sortBy,
        sortOrder,
        ...(currentFolderId ? { folderId: currentFolderId } : {}),
      });

      const filesRes = await fetch(`/api/drive/files?${fileParams.toString()}`);
      const filesData = await filesRes.json();

      if (filesData.files) {
        setFiles(filesData.files);
      }

      // 3. Fetch Stats
      const statsParams = new URLSearchParams(
        selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {}
      );
      const statsRes = await fetch(`/api/drive/stats?${statsParams.toString()}`);
      const statsData = await statsRes.json();
      if (!statsData.error) {
        setStats(statsData);
      }
    } catch (err) {
      console.error("Failed to load drive data:", err);
      showToast("Failed to load drive content");
    } finally {
      setIsLoading(false);
    }
  }, [status, selectedWorkspaceId, currentFolderId, filter, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset folder when switching filters
  const handleFilterChange = (newFilter: DriveFilter) => {
    setFilter(newFilter);
    setCurrentFolderId(null);
    setBreadcrumbs([
      { id: null, name: selectedWorkspaceId ? "Workspace Drive" : "My Drive" },
    ]);
  };

  // Upload handler
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    setUploadMessage(`Uploading ${fileList.length} file(s)...`);

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append("files", fileList[i]);
    }
    if (currentFolderId) {
      formData.append("folderId", currentFolderId);
    }
    if (selectedWorkspaceId) {
      formData.append("workspaceId", selectedWorkspaceId);
    }

    try {
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        body: formData,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned HTTP ${res.status} (${res.statusText || "Error"})`);
      }
      if (!res.ok) {
        console.error("Drive upload error response:", res.status, res.statusText, data);
        const errMsg =
          data.error ||
          (data && Object.keys(data).length > 0
            ? JSON.stringify(data)
            : `HTTP ${res.status} ${res.statusText || "Internal Server Error"}`);
        throw new Error(errMsg);
      }

      showToast(`Successfully uploaded ${data.files?.length || 1} file(s)`);
      fetchData();
    } catch (err: any) {
      console.error("Drive upload error:", err);
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Folder Actions
  const handleCreateOrRenameFolder = async (name: string, color: string | null) => {
    if (folderToRename) {
      const res = await fetch("/api/drive/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderToRename.id, name, color }),
      });
      if (!res.ok) throw new Error("Failed to rename folder");
      showToast("Folder renamed");
    } else {
      const res = await fetch("/api/drive/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color,
          parentId: currentFolderId,
          workspaceId: selectedWorkspaceId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create folder");
      showToast("Folder created");
    }
    setFolderToRename(null);
    fetchData();
  };

  const handleFolderTrash = async (folder: DriveFolderItem) => {
    try {
      if (filter === "trash") {
        // Permanent delete
        const res = await fetch(`/api/drive/folders?id=${folder.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete folder");
        showToast("Folder deleted permanently");
      } else {
        // Move to trash
        const res = await fetch("/api/drive/folders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: folder.id, isTrash: true }),
        });
        if (!res.ok) throw new Error("Failed to move folder to trash");
        showToast("Folder moved to trash");
      }
      fetchData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleFolderRestore = async (folder: DriveFolderItem) => {
    try {
      const res = await fetch("/api/drive/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folder.id, isTrash: false }),
      });
      if (!res.ok) throw new Error("Failed to restore folder");
      showToast("Folder restored");
      fetchData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleFolderToggleStar = async (folder: DriveFolderItem) => {
    try {
      const res = await fetch("/api/drive/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folder.id, isStarred: !folder.isStarred }),
      });
      if (!res.ok) throw new Error("Failed to update star");
      showToast(folder.isStarred ? "Removed from Starred" : "Added to Starred");
      fetchData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // File Actions
  const handleFileTrash = async (file: DriveFileItem) => {
    try {
      if (filter === "trash") {
        // Permanent delete
        const res = await fetch(`/api/drive/files?id=${file.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete file");
        showToast("File deleted permanently");
        if (detailsFile?.id === file.id) setDetailsFile(null);
      } else {
        // Move to trash
        const res = await fetch("/api/drive/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: file.id, isTrash: true }),
        });
        if (!res.ok) throw new Error("Failed to move file to trash");
        showToast("File moved to trash");
        if (detailsFile?.id === file.id) setDetailsFile(null);
      }
      fetchData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleFileRestore = async (file: DriveFileItem) => {
    try {
      const res = await fetch("/api/drive/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id, isTrash: false }),
      });
      if (!res.ok) throw new Error("Failed to restore file");
      showToast("File restored");
      fetchData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleFileToggleStar = async (file: DriveFileItem) => {
    try {
      const res = await fetch("/api/drive/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id, isStarred: !file.isStarred }),
      });
      if (!res.ok) throw new Error("Failed to update star");
      showToast(file.isStarred ? "Removed from Starred" : "Added to Starred");
      fetchData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleMoveTarget = async (targetFolderId: string | null) => {
    if (!moveItem) return;

    const endpoint = moveItem.type === "folder" ? "/api/drive/folders" : "/api/drive/files";
    const bodyKey = moveItem.type === "folder" ? "parentId" : "folderId";

    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: moveItem.item.id, [bodyKey]: targetFolderId }),
    });

    if (!res.ok) throw new Error("Failed to move item");
    showToast(`Moved "${moveItem.item.name}"`);
    setMoveItem(null);
    fetchData();
  };

  // Helper for file icons
  const renderFileIcon = (file: DriveFileItem) => {
    switch (file.category) {
      case "image":
        return <FaFileImage className="h-5 w-5 text-emerald-400 flex-shrink-0" />;
      case "video":
        return <FaFileVideo className="h-5 w-5 text-purple-400 flex-shrink-0" />;
      case "audio":
        return <FaFileAudio className="h-5 w-5 text-amber-400 flex-shrink-0" />;
      case "code":
        return <FaFileCode className="h-5 w-5 text-sky-400 flex-shrink-0" />;
      case "archive":
        return <FaFileArchive className="h-5 w-5 text-rose-400 flex-shrink-0" />;
      default:
        return <FaFileAlt className="h-5 w-5 text-slate-400 flex-shrink-0" />;
    }
  };

  // Group files by time
  const groupedFiles = files.reduce((acc, file) => {
    const group = file.timeGroup || "older";
    if (!acc[group]) acc[group] = [];
    acc[group].push(file);
    return acc;
  }, {} as Record<TimeGroup, DriveFileItem[]>);

  const timeOrder: TimeGroup[] = ["today", "yesterday", "this_week", "this_month", "older"];

  return (
    <div
      className="min-h-screen bg-[#060b12] text-slate-100 font-sans flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File / Folder Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files);
        }}
      />
      <input
        type="file"
        ref={folderInputRef}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files);
        }}
      />

      {/* Top Navbar */}
      <DriveNavbar
        search={search}
        onSearchChange={setSearch}
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        onWorkspaceChange={(id) => {
          setSelectedWorkspaceId(id);
          setCurrentFolderId(null);
        }}
      />

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/80 backdrop-blur-md border-4 border-dashed border-sky-400 p-8 pointer-events-none animate-fadeIn">
          <div className="flex flex-col items-center text-center">
            <FaFileUpload className="h-16 w-16 text-sky-400 animate-bounce" />
            <h2 className="mt-4 text-xl font-bold text-white">
              Drop files here to upload
            </h2>
            <p className="mt-1 text-sm text-sky-200">
              Files will be saved into {breadcrumbs[breadcrumbs.length - 1]?.name || "Drive"}
            </p>
          </div>
        </div>
      )}

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex pt-16 sm:pt-14 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-slate-800/80 bg-[#070d17]/80 p-4 select-none">
          <div className="space-y-6">
            {/* New Button with Dropdown */}
            <div className="relative" ref={newMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsNewMenuOpen(!isNewMenuOpen);
                }}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-400 transition"
              >
                <FaPlus className="h-4 w-4" />
                <span>New</span>
              </button>

              {isNewMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-slate-700 bg-[#0c1320] shadow-2xl z-50 py-1.5 animate-fadeIn">
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      setFolderToRename(null);
                      setIsCreateFolderOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
                  >
                    <FaFolderPlus className="h-4 w-4 text-sky-400" />
                    New Folder
                  </button>
                  <div className="h-px bg-slate-800 my-1" />
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
                  >
                    <FaFileUpload className="h-4 w-4 text-emerald-400" />
                    Upload File(s)
                  </button>
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      folderInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
                  >
                    <FaFolderOpen className="h-4 w-4 text-amber-400" />
                    Upload Folder
                  </button>
                </div>
              )}
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              <button
                onClick={() => handleFilterChange("all")}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                  filter === "all"
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <FaFolder className="h-4 w-4 text-sky-400" />
                <span>{selectedWorkspaceId ? "Workspace Drive" : "My Drive"}</span>
              </button>

              <button
                onClick={() => handleFilterChange("starred")}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                  filter === "starred"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <FaStar className="h-4 w-4 text-amber-400" />
                <span>Starred</span>
              </button>

              <button
                onClick={() => handleFilterChange("recent")}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                  filter === "recent"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <FaClock className="h-4 w-4 text-purple-400" />
                <span>Recent</span>
              </button>

              <button
                onClick={() => handleFilterChange("trash")}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                  filter === "trash"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <FaTrash className="h-4 w-4 text-red-400" />
                <span>Trash</span>
              </button>
            </nav>

            {/* Quick File Categories */}
            <div>
              <p className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Categories
              </p>
              <div className="space-y-0.5">
                {[
                  { id: "image", label: "Images", icon: FaFileImage, color: "text-emerald-400" },
                  { id: "document", label: "Documents", icon: FaFileAlt, color: "text-blue-400" },
                  { id: "video", label: "Videos", icon: FaFileVideo, color: "text-purple-400" },
                  { id: "audio", label: "Audio", icon: FaFileAudio, color: "text-amber-400" },
                  { id: "archive", label: "Archives", icon: FaFileArchive, color: "text-rose-400" },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isCurrent = filter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleFilterChange(cat.id as DriveFilter)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
                        isCurrent
                          ? "bg-slate-800 text-white font-semibold"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Storage Meter Widget */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-2">
              <FaHdd className="text-sky-400" />
              <span>Storage Usage</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                style={{
                  width: stats ? `${Math.min(100, Math.max(5, (stats.totalBytes / (5 * 1024 ** 3)) * 100))}%` : "5%",
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>{stats?.totalBytesFormatted || "0 B"} used</span>
              <span>{stats?.totalFiles || 0} files</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {/* Breadcrumbs & Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs sm:text-sm">
              {breadcrumbs.map((b, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <div key={b.id || "root"} className="flex items-center gap-1.5 flex-shrink-0">
                    {idx > 0 && <FaChevronRight className="h-2.5 w-2.5 text-slate-600" />}
                    <button
                      disabled={isLast}
                      onClick={() => setCurrentFolderId(b.id)}
                      className={`font-medium transition ${
                        isLast
                          ? "text-white font-semibold cursor-default"
                          : "text-slate-400 hover:text-sky-400"
                      }`}
                    >
                      {b.name}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Controls: View Mode, Time-grouping, Sort */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* Group by Time Toggle */}
              <button
                onClick={() => setGroupByTime(!groupByTime)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  groupByTime
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
                title="Group files by time (Today, Yesterday, Older)"
              >
                <FaClock className="h-3 w-3" />
                <span className="hidden sm:inline">Timeline</span>
              </button>

              {/* View Mode Toggle: Grid vs List */}
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "grid"
                      ? "bg-slate-800 text-sky-400 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Grid View"
                >
                  <FaThLarge className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "list"
                      ? "bg-slate-800 text-sky-400 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="List View"
                >
                  <FaList className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="Sort Files By"
                className="rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 focus:border-sky-500 focus:outline-none"
              >
                <option value="updatedAt">Modified</option>
                <option value="createdAt">Uploaded</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
              </select>

              {/* Sort Order Toggle */}
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition"
                title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
              >
                <FaSortAmountDown className={`h-3 w-3 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
              </button>

              {/* Refresh */}
              <button
                onClick={fetchData}
                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition"
                title="Refresh"
              >
                <FaRedo className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Quick Action Mobile Bar (visible on small screens) */}
          <div className="flex lg:hidden items-center gap-2 py-3 border-b border-slate-800">
            <button
              onClick={() => {
                setFolderToRename(null);
                setIsCreateFolderOpen(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-500/20 py-2 text-xs font-medium text-sky-400 border border-sky-500/30"
            >
              <FaFolderPlus /> New Folder
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 py-2 text-xs font-medium text-emerald-400 border border-emerald-500/30"
            >
              <FaFileUpload /> Upload File
            </button>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <FaSpinner className="h-6 w-6 animate-spin mr-3 text-sky-400" />
              <span>Loading Drive content...</span>
            </div>
          )}

          {!isLoading && folders.length === 0 && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800/80 text-3xl text-slate-500 border border-slate-700">
                📂
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {filter === "trash"
                  ? "Trash is empty"
                  : filter === "starred"
                  ? "No starred items"
                  : search
                  ? `No results for "${search}"`
                  : "This folder is empty"}
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                {filter === "all" && !search
                  ? "Drag & drop files here or click '+ New' to upload your first file or create a folder."
                  : "Items matching your criteria will appear here."}
              </p>
              {filter === "all" && !search && (
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => {
                      setFolderToRename(null);
                      setIsCreateFolderOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
                  >
                    <FaFolderPlus className="text-sky-400" /> New Folder
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-medium text-white hover:bg-sky-400 shadow-lg shadow-sky-500/25 transition"
                  >
                    <FaFileUpload /> Upload File
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Folders Section (Only shown when not filtering by mime categories or recent) */}
          {!isLoading && folders.length > 0 && (
            <div className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Folders ({folders.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {folders.map((folder) => {
                  const isMenuOpen = activeMenuId === `folder-${folder.id}`;
                  return (
                    <div
                      key={folder.id}
                      onDoubleClick={() => setCurrentFolderId(folder.id)}
                      className="group relative flex items-center justify-between rounded-2xl border border-slate-800/90 bg-slate-900/60 p-3 hover:border-slate-700 hover:bg-slate-800/80 transition cursor-pointer select-none"
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 flex-1"
                        onClick={() => setCurrentFolderId(folder.id)}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-white flex-shrink-0"
                          style={{ backgroundColor: folder.color || "#3b82f6" }}
                        >
                          <FaFolder className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white" title={folder.name}>
                            {folder.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {folder.filesCount || 0} item(s)
                          </p>
                        </div>
                      </div>

                      {/* Folder 3-dots Menu Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : `folder-${folder.id}`);
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white transition"
                        >
                          <FaEllipsisV className="h-3 w-3" />
                        </button>

                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-xl border border-slate-700 bg-[#0c1320] shadow-2xl z-40 py-1 text-xs animate-fadeIn"
                          >
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setCurrentFolderId(folder.id);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                              <FaFolderOpen className="text-sky-400" /> Open
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                handleFolderToggleStar(folder);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                              <FaStar className="text-amber-400" />
                              {folder.isStarred ? "Remove Star" : "Add Star"}
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setMoveItem({ item: folder, type: "folder" });
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                              <FaExchangeAlt className="text-indigo-400" /> Move to...
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setFolderToRename(folder);
                                setIsCreateFolderOpen(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                              <FaFolderPlus className="text-teal-400" /> Rename
                            </button>
                            <div className="h-px bg-slate-800 my-1" />
                            {folder.isTrash ? (
                              <>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleFolderRestore(folder);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-emerald-400 hover:bg-emerald-500/10"
                                >
                                  <FaRedo /> Restore
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleFolderTrash(folder);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10"
                                >
                                  <FaTrash /> Delete Permanently
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleFolderTrash(folder);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10"
                              >
                                <FaTrash /> Move to Trash
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files Section */}
          {!isLoading && files.length > 0 && (
            <div className="py-4 space-y-6">
              {groupByTime ? (
                // Grouped by Timeline
                timeOrder.map((groupKey) => {
                  const groupItems = groupedFiles[groupKey];
                  if (!groupItems || groupItems.length === 0) return null;

                  return (
                    <div key={groupKey} className="space-y-3">
                      <div className="flex items-center gap-2 pb-1 border-b border-slate-800/60">
                        <FaClock className="h-3 w-3 text-sky-400" />
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          {TIME_GROUP_LABELS[groupKey]} ({groupItems.length})
                        </h4>
                      </div>

                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
                          {groupItems.map((file) => renderGridFileCard(file))}
                        </div>
                      ) : (
                        renderListView(groupItems)
                      )}
                    </div>
                  );
                })
              ) : (
                // Flat file list
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Files ({files.length})
                  </p>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
                      {files.map((file) => renderGridFileCard(file))}
                    </div>
                  ) : (
                    renderListView(files)
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Upload Progress Toast */}
      {isUploading && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-sky-500/40 bg-slate-900/95 px-4 py-3 text-xs text-white shadow-2xl backdrop-blur-md animate-slideUp">
          <FaSpinner className="h-4 w-4 animate-spin text-sky-400" />
          <span>{uploadMessage}</span>
        </div>
      )}

      {/* General Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md animate-slideUp">
          <FaCheckCircle className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals & Drawers */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setFolderToRename(null);
        }}
        onSubmit={handleCreateOrRenameFolder}
        initialName={folderToRename?.name || ""}
        initialColor={folderToRename?.color || "#3b82f6"}
        isRename={!!folderToRename}
      />

      <FilePreviewModal
        file={activePreviewFile}
        isOpen={!!activePreviewFile}
        onClose={() => setActivePreviewFile(null)}
        onToast={showToast}
      />

      <MoveItemModal
        isOpen={!!moveItem}
        onClose={() => setMoveItem(null)}
        item={moveItem?.item || null}
        itemType={moveItem?.type || "file"}
        workspaceId={selectedWorkspaceId}
        onMove={handleMoveTarget}
      />

      <FileDetailsDrawer
        file={detailsFile}
        isOpen={!!detailsFile}
        onClose={() => setDetailsFile(null)}
        onPreview={(file) => setActivePreviewFile(file)}
        onToggleStar={handleFileToggleStar}
        onTrash={handleFileTrash}
        onToast={showToast}
      />
    </div>
  );

  // Helper: Render Grid File Card
  function renderGridFileCard(file: DriveFileItem) {
    const isMenuOpen = activeMenuId === `file-${file.id}`;
    const streamUrl = `/api/drive/files/${file.id}/download`;
    const downloadUrl = `/api/drive/files/${file.id}/download?download=true`;

    return (
      <div
        key={file.id}
        onDoubleClick={() => setActivePreviewFile(file)}
        onClick={() => setDetailsFile(file)}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-850 transition cursor-pointer select-none"
      >
        {/* Thumbnail area */}
        <div className="relative h-32 w-full overflow-hidden bg-slate-950/60 flex items-center justify-center">
          {file.category === "image" ? (
            <img
              src={streamUrl}
              alt={file.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-3">
              {renderFileIcon(file)}
              <span className="mt-2 text-[10px] uppercase font-mono text-slate-500">
                {file.mimeType.split("/")[1] || "FILE"}
              </span>
            </div>
          )}

          {/* Star Icon Badge */}
          {file.isStarred && (
            <div className="absolute top-2 left-2 rounded-lg bg-black/60 p-1 text-amber-400">
              <FaStar className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Info area */}
        <div className="p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {formatBytes(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* 3-dots Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(isMenuOpen ? null : `file-${file.id}`);
              }}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition"
            >
              <FaEllipsisV className="h-3 w-3" />
            </button>

            {isMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-1 w-44 overflow-hidden rounded-xl border border-slate-700 bg-[#0c1320] shadow-2xl z-40 py-1 text-xs animate-fadeIn"
              >
                <button
                  onClick={() => {
                    setActiveMenuId(null);
                    setActivePreviewFile(file);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <FaEye className="text-sky-400" /> Preview
                </button>
                <a
                  href={downloadUrl}
                  download={file.name}
                  onClick={() => setActiveMenuId(null)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <FaDownload className="text-emerald-400" /> Download
                </a>
                <button
                  onClick={() => {
                    setActiveMenuId(null);
                    handleFileToggleStar(file);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <FaStar className="text-amber-400" />
                  {file.isStarred ? "Remove Star" : "Add Star"}
                </button>
                <button
                  onClick={() => {
                    setActiveMenuId(null);
                    setMoveItem({ item: file, type: "file" });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <FaExchangeAlt className="text-indigo-400" /> Move to...
                </button>
                <button
                  onClick={() => {
                    setActiveMenuId(null);
                    setDetailsFile(file);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <FaInfoCircle className="text-teal-400" /> Details
                </button>
                <div className="h-px bg-slate-800 my-1" />
                {file.isTrash ? (
                  <>
                    <button
                      onClick={() => {
                        setActiveMenuId(null);
                        handleFileRestore(file);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <FaRedo /> Restore
                    </button>
                    <button
                      onClick={() => {
                        setActiveMenuId(null);
                        handleFileTrash(file);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10"
                    >
                      <FaTrash /> Delete Permanently
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      handleFileTrash(file);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10"
                  >
                    <FaTrash /> Move to Trash
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Helper: Render List View
  function renderListView(items: DriveFileItem[]) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/50">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-[10px] text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Owner</th>
              <th className="px-4 py-3 font-semibold hidden sm:table-cell">Modified</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {items.map((file) => {
              const downloadUrl = `/api/drive/files/${file.id}/download?download=true`;
              return (
                <tr
                  key={file.id}
                  onClick={() => setDetailsFile(file)}
                  onDoubleClick={() => setActivePreviewFile(file)}
                  className="hover:bg-slate-800/50 transition cursor-pointer select-none"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderFileIcon(file)}
                      <span className="truncate font-medium text-white max-w-xs sm:max-w-md" title={file.name}>
                        {file.name}
                      </span>
                      {file.isStarred && <FaStar className="h-3 w-3 text-amber-400 flex-shrink-0" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                    {file.user?.name || file.user?.email || "You"}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-slate-400">
                    {new Date(file.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {formatBytes(file.size)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActivePreviewFile(file)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        title="Preview"
                      >
                        <FaEye className="h-3 w-3" />
                      </button>
                      <a
                        href={downloadUrl}
                        download={file.name}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        title="Download"
                      >
                        <FaDownload className="h-3 w-3" />
                      </a>
                      <button
                        onClick={() => handleFileToggleStar(file)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition"
                        title="Star"
                      >
                        {file.isStarred ? <FaStar className="h-3 w-3 text-amber-400" /> : <FaRegStar className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => handleFileTrash(file)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                        title={file.isTrash ? "Delete Permanently" : "Move to Trash"}
                      >
                        <FaTrash className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
