"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden />
      <h1 className="mt-3 text-base font-semibold text-ink">Something went wrong loading this page</h1>
      <p className="mt-1 max-w-md text-sm text-muted">{error.message || "Unexpected error."}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md border border-line-strong bg-subtle px-3 py-1.5 text-sm font-medium text-ink hover:border-[#363e50]">
        Try again
      </button>
    </div>
  );
}
