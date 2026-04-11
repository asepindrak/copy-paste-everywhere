"use client";

interface DashboardToastProps {
  message: string;
}

export default function DashboardToast({ message }: DashboardToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-emerald-500/20 bg-slate-950/95 px-4 py-3 text-sm text-emerald-200 shadow-2xl backdrop-blur-sm transition-opacity duration-200">
      {message}
    </div>
  );
}
