import Link from "@/components/ui/link";
import { PERIODS } from "@/lib/period";
import { cn } from "@/lib/utils";

export function PeriodTabs({ value, base, extra = "", exclude = [] }: { value: string; base: string; extra?: string; exclude?: string[] }) {
  return (
    <nav aria-label="Period" className="inline-flex rounded-lg border border-line bg-white p-0.5">
      {PERIODS.filter((p) => !exclude.includes(p.key)).map((p) => (
        <Link
          key={p.key}
          href={`${base}?period=${p.key}${extra}`}
          aria-current={p.key === value ? "page" : undefined}
          className={cn("rounded-md px-3 py-1 text-[13px] font-medium", p.key === value ? "bg-night text-white" : "text-muted hover:text-ink")}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

/** Change vs. the comparison period, as text + arrow (never color alone). */
export function Delta({ now, prev, pct, money }: { now: number; prev: number; pct?: boolean; money?: boolean }) {
  if (!prev && !now) return <span className="text-faint">—</span>;
  const diff = now - prev;
  const up = diff > 0;
  const flat = Math.abs(diff) < (pct ? 0.005 : 0.5);
  const text = pct
    ? `${Math.abs(diff * 100).toFixed(1)} pts`
    : prev
      ? `${Math.abs(Math.round((diff / prev) * 100))}%`
      : money
        ? "new"
        : `+${Math.round(now)}`;
  return (
    <span className={cn("font-medium", flat ? "text-muted" : up ? "text-emerald-700" : "text-red-700")}>
      {flat ? "→ flat" : `${up ? "▲" : "▼"} ${text}`}
    </span>
  );
}
