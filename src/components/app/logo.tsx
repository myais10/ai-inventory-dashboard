import { useId } from "react";
import { cn } from "@/lib/utils";

/** The Phoonica mark: a rounded "play" form with sound bars — conversations into revenue. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" className={cn("h-7 w-7", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="34" y1="4" x2="6" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C4B5FD" />
          <stop offset="0.45" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <path d="M15.5 6.2c0-3 3.2-4.8 5.8-3.3l14.4 8.6c2.6 1.5 2.6 5.2 0 6.8L21.3 26.9c-2.6 1.5-5.8-.3-5.8-3.3Z" fill={`url(#${id})`} />
      <rect x="15.5" y="15" width="4.6" height="22" rx="2.3" fill={`url(#${id})`} />
      <rect x="8.6" y="18.5" width="4.2" height="14" rx="2.1" fill={`url(#${id})`} opacity="0.85" />
      <rect x="2.2" y="22" width="3.8" height="7.5" rx="1.9" fill={`url(#${id})`} opacity="0.65" />
    </svg>
  );
}

export function Logo({ className, tagline }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-none">
        <span className="text-[17px] font-bold tracking-tight text-ink">Phoonica</span>
        {tagline && <span className="mt-1 block text-[8.5px] font-medium tracking-[0.28em] text-muted">CONVERSATIONS INTO REVENUE</span>}
      </div>
    </div>
  );
}
