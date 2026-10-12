import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeBadge } from "./badges";

const PRIORITY_STYLE = {
  high: { bar: "bg-red-500", label: "text-red-700", text: "High priority", dot: "bg-red-500" },
  medium: { bar: "bg-amber-400", label: "text-amber-700", text: "Medium priority", dot: "bg-amber-500" },
  low: { bar: "bg-slate-300", label: "text-slate-600", text: "Low priority", dot: "bg-slate-400" },
};

export function ActionCard({ rec }: { rec: Recommendation }) {
  const p = PRIORITY_STYLE[rec.priority];
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-md">
      <div className={cn("absolute inset-y-0 left-0 w-1", p.bar)} />
      <div className="py-4 pl-5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider", p.label)}>
            <span className={cn("h-2 w-2 rounded-full", p.dot)} />
            {p.text}
          </span>
          <TypeBadge type={rec.type} />
          {rec.sku && <span className="font-mono text-[11px] text-muted">{rec.sku}</span>}
        </div>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ink">{rec.title}</h3>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {rec.facts.slice(0, 4).map((f) => (
                <div key={f.label}>
                  <dt className="text-[11px] text-muted">{f.label}</dt>
                  <dd className="tabular text-[13px] font-medium text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] text-ink-2">
              <span className="font-medium text-ink">Why: </span>
              {rec.reasoning[0]} {rec.reasoning[1]}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 rounded-lg bg-subtle p-3 ring-1 ring-line md:w-[230px]">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Recommended action</div>
            <div className="text-sm font-semibold leading-snug text-ink">{rec.recommendation}</div>
            <div className="text-xs text-muted">{rec.impactLabel}</div>
            <Link
              href={`/recommendations/${rec.id}`}
              className="mt-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
            >
              Review recommendation <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
