"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import {
  FaSearch,
  FaTimes,
  FaSignOutAlt,
  FaFolder,
  FaClipboardList,
  FaUser,
} from "react-icons/fa";
import packageJson from "../../../../package.json";

interface DriveNavbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  workspaces: { id: string; name: string }[];
  selectedWorkspaceId: string | null;
  onWorkspaceChange: (id: string | null) => void;
}

export default function DriveNavbar({
  search,
  onSearchChange,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
}: DriveNavbarProps) {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const profileImage = session?.user?.image;
  const userInitial = (session?.user?.name || session?.user?.email || "U")
    .slice(0, 1)
    .toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-800/80 bg-[#060b12]/95 px-3 py-2.5 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left: Brand & Navigation Tabs */}
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Logo"
              width={34}
              height={34}
              className="rounded-xl ring-1 ring-slate-700/80"
            />
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold tracking-tight text-white sm:text-base">
                Copy Paste <span className="text-sky-400">Drive</span>
              </h1>
              <p className="text-[10px] text-slate-400">v{packageJson.version}</p>
            </div>
          </Link>

          {/* Tab Switcher: Clipboard Sync <-> Cloud Drive */}
          <div className="flex items-center rounded-xl bg-slate-900/90 p-1 border border-slate-800">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              <FaClipboardList className="h-3 w-3" />
              <span className="hidden md:inline">Clipboard</span>
            </Link>
            <div className="flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-medium text-sky-400 border border-sky-500/30 shadow-sm">
              <FaFolder className="h-3 w-3" />
              <span>Drive</span>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="relative flex-1 max-w-md hidden sm:block">
          <div className="relative flex items-center">
            <FaSearch className="absolute left-3.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search in Drive (files, folders)..."
              className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/90 py-2 pl-9 pr-8 text-xs text-white placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 text-slate-400 hover:text-white"
              >
                <FaTimes className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Workspace Selector & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Workspace select */}
          <select
            value={selectedWorkspaceId || ""}
            onChange={(e) => onWorkspaceChange(e.target.value || null)}
            aria-label="Select Workspace"
            className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-sky-500 focus:outline-none max-w-[140px] sm:max-w-[180px] truncate"
          >
            <option value="">👤 Personal Drive</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                🏢 {ws.name}
              </option>
            ))}
          </select>

          {/* Profile Menu */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-white transition hover:border-slate-500 sm:h-9 sm:w-9"
            >
              {profileImage ? (
                <Image
                  src={profileImage}
                  alt="Profile"
                  width={36}
                  height={36}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-slate-700 bg-[#0c1320] shadow-2xl z-50 animate-fadeIn">
                <div className="p-4 border-b border-slate-800">
                  <p className="text-xs font-semibold text-white truncate">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {session?.user?.email}
                  </p>
                </div>

                <div className="p-2">
                  <Link
                    href="/dashboard"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    <FaClipboardList className="h-3.5 w-3.5" />
                    Open Clipboard Sync
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition"
                  >
                    <FaSignOutAlt className="h-3.5 w-3.5" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="mt-2 block sm:hidden">
        <div className="relative flex items-center">
          <FaSearch className="absolute left-3.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Drive..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-1.5 pl-9 pr-8 text-xs text-white placeholder-slate-400 focus:border-sky-500 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 text-slate-400 hover:text-white"
            >
              <FaTimes className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
