import type { Metadata } from "next";
import { isManager, requireSession } from "@/lib/auth/session";
import { DISPOSITION_MAP, type DispositionKey } from "@/lib/domain/dispositions";
import { SOURCES } from "@/lib/domain/scoring";
import { callKpis, connectByLocalHour, dailySeries, dispositionBreakdown, lossReasons, segmentPerformance } from "@/lib/services/analytics";
import { ctxOf, listMembers } from "@/lib/services/context";
import { fmtMoney, fmtPct } from "@/lib/format";
import { resolvePeriod } from "@/lib/period";
import { BarList, ColumnChart } from "@/components/charts/bars";
import { Delta, PeriodTabs } from "@/components/app/period";
import { RepFilter } from "./rep-filter";

export const metadata: Metadata = { title: "Analytics" };

function Panel({ title, sub, children, insight }: { title: string; sub?: string; children: React.ReactNode; insight?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-white">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </header>
      <div className="px-4 py-3">
        {insight && <p className="mb-3 rounded-md bg-brand-50 px-3 py-2 text-[13px] text-brand-900">{insight}</p>}
        {children}
      </div>
    </section>
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

  const [kpi, prev, daily, hours, dispositions, sources, campaigns, losses] = await Promise.all([
    callKpis(ctx, since, until, rep),
    callKpis(ctx, period.prevSince, period.prevUntil, rep),
    dailySeries(ctx, since, until, tz, rep),
    connectByLocalHour(ctx, since, until, rep),
    dispositionBreakdown(ctx, since, until, rep),
    segmentPerformance(ctx, since, until, "source", rep),
    segmentPerformance(ctx, since, until, "campaign", rep),
    lossReasons(ctx, since, until, rep),
  ]);

  // Fill missing days so gaps read as zero, not as missing bars.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days: { day: string; dials: number; meetings: number; weekend: boolean }[] = [];
  for (let t = since.getTime(); t <= until.getTime(); t += 86_400_000) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(t));
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(t));
    days.push({ day, dials: byDay.get(day)?.dials ?? 0, meetings: byDay.get(day)?.meetings ?? 0, weekend: wd === "Sat" || wd === "Sun" });
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

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Analytics{repName ? ` · ${repName}` : manager ? "" : " · You"}</h1>
          <p className="mt-0.5 text-sm text-muted">What is working, when to call, and where meetings come from.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {manager && <RepFilter value={rep ?? ""} reps={members.filter((m) => m.role === "rep").map((m) => ({ id: m.id, name: m.name }))} />}
          <PeriodTabs value={period.key} base="/analytics" extra={extra} exclude={["today"]} />
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-5">
        {[
          { k: "Dials", v: kpi.dials.toLocaleString(), d: <Delta now={kpi.dials} prev={prev.dials} /> },
          { k: "Connect rate", v: fmtPct(avgConnect), d: <Delta now={avgConnect} prev={rate(prev.connects, prev.dials)} pct /> },
          { k: "Meetings booked", v: kpi.meetings.toLocaleString(), d: <Delta now={kpi.meetings} prev={prev.meetings} /> },
          { k: "Conversations → meeting", v: fmtPct(rate(kpi.meetings, kpi.connects)), d: <Delta now={rate(kpi.meetings, kpi.connects)} prev={rate(prev.meetings, prev.connects)} pct /> },
          { k: "Pipeline created", v: fmtMoney(kpi.pipelineCreated), d: <Delta now={kpi.pipelineCreated} prev={prev.pipelineCreated} money /> },
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Dials per day" sub="Weekends shown in gray.">
          <ColumnChart
            title="Dials per day"
            bars={days.map((d) => ({ label: dayLabel(d.day), value: d.dials, muted: d.weekend, tooltip: `${d.dials} dials · ${d.meetings} meeting${d.meetings === 1 ? "" : "s"}` }))}
            labelEvery={Math.ceil(days.length / 8)}
          />
        </Panel>

        <Panel
          title="When people pick up"
          sub="Connect rate by the contact's local hour (hours with 20+ dials)."
          insight={
            bestHour && worstHour && bestHour.hour !== worstHour.hour ? (
              <>
                Best window: <strong>{hourLabel(bestHour.hour)}–{hourLabel(bestHour.hour + 1)}</strong> local ({fmtPct(rate(bestHour.connects, bestHour.dials))} connect vs. {fmtPct(avgConnect)} average).
                Weakest: {hourLabel(worstHour.hour)}–{hourLabel(worstHour.hour + 1)} ({fmtPct(rate(worstHour.connects, worstHour.dials))}). Block call time accordingly.
              </>
            ) : undefined
          }
        >
          <ColumnChart
            title="Connect rate by contact local hour"
            bars={hours.map((h) => ({ label: hourLabel(h.hour), value: Math.round(rate(h.connects, h.dials) * 1000) / 10, muted: h.dials < 20, tooltip: `${fmtPct(rate(h.connects, h.dials))} of ${h.dials} dials` }))}
            format={(n) => `${n}%`}
          />
        </Panel>

        <Panel
          title="Lead sources"
          sub="Leads created in this period and what became of them."
          insight={
            bestSrc && outbound && bestSrc.key !== "outbound_list" && outbound.meetingRate > 0 ? (
              <>
                <strong>{bestSrc.label}</strong> leads book meetings at {(bestSrc.meetingRate / outbound.meetingRate).toFixed(1)}× the rate of outbound lists ({fmtPct(bestSrc.meetingRate)} vs. {fmtPct(outbound.meetingRate)}). Make sure they are called first.
              </>
            ) : undefined
          }
        >
          <SegmentTable rows={srcRows} />
        </Panel>

        <Panel title="Campaigns" sub="Leads created in this period, by campaign.">
          <SegmentTable rows={campaigns.map((r) => ({ ...r, label: r.key, meetingRate: rate(r.meetings, r.leads) }))} />
        </Panel>

        <Panel title="Call outcomes" sub="Every logged call in the period.">
          <BarList
            caption="Call outcomes"
            rows={dispositions.map((d) => ({ label: DISPOSITION_MAP[d.disposition as DispositionKey]?.label ?? String(d.disposition), value: d.n, sub: fmtPct(rate(d.n, kpi.dials)) }))}
          />
        </Panel>

        <Panel title="Why we lose" sub="Lost deals and disqualified leads in the period.">
          <h3 className="mb-1 text-xs font-medium text-muted">Lost deals</h3>
          <BarList caption="Lost deal reasons" rows={losses.deals.map((r) => ({ label: r.reason ?? "No reason", value: r.n }))} />
          <h3 className="mb-1 mt-4 text-xs font-medium text-muted">Disqualified leads</h3>
          <BarList caption="Disqualification reasons" rows={losses.leads.map((r) => ({ label: r.reason ?? "No reason", value: r.n }))} />
        </Panel>
      </div>
    </div>
  );
}

function SegmentTable({ rows }: { rows: { label: string; leads: number; contacted: number; connected: number; meetings: number; meetingRate: number; pipeline: number }[] }) {
  if (!rows.length) return <p className="py-4 text-[13px] text-muted">No leads created in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted">
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
              <td className="tabular py-1.5 text-right">{r.leads}</td>
              <td className="tabular py-1.5 text-right">{r.leads ? fmtPct(r.connected / r.leads) : "—"}</td>
              <td className="tabular py-1.5 text-right font-medium text-ink">{r.meetings}</td>
              <td className="tabular py-1.5 text-right">{fmtPct(r.meetingRate, 1)}</td>
              <td className="tabular py-1.5 text-right">{fmtMoney(r.pipeline, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
