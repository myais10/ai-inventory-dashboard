"use client";

import Link from "@/components/ui/link";
import { useEffect, useState, useTransition } from "react";
import { AlertCircle, ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime, fmtMoney, fmtRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { moveDealAction } from "./actions";

export const LOST_REASONS = ["Chose competitor", "No budget", "Went dark", "Timing — revisit later", "Too complex for their team", "Other"];

interface StageT {
  id: string;
  name: string;
  probability: number;
  kind: "open" | "won" | "lost";
}

export interface CardDeal {
  id: string;
  name: string;
  stageId: string;
  value: number;
  company: string | null;
  contact: string | null;
  owner: string | null;
  ownerId: string | null;
  stageChangedAt: string;
  nextStep: string | null;
  nextMeetingAt: string | null;
  overdueTasks: number;
  closedAt: string | null;
  lostReason: string | null;
  lastActivityAt: string | null;
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function Board({ stages, deals: initial, tz, userId, isManager }: { stages: StageT[]; deals: CardDeal[]; tz: string; userId: string; isManager: boolean }) {
  const toast = useToast();
  const [deals, setDeals] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<{ dealId: string; stageId: string } | null>(null);
  const [justMoved, setJustMoved] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setDeals(initial), [initial]);

  const canMove = (d: CardDeal) => isManager || d.ownerId === userId;

  const move = (dealId: string, stageId: string, reason?: string) => {
    const deal = deals.find((d) => d.id === dealId);
    const to = stages.find((s) => s.id === stageId);
    if (!deal || !to || deal.stageId === stageId) return;
    if (!canMove(deal)) return toast("error", "Only the deal owner or a manager can move this deal");
    if (to.kind === "lost" && !reason) return setLostFor({ dealId, stageId });
    const prev = deals;
    setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stageId, stageChangedAt: new Date().toISOString(), closedAt: to.kind === "open" ? null : new Date().toISOString(), lostReason: reason ?? null } : d)));
    start(async () => {
      const r = await moveDealAction(dealId, stageId, reason);
      if (r.ok) {
        toast("success", `${deal.company ?? deal.name} → ${to.name}`);
        setJustMoved(dealId);
      }
      else {
        setDeals(prev);
        toast("error", r.error);
      }
    });
  };

  return (
    <>
      <div className="-mx-4 flex flex-1 gap-2.5 relative overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" role="list" aria-label="Pipeline stages">
        {stages.map((stage) => {
          const items = deals.filter((d) => d.stageId === stage.id);
          const total = items.reduce((a, d) => a + d.value, 0);
          const closed = stage.kind !== "open";
          return (
            <section
              key={stage.id}
              role="listitem"
              aria-label={`${stage.name}: ${items.length} deals, ${fmtMoney(total)}`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, stage.id);
                setDragId(null);
                setOverStage(null);
              }}
              className={cn(
                "flex w-[268px] shrink-0 flex-col rounded-lg border bg-surface transition-colors",
                closed && "w-[220px]",
                overStage === stage.id ? "border-brand-500 bg-brand-50" : "border-line",
              )}
            >
              <header className="border-b border-line px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <span className={cn("h-2 w-2 rounded-full", stage.kind === "won" ? "bg-emerald-400" : stage.kind === "lost" ? "bg-red-400" : "bg-brand-300")} aria-hidden />
                    {stage.name}
                  </h2>
                  <span className="tabular rounded-full bg-subtle px-1.5 text-[11px] text-muted">{items.length}</span>
                </div>
                <div className="tabular mt-1 flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-ink">{fmtMoney(total, true)}</span>
                  <span className="text-faint">{stage.kind === "open" ? `${stage.probability}% · ${fmtMoney((total * stage.probability) / 100, true)} weighted` : "last 30 days"}</span>
                </div>
              </header>
              <ol className="flex-1 space-y-1.5 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 290px)" }}>
                {items.length === 0 && <li className="rounded-md border border-dashed border-line px-2 py-6 text-center text-xs text-faint">{closed ? "None in the last 30 days" : "Drop deals here"}</li>}
                {items.map((d) => {
                  const age = daysSince(d.stageChangedAt);
                  const stale = !closed && age >= 14;
                  return (
                    <li
                      key={d.id}
                      draggable={canMove(d)}
                      onDragStart={(e) => {
                        setDragId(d.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      onAnimationEnd={() => justMoved === d.id && setJustMoved(null)}
                      className={cn(
                        "rounded-md border border-line bg-subtle p-2.5 transition-colors hover:border-line-strong",
                        canMove(d) && "cursor-grab active:cursor-grabbing",
                        dragId === d.id && "opacity-40",
                        justMoved === d.id && "animate-flash",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/pipeline/${d.id}`} className="min-w-0 text-[13px] font-medium leading-snug text-ink hover:text-brand-200">
                          {d.company ?? d.name}
                        </Link>
                        <span className="tabular shrink-0 text-[13px] font-semibold text-ink">{fmtMoney(d.value, true)}</span>
                      </div>
                      {d.contact && <div className="mt-0.5 truncate text-xs text-muted">{d.contact}</div>}
                      {!closed && (
                        <div className="mt-2 space-y-1 text-[11.5px]">
                          {d.nextMeetingAt ? (
                            <div className="flex items-center gap-1.5 text-violet-300" suppressHydrationWarning>
                              <CalendarClock className="h-3 w-3 shrink-0" aria-hidden /> Meeting {fmtDateTime(d.nextMeetingAt, tz, { weekday: true, date: true, time: true })}
                            </div>
                          ) : d.nextStep ? (
                            <div className="flex items-center gap-1.5 text-ink-2">
                              <ArrowRight className="h-3 w-3 shrink-0 text-faint" aria-hidden />
                              <span className="truncate">{d.nextStep}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-300">
                              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden /> No next step
                            </div>
                          )}
                          {d.lastActivityAt && (
                            <div className="text-faint" suppressHydrationWarning>
                              Last activity {fmtRelative(d.lastActivityAt)}
                            </div>
                          )}
                          {d.overdueTasks > 0 && (
                            <div className="flex items-center gap-1.5 text-red-300">
                              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden /> {d.overdueTasks} overdue task{d.overdueTasks > 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      )}
                      {closed && d.lostReason && <div className="mt-1 truncate text-[11.5px] text-muted">{d.lostReason}</div>}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-200" title={d.owner ?? ""}>
                            {d.owner ? initials(d.owner) : "?"}
                          </span>
                          <span className={cn("truncate text-[11px]", stale ? "font-medium text-amber-300" : "text-faint")} suppressHydrationWarning>
                            {closed ? (d.closedAt ? `Closed ${fmtRelative(d.closedAt)}` : "") : `${age}d in stage`}
                          </span>
                        </span>
                        {canMove(d) && (
                          <>
                            <label htmlFor={`mv-${d.id}`} className="sr-only">
                              Move {d.company ?? d.name} to stage
                            </label>
                            <select
                              id={`mv-${d.id}`}
                              value={d.stageId}
                              onChange={(e) => move(d.id, e.target.value)}
                              className="h-6 max-w-[96px] shrink-0 rounded border border-line-strong bg-surface px-1 text-[11px] text-ink-2"
                            >
                              {stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.id === d.stageId ? "Move to…" : s.name}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      <LostReasonDialog
        open={!!lostFor}
        onClose={() => setLostFor(null)}
        onPick={(r) => {
          if (lostFor) move(lostFor.dealId, lostFor.stageId, r);
          setLostFor(null);
        }}
      />
    </>
  );
}

export function LostReasonDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (r: string) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Why was this deal lost?" description="Lost reasons feed the win/loss breakdown in Analytics.">
      <div className="grid grid-cols-2 gap-2">
        {LOST_REASONS.map((r, i) => (
          <Button key={r} onClick={() => onPick(r)} data-autofocus={i === 0 ? true : undefined}>
            {r}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
