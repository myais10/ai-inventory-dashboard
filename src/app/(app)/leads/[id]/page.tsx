import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Ban, Building2, Clock, ExternalLink, Mail, MapPin, Phone, Smartphone, Users } from "lucide-react";
import { isManager, requireSession } from "@/lib/auth/session";
import { ctxOf, listMembers } from "@/lib/services/context";
import { getLead } from "@/lib/services/leads";
import { SOURCES, scoreTier } from "@/lib/domain/scoring";
import { localTimeLabel, tzShort } from "@/lib/domain/time";
import { fmtDateTime, fmtMoney, fmtPhone, fmtRelative } from "@/lib/format";
import { ScoreBadge, StatusBadge } from "@/components/app/lead-badges";
import { Timeline } from "@/components/app/timeline";
import { NewTaskButton, TaskItem } from "@/components/app/task-list";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LeadActions, NoteComposer } from "./lead-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const l = /^[0-9a-f-]{36}$/.test(id) ? await getLead(ctxOf(session), id) : null;
  return { title: l ? `${l.contact.firstName} ${l.contact.lastName}` : "Lead" };
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [lead, members] = await Promise.all([getLead(ctx, id), listMembers(ctx)]);
  if (!lead) notFound();
  const tz = session.org.timezone;
  const { contact: c, company: co, lead: l } = lead;
  const now = new Date();
  const tier = scoreTier(l.score);
  const blocked = c.doNotCall || c.phoneInvalid || !(c.phone || c.mobile);
  const done = l.status === "unqualified" || l.status === "converted";
  const dueNow = !done && !blocked && l.nextActionType !== "none" && (!l.nextActionAt || l.nextActionAt <= now);

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <Link href="/leads" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Leads
      </Link>

      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">
              {c.firstName} {c.lastName}
            </h1>
            <StatusBadge status={l.status} />
            <Badge tone={tier.tone}>{tier.label}</Badge>
            {c.doNotCall && (
              <Badge tone="red">
                <Ban className="h-3 w-3" aria-hidden /> Do not call
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {c.title}
            {co && (
              <>
                {" "}
                at{" "}
                <Link href={`/companies/${co.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                  {co.name}
                </Link>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {SOURCES[l.source]?.label ?? l.source}
            {lead.campaign && ` · ${lead.campaign.name}`} · Owner: {lead.owner?.name ?? <span className="text-amber-700">Unassigned</span>} · Added {fmtDateTime(l.createdAt, tz, { date: true, time: false })}
          </p>
        </div>
        <LeadActions
          leadId={l.id}
          status={l.status}
          ownerId={l.ownerId}
          userId={session.user.id}
          canWork={lead.canWork}
          isManager={isManager(session)}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          callable={!blocked && !done}
          contact={{ firstName: c.firstName, lastName: c.lastName, title: c.title, email: c.email, phone: c.phone, mobile: c.mobile, timezone: c.timezone }}
        />
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* What should I do, and why */}
          <section
            aria-label="Next action"
            className={cn("rounded-lg border px-4 py-3.5", dueNow ? "border-brand-300 bg-brand-50" : blocked && !done ? "border-red-200 bg-red-50" : "border-line bg-white")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Next action</div>
                <div className="mt-0.5 text-[15px] font-semibold text-ink">
                  {done
                    ? l.status === "converted"
                      ? "Customer — nothing to do here"
                      : `Unqualified${l.unqualifiedReason ? `: ${l.unqualifiedReason}` : ""}`
                    : c.doNotCall
                      ? "Do not call"
                      : c.phoneInvalid
                        ? "Find a working number"
                        : l.nextActionType === "none"
                          ? l.status === "qualified"
                            ? "Work the deal"
                            : "No action scheduled"
                          : `${l.nextActionType === "callback" ? "Callback" : l.attemptCount === 0 ? "First call" : `Call (attempt ${l.attemptCount + 1})`} · ${
                              dueNow ? "due now" : fmtDateTime(l.nextActionAt, tz, { weekday: true, date: true, time: true })
                            }`}
                </div>
                {l.nextActionReason && !done && <p className="mt-0.5 text-[13px] text-ink-2">{l.nextActionReason}</p>}
                {c.phoneInvalid && !done && (
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-red-800">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Last call reached the wrong number. Edit the contact to re-queue.
                  </p>
                )}
              </div>
              {!done && !blocked && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Why this lead">
                  {lead.ranked.reasons.slice(0, 3).map((r) => (
                    <li key={r} className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-ink-2 ring-1 ring-line">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <Section title="Activity">
            <NoteComposer leadId={l.id} />
            <Timeline items={lead.timeline} tz={tz} />
          </Section>
        </div>

        <aside className="space-y-5" aria-label="Lead details">
          <Section title="Contact">
            <dl className="space-y-2.5 px-4 py-3 text-[13px]">
              {[
                { icon: Phone, label: "Direct", value: c.phone, href: c.phone ? `/desk?lead=${l.id}` : null, phone: true },
                { icon: Smartphone, label: "Mobile", value: c.mobile, href: c.mobile ? `/desk?lead=${l.id}` : null, phone: true },
                { icon: Mail, label: "Email", value: c.email, href: c.email ? `mailto:${c.email}` : null },
                { icon: ExternalLink, label: "LinkedIn", value: c.linkedinUrl ? "Profile" : null, href: c.linkedinUrl },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2.5">
                  <r.icon className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  <dt className="w-14 shrink-0 text-xs text-muted">{r.label}</dt>
                  <dd className={cn("min-w-0 truncate", r.phone && c.phoneInvalid && "text-red-700 line-through")}>
                    {r.value && r.href ? (
                      <a href={r.href} className="text-ink hover:text-brand-700 hover:underline" {...(r.label === "LinkedIn" ? { target: "_blank", rel: "noreferrer" } : {})}>
                        {r.phone ? fmtPhone(r.value) : r.value}
                      </a>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </dd>
                </div>
              ))}
              <div className="flex items-center gap-2.5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                <dt className="w-14 shrink-0 text-xs text-muted">Local</dt>
                <dd suppressHydrationWarning>
                  {localTimeLabel(now, c.timezone)} {tzShort(c.timezone, now)}
                  {!lead.ranked.callableNow && <span className="ml-1.5 text-xs text-amber-700">outside calling hours</span>}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Lead score" action={<ScoreBadge score={l.score} />}>
            <ul className="px-4 py-3 text-[13px]">
              {l.scoreFactors.length === 0 && <li className="text-muted">No scoring signals yet.</li>}
              {l.scoreFactors.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-3 py-0.5">
                  <span className="text-ink-2">{f.label}</span>
                  <span className={cn("tabular font-medium", f.points > 0 ? "text-emerald-700" : "text-red-700")}>
                    {f.points > 0 ? "+" : ""}
                    {f.points}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Tasks" action={lead.canWork ? <NewTaskButton tz={tz} leadId={l.id} defaultTitle={`Follow up with ${c.firstName}`} /> : undefined}>
            {lead.openTasks.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No open tasks.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {lead.openTasks.map(({ task, assignee }) => (
                  <TaskItem key={task.id} t={{ ...task, assignee }} tz={tz} />
                ))}
              </ul>
            )}
          </Section>

          {lead.deals.length > 0 && (
            <Section title="Deals">
              <ul className="divide-y divide-line/70">
                {lead.deals.map(({ deal, stage }) => (
                  <li key={deal.id} className="px-4 py-3">
                    <Link href={`/pipeline/${deal.id}`} className="text-[13px] font-medium text-ink hover:text-brand-700 hover:underline">
                      {deal.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <Badge tone={stage.kind === "won" ? "green" : stage.kind === "lost" ? "red" : "violet"}>{stage.name}</Badge>
                      <span className="tabular">{fmtMoney(deal.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {lead.meetings.length > 0 && (
            <Section title="Meetings">
              <ul className="divide-y divide-line/70">
                {lead.meetings.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <span className="min-w-0 truncate text-ink-2">{m.title}</span>
                    <span className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                      {m.status === "scheduled" ? fmtDateTime(m.scheduledAt, tz, { weekday: true, date: true, time: true }) : m.status.replace("_", "-")}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {co && (
            <Section title="Company">
              <div className="space-y-2 px-4 py-3 text-[13px]">
                <Link href={`/companies/${co.id}`} className="flex items-center gap-2 font-medium text-ink hover:text-brand-700 hover:underline">
                  <Building2 className="h-3.5 w-3.5 text-faint" aria-hidden /> {co.name}
                </Link>
                <p className="text-ink-2">{[co.industry, co.employeeCount && `${co.employeeCount} employees`, co.annualRevenue && `${fmtMoney(co.annualRevenue, true)} revenue`].filter(Boolean).join(" · ")}</p>
                <p className="flex items-center gap-1.5 text-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {co.city}, {co.state}
                </p>
                {lead.colleagues.length > 0 && (
                  <div className="border-t border-line pt-2">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                      <Users className="h-3.5 w-3.5" aria-hidden /> Also at {co.name}
                    </div>
                    <ul className="space-y-1">
                      {lead.colleagues.map((p) => (
                        <li key={p.leadId} className="flex items-center justify-between gap-2">
                          <Link href={`/leads/${p.leadId}`} className="truncate text-ink hover:text-brand-700 hover:underline">
                            {p.firstName} {p.lastName}
                            <span className="text-xs text-muted"> · {p.title}</span>
                          </Link>
                          <StatusBadge status={p.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          <p className="px-1 text-xs text-faint" suppressHydrationWarning>
            {l.attemptCount} call attempt{l.attemptCount === 1 ? "" : "s"} · {l.connectCount} connect{l.connectCount === 1 ? "" : "s"}
            {l.lastContactedAt && ` · last ${fmtRelative(l.lastContactedAt)}`}
          </p>
        </aside>
      </div>
    </div>
  );
}
