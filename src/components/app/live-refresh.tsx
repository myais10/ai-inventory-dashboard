"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Re-fetches the page's server data on an interval while the tab is visible, and says when it last did. */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState(() => Date.now());
  const [, tick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      start(() => router.refresh());
      setAt(Date.now());
    };
    const t = setInterval(refresh, seconds * 1000);
    const c = setInterval(() => tick((n) => n + 1), 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      clearInterval(c);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);

  const ago = Math.round((Date.now() - at) / 1000);
  return (
    <button
      type="button"
      onClick={() => {
        start(() => router.refresh());
        setAt(Date.now());
      }}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-xs text-muted hover:text-ink"
      title="Refresh now"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span suppressHydrationWarning>Live · {pending ? "updating…" : ago < 5 ? "just updated" : `updated ${ago}s ago`}</span>
      <RefreshCw className={cn("h-3 w-3", pending && "animate-spin")} aria-hidden />
    </button>
  );
}
