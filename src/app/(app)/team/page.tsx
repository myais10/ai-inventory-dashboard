import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { AlertTriangle, CalendarClock, Inbox, TrendingDown } from "lucide-react";
import { requireManager } from "@/lib/auth/session";
import { SOURCES } from "@/lib/domain/scoring";
import { isCallingHours } from "@/lib/domain/time";
import { attention, callKpis, repTable } from "@/lib/services/analytics";
import { ctxOf, listMembers } from "@/lib/services/context";
import { fmtDateTime, fmtDuration, fmtMoney, fmtPct, fmtRelative } from "@/lib/format";
import { resolvePeriod } from "@/lib/period";
import { cn } from "@/lib/utils";
import { Delta, PeriodTabs } from "@/components/app/period";
import { AssignInline } from "./assign-inline";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireManager();
  const ctx = ctxOf(session);
  const tz = session.org.timezone;
  const period = resolvePeriod((await searchParams).period, tz, "today");
  const [kpi, prev, reps, att, members] = await Promise.all([
    callKpis(ctx, period.since, period.until),
    callKpis(ctx, period.prevSince, period.prevUntil),
    repTable(ctx, period.since, period.until),
    attention(ctx),
    listMembers(ctx),
  ]);
  const now = new Date();
  // Only call a rep idle while the team should be on the phones.
  const workingHours = isCallingHours(now, tz);
  const lateCallbacks = reps.filter((r) => r.lateCallbacks > 0);
  const rate = (c: number, d: number) => (d ? c / d : 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Team</h1>
          <p className="mt-0.5 text-sm text-muted">Where the team stands and what needs you. Start with the column on the right.</p>
        </div>
        <PeriodTabs value={period.key} base="/team" />
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-5">
        {[
          { k: "Dials", v: kpi.dials.toLocaleString(), d: <Delta now={kpi.dials} prev={prev.dials} /> },
          { k: "Connect rate", v: fmtPct(rate(kpi.connects, kpi.dials)), d: <Delta now={rate(kpi.connects, kpi.dials)} prev={rate(prev.connects, prev.dials)} pct /> },
          { k: "Meetings booked", v: kpi.meetings.toLocaleString(), d: <Delta now={kpi.meetings} prev={prev.meetings} /> },
          { k: "Pipeline created", v: fmtMoney(kpi.pipelineCreated), d: <Delta now={kpi.pipelineCreated} prev={prev.pipelineCreated} money /> },
          { k: "Talk time", v: fmtDuration(kpi.talkSec), d: <Delta now={kpi.talkSec} prev={prev.talkSec} /> },
        ].map((x) => (
          <div key={x.k} className="bg-white px-4 py-3">
            <dt className="text-xs text-muted">{x.k}</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold text-ink">{x.v}</dd>
            <dd className="text-[11px]">
              {x.d} <span className="text-faint">{period.compareLabel}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-white" aria-labelledby="reps-h">
          <header className="border-b border-line px-4 py-2.5">
            <h2 id="reps-h" className="text-[13px] font-semibold text-ink">
              Reps · {period.label.toLowerCase()}
            </h2>
            <p className="text-xs text-muted">Sorted by meetings booked. Backlog = leads due now; late callbacks are promises already broken.</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-subtle text-[11px] uppercase tracking-wide text-muted">
                  <th scope="col" className="py-2 pl-4 pr-3 text-left font-medium">Rep</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Dials</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Connects</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Meetings</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Talk</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Backlog</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Late callbacks</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Overdue tasks</th>
                  <th scope="col" className="hidden py-2 pl-3 pr-4 text-left font-medium lg:table-cell">Last call</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r) => {
                  const idle = period.key === "today" && workingHours && r.role === "rep" && (!r.lastCall || now.getTime() - r.lastCall.getTime() > 90 * 60_000);
                  return (
                    <tr key={r.id} className="border-b border-line/70 last:border-0">
                      <th scope="row" className="min-w-[170px] whitespace-nowrap py-2.5 pl-4 pr-3 text-left font-normal">
                        <Link href={`/analytics?rep=${r.id}&period=${period.key === "today" ? "7d" : period.key}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                          {r.name}
                        </Link>
                        <span className="block text-xs text-muted">{r.title}</span>
                      </th>
                      <td className="tabular px-3 py-2.5 text-right">{r.dials}</td>
                      <td className="tabular px-3 py-2.5 text-right">
                        {r.connects} <span className="text-xs text-muted">{r.dials ? fmtPct(r.connects / r.dials) : ""}</span>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-semibold text-ink">{r.meetings}</td>
                      <td className="tabular hidden px-3 py-2.5 text-right md:table-cell">{fmtDuration(r.talkSec)}</td>
                      <td className="tabular px-3 py-2.5 text-right">
                        <Link href={`/leads?owner=${r.id}&view=due`} className="hover:underline">
                          {r.due}
                        </Link>
                      </td>
                      <td className={cn("tabular px-3 py-2.5 text-right", r.lateCallbacks && "font-semibold text-red-700")}>{r.lateCallbacks}</td>
                      <td className={cn("tabular px-3 py-2.5 text-right", r.overdueTasks && "text-amber-700")}>
                        <Link href={`/tasks?bucket=overdue&assignee=${r.id}`} className="hover:underline">
                          {r.overdueTasks}
                        </Link>
                      </td>
                      <td className="hidden py-2.5 pl-3 pr-4 text-xs lg:table-cell" suppressHydrationWarning>
                        <span className={idle ? "font-medium text-amber-700" : "text-muted"}>{r.lastCall ? fmtRelative(r.lastCall) : "No calls"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5" aria-label="Needs attention">
          <section className="rounded-lg border border-line bg-white">
            <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <Inbox className="h-4 w-4 text-brand-700" aria-hidden />
              <h2 className="text-[13px] font-semibold text-ink">Unassigned leads ({att.unassigned.length})</h2>
            </header>
            {att.unassigned.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">Every open lead has an owner.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {att.unassigned.map((l) => (
                  <li key={l.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/leads/${l.id}`} className="truncate text-[13px] font-medium text-ink hover:text-brand-700 hover:underline">
                        {l.first} {l.last}
                      </Link>
                      <span className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                        waiting {fmtRelative(l.createdAt).replace(" ago", "")}
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      {l.company} · {SOURCES[l.source]?.label ?? l.source} · score {l.score}
                    </div>
                    <AssignInline leadId={l.id} reps={members.filter((m) => m.role === "rep").map((m) => ({ id: m.id, name: m.name }))} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {lateCallbacks.length > 0 && (
            <section className="rounded-lg border border-red-200 bg-red-50/40">
              <header className="flex items-center gap-2 border-b border-red-200 px-4 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-700" aria-hidden />
                <h2 className="text-[13px] font-semibold text-ink">Late callbacks</h2>
              </header>
              <ul className="px-4 py-2 text-[13px]">
                {lateCallbacks.map((r) => (
                  <li key={r.id} className="flex justify-between py-1">
                    <Link href={`/leads?owner=${r.id}&view=callbacks`} className="text-ink hover:underline">
                      {r.name}
                    </Link>
                    <span className="tabular font-medium text-red-700">{r.lateCallbacks} overdue</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-lg border border-line bg-white">
            <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <TrendingDown className="h-4 w-4 text-amber-600" aria-hidden />
              <h2 className="text-[13px] font-semibold text-ink">Deals stuck 10+ days</h2>
            </header>
            {att.stalled.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No stalled deals.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {att.stalled.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2 px-4 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <Link href={`/pipeline/${d.id}`} className="block truncate font-medium text-ink hover:text-brand-700 hover:underline">
                        {d.company ?? d.name}
                      </Link>
                      <span className="text-xs text-muted" suppressHydrationWarning>
                        {d.stage} for {Math.floor((now.getTime() - d.since.getTime()) / 86_400_000)}d · {d.owner}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-medium">{fmtMoney(d.value, true)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-line bg-white">
            <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <CalendarClock className="h-4 w-4 text-violet-600" aria-hidden />
              <h2 className="text-[13px] font-semibold text-ink">Meetings next 7 days ({att.upcomingMeetings.length})</h2>
            </header>
            {att.upcomingMeetings.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">Nothing booked. Push the team on connects.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {att.upcomingMeetings.map((m) => (
                  <li key={m.id} className="px-4 py-2.5 text-[13px]">
                    {m.dealId ? (
                      <Link href={`/pipeline/${m.dealId}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                        {m.company ?? m.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{m.company ?? m.title}</span>
                    )}
                    <div className="text-xs text-muted" suppressHydrationWarning>
                      {fmtDateTime(m.at, tz, { weekday: true, date: true, time: true })} · {m.owner}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
