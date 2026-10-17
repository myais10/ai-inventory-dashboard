import { ArrowRight, CalendarCheck, CheckCircle2, CircleDot, FileText, Handshake, Pencil, Phone, PhoneOff, Sparkles, UserRound } from "lucide-react";
import type { TimelineItem } from "@/lib/services/leads";
import { DispositionBadge } from "./lead-badges";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { LEAD_STATUS_MAP, DISPOSITION_MAP, type DispositionKey, type LeadStatus } from "@/lib/domain/dispositions";
import { cn } from "@/lib/utils";

function iconFor(a: TimelineItem["a"]) {
  if (a.type === "call") return DISPOSITION_MAP[a.disposition as DispositionKey]?.connected ? Phone : PhoneOff;
  if (a.type === "note") return FileText;
  if (a.type === "meeting_booked" || a.type === "meeting") return CalendarCheck;
  if (a.type === "deal_created" || a.type === "stage_change") return Handshake;
  if (a.type === "assignment") return UserRound;
  if (a.type === "task_completed") return CheckCircle2;
  if (a.type === "contact_updated") return Pencil;
  if (a.type === "created") return Sparkles;
  return CircleDot;
}

export function Timeline({ items, tz, showLead }: { items: (TimelineItem & { leadName?: string; leadId?: string | null })[]; tz: string; showLead?: boolean }) {
  if (!items.length) return <p className="px-5 py-8 text-center text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="relative px-5 py-2">
      {items.map(({ a, userName, leadName, leadId }) => {
        const Icon = iconFor(a);
        const meta = a.meta as Record<string, string | number | undefined>;
        const connected = a.type === "call" && DISPOSITION_MAP[a.disposition as DispositionKey]?.connected;
        return (
          <li key={a.id} className="relative flex gap-3 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line/60">
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                connected ? "bg-brand-50 text-brand-300" : a.type === "meeting_booked" || a.type === "deal_created" ? "bg-violet-500/10 text-violet-300" : "bg-subtle text-muted",
              )}
              aria-hidden
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-medium text-ink">{a.type === "call" ? "Call" : a.title}</span>
                {a.type === "call" && <DispositionBadge disposition={a.disposition} />}
                {a.type === "call" && meta.durationSec !== undefined && <span className="tabular text-xs text-muted">{fmtDuration(Number(meta.durationSec))}</span>}
                {showLead && leadName && leadId && (
                  <a href={`/leads/${leadId}`} className="text-xs font-medium text-brand-300 hover:underline">
                    {leadName}
                  </a>
                )}
                <span className="ml-auto whitespace-nowrap text-xs text-faint">
                  <time dateTime={a.occurredAt.toISOString()}>{fmtDateTime(a.occurredAt, tz)}</time>
                  {userName ? ` · ${userName}` : ""}
                </span>
              </div>
              {a.body && <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{a.body}</p>}
              {(meta.statusFrom || meta.summary || meta.stageFrom || meta.reason) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {meta.summary && <span>→ {meta.summary}</span>}
                  {meta.reason && <span>Reason: {meta.reason}</span>}
                  {meta.statusFrom && meta.statusTo && (
                    <span className="inline-flex items-center gap-1">
                      {LEAD_STATUS_MAP[meta.statusFrom as LeadStatus]?.label} <ArrowRight className="h-3 w-3" aria-label="to" /> {LEAD_STATUS_MAP[meta.statusTo as LeadStatus]?.label}
                    </span>
                  )}
                  {meta.stageFrom && (
                    <span className="inline-flex items-center gap-1">
                      {meta.stageFrom} <ArrowRight className="h-3 w-3" aria-label="to" /> {meta.stageTo}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
