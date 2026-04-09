"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import Image from "next/image";

interface CopyItem {
  id: string;
  content: string;
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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [content, setContent] = useState("");
  const [history, setHistory] = useState<CopyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);

  // Search and Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const lastContentRef = useRef(content);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const isAuthenticated = status === "authenticated";

  // Use a more stable socket URL
  const socketUrl = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOCKET_URL)
      return process.env.NEXT_PUBLIC_SOCKET_URL;
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadHistory = useCallback(
    async (
      cursor: string | null = null,
      isInitial: boolean = false,
      currentSearch: string = "",
    ) => {
      if (isLoadingMore || (!hasMore && !isInitial)) return;

      setIsLoadingMore(true);
      try {
        const url = new URL("/api/copy-items", window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (currentSearch) url.searchParams.set("search", currentSearch);
        url.searchParams.set("limit", "20");

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to load copy history.");

        const data: FetchHistoryResponse = await res.json();

        if (isInitial) {
          setHistory(data.items);
          // Only set content on truly initial load (not search)
          if (data.items.length > 0 && !currentSearch && !cursor) {
            setContent(data.items[0].content);
            lastContentRef.current = data.items[0].content;
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
    [isLoadingMore, hasMore],
  );

  // Initial load or search change
  useEffect(() => {
    if (isAuthenticated) {
      setHasMore(true);
      loadHistory(null, true, debouncedSearch);
    }
  }, [isAuthenticated, debouncedSearch]);

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
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setIsConnected(false);
      setError(`Realtime connection issue: ${err.message}`);
    });

    socket.on("clipboard:updated", (item: CopyItem) => {
      console.log("Received update:", item);

      // Only add to history if content is not empty
      if (item.content.trim()) {
        // Only add to history if it matches current search (or no search)
        if (
          !debouncedSearch ||
          item.content.toLowerCase().includes(debouncedSearch.toLowerCase())
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
        lastContentRef.current = item.content;
      }

      setLastSavedAt(new Date(item.createdAt).toLocaleTimeString());
      setIsSaving(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    return () => {
      console.log("Cleaning up socket connection");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, socketUrl, debouncedSearch]);

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
          { content: nextContent },
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
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = event.target.value;
    setContent(val);
    debouncedUpdate(val);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Failed to copy to clipboard. Please allow clipboard access.");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      debouncedUpdate(text);
      setError(null);

      setPasted(true);
      setTimeout(() => setPasted(false), 2000);
    } catch {
      setError("Failed to read clipboard. Please allow clipboard access.");
    }
  };

  const handleCopyAll = () => {
    handleCopy(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setContent("");
    debouncedUpdate("");
  };

  const handleDelete = async (id: string) => {
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
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-xl font-medium animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={70}
                  height={70}
                  className="rounded-2xl shadow-xl"
                />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  Copy Paste <span className="text-blue-500">Everywhere</span>
                </h1>
                <p className="max-w-2xl text-lg text-slate-400">
                  Synchronize clipboard across devices privately and in
                  real-time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-slate-950/50 p-4 border border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">
                  {session?.user?.email}
                </p>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-xs text-red-400 hover:text-red-300 transition"
                >
                  Logout
                </button>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                {session?.user?.email?.[0].toUpperCase()}
              </div>
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

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 flex items-center gap-3">
            <span className="flex-shrink-0 text-red-400">⚠️</span>
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <main className="lg:col-span-2 space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <span>📝</span> Live Editor
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 mr-2">
                    <button
                      onClick={handleCopyAll}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${copied ? "text-emerald-400 bg-emerald-500/10" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}
                      title="Copy all text"
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
                      {copied ? "Copied!" : "Copy All"}
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
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
                    Auto-save
                  </span>
                </div>
              </div>

              <textarea
                value={content}
                onChange={handleChange}
                placeholder="Write or paste text here..."
                className="min-h-[400px] w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-6 text-lg text-slate-200 placeholder-slate-600 outline-none transition focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 shadow-inner"
              />
            </section>
          </main>

          <aside className="space-y-6 flex flex-col h-[600px]">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl flex flex-col h-full overflow-hidden">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span>🕒</span> History
                </h2>

                {/* Search Input */}
                <div className="relative group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search history..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-blue-500/50 transition"
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
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="group relative rounded-2xl border border-slate-800 bg-slate-950 p-4 transition hover:border-blue-500/30 hover:bg-slate-900/50"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {new Date(item.createdAt).toLocaleDateString()}{" "}
                              {new Date(item.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleCopy(item.content)}
                                className="rounded-lg bg-blue-600/10 p-2 text-blue-400 opacity-0 transition group-hover:opacity-100 hover:bg-blue-600 hover:text-white"
                                title="Copy to clipboard"
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
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="rounded-lg bg-red-600/10 p-2 text-red-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-600 hover:text-white"
                                title="Delete item"
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
                                  <line x1="10" x2="10" y1="11" y2="17" />
                                  <line x1="14" x2="14" y1="11" y2="17" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-3 break-words leading-relaxed">
                            {item.content || (
                              <span className="italic text-slate-600">
                                (Empty)
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Infinite scroll loader element */}
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
                  </>
                )}
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
