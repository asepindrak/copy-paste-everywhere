"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("activeWorkspaceId");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (!response.ok) {
        setError(data.error || "Failed to create account. Please try again.");
        return;
      }

      setSuccess("Account created successfully. Redirecting to login...");
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      setIsLoading(false);
      setError("An error occurred. Please try again later.");
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-black/90 backdrop-blur-xl rounded-2xl border border-blue-700/30 shadow-2xl shadow-blue-500/10 p-8 text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt="Logo"
            width={80}
            height={80}
            className="rounded-2xl shadow-lg"
          />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-2 text-left">
          Sign Up
        </h1>
        <p className="text-sm text-gray-400 mb-8 text-left">
          Create a new account to start syncing your clipboard across all your
          devices.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-medium text-gray-200">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-blue-700/50 bg-slate-900/50 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-900 transition"
            />
          </label>

          <label className="block text-sm font-medium text-gray-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-blue-700/50 bg-slate-900/50 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-900 transition"
            />
          </label>

          <label className="block text-sm font-medium text-gray-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-blue-700/50 bg-slate-900/50 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-900 transition"
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {success ? (
            <p className="text-sm text-emerald-400">{success}</p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-semibold text-white transition hover:from-blue-500 hover:to-indigo-500 shadow-lg hover:shadow-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Processing..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-gray-300 hover:underline"
          >
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
