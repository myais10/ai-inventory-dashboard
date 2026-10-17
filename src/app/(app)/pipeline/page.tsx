import type { Metadata } from "next";
import { isManager, requireSession } from "@/lib/auth/session";
import { ctxOf, listMembers } from "@/lib/services/context";
import { pipelineBoard, pipelineSummary } from "@/lib/services/deals";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Metric, PageHeader } from "@/components/ui";
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
    <div className="flex flex-col px-4 py-5 sm:px-6">
      <PageHeader
        title="Pipeline"
        description="Deals open automatically when a meeting is booked. Drag a card, or use its “Move to” menu."
        actions={<OwnerFilter value={owner} members={members.map((m) => ({ id: m.id, name: m.name }))} />}
        className="mb-4"
      />
      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Metric className="bg-surface px-4 py-3" label="Open pipeline" value={fmtMoney(summary.openValue)} sub={`${summary.openCount} open deals`} />
        <Metric className="bg-surface px-4 py-3" label="Weighted forecast" value={fmtMoney(summary.weighted)} sub="value × stage probability" />
        <Metric
          className="bg-surface px-4 py-3"
          label="Won · last 90 days"
          value={fmtMoney(summary.wonValue90)}
          sub={closed ? `${fmtPct(summary.won90 / closed)} win rate (${summary.won90} of ${closed} closed)` : "no closed deals yet"}
        />
        <Metric className="bg-surface px-4 py-3" label="Stalled 14+ days" value={String(summary.stale)} sub="open deals without a stage change" tone={summary.stale > 0 ? "warn" : undefined} />
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
          lastActivityAt: d.lastActivityAt ? new Date(d.lastActivityAt).toISOString() : null,
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
