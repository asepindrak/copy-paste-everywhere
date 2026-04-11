"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Copy Paste Everywhere logo"
                width={150}
                height={150}
                className="rounded-xl"
              />
              <div className="flex flex-col">
                <span className="text-3xl font-extrabold text-cyan-500 sm:text-4xl">
                  Copy Paste
                </span>
                <span className="text-lg font-semibold text-blue-500 sm:text-xl">
                  Everywhere
                </span>
              </div>
            </div>
            <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-transparent bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text sm:text-5xl animated-gradient-text">
              Sync your clipboard across text, images, videos, and files.
            </h1>
            <p className="mt-6 max-w-2xl text-xl font-semibold text-slate-300">
              Sync text, images, videos, and files across devices in real time.
              Browse your clipboard history, preview media, download files, and
              collaborate in shared workspaces.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Get started
              </Link>
              <Link
                href="/signup"
                className="inline-flex rounded-2xl gradient-border animate-border"
              >
                <span className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
                  Create free account
                </span>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl gradient-border animate-border shadow-sm shadow-cyan-500/10 backdrop-blur-sm">
            <div className="rounded-2xl bg-slate-950 p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Live preview
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    Real-time Clipboard
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Realtime
                </span>
              </div>
              <div className="space-y-5 p-5">
                <p className="text-sm text-slate-400 max-w-2xl">
                  Text, images, videos, or files are sent instantly and
                  preserved in your history.
                </p>
                <div className="space-y-3 border-t border-slate-800/60 pt-4">
                  <div className="border-b border-slate-800/60 pb-4 last:border-b-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Editor
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Write or paste text, images, or videos, then sync
                      immediately.
                    </p>
                  </div>
                  <div className="border-b border-slate-800/60 pb-4 last:border-b-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Image Gallery
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Browse copied images, preview full-size, and copy/download
                      with one click.
                    </p>
                  </div>
                  <div className="border-b border-slate-800/60 pb-4 last:border-b-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Video Support
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Preview copied videos, play them inline, and save or
                      download media from your clipboard history.
                    </p>
                  </div>
                  <div className="pb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      File Gallery
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Search files, view file metadata, and download any
                      clipboard item.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-16 grid gap-6 lg:grid-cols-3 items-stretch">
          <div className="rounded-2xl gradient-border animate-border h-full">
            <div className="rounded-2xl bg-slate-950 p-6 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-white">
                What you can do
              </h3>
              <ul className="mt-6 space-y-4 text-sm text-slate-300">
                <li>
                  • Copy and paste text, images, videos, or files in one unified
                  clipboard.
                </li>
                <li>
                  • Drag & drop files and videos to upload and sync instantly.
                </li>
                <li>
                  • Browse clipboard history with search and media preview
                  support.
                </li>
                <li>
                  • Download shared files, images, and videos directly from the
                  dashboard.
                </li>
                <li>
                  • Create workspaces, invite teammates, and sync within shared
                  groups.
                </li>
              </ul>
            </div>
          </div>
          <div className="rounded-2xl gradient-border animate-border h-full">
            <div className="rounded-2xl bg-slate-950 p-6 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-white">
                Built for teams
              </h3>
              <p className="mt-6 text-sm leading-7 text-slate-300">
                Workspaces let you isolate clipboard data for teams and
                projects. Invite teammates, share files securely, and keep
                everything synced across devices.
              </p>
            </div>
          </div>
          <div className="rounded-2xl gradient-border animate-border h-full">
            <div className="rounded-2xl bg-slate-950 p-6 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-white">
                Secure & scalable
              </h3>
              <p className="mt-6 text-sm leading-7 text-slate-300">
                Powered by Next.js, Socket.io, Prisma, and optional
                S3-compatible uploads for reliable storage and fast clipboard
                delivery.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-2xl gradient-border animate-border">
          <div className="rounded-2xl bg-slate-950 p-8">
            <h2 className="text-2xl font-semibold text-white">
              Dashboard features included
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl gradient-border animate-border">
                <div className="rounded-xl bg-slate-950 p-6">
                  <h4 className="text-base font-semibold text-white">
                    Clipboard History
                  </h4>
                  <p className="mt-3 text-sm text-slate-300">
                    Review past items, copy them back, or delete entries with a
                    single click.
                  </p>
                </div>
              </div>
              <div className="rounded-xl gradient-border animate-border">
                <div className="rounded-xl bg-slate-950 p-6">
                  <h4 className="text-base font-semibold text-white">
                    Image Gallery
                  </h4>
                  <p className="mt-3 text-sm text-slate-300">
                    View your image history, open previews, and copy or download
                    images instantly.
                  </p>
                </div>
              </div>
              <div className="rounded-xl gradient-border animate-border">
                <div className="rounded-xl bg-slate-950 p-6">
                  <h4 className="text-base font-semibold text-white">
                    File Gallery
                  </h4>
                  <p className="mt-3 text-sm text-slate-300">
                    Search copied files, review metadata, and download files
                    from your clipboard history.
                  </p>
                </div>
              </div>
              <div className="rounded-xl gradient-border animate-border">
                <div className="rounded-xl bg-slate-950 p-6">
                  <h4 className="text-base font-semibold text-white">
                    Video Gallery
                  </h4>
                  <p className="mt-3 text-sm text-slate-300">
                    Play and preview copied videos, then download or save them
                    directly from your clipboard history.
                  </p>
                </div>
              </div>
              <div className="rounded-xl gradient-border animate-border">
                <div className="rounded-xl bg-slate-950 p-6">
                  <h4 className="text-base font-semibold text-white">
                    Workspace Collaboration
                  </h4>
                  <p className="mt-3 text-sm text-slate-300">
                    Create shared spaces for teammates, invite collaborators,
                    and sync clipboard content selectively.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
