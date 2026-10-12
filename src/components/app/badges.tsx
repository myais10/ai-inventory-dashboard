import { Badge, type Tone } from "@/components/ui";
import { STATUS_META } from "@/lib/inventory";
import { STATUS_LABEL, TYPE_META } from "@/lib/recommendations";
import type { DemandTrend, Priority, RecommendationStatus, RecommendationType, RiskLevel, StockStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY: Record<Priority, { tone: Tone; label: string }> = {
  high: { tone: "red", label: "High" },
  medium: { tone: "amber", label: "Medium" },
  low: { tone: "slate", label: "Low" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY[priority].tone} dot>
      {PRIORITY[priority].label}
    </Badge>
  );
}

const TYPE_TONE: Record<RecommendationType, Tone> = {
  reorder: "brand",
  stockout_risk: "red",
  excess_stock: "violet",
  slow_stock: "blue",
  lost_demand: "orange",
  supplier_issue: "amber",
};

export function TypeBadge({ type }: { type: RecommendationType }) {
  return <Badge tone={TYPE_TONE[type]}>{TYPE_META[type].label}</Badge>;
}

const REC_STATUS_TONE: Record<RecommendationStatus, Tone> = {
  new: "brand",
  in_review: "amber",
  approved: "green",
  dismissed: "slate",
  completed: "green",
};

export function RecStatusBadge({ status }: { status: RecommendationStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          REC_STATUS_TONE[status] === "brand" && "bg-brand-500",
          REC_STATUS_TONE[status] === "amber" && "bg-amber-500",
          REC_STATUS_TONE[status] === "green" && "bg-emerald-500",
          REC_STATUS_TONE[status] === "slate" && "bg-slate-400",
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>;
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map: Record<RiskLevel, { tone: Tone; label: string }> = {
    high: { tone: "red", label: "High" },
    medium: { tone: "orange", label: "Medium" },
    low: { tone: "amber", label: "Low" },
    none: { tone: "green", label: "None" },
  };
  return (
    <Badge tone={map[risk].tone} dot>
      {map[risk].label}
    </Badge>
  );
}

export function TrendIndicator({ trend, pct }: { trend: DemandTrend; pct?: number }) {
  const cls = trend === "increasing" ? "text-emerald-600" : trend === "declining" ? "text-red-600" : "text-muted";
  const arrow = trend === "increasing" ? "↗" : trend === "declining" ? "↘" : "→";
  return (
    <span className={cn("tabular inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium", cls)}>
      <span className="text-sm leading-none">{arrow}</span>
      {pct !== undefined && Math.abs(pct) >= 0.01 ? `${pct > 0 ? "+" : ""}${(pct * 100).toFixed(0)}%` : trend === "stable" ? "Stable" : ""}
    </span>
  );
}
