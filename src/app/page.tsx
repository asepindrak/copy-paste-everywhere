"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          🔄 Copy Paste Everywhere
        </h1>
        <p className="text-gray-600 text-lg mb-8">
          Share your clipboard across all your devices instantly. No boundaries, no limits!
        </p>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📱</span>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Multi-Device Sync</h3>
              <p className="text-sm text-gray-600">Access your clipboard from phone, tablet, or desktop</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Real-Time</h3>
              <p className="text-sm text-gray-600">Updates instantly via WebSocket technology</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Private</h3>
              <p className="text-sm text-gray-600">Your data is yours alone, fully encrypted</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="bg-gray-200 text-gray-800 font-medium py-3 rounded-lg hover:bg-gray-300 transition"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
