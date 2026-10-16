import { Badge } from "@/components/ui";
import { DISPOSITION_MAP, LEAD_STATUS_MAP, type DispositionKey, type LeadStatus } from "@/lib/domain/dispositions";
import { scoreTier } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: LeadStatus }) {
  const s = LEAD_STATUS_MAP[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tier = scoreTier(score);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`${tier.label} lead · score ${score}/100`}>
      <span className="tabular w-6 text-right text-[13px] font-semibold text-ink">{score}</span>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", tier.tone === "green" ? "bg-emerald-500" : tier.tone === "amber" ? "bg-amber-400" : "bg-slate-300")}
          style={{ width: `${score}%` }}
        />
      </span>
      <span className="sr-only">{tier.label}</span>
    </span>
  );
}

export function DispositionBadge({ disposition }: { disposition: string | null }) {
  if (!disposition) return null;
  const d = DISPOSITION_MAP[disposition as DispositionKey];
  if (!d) return <Badge>{disposition}</Badge>;
  return <Badge tone={d.tone}>{d.label}</Badge>;
}
