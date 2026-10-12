import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <path d="M8 21.5 13 16l4 3.5 7-8.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="11" r="2.2" fill="white" />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className={cn("text-[13px] font-semibold tracking-tight", inverted ? "text-white" : "text-ink")}>Inventory Intelligence</div>
        <div className={cn("text-[10.5px]", inverted ? "text-white/60" : "text-muted")}>AI Inventory & Demand</div>
      </div>
    </div>
  );
}
