"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-white p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-ink">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted">We couldn&apos;t load this page. Your data is safe — please try again.</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-faint">Ref: {error.digest}</p>}
      <button type="button" onClick={reset} className="mt-5 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
        Try again
      </button>
    </div>
  );
}
