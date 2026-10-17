import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Ban, CalendarClock, CheckSquare, Clock, ExternalLink, Globe, Handshake, History, Mail, MapPin, Phone, Smartphone, Target, TrendingUp } from "lucide-react";
import { isManager, requireSession } from "@/lib/auth/session";
import { ctxOf, listMembers } from "@/lib/services/context";
import { getLead } from "@/lib/services/leads";
import { SOURCES } from "@/lib/domain/scoring";
import { localTimeLabel, tzShort } from "@/lib/domain/time";
import { fmtDateTime, fmtMoney, fmtPhone, fmtRelative, initials } from "@/lib/format";
import { DispositionBadge, StatusBadge, TempBadge } from "@/components/app/lead-badges";
import { Timeline } from "@/components/app/timeline";
import { NewTaskButton, TaskItem } from "@/components/app/task-list";
import { Badge, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LeadActions, NoteComposer } from "./lead-client";
import { CreateDealButton } from "../../pipeline/[id]/deal-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const l = /^[0-9a-f-]{36}$/.test(id) ? await getLead(ctxOf(session), id) : null;
  return { title: l ? `${l.contact.firstName} ${l.contact.lastName}` : "Lead" };
}

const SIGNAL_KEYS = new Set(["source", "fresh", "connected", "interest", "qualified"]);

function Subhead({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
      <Icon className="h-3 w-3" aria-hidden /> {children}
    </h2>
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
  const blocked = c.doNotCall || c.phoneInvalid || !(c.phone || c.mobile);
  const done = l.status === "unqualified" || l.status === "converted";
  const dueNow = !done && !blocked && l.nextActionType !== "none" && (!l.nextActionAt || l.nextActionAt <= now);
  const openDeal = lead.deals.find((d) => d.stage.kind === "open");
  const signals = l.scoreFactors.filter((f) => f.points > 0 && SIGNAL_KEYS.has(f.key));
  const fit = l.scoreFactors.filter((f) => f.points > 0 && !SIGNAL_KEYS.has(f.key));
  const risks = l.scoreFactors.filter((f) => f.points < 0);
  const lastCall = lead.timeline.find((t) => t.a.type === "call");

  const nextTitle = done
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
            }`;

  return (
    <div className="px-4 py-5 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-faint">
        <Link href="/leads" className="hover:text-ink">
          Leads
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-muted">
          {c.firstName} {c.lastName}
        </span>
      </nav>

      {/* Identity + actions */}
      <header className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-50 text-sm font-semibold text-brand-200" aria-hidden>
            {initials(`${c.firstName} ${c.lastName}`)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold leading-[30px] tracking-tight text-ink">
                {c.firstName} {c.lastName}
              </h1>
              <StatusBadge status={l.status} />
              <TempBadge score={l.score} />
              {c.doNotCall && (
                <Badge tone="red">
                  <Ban className="h-3 w-3" aria-hidden /> Do not call
                </Badge>
              )}
            </div>
            <p className="text-sm text-ink-2">
              {c.title}
              {co && (
                <>
                  <span className="text-faint"> at </span>
                  <Link href={`/companies/${co.id}`} className="font-medium text-ink hover:text-brand-200">
                    {co.name}
                  </Link>
                </>
              )}
            </p>
            <p className="mt-0.5 text-xs text-faint">
              {SOURCES[l.source]?.label ?? l.source}
              {lead.campaign && ` · ${lead.campaign.name}`} · Owner {lead.owner?.name ?? <span className="text-amber-300">Unassigned</span>} · Added {fmtDateTime(l.createdAt, tz, { date: true, time: false })}
            </p>
          </div>
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

      {/* Key facts */}
      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        <div className="bg-surface px-4 py-2.5">
          <dt className="text-[11px] text-faint">Lead score</dt>
          <dd className="tabular mt-0.5 text-lg font-semibold text-ink">
            {l.score}
            <span className="text-xs font-normal text-faint">/100</span>
          </dd>
        </div>
        <div className="bg-surface px-4 py-2.5">
          <dt className="text-[11px] text-faint">Calls</dt>
          <dd className="tabular mt-0.5 text-lg font-semibold text-ink">
            {l.attemptCount} <span className="text-xs font-normal text-faint">· {l.connectCount} reached</span>
          </dd>
        </div>
        <div className="bg-surface px-4 py-2.5">
          <dt className="text-[11px] text-faint">Last touch</dt>
          <dd className="mt-1 flex items-center gap-2 text-[13px] text-ink" suppressHydrationWarning>
            {lastCall ? (
              <>
                <DispositionBadge disposition={lastCall.a.disposition} /> {fmtRelative(lastCall.a.occurredAt)}
              </>
            ) : (
              <span className="text-muted">Never contacted</span>
            )}
          </dd>
        </div>
        <div className="bg-surface px-4 py-2.5">
          <dt className="text-[11px] text-faint">Their local time</dt>
          <dd className={cn("mt-1 text-[13px] font-medium", lead.ranked.callableNow ? "text-emerald-300" : "text-amber-300")} suppressHydrationWarning>
            {localTimeLabel(now, c.timezone)} {tzShort(c.timezone, now)}
            <span className="ml-1.5 text-xs font-normal text-faint">{lead.ranked.callableNow ? "calling hours" : "after hours"}</span>
          </dd>
        </div>
        <div className="bg-surface px-4 py-2.5">
          <dt className="text-[11px] text-faint">Pipeline</dt>
          <dd className="mt-1 text-[13px] text-ink">
            {openDeal ? (
              <Link href={`/pipeline/${openDeal.deal.id}`} className="hover:text-brand-200">
                <span className="tabular font-semibold">{fmtMoney(openDeal.deal.value, true)}</span> <span className="text-faint">· {openDeal.stage.name}</span>
              </Link>
            ) : (
              <span className="text-muted">No open deal</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {/* Next action: what to do and why */}
          <section
            aria-label="Next action"
            className={cn(
              "rounded-lg border px-4 py-3",
              dueNow ? "border-brand-500/40 bg-brand-50" : blocked && !done ? "border-red-500/30 bg-red-500/10" : "border-line bg-surface",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Target className={cn("mt-0.5 h-4 w-4 shrink-0", dueNow ? "text-brand-300" : "text-faint")} aria-hidden />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Next action</div>
                  <div className="mt-0.5 text-[15px] font-semibold text-ink">{nextTitle}</div>
                  {l.nextActionReason && !done && <p className="mt-0.5 text-[13px] text-ink-2">{l.nextActionReason}</p>}
                  {c.phoneInvalid && !done && (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-red-200">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Last call reached the wrong number. Edit the contact to re-queue.
                    </p>
                  )}
                </div>
              </div>
              {!done && !blocked && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Why this lead">
                  {lead.ranked.reasons.slice(0, 3).map((r) => (
                    <li key={r} className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-2">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <Panel title="Activity" icon={History} description="Calls, notes, status and pipeline changes">
            <NoteComposer leadId={l.id} />
            <Timeline items={lead.timeline} tz={tz} />
          </Panel>
        </div>

        <aside className="space-y-4" aria-label="Lead details">
          {/* Profile: contact, signals, research — one compact card */}
          <div className="divide-y divide-line rounded-lg border border-line bg-surface shadow-card">
            <section className="px-4 py-3">
              <Subhead icon={Phone}>Contact</Subhead>
              <dl className="space-y-1.5 text-[13px]">
                {[
                  { icon: Phone, label: "Direct", value: c.phone ? fmtPhone(c.phone) : null, href: c.phone ? `/desk?lead=${l.id}` : null, phone: true },
                  { icon: Smartphone, label: "Mobile", value: c.mobile ? fmtPhone(c.mobile) : null, href: c.mobile ? `/desk?lead=${l.id}` : null, phone: true },
                  { icon: Mail, label: "Email", value: c.email, href: c.email ? `mailto:${c.email}` : null },
                  { icon: ExternalLink, label: "LinkedIn", value: c.linkedinUrl ? "Profile" : null, href: c.linkedinUrl, external: true },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2.5">
                    <r.icon className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
                    <dt className="w-14 shrink-0 text-xs text-faint">{r.label}</dt>
                    <dd className={cn("min-w-0 truncate", r.phone && c.phoneInvalid && "text-red-300 line-through")}>
                      {r.value && r.href ? (
                        <a href={r.href} className="text-ink hover:text-brand-200" {...(r.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                          {r.value}
                        </a>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="px-4 py-3">
              <Subhead icon={TrendingUp}>Buying signals &amp; fit</Subhead>
              {l.scoreFactors.length === 0 ? (
                <p className="text-[13px] text-muted">No scoring signals yet.</p>
              ) : (
                <ul className="space-y-1 text-[13px]">
                  {[...signals.map((f) => ({ ...f, kind: "signal" })), ...fit.map((f) => ({ ...f, kind: "fit" })), ...risks.map((f) => ({ ...f, kind: "risk" }))].map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-ink-2">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", f.kind === "signal" ? "bg-emerald-400" : f.kind === "fit" ? "bg-slate-400" : "bg-amber-400")} aria-hidden />
                        <span className="truncate">{f.label}</span>
                        <span className="sr-only">({f.kind === "signal" ? "buying signal" : f.kind === "fit" ? "fit" : "risk"})</span>
                      </span>
                      <span className={cn("tabular shrink-0 text-xs font-medium", f.points > 0 ? "text-emerald-300" : "text-red-300")}>
                        {f.points > 0 ? "+" : ""}
                        {f.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {co && (
              <section className="px-4 py-3">
                <Subhead icon={Globe}>Research</Subhead>
                <Link href={`/companies/${co.id}`} className="text-[13px] font-medium text-ink hover:text-brand-200">
                  {co.name}
                </Link>
                <p className="mt-0.5 text-xs text-ink-2">{[co.industry, co.employeeCount && `${co.employeeCount.toLocaleString()} employees`, co.annualRevenue && `${fmtMoney(co.annualRevenue, true)} revenue`].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden /> {co.city}, {co.state}
                  </span>
                  {co.domain && (
                    <a href={`https://${co.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-200">
                      <Globe className="h-3 w-3" aria-hidden /> {co.domain}
                    </a>
                  )}
                </p>
                {co.description && <p className="mt-1.5 text-xs leading-relaxed text-muted">{co.description}</p>}
                {lead.colleagues.length > 0 && (
                  <div className="mt-2.5 border-t border-line pt-2">
                    <div className="mb-1 text-[11px] text-faint">Also at {co.name}</div>
                    <ul className="space-y-1">
                      {lead.colleagues.map((p) => (
                        <li key={p.leadId} className="flex items-center justify-between gap-2 text-[13px]">
                          <Link href={`/leads/${p.leadId}`} className="min-w-0 truncate text-ink-2 hover:text-brand-200">
                            {p.firstName} {p.lastName}
                            <span className="text-xs text-faint"> · {p.title}</span>
                          </Link>
                          <StatusBadge status={p.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>

          <Panel title="Follow-ups" icon={CheckSquare} actions={lead.canWork ? <NewTaskButton tz={tz} leadId={l.id} defaultTitle={`Follow up with ${c.firstName}`} /> : undefined}>
            {lead.openTasks.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No open follow-ups.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {lead.openTasks.map(({ task, assignee }) => (
                  <TaskItem key={task.id} t={{ ...task, assignee }} tz={tz} />
                ))}
              </ul>
            )}
          </Panel>

          {(lead.deals.length > 0 || (lead.canWork && !done)) && (
            <Panel
              title="Deals"
              icon={Handshake}
              actions={lead.canWork && !done && !openDeal ? <CreateDealButton leadId={l.id} /> : undefined}
            >
              {lead.deals.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-muted">Booking a meeting from the Calling Desk opens a deal automatically.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {lead.deals.map(({ deal, stage }) => (
                    <li key={deal.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0">
                        <Link href={`/pipeline/${deal.id}`} className="block truncate text-[13px] font-medium text-ink hover:text-brand-200">
                          {deal.name}
                        </Link>
                        <Badge tone={stage.kind === "won" ? "green" : stage.kind === "lost" ? "red" : "violet"} className="mt-1">
                          {stage.name}
                        </Badge>
                      </span>
                      <span className="tabular shrink-0 text-[13px] font-semibold text-ink">{fmtMoney(deal.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {lead.meetings.length > 0 && (
            <Panel title="Meetings" icon={CalendarClock}>
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
            </Panel>
          )}

          <p className="flex items-center gap-1.5 px-1 text-[11px] text-faint" suppressHydrationWarning>
            <Clock className="h-3 w-3" aria-hidden /> Updated {fmtRelative(l.updatedAt)}
          </p>
        </aside>
      </div>
    </div>
  );
}
