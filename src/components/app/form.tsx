"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        {hint}
      </div>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Kit input: surface fill, 1px border, purple focus ring.
export const inputClass =
  "w-full rounded-md border bg-subtle px-3 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50";

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input className={cn(inputClass, "h-9", invalid ? "border-red-500/60" : "border-line-strong", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "h-9 border-line-strong pr-8", className)} {...props} />;
}

export function SubmitButton({ children, className, variant = "primary" }: { children: ReactNode; className?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, "lg", cn("w-full", className))}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-md px-3 py-2.5 text-[13px] ring-1 ring-inset", tone === "error" ? "bg-red-500/10 text-red-200 ring-red-500/25" : "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25")}
    >
      {children}
    </div>
  );
}
