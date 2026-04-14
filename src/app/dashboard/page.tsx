"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { io, type Socket } from "socket.io-client";
import Select, { type SingleValue } from "react-select";
import {
  FaEdit,
  FaHistory,
  FaImages,
  FaFileAlt,
  FaCopy,
  FaDownload,
  FaTrash,
  FaChevronLeft,
  FaChevronRight,
  FaEye,
  FaSignOutAlt,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";
import Image from "next/image";
import packageJson from "../../../package.json";
import DashboardToast from "./components/DashboardToast";
import WorkspaceModal from "./components/WorkspaceModal";
import ClearAllModal from "./components/ClearAllModal";
import ImageGalleryModal from "./components/ImageGalleryModal";
import FileGalleryModal from "./components/FileGalleryModal";
import VideoGalleryModal from "./components/VideoGalleryModal";
import HistoryPreviewModal from "./components/HistoryPreviewModal";
import LiveEditor from "./components/LiveEditor";
import HistorySidebar from "./components/HistorySidebar";
import type { CopyItem, FetchHistoryResponse } from "../../types/dashboard";

interface ClipboardUpdateAck {
  item?: CopyItem;
  error?: string;
}

type ClipboardReadItem = {
  types: string[];
  getType(type: string): Promise<Blob>;
};

const MAX_UPLOAD_SIZE = 5 * 1024 ** 3; // 5 GB
const appVersion = packageJson.version;

const getExtensionFromUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    const fileName = parsed.pathname.split("/").pop();
    const extension = fileName?.split(".").pop();
    return extension ? extension.toLowerCase() : null;
  } catch {
    // Fallback for local file paths or strings that aren't valid URLs
    const fileName = value.split(/[/\\]/).pop();
    const extension = fileName?.split(".").pop();
    return extension ? extension.toLowerCase() : null;
  }
};

const isImageExtension = (extension: string | null) =>
  /^(png|jpe?g|gif|webp|avif|svg|bmp|tiff|ico|jfif)$/i.test(extension ?? "");

const isVideoExtension = (extension: string | null) =>
  /^(mp4|webm|ogg|mov|avi|mkv|m4v|flv|wmv)$/i.test(extension ?? "");

const isImageContent = (value: string) =>
  /^data:image\/[a-zA-Z]+;base64,/.test(value) ||
  isImageExtension(getExtensionFromUrl(value));

const isVideoContent = (value: string) =>
  /^data:video\/[a-zA-Z]+;base64,/.test(value) ||
  isVideoExtension(getExtensionFromUrl(value));

const isRemoteFile = (value: string) =>
  /^https?:\/\/.+\.[a-z0-9]+(\?.*)?$/i.test(value);

const isLocalPath = (value: string) =>
  !value.startsWith("data:") &&
  !value.startsWith("http://") &&
  !value.startsWith("https://") &&
  (value.startsWith("/") || /^[a-zA-Z]:[/\\]/.test(value));

const getFileNameFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const fileName = parsed.pathname.split("/").pop();
    return fileName || "download";
  } catch {
    return "download";
  }
};

const getImageSrc = (src: string) => src; // Use direct remote URLs for rendering previews; proxy is only needed for clipboard/download fetch operations.

const getDataUrlFileName = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,/);
  if (!match) return "download";
  const mime = match[1];
  const extension = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
  return `image.${extension}`;
};

const getFileType = (value: string) => {
  if (value.startsWith("data:")) {
    const match = value.match(/^data:([^;]+);base64,/);
    if (!match) return "FILE";
    const mime = match[1];
    const extension =
      mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
    return extension.toUpperCase();
  }

  if (isRemoteFile(value)) {
    try {
      const parsed = new URL(value);
      const fileName = parsed.pathname.split("/").pop();
      const extension = fileName?.split(".").pop();
      return extension ? extension.toUpperCase() : "FILE";
    } catch {
      return "FILE";
    }
  }

  return null;
};

const isFileContent = (value: string) =>
  !isImageContent(value) && isRemoteFile(value);

const getDataUrlSize = (dataUrl: string) => {
  const base64 = dataUrl.split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.round((base64.length * 3) / 4 - padding));
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const getFileSize = (value: string) => {
  if (value.startsWith("data:")) {
    return formatFileSize(getDataUrlSize(value));
  }
  return null;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

interface PendingInvite {
  id: string;
  workspace: { name: string };
  invitedBy: { name: string | null; email: string };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<"text" | "image" | "video">(
    "text",
  );
  const [history, setHistory] = useState<CopyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [pasted, setPasted] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [currentFileSize, setCurrentFileSize] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [workspaceInviteEmail, setWorkspaceInviteEmail] = useState("");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [workspaceCreateName, setWorkspaceCreateName] = useState("");
  const [workspaceUsers, setWorkspaceUsers] = useState<
    Record<string, { id: string; name?: string | null; email: string }>
  >({});

  const workspaceUsersRef = useRef<
    Record<string, { id: string; name?: string | null; email: string }>
  >({});

  const imageHistory = useMemo(
    () => history.filter((item) => isImageContent(item.content)),
    [history],
  );
  const fileHistory = useMemo(
    () => history.filter((item) => isFileContent(item.content)),
    [history],
  );
  const [imageGallerySearch, setImageGallerySearch] = useState("");
  const [fileGallerySearch, setFileGallerySearch] = useState("");
  const [imageGalleryItems, setImageGalleryItems] = useState<CopyItem[]>([]);
  const [imageGalleryCursor, setImageGalleryCursor] = useState<string | null>(
    null,
  );
  const [imageGalleryHasMore, setImageGalleryHasMore] = useState(true);
  const [isImageGalleryLoading, setIsImageGalleryLoading] = useState(false);
  const [isImageGalleryLoadingMore, setIsImageGalleryLoadingMore] =
    useState(false);
  const [fileGalleryItems, setFileGalleryItems] = useState<CopyItem[]>([]);
  const [fileGalleryCursor, setFileGalleryCursor] = useState<string | null>(
    null,
  );
  const [fileGalleryHasMore, setFileGalleryHasMore] = useState(true);
  const [isFileGalleryLoading, setIsFileGalleryLoading] = useState(false);
  const [isFileGalleryLoadingMore, setIsFileGalleryLoadingMore] =
    useState(false);
  const [videoGallerySearch, setVideoGallerySearch] = useState("");
  const [videoGalleryItems, setVideoGalleryItems] = useState<CopyItem[]>([]);
  const [videoGalleryCursor, setVideoGalleryCursor] = useState<string | null>(
    null,
  );
  const [videoGalleryHasMore, setVideoGalleryHasMore] = useState(true);
  const [isVideoGalleryLoading, setIsVideoGalleryLoading] = useState(false);
  const [isVideoGalleryLoadingMore, setIsVideoGalleryLoadingMore] =
    useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState<string | null>(null);
  const [isWorkspaceSaving, setIsWorkspaceSaving] = useState(false);
  const [isInviteSaving, setIsInviteSaving] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 2000);
  }, []);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [isFileGalleryOpen, setIsFileGalleryOpen] = useState(false);
  const [isVideoGalleryOpen, setIsVideoGalleryOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(
    null,
  );
  const [historyPreviewItem, setHistoryPreviewItem] = useState<CopyItem | null>(
    null,
  );
  const [clearAllConfirmation, setClearAllConfirmation] = useState("");
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [copyingIds, setCopyingIds] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  const [updatingTitleIds, setUpdatingTitleIds] = useState<string[]>([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  type WorkspaceOption = {
    value: string;
    label: string;
  };

  const activeWorkspaceName = selectedWorkspaceId
    ? (workspaces.find((workspace) => workspace.id === selectedWorkspaceId)
        ?.name ?? null)
    : null;

  const workspaceOptions = useMemo<WorkspaceOption[]>(
    () => [
      { value: "", label: "Personal clipboard" },
      ...workspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.name,
      })),
    ],
    [workspaces],
  );

  const selectedWorkspaceOption = useMemo<WorkspaceOption>(() => {
    return (
      workspaceOptions.find(
        (option) => option.value === (selectedWorkspaceId ?? ""),
      ) ?? workspaceOptions[0]
    );
  }, [workspaceOptions, selectedWorkspaceId]);

  const resetStates = useCallback(() => {
    // Reset History
    setHistory([]);
    setNextCursor(null);
    setHasMore(true);

    // Reset Gallery States
    setImageGalleryItems([]);
    setImageGalleryCursor(null);
    setImageGalleryHasMore(true);

    setFileGalleryItems([]);
    setFileGalleryCursor(null);
    setFileGalleryHasMore(true);

    setVideoGalleryItems([]);
    setVideoGalleryCursor(null);
    setVideoGalleryHasMore(true);

    // Reset Editor
    setContent("");
    setContentType("text");
    setCurrentFileName(null);
    setCurrentFileSize(null);
    setLastSavedAt(null);
    lastContentRef.current = "";
  }, []);

  const handleWorkspaceSelect = useCallback(
    (option: SingleValue<WorkspaceOption>) => {
      const nextId = option?.value ? option.value : null;
      if (nextId !== selectedWorkspaceIdRef.current) {
        resetStates();
        setSelectedWorkspaceId(nextId);
      }
    },
    [resetStates],
  );

  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Search and Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const previewImage =
    previewImageIndex !== null ? imageGalleryItems[previewImageIndex] : null;

  useEffect(() => {
    if (
      previewImageIndex !== null &&
      previewImageIndex >= imageGalleryItems.length
    ) {
      setPreviewImageIndex(null);
    }
  }, [imageGalleryItems.length, previewImageIndex]);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const imageGalleryObserverRef = useRef<IntersectionObserver | null>(null);
  const imageGalleryLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const fileGalleryObserverRef = useRef<IntersectionObserver | null>(null);
  const fileGalleryLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const videoGalleryObserverRef = useRef<IntersectionObserver | null>(null);
  const videoGalleryLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const imageGalleryLoadingMoreRef = useRef(isImageGalleryLoadingMore);
  const imageGalleryHasMoreRef = useRef(imageGalleryHasMore);
  const fileGalleryLoadingMoreRef = useRef(isFileGalleryLoadingMore);
  const fileGalleryHasMoreRef = useRef(fileGalleryHasMore);
  const videoGalleryLoadingMoreRef = useRef(isVideoGalleryLoadingMore);
  const videoGalleryHasMoreRef = useRef(videoGalleryHasMore);

  const socketRef = useRef<Socket | null>(null);
  const lastContentRef = useRef(content);
  const selectedWorkspaceIdRef = useRef<string | null>(selectedWorkspaceId);
  const currentJoinedWorkspaceIdRef = useRef<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSearchRef = useRef<string>(debouncedSearch);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const hasMoreRef = useRef(hasMore);

  const isAuthenticated = status === "authenticated";
  const ACTIVE_WORKSPACE_STORAGE_KEY = "activeWorkspaceId";

  const clearSelectedWorkspaceId = useCallback(() => {
    setSelectedWorkspaceId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
  }, [ACTIVE_WORKSPACE_STORAGE_KEY]);

  useEffect(() => {
    workspaceUsersRef.current = workspaceUsers;
  }, [workspaceUsers]);

  const loadWorkspaceUsers = useCallback(async (workspaceId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (!res.ok) {
        throw new Error("Failed to load workspace members.");
      }

      const data = await res.json();
      const users = data.users ?? [];
      const mapping = Object.fromEntries(
        users.map(
          (user: { id: string; name?: string | null; email: string }) => [
            user.id,
            user,
          ],
        ),
      );
      setWorkspaceUsers(mapping);
    } catch (error) {
      console.warn("Could not load workspace users:", error);
      setWorkspaceUsers({});
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!selectedWorkspaceId) {
      setWorkspaceUsers({});
      return;
    }

    loadWorkspaceUsers(selectedWorkspaceId);
  }, [isAuthenticated, loadWorkspaceUsers, selectedWorkspaceId]);

  useEffect(() => {
    const storedWorkspaceId = window.localStorage.getItem(
      ACTIVE_WORKSPACE_STORAGE_KEY,
    );
    if (storedWorkspaceId) {
      setSelectedWorkspaceId(storedWorkspaceId);
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      window.localStorage.setItem(
        ACTIVE_WORKSPACE_STORAGE_KEY,
        selectedWorkspaceId,
      );
    } else {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
  }, [selectedWorkspaceId]);

  // Use a more stable socket URL
  const socketUrl = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOCKET_URL)
      return process.env.NEXT_PUBLIC_SOCKET_URL;
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }, []);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (status === "unauthenticated") {
      clearSelectedWorkspaceId();
      router.push("/login");
    }
  }, [status, router, clearSelectedWorkspaceId]);

  useEffect(() => {
    if (content.startsWith("data:")) {
      setCurrentFileSize(formatFileSize(getDataUrlSize(content)));
      return;
    }

    // Remote resource size lookup can trigger CORS failures for third-party hosts.
    // Avoid browser HEAD requests for proxy content previews.
    if (isRemoteFile(content)) {
      setCurrentFileSize(null);
      return;
    }

    setCurrentFileSize(null);
  }, [content]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to load workspaces.");

      const data = await res.json();
      const availableWorkspaces = data.workspaces ?? [];
      setWorkspaces(availableWorkspaces);

      if (
        selectedWorkspaceId &&
        !availableWorkspaces.some(
          (workspace: { id: string }) => workspace.id === selectedWorkspaceId,
        )
      ) {
        clearSelectedWorkspaceId();
      }
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error ? error.message : "Unable to fetch workspaces.",
      );
    }
  }, [selectedWorkspaceId, clearSelectedWorkspaceId]);

  const loadPendingInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces/invites");
      if (!res.ok) throw new Error("Failed to load workspace invites.");

      const data = await res.json();
      setPendingInvites(data.invites ?? []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleCreateWorkspace = async () => {
    if (!workspaceCreateName.trim()) {
      setWorkspaceInfo("Workspace name cannot be empty.");
      return;
    }

    setIsWorkspaceSaving(true);
    setWorkspaceInfo(null);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceCreateName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create workspace.");
      }

      const data = await res.json();
      setWorkspaceCreateName("");
      setWorkspaceInfo("Workspace created successfully.");
      await loadWorkspaces();
      setSelectedWorkspaceId(data.workspace?.id ?? null);
    } catch (error) {
      setWorkspaceInfo(
        error instanceof Error ? error.message : "Unable to create workspace.",
      );
    } finally {
      setIsWorkspaceSaving(false);
    }
  };

  const handleSendInvite = async () => {
    if (!workspaceInviteEmail.trim() || !selectedWorkspaceId) {
      setWorkspaceInfo("Invite email and workspace selection are required.");
      return;
    }

    setIsInviteSaving(true);
    setWorkspaceInfo(null);

    try {
      const res = await fetch(`/api/workspaces/${selectedWorkspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeEmail: workspaceInviteEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite.");
      }

      setWorkspaceInviteEmail("");
      setWorkspaceInfo("Invite sent successfully.");
      await loadPendingInvites();
    } catch (error) {
      setWorkspaceInfo(
        error instanceof Error ? error.message : "Unable to send invite.",
      );
    } finally {
      setIsInviteSaving(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setAcceptingInviteId(inviteId);
    try {
      const res = await fetch("/api/workspaces/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invite.");
      }

      await loadWorkspaces();
      await loadPendingInvites();
      setWorkspaceInfo("Invite accepted. Workspace added.");
    } catch (error) {
      setWorkspaceInfo(
        error instanceof Error ? error.message : "Unable to accept invite.",
      );
    } finally {
      setAcceptingInviteId(null);
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    imageGalleryLoadingMoreRef.current = isImageGalleryLoadingMore;
  }, [isImageGalleryLoadingMore]);

  useEffect(() => {
    imageGalleryHasMoreRef.current = imageGalleryHasMore;
  }, [imageGalleryHasMore]);

  useEffect(() => {
    fileGalleryLoadingMoreRef.current = isFileGalleryLoadingMore;
  }, [isFileGalleryLoadingMore]);

  useEffect(() => {
    fileGalleryHasMoreRef.current = fileGalleryHasMore;
  }, [fileGalleryHasMore]);

  const loadHistory = useCallback(
    async (
      cursor: string | null = null,
      isInitial: boolean = false,
      currentSearch: string = "",
    ) => {
      if (isLoadingMoreRef.current || (!hasMoreRef.current && !isInitial))
        return;

      setIsLoadingMore(true);
      try {
        const url = new URL("/api/copy-items", window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (currentSearch) url.searchParams.set("search", currentSearch);
        if (selectedWorkspaceId) {
          url.searchParams.set("workspaceId", selectedWorkspaceId);
        }
        url.searchParams.set("limit", "20");

        const res = await fetch(url.toString());
        if (!res.ok) {
          if (res.status === 404 && selectedWorkspaceId) {
            clearSelectedWorkspaceId();
            return;
          }
          throw new Error("Failed to load copy history.");
        }

        const data: FetchHistoryResponse = await res.json();

        if (isInitial) {
          setHistory(data.items);
          if (data.items.length > 0) {
            const firstItem = data.items[0];
            const firstContent = firstItem.content;
            setContent(firstContent);
            setContentType(
              isImageContent(firstContent)
                ? "image"
                : isVideoContent(firstContent)
                  ? "video"
                  : "text",
            );
            setCurrentFileName(firstItem.fileName ?? null);
            setCurrentFileSize(
              firstItem.fileSize ? formatFileSize(firstItem.fileSize) : null,
            );
            lastContentRef.current = firstContent;
            setLastSavedAt(new Date(firstItem.createdAt).toLocaleTimeString());
          } else {
            setContent("");
            setContentType("text");
            lastContentRef.current = "";
            setLastSavedAt(null);
          }
        } else {
          setHistory((prev) => [...prev, ...data.items]);
        }

        setNextCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      } catch (err) {
        setError(
          (err as Error).message || "An error occurred while loading history.",
        );
      } finally {
        setIsLoadingMore(false);
      }
    },
    [selectedWorkspaceId, clearSelectedWorkspaceId],
  );

  const loadImageGallery = useCallback(
    async (cursor: string | null = null, isInitial: boolean = false) => {
      if (
        imageGalleryLoadingMoreRef.current ||
        (!imageGalleryHasMoreRef.current && !isInitial)
      ) {
        return;
      }

      if (isInitial) {
        setIsImageGalleryLoading(true);
        setImageGalleryHasMore(true);
      } else {
        setIsImageGalleryLoadingMore(true);
      }

      try {
        const url = new URL("/api/copy-items", window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (imageGallerySearch) {
          url.searchParams.set("search", imageGallerySearch);
        }
        if (selectedWorkspaceId) {
          url.searchParams.set("workspaceId", selectedWorkspaceId);
        }
        url.searchParams.set("limit", "20");
        url.searchParams.set("type", "image");

        const res = await fetch(url.toString());
        if (!res.ok) {
          if (res.status === 404 && selectedWorkspaceId) {
            clearSelectedWorkspaceId();
            return;
          }
          throw new Error("Failed to load image gallery.");
        }

        const data: FetchHistoryResponse = await res.json();
        if (isInitial) {
          setImageGalleryItems(data.items);
          setPreviewImageIndex(data.items.length > 0 ? 0 : null);
        } else {
          setImageGalleryItems((prev) => [...prev, ...data.items]);
        }

        setImageGalleryCursor(data.nextCursor);
        setImageGalleryHasMore(!!data.nextCursor);
      } catch (err) {
        setError(
          (err as Error).message ||
            "An error occurred while loading the image gallery.",
        );
      } finally {
        setIsImageGalleryLoading(false);
        setIsImageGalleryLoadingMore(false);
      }
    },
    [imageGallerySearch, selectedWorkspaceId, clearSelectedWorkspaceId],
  );

  const loadFileGallery = useCallback(
    async (cursor: string | null = null, isInitial: boolean = false) => {
      if (
        fileGalleryLoadingMoreRef.current ||
        (!fileGalleryHasMoreRef.current && !isInitial)
      ) {
        return;
      }

      if (isInitial) {
        setIsFileGalleryLoading(true);
        setFileGalleryHasMore(true);
      } else {
        setIsFileGalleryLoadingMore(true);
      }

      try {
        const url = new URL("/api/copy-items", window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (fileGallerySearch) {
          url.searchParams.set("search", fileGallerySearch);
        }
        if (selectedWorkspaceId) {
          url.searchParams.set("workspaceId", selectedWorkspaceId);
        }
        url.searchParams.set("limit", "20");
        url.searchParams.set("type", "file");

        const res = await fetch(url.toString());
        if (!res.ok) {
          if (res.status === 404 && selectedWorkspaceId) {
            clearSelectedWorkspaceId();
            return;
          }
          throw new Error("Failed to load file gallery.");
        }

        const data: FetchHistoryResponse = await res.json();
        if (isInitial) {
          setFileGalleryItems(data.items);
        } else {
          setFileGalleryItems((prev) => [...prev, ...data.items]);
        }

        setFileGalleryCursor(data.nextCursor);
        setFileGalleryHasMore(!!data.nextCursor);
      } catch (err) {
        setError(
          (err as Error).message ||
            "An error occurred while loading the file gallery.",
        );
      } finally {
        setIsFileGalleryLoading(false);
        setIsFileGalleryLoadingMore(false);
      }
    },
    [fileGallerySearch, selectedWorkspaceId, clearSelectedWorkspaceId],
  );

  const loadVideoGallery = useCallback(
    async (cursor: string | null = null, isInitial: boolean = false) => {
      if (
        videoGalleryLoadingMoreRef.current ||
        (!videoGalleryHasMoreRef.current && !isInitial)
      ) {
        return;
      }

      if (isInitial) {
        setIsVideoGalleryLoading(true);
        setVideoGalleryHasMore(true);
      } else {
        setIsVideoGalleryLoadingMore(true);
      }

      try {
        const url = new URL("/api/copy-items", window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (videoGallerySearch) {
          url.searchParams.set("search", videoGallerySearch);
        }
        if (selectedWorkspaceId) {
          url.searchParams.set("workspaceId", selectedWorkspaceId);
        }
        url.searchParams.set("limit", "20");
        url.searchParams.set("type", "video");

        const res = await fetch(url.toString());
        if (!res.ok) {
          if (res.status === 404 && selectedWorkspaceId) {
            clearSelectedWorkspaceId();
            return;
          }
          throw new Error("Failed to load video gallery.");
        }

        const data: FetchHistoryResponse = await res.json();
        if (isInitial) {
          setVideoGalleryItems(data.items);
        } else {
          setVideoGalleryItems((prev) => [...prev, ...data.items]);
        }

        setVideoGalleryCursor(data.nextCursor);
        setVideoGalleryHasMore(!!data.nextCursor);
      } catch (err) {
        setError(
          (err as Error).message ||
            "An error occurred while loading the video gallery.",
        );
      } finally {
        setIsVideoGalleryLoading(false);
        setIsVideoGalleryLoadingMore(false);
      }
    },
    [videoGallerySearch, selectedWorkspaceId, clearSelectedWorkspaceId],
  );

  // Initial load or search change
  useEffect(() => {
    if (isAuthenticated) {
      setHasMore(true);
      loadHistory(null, true, debouncedSearch);
    }
  }, [isAuthenticated, debouncedSearch, loadHistory, selectedWorkspaceId]);

  useEffect(() => {
    if (isAuthenticated && isImageGalleryOpen) {
      setImageGalleryCursor(null);
      setImageGalleryHasMore(true);
      setImageGalleryItems([]);
      loadImageGallery(null, true);
    }
  }, [
    isAuthenticated,
    isImageGalleryOpen,
    imageGallerySearch,
    selectedWorkspaceId,
    loadImageGallery,
  ]);

  useEffect(() => {
    if (isAuthenticated && isFileGalleryOpen) {
      setFileGalleryCursor(null);
      setFileGalleryHasMore(true);
      setFileGalleryItems([]);
      loadFileGallery(null, true);
    }
  }, [
    isAuthenticated,
    isFileGalleryOpen,
    fileGallerySearch,
    selectedWorkspaceId,
    loadFileGallery,
  ]);

  useEffect(() => {
    if (isAuthenticated && isVideoGalleryOpen) {
      setVideoGalleryCursor(null);
      setVideoGalleryHasMore(true);
      setVideoGalleryItems([]);
      loadVideoGallery(null, true);
    }
  }, [
    isAuthenticated,
    isVideoGalleryOpen,
    videoGallerySearch,
    selectedWorkspaceId,
    loadVideoGallery,
  ]);

  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaces();
      loadPendingInvites();
    }
  }, [isAuthenticated, loadWorkspaces, loadPendingInvites]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadHistory(nextCursor, false, debouncedSearch);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [nextCursor, hasMore, isLoadingMore, loadHistory, debouncedSearch]);

  useEffect(() => {
    if (
      !isImageGalleryOpen ||
      !imageGalleryHasMore ||
      isImageGalleryLoadingMore ||
      isImageGalleryLoading
    )
      return;

    if (imageGalleryObserverRef.current)
      imageGalleryObserverRef.current.disconnect();

    imageGalleryObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          imageGalleryHasMore &&
          !isImageGalleryLoadingMore
        ) {
          loadImageGallery(imageGalleryCursor, false);
        }
      },
      { threshold: 0.1 },
    );

    if (imageGalleryLoadMoreRef.current) {
      imageGalleryObserverRef.current.observe(imageGalleryLoadMoreRef.current);
    }

    return () => {
      if (imageGalleryObserverRef.current)
        imageGalleryObserverRef.current.disconnect();
    };
  }, [
    imageGalleryCursor,
    imageGalleryHasMore,
    isImageGalleryLoadingMore,
    isImageGalleryOpen,
    loadImageGallery,
  ]);

  useEffect(() => {
    if (
      !isFileGalleryOpen ||
      !fileGalleryHasMore ||
      isFileGalleryLoadingMore ||
      isFileGalleryLoading
    )
      return;

    if (fileGalleryObserverRef.current)
      fileGalleryObserverRef.current.disconnect();

    fileGalleryObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          fileGalleryHasMore &&
          !isFileGalleryLoadingMore
        ) {
          loadFileGallery(fileGalleryCursor, false);
        }
      },
      { threshold: 0.1 },
    );

    if (fileGalleryLoadMoreRef.current) {
      fileGalleryObserverRef.current.observe(fileGalleryLoadMoreRef.current);
    }

    return () => {
      if (fileGalleryObserverRef.current)
        fileGalleryObserverRef.current.disconnect();
    };
  }, [
    fileGalleryCursor,
    fileGalleryHasMore,
    isFileGalleryLoadingMore,
    isFileGalleryOpen,
    loadFileGallery,
  ]);

  useEffect(() => {
    if (
      !isVideoGalleryOpen ||
      !videoGalleryHasMore ||
      isVideoGalleryLoadingMore ||
      isVideoGalleryLoading
    )
      return;

    if (videoGalleryObserverRef.current)
      videoGalleryObserverRef.current.disconnect();

    videoGalleryObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          videoGalleryHasMore &&
          !isVideoGalleryLoadingMore
        ) {
          loadVideoGallery(videoGalleryCursor, false);
        }
      },
      { threshold: 0.1 },
    );

    if (videoGalleryLoadMoreRef.current) {
      videoGalleryObserverRef.current.observe(videoGalleryLoadMoreRef.current);
    }

    return () => {
      if (videoGalleryObserverRef.current)
        videoGalleryObserverRef.current.disconnect();
    };
  }, [
    videoGalleryCursor,
    videoGalleryHasMore,
    isVideoGalleryLoadingMore,
    isVideoGalleryOpen,
    loadVideoGallery,
  ]);

  // Socket Connection Lifecycle
  useEffect(() => {
    if (!isAuthenticated || !socketUrl) return;

    const socket = io(socketUrl, {
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["polling", "websocket"], // Match server transports
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);
      setError(null);

      if (
        selectedWorkspaceIdRef.current &&
        currentJoinedWorkspaceIdRef.current !== selectedWorkspaceIdRef.current
      ) {
        console.log(
          "Re-joining workspace on connect:",
          selectedWorkspaceIdRef.current,
        );
        socket.emit("workspace:join", selectedWorkspaceIdRef.current);
        currentJoinedWorkspaceIdRef.current = selectedWorkspaceIdRef.current;
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setIsConnected(false);
      setError(`Realtime connection issue: ${err.message}`);
    });

    socket.on(
      "clipboard:updated",
      async (
        item: Partial<CopyItem> & {
          id: string;
          content: string;
          createdAt: string;
          workspaceId?: string | null;
          fileName?: string | null;
          fileSize?: number | null;
          user?: CopyItem["user"];
          userId?: string;
        },
      ) => {
        console.log("Received clipboard:updated", item.id);
        let enrichedItem = item as CopyItem;

        if (!item.userId && item.id) {
          try {
            const response = await fetch(`/api/copy-items/${item.id}`);
            if (response.ok) {
              const data = await response.json();
              if (data.item) {
                enrichedItem = {
                  ...enrichedItem,
                  userId: data.item.userId,
                  user: data.item.user,
                };
                if (data.item.userId && data.item.user) {
                  setWorkspaceUsers((prev) => ({
                    ...prev,
                    [data.item.userId]: data.item.user,
                  }));
                }
              }
            }
          } catch (error) {
            console.warn("Failed to fetch copy item to recover userId:", error);
          }
        }

        const cachedUser = enrichedItem.userId
          ? workspaceUsersRef.current[enrichedItem.userId]
          : undefined;

        if (!enrichedItem.user && enrichedItem.userId) {
          if (cachedUser) {
            enrichedItem = { ...enrichedItem, user: cachedUser };
          } else if (session?.user?.id === enrichedItem.userId) {
            enrichedItem = {
              ...enrichedItem,
              user: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email ?? "",
              },
            };
          } else {
            try {
              const response = await fetch(
                `/api/workspaces/${enrichedItem.workspaceId ?? selectedWorkspaceIdRef.current}/members`,
              );
              if (response.ok) {
                const data = await response.json();
                const member = (data.users ?? []).find(
                  (user: { id: string }) => user.id === enrichedItem.userId,
                );
                if (member) {
                  enrichedItem = { ...enrichedItem, user: member };
                  setWorkspaceUsers((prev) => ({
                    ...prev,
                    [member.id]: member,
                  }));
                }
              }
            } catch (error) {
              console.warn("Failed to enrich socket item user:", error);
            }
          }
        }

        const isPersonal = !enrichedItem.workspaceId;
        const isActiveWorkspace =
          enrichedItem.workspaceId === selectedWorkspaceIdRef.current;
        if (!(isPersonal || isActiveWorkspace)) {
          return;
        }

        // Only add to history if content is not empty
        if (enrichedItem.content.trim()) {
          // Only add to history if it matches current search (or no search)
          if (
            !debouncedSearchRef.current ||
            enrichedItem.content
              .toLowerCase()
              .includes(debouncedSearchRef.current.toLowerCase()) ||
            enrichedItem.fileName
              ?.toLowerCase()
              .includes(debouncedSearchRef.current.toLowerCase()) ||
            enrichedItem.title
              ?.toLowerCase()
              .includes(debouncedSearchRef.current.toLowerCase())
          ) {
            setHistory((prev) => [
              enrichedItem,
              ...prev.filter((existing) => existing.id !== enrichedItem.id),
            ]);
          }
        }

        // Only update content if it's different to avoid cursor jumps
        if (item.content !== lastContentRef.current) {
          setContent(item.content);
          setContentType(
            isImageContent(item.content)
              ? "image"
              : isVideoContent(item.content)
                ? "video"
                : "text",
          );
          setCurrentFileName(item.fileName ?? null);
          setCurrentFileSize(
            item.fileSize ? formatFileSize(item.fileSize) : null,
          );
          lastContentRef.current = item.content;
        }

        setLastSavedAt(new Date(item.createdAt).toLocaleTimeString());
        setIsSaving(false);
      },
    );

    socket.on("workspace:invite", (data: { invite: PendingInvite }) => {
      console.log("Received workspace:invite", data.invite.id);
      setPendingInvites((prev) => [
        data.invite,
        ...prev.filter((i) => i.id !== data.invite.id),
      ]);
      showToast(`You have a new invite to join ${data.invite.workspace.name}`);
    });

    socket.on(
      "workspace:invite:accepted",
      (data: { workspaceName: string; inviteeName: string }) => {
        showToast(
          `${data.inviteeName} accepted your invite to ${data.workspaceName}`,
        );
        loadWorkspaces(); // Reload workspaces to update member list if needed
      },
    );

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      currentJoinedWorkspaceIdRef.current = null;
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    return () => {
      currentJoinedWorkspaceIdRef.current = null;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, socketUrl, session]);

  useEffect(() => {
    selectedWorkspaceIdRef.current = selectedWorkspaceId;
  }, [selectedWorkspaceId]);

  useEffect(() => {
    debouncedSearchRef.current = debouncedSearch;
  }, [debouncedSearch]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    const previousWorkspaceId = currentJoinedWorkspaceIdRef.current;

    if (previousWorkspaceId && previousWorkspaceId !== selectedWorkspaceId) {
      socket.emit("workspace:leave", previousWorkspaceId);
      currentJoinedWorkspaceIdRef.current = null;
    }

    if (selectedWorkspaceId && selectedWorkspaceId !== previousWorkspaceId) {
      socket.emit("workspace:join", selectedWorkspaceId);
      currentJoinedWorkspaceIdRef.current = selectedWorkspaceId;
    }
  }, [selectedWorkspaceId, isConnected]);

  // Debounced Update Logic
  const debouncedUpdate = useCallback(
    (nextContent: string) => {
      // Don't sync local paths to history/other users
      if (isLocalPath(nextContent)) {
        console.log("Local path detected, skipping synchronization.");
        return;
      }

      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

      updateTimeoutRef.current = setTimeout(() => {
        const socket = socketRef.current;

        if (!socket?.connected) {
          setError("Realtime not connected. Changes saved locally.");
          return;
        }

        if (nextContent === lastContentRef.current) return;

        setIsSaving(true);
        socket.emit(
          "clipboard:update",
          {
            content: nextContent,
            workspaceId: selectedWorkspaceId ?? undefined,
          },
          (ack: ClipboardUpdateAck) => {
            if (ack?.error) {
              setError(ack.error);
            } else if (ack?.item) {
              lastContentRef.current = nextContent;
              setLastSavedAt(new Date(ack.item.createdAt).toLocaleTimeString());
              setError(null);
            }
            setIsSaving(false);
          },
        );
      }, 800);
    },
    [selectedWorkspaceId],
  );

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const val = event.target.value;
    setContent(val);
    setContentType("text");
    debouncedUpdate(val);
  };

  const blobToDataURL = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const downloadContent = async (
    value: string,
    fileName?: string | null,
    itemId?: string,
  ) => {
    if (itemId) {
      setDownloadingIds((prev) => [...prev, itemId]);
    }

    try {
      if (value.startsWith("data:")) {
        const [meta, base64] = value.split(",");
        const byteString = atob(base64);
        const buffer = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i += 1) {
          buffer[i] = byteString.charCodeAt(i);
        }
        const mime = meta.split(":")[1].split(";")[0];
        downloadBlob(
          new Blob([buffer], { type: mime }),
          getDataUrlFileName(value),
        );
        showToast("Download started");
        return;
      }

      const response = await fetch(
        `/api/download-proxy?url=${encodeURIComponent(value)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to download file.");
      }
      const blob = await response.blob();
      downloadBlob(blob, fileName ?? getFileNameFromUrl(value));
      showToast("Download started");
    } catch (error) {
      const fallbackUrl = value.startsWith("http") ? value : null;
      if (fallbackUrl) {
        const anchor = document.createElement("a");
        anchor.href = fallbackUrl;
        anchor.target = "_blank";
        anchor.rel = "noreferrer noopener";
        anchor.download = fileName ?? getFileNameFromUrl(value);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        showToast("Download started");
        setError(
          "Unable to download through proxy. Opening direct link instead.",
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to download file. Please try again.",
        );
      }
    } finally {
      if (itemId) {
        setDownloadingIds((prev) =>
          prev.filter((downloadId) => downloadId !== itemId),
        );
      }
    }
  };

  const uploadFileToServer = (file: File) =>
    new Promise<CopyItem>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);
      if (selectedWorkspaceIdRef.current) {
        formData.append("workspaceId", selectedWorkspaceIdRef.current);
      }

      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.item) {
              resolve(data.item);
            } else {
              reject(new Error(data.error || "Upload failed."));
            }
          } catch {
            reject(new Error("Invalid upload response."));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
      xhr.onabort = () => reject(new Error("Upload aborted."));
      xhr.send(formData);
    });

  const uploadFile = async (file: File) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      setError("File exceeds the 5GB upload limit.");
      return;
    }

    try {
      setError(null);
      setIsUploading(true);
      setUploadProgress(0);
      setCurrentFileName(file.name);
      setCurrentFileSize(formatFileSize(file.size));

      const item = await uploadFileToServer(file);
      setHistory((prev) => [item, ...prev]);
      setContent(item.content);
      setContentType(
        isImageContent(item.content)
          ? "image"
          : isVideoContent(item.content)
            ? "video"
            : "text",
      );
      setLastSavedAt(new Date(item.createdAt).toLocaleTimeString());
      lastContentRef.current = item.content; // Update lastContent to avoid redundant socket update

      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit("clipboard:uploaded", {
          item,
          workspaceId: selectedWorkspaceIdRef.current ?? undefined,
        });
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to upload file. Please try again.",
      );
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const copyTextFallback = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!successful) {
      throw new Error(
        "Clipboard copy failed. Please allow permissions or use a supported browser.",
      );
    }
  };

  const convertImageToPngBlob = async (blob: Blob) => {
    const imageBitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to create canvas context for image conversion.");
    }

    context.drawImage(imageBitmap, 0, 0);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Failed to convert image to PNG."));
        } else {
          resolve(result);
        }
      }, "image/png");
    });
  };

  const copyImageToClipboard = async (dataUrl: string) => {
    if (!navigator.clipboard || typeof window.ClipboardItem === "undefined") {
      throw new Error("Image copy is not supported in this browser.");
    }

    const response = await fetch(dataUrl);
    let blob = await response.blob();
    if (blob.type !== "image/png") {
      blob = await convertImageToPngBlob(blob);
    }

    const clipboardItem = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([clipboardItem]);
  };

  const createFileFromBlob = (blob: Blob, fallbackName = "clipboard-file") => {
    const extension = blob.type.split("/")[1] || "bin";
    const fileName = `${fallbackName}.${extension}`;
    return new File([blob], fileName, { type: blob.type });
  };

  const handleCopy = async (text: string, id?: string) => {
    if (id) {
      setCopyingIds((prev) => [...prev, id]);
    }

    try {
      if (isImageContent(text)) {
        if (text.startsWith("http")) {
          const response = await fetch(
            `/api/image-proxy?url=${encodeURIComponent(text)}`,
          );
          if (!response.ok) {
            throw new Error("Failed to fetch remote image for clipboard copy.");
          }
          const blob = await response.blob();
          const dataUrl = await blobToDataURL(blob);
          await copyImageToClipboard(dataUrl);
        } else {
          await copyImageToClipboard(text);
        }
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        copyTextFallback(text);
      }

      showToast("Copied to clipboard");

      if (id) {
        setCopiedHistoryId(id);
        setTimeout(() => {
          setCopiedHistoryId((current) => (current === id ? null : current));
        }, 2000);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to copy to clipboard. Please allow clipboard access.",
      );
    } finally {
      if (id) {
        setCopyingIds((prev) => prev.filter((copyId) => copyId !== id));
      }
    }
  };

  const handleUpdateTitle = async (id: string, title: string) => {
    setUpdatingTitleIds((prev) => [...prev, id]);

    try {
      const response = await fetch(`/api/copy-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to update title.");
      }

      const data = await response.json();
      const updatedItem = data.item as CopyItem;

      setHistory((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, title: updatedItem.title } : item,
        ),
      );

      setHistoryPreviewItem((prev) =>
        prev?.id === id ? { ...prev, title: updatedItem.title } : prev,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update title. Please try again.",
      );
    } finally {
      setUpdatingTitleIds((prev) => prev.filter((updateId) => updateId !== id));
    }
  };

  const handlePasteEvent = async (
    event: ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    const videoItem = items.find((item) => item.type.startsWith("video/"));
    const fileItem = items.find((item) => item.kind === "file");

    const selectedItem = imageItem || videoItem || fileItem;

    if (selectedItem) {
      const file = selectedItem.getAsFile();
      if (file) {
        event.preventDefault();

        if (file.type.startsWith("image/")) {
          await uploadFile(file);
          setError(null);
          setPasted(true);
          showToast("Pasted image from clipboard");
          setTimeout(() => setPasted(false), 2000);
          return;
        }

        await uploadFile(file);
        setError(null);
        setPasted(true);
        showToast("Pasted file from clipboard");
        setTimeout(() => setPasted(false), 2000);
        return;
      }
    }

    // If no file found but text/uri-list is present (Explorer copy-paste)
    const uriList = event.clipboardData.getData("text/uri-list");
    if (uriList) {
      event.preventDefault();
      showToast(
        "Explorer file paths detected. Use Drag & Drop or Ctrl+V directly on the file.",
      );
      return;
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      const file = files[0];
      await uploadFile(file);
      return;
    }

    const text = event.dataTransfer.getData("text/plain").trim();
    if (text) {
      setContent(text);
      setContentType("text");
      debouncedUpdate(text);
      setError(null);
    }
  };

  const pasteUsingHiddenTextarea = async (): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const textarea = document.createElement("textarea");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      textarea.setAttribute("aria-hidden", "true");
      document.body.appendChild(textarea);

      let handled = false;

      const cleanup = () => {
        textarea.removeEventListener("paste", onPaste);
        document.body.removeChild(textarea);
      };

      const onPaste = async (event: Event) => {
        const clipboardEvent = event as globalThis.ClipboardEvent;
        handled = true;
        clipboardEvent.preventDefault();
        cleanup();
        await handlePasteEvent(
          clipboardEvent as unknown as ClipboardEvent<HTMLTextAreaElement>,
        );
        resolve(true);
      };

      textarea.addEventListener("paste", onPaste);
      textarea.focus();
      document.execCommand("paste");

      setTimeout(() => {
        if (!handled) {
          cleanup();
          resolve(false);
        }
      }, 150);
    });
  };

  const pasteIntoEditor = async (): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const textarea = document.getElementById(
        "live-editor-textarea",
      ) as HTMLTextAreaElement | null;
      if (!textarea) return resolve(false);

      let handled = false;

      const onPasteLocal = async (event: globalThis.ClipboardEvent) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        const videoItem = items.find((item) => item.type.startsWith("video/"));
        const fileItem = items.find((item) => item.kind === "file");

        if (!imageItem && !videoItem && !fileItem) {
          return;
        }

        handled = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        textarea.removeEventListener("paste", onPasteLocal);

        await handlePasteEvent(
          event as unknown as ClipboardEvent<HTMLTextAreaElement>,
        );
        resolve(true);
      };

      textarea.addEventListener("paste", onPasteLocal);
      textarea.focus();
      try {
        document.execCommand("paste");
      } catch {
        // ignore
      }

      setTimeout(() => {
        if (!handled) {
          textarea.removeEventListener("paste", onPasteLocal);
          resolve(false);
        }
      }, 200);
    });
  };

  const handlePaste = async () => {
    try {
      // 1. Try modern navigator.clipboard.read() first for images/files
      if (navigator.clipboard && "read" in navigator.clipboard) {
        try {
          const clipboardItems = await (
            navigator.clipboard as unknown as {
              read(): Promise<ClipboardReadItem[]>;
            }
          ).read();

          for (const item of clipboardItems) {
            const imageType = item.types.find((type: string) =>
              type.startsWith("image/"),
            );
            const videoType = item.types.find((type: string) =>
              type.startsWith("video/"),
            );
            const fileType = item.types.find(
              (type: string) =>
                !type.startsWith("image/") &&
                !type.startsWith("video/") &&
                !type.startsWith("text/plain") &&
                !type.startsWith("text/html") &&
                !type.startsWith("text/rtf"),
            );

            if (imageType) {
              const blob: Blob = await item.getType(imageType);
              const file = createFileFromBlob(blob, "clipboard-image");
              await uploadFile(file);
              setError(null);
              setPasted(true);
              showToast("Pasted image from clipboard");
              setTimeout(() => setPasted(false), 2000);
              return;
            }

            if (videoType) {
              const blob: Blob = await item.getType(videoType);
              const file = createFileFromBlob(blob, "clipboard-video");
              await uploadFile(file);
              setError(null);
              setPasted(true);
              showToast("Pasted video from clipboard");
              setTimeout(() => setPasted(false), 2000);
              return;
            }

            if (fileType) {
              try {
                const blob: Blob = await item.getType(fileType);
                // If it's a URI list, it's just text paths, don't update content state
                if (fileType === "text/uri-list") {
                  const text = await blob.text();
                  if (text) {
                    showToast(
                      "Explorer file paths detected. Use Drag & Drop or Ctrl+V directly on the file.",
                    );
                    return;
                  }
                }

                const file = createFileFromBlob(blob, "clipboard-file");
                await uploadFile(file);
                setError(null);
                setPasted(true);
                showToast("Pasted file from clipboard");
                setTimeout(() => setPasted(false), 2000);
                return;
              } catch (err) {
                console.warn(
                  `Failed to read clipboard item of type ${fileType}:`,
                  err,
                );
              }
            }
          }
        } catch (readError) {
          console.warn(
            "navigator.clipboard.read() failed, falling back:",
            readError,
          );
        }
      }

      // 2. Fallback: Try to paste directly into the visible editor textarea (mimic Ctrl+V)
      const editorPasteSuccess = await pasteIntoEditor();
      if (editorPasteSuccess) {
        return;
      }

      // 3. Fallback: Try hidden textarea
      const success = await pasteUsingHiddenTextarea();
      if (success) {
        return;
      }

      // 4. Final fallback: readText()
      const text = await navigator.clipboard.readText();
      if (text) {
        // If it's a local path, don't update content state at all to "cancel" the paste
        if (isLocalPath(text)) {
          showToast(
            "Local file path detected. Use Drag & Drop or Ctrl+V directly on the file.",
          );
          return;
        }

        setContent(text);
        setContentType(
          isImageContent(text)
            ? "image"
            : isVideoContent(text)
              ? "video"
              : "text",
        );
        debouncedUpdate(text);
        setError(null);
        setPasted(true);
        showToast("Pasted from clipboard");
        setTimeout(() => setPasted(false), 2000);
      }
    } catch (err) {
      console.error("Paste failed:", err);
      setError("Failed to read clipboard. Please allow clipboard access.");
    }
  };

  const handleCopyAll = async () => {
    await handleCopy(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setContent("");
    setContentType("text");
    setCurrentFileName(null);
    setCurrentFileSize(null);
    setLastSavedAt(null);
    lastContentRef.current = "";
    setCleared(true);
    showToast("Editor cleared");
    setTimeout(() => setCleared(false), 2000);
  };

  const handleDelete = async (id: string) => {
    if (deletingIds.includes(id)) return;

    setDeletingIds((prev) => [...prev, id]);
    setError(null);

    try {
      const res = await fetch(`/api/copy-items/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete item.");
      }

      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingIds((prev) => prev.filter((deleteId) => deleteId !== id));
    }
  };

  const handleClearAllPersonalClipboard = async () => {
    if (clearAllConfirmation !== "clear all") {
      setError("Please type 'clear all' to confirm.");
      return;
    }

    setIsClearingAll(true);
    setError(null);

    try {
      const res = await fetch("/api/copy-items/clear-all", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear personal clipboard.");
      }

      if (!selectedWorkspaceId) {
        setHistory([]);
        setContent("");
        setContentType("text");
        lastContentRef.current = "";
      }

      setWorkspaceInfo("Personal clipboard cleared successfully.");
      setIsClearAllModalOpen(false);
      setClearAllConfirmation("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={100}
                  height={100}
                  className="rounded-2xl shadow-xl"
                />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  Copy Paste <span className="text-blue-500">Everywhere</span>
                </h1>
                <p className="max-w-2xl text-lg text-slate-400">
                  Synchronize clipboard across devices privately and in
                  real-time. Copy/paste text, images, or videos, and drag & drop
                  an image or video directly into the editor.
                </p>
                <div className="text-sm text-slate-500">
                  App version {appVersion}
                </div>
              </div>
            </div>

            <div className="relative flex items-center gap-4 rounded-2xl p-4">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2 transition hover:border-blue-500"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
              >
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                  {(session?.user?.name ??
                    session?.user?.email ??
                    "U")[0]?.toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold text-white">
                    {session?.user?.name ?? session?.user?.email ?? "User"}
                  </p>
                  <p className="text-xs text-slate-400">View profile</p>
                </div>
                <span className="hidden text-xs text-slate-400 sm:block">
                  ▾
                </span>
              </button>

              {isProfileMenuOpen && (
                <div
                  ref={profileMenuRef}
                  className="absolute right-0 top-full z-20 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
                >
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Profile
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-lg font-bold text-white">
                        {(session?.user?.name ??
                          session?.user?.email ??
                          "U")[0]?.toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">
                          {session?.user?.name ??
                            session?.user?.email ??
                            "User"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {session?.user?.email ?? "No email available"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-800" />
                  <div className="p-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsClearAllModalOpen(true);
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500 hover:text-white"
                      title="Clear personal clipboard"
                      aria-label="Clear personal clipboard"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 group-hover:bg-white/20">
                        <FaTrash className="h-4 w-4" />
                      </div>
                      Clear clipboard
                    </button>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                      title="Logout"
                      aria-label="Logout"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                        <FaSignOutAlt className="h-4 w-4" />
                      </div>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-6">
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
              />
              <span className="text-sm font-medium text-slate-300">
                {isConnected ? "Realtime Connected" : "Realtime Disconnected"}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <span className="text-sm text-slate-400">
              {lastSavedAt
                ? `Last update: ${lastSavedAt}`
                : "No synchronization yet"}
            </span>
          </div>
        </header>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Workspace & Invite Panel
              </h2>
              <p className="text-sm text-slate-400">
                Create shared workspaces or invite teammates to access the same
                shared clipboard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto]">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-slate-500"
                  htmlFor="workspace-select"
                >
                  Active workspace
                </label>
                <div className="ml-2 min-w-[220px]">
                  <Select
                    instanceId="workspace-select"
                    inputId="workspace-select-input"
                    options={workspaceOptions}
                    value={selectedWorkspaceOption}
                    onChange={handleWorkspaceSelect}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        color: "#fff",
                        minHeight: "42px",
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: "#fff",
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: "#0f172a",
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused
                          ? "#1e293b"
                          : "#0f172a",
                        color: state.isSelected ? "#fff" : "#cbd5e1",
                      }),
                    }}
                    theme={(theme) => ({
                      ...theme,
                      borderRadius: 12,
                      colors: {
                        ...theme.colors,
                        primary25: "#1e293b",
                        primary: "#3b82f6",
                        neutral0: "#0f172a",
                        neutral80: "#e2e8f0",
                      },
                    })}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWorkspaceModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <FaEdit className="h-4 w-4" />
                Manage workspace
              </button>
            </div>
          </div>

          {workspaceInfo && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
              {workspaceInfo}
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-white">
                  Pending Workspace Invites
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Accept to join
                </span>
              </div>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm text-slate-300">
                        Invite to{" "}
                        <span className="font-semibold text-white">
                          {invite.workspace?.name}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        From {invite.invitedBy?.email || "unknown"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAcceptInvite(invite.id)}
                      disabled={acceptingInviteId === invite.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {acceptingInviteId === invite.id ? (
                        <>
                          <FaSpinner className="h-4 w-4 animate-spin" />
                          Accepting...
                        </>
                      ) : (
                        "Accept invite"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {isWorkspaceModalOpen && (
          <WorkspaceModal
            activeWorkspaceName={activeWorkspaceName}
            workspaceOptions={workspaceOptions}
            selectedWorkspaceOption={selectedWorkspaceOption}
            workspaceCreateName={workspaceCreateName}
            workspaceInviteEmail={workspaceInviteEmail}
            workspaceInfo={workspaceInfo}
            pendingInvites={pendingInvites}
            isWorkspaceSaving={isWorkspaceSaving}
            isInviteSaving={isInviteSaving}
            acceptingInviteId={acceptingInviteId}
            onClose={() => setIsWorkspaceModalOpen(false)}
            onWorkspaceCreateNameChange={setWorkspaceCreateName}
            onWorkspaceInviteEmailChange={setWorkspaceInviteEmail}
            onWorkspaceSelect={handleWorkspaceSelect}
            onCreateWorkspace={handleCreateWorkspace}
            onSendInvite={handleSendInvite}
            onAcceptInvite={handleAcceptInvite}
          />
        )}

        {isClearAllModalOpen && (
          <ClearAllModal
            clearAllConfirmation={clearAllConfirmation}
            isClearingAll={isClearingAll}
            onClose={() => {
              setIsClearAllModalOpen(false);
              setClearAllConfirmation("");
            }}
            onConfirmationChange={setClearAllConfirmation}
            onConfirm={handleClearAllPersonalClipboard}
          />
        )}

        <ImageGalleryModal
          isOpen={isImageGalleryOpen}
          searchValue={imageGallerySearch}
          items={imageGalleryItems}
          previewImageIndex={previewImageIndex}
          copyingIds={copyingIds}
          downloadingIds={downloadingIds}
          deletingIds={deletingIds}
          isLoadingMore={isImageGalleryLoadingMore}
          hasMore={imageGalleryHasMore}
          loadMoreRef={imageGalleryLoadMoreRef}
          onClose={() => setIsImageGalleryOpen(false)}
          onSearchChange={setImageGallerySearch}
          onPreviewImageIndexChange={setPreviewImageIndex}
          onCopy={handleCopy}
          onDownload={downloadContent}
          onDelete={handleDelete}
          getFileNameFromUrl={getFileNameFromUrl}
          getFileType={getFileType}
          getFileSize={getFileSize}
          getImageSrc={getImageSrc}
        />

        <HistoryPreviewModal
          item={historyPreviewItem}
          onClose={() => setHistoryPreviewItem(null)}
          onCopy={handleCopy}
          onDownload={downloadContent}
          copyingIds={copyingIds}
          downloadingIds={downloadingIds}
          getFileNameFromUrl={getFileNameFromUrl}
        />

        <VideoGalleryModal
          isOpen={isVideoGalleryOpen}
          searchValue={videoGallerySearch}
          items={videoGalleryItems}
          copyingIds={copyingIds}
          downloadingIds={downloadingIds}
          deletingIds={deletingIds}
          isLoadingMore={isVideoGalleryLoadingMore}
          hasMore={videoGalleryHasMore}
          loadMoreRef={videoGalleryLoadMoreRef}
          onClose={() => setIsVideoGalleryOpen(false)}
          onSearchChange={setVideoGallerySearch}
          onCopy={handleCopy}
          onDownload={downloadContent}
          onDelete={handleDelete}
          getFileNameFromUrl={getFileNameFromUrl}
          getFileSize={getFileSize}
        />
        {previewImage !== null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95"
            onClick={() => setPreviewImageIndex(null)}
          >
            <div className="absolute inset-0" />
            <button
              type="button"
              onClick={() => setPreviewImageIndex(null)}
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950/90 text-slate-300 transition hover:border-slate-600 hover:text-white"
              aria-label="Close preview"
            >
              ×
            </button>
            <div
              className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-slate-950"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute left-4 top-1/2 z-20 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewImageIndex((current) => {
                      if (current === null) return null;
                      return current === 0
                        ? imageGalleryItems.length - 1
                        : current - 1;
                    })
                  }
                  className="rounded-full border border-slate-700 bg-slate-950/90 p-3 text-slate-200 transition hover:bg-slate-900"
                  aria-label="Previous image"
                >
                  <FaChevronLeft className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewImageIndex((current) => {
                      if (current === null) return null;
                      return current === imageGalleryItems.length - 1
                        ? 0
                        : current + 1;
                    })
                  }
                  className="rounded-full border border-slate-700 bg-slate-950/90 p-3 text-slate-200 transition hover:bg-slate-900"
                  aria-label="Next image"
                >
                  <FaChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="relative flex h-full w-full items-center justify-center p-4">
                <div className="max-h-full w-full max-w-6xl overflow-hidden rounded-2xl bg-slate-950">
                  <Image
                    src={getImageSrc(previewImage.content)}
                    alt={previewImage.fileName ?? "Preview image"}
                    width={1600}
                    height={1200}
                    unoptimized
                    className="mx-auto max-h-[90vh] w-full object-contain"
                  />
                </div>
              </div>
              <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-3 rounded-2xl bg-slate-950/90 px-4 py-3 shadow-2xl backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() =>
                    previewImage &&
                    handleCopy(previewImage.content, previewImage.id)
                  }
                  disabled={
                    previewImage ? copyingIds.includes(previewImage.id) : false
                  }
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${previewImage && copyingIds.includes(previewImage.id) ? "bg-blue-500/70 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"}`}
                >
                  {previewImage && copyingIds.includes(previewImage.id) ? (
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
                  {previewImage && copyingIds.includes(previewImage.id)
                    ? "Copying..."
                    : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    previewImage &&
                    downloadContent(
                      previewImage.content,
                      previewImage.fileName ??
                        getFileNameFromUrl(previewImage.content),
                      previewImage.id,
                    )
                  }
                  disabled={
                    previewImage
                      ? downloadingIds.includes(previewImage.id)
                      : false
                  }
                  className={`inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold transition ${previewImage && downloadingIds.includes(previewImage.id) ? "bg-slate-800/70 text-slate-400 cursor-not-allowed" : "bg-slate-950 text-slate-200 hover:bg-slate-900"}`}
                >
                  {previewImage && downloadingIds.includes(previewImage.id) ? (
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
                  {previewImage && downloadingIds.includes(previewImage.id)
                    ? "Downloading..."
                    : "Download"}
                </button>
              </div>
            </div>
          </div>
        )}

        <FileGalleryModal
          isOpen={isFileGalleryOpen}
          searchValue={fileGallerySearch}
          items={fileGalleryItems}
          copyingIds={copyingIds}
          downloadingIds={downloadingIds}
          deletingIds={deletingIds}
          isLoadingMore={isFileGalleryLoadingMore}
          hasMore={fileGalleryHasMore}
          loadMoreRef={fileGalleryLoadMoreRef}
          onClose={() => setIsFileGalleryOpen(false)}
          onSearchChange={setFileGallerySearch}
          onCopy={handleCopy}
          onDownload={downloadContent}
          onDelete={handleDelete}
          getFileNameFromUrl={getFileNameFromUrl}
          getFileType={getFileType}
          getFileSize={getFileSize}
        />

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 flex items-center gap-3">
            <span className="flex-shrink-0 text-red-400">⚠️</span>
            {error}
          </div>
        )}

        {toastMessage && <DashboardToast message={toastMessage} />}

        <div className="grid gap-8 lg:grid-cols-3">
          <LiveEditor
            content={content}
            contentType={contentType}
            copied={copied}
            pasted={pasted}
            cleared={cleared}
            isSaving={isSaving}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            currentFileName={currentFileName}
            currentFileSize={currentFileSize}
            isDragActive={isDragActive}
            onCopyAll={handleCopyAll}
            onPaste={handlePaste}
            onClear={handleClear}
            onChange={handleChange}
            onPasteEvent={handlePasteEvent}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            downloadContent={downloadContent}
            getImageSrc={getImageSrc}
            getFileNameFromUrl={getFileNameFromUrl}
            getFileType={getFileType}
            isRemoteFile={isRemoteFile}
            isLocalPath={isLocalPath}
            isVideoContent={isVideoContent}
          />

          <HistorySidebar
            history={history}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onOpenImageGallery={() => setIsImageGalleryOpen(true)}
            onOpenFileGallery={() => setIsFileGalleryOpen(true)}
            onOpenVideoGallery={() => setIsVideoGalleryOpen(true)}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onDownload={downloadContent}
            setHistoryPreviewItem={setHistoryPreviewItem}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            loadMoreRef={loadMoreRef}
            copiedHistoryId={copiedHistoryId}
            copyingIds={copyingIds}
            downloadingIds={downloadingIds}
            deletingIds={deletingIds}
            updatingTitleIds={updatingTitleIds}
            onUpdateTitle={handleUpdateTitle}
            isImageContent={isImageContent}
            isVideoContent={isVideoContent}
            isRemoteFile={isRemoteFile}
            isLocalPath={isLocalPath}
            getImageSrc={getImageSrc}
            getFileNameFromUrl={getFileNameFromUrl}
            getFileType={getFileType}
            getFileSize={getFileSize}
          />
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
