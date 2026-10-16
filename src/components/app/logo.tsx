import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-brand-500" />
      {/* Signal arcs: an outbound call */}
      <circle cx="11" cy="21" r="3" fill="#0c1117" />
      <path d="M11 13.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="#0c1117" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 7.5A13.5 13.5 0 0 1 24.5 21" fill="none" stroke="#0c1117" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-[15px] font-semibold tracking-tight", inverted ? "text-white" : "text-ink")}>Phoonica</span>
    </div>
  );
}
