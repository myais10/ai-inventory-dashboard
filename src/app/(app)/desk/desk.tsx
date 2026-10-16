"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Ban, CalendarClock, Clock, Lightbulb, Loader2, Phone, PhoneCall, PhoneOff, SkipForward, Smartphone } from "lucide-react";
import { DISPOSITIONS, NOT_INTERESTED_REASONS, type DispositionKey, type LeadStatus } from "@/lib/domain/dispositions";
import type { CallPrep } from "@/lib/providers/types";
import type { ScoreFactor } from "@/lib/db/schema";
import { DispositionBadge, ScoreBadge, StatusBadge } from "@/components/app/lead-badges";
import { Kbd, useShortcuts } from "@/components/app/shortcuts";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime, fmtDuration, fmtPhone, fmtRelative, toLocalInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { endCallAction, logCallAction, startCallAction } from "./actions";

interface QueueItem {
  id: string;
  name: string;
  company: string | null;
  reason: string;
  callableNow: boolean;
  callback: boolean;
  score: number;
}

interface DeskLead {
  id: string;
  status: LeadStatus;
  score: number;
  scoreFactors: ScoreFactor[];
  attemptCount: number;
  connectCount: number;
  nextActionReason: string | null;
  nextActionType: string | null;
  nextActionAt: string | null;
  lastContactedAt: string | null;
  source: string;
  ownerName: string | null;
  campaign: string | null;
  canWork: boolean;
  reasons: string[];
  callableNow: boolean;
  contact: { firstName: string; lastName: string; title: string | null; phone: string | null; mobile: string | null; email: string | null; timezone: string; doNotCall: boolean; phoneInvalid: boolean };
  company: { id: string; name: string; industry: string | null; employeeCount: number | null; city: string | null; state: string | null } | null;
  timeline: { id: string; type: string; title: string; disposition: string | null; body: string | null; at: string; user: string | null; durationSec: number | null }[];
  openTasks: { id: string; title: string; dueAt: string }[];
  colleagues: { leadId: string; firstName: string; lastName: string; title: string | null; status: LeadStatus }[];
  openDeal: { id: string; stage: string } | null;
}

export interface DeskProps {
  tz: string;
  queue: QueueItem[];
  queueTotal: number;
  callbacks: number;
  callableNow: number;
  skipped: string[];
  upcoming: { id: string; name: string; company: string | null; at: string; callback: boolean }[];
  campaigns: { id: string; name: string }[];
  campaignId: string;
  stats: { dials: number; connects: number; meetings: number; talkSec: number };
  provider: { name: string; live: boolean; description: string };
  aiLabel: string;
  lead: DeskLead | null;
  activeCall: { callId: string; startedAt: string; ended: boolean; durationSec: number | null } | null;
  prep: CallPrep | null;
}

// ---------- time quick-picks in the contact's timezone ----------

function weekdayIn(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
}

function businessDay(n: number, tz: string, hhmm: string) {
  let d = new Date();
  let added = 0;
  while (added < n) {
    d = new Date(d.getTime() + 86_400_000);
    if (!["Sat", "Sun"].includes(weekdayIn(d, tz))) added++;
  }
  return toLocalInput(d, tz).slice(0, 11) + hhmm;
}

/** Labels a wall-clock "YYYY-MM-DDTHH:mm" value (already in the contact's timezone). */
function pickLabel(local: string) {
  const d = new Date(`${local}:00Z`);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", hour: "numeric", minute: "2-digit" }).format(d);
}

function quickPicks(kind: "callback" | "meeting", tz: string) {
  if (kind === "callback") {
    const inHour = new Date(Date.now() + 60 * 60_000);
    inHour.setMinutes(Math.ceil(inHour.getMinutes() / 15) * 15, 0, 0);
    return [
      { label: "In 1 hour", value: toLocalInput(inHour, tz) },
      { label: pickLabel(businessDay(1, tz, "09:00")), value: businessDay(1, tz, "09:00") },
      { label: pickLabel(businessDay(1, tz, "14:00")), value: businessDay(1, tz, "14:00") },
      { label: pickLabel(businessDay(2, tz, "10:00")), value: businessDay(2, tz, "10:00") },
    ];
  }
  return [
    { label: pickLabel(businessDay(1, tz, "10:00")), value: businessDay(1, tz, "10:00") },
    { label: pickLabel(businessDay(1, tz, "14:00")), value: businessDay(1, tz, "14:00") },
    { label: pickLabel(businessDay(2, tz, "11:00")), value: businessDay(2, tz, "11:00") },
    { label: pickLabel(businessDay(3, tz, "10:00")), value: businessDay(3, tz, "10:00") },
  ];
}

function tzAbbrev(tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz;
}

// ---------- component ----------

export function Desk(p: DeskProps) {
  const router = useRouter();
  const toast = useToast();
  const lead = p.lead;
  const [call, setCall] = useState(p.activeCall);
  const [elapsed, setElapsed] = useState(0);
  const [number, setNumber] = useState<"mobile" | "phone">(lead?.contact.mobile ? "mobile" : "phone");
  const [disposition, setDisposition] = useState<DispositionKey | null>(null);
  const [notes, setNotes] = useState("");
  const [callbackLocal, setCallbackLocal] = useState("");
  const [meetingLocal, setMeetingLocal] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [navigating, startNav] = useTransition();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const draftKey = lead ? `phoonica.desk.notes.${lead.id}` : null;

  const qs = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    if (p.campaignId) u.set("campaign", p.campaignId);
    if (p.skipped.length) u.set("skip", p.skipped.join(","));
    for (const [k, v] of Object.entries(extra)) if (v) u.set(k, v);
    else u.delete(k);
    const s = u.toString();
    return s ? `/desk?${s}` : "/desk";
  };
  const go = (href: string) => startNav(() => router.push(href));

  // Restore an unsaved notes draft for this lead.
  useEffect(() => {
    if (!draftKey) return;
    try {
      const d = sessionStorage.getItem(draftKey);
      if (d) setNotes(d);
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (notes) sessionStorage.setItem(draftKey, notes);
      else sessionStorage.removeItem(draftKey);
    } catch {}
  }, [notes, draftKey]);

  useEffect(() => {
    if (!call) return;
    if (call.ended) {
      setElapsed(call.durationSec ?? 0);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [call]);

  const blocked = !lead || !lead.canWork || lead.contact.doNotCall || lead.contact.phoneInvalid || !(lead.contact.phone || lead.contact.mobile) || lead.status === "unqualified" || lead.status === "converted";
  const def = DISPOSITIONS.find((d) => d.key === disposition) ?? null;
  const missing = def?.requires === "callbackAt" && !callbackLocal ? "Pick a callback time" : def?.requires === "meeting" && !meetingLocal ? "Pick a meeting time" : def?.requires === "reason" && !reason ? "Pick a reason" : null;
  const canSave = !!lead && !!disposition && !missing && !pending && lead.canWork;

  const dial = () => {
    if (!lead || blocked || call) return;
    setError(null);
    start(async () => {
      const r = await startCallAction(lead.id, number);
      if (!r.ok) return setError(r.error);
      setCall({ callId: r.callId, startedAt: r.startedAt, ended: false, durationSec: null });
      setTimeout(() => notesRef.current?.focus(), 0);
    });
  };

  const hangup = () => {
    if (!call || call.ended) return;
    start(async () => {
      const r = await endCallAction(call.callId);
      if (!r.ok) return setError(r.error);
      setCall({ ...call, ended: true, durationSec: r.durationSec });
    });
  };

  const choose = (k: DispositionKey) => {
    setDisposition(k);
    setError(null);
    const d = DISPOSITIONS.find((x) => x.key === k)!;
    if (lead && d.requires === "callbackAt" && !callbackLocal) setCallbackLocal(quickPicks("callback", lead.contact.timezone)[1].value);
    if (lead && d.requires === "meeting" && !meetingLocal) setMeetingLocal(quickPicks("meeting", lead.contact.timezone)[0].value);
  };

  const save = () => {
    if (!lead || !disposition) return;
    if (missing) return setError(missing);
    setError(null);
    start(async () => {
      const r = await logCallAction({
        leadId: lead.id,
        callId: call?.callId ?? null,
        disposition,
        notes,
        callbackLocal,
        meetingLocal,
        reason,
        campaignId: p.campaignId || undefined,
        skip: p.skipped,
      });
      if (!r.ok) return setError(r.error);
      try {
        if (draftKey) sessionStorage.removeItem(draftKey);
      } catch {}
      toast("success", `${r.contactName}: ${r.disposition} — ${r.summary}${r.dealId ? ". Deal added to pipeline." : ""}${r.nextLeadName ? ` Next up: ${r.nextLeadName}.` : ""}`);
      go(qs({ lead: r.nextLeadId ?? undefined }));
    });
  };

  const skip = () => {
    if (!lead || call) return;
    const u = new URLSearchParams();
    if (p.campaignId) u.set("campaign", p.campaignId);
    u.set("skip", [...p.skipped, lead.id].slice(-100).join(","));
    go(`/desk?${u}`);
  };

  useShortcuts(
    [
      { keys: "c", label: "Call the current lead", group: "Calling Desk", run: dial },
      { keys: "h", label: "Hang up", group: "Calling Desk", run: hangup },
      ...DISPOSITIONS.map((d) => ({ keys: d.shortcut, label: `Disposition: ${d.label}`, group: "Calling Desk", run: () => lead?.canWork && choose(d.key) })),
      { keys: "enter", label: "Save outcome & next lead", group: "Calling Desk", run: save },
      { keys: "mod+enter", label: "Save outcome & next lead (while typing)", group: "Calling Desk", run: save, allowInInput: true },
      { keys: "n", label: "Focus call notes", group: "Calling Desk", run: () => notesRef.current?.focus() },
      { keys: "s", label: "Skip this lead for now", group: "Calling Desk", run: skip },
      { keys: "escape", label: "Clear disposition", group: "Calling Desk", run: () => setDisposition(null) },
    ],
    [lead?.id, call, number, disposition, notes, callbackLocal, meetingLocal, reason, blocked, pending, p.skipped.join(",")],
  );

  const connectRate = p.stats.dials ? Math.round((p.stats.connects / p.stats.dials) * 100) : 0;
  const busy = pending || navigating;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col lg:min-h-screen">
      {/* Today strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-white px-4 py-2.5 text-[13px] sm:px-6">
        <h1 className="mr-2 text-[15px] font-semibold text-ink">Calling Desk</h1>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {[
            ["Dials today", p.stats.dials],
            ["Connects", `${p.stats.connects}${p.stats.dials ? ` (${connectRate}%)` : ""}`],
            ["Meetings", p.stats.meetings],
            ["Talk time", fmtDuration(p.stats.talkSec)],
          ].map(([k, v]) => (
            <div key={k as string} className="flex items-baseline gap-1.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="tabular font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="desk-campaign" className="text-xs text-muted">
            Queue
          </label>
          <select
            id="desk-campaign"
            value={p.campaignId}
            onChange={(e) => go(e.target.value ? `/desk?campaign=${e.target.value}` : "/desk")}
            className="h-8 max-w-[220px] rounded-md border border-line-strong bg-white px-2 text-[13px]"
          >
            <option value="">All my campaigns</option>
            {p.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid flex-1 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_320px]">
        {/* Queue */}
        <aside aria-label="Call queue" className="border-b border-line bg-white lg:border-b-0 lg:border-r">
          <details className="group lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-[13px] font-medium">
              Queue · {p.queueTotal} due
              <span className="text-xs text-muted group-open:hidden">Show</span>
            </summary>
            <QueueList {...p} go={go} qs={qs} currentId={lead?.id} />
          </details>
          <div className="hidden lg:block">
            <QueueList {...p} go={go} qs={qs} currentId={lead?.id} />
          </div>
        </aside>

        {/* Current lead */}
        <section aria-label="Current lead" className={cn("min-w-0 px-4 py-5 sm:px-6", navigating && "opacity-60")}>
          {!lead ? (
            <EmptyQueue {...p} go={go} qs={qs} />
          ) : (
            <div className="mx-auto max-w-[760px] space-y-4">
              {/* Identity */}
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[22px] font-semibold tracking-tight text-ink">
                      <Link href={`/leads/${lead.id}`} className="hover:text-brand-700 hover:underline">
                        {lead.contact.firstName} {lead.contact.lastName}
                      </Link>
                    </h2>
                    <StatusBadge status={lead.status} />
                    <ScoreBadge score={lead.score} />
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {lead.contact.title}
                    {lead.company && (
                      <>
                        {" · "}
                        <Link href={`/companies/${lead.company.id}`} className="font-medium hover:text-brand-700 hover:underline">
                          {lead.company.name}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[lead.company?.industry, lead.company?.employeeCount && `${lead.company.employeeCount} employees`, lead.company?.city && `${lead.company.city}, ${lead.company.state}`, lead.campaign].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs", lead.callableNow ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")} suppressHydrationWarning>
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {fmtDateTime(new Date(), lead.contact.timezone, { date: false, time: true })} {tzAbbrev(lead.contact.timezone)} ·{" "}
                  {lead.callableNow ? "good time to call" : "outside calling hours"}
                </div>
              </header>

              {/* Why now */}
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Why this lead now</div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {lead.reasons.map((r) => (
                    <li key={r} className="rounded-full bg-white px-2 py-0.5 text-xs text-ink-2 ring-1 ring-brand-200">
                      {r}
                    </li>
                  ))}
                </ul>
                {lead.nextActionReason && <p className="mt-1.5 text-[13px] text-ink-2">{lead.nextActionReason}</p>}
                <p className="mt-1 text-xs text-muted" suppressHydrationWarning>
                  {lead.attemptCount} attempt{lead.attemptCount === 1 ? "" : "s"}, {lead.connectCount} connect{lead.connectCount === 1 ? "" : "s"}
                  {lead.lastContactedAt && ` · last call ${fmtRelative(lead.lastContactedAt)}`}
                  {lead.openDeal && ` · open deal in ${lead.openDeal.stage}`}
                  {!lead.ownerName && " · unassigned"}
                </p>
              </div>

              {/* Dialer */}
              <div className="rounded-lg border border-line bg-white p-4">
                {!lead.canWork ? (
                  <p className="text-[13px] text-muted">This lead belongs to {lead.ownerName}. Only they or a manager can log calls on it.</p>
                ) : lead.contact.doNotCall ? (
                  <p className="flex items-center gap-2 text-[13px] text-red-700">
                    <Ban className="h-4 w-4" aria-hidden /> On the do-not-call list.
                  </p>
                ) : lead.contact.phoneInvalid ? (
                  <p className="flex items-center gap-2 text-[13px] text-red-700">
                    <AlertTriangle className="h-4 w-4" aria-hidden /> Number flagged wrong.{" "}
                    <Link className="font-medium underline" href={`/leads/${lead.id}`}>
                      Fix it on the lead
                    </Link>{" "}
                    to re-queue.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <fieldset className="flex flex-wrap gap-2" disabled={!!call}>
                      <legend className="sr-only">Number to call</legend>
                      {(
                        [
                          ["mobile", lead.contact.mobile, Smartphone, "Mobile"],
                          ["phone", lead.contact.phone, Phone, "Direct"],
                        ] as const
                      )
                        .filter(([, v]) => v)
                        .map(([k, v, Icon, label]) => (
                          <label
                            key={k}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors",
                              number === k ? "border-brand-500 bg-brand-50 text-ink" : "border-line text-ink-2 hover:border-line-strong",
                            )}
                          >
                            <input type="radio" name="number" className="sr-only" checked={number === k} onChange={() => setNumber(k)} />
                            <Icon className="h-3.5 w-3.5 text-muted" aria-hidden />
                            <span className="text-xs text-muted">{label}</span>
                            <span className="tabular font-medium">{fmtPhone(v)}</span>
                          </label>
                        ))}
                    </fieldset>
                    <div className="ml-auto flex items-center gap-2">
                      {call && (
                        <span className={cn("tabular rounded-md px-2.5 py-1.5 text-sm font-semibold", call.ended ? "bg-slate-100 text-ink-2" : "bg-red-50 text-red-700")} aria-live="polite">
                          {call.ended ? "Ended" : "Live"} · {fmtDuration(elapsed)}
                        </span>
                      )}
                      {!call ? (
                        <button
                          type="button"
                          onClick={dial}
                          disabled={busy || blocked}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:opacity-50"
                        >
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PhoneCall className="h-4 w-4" aria-hidden />} Call <Kbd keys="c" className="text-white/70" />
                        </button>
                      ) : !call.ended ? (
                        <button type="button" onClick={hangup} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">
                          <PhoneOff className="h-4 w-4" aria-hidden /> Hang up <Kbd keys="h" className="text-white/70" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
                {!p.provider.live && lead.canWork && !blocked && (
                  <p className="mt-2.5 text-xs text-muted">
                    <span className="font-medium text-ink-2">{p.provider.name}:</span> {p.provider.description}
                  </p>
                )}
              </div>

              {/* Outcome */}
              {lead.canWork && (
                <div className="rounded-lg border border-line bg-white p-4">
                  <label htmlFor="call-notes" className="text-[13px] font-semibold text-ink">
                    Call notes
                  </label>
                  <textarea
                    id="call-notes"
                    ref={notesRef}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
                    rows={3}
                    placeholder="What did you learn? Pain, timeline, who decides…"
                    className="mt-1.5 w-full resize-y rounded-lg border border-line-strong px-3 py-2 text-[13px] outline-none placeholder:text-faint focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />

                  <fieldset className="mt-3">
                    <legend className="text-[13px] font-semibold text-ink">Outcome</legend>
                    <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
                      {DISPOSITIONS.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          aria-pressed={disposition === d.key}
                          onClick={(e) => {
                            choose(d.key);
                            // Return focus to the page so Enter saves instead of re-clicking this button.
                            e.currentTarget.blur();
                          }}
                          className={cn(
                            "flex items-center justify-between gap-1 rounded-md border px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors",
                            disposition === d.key
                              ? d.connected
                                ? "border-brand-600 bg-brand-700 text-white"
                                : "border-night bg-night text-white"
                              : "border-line text-ink-2 hover:border-line-strong hover:bg-subtle",
                          )}
                        >
                          <span className="truncate">{d.label}</span>
                          <kbd className={cn("rounded border px-1 text-[10px]", disposition === d.key ? "border-white/30 text-white/80" : "border-line text-muted")}>{d.shortcut}</kbd>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {def && (
                    <div className="mt-3 rounded-md bg-subtle px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
                        <ArrowRight className="h-3.5 w-3.5 text-brand-700" aria-hidden /> {def.effect}
                      </p>
                      {(def.requires === "callbackAt" || def.requires === "meeting") && (
                        <TimePicker
                          kind={def.requires === "callbackAt" ? "callback" : "meeting"}
                          tz={lead.contact.timezone}
                          value={def.requires === "callbackAt" ? callbackLocal : meetingLocal}
                          onChange={def.requires === "callbackAt" ? setCallbackLocal : setMeetingLocal}
                        />
                      )}
                      {def.requires === "reason" && (
                        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason">
                          {NOT_INTERESTED_REASONS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              role="radio"
                              aria-checked={reason === r}
                              onClick={(e) => {
                                setReason(r);
                                e.currentTarget.blur();
                              }}
                              className={cn("rounded-full border px-2.5 py-1 text-xs", reason === r ? "border-night bg-night text-white" : "border-line bg-white text-ink-2 hover:border-line-strong")}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
                      {error}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={save}
                      disabled={!canSave}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      Save & next <Kbd keys="enter" className="text-white/70" />
                    </button>
                    <button type="button" onClick={skip} disabled={!!call || busy} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-slate-100 disabled:opacity-40">
                      <SkipForward className="h-4 w-4" aria-hidden /> Skip <Kbd keys="s" className="text-muted" />
                    </button>
                    <span className="ml-auto text-xs text-muted">{!call ? "Dialed elsewhere? Pick an outcome to log it." : !disposition ? "Pick an outcome (1–0)" : missing ?? "Ready to save"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Context */}
        {lead && (
          <aside aria-label="Lead context" className="space-y-4 border-t border-line bg-white px-4 py-5 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
            {/* Call prep: read before dialing */}
            {p.prep && (
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden /> Call prep
                  </h3>
                  <span className="text-[11px] text-faint">{p.aiLabel}</span>
                </div>
                <p className="mt-2 rounded-md bg-subtle px-3 py-2 text-[13px] italic text-ink-2">“{p.prep.opener}”</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-2">
                  {p.prep.talkingPoints.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {p.prep.likelyObjection && (
                  <p className="mt-2 text-[13px] text-ink-2">
                    <span className="font-medium text-ink">If they say</span> {p.prep.likelyObjection.objection} → {p.prep.likelyObjection.response}
                  </p>
                )}
              </div>
            )}

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recent activity</h3>
              {lead.timeline.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted">First touch — no history yet.</p>
              ) : (
                <ol className="mt-2 space-y-3">
                  {lead.timeline.map((t) => (
                    <li key={t.id} className="text-[13px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.type === "call" ? <DispositionBadge disposition={t.disposition} /> : <span className="font-medium text-ink">{t.title}</span>}
                        <span className="text-xs text-faint" suppressHydrationWarning>
                          {fmtRelative(t.at)}
                          {t.user ? ` · ${t.user.split(" ")[0]}` : ""}
                        </span>
                      </div>
                      {t.body && <p className="mt-0.5 line-clamp-3 text-ink-2">{t.body}</p>}
                    </li>
                  ))}
                </ol>
              )}
              <Link href={`/leads/${lead.id}`} className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">
                Full timeline →
              </Link>
            </div>
            {lead.scoreFactors.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Score drivers</h3>
                <ul className="mt-1.5 space-y-0.5 text-[13px]">
                  {lead.scoreFactors.map((f) => (
                    <li key={f.key} className="flex justify-between gap-2">
                      <span className="text-ink-2">{f.label}</span>
                      <span className={cn("tabular", f.points > 0 ? "text-emerald-700" : "text-red-700")}>
                        {f.points > 0 ? "+" : ""}
                        {f.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lead.openTasks.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Open tasks</h3>
                <ul className="mt-1.5 space-y-1 text-[13px]">
                  {lead.openTasks.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span className="text-ink-2">{t.title}</span>
                      <span className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                        {fmtRelative(t.dueAt)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-faint">Logging this call closes these automatically.</p>
              </div>
            )}
            {lead.colleagues.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Others at {lead.company?.name}</h3>
                <ul className="mt-1.5 space-y-1 text-[13px]">
                  {lead.colleagues.map((c) => (
                    <li key={c.leadId} className="flex items-center justify-between gap-2">
                      <Link href={`/desk?lead=${c.leadId}`} className="truncate text-ink-2 hover:text-brand-700 hover:underline">
                        {c.firstName} {c.lastName} <span className="text-xs text-muted">· {c.title}</span>
                      </Link>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function TimePicker({ kind, tz, value, onChange }: { kind: "callback" | "meeting"; tz: string; value: string; onChange: (v: string) => void }) {
  const picks = useMemo(() => quickPicks(kind, tz), [kind, tz]);
  const id = `${kind}-time`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {picks.map((q) => (
        <button
          key={q.value}
          type="button"
          onClick={(e) => {
            onChange(q.value);
            e.currentTarget.blur();
          }}
          aria-pressed={value === q.value}
          className={cn("rounded-full border px-2.5 py-1 text-xs", value === q.value ? "border-night bg-night text-white" : "border-line bg-white text-ink-2 hover:border-line-strong")}
        >
          {q.label}
        </button>
      ))}
      <label htmlFor={id} className="sr-only">
        {kind === "callback" ? "Callback time" : "Meeting time"} in contact&apos;s local time
      </label>
      <input id={id} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 rounded-md border border-line-strong bg-white px-2 text-xs" />
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <CalendarClock className="h-3 w-3" aria-hidden /> their local time ({tzAbbrev(tz)})
      </span>
    </div>
  );
}

function QueueList(p: DeskProps & { go: (h: string) => void; qs: (e: Record<string, string | undefined>) => string; currentId?: string }) {
  return (
    <div>
      <div className="hidden items-baseline justify-between px-4 pb-1 pt-4 lg:flex">
        <h2 className="text-[13px] font-semibold text-ink">Up next</h2>
        <span className="tabular text-xs text-muted">
          {p.queueTotal} due{p.callbacks ? ` · ${p.callbacks} callback${p.callbacks > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      {p.queue.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-muted">Nothing due right now.</p>
      ) : (
        <ol className="max-h-[calc(100vh-10rem)] overflow-y-auto px-2 pb-3">
          {p.queue.map((q, i) => {
            const current = q.id === p.currentId;
            return (
              <li key={q.id}>
                <Link
                  href={p.qs({ lead: q.id })}
                  aria-current={current ? "true" : undefined}
                  className={cn("block rounded-md px-2.5 py-2 transition-colors", current ? "bg-brand-50 ring-1 ring-brand-300" : "hover:bg-subtle", !q.callableNow && "opacity-60")}
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular w-4 text-[11px] text-faint">{i + 1}</span>
                    <span className="flex-1 truncate text-[13px] font-medium text-ink">{q.name}</span>
                    {q.callback && <PhoneCall className="h-3 w-3 text-brand-700" aria-label="Callback" />}
                    <span className="tabular text-[11px] text-muted">{q.score}</span>
                  </span>
                  <span className="ml-6 block truncate text-xs text-muted">{q.company}</span>
                  <span className={cn("ml-6 block truncate text-[11px]", q.callback ? "text-brand-700" : "text-faint")}>{q.reason}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {p.skipped.length > 0 && (
        <div className="border-t border-line px-4 py-2 text-xs text-muted">
          {p.skipped.length} skipped ·{" "}
          <Link href={p.campaignId ? `/desk?campaign=${p.campaignId}` : "/desk"} className="font-medium text-brand-700 hover:underline">
            bring back
          </Link>
        </div>
      )}
    </div>
  );
}

function EmptyQueue(p: DeskProps & { go: (h: string) => void; qs: (e: Record<string, string | undefined>) => string }) {
  const next = p.upcoming[0];
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <PhoneCall className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="mt-3 text-lg font-semibold text-ink">Queue clear</h2>
      <p className="mt-1 text-sm text-muted">
        {p.skipped.length ? `You skipped ${p.skipped.length} lead${p.skipped.length > 1 ? "s" : ""}. ` : ""}
        Every lead you own is waiting on its next scheduled touch.
      </p>
      {next && (
        <div className="mt-6 rounded-lg border border-line bg-white p-4 text-left">
          <h3 className="text-[13px] font-semibold text-ink">Coming up</h3>
          <ul className="mt-2 divide-y divide-line/70">
            {p.upcoming.slice(0, 6).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-ink">{u.name}</span> <span className="text-muted">· {u.company}</span>
                </span>
                <span className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                  {u.callback ? "Callback " : ""}
                  {fmtDateTime(u.at, p.tz, { weekday: true, date: false, time: true })}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => p.go(p.qs({ lead: next.id }))} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-3.5 text-sm font-medium text-white hover:bg-brand-900">
            Work ahead: call {next.name.split(" ")[0]} now <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="mt-4 flex justify-center gap-3 text-sm">
        <Link href="/tasks" className="font-medium text-brand-700 hover:underline">
          Clear tasks
        </Link>
        <Link href="/leads?view=untouched&owner=me" className="font-medium text-brand-700 hover:underline">
          Find untouched leads
        </Link>
      </div>
    </div>
  );
}
