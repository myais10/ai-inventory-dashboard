import Link from "@/components/ui/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Layout ----------

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex items-center gap-1.5 text-xs text-faint">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden>/</span>}
                  {c.href ? (
                    <Link href={c.href} className="hover:text-ink">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-muted">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-[22px] font-semibold leading-[30px] tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0 rounded-lg border border-line bg-surface shadow-card", className)} {...props} />;
}

/** Small bordered icon tile, as used on kit cards and the icon grid. */
export function IconTile({ icon: Icon, className, tone = "default" }: { icon: LucideIcon; className?: string; tone?: "default" | "brand" }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
        tone === "brand" ? "border-brand-500/30 bg-brand-50 text-brand-300" : "border-line bg-subtle text-muted",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
    </span>
  );
}

/** A titled section: compact header row + content. The standard container for page sections. */
export function Panel({
  title,
  icon,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 rounded-lg border border-line bg-surface shadow-card", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <IconTile icon={icon} />}
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold text-ink">{title}</h2>
            {description && <p className="truncate text-xs text-faint">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// ---------- Status tags ----------

export type Tone = "red" | "amber" | "orange" | "green" | "blue" | "slate" | "violet" | "brand" | "cyan";

// Kit "Status / Tags": dark tinted pill, colored dot, light label. Color never carries meaning alone.
const TONES: Record<Tone, string> = {
  red: "bg-red-500/10 text-red-300 ring-red-500/20",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  orange: "bg-orange-500/10 text-orange-300 ring-orange-500/20",
  green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
  blue: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
  slate: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
  violet: "bg-violet-500/10 text-violet-200 ring-violet-500/25",
  brand: "bg-brand-500/15 text-brand-200 ring-brand-500/30",
  cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20",
};

const DOTS: Record<Tone, string> = {
  red: "bg-red-400",
  amber: "bg-amber-400",
  orange: "bg-orange-400",
  green: "bg-emerald-400",
  blue: "bg-sky-400",
  slate: "bg-slate-400",
  violet: "bg-violet-400",
  brand: "bg-brand-300",
  cyan: "bg-cyan-400",
};

export function Badge({ tone = "slate", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", DOTS[tone], className)} aria-hidden />;
}

// ---------- Buttons ----------
// Hierarchy from the kit: primary (Call, Save, Create, Move) · secondary (Edit, Add note) ·
// tertiary text (Open, View) · danger. Only one primary per area.

type BtnVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand-500 text-white shadow-[0_1px_0_rgb(255_255_255/0.08)_inset] hover:bg-brand-500",
  secondary: "bg-subtle text-ink ring-1 ring-inset ring-line-strong hover:bg-[#1b1f2a] hover:ring-[#363e50]",
  tertiary: "text-brand-300 hover:bg-brand-50 hover:text-brand-200",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink",
  danger: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/30 hover:bg-red-500/20",
};
const SIZES = { sm: "h-7 px-2.5 text-xs gap-1.5", md: "h-8 px-3 text-[13px] gap-1.5", lg: "h-10 px-4 text-sm gap-2" };

export function buttonClass(variant: BtnVariant = "secondary", size: keyof typeof SIZES = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
    BTN[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: BtnVariant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Square icon-only button with an accessible label and hover tooltip. */
export function IconButton({
  label,
  icon: Icon,
  variant = "ghost",
  className,
  ...props
}: ComponentProps<"button"> & { label: string; icon: LucideIcon; variant?: BtnVariant }) {
  return (
    <button type="button" aria-label={label} title={label} className={buttonClass(variant, "md", cn("w-8 px-0", className))} {...props}>
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

// ---------- Data display ----------

/** Metric tile: label, big tabular number, optional delta/sub-line. */
export function Metric({ label, value, sub, className, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string; tone?: "warn" | "bad" }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("tabular mt-1 text-[22px] font-semibold leading-7 tracking-tight", tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-red-300" : "text-ink")}>{value}</dd>
      {sub && <dd className="mt-0.5 text-[11px] text-faint">{sub}</dd>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-subtle text-muted" aria-hidden>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      )}
      <div className="text-sm font-semibold text-ink">{title}</div>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Tables ----------

export const thClass = "whitespace-nowrap border-b border-line bg-subtle px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-faint";
export const tdClass = "border-b border-line/70 px-3 py-2 align-middle text-ink-2";

// ---------- Segmented tabs (link based) ----------

export function Tabs({ tabs, label }: { tabs: { href: string; label: ReactNode; count?: number; active: boolean; tone?: "red" }[]; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-0.5 relative overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
            t.active ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className={cn("tabular rounded-full px-1.5 text-[11px]", t.tone === "red" ? "bg-red-500/15 text-red-300" : t.active ? "bg-brand-500/20 text-brand-200" : "bg-subtle text-muted")}>
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
