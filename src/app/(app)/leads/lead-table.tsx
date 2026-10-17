"use client";

import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Ban, Phone, PhoneCall, PhoneOff, SearchX } from "lucide-react";
import type { LeadListRow } from "@/lib/services/leads";
import { DispositionBadge, ScoreBadge, StatusBadge } from "@/components/app/lead-badges";
import { Kbd, useShortcuts } from "@/components/app/shortcuts";
import { useToast } from "@/components/ui/toast";
import { Button, EmptyState, thClass } from "@/components/ui";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assignLeadsAction } from "./actions";

function NextAction({ r, tz }: { r: LeadListRow; tz: string }) {
  if (r.doNotCall) return <span className="inline-flex items-center gap-1 text-xs text-red-300"><Ban className="h-3 w-3" aria-hidden /> Do not call</span>;
  if (r.phoneInvalid) return <span className="inline-flex items-center gap-1 text-xs text-red-300"><PhoneOff className="h-3 w-3" aria-hidden /> Fix phone number</span>;
  if (r.status === "qualified" && r.nextActionType === "none") return <span className="text-xs text-violet-300">Work the deal</span>;
  if (r.status === "converted") return <span className="text-xs text-faint">Customer</span>;
  if (r.nextActionType === "none" || r.status === "unqualified") return <span className="text-xs text-faint">—</span>;
  const now = new Date();
  const due = !r.nextActionAt || r.nextActionAt <= now;
  const overdue = r.nextActionAt && now.getTime() - r.nextActionAt.getTime() > 86_400_000;
  const label = r.nextActionType === "callback" ? "Callback" : r.attemptCount === 0 ? "First call" : "Call";
  return (
    <span className={cn("text-xs", overdue ? "font-medium text-red-300" : due ? "font-medium text-brand-300" : "text-muted")} suppressHydrationWarning>
      {r.nextActionType === "callback" && <PhoneCall className="mr-1 inline h-3 w-3" aria-hidden />}
      {label} · {due ? (r.nextActionAt ? (overdue ? `overdue ${fmtRelative(r.nextActionAt, now).replace(" ago", "")}` : "due now") : "due now") : fmtDateTime(r.nextActionAt, tz, { weekday: true, date: false, time: true })}
    </span>
  );
}

export function LeadTable({
  rows,
  total,
  tz,
  canAssign,
  members,
  emptyHint,
}: {
  rows: LeadListRow[];
  total: number;
  tz: string;
  canAssign: boolean;
  members: { id: string; name: string }[];
  emptyHint: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cursor, setCursor] = useState(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const [pending, start] = useTransition();
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Reset only when the visible rows actually change, not when a refresh re-sends the same data.
  const rowKey = rows.map((r) => r.id).join(",");
  useEffect(() => {
    setSelected(new Set());
    setCursor(-1);
  }, [rowKey]);

  useEffect(() => {
    if (cursor >= 0) rowRefs.current[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  useShortcuts(
    [
      { keys: "j", label: "Next lead", run: () => setCursor((c) => Math.min(rows.length - 1, c + 1)) },
      { keys: "k", label: "Previous lead", run: () => setCursor((c) => Math.max(0, c - 1)) },
      { keys: "enter", label: "Open lead", run: () => cursor >= 0 && rows[cursor] && router.push(`/leads/${rows[cursor].id}`) },
      { keys: "c", label: "Call highlighted lead", run: () => cursor >= 0 && rows[cursor] && router.push(`/desk?lead=${rows[cursor].id}`) },
      ...(canAssign ? [{ keys: "x", label: "Select highlighted lead", run: () => cursor >= 0 && rows[cursor] && toggle(rows[cursor].id) }] : []),
    ],
    [rows, cursor, canAssign],
  );

  const assign = () => {
    if (!assignTo) return;
    const ids = Array.from(selected);
    start(async () => {
      const r = await assignLeadsAction(ids, assignTo === "__none" ? null : assignTo);
      if (r.ok) {
        toast("success", r.message ?? "Assigned");
        setSelected(new Set());
        setAssignTo("");
      } else toast("error", r.error);
    });
  };

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="flex min-h-10 flex-wrap items-center gap-3 border-b border-line px-4 py-1.5 text-[13px]">
        {selected.size > 0 ? (
          <>
            <span className="font-medium text-ink">{selected.size} selected</span>
            <label htmlFor="assign-to" className="sr-only">
              Assign selected leads to
            </label>
            <select id="assign-to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="h-7 rounded-md border border-line-strong bg-subtle px-2 text-[13px] text-ink">
              <option value="">Assign to…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="__none">Unassign</option>
            </select>
            <Button size="sm" variant="primary" onClick={assign} disabled={!assignTo || pending}>
              {pending ? "Assigning…" : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </>
        ) : (
          <>
            <span className="tabular text-muted">
              <span className="font-semibold text-ink">{total.toLocaleString()}</span> lead{total === 1 ? "" : "s"}
            </span>
            <span className="ml-auto hidden items-center gap-3 text-[11px] text-faint md:flex">
              <span>
                <Kbd keys="j" />
                <Kbd keys="k" /> move
              </span>
              <span>
                <Kbd keys="enter" /> open
              </span>
              <span>
                <Kbd keys="c" /> call
              </span>
              {canAssign && (
                <span>
                  <Kbd keys="x" /> select
                </span>
              )}
            </span>
          </>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No leads here" description={emptyHint} />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <caption className="sr-only">Leads</caption>
            <thead>
              <tr>
                {canAssign && (
                  <th scope="col" className={cn(thClass, "w-10 pl-4")}>
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                      className="h-3.5 w-3.5 accent-brand-500"
                    />
                  </th>
                )}
                <th scope="col" className={cn(thClass, !canAssign && "pl-4")}>
                  Lead
                </th>
                <th scope="col" className={cn(thClass, "hidden md:table-cell")}>
                  Company
                </th>
                <th scope="col" className={thClass}>
                  Score
                </th>
                <th scope="col" className={thClass}>
                  Status
                </th>
                <th scope="col" className={cn(thClass, "hidden lg:table-cell")}>
                  Last activity
                </th>
                <th scope="col" className={thClass}>
                  Next action
                </th>
                <th scope="col" className={cn(thClass, "hidden xl:table-cell")}>
                  Owner
                </th>
                <th scope="col" className={cn(thClass, "w-12 pr-4")}>
                  <span className="sr-only">Call</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const callable = !r.doNotCall && !r.phoneInvalid && r.status !== "unqualified" && r.status !== "converted" && !!(r.phone || r.mobile);
                return (
                  <tr
                    key={r.id}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,input,button")) return;
                      router.push(`/leads/${r.id}`);
                    }}
                    className={cn(
                      "group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-subtle",
                      i === cursor && "bg-brand-50 outline outline-1 -outline-offset-1 outline-brand-500/50",
                      selected.has(r.id) && "bg-brand-50",
                    )}
                  >
                    {canAssign && (
                      <td className="py-2 pl-4">
                        <input type="checkbox" aria-label={`Select ${r.firstName} ${r.lastName}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-3.5 w-3.5 accent-brand-500" />
                      </td>
                    )}
                    <td className={cn("max-w-[220px] py-2 pr-3", !canAssign && "pl-4")}>
                      <Link href={`/leads/${r.id}`} className="block truncate font-medium text-ink hover:text-brand-200">
                        {r.firstName} {r.lastName}
                      </Link>
                      <span className="block truncate text-xs text-faint">{r.title}</span>
                      <span className="block truncate text-xs text-faint md:hidden">{r.companyName}</span>
                    </td>
                    <td className="hidden max-w-[260px] px-3 py-2 md:table-cell">
                      <span className="block truncate text-ink-2">{r.companyName}</span>
                      <span className="block truncate text-xs text-faint">
                        {[r.industry, r.employeeCount ? `${r.employeeCount} emp` : null, r.city && `${r.city}, ${r.state}`].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={r.score} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="hidden px-3 py-2 lg:table-cell">
                      {r.lastContactedAt ? (
                        <span className="flex items-center gap-2">
                          <DispositionBadge disposition={r.lastDisposition} />
                          <span className="tabular text-xs text-faint" suppressHydrationWarning>
                            {fmtRelative(r.lastContactedAt)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-faint">Never contacted</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <NextAction r={r} tz={tz} />
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-ink-2 xl:table-cell">{r.ownerName ?? <span className="text-amber-300">Unassigned</span>}</td>
                    <td className="py-2 pr-4 text-right">
                      {callable && (
                        <Link
                          href={`/desk?lead=${r.id}`}
                          aria-label={`Call ${r.firstName} ${r.lastName}`}
                          title="Call in Calling Desk"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-500 hover:text-white group-hover:text-brand-300"
                        >
                          <Phone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
