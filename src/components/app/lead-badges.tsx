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

export const TEMP_TEXT = { orange: "text-orange-300", amber: "text-amber-300", blue: "text-sky-300" } as const;
const TEMP_DOT = { orange: "bg-orange-400", amber: "bg-amber-400", blue: "bg-sky-400" } as const;

/** Score + Hot/Warm/Cold temperature. The score number carries the detail; the word carries the priority. */
export function ScoreBadge({ score, className, compact }: { score: number; className?: string; compact?: boolean }) {
  const tier = scoreTier(score);
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`${tier.label} lead · score ${score}/100`}>
      <span className="tabular w-6 text-right text-[13px] font-semibold text-ink">{score}</span>
      {!compact && (
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", TEMP_TEXT[tier.tone])}>
          <span className={cn("h-1.5 w-1.5 rounded-full", TEMP_DOT[tier.tone])} aria-hidden />
          {tier.label}
        </span>
      )}
      {compact && <span className="sr-only">{tier.label}</span>}
    </span>
  );
}

export function TempBadge({ score }: { score: number }) {
  const tier = scoreTier(score);
  return (
    <Badge tone={tier.tone} dot>
      {tier.label}
    </Badge>
  );
}

export function DispositionBadge({ disposition }: { disposition: string | null }) {
  if (!disposition) return null;
  const d = DISPOSITION_MAP[disposition as DispositionKey];
  if (!d) return <Badge>{disposition}</Badge>;
  return <Badge tone={d.tone}>{d.label}</Badge>;
}
