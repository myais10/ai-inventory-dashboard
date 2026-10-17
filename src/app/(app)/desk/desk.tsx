"use client";

import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  Check,
  Clock,
  History,
  Loader2,
  MessageSquareQuote,
  Phone,
  PhoneCall,
  PhoneOff,
  ShieldQuestion,
  SkipForward,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { DISPOSITIONS, NOT_INTERESTED_REASONS, type DispositionKey, type LeadStatus } from "@/lib/domain/dispositions";
import { scoreTier } from "@/lib/domain/scoring";
import type { CallPrep } from "@/lib/providers/types";
import type { ScoreFactor } from "@/lib/db/schema";
import { DispositionBadge, StatusBadge, TEMP_TEXT } from "@/components/app/lead-badges";
import { Kbd, useShortcuts } from "@/components/app/shortcuts";
import { Badge, IconTile } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime, fmtDuration, fmtPct, fmtPhone, fmtRelative, toLocalInput } from "@/lib/format";
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
  contact: {
    firstName: string;
    lastName: string;
    title: string | null;
    phone: string | null;
    mobile: string | null;
    email: string | null;
    timezone: string;
    doNotCall: boolean;
    phoneInvalid: boolean;
  };
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
  bestWindow: { hour: number; rate: number; avg: number } | null;
  rank: number;
  provider: { name: string; live: boolean; description: string };
  aiLabel: string;
  lead: DeskLead | null;
  activeCall: { callId: string; startedAt: string; ended: boolean; durationSec: number | null } | null;
  prep: CallPrep | null;
}

// Intent + engagement factors are "buying signals"; firmographic factors are "fit".
const SIGNAL_KEYS = new Set(["source", "fresh", "connected", "interest", "qualified"]);

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

function hourLabel(h: number) {
  return `${h % 12 || 12}${h % 24 < 12 ? "am" : "pm"}`;
}

const chip = "rounded-full border px-2.5 py-1 text-xs transition-colors";
const chipOn = "border-brand-500 bg-brand-100 text-ink";
const chipOff = "border-line bg-subtle text-ink-2 hover:border-line-strong";

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
    for (const [k, v] of Object.entries(extra))
      if (v) u.set(k, v);
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

  const blocked =
    !lead ||
    !lead.canWork ||
    lead.contact.doNotCall ||
    lead.contact.phoneInvalid ||
    !(lead.contact.phone || lead.contact.mobile) ||
    lead.status === "unqualified" ||
    lead.status === "converted";
  const def = DISPOSITIONS.find((d) => d.key === disposition) ?? null;
  const missing =
    def?.requires === "callbackAt" && !callbackLocal
      ? "Pick a callback time"
      : def?.requires === "meeting" && !meetingLocal
        ? "Pick a meeting time"
        : def?.requires === "reason" && !reason
          ? "Pick a reason"
          : null;
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
      ...DISPOSITIONS.map((d) => ({ keys: d.shortcut, label: `Outcome: ${d.label}`, group: "Calling Desk", run: () => lead?.canWork && choose(d.key) })),
      { keys: "enter", label: "Save outcome & next lead", group: "Calling Desk", run: save },
      { keys: "mod+enter", label: "Save outcome & next lead (while typing)", group: "Calling Desk", run: save, allowInInput: true },
      { keys: "n", label: "Focus call notes", group: "Calling Desk", run: () => notesRef.current?.focus() },
      { keys: "s", label: "Skip this lead for now", group: "Calling Desk", run: skip },
      { keys: "escape", label: "Clear outcome", group: "Calling Desk", run: () => setDisposition(null) },
    ],
    [lead?.id, call, number, disposition, notes, callbackLocal, meetingLocal, reason, blocked, pending, p.skipped.join(",")],
  );

  const connectRate = p.stats.dials ? p.stats.connects / p.stats.dials : 0;
  const busy = pending || navigating;
  const signals = lead?.scoreFactors.filter((f) => f.points > 0 && SIGNAL_KEYS.has(f.key)) ?? [];
  const fit = lead?.scoreFactors.filter((f) => f.points > 0 && !SIGNAL_KEYS.has(f.key)) ?? [];
  const risks = lead?.scoreFactors.filter((f) => f.points < 0) ?? [];
  const tier = lead ? scoreTier(lead.score) : null;
  const eyebrow = !lead
    ? ""
    : lead.nextActionType === "callback"
      ? "Callback due"
      : p.rank === 1
        ? "Next best lead"
        : p.rank > 1
          ? `Next best lead · #${p.rank} in queue`
          : "Selected lead";

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      {/* Today strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface px-4 py-2 sm:px-5">
        <h1 className="text-[15px] font-semibold text-ink">Calling Desk</h1>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          {[
            ["Dials", p.stats.dials.toLocaleString()],
            ["Connects", `${p.stats.connects}${p.stats.dials ? ` · ${fmtPct(connectRate)}` : ""}`],
            ["Meetings", String(p.stats.meetings)],
            ["Talk time", fmtDuration(p.stats.talkSec)],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-1.5">
              <dt className="text-xs text-faint">{k}</dt>
              <dd className="tabular font-semibold text-ink">{v}</dd>
            </div>
          ))}
          <div className="text-xs text-faint">today</div>
        </dl>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="desk-campaign" className="text-xs text-faint">
            Queue
          </label>
          <select
            id="desk-campaign"
            value={p.campaignId}
            onChange={(e) => go(e.target.value ? `/desk?campaign=${e.target.value}` : "/desk")}
            className="h-8 max-w-[220px] rounded-md border border-line-strong bg-subtle px-2 text-[13px] text-ink"
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

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_312px]">
        {/* Queue */}
        <aside aria-label="Call queue" className="border-b border-line bg-surface lg:border-b-0 lg:border-r">
          <details className="group lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-[13px] font-medium text-ink">
              Queue · {p.queueTotal} due
              <span className="text-xs text-muted group-open:hidden">Show</span>
            </summary>
            <QueueList {...p} qs={qs} currentId={lead?.id} />
          </details>
          <div className="hidden lg:block">
            <QueueList {...p} qs={qs} currentId={lead?.id} />
          </div>
        </aside>

        {/* Cockpit */}
        <section aria-label="Current lead" className={cn("min-w-0 px-4 py-4 sm:px-5", navigating && "opacity-60 transition-opacity")}>
          {!lead ? (
            <EmptyQueue {...p} go={go} qs={qs} />
          ) : (
            <div key={lead.id} className="mx-auto max-w-[780px] space-y-3 animate-fade-in">
              {/* Next best lead */}
              <div className="rounded-xl border border-brand-500/30 bg-surface shadow-elevated">
                <div className="px-5 pt-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                    <Target className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> {eyebrow}
                  </div>
                  <div className="mt-1.5 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold leading-7 tracking-tight text-ink">
                        <Link href={`/leads/${lead.id}`} className="hover:text-brand-200">
                          {lead.contact.firstName} {lead.contact.lastName}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-2">
                        {lead.contact.title}
                        {lead.company && (
                          <>
                            <span className="text-faint"> · </span>
                            <Link href={`/companies/${lead.company.id}`} className="font-medium text-ink hover:text-brand-200">
                              {lead.company.name}
                            </Link>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-faint">
                        {[
                          lead.company?.industry,
                          lead.company?.employeeCount && `${lead.company.employeeCount} employees`,
                          lead.company?.city && `${lead.company.city}, ${lead.company.state}`,
                          lead.campaign,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={lead.status} />
                      <div className="text-right">
                        <div className="tabular text-2xl font-semibold leading-7 text-ink">{lead.score}</div>
                        <div className={cn("text-[11px] font-medium", TEMP_TEXT[tier!.tone])}>{tier!.label} lead</div>
                      </div>
                    </div>
                  </div>

                  {/* Facts row */}
                  <dl className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-[12.5px] md:grid-cols-4">
                    <div className="bg-subtle px-3 py-2">
                      <dt className="text-[11px] text-faint">Their time</dt>
                      <dd className={cn("mt-0.5 flex items-center gap-1.5 font-medium", lead.callableNow ? "text-emerald-300" : "text-amber-300")} suppressHydrationWarning>
                        <Clock className="h-3 w-3" aria-hidden />
                        {fmtDateTime(new Date(), lead.contact.timezone, { date: false, time: true })} {tzAbbrev(lead.contact.timezone)}
                      </dd>
                      <dd className="truncate text-[11px] text-faint">{lead.callableNow ? "Good time to call" : "Outside calling hours"}</dd>
                    </div>
                    <div className="bg-subtle px-3 py-2">
                      <dt className="text-[11px] text-faint">Best time to call</dt>
                      <dd className="mt-0.5 truncate font-medium text-ink">
                        {p.bestWindow ? `${hourLabel(p.bestWindow.hour)}–${hourLabel(p.bestWindow.hour + 1)} local` : "Not enough data"}
                      </dd>
                      {p.bestWindow && (
                        <dd className="truncate text-[11px] text-faint">
                          {fmtPct(p.bestWindow.rate)} connect · avg {fmtPct(p.bestWindow.avg)}
                        </dd>
                      )}
                    </div>
                    <div className="bg-subtle px-3 py-2">
                      <dt className="text-[11px] text-faint">Last touch</dt>
                      <dd className="mt-0.5 font-medium text-ink" suppressHydrationWarning>
                        {lead.lastContactedAt ? fmtRelative(lead.lastContactedAt) : "Never contacted"}
                      </dd>
                      <dd className="text-[11px] text-faint">
                        {lead.timeline.find((t) => t.type === "call") ? <DispositionText d={lead.timeline.find((t) => t.type === "call")!.disposition} /> : "First touch"}
                      </dd>
                    </div>
                    <div className="bg-subtle px-3 py-2">
                      <dt className="text-[11px] text-faint">History</dt>
                      <dd className="tabular mt-0.5 truncate font-medium text-ink">
                        {lead.attemptCount} call{lead.attemptCount === 1 ? "" : "s"} · {lead.connectCount} reached
                      </dd>
                      <dd className="truncate text-[11px] text-faint">
                        {lead.openDeal ? `Open deal · ${lead.openDeal.stage}` : lead.ownerName ? `Owner ${lead.ownerName.split(" ")[0]}` : "Unassigned"}
                      </dd>
                    </div>
                  </dl>

                  {/* Why + signals */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Why this lead now</h3>
                      <ul className="mt-1.5 space-y-1">
                        {lead.reasons
                          .filter((r) => !r.startsWith("Outside calling hours"))
                          .map((r) => (
                            <li key={r} className="flex items-start gap-1.5 text-[13px] text-ink-2">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden /> {r}
                            </li>
                          ))}
                      </ul>
                      {lead.nextActionReason && <p className="mt-1 text-xs text-faint">{lead.nextActionReason}</p>}
                    </div>
                    <div>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Buying signals</h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {signals.length === 0 && <span className="text-[13px] text-muted">None yet — ranked on fit.</span>}
                        {signals.map((f) => (
                          <Badge key={f.key} tone="green">
                            <TrendingUp className="h-3 w-3" aria-hidden /> {f.label}
                          </Badge>
                        ))}
                        {fit.slice(0, 3).map((f) => (
                          <Badge key={f.key} tone="slate">
                            {f.label}
                          </Badge>
                        ))}
                        {risks.map((f) => (
                          <Badge key={f.key} tone="amber">
                            {f.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dialer */}
                <div className="mt-3.5 border-t border-line px-5 py-3">
                  {!lead.canWork ? (
                    <p className="text-[13px] text-muted">This lead belongs to {lead.ownerName}. Only they or a manager can log calls on it.</p>
                  ) : lead.contact.doNotCall ? (
                    <p className="flex items-center gap-2 text-[13px] text-red-300">
                      <Ban className="h-4 w-4" aria-hidden /> On the do-not-call list.
                    </p>
                  ) : lead.contact.phoneInvalid ? (
                    <p className="flex items-center gap-2 text-[13px] text-red-300">
                      <AlertTriangle className="h-4 w-4" aria-hidden /> Number flagged wrong.{" "}
                      <Link className="font-medium underline" href={`/leads/${lead.id}`}>
                        Fix it on the lead
                      </Link>{" "}
                      to re-queue.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <fieldset className="flex flex-wrap gap-1.5" disabled={!!call}>
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
                                number === k ? "border-brand-500 bg-brand-50 text-ink" : "border-line bg-subtle text-ink-2 hover:border-line-strong",
                              )}
                            >
                              <input type="radio" name="number" className="sr-only" checked={number === k} onChange={() => setNumber(k)} />
                              <Icon className="h-3.5 w-3.5 text-muted" strokeWidth={1.75} aria-hidden />
                              <span className="text-xs text-muted">{label}</span>
                              <span className="tabular font-medium">{fmtPhone(v)}</span>
                            </label>
                          ))}
                      </fieldset>
                      <div className="ml-auto flex items-center gap-2">
                        {call && (
                          <span
                            className={cn(
                              "tabular flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
                              call.ended ? "bg-subtle text-ink-2" : "bg-red-500/10 text-red-300",
                            )}
                            aria-live="polite"
                          >
                            {!call.ended && <span className="h-2 w-2 rounded-full bg-red-400 animate-live" aria-hidden />}
                            {call.ended ? "Ended" : "Live"} · {fmtDuration(elapsed)}
                          </span>
                        )}
                        {!call ? (
                          <button
                            type="button"
                            onClick={dial}
                            disabled={busy || blocked}
                            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-6 text-[15px] font-semibold text-white shadow-[0_0_0_1px_rgb(124_58_237/0.5),0_8px_24px_-8px_rgb(124_58_237/0.6)] transition-colors hover:bg-brand-700 disabled:opacity-40"
                          >
                            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PhoneCall className="h-4 w-4" aria-hidden />} Call now{" "}
                            <Kbd keys="c" className="text-white/70" />
                          </button>
                        ) : !call.ended ? (
                          <button
                            type="button"
                            onClick={hangup}
                            disabled={busy}
                            className="inline-flex h-11 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            <PhoneOff className="h-4 w-4" aria-hidden /> Hang up <Kbd keys="h" className="text-white/70" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {!p.provider.live && lead.canWork && !blocked && (
                    <p className="mt-2 text-[11.5px] text-faint">
                      <Badge tone="amber" className="mr-1.5 align-middle">
                        Demo
                      </Badge>
                      {p.provider.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Outcome → follow-up → next */}
              {lead.canWork && (
                <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
                  <label htmlFor="call-notes" className="text-[11px] font-semibold uppercase tracking-wider text-faint">
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
                    className="mt-1.5 w-full resize-y rounded-md border border-line-strong bg-subtle px-3 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
                  />

                  <fieldset className="mt-3">
                    <legend className="text-[11px] font-semibold uppercase tracking-wider text-faint">Outcome</legend>
                    {([false, true] as const).map((reached) => (
                      <div key={String(reached)} className="mt-2">
                        <div className="mb-1 text-[11px] text-faint">{reached ? "Reached" : "Not reached"}</div>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                          {DISPOSITIONS.filter((d) => d.connected === reached).map((d) => (
                            <OutcomeButton key={d.key} d={d} active={disposition === d.key} onPick={choose} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </fieldset>

                  {def && (
                    <div className="mt-3 rounded-md border border-line bg-subtle px-3 py-2.5 animate-fade-in">
                      <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
                        <ArrowRight className="h-3.5 w-3.5 text-brand-300" aria-hidden /> {def.effect}
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
                              className={cn(chip, reason === r ? chipOn : chipOff)}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <p role="alert" className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-200 ring-1 ring-inset ring-red-500/25">
                      {error}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={save}
                      disabled={!canSave}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      Save & next <Kbd keys="enter" className="text-white/70" />
                    </button>
                    <button
                      type="button"
                      onClick={skip}
                      disabled={!!call || busy}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-subtle disabled:opacity-35"
                    >
                      <SkipForward className="h-4 w-4" aria-hidden /> Skip <Kbd keys="s" className="text-faint" />
                    </button>
                    <span className="ml-auto text-xs text-faint">
                      {!call ? "Dialed elsewhere? Pick an outcome to log it." : !disposition ? "Pick an outcome (1–0)" : (missing ?? "Ready to save")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* AI assist + context */}
        {lead && (
          <aside aria-label="Call assist" className="space-y-4 border-t border-line bg-surface px-4 py-4 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
            {p.prep && (
              <section aria-labelledby="ai-h">
                <div className="flex items-center justify-between">
                  <h3 id="ai-h" className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <IconTile icon={Sparkles} tone="brand" /> Call assist
                  </h3>
                  <span className="text-[11px] text-faint">{p.aiLabel}</span>
                </div>
                <div className="mt-3 space-y-3 text-[13px]">
                  <div>
                    <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                      <MessageSquareQuote className="h-3 w-3" aria-hidden /> What to say
                    </h4>
                    <p className="mt-1.5 rounded-md border-l-2 border-brand-500 bg-brand-50 px-3 py-2 leading-relaxed text-ink">“{p.prep.opener}”</p>
                  </div>
                  <ul className="space-y-1.5">
                    {p.prep.talkingPoints.map((t) => (
                      <li key={t} className="flex gap-2 text-ink-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-300" aria-hidden />
                        {t}
                      </li>
                    ))}
                  </ul>
                  {p.prep.likelyObjection && (
                    <div>
                      <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                        <ShieldQuestion className="h-3 w-3" aria-hidden /> If they say
                      </h4>
                      <p className="mt-1 font-medium text-ink">{p.prep.likelyObjection.objection}</p>
                      <p className="mt-0.5 text-ink-2">{p.prep.likelyObjection.response}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section aria-labelledby="hist-h" className="border-t border-line pt-4">
              <h3 id="hist-h" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                <History className="h-3 w-3" aria-hidden /> Previous interactions
              </h3>
              {lead.timeline.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted">First touch — no history yet.</p>
              ) : (
                <ol className="mt-2 space-y-2.5">
                  {lead.timeline.map((t) => (
                    <li key={t.id} className="text-[13px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.type === "call" ? <DispositionBadge disposition={t.disposition} /> : <span className="font-medium text-ink">{t.title}</span>}
                        <span className="text-[11px] text-faint" suppressHydrationWarning>
                          {fmtRelative(t.at)}
                          {t.user ? ` · ${t.user.split(" ")[0]}` : ""}
                        </span>
                      </div>
                      {t.body && <p className="mt-0.5 line-clamp-3 text-ink-2">{t.body}</p>}
                    </li>
                  ))}
                </ol>
              )}
              <Link href={`/leads/${lead.id}`} className="mt-2 inline-block text-xs font-medium text-brand-300 hover:text-brand-200">
                Full timeline →
              </Link>
            </section>

            {lead.openTasks.length > 0 && (
              <section className="border-t border-line pt-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Open follow-ups</h3>
                <ul className="mt-1.5 space-y-1 text-[13px]">
                  {lead.openTasks.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span className="text-ink-2">{t.title}</span>
                      <span className="shrink-0 text-xs text-faint" suppressHydrationWarning>
                        {fmtRelative(t.dueAt)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-faint">Logging this call closes them automatically.</p>
              </section>
            )}

            {lead.colleagues.length > 0 && (
              <section className="border-t border-line pt-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Others at {lead.company?.name}</h3>
                <ul className="mt-1.5 space-y-1.5 text-[13px]">
                  {lead.colleagues.map((c) => (
                    <li key={c.leadId} className="flex items-center justify-between gap-2">
                      <Link href={`/desk?lead=${c.leadId}`} className="min-w-0 truncate text-ink-2 hover:text-brand-200">
                        {c.firstName} {c.lastName} <span className="text-xs text-faint">· {c.title}</span>
                      </Link>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function DispositionText({ d }: { d: string | null }) {
  const def = DISPOSITIONS.find((x) => x.key === d);
  return <>{def?.label ?? "—"}</>;
}

const SHORT: Partial<Record<DispositionKey, string>> = {
  callback: "Callback",
  meeting_booked: "Meeting",
  voicemail: "Voicemail",
  wrong_number: "Bad number",
  do_not_call: "Do not call",
};

function OutcomeButton({ d, active, onPick }: { d: (typeof DISPOSITIONS)[number]; active: boolean; onPick: (k: DispositionKey) => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={`${d.label} — ${d.effect}`}
      onClick={(e) => {
        onPick(d.key);
        // Return focus to the page so Enter saves instead of re-clicking this button.
        e.currentTarget.blur();
      }}
      className={cn(
        "flex h-9 items-center justify-between gap-1 rounded-md border px-2 text-left text-[12px] font-medium transition-colors",
        active ? "border-brand-500 bg-brand-100 text-ink" : "border-line bg-subtle text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      <span className="truncate" aria-hidden>
        {SHORT[d.key] ?? d.label}
      </span>
      <span className="sr-only">{d.label}</span>
      <kbd className={cn("tabular text-[10px]", active ? "text-brand-200" : "text-faint")}>{d.shortcut}</kbd>
    </button>
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
          className={cn(chip, value === q.value ? chipOn : chipOff)}
        >
          {q.label}
        </button>
      ))}
      <label htmlFor={id} className="sr-only">
        {kind === "callback" ? "Callback time" : "Meeting time"} in contact&apos;s local time
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-line-strong bg-subtle px-2 text-xs text-ink"
      />
      <span className="flex items-center gap-1 text-[11px] text-faint">
        <CalendarClock className="h-3 w-3" aria-hidden /> their local time ({tzAbbrev(tz)})
      </span>
    </div>
  );
}

function QueueList(p: DeskProps & { qs: (e: Record<string, string | undefined>) => string; currentId?: string }) {
  return (
    <div>
      <div className="hidden items-baseline justify-between px-4 pb-2 pt-3.5 lg:flex">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Up next</h2>
        <span className="tabular text-xs text-muted">
          {p.queueTotal} due{p.callbacks ? ` · ${p.callbacks} callback${p.callbacks > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      {p.queue.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-muted">Nothing due right now.</p>
      ) : (
        <ol className="max-h-[calc(100vh-9rem)] space-y-px overflow-y-auto px-2 pb-3">
          {p.queue.map((q, i) => {
            const current = q.id === p.currentId;
            return (
              <li key={q.id}>
                <Link
                  href={p.qs({ lead: q.id })}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "relative block rounded-md px-2.5 py-2 transition-colors",
                    current ? "bg-brand-100 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-400" : "hover:bg-subtle",
                    !q.callableNow && !current && "opacity-55",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular w-4 text-[11px] text-faint">{i + 1}</span>
                    <span className="flex-1 truncate text-[13px] font-medium text-ink">{q.name}</span>
                    {q.callback && <PhoneCall className="h-3 w-3 text-brand-300" aria-label="Callback" />}
                    <span className="tabular text-[11px] text-muted">{q.score}</span>
                  </span>
                  <span className="ml-6 block truncate text-xs text-muted">{q.company}</span>
                  <span className={cn("ml-6 block truncate text-[11px]", q.callback ? "text-brand-300" : "text-faint")}>{q.reason}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {p.skipped.length > 0 && (
        <div className="border-t border-line px-4 py-2 text-xs text-muted">
          {p.skipped.length} skipped ·{" "}
          <Link href={p.campaignId ? `/desk?campaign=${p.campaignId}` : "/desk"} className="font-medium text-brand-300 hover:text-brand-200">
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
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-50 text-brand-300">
        <PhoneCall className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="mt-3 text-lg font-semibold text-ink">Queue clear</h2>
      <p className="mt-1 text-sm text-muted">
        {p.skipped.length ? `You skipped ${p.skipped.length} lead${p.skipped.length > 1 ? "s" : ""}. ` : ""}
        Every lead you own is waiting on its next scheduled touch.
      </p>
      {next && (
        <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-left shadow-card">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Coming up</h3>
          <ul className="mt-2 divide-y divide-line/70">
            {p.upcoming.slice(0, 6).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-ink">{u.name}</span> <span className="text-muted">· {u.company}</span>
                </span>
                <span className="tabular shrink-0 text-xs text-muted" suppressHydrationWarning>
                  {u.callback ? "Callback " : ""}
                  {fmtDateTime(u.at, p.tz, { weekday: true, date: false, time: true })}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => p.go(p.qs({ lead: next.id }))}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Work ahead: call {next.name.split(" ")[0]} now <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="mt-4 flex justify-center gap-4 text-sm">
        <Link href="/tasks" className="font-medium text-brand-300 hover:text-brand-200">
          Clear tasks
        </Link>
        <Link href="/leads?view=untouched&owner=me" className="font-medium text-brand-300 hover:text-brand-200">
          Find untouched leads
        </Link>
      </div>
    </div>
  );
}
