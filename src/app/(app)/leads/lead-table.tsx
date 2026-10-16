"use client";

import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PhoneCall, PhoneOff, Ban } from "lucide-react";
import type { LeadListRow } from "@/lib/services/leads";
import { DispositionBadge, ScoreBadge, StatusBadge } from "@/components/app/lead-badges";
import { Kbd, useShortcuts } from "@/components/app/shortcuts";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assignLeadsAction } from "./actions";

function NextAction({ r, tz }: { r: LeadListRow; tz: string }) {
  if (r.doNotCall) return <span className="inline-flex items-center gap-1 text-xs text-red-700"><Ban className="h-3 w-3" aria-hidden /> Do not call</span>;
  if (r.phoneInvalid) return <span className="inline-flex items-center gap-1 text-xs text-red-700"><PhoneOff className="h-3 w-3" aria-hidden /> Fix phone number</span>;
  if (r.nextActionType === "none" || r.status === "unqualified" || r.status === "converted") return <span className="text-xs text-faint">—</span>;
  const now = new Date();
  const due = !r.nextActionAt || r.nextActionAt <= now;
  const overdue = r.nextActionAt && now.getTime() - r.nextActionAt.getTime() > 86_400_000;
  const label = r.nextActionType === "callback" ? "Callback" : r.attemptCount === 0 ? "First call" : "Call";
  return (
    <span className={cn("text-xs", overdue ? "font-medium text-red-700" : due ? "font-medium text-brand-700" : "text-muted")} suppressHydrationWarning>
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
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex min-h-11 flex-wrap items-center gap-3 border-b border-line px-4 py-2 text-[13px]">
        {selected.size > 0 ? (
          <>
            <span className="font-medium text-ink">{selected.size} selected</span>
            <label htmlFor="assign-to" className="sr-only">
              Assign selected leads to
            </label>
            <select id="assign-to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="h-7 rounded-md border border-line-strong bg-white px-2 text-[13px]">
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
            <button type="button" className="text-muted hover:text-ink" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </>
        ) : (
          <>
            <span className="tabular text-muted">
              <span className="font-medium text-ink">{total.toLocaleString()}</span> lead{total === 1 ? "" : "s"}
            </span>
            <span className="ml-auto hidden items-center gap-3 text-xs text-faint md:flex">
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
        <p className="px-6 py-16 text-center text-sm text-muted">{emptyHint}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <caption className="sr-only">Leads</caption>
            <thead>
              <tr className="border-b border-line bg-subtle text-[11px] uppercase tracking-wide text-muted">
                {canAssign && (
                  <th scope="col" className="w-10 py-2 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </th>
                )}
                <th scope="col" className={cn("py-2 pr-3 font-medium", !canAssign && "pl-4")}>Lead</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Company</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Score</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Last touch</th>
                <th scope="col" className="px-3 py-2 font-medium">Next action</th>
                <th scope="col" className="hidden px-3 py-2 pr-4 font-medium xl:table-cell">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
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
                    "cursor-pointer border-b border-line/70 last:border-0 hover:bg-subtle",
                    i === cursor && "bg-brand-50/60 outline outline-1 -outline-offset-1 outline-brand-300",
                    selected.has(r.id) && "bg-brand-50/40",
                  )}
                >
                  {canAssign && (
                    <td className="py-2.5 pl-4">
                      <input type="checkbox" aria-label={`Select ${r.firstName} ${r.lastName}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-brand-600" />
                    </td>
                  )}
                  <td className={cn("max-w-[240px] py-2.5 pr-3", !canAssign && "pl-4")}>
                    <Link href={`/leads/${r.id}`} className="block truncate font-medium text-ink hover:text-brand-700 hover:underline">
                      {r.firstName} {r.lastName}
                    </Link>
                    <span className="block truncate text-xs text-muted">{r.title}</span>
                    <span className="block truncate text-xs text-muted md:hidden">{r.companyName}</span>
                  </td>
                  <td className="hidden max-w-[260px] px-3 py-2.5 md:table-cell">
                    <span className="block truncate text-ink-2">{r.companyName}</span>
                    <span className="block truncate text-xs text-muted">
                      {[r.industry, r.employeeCount ? `${r.employeeCount} emp` : null, r.city && `${r.city}, ${r.state}`].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <ScoreBadge score={r.score} />
                  </td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    {r.lastContactedAt ? (
                      <span className="flex items-center gap-2">
                        <DispositionBadge disposition={r.lastDisposition} />
                        <span className="text-xs text-muted" suppressHydrationWarning>
                          {fmtRelative(r.lastContactedAt)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-faint">Never</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <NextAction r={r} tz={tz} />
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 pr-4 text-xs text-ink-2 xl:table-cell">{r.ownerName ?? <span className="text-amber-700">Unassigned</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
