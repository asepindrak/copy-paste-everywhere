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
} from "react-icons/fa";
import Image from "next/image";
import packageJson from "../../../package.json";

interface CopyItem {
  id: string;
  content: string;
  fileName?: string | null;
  workspaceId?: string | null;
  createdAt: string;
}

interface ClipboardUpdateAck {
  item?: CopyItem;
  error?: string;
}

interface FetchHistoryResponse {
  items: CopyItem[];
  nextCursor: string | null;
}

type ClipboardReadItem = {
  types: string[];
  getType(type: string): Promise<Blob>;
};

const MAX_UPLOAD_SIZE = 5 * 1024 ** 3; // 5 GB
const appVersion = packageJson.version;

const isImageContent = (value: string) =>
  /^data:image\/[a-zA-Z]+;base64,/.test(value) ||
  /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value);

const isRemoteFile = (value: string) =>
  /^https?:\/\/.+\.[a-z0-9]+(\?.*)?$/i.test(value);

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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<"text" | "image">("text");
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
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [workspaceCreateName, setWorkspaceCreateName] = useState("");

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
  const [workspaceInfo, setWorkspaceInfo] = useState<string | null>(null);
  const [isWorkspaceSaving, setIsWorkspaceSaving] = useState(false);
  const [isInviteSaving, setIsInviteSaving] = useState(false);

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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  type WorkspaceOption = {
    value: string;
    label: string;
  };

  const activeWorkspaceName = selectedWorkspaceId
    ? workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name
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

  const handleWorkspaceSelect = useCallback(
    (option: SingleValue<WorkspaceOption>) => {
      setSelectedWorkspaceId(option?.value ? option.value : null);
    },
    [],
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
  const imageGalleryLoadingMoreRef = useRef(isImageGalleryLoadingMore);
  const imageGalleryHasMoreRef = useRef(imageGalleryHasMore);
  const fileGalleryLoadingMoreRef = useRef(isFileGalleryLoadingMore);
  const fileGalleryHasMoreRef = useRef(fileGalleryHasMore);

  const socketRef = useRef<Socket | null>(null);
  const lastContentRef = useRef(content);
  const selectedWorkspaceIdRef = useRef<string | null>(selectedWorkspaceId);
  const currentJoinedWorkspaceIdRef = useRef<string | null>(null);
  const debouncedSearchRef = useRef<string>(debouncedSearch);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const hasMoreRef = useRef(hasMore);

  const isAuthenticated = status === "authenticated";
  const ACTIVE_WORKSPACE_STORAGE_KEY = "activeWorkspaceId";

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
      router.push("/login");
    }
  }, [status, router]);

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
        setSelectedWorkspaceId(null);
      }
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error ? error.message : "Unable to fetch workspaces.",
      );
    }
  }, [selectedWorkspaceId]);

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
        if (!res.ok) throw new Error("Failed to load copy history.");

        const data: FetchHistoryResponse = await res.json();

        if (isInitial) {
          setHistory(data.items);
          if (data.items.length > 0) {
            const firstContent = data.items[0].content;
            setContent(firstContent);
            setContentType(isImageContent(firstContent) ? "image" : "text");
            lastContentRef.current = firstContent;
          } else {
            setContent("");
            setContentType("text");
            lastContentRef.current = "";
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
    [selectedWorkspaceId],
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
        if (!res.ok) throw new Error("Failed to load image gallery.");

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
    [imageGallerySearch, selectedWorkspaceId],
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
        if (!res.ok) throw new Error("Failed to load file gallery.");

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
    [fileGallerySearch, selectedWorkspaceId],
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

  // Socket Connection Lifecycle
  useEffect(() => {
    if (!isAuthenticated || !socketUrl) return;

    console.log("Connecting to socket at:", socketUrl);
    const socket = io(socketUrl, {
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected!");
      setIsConnected(true);
      setError(null);

      if (
        selectedWorkspaceIdRef.current &&
        currentJoinedWorkspaceIdRef.current !== selectedWorkspaceIdRef.current
      ) {
        socket.emit("workspace:join", selectedWorkspaceIdRef.current);
        currentJoinedWorkspaceIdRef.current = selectedWorkspaceIdRef.current;
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setIsConnected(false);
      setError(`Realtime connection issue: ${err.message}`);
    });

    socket.on("clipboard:updated", (item: CopyItem) => {
      console.log("Received update:", item);

      const isPersonal = !item.workspaceId;
      const isActiveWorkspace =
        item.workspaceId === selectedWorkspaceIdRef.current;
      if (!(isPersonal || isActiveWorkspace)) {
        return;
      }

      // Only add to history if content is not empty
      if (item.content.trim()) {
        // Only add to history if it matches current search (or no search)
        if (
          !debouncedSearchRef.current ||
          item.content
            .toLowerCase()
            .includes(debouncedSearchRef.current.toLowerCase()) ||
          item.fileName
            ?.toLowerCase()
            .includes(debouncedSearchRef.current.toLowerCase())
        ) {
          setHistory((prev) => [
            item,
            ...prev.filter((existing) => existing.id !== item.id),
          ]);
        }
      }

      // Only update content if it's different to avoid cursor jumps
      if (item.content !== lastContentRef.current) {
        setContent(item.content);
        setCurrentFileName(item.fileName ?? null);
        lastContentRef.current = item.content;
      }

      setLastSavedAt(new Date(item.createdAt).toLocaleTimeString());
      setIsSaving(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      currentJoinedWorkspaceIdRef.current = null;
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    return () => {
      currentJoinedWorkspaceIdRef.current = null;
      console.log("Cleaning up socket connection");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, socketUrl]);

  useEffect(() => {
    selectedWorkspaceIdRef.current = selectedWorkspaceId;
  }, [selectedWorkspaceId]);

  useEffect(() => {
    debouncedSearchRef.current = debouncedSearch;
  }, [debouncedSearch]);

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
  const debouncedUpdate = useMemo(() => {
    let timeout: NodeJS.Timeout;

    return (nextContent: string) => {
      if (timeout) clearTimeout(timeout);

      timeout = setTimeout(() => {
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
    };
  }, [selectedWorkspaceId]);

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
      if (selectedWorkspaceId) {
        formData.append("workspaceId", selectedWorkspaceId);
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
      setContentType(isImageContent(item.content) ? "image" : "text");
      setLastSavedAt(new Date(item.createdAt).toLocaleTimeString());
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

  const handlePasteEvent = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );

    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setContent(dataUrl);
      setContentType("image");
      setCurrentFileSize(formatFileSize(getDataUrlSize(dataUrl)));
      debouncedUpdate(dataUrl);
      setError(null);
      setPasted(true);
      showToast("Pasted image from clipboard");
      setTimeout(() => setPasted(false), 2000);
    };
    reader.readAsDataURL(file);
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

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && "read" in navigator.clipboard) {
        const clipboardItems = await (
          navigator.clipboard as unknown as {
            read(): Promise<ClipboardReadItem[]>;
          }
        ).read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((type: string) =>
            type.startsWith("image/"),
          );

          if (imageType) {
            const blob: Blob = await item.getType(imageType);
            const dataUrl = await blobToDataURL(blob);
            setContent(dataUrl);
            setContentType("image");
            debouncedUpdate(dataUrl);
            setError(null);
            setPasted(true);
            showToast("Pasted from clipboard");
            setTimeout(() => setPasted(false), 2000);
            return;
          }
        }
      }

      const text = await navigator.clipboard.readText();
      setContent(text);
      setContentType("text");
      debouncedUpdate(text);
      setError(null);

      setPasted(true);
      showToast("Pasted from clipboard");
      setTimeout(() => setPasted(false), 2000);
    } catch {
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
    lastContentRef.current = "";
    debouncedUpdate("");
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
                  real-time. Copy/paste text or images, and drag & drop an image
                  directly into the editor.
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
                  <div className="mt-3 flex w-full overflow-hidden rounded-2xl border border-slate-700 text-sm font-semibold">
                    <button
                      type="button"
                      onClick={() => setIsClearAllModalOpen(true)}
                      className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-2 border-r border-slate-700 bg-red-600 px-3 py-2 text-white transition hover:bg-red-500"
                      title="Clear personal clipboard"
                      aria-label="Clear personal clipboard"
                    >
                      <FaTrash className="h-4 w-4" />
                      Clear clipboard
                    </button>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-sky-500 px-3 py-2 text-white transition hover:from-blue-700 hover:to-sky-600"
                      title="Logout"
                      aria-label="Logout"
                    >
                      <FaSignOutAlt className="h-4 w-4" />
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
                      className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      Accept invite
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {isWorkspaceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Workspace Manager
                  </h2>
                  <p className="text-sm text-slate-400">
                    Create a workspace or invite teammates to the selected
                    workspace.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Active workspace:{" "}
                    <span className="font-semibold text-white">
                      {activeWorkspaceName ?? "Personal clipboard"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWorkspaceModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
                  aria-label="Close workspace manager"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-6 overflow-y-auto p-6 custom-scrollbar">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                  <label
                    className="block text-sm font-medium text-slate-300"
                    htmlFor="workspace-name-modal"
                  >
                    New workspace name
                  </label>
                  <div className="mt-3 flex gap-2">
                    <input
                      id="workspace-name-modal"
                      value={workspaceCreateName}
                      onChange={(event) =>
                        setWorkspaceCreateName(event.target.value)
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Team clipboard"
                    />
                    <button
                      type="button"
                      onClick={handleCreateWorkspace}
                      disabled={isWorkspaceSaving}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isWorkspaceSaving ? "Creating..." : "Create Workspace"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                  <label
                    className="block text-sm font-medium text-slate-300"
                    htmlFor="workspace-select-modal"
                  >
                    Select workspace for invites
                  </label>
                  <div className="mt-3">
                    <Select
                      instanceId="workspace-select-modal"
                      inputId="workspace-select-modal-input"
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

                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                  <label
                    className="block text-sm font-medium text-slate-300"
                    htmlFor="invite-email-modal"
                  >
                    Invite teammate by email
                  </label>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="invite-email-modal"
                      type="email"
                      value={workspaceInviteEmail}
                      onChange={(event) =>
                        setWorkspaceInviteEmail(event.target.value)
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      placeholder="name@example.com"
                    />
                    <button
                      type="button"
                      onClick={handleSendInvite}
                      disabled={isInviteSaving || !selectedWorkspaceId}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isInviteSaving ? "Sending..." : "Send Invite"}
                    </button>
                  </div>
                  {!selectedWorkspaceId && (
                    <p className="mt-2 text-sm text-slate-500">
                      Select an active workspace before inviting teammates.
                    </p>
                  )}
                </div>

                {workspaceInfo && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
                    {workspaceInfo}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isClearAllModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Clear personal clipboard
                  </h2>
                  <p className="text-sm text-slate-400">
                    This will permanently delete all items from your personal
                    clipboard.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Workspace items are not affected.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsClearAllModalOpen(false);
                    setClearAllConfirmation("");
                  }}
                  className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="space-y-6 p-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                  <p className="text-sm text-slate-300">
                    Type{" "}
                    <span className="font-semibold text-white">clear all</span>{" "}
                    to confirm.
                  </p>
                  <input
                    type="text"
                    value={clearAllConfirmation}
                    onChange={(event) =>
                      setClearAllConfirmation(event.target.value)
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Type clear all to confirm"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-400">
                    Once confirmed, your personal clipboard data will be deleted
                    immediately.
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAllPersonalClipboard}
                    disabled={
                      clearAllConfirmation !== "clear all" || isClearingAll
                    }
                    className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isClearingAll ? "Clearing..." : "Confirm Clear All"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isImageGalleryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Image Gallery
                  </h2>
                  <p className="text-sm text-slate-400">
                    Browse your copied images in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImageGalleryOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
                  aria-label="Close image gallery"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
              <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-4">
                <input
                  type="text"
                  value={imageGallerySearch}
                  onChange={(event) =>
                    setImageGallerySearch(event.target.value)
                  }
                  placeholder="Search images..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 outline-none transition focus:border-blue-500/50 focus:ring-blue-500/10"
                />
              </div>
              <div className="grid max-h-[72vh] gap-4 overflow-y-auto p-6 custom-scrollbar">
                {imageGalleryItems.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center text-slate-400">
                    No images match your search.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {imageGalleryItems.map((item, index) => (
                      <div
                        key={`${item.id}-${index}`}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="mb-3 flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {item.fileName ??
                                getFileNameFromUrl(item.content)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {getFileSize(item.content) ?? "Unknown size"}
                            </p>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                          <button
                            type="button"
                            onClick={() => setPreviewImageIndex(index)}
                            className="group block h-48 w-full overflow-hidden"
                            title="Preview image"
                          >
                            <Image
                              src={getImageSrc(item.content)}
                              alt={item.fileName ?? "Gallery image"}
                              width={600}
                              height={400}
                              unoptimized
                              className="h-48 w-full object-contain transition duration-150 ease-in-out group-hover:scale-[1.01]"
                            />
                          </button>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.content, item.id)}
                            disabled={copyingIds.includes(item.id)}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500 ${copyingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
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
                              <FaCopy className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadContent(
                                item.content,
                                item.fileName ??
                                  getFileNameFromUrl(item.content),
                                item.id,
                              )
                            }
                            disabled={downloadingIds.includes(item.id)}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-200 transition hover:bg-slate-900 ${downloadingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
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
                              <FaDownload className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingIds.includes(item.id)}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-300 transition hover:bg-red-600/10 hover:text-white ${deletingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
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
                              <FaTrash className="h-4 w-4 text-red-500" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  ref={imageGalleryLoadMoreRef}
                  className="py-4 flex justify-center"
                >
                  {isImageGalleryLoadingMore ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <div className="h-4 w-4 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
                      Loading more images...
                    </div>
                  ) : imageGalleryHasMore ? (
                    <p className="text-slate-500 text-sm">
                      Scroll to load more images.
                    </p>
                  ) : (
                    <p className="text-slate-500 text-sm">
                      End of image gallery.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {historyPreviewItem !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-4 py-6">
            <div className="absolute inset-0" />
            <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Preview image
                  </h2>
                  <p className="text-sm text-slate-400">
                    Preview an image from clipboard history.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryPreviewItem(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
                  aria-label="Close preview"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="mx-auto max-h-[70vh] w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <Image
                    src={getImageSrc(historyPreviewItem.content)}
                    alt={historyPreviewItem.fileName ?? "Preview image"}
                    width={1200}
                    height={900}
                    unoptimized
                    className="mx-auto max-h-[62vh] w-full object-contain"
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleCopy(
                        historyPreviewItem.content,
                        historyPreviewItem.id,
                      );
                    }}
                    disabled={copyingIds.includes(historyPreviewItem.id)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${copyingIds.includes(historyPreviewItem.id) ? "bg-blue-500/70 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"}`}
                  >
                    {copyingIds.includes(historyPreviewItem.id) ? (
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
                    {copyingIds.includes(historyPreviewItem.id)
                      ? "Copying..."
                      : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadContent(
                        historyPreviewItem.content,
                        historyPreviewItem.fileName ??
                          getFileNameFromUrl(historyPreviewItem.content),
                        historyPreviewItem.id,
                      )
                    }
                    disabled={downloadingIds.includes(historyPreviewItem.id)}
                    className={`inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold transition ${downloadingIds.includes(historyPreviewItem.id) ? "bg-slate-800/70 text-slate-400 cursor-not-allowed" : "bg-slate-950 text-slate-200 hover:bg-slate-900"}`}
                  >
                    {downloadingIds.includes(historyPreviewItem.id) ? (
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
                    {downloadingIds.includes(historyPreviewItem.id)
                      ? "Downloading..."
                      : "Download"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {previewImage !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95">
            <div className="absolute inset-0" />
            <button
              type="button"
              onClick={() => setPreviewImageIndex(null)}
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950/90 text-slate-300 transition hover:border-slate-600 hover:text-white"
              aria-label="Close preview"
            >
              ×
            </button>
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-slate-950">
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

        {isFileGalleryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    File Gallery
                  </h2>
                  <p className="text-sm text-slate-400">
                    Browse your copied files in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFileGalleryOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
                  aria-label="Close file gallery"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
              <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-4">
                <input
                  type="text"
                  value={fileGallerySearch}
                  onChange={(event) => setFileGallerySearch(event.target.value)}
                  placeholder="Search files..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 outline-none transition focus:border-blue-500/50 focus:ring-blue-500/10"
                />
              </div>
              <div className="grid max-h-[72vh] gap-4 overflow-y-auto p-6 custom-scrollbar">
                {fileGalleryItems.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center text-slate-400">
                    {fileGallerySearch
                      ? "No files match your search."
                      : "No files available in the gallery."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fileGalleryItems.map((item, index) => (
                      <div
                        key={`${item.id}-${index}`}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="mb-3 flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {item.fileName ??
                                getFileNameFromUrl(item.content)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {getFileType(item.content) ?? "FILE"} ·{" "}
                              {getFileSize(item.content) ?? "Unknown size"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingIds.includes(item.id)}
                            className={`shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-300 transition hover:bg-red-600/10 hover:text-white ${deletingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                            title={
                              deletingIds.includes(item.id)
                                ? "Deleting..."
                                : "Delete file"
                            }
                            aria-label="Delete file"
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
                              <FaTrash className="h-4 w-4 text-red-500" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.content, item.id)}
                            disabled={copyingIds.includes(item.id)}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500 ${copyingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                            title={
                              copyingIds.includes(item.id)
                                ? "Copying..."
                                : "Copy URL"
                            }
                            aria-label="Copy URL"
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
                                  className="opacity-25"
                                />
                                <path d="M12 4v4" />
                              </svg>
                            ) : (
                              <FaCopy className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadContent(
                                item.content,
                                item.fileName ??
                                  getFileNameFromUrl(item.content),
                                item.id,
                              )
                            }
                            disabled={downloadingIds.includes(item.id)}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-200 transition hover:bg-slate-900 ${downloadingIds.includes(item.id) ? "cursor-not-allowed opacity-60" : ""}`}
                            title={
                              downloadingIds.includes(item.id)
                                ? "Downloading..."
                                : "Download file"
                            }
                            aria-label="Download file"
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
                                  className="opacity-25"
                                />
                                <path d="M12 4v4" />
                              </svg>
                            ) : (
                              <FaDownload className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  ref={fileGalleryLoadMoreRef}
                  className="py-4 flex justify-center"
                >
                  {isFileGalleryLoadingMore ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <div className="h-4 w-4 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
                      Loading more files...
                    </div>
                  ) : fileGalleryHasMore ? (
                    <p className="text-slate-500 text-sm">
                      Scroll to load more files.
                    </p>
                  ) : (
                    <p className="text-slate-500 text-sm">
                      End of file gallery.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 flex items-center gap-3">
            <span className="flex-shrink-0 text-red-400">⚠️</span>
            {error}
          </div>
        )}

        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-emerald-500/20 bg-slate-950/95 px-4 py-3 text-sm text-emerald-200 shadow-2xl backdrop-blur-sm transition-opacity duration-200">
            {toastMessage}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <main className="lg:col-span-2 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl min-h-[600px]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FaEdit className="h-5 w-5 text-blue-400" /> Live Editor
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex bg-slate-950 rounded-2xl p-1 border border-slate-800 mr-2">
                    <button
                      onClick={handleCopyAll}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${copied ? "text-emerald-400 bg-emerald-500/10" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}
                      title={
                        contentType === "image" ? "Copy image" : "Copy all text"
                      }
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
                      {copied
                        ? "Copied!"
                        : contentType === "image"
                          ? "Copy Image"
                          : "Copy All"}
                    </button>
                    <div className="w-px h-4 bg-slate-800 self-center" />
                    <button
                      onClick={handlePaste}
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
                          <rect
                            width="8"
                            height="4"
                            x="8"
                            y="2"
                            rx="1"
                            ry="1"
                          />
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        </svg>
                      )}
                      {pasted ? "Pasted!" : "Paste"}
                    </button>
                    <div className="w-px h-4 bg-slate-800 self-center" />
                    <button
                      onClick={handleClear}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition flex items-center gap-1.5"
                      title="Clear editor"
                    >
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
                      Clear
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
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative min-h-[400px] w-full overflow-hidden rounded-2xl border p-6 transition ${isDragActive ? "border-blue-400 bg-slate-900" : "border-slate-800 bg-slate-950"}`}
              >
                {contentType === "image" ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <Image
                      src={getImageSrc(content)}
                      alt="Pasted clipboard image"
                      width={800}
                      height={600}
                      unoptimized
                      className="max-h-[340px] w-full rounded-2xl object-contain"
                    />
                    <p className="mt-4 text-sm text-slate-400">
                      Image detected. Use the Paste button to replace the image
                      or Clear to reset.
                    </p>
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
                      onClick={() => downloadContent(content)}
                      className="mt-6 inline-flex items-center justify-center rounded-2xl border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      Download File
                    </button>
                  </div>
                ) : (
                  <textarea
                    value={content}
                    onChange={handleChange}
                    onPaste={handlePasteEvent}
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

          <aside className="space-y-6 flex flex-col h-[600px]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl flex flex-col h-full overflow-hidden">
              <div className="mb-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIsImageGalleryOpen(true)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      <FaImages className="h-4 w-4" /> Image Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFileGalleryOpen(true)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      <FaFileAlt className="h-4 w-4" /> File Gallery
                    </button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                                {new Date(item.createdAt).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                              {item.fileName && (
                                <span className="truncate max-w-[180px] text-xs text-slate-300">
                                  {item.fileName}
                                </span>
                              )}
                              {getFileType(item.content) && (
                                <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                                  {getFileType(item.content)}
                                </span>
                              )}
                              {getFileSize(item.content) && (
                                <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                                  {getFileSize(item.content)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1 pl-3">
                              <button
                                onClick={() =>
                                  handleCopy(item.content, item.id)
                                }
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
                              {isImageContent(item.content) && (
                                <button
                                  onClick={() => setHistoryPreviewItem(item)}
                                  className="rounded-lg bg-slate-700/20 p-2 text-slate-200 opacity-0 transition group-hover:opacity-100 hover:bg-slate-700 hover:text-white"
                                  title="Preview image"
                                  aria-label="Preview image"
                                >
                                  <FaEye className="h-4 w-4" />
                                </button>
                              )}
                              {(isRemoteFile(item.content) ||
                                item.content.startsWith("data:")) && (
                                <button
                                  onClick={() =>
                                    downloadContent(
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
                                onClick={() => handleDelete(item.id)}
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
                                  >
                                    <circle
                                      cx="12"
                                      cy="12"
                                      r="8"
                                      className="animate-spin"
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
                            </div>
                          ) : (
                            <p className="text-sm text-slate-300 line-clamp-3 break-words leading-relaxed">
                              {item.content || (
                                <span className="italic text-slate-600">
                                  (Empty)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div ref={loadMoreRef} className="py-4 flex justify-center">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <div className="h-4 w-4 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                      <span>Loading...</span>
                    </div>
                  )}
                  {!hasMore && history.length > 0 && (
                    <p className="text-slate-600 text-[10px] italic uppercase tracking-widest text-center w-full">
                      End of history
                    </p>
                  )}
                </div>
              </div>
            </section>
          </aside>
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
