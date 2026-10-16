import type { Metadata } from "next";
import { isManager, requireSession } from "@/lib/auth/session";
import { ctxOf, listMembers } from "@/lib/services/context";
import { pipelineBoard, pipelineSummary } from "@/lib/services/deals";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Board } from "./board";
import { OwnerFilter } from "./owner-filter";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const sp = await searchParams;
  const manager = isManager(session);
  const owner = sp.owner ?? (manager ? "all" : "me");
  const [board, summary, members] = await Promise.all([pipelineBoard(ctx, { owner }), pipelineSummary(ctx, owner), listMembers(ctx)]);
  const closed = summary.won90 + summary.lost90;

  return (
    <div className="flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Pipeline</h1>
          <p className="mt-0.5 text-sm text-muted">Deals open automatically when a meeting is booked. Drag a card, or use its “Move to” menu.</p>
        </div>
        <OwnerFilter value={owner} members={members.map((m) => ({ id: m.id, name: m.name }))} />
      </div>
      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {[
          { k: "Open pipeline", v: fmtMoney(summary.openValue), sub: `${summary.openCount} deals` },
          { k: "Weighted forecast", v: fmtMoney(summary.weighted), sub: "value × stage probability" },
          { k: "Won · last 90 days", v: fmtMoney(summary.wonValue90), sub: closed ? `${fmtPct(summary.won90 / closed)} win rate (${summary.won90}/${closed})` : "no closed deals yet" },
          { k: "Stalled", v: String(summary.stale), sub: "open deals with no stage change in 14+ days", warn: summary.stale > 0 },
        ].map((x) => (
          <div key={x.k} className="bg-white px-4 py-3">
            <dt className="text-xs text-muted">{x.k}</dt>
            <dd className={`tabular mt-0.5 text-lg font-semibold ${x.warn ? "text-amber-700" : "text-ink"}`}>{x.v}</dd>
            <dd className="text-[11px] text-faint">{x.sub}</dd>
          </div>
        ))}
      </dl>
      <Board
        stages={board.stages}
        deals={board.deals.map((d) => ({
          id: d.deal.id,
          name: d.deal.name,
          stageId: d.deal.stageId,
          value: d.deal.value,
          company: d.companyName,
          contact: d.contactFirst ? `${d.contactFirst} ${d.contactLast}` : null,
          owner: d.ownerName,
          ownerId: d.deal.ownerId,
          stageChangedAt: d.deal.stageChangedAt.toISOString(),
          nextStep: d.deal.nextStep,
          nextMeetingAt: d.nextMeetingAt ? new Date(d.nextMeetingAt).toISOString() : null,
          overdueTasks: d.overdueTasks ?? 0,
          closedAt: d.deal.closedAt?.toISOString() ?? null,
          lostReason: d.deal.lostReason,
        }))}
        tz={session.org.timezone}
        userId={session.user.id}
        isManager={manager}
      />
    </div>
  );
}
