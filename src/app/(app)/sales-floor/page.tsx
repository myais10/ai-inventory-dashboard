import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { AlertTriangle, CalendarClock, Inbox, PhoneCall, TrendingDown, Users } from "lucide-react";
import { requireManager } from "@/lib/auth/session";
import { SOURCES } from "@/lib/domain/scoring";
import { isCallingHours } from "@/lib/domain/time";
import { attention, callKpis, openPipelineValue, recentCalls, repTable, type RepRow } from "@/lib/services/analytics";
import { ctxOf, listMembers } from "@/lib/services/context";
import { fmtDateTime, fmtDuration, fmtMoney, fmtPct, fmtRelative, initials } from "@/lib/format";
import { resolvePeriod } from "@/lib/period";
import { cn } from "@/lib/utils";
import { Badge, EmptyState, Metric, Panel, PageHeader, thClass } from "@/components/ui";
import { DispositionBadge } from "@/components/app/lead-badges";
import { Delta, PeriodTabs } from "@/components/app/period";
import { LiveRefresh } from "@/components/app/live-refresh";
import { AssignInline } from "./assign-inline";

export const metadata: Metadata = { title: "Sales Floor" };

type Presence = "on_call" | "active" | "idle" | "offline";
const PRESENCE: Record<Presence, { label: string; tone: "red" | "green" | "amber" | "slate" }> = {
  on_call: { label: "On call", tone: "red" },
  active: { label: "Available", tone: "green" },
  idle: { label: "Idle", tone: "amber" },
  offline: { label: "Offline", tone: "slate" },
};

/** Presence is derived from call activity — there is no separate status to keep honest. */
function presenceOf(r: RepRow, now: Date, workingHours: boolean): Presence {
  if (r.onCall) return "on_call";
  if (!r.lastCall) return "offline";
  const mins = (now.getTime() - r.lastCall.getTime()) / 60_000;
  if (mins <= 20) return "active";
  if (workingHours && mins <= 8 * 60) return "idle";
  return "offline";
}

export default async function SalesFloorPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireManager();
  const ctx = ctxOf(session);
  const tz = session.org.timezone;
  const period = resolvePeriod((await searchParams).period, tz, "today");
  const [kpi, prev, reps, att, members, feed, open] = await Promise.all([
    callKpis(ctx, period.since, period.until),
    callKpis(ctx, period.prevSince, period.prevUntil),
    repTable(ctx, period.since, period.until),
    attention(ctx),
    listMembers(ctx),
    recentCalls(ctx, 14),
    openPipelineValue(ctx),
  ]);
  const now = new Date();
  // Only flag reps as idle or behind while the team should be on the phones.
  const workingHours = isCallingHours(now, tz);
  const rate = (c: number, d: number) => (d ? c / d : 0);
  const repRows = reps.filter((r) => r.role === "rep");
  const presence = new Map(reps.map((r) => [r.id, presenceOf(r, now, workingHours)]));
  const online = repRows.filter((r) => ["on_call", "active"].includes(presence.get(r.id)!)).length;
  const avgDials = repRows.length ? repRows.reduce((a, r) => a + r.dials, 0) / repRows.length : 0;
  const behind = (r: RepRow) => period.key === "today" && workingHours && r.role === "rep" && avgDials >= 10 && r.dials < avgDials * 0.6;
  const lateCallbacks = reps.filter((r) => r.lateCallbacks > 0);

  return (
    <div className="px-4 py-5 sm:px-6">
      <PageHeader
        title="Sales Floor"
        description="Who is selling, who needs help, and what is turning into pipeline."
        className="mb-4"
        actions={
          <>
            {period.key === "today" && <LiveRefresh seconds={30} />}
            <PeriodTabs value={period.key} base="/sales-floor" />
          </>
        }
      />

      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
        <Metric className="bg-surface px-4 py-3" label="Reps online" value={`${online}/${repRows.length}`} sub={workingHours ? "on a call or dialled in 20 min" : "outside calling hours"} />
        <Metric className="bg-surface px-4 py-3" label="Calls" value={kpi.dials.toLocaleString()} sub={<Delta now={kpi.dials} prev={prev.dials} />} />
        <Metric className="bg-surface px-4 py-3" label="Connect rate" value={fmtPct(rate(kpi.connects, kpi.dials))} sub={<Delta now={rate(kpi.connects, kpi.dials)} prev={rate(prev.connects, prev.dials)} pct />} />
        <Metric className="bg-surface px-4 py-3" label="Conversations" value={kpi.conversations.toLocaleString()} sub={<Delta now={kpi.conversations} prev={prev.conversations} />} />
        <Metric className="bg-surface px-4 py-3" label="Meetings booked" value={kpi.meetings.toLocaleString()} sub={<Delta now={kpi.meetings} prev={prev.meetings} />} />
        <Metric className="bg-surface px-4 py-3" label="Opportunities" value={kpi.dealsCreated.toLocaleString()} sub={`${fmtMoney(kpi.pipelineCreated, true)} created`} />
        <Metric className="bg-surface px-4 py-3" label="Open pipeline" value={fmtMoney(open.v, true)} sub={`${open.n} open deals`} />
        <Metric className="bg-surface px-4 py-3" label="Revenue won" value={fmtMoney(kpi.revenue, true)} sub={`${kpi.wins} deal${kpi.wins === 1 ? "" : "s"} · ${period.label.toLowerCase()}`} />
      </dl>
      <p className="-mt-2 mb-4 text-[11px] text-faint">Changes are {period.compareLabel}. Conversations are connected calls of a minute or more.</p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Panel title={`Reps · ${period.label.toLowerCase()}`} icon={Users} description="Sorted by meetings booked. Backlog is leads due now; late callbacks are promises already broken.">
            <div className="relative overflow-x-auto">
              <table className="w-full text-[13px]">
                <caption className="sr-only">Rep performance</caption>
                <thead>
                  <tr>
                    <th scope="col" className={cn(thClass, "pl-4")}>
                      Rep
                    </th>
                    <th scope="col" className={cn(thClass, "text-right")}>
                      Calls
                    </th>
                    <th scope="col" className={cn(thClass, "text-right")}>
                      Connects
                    </th>
                    <th scope="col" className={cn(thClass, "hidden text-right lg:table-cell")}>
                      Convos
                    </th>
                    <th scope="col" className={cn(thClass, "text-right")}>
                      Meetings
                    </th>
                    <th scope="col" className={cn(thClass, "hidden text-right 2xl:table-cell")}>
                      Pipeline
                    </th>
                    <th scope="col" className={cn(thClass, "text-right")}>
                      Backlog
                    </th>
                    <th scope="col" className={cn(thClass, "text-right")}>
                      Late CBs
                    </th>
                    <th scope="col" className={cn(thClass, "hidden text-right md:table-cell")}>
                      Overdue
                    </th>
                    <th scope="col" className={cn(thClass, "hidden pr-4 2xl:table-cell")}>
                      Last call
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => {
                    const p = PRESENCE[presence.get(r.id)!];
                    const slow = behind(r);
                    return (
                      <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-subtle">
                        <th scope="row" className="min-w-[200px] py-2 pl-4 pr-3 text-left font-normal">
                          <div className="flex items-center gap-2.5">
                            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-200" aria-hidden>
                              {initials(r.name)}
                              <span
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface",
                                  p.tone === "red" ? "bg-red-400 animate-live" : p.tone === "green" ? "bg-emerald-400" : p.tone === "amber" ? "bg-amber-400" : "bg-slate-500",
                                )}
                              />
                            </span>
                            <div className="min-w-0">
                              <Link href={`/analytics?rep=${r.id}&period=${period.key === "today" ? "7d" : period.key}`} className="block truncate font-medium text-ink hover:text-brand-200">
                                {r.name}
                              </Link>
                              <span className="flex items-center gap-1.5 text-[11px]">
                                <span className={cn(p.tone === "red" ? "text-red-300" : p.tone === "green" ? "text-emerald-300" : p.tone === "amber" ? "text-amber-300" : "text-faint")}>{p.label}</span>
                                {slow && <Badge tone="amber">Behind pace</Badge>}
                              </span>
                            </div>
                          </div>
                        </th>
                        <td className="tabular px-3 py-2 text-right text-ink">{r.dials}</td>
                        <td className="tabular px-3 py-2 text-right text-ink-2">
                          {r.connects} <span className="text-[11px] text-faint">{r.dials ? fmtPct(r.connects / r.dials) : ""}</span>
                        </td>
                        <td className="tabular hidden px-3 py-2 text-right text-ink-2 lg:table-cell">{r.conversations}</td>
                        <td className="tabular px-3 py-2 text-right font-semibold text-ink">{r.meetings}</td>
                        <td className="tabular hidden px-3 py-2 text-right text-ink-2 2xl:table-cell">{r.openValue ? fmtMoney(r.openValue, true) : "—"}</td>
                        <td className="tabular px-3 py-2 text-right">
                          <Link href={`/leads?owner=${r.id}&view=due`} className="text-ink-2 hover:text-brand-200">
                            {r.due}
                          </Link>
                        </td>
                        <td className={cn("tabular px-3 py-2 text-right", r.lateCallbacks ? "font-semibold text-red-300" : "text-faint")}>{r.lateCallbacks}</td>
                        <td className="tabular hidden px-3 py-2 text-right md:table-cell">
                          <Link href={`/tasks?bucket=overdue&assignee=${r.id}`} className={r.overdueTasks ? "text-amber-300 hover:underline" : "text-faint"}>
                            {r.overdueTasks}
                          </Link>
                        </td>
                        <td className="hidden py-2 pl-3 pr-4 text-xs text-muted 2xl:table-cell" suppressHydrationWarning>
                          {r.lastCall ? fmtRelative(r.lastCall) : "No calls"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Being worked now" icon={PhoneCall} description="The latest calls across the team">
            {feed.length === 0 ? (
              <EmptyState title="No calls yet" description="Calls appear here as soon as reps start dialling." />
            ) : (
              <ol className="divide-y divide-line/70">
                {feed.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <span className="w-16 shrink-0 text-xs text-faint" suppressHydrationWarning>
                      {fmtRelative(c.at)}
                    </span>
                    <span className="w-28 shrink-0 truncate text-ink-2">{c.rep}</span>
                    <Link href={`/leads/${c.leadId}`} className="min-w-0 flex-1 truncate text-ink hover:text-brand-200">
                      {c.first} {c.last}
                      <span className="text-faint"> · {c.company}</span>
                    </Link>
                    {c.status === "in_progress" ? (
                      <Badge tone="red" dot>
                        Live now
                      </Badge>
                    ) : (
                      <DispositionBadge disposition={c.disposition} />
                    )}
                    <span className="tabular hidden w-10 shrink-0 text-right text-xs text-faint sm:block">{c.durationSec ? fmtDuration(c.durationSec) : ""}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="space-y-4" aria-label="Needs attention">
          <Panel title={`Unassigned leads (${att.unassigned.length})`} icon={Inbox}>
            {att.unassigned.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">Every open lead has an owner.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {att.unassigned.map((l) => (
                  <li key={l.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/leads/${l.id}`} className="truncate text-[13px] font-medium text-ink hover:text-brand-200">
                        {l.first} {l.last}
                      </Link>
                      <span className="shrink-0 text-[11px] text-amber-300" suppressHydrationWarning>
                        waiting {fmtRelative(l.createdAt).replace(" ago", "")}
                      </span>
                    </div>
                    <div className="text-xs text-faint">
                      {l.company} · {SOURCES[l.source]?.label ?? l.source} · score {l.score}
                    </div>
                    <AssignInline leadId={l.id} reps={members.filter((m) => m.role === "rep").map((m) => ({ id: m.id, name: m.name }))} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {lateCallbacks.length > 0 && (
            <Panel title="Late callbacks" icon={AlertTriangle} className="border-red-500/30">
              <ul className="px-4 py-2 text-[13px]">
                {lateCallbacks.map((r) => (
                  <li key={r.id} className="flex justify-between py-1">
                    <Link href={`/leads?owner=${r.id}&view=callbacks`} className="text-ink hover:text-brand-200">
                      {r.name}
                    </Link>
                    <span className="tabular font-medium text-red-300">{r.lateCallbacks} overdue</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Deals stuck 10+ days" icon={TrendingDown}>
            {att.stalled.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No stalled deals.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {att.stalled.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2 px-4 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <Link href={`/pipeline/${d.id}`} className="block truncate font-medium text-ink hover:text-brand-200">
                        {d.company ?? d.name}
                      </Link>
                      <span className="text-xs text-faint" suppressHydrationWarning>
                        {d.stage} for {Math.floor((now.getTime() - d.since.getTime()) / 86_400_000)}d · {d.owner}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-semibold text-ink">{fmtMoney(d.value, true)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Meetings next 7 days (${att.upcomingMeetings.length})`} icon={CalendarClock}>
            {att.upcomingMeetings.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">Nothing booked. Push the team on connects.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {att.upcomingMeetings.map((m) => (
                  <li key={m.id} className="px-4 py-2.5 text-[13px]">
                    {m.dealId ? (
                      <Link href={`/pipeline/${m.dealId}`} className="font-medium text-ink hover:text-brand-200">
                        {m.company ?? m.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{m.company ?? m.title}</span>
                    )}
                    <div className="text-xs text-faint" suppressHydrationWarning>
                      {fmtDateTime(m.at, tz, { weekday: true, date: true, time: true })} · {m.owner}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
