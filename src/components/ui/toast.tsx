"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  tone: "success" | "error";
  text: string;
}

const Ctx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] text-ink shadow-elevated animate-fade-in",
              t.tone === "success" ? "border-line bg-subtle" : "border-red-500/40 bg-[#2a1215]",
            )}
          >
            {t.tone === "success" ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-400" aria-hidden /> : <AlertCircle className="mt-px h-4 w-4 shrink-0 text-red-400" aria-hidden />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
