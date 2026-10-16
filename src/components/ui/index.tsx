import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// ---------- Layout ----------

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0 rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-line px-5 py-3.5", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 text-muted">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Badges ----------

export type Tone = "red" | "amber" | "orange" | "green" | "blue" | "slate" | "violet" | "brand";

const TONES: Record<Tone, string> = {
  red: "bg-red-50 text-red-700 ring-red-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15",
};

const DOTS: Record<Tone, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  slate: "bg-slate-400",
  violet: "bg-violet-500",
  brand: "bg-brand-500",
};

export function Badge({ tone = "slate", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", DOTS[tone])} />;
}

// ---------- Buttons ----------

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-900",
  secondary: "bg-white text-ink-2 ring-1 ring-inset ring-line-strong shadow-sm hover:bg-subtle",
  ghost: "text-ink-2 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};
const SIZES = { sm: "h-7 px-2.5 text-xs gap-1.5", md: "h-9 px-3.5 text-sm gap-2", lg: "h-11 px-5 text-sm gap-2" };

export function buttonClass(variant: BtnVariant = "secondary", size: keyof typeof SIZES = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    BTN[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ---------- Data display ----------

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-0.5 text-sm font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand", className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full", DOTS[tone])} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-muted">{icon}</div>}
      <div className="text-sm font-semibold text-ink">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Tables ----------

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("scroll-thin overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ className, align, ...props }: ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-[1] whitespace-nowrap border-b border-line bg-subtle px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted first:pl-5 last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, align, ...props }: ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "border-b border-line/70 px-3 py-2.5 align-middle text-ink-2 first:pl-5 last:pr-5",
        align === "right" && "tabular text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

// ---------- Tabs (link based) ----------

export function LinkTabs({ tabs, active }: { tabs: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <div className="scroll-thin mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === t.href ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("rounded-full px-1.5 text-[11px] tabular", active === t.href ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-muted")}>{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function TrendPill({ pct, inverse }: { pct: number; inverse?: boolean }) {
  const up = pct > 0.005;
  const down = pct < -0.005;
  const good = inverse ? down : up;
  const bad = inverse ? up : down;
  return (
    <span className={cn("tabular inline-flex items-center text-xs font-medium", good && "text-emerald-600", bad && "text-red-600", !up && !down && "text-muted")}>
      {up ? "▲" : down ? "▼" : "•"} {Math.abs(pct * 100).toFixed(0)}%
    </span>
  );
}
