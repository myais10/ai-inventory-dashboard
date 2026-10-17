import type { Metadata } from "next";
import { isManager, requireSession } from "@/lib/auth/session";
import { DISPOSITION_MAP, type DispositionKey } from "@/lib/domain/dispositions";
import { SOURCES } from "@/lib/domain/scoring";
import { callKpis, connectByLocalHour, dailySeries, dispositionBreakdown, lossReasons, repTable, segmentPerformance } from "@/lib/services/analytics";
import { ctxOf, listMembers } from "@/lib/services/context";
import { fmtMoney, fmtPct } from "@/lib/format";
import { resolvePeriod } from "@/lib/period";
import { BarList, ColumnChart } from "@/components/charts/bars";
import { Delta, PeriodTabs } from "@/components/app/period";
import { Metric, PageHeader, Panel, thClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BarChart3, Clock4, Filter, Layers, Lightbulb, PhoneCall, TrendingDown, Users } from "lucide-react";
import Link from "@/components/ui/link";
import { RepFilter } from "./rep-filter";

export const metadata: Metadata = { title: "Analytics" };

function Insight({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 flex gap-2 rounded-md border border-brand-500/25 bg-brand-50 px-3 py-2 text-[13px] text-ink-2">
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function hourLabel(h: number) {
  return `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; rep?: string }> }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const sp = await searchParams;
  const tz = session.org.timezone;
  const manager = isManager(session);
  const members = manager ? await listMembers(ctx) : [];
  const rep = manager ? (sp.rep && members.some((m) => m.id === sp.rep) ? sp.rep : undefined) : session.user.id;
  const period = resolvePeriod(sp.period === "today" ? "7d" : sp.period, tz, "30d");
  const { since, until } = period;

  const [kpi, prev, daily, hours, dispositions, sources, campaigns, losses, reps] = await Promise.all([
    callKpis(ctx, since, until, rep),
    callKpis(ctx, period.prevSince, period.prevUntil, rep),
    dailySeries(ctx, since, until, tz, rep),
    connectByLocalHour(ctx, since, until, rep),
    dispositionBreakdown(ctx, since, until, rep),
    segmentPerformance(ctx, since, until, "source", rep),
    segmentPerformance(ctx, since, until, "campaign", rep),
    lossReasons(ctx, since, until, rep),
    manager && !rep ? repTable(ctx, since, until) : Promise.resolve([]),
  ]);

  // Fill missing days so gaps read as zero, not as missing bars.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days: { day: string; dials: number; meetings: number; weekend: boolean }[] = [];
  // Step by calendar day (noon UTC anchors) so DST changes can't duplicate or skip a day.
  const first = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(since);
  const last = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(until);
  for (let t = Date.parse(`${first}T12:00:00Z`); ; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    if (day > last) break;
    const wd = new Date(t).getUTCDay();
    days.push({ day, dials: byDay.get(day)?.dials ?? 0, meetings: byDay.get(day)?.meetings ?? 0, weekend: wd === 0 || wd === 6 });
  }
  const dayLabel = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${d}T00:00:00Z`));

  const rate = (c: number, d: number) => (d ? c / d : 0);
  const avgConnect = rate(kpi.connects, kpi.dials);
  const solidHours = hours.filter((h) => h.dials >= 20);
  const bestHour = solidHours.reduce<(typeof hours)[number] | null>((a, h) => (!a || rate(h.connects, h.dials) > rate(a.connects, a.dials) ? h : a), null);
  const worstHour = solidHours.reduce<(typeof hours)[number] | null>((a, h) => (!a || rate(h.connects, h.dials) < rate(a.connects, a.dials) ? h : a), null);

  const srcRows = sources.map((r) => ({ ...r, label: SOURCES[r.key]?.label ?? r.key, meetingRate: rate(r.meetings, r.leads) }));
  const bestSrc = [...srcRows].filter((r) => r.leads >= 10).sort((a, b) => b.meetingRate - a.meetingRate)[0];
  const outbound = srcRows.find((r) => r.key === "outbound_list");
  const repName = rep && manager ? members.find((m) => m.id === rep)?.name : null;
  const extra = rep && manager ? `&rep=${rep}` : "";

  const funnel = [
    { label: "Calls", value: kpi.dials },
    { label: "Connects", value: kpi.connects },
    { label: "Conversations (1 min+)", value: kpi.conversations },
    { label: "Meetings booked", value: kpi.meetings },
    { label: "Deals won", value: kpi.wins },
  ];
  const worstStep = funnel.slice(1, 4).reduce<{ i: number; r: number } | null>((a, f, i) => {
    const r = rate(f.value, funnel[i].value);
    return !a || r < a.r ? { i: i + 1, r } : a;
  }, null);

  return (
    <div className="px-4 py-5 sm:px-6">
      <PageHeader
        title={`Analytics${repName ? ` · ${repName}` : manager ? "" : " · You"}`}
        description="What is working, when to call, and where meetings and revenue come from."
        className="mb-4"
        actions={
          <>
            {manager && <RepFilter value={rep ?? ""} reps={members.filter((m) => m.role === "rep").map((m) => ({ id: m.id, name: m.name }))} />}
            <PeriodTabs value={period.key} base="/analytics" extra={extra} exclude={["today"]} />
          </>
        }
      />

      <dl className="mb-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 xl:grid-cols-7">
        <Metric className="bg-surface px-4 py-3" label="Calls" value={kpi.dials.toLocaleString()} sub={<Delta now={kpi.dials} prev={prev.dials} />} />
        <Metric className="bg-surface px-4 py-3" label="Connect rate" value={fmtPct(avgConnect)} sub={<Delta now={avgConnect} prev={rate(prev.connects, prev.dials)} pct />} />
        <Metric className="bg-surface px-4 py-3" label="Conversations" value={kpi.conversations.toLocaleString()} sub={<Delta now={kpi.conversations} prev={prev.conversations} />} />
        <Metric className="bg-surface px-4 py-3" label="Meetings" value={kpi.meetings.toLocaleString()} sub={<Delta now={kpi.meetings} prev={prev.meetings} />} />
        <Metric className="bg-surface px-4 py-3" label="Opportunities" value={kpi.dealsCreated.toLocaleString()} sub={`${fmtMoney(kpi.pipelineCreated, true)} pipeline`} />
        <Metric className="bg-surface px-4 py-3" label="Wins" value={kpi.wins.toLocaleString()} sub={<Delta now={kpi.wins} prev={prev.wins} />} />
        <Metric className="bg-surface px-4 py-3" label="Revenue won" value={fmtMoney(kpi.revenue, true)} sub={<Delta now={kpi.revenue} prev={prev.revenue} money />} />
      </dl>
      <p className="mb-4 text-[11px] text-faint">Changes are {period.compareLabel}.</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Conversion funnel" icon={Filter} description="Where calls turn into revenue — and where they leak" bodyClassName="px-4 py-3">
          {worstStep && funnel[worstStep.i - 1].value > 0 && (
            <Insight>
              Biggest drop: <strong className="text-ink">{funnel[worstStep.i - 1].label.toLowerCase()} → {funnel[worstStep.i].label.toLowerCase()}</strong> ({fmtPct(worstStep.r)} carry through).
            </Insight>
          )}
          <ol className="space-y-2">
            {funnel.map((f, i) => (
              <li key={f.label} className="grid grid-cols-[150px_minmax(0,1fr)_56px_52px] items-center gap-3 text-[13px]">
                <span className="truncate text-ink-2">{f.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${funnel[0].value ? Math.max(f.value ? 1 : 0, (f.value / funnel[0].value) * 100) : 0}%` }} />
                </span>
                <span className="tabular text-right font-semibold text-ink">{f.value.toLocaleString()}</span>
                <span className="tabular text-right text-xs text-faint">{i === 0 ? "" : fmtPct(rate(f.value, funnel[i - 1].value))}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Dials per day" icon={BarChart3} description="Weekends shown in gray" bodyClassName="px-4 py-3">
          <ColumnChart
            title="Dials per day"
            bars={days.map((d) => ({ label: dayLabel(d.day), value: d.dials, muted: d.weekend, tooltip: `${d.dials} dials · ${d.meetings} meeting${d.meetings === 1 ? "" : "s"}` }))}
            labelEvery={Math.ceil(days.length / 8)}
          />
        </Panel>

        <Panel title="When people pick up" icon={Clock4} description="Connect rate by the contact's local hour (hours with 20+ dials)" bodyClassName="px-4 py-3">
          {bestHour && worstHour && bestHour.hour !== worstHour.hour && (
            <Insight>
              Best window <strong className="text-ink">{hourLabel(bestHour.hour)}–{hourLabel(bestHour.hour + 1)}</strong> local ({fmtPct(rate(bestHour.connects, bestHour.dials))} vs. {fmtPct(avgConnect)} average). Weakest{" "}
              {hourLabel(worstHour.hour)}–{hourLabel(worstHour.hour + 1)} ({fmtPct(rate(worstHour.connects, worstHour.dials))}). Block call time accordingly.
            </Insight>
          )}
          <ColumnChart
            title="Connect rate by contact local hour"
            bars={solidHours.map((h) => ({ label: hourLabel(h.hour), value: Math.round(rate(h.connects, h.dials) * 1000) / 10, tooltip: `${fmtPct(rate(h.connects, h.dials))} of ${h.dials} dials` }))}
            format={(n) => `${n}%`}
          />
        </Panel>

        <Panel title="Call outcomes" icon={PhoneCall} description="Every logged call in the period" bodyClassName="px-4 py-3">
          <BarList
            caption="Call outcomes"
            rows={dispositions.map((d) => ({ label: DISPOSITION_MAP[d.disposition as DispositionKey]?.label ?? String(d.disposition), value: d.n, sub: fmtPct(rate(d.n, kpi.dials)) }))}
          />
        </Panel>

        {reps.length > 0 && (
          <Panel title="Rep performance" icon={Users} description="Activity and conversion for the period — click a rep to drill in" className="lg:col-span-2">
            <div className="relative overflow-x-auto">
              <table className="w-full text-[13px]">
                <caption className="sr-only">Rep performance</caption>
                <thead>
                  <tr>
                    {["Rep", "Calls", "Connect %", "Conversations", "Meetings", "Meeting / connect", "Opportunities", "Open pipeline"].map((h, i) => (
                      <th key={h} scope="col" className={cn(thClass, i === 0 ? "pl-4" : "text-right", i === 7 && "pr-4")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reps
                    .filter((r) => r.role === "rep" || r.dials > 0)
                    .map((r) => (
                      <tr key={r.id} className="border-b border-line/70 last:border-0 hover:bg-subtle">
                        <th scope="row" className="py-2 pl-4 pr-3 text-left font-normal">
                          <Link href={`/analytics?rep=${r.id}&period=${period.key}`} className="font-medium text-ink hover:text-brand-200">
                            {r.name}
                          </Link>
                        </th>
                        <td className="tabular px-3 py-2 text-right text-ink">{r.dials}</td>
                        <td className="tabular px-3 py-2 text-right text-ink-2">{r.dials ? fmtPct(r.connects / r.dials) : "—"}</td>
                        <td className="tabular px-3 py-2 text-right text-ink-2">{r.conversations}</td>
                        <td className="tabular px-3 py-2 text-right font-semibold text-ink">{r.meetings}</td>
                        <td className="tabular px-3 py-2 text-right text-ink-2">{r.connects ? fmtPct(r.meetings / r.connects) : "—"}</td>
                        <td className="tabular px-3 py-2 text-right text-ink-2">{r.opps}</td>
                        <td className="tabular px-3 py-2 pr-4 text-right text-ink-2">{r.openValue ? fmtMoney(r.openValue, true) : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel title="Lead sources" icon={Layers} description="Leads created in this period and what became of them" bodyClassName="px-4 py-3">
          {bestSrc && outbound && bestSrc.key !== "outbound_list" && outbound.meetingRate > 0 && (
            <Insight>
              <strong className="text-ink">{bestSrc.label}</strong> leads book meetings at {(bestSrc.meetingRate / outbound.meetingRate).toFixed(1)}× the rate of outbound lists ({fmtPct(bestSrc.meetingRate)} vs. {fmtPct(outbound.meetingRate)}). Make sure they are called first.
            </Insight>
          )}
          <SegmentTable rows={srcRows} />
        </Panel>

        <Panel title="Campaigns" icon={Layers} description="Leads created in this period, by campaign" bodyClassName="px-4 py-3">
          <SegmentTable rows={campaigns.map((r) => ({ ...r, label: r.key, meetingRate: rate(r.meetings, r.leads) }))} />
        </Panel>

        <Panel title="Why we lose" icon={TrendingDown} description="Lost deals and disqualified leads in the period" bodyClassName="px-4 py-3" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Lost deals</h3>
              <BarList caption="Lost deal reasons" rows={losses.deals.map((r) => ({ label: r.reason ?? "No reason", value: r.n }))} />
            </div>
            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Disqualified leads</h3>
              <BarList caption="Disqualification reasons" rows={losses.leads.map((r) => ({ label: r.reason ?? "No reason", value: r.n }))} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SegmentTable({ rows }: { rows: { label: string; leads: number; contacted: number; connected: number; meetings: number; meetingRate: number; pipeline: number }[] }) {
  if (!rows.length) return <p className="py-4 text-[13px] text-muted">No leads created in this period.</p>;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-faint">
            <th scope="col" className="pb-1.5 text-left font-medium">Segment</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Leads</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Reached</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Meetings</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Rate</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Pipeline</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line/70">
              <th scope="row" className="max-w-[180px] truncate py-1.5 pr-2 text-left font-normal text-ink-2">
                {r.label}
              </th>
              <td className="tabular py-1.5 text-right text-ink-2">{r.leads}</td>
              <td className="tabular py-1.5 text-right text-ink-2">{r.leads ? fmtPct(r.connected / r.leads) : "—"}</td>
              <td className="tabular py-1.5 text-right font-semibold text-ink">{r.meetings}</td>
              <td className="tabular py-1.5 text-right text-ink-2">{fmtPct(r.meetingRate, 1)}</td>
              <td className="tabular py-1.5 text-right text-ink-2">{fmtMoney(r.pipeline, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
