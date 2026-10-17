import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { ctxOf } from "@/lib/services/context";
import { getDeal } from "@/lib/services/deals";
import { Timeline } from "@/components/app/timeline";
import { NewTaskButton, TaskItem } from "@/components/app/task-list";
import { StatusBadge } from "@/components/app/lead-badges";
import { Badge, buttonClass } from "@/components/ui";
import { fmtDateTime, fmtMoney, fmtPhone } from "@/lib/format";
import { DealForm, MeetingOutcome, StageStepper } from "./deal-client";

export const metadata: Metadata = { title: "Deal" };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await getDeal(ctxOf(session), id);
  if (!d) notFound();
  const tz = session.org.timezone;
  const now = new Date();
  const weighted = d.stage.kind === "open" ? Math.round((d.deal.value * d.stage.probability) / 100) : null;
  const days = Math.floor((now.getTime() - d.deal.stageChangedAt.getTime()) / 86_400_000);

  return (
    <div className="px-4 py-5 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-faint">
        <Link href="/pipeline" className="hover:text-ink">
          Pipeline
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-muted">{d.company?.name ?? d.deal.name}</span>
      </nav>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">{d.deal.name}</h1>
            <Badge tone={d.stage.kind === "won" ? "green" : d.stage.kind === "lost" ? "red" : "violet"}>{d.stage.name}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">
            <span className="tabular font-semibold text-ink">{fmtMoney(d.deal.value)}</span>/yr
            {weighted !== null && <span className="text-muted"> · {fmtMoney(weighted)} weighted ({d.stage.probability}%)</span>}
            {" · "}Owner {d.owner?.name ?? "—"}
            {d.stage.kind === "open" ? ` · ${days}d in stage` : d.deal.closedAt ? ` · closed ${fmtDateTime(d.deal.closedAt, tz, { date: true, time: false })}` : ""}
            {d.deal.lostReason && ` · ${d.deal.lostReason}`}
          </p>
        </div>
        {d.contact && d.lead && (d.contact.phone || d.contact.mobile) && !d.contact.doNotCall && (
          <Link href={`/desk?lead=${d.lead.id}`} className={buttonClass("primary", "md")}>
            <Phone className="h-4 w-4" aria-hidden /> Call {d.contact.firstName}
          </Link>
        )}
      </header>

      <div className="mb-5">
        <StageStepper dealId={d.deal.id} stageId={d.deal.stageId} stages={d.stages} canEdit={d.canEdit} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-lg border border-line bg-surface shadow-card">
          <header className="border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">Activity</h2>
          </header>
          <Timeline items={d.timeline} tz={tz} />
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-line bg-surface shadow-card">
            <header className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Deal</h2>
            </header>
            <DealForm dealId={d.deal.id} initial={{ name: d.deal.name, value: d.deal.value, expectedCloseDate: d.deal.expectedCloseDate, nextStep: d.deal.nextStep }} canEdit={d.canEdit} />
          </section>

          <section className="rounded-lg border border-line bg-surface shadow-card">
            <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Tasks</h2>
              {d.canEdit && <NewTaskButton tz={tz} dealId={d.deal.id} leadId={d.lead?.id} defaultTitle={d.deal.nextStep ?? ""} />}
            </header>
            {d.tasks.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No open tasks. Every open deal should have a next step with a date.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.tasks.map(({ task, assignee }) => (
                  <TaskItem key={task.id} t={{ ...task, assignee }} tz={tz} showAssignee />
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-line bg-surface shadow-card">
            <header className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Meetings</h2>
            </header>
            {d.meetings.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No meetings yet.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.meetings.map((m) => (
                  <li key={m.id} className="px-4 py-3 text-[13px]">
                    <div className="font-medium text-ink">{m.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span suppressHydrationWarning>{fmtDateTime(m.scheduledAt, tz, { weekday: true, date: true, time: true })}</span>
                      {m.status === "scheduled" && m.scheduledAt < now && d.canEdit ? (
                        <MeetingOutcome meetingId={m.id} />
                      ) : (
                        <Badge tone={m.status === "held" ? "green" : m.status === "scheduled" ? "blue" : "red"}>{m.status.replace("_", "-")}</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {d.contact && (
            <section className="rounded-lg border border-line bg-surface px-4 py-3 text-[13px] shadow-card">
              <h2 className="mb-1.5 text-[13px] font-semibold text-ink">Contact</h2>
              {d.lead ? (
                <Link href={`/leads/${d.lead.id}`} className="font-medium text-ink hover:text-brand-200">
                  {d.contact.firstName} {d.contact.lastName}
                </Link>
              ) : (
                <span className="font-medium">
                  {d.contact.firstName} {d.contact.lastName}
                </span>
              )}
              <div className="text-xs text-muted">{d.contact.title}</div>
              <div className="mt-1 text-xs text-ink-2">{fmtPhone(d.contact.mobile ?? d.contact.phone)}</div>
              {d.lead && (
                <div className="mt-2">
                  <StatusBadge status={d.lead.status} />
                </div>
              )}
              {d.company && (
                <Link href={`/companies/${d.company.id}`} className="mt-2 block text-xs font-medium text-brand-300 hover:underline">
                  {d.company.name} →
                </Link>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
